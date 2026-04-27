export interface AppConfig {
  outputPath?: string;
  showDevLogs?: boolean;
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
  error?: string;
}

export interface BaseDownloader {
  getVideoInfo(url: string): Promise<VideoInfoResponse>;
  downloadVideo(request: DownloadRequest, onProgress: (progress: DownloadProgress) => void): Promise<DownloadResult>;
}
