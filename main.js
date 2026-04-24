const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('youtube-dl-exec');
const fs = require('fs');
const { spawn } = require('child_process');
const { Innertube } = require('youtubei.js');

let win;
let yt;

// Initialize youtubei.js
async function initYoutube() {
  try {
    yt = await Innertube.create();
    console.log('[MAIN] youtubei.js initialized');
  } catch (error) {
    console.error('[MAIN] Failed to initialize youtubei.js:', error);
  }
}

const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveConfig(config) {
  const current = loadConfig();
  fs.writeFileSync(configPath, JSON.stringify({ ...current, ...config }));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#121212',
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    win.loadURL('http://localhost:4200');
  } else {
    win.loadFile(path.join(__dirname, 'ui/dist/ui/browser/index.html'));
  }
}

app.whenReady().then(async () => {
  await initYoutube();
  createWindow();
});

ipcMain.handle('get-config', async () => loadConfig());
ipcMain.handle('set-config', async (event, config) => saveConfig(config));

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Download Folder'
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-video-info', async (event, url) => {
  console.log(`[MAIN] Fetching info for: ${url}`);
  try {
    // Extract Video ID
    const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    if (!yt) await initYoutube();

    // Use youtubei.js (Innertube) to fetch EVERYTHING (metadata + formats)
    const info = await yt.getInfo(videoId);
    const basicInfo = info.basic_info;

    if (!info.streaming_data || !info.streaming_data.formats) {
       const basic = await yt.getBasicInfo(videoId);
       if (!basic.streaming_data) {
         throw new Error('No streaming data found for this video. It might be restricted.');
       }
       info.streaming_data = basic.streaming_data;
    }

    const allFormats = [
      ...(info.streaming_data.formats || []),
      ...(info.streaming_data.adaptive_formats || [])
    ];

    if (allFormats.length === 0) {
      throw new Error('No formats found for this video.');
    }
    
    const formats = allFormats
      .map(f => {
        const isAudio = f.mime_type.includes('audio');
        const isVideo = f.mime_type.includes('video');
        let resolution = 'Unknown';
        if (isVideo && f.quality_label) resolution = f.quality_label;
        else if (isAudio) resolution = 'Audio only';

        return {
          id: f.itag?.toString() || f.format_id,
          ext: f.mime_type.split(';')[0].split('/')[1] || 'mp4',
          resolution: resolution,
          filesize: parseInt(f.content_length) || 0,
          note: `${f.quality || ''} ${f.audio_quality || ''}`.trim()
        };
      })
      .filter(f => f.resolution !== 'Unknown');

    formats.sort((a, b) => {
      if (a.resolution === 'Audio only' && b.resolution !== 'Audio only') return 1;
      if (a.resolution !== 'Audio only' && b.resolution === 'Audio only') return -1;
      const resA = parseInt(a.resolution) || 0;
      const resB = parseInt(b.resolution) || 0;
      return resB - resA;
    });

    return { 
      success: true, 
      title: basicInfo.title || 'Unknown Title', 
      thumbnail: basicInfo.thumbnail?.[0]?.url || '', 
      formats 
    };
  } catch (error) {
    console.error('[MAIN] Error in get-video-info:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-video', async (event, { url, outputPath, formatId }) => {
  console.log(`[MAIN] Starting download for: ${url} with format: ${formatId}`);
  
  return new Promise((resolve) => {
    const flags = {
      output: path.join(outputPath, '%(title)s.%(ext)s'),
      newline: true,
      noCheckCertificates: true,
      progress: true,
      format: formatId || 'best'
    };

    const ytdl = require('youtube-dl-exec');
    const ls = ytdl.exec(url, flags);

    if (!ls || !ls.stdout) {
      resolve({ success: false, error: 'Failed to initialize download process' });
      return;
    }

    ls.stdout.on('data', (data) => {
      const line = data.toString();
      const progressMatch = line.match(/\[download\]\s+(\d+\.\d+)% of\s+([\d\w\.]+)\s+at\s+([\d\w\.\/s]+)\s+ETA\s+([\d:]+)/);
      
      if (progressMatch) {
        win.webContents.send('download-progress', {
          percent: parseFloat(progressMatch[1]),
          totalSize: progressMatch[2],
          speed: progressMatch[3],
          eta: progressMatch[4]
        });
      }
    });

    ls.stderr.on('data', (data) => {
      console.error(`[YT-DLP] ${data}`);
    });

    ls.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: `Process exited with code ${code}` });
    });

    ls.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});
