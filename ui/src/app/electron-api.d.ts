export interface AppConfig {
  outputPath?: string;
}

export interface VideoFormat {
  id: string;
  ext: string;
  resolution: string;
  filesize: number;
  note: string;
}

export interface VideoInfoResponse {
  success: boolean;
  title?: string;
  thumbnail?: string;
  formats?: VideoFormat[];
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  totalSize: string;
  speed: string;
  eta: string;
}

export interface DownloadRequest {
  url: string;
  outputPath: string;
  formatId: string;
}

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  getVideoInfo: (url: string) => Promise<VideoInfoResponse>;
  readClipboard: () => Promise<string>;
  downloadVideo: (data: DownloadRequest) => Promise<{ success: boolean; error?: string }>;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
