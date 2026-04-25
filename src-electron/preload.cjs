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
});

console.log('[PRELOAD] CommonJS Preload script finished exposing API');
