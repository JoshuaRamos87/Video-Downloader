import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, DownloadRequest, VideoInfoResponse } from './interfaces.js';

console.log('[PRELOAD] Preload script starting...');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: (): Promise<AppConfig> => {
    console.log('[PRELOAD] getConfig called');
    return ipcRenderer.invoke('get-config');
  },
  setConfig: (config: AppConfig): Promise<void> => {
    console.log('[PRELOAD] setConfig called');
    return ipcRenderer.invoke('set-config', config);
  },
  selectDirectory: (): Promise<string | null> => {
    console.log('[PRELOAD] selectDirectory called');
    return ipcRenderer.invoke('select-directory');
  },
  getVideoInfo: (url: string): Promise<VideoInfoResponse> => {
    console.log('[PRELOAD] getVideoInfo called');
    return ipcRenderer.invoke('get-video-info', url);
  },
  downloadVideo: (data: DownloadRequest): Promise<any> => {
    console.log('[PRELOAD] downloadVideo called');
    return ipcRenderer.invoke('download-video', data);
  },
  onDownloadProgress: (callback: (value: any) => void): void => {
    ipcRenderer.on('download-progress', (_event, value) => callback(value));
  },
});

console.log('[PRELOAD] Preload script finished exposing API');
