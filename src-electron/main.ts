import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import youtubeDl from 'youtube-dl-exec';
const { exec } = youtubeDl;
import fs from 'node:fs';
import { Innertube, UniversalCache } from 'youtubei.js';
import ffmpegPath from 'ffmpeg-static';
import { 
  AppConfig, 
  VideoFormat, 
  VideoInfoResponse, 
  DownloadProgress, 
  DownloadRequest, 
  DownloadResult 
} from './interfaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win: BrowserWindow | null = null;
let yt: Innertube | null = null;

async function initYoutube(): Promise<void> {
  try {
    yt = await Innertube.create({ 
      cache: new UniversalCache(false),
      // Use any cast for experimental/internal properties not in official types
      ...({ generate_session_store: true } as any)
    });
    console.log('[MAIN] youtubei.js initialized');
  } catch (error) {
    console.error('[MAIN] Failed to initialize youtubei.js:', error);
  }
}

const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig(): AppConfig {
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveConfig(config: AppConfig): void {
  const current = loadConfig();
  fs.writeFileSync(configPath, JSON.stringify({ ...current, ...config }));
}

function createWindow(): void {
  const isDev = process.env.NODE_ENV === 'development';
  const preloadPath = path.join(__dirname, 'preload.js');
  
  console.log(`[MAIN] Creating window. isDev: ${isDev}`);
  
  // Logic to handle potential production path variation
  const prodPath = path.join(__dirname, '..', 'ui', 'dist', 'ui', 'browser', 'index.html');
  
  win = new BrowserWindow({
    width: 1100,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#121212',
  });

  if (isDev) {
    win.loadURL('http://localhost:4200');
  } else {
    if (fs.existsSync(prodPath)) {
      win.loadFile(prodPath);
    } else {
      console.error(`[MAIN] Production UI not found at: ${prodPath}`);
      // Fallback or error message could go here
    }
  }

  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(async () => {
  await initYoutube();
  createWindow();
});

ipcMain.handle('get-config', async (): Promise<AppConfig> => loadConfig());
ipcMain.handle('set-config', async (_event, config: AppConfig): Promise<void> => saveConfig(config));

ipcMain.handle('select-directory', async (): Promise<string | null> => {
  console.log('[MAIN] Received select-directory request');
  if (!win) {
    console.error('[MAIN] Select-directory failed: win is null');
    return null;
  }
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Download Folder'
  });
  console.log(`[MAIN] Select-directory result: ${result.canceled ? 'canceled' : result.filePaths[0]}`);
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-video-info', async (_event, url: string): Promise<VideoInfoResponse> => {
  console.log(`[MAIN] Fetching info for: ${url}`);
  try {
    const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    if (!videoId) throw new Error('Invalid YouTube URL');

    let allFormats: any[] = [];
    let title = 'Unknown Title';
    let thumbnail = '';

    const browsers = ['chrome', 'edge', 'brave'] as const;
    let ytdlInfo: any;
    
    for (const browser of browsers) {
      try {
        ytdlInfo = await exec(url, {
          dumpJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          cookiesFromBrowser: browser,
          noPlaylist: true,
          jsRuntime: 'node'
        } as any);
        if (ytdlInfo) break;
      } catch (e) { continue; }
    }

    if (ytdlInfo) {
      title = ytdlInfo.title;
      thumbnail = ytdlInfo.thumbnail;
      allFormats = ytdlInfo.formats;
    } else {
      if (!yt) await initYoutube();
      if (!yt) throw new Error('YouTube engine not initialized');
      
      const clients = ['TVHTML5', 'ANDROID', 'WEB'] as const;
      for (const client of clients) {
        try {
          (yt.session as any).client_name = client;
          const info = await yt.getInfo(videoId);
          if (info && info.streaming_data) {
            title = info.basic_info.title || 'Unknown Title';
            thumbnail = info.basic_info.thumbnail?.[0]?.url || '';
            allFormats = [
              ...(info.streaming_data.formats || []), 
              ...(info.streaming_data.adaptive_formats || [])
            ];
            break;
          }
        } catch (e) { continue; }
      }
    }

    if (allFormats.length === 0) {
      throw new Error('Could not fetch video info. Try closing your browser or signing in.');
    }
    
    const formats: VideoFormat[] = allFormats
      .map(f => {
        const mime = (f.mime_type || f.vcodec || '') as string;
        const isAudio = mime.includes('audio') || (f.acodec && f.acodec !== 'none' && f.vcodec === 'none');
        const isVideo = mime.includes('video') || (f.vcodec && f.vcodec !== 'none');
        let resolution = 'Unknown';
        if (f.quality_label) resolution = f.quality_label;
        else if (f.height) resolution = `${f.height}p`;
        else if (isAudio) resolution = 'Audio only';

        return {
          id: (f.itag?.toString() || f.format_id) as string,
          ext: ((f.mime_type ? f.mime_type.split(';')[0].split('/')[1] : f.ext) || 'mp4') as string,
          resolution,
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
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-video', async (_event, { url, outputPath, formatId }: DownloadRequest): Promise<DownloadResult> => {
  console.log(`[MAIN] Download: ${url} | Format: ${formatId}`);
  
  const startDownload = (browser: string | null): Promise<DownloadResult> => {
    return new Promise((resolve) => {
      const flags: any = {
        output: path.join(outputPath, '%(title)s.%(ext)s'),
        newline: true,
        noCheckCertificates: true,
        progress: true,
        ffmpegLocation: ffmpegPath,
        format: formatId ? `${formatId}+bestaudio/best` : 'bestvideo+bestaudio/best',
        jsRuntime: 'node'
      };

      if (browser) flags.cookiesFromBrowser = browser;

      const ls = exec(url, flags);

      let lastError = '';

      // Catch the promise rejection to avoid UnhandledPromiseRejectionWarning
      (ls as any).catch((_err: any) => {});

      if (ls.stdout) {
        ls.stdout.on('data', (data) => {
          const line = data.toString();
          const progressMatch = line.match(/\[download\]\s+(\d+\.\d+)% of\s+([\d\w\.]+)\s+at\s+([\d\w\.\/s]+)\s+ETA\s+([\d:]+)/);
          if (progressMatch && win) {
            const progress: DownloadProgress = {
              percent: parseFloat(progressMatch[1]),
              totalSize: progressMatch[2],
              speed: progressMatch[3],
              eta: progressMatch[4]
            };
            win.webContents.send('download-progress', progress);
          }
        });
      }

      if (ls.stderr) {
        ls.stderr.on('data', (data) => {
          lastError += data.toString();
          console.error(`[YT-DLP] ${data.toString()}`);
        });
      }

      ls.on('close', (code) => {
        if (code === 0) resolve({ success: true });
        else resolve({ success: false, error: lastError || `Exited with code ${code}` });
      });

      ls.on('error', (err) => resolve({ success: false, error: err.message }));
    });
  };

  const isCookieError = (err: string): boolean => {
    const msg = err.toLowerCase();
    return msg.includes('cookie database') || msg.includes('dpapi') || msg.includes('decrypt');
  };

  let result = await startDownload('chrome');
  
  if (!result.success && result.error && isCookieError(result.error)) {
    console.log('[MAIN] Chrome cookies inaccessible, trying Edge...');
    result = await startDownload('edge');
  }
  
  if (!result.success && result.error && isCookieError(result.error)) {
    console.log('[MAIN] All browser cookies inaccessible, falling back to cookie-less download...');
    result = await startDownload(null);
  }

  return result;
});
