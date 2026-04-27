export interface DownloadHistoryItem {
  id: string;
  title: string;
  thumbnail: string;
  filePath: string;
  timestamp: number;
}

export interface AppConfig {
  outputPath?: string;
  showDevLogs?: boolean;
  theme?: string;
  downloadHistory?: DownloadHistoryItem[];
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

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface BaseDownloader {
  getVideoInfo(url: string): Promise<VideoInfoResponse>;
  downloadVideo(request: DownloadRequest, onProgress: (progress: DownloadProgress) => void): Promise<DownloadResult>;
}
