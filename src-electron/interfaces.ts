export interface DownloadHistoryItem {
  id: string;
  title: string;
  thumbnail: string;
  filePath: string;
  timestamp: number;
  originalUrl?: string;
}

export interface AppConfig {
  outputPath?: string;
  showDevLogs?: boolean;
  theme?: string;
  downloadHistory?: DownloadHistoryItem[];
  enableDownloadHistory?: boolean;
}

export interface VideoFormat {
  id: string;
  ext: string;
  resolution: string;
  filesize: number;
  note: string;
  thumbnail?: string;
  duration?: string;
  previewUrl?: string;
}

export interface PlaylistItem {
  id: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  url: string;
  selected?: boolean;
}

export interface VideoInfoResponse {
  success: boolean;
  title?: string;
  thumbnail?: string;
  previewUrl?: string;
  formats?: VideoFormat[];
  isPlaylist?: boolean;
  playlistItems?: PlaylistItem[];
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
  ext?: string;
  isPlaylistDownload?: boolean;
}

export interface PlaylistDownloadRequest {
  urls: string[];
  outputPath: string;
  albumName: string;
  formatId: string;
  ext?: string;
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
