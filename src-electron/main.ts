import { app, BrowserWindow, ipcMain, dialog, clipboard, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { logger } from './logger.js';
import { DownloaderFactory } from './downloaders/downloader.factory.js';
import { 
  AppConfig, 
  VideoInfoResponse, 
  DownloadRequest, 
  DownloadResult 
} from './interfaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win: BrowserWindow | null = null;

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
  // Load the CommonJS version which is more reliable for preloads
  const preloadPath = path.resolve(__dirname, 'preload.cjs');
  const prodPath = path.resolve(__dirname, '..', 'ui', 'dist', 'ui', 'browser', 'index.html');
  
  logger.info(`Creating window. isDev: ${isDev}`);
  logger.info(`Preload path: ${preloadPath}`);

  const iconPath = path.join(__dirname, '..', 'ui', 'public', 'favicon.ico');
  logger.info(`Icon path: ${iconPath}`);

  win = new BrowserWindow({
    width: 1100,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // Sandbox must be false for ESM imports in preload to work correctly
    },
    backgroundColor: '#121212',
  });

  if (isDev) {
    win.loadURL('http://localhost:4200');
  } else {
    if (fs.existsSync(prodPath)) {
      win.loadFile(prodPath);
    } else {
      logger.error(`Production UI not found at: ${prodPath}`);
    }
  }

  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(async () => {
  // Debug preload errors
  app.on('web-contents-created', (event, contents) => {
    contents.on('preload-error', (event, preloadPath, error) => {
      logger.error(`Preload error in ${preloadPath}:`, error);
    });
  });

  createWindow();

  // Connect logger to UI
  logger.onLog((entry) => {
    if (win) {
      win.webContents.send('new-log', entry);
    }
  });
});

ipcMain.handle('get-all-logs', async () => {
  return logger.getLogs();
});

ipcMain.handle('delete-file', async (_event, fullPath: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (fs.existsSync(fullPath)) {
      await shell.trashItem(fullPath);
      logger.info(`File moved to trash: ${fullPath}`);
      return { success: true };
    } else {
      logger.warn(`File not found for deletion: ${fullPath}`);
      return { success: false, error: 'File not found' };
    }
  } catch (error: any) {
    logger.error(`Error deleting file ${fullPath}: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-path', async (_event, fullPath: string): Promise<void> => {
  try {
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        shell.openPath(fullPath);
      } else {
        shell.showItemInFolder(fullPath);
      }
    }
  } catch (error: any) {
    logger.error(`Error opening path ${fullPath}: ${error.message}`);
  }
});

ipcMain.handle('get-config', async (): Promise<AppConfig> => loadConfig());
ipcMain.handle('set-config', async (_event, config: AppConfig): Promise<void> => saveConfig(config));

ipcMain.on('log-message', (_event, { level, message, args }: { level: any, message: string, args: any[] }) => {
  const logMethod = (logger as any)[level.toLowerCase()] || logger.info;
  logMethod.call(logger, `[UI] ${message}`, ...args);
});

ipcMain.handle('read-clipboard', async (): Promise<string> => {
  return clipboard.readText();
});

ipcMain.on('window-minimize', () => {
  if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
  if (win) {
    if (win.isMaximized()) {
      win.restore();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (win) win.close();
});

ipcMain.handle('select-directory', async (): Promise<string | null> => {
  logger.info('Received select-directory request');
  if (!win) {
    logger.error('Select-directory failed: win is null');
    return null;
  }
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select Download Folder'
  });
  logger.info(`Select-directory result: ${result.canceled ? 'canceled' : result.filePaths[0]}`);
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-video-info', async (_event, url: string): Promise<VideoInfoResponse> => {
  logger.info(`Fetching info for: ${url}`);
  try {
    const downloader = DownloaderFactory.getDownloader(url);
    return await downloader.getVideoInfo(url);
  } catch (error: any) {
    logger.error(`Error in get-video-info: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-video', async (_event, request: DownloadRequest): Promise<DownloadResult> => {
  logger.info(`Download request: ${request.url} | Format: ${request.formatId}`);
  try {
    const downloader = DownloaderFactory.getDownloader(request.url);
    return await downloader.downloadVideo(request, (progress) => {
      if (win) {
        win.webContents.send('download-progress', progress);
      }
    });
  } catch (error: any) {
    logger.error(`Error in download-video: ${error.message}`);
    return { success: false, error: error.message };
  }
});
