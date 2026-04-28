export interface AppConfig {
  outputPath?: string;
  theme?: string;
  showDevLogs?: boolean;
}

export interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  timestamp: string;
  formattedMessage: string;
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
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  openPath: (path: string) => Promise<void>;
  deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
  getAllLogs: () => Promise<LogEntry[]>;
  onNewLog: (callback: (entry: LogEntry) => void) => void;
  log: (level: string, message: string, ...args: any[]) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
