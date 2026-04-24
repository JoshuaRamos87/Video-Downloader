const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getVideoInfo: (url) => ipcRenderer.invoke('get-video-info', url),
  downloadVideo: (data) => ipcRenderer.invoke('download-video', data),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, value) => callback(value)),
});
