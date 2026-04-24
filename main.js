const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('youtube-dl-exec');
const fs = require('fs');
const { spawn } = require('child_process');
const { Innertube, UniversalCache } = require('youtubei.js');
const ffmpegPath = require('ffmpeg-static');

let win;
let yt;

async function initYoutube() {
  try {
    yt = await Innertube.create({ 
      cache: new UniversalCache(false),
      generate_session_store: true 
    });
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
    const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    if (!videoId) throw new Error('Invalid YouTube URL');

    let allFormats = [];
    let title = 'Unknown Title';
    let thumbnail = '';

    // Try multiple sources for metadata
    const browsers = ['chrome', 'edge', 'brave'];
    let ytdlInfo;
    
    for (const browser of browsers) {
      try {
        ytdlInfo = await exec(url, {
          dumpJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          cookiesFromBrowser: browser,
          noPlaylist: true,
        });
        if (ytdlInfo) break;
      } catch (e) { continue; }
    }

    if (ytdlInfo) {
      title = ytdlInfo.title;
      thumbnail = ytdlInfo.thumbnail;
      allFormats = ytdlInfo.formats;
    } else {
      if (!yt) await initYoutube();
      const clients = ['TVHTML5', 'ANDROID', 'WEB'];
      for (const client of clients) {
        try {
          yt.session.client_name = client;
          const info = await yt.getInfo(videoId);
          if (info && info.streaming_data) {
            title = info.basic_info.title;
            thumbnail = info.basic_info.thumbnail?.[0]?.url || '';
            allFormats = [...(info.streaming_data.formats || []), ...(info.streaming_data.adaptive_formats || [])];
            break;
          }
        } catch (e) { continue; }
      }
    }

    if (allFormats.length === 0) {
      throw new Error('Could not fetch video info. Try closing your browser or signing in.');
    }
    
    const formats = allFormats
      .map(f => {
        const mime = f.mime_type || f.vcodec || '';
        const isAudio = mime.includes('audio') || (f.acodec && f.acodec !== 'none' && f.vcodec === 'none');
        const isVideo = mime.includes('video') || (f.vcodec && f.vcodec !== 'none');
        let resolution = 'Unknown';
        if (f.quality_label) resolution = f.quality_label;
        else if (f.height) resolution = `${f.height}p`;
        else if (isAudio) resolution = 'Audio only';

        return {
          id: f.itag?.toString() || f.format_id,
          ext: (f.mime_type ? f.mime_type.split(';')[0].split('/')[1] : f.ext) || 'mp4',
          resolution: resolution,
          filesize: parseInt(f.content_length || f.filesize || f.filesize_approx) || 0,
          note: `${f.quality || ''} ${f.format_note || ''}`.trim()
        };
      })
      .filter(f => f.resolution !== 'Unknown');

    formats.sort((a, b) => {
      if (a.resolution === 'Audio only' && b.resolution !== 'Audio only') return 1;
      if (a.resolution !== 'Audio only' && b.resolution === 'Audio only') return -1;
      return (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0);
    });

    return { success: true, title, thumbnail, formats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-video', async (event, { url, outputPath, formatId }) => {
  console.log(`[MAIN] Download: ${url} | Format: ${formatId}`);
  
  const startDownload = (browser) => {
    return new Promise((resolve) => {
      const flags = {
        output: path.join(outputPath, '%(title)s.%(ext)s'),
        newline: true,
        noCheckCertificates: true,
        progress: true,
        ffmpegLocation: ffmpegPath,
        format: formatId ? `${formatId}+bestaudio/best` : 'bestvideo+bestaudio/best',
      };

      if (browser) flags.cookiesFromBrowser = browser;

      const ytdl = require('youtube-dl-exec');
      const ls = ytdl.exec(url, flags);

      let lastError = '';

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
        lastError += data.toString();
        console.error(`[YT-DLP] ${data.toString()}`);
      });

      ls.on('close', (code) => {
        if (code === 0) resolve({ success: true });
        else resolve({ success: false, error: lastError || `Exited with code ${code}` });
      });

      ls.on('error', (err) => resolve({ success: false, error: err.message }));
    });
  };

  const isCookieError = (err) => {
    const msg = err.toLowerCase();
    return msg.includes('cookie database') || msg.includes('dpapi') || msg.includes('decrypt');
  };

  // Execution Logic: Try Chrome -> Edge -> No Cookies
  let result = await startDownload('chrome');
  
  if (!result.success && isCookieError(result.error)) {
    console.log('[MAIN] Chrome cookies inaccessible, trying Edge...');
    result = await startDownload('edge');
  }
  
  if (!result.success && isCookieError(result.error)) {
    console.log('[MAIN] All browser cookies inaccessible, falling back to cookie-less download...');
    result = await startDownload(null);
  }

  return result;
});
