const { contextBridge, ipcRenderer } = require('electron');

console.log('[PRELOAD] CommonJS Preload script starting...');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => {
    console.log('[PRELOAD] getConfig called');
    return ipcRenderer.invoke('get-config');
  },
  setConfig: (config) => {
    console.log('[PRELOAD] setConfig called');
    return ipcRenderer.invoke('set-config', config);
  },
  selectDirectory: () => {
    console.log('[PRELOAD] selectDirectory called');
    return ipcRenderer.invoke('select-directory');
  },
  getVideoInfo: (url) => {
    console.log('[PRELOAD] getVideoInfo called');
    return ipcRenderer.invoke('get-video-info', url);
  },
  readClipboard: () => {
    console.log('[PRELOAD] readClipboard called');
    return ipcRenderer.invoke('read-clipboard');
  },
  downloadVideo: (data) => {
    console.log('[PRELOAD] downloadVideo called');
    return ipcRenderer.invoke('download-video', data);
  },
  log: (level, message, ...args) => {
    ipcRenderer.send('log-message', { level, message, args });
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, value) => callback(value));
  },
  windowMinimize: () => {
    console.log('[PRELOAD] windowMinimize called');
    ipcRenderer.send('window-minimize');
  },
  windowMaximize: () => {
    console.log('[PRELOAD] windowMaximize called');
    ipcRenderer.send('window-maximize');
  },
  windowClose: () => {
    console.log('[PRELOAD] windowClose called');
    ipcRenderer.send('window-close');
  },
  openPath: (path) => {
    console.log('[PRELOAD] openPath called');
    return ipcRenderer.invoke('open-path', path);
  },
  deleteFile: (path) => {
    console.log('[PRELOAD] deleteFile called');
    return ipcRenderer.invoke('delete-file', path);
  },
  getAllLogs: () => {
    return ipcRenderer.invoke('get-all-logs');
  },
  onNewLog: (callback) => {
    ipcRenderer.on('new-log', (event, entry) => callback(entry));
  },
});

console.log('[PRELOAD] CommonJS Preload script finished exposing API');
