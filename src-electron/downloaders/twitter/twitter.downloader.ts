import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import { logger } from '../../logger.js';
import { 
  BaseDownloader, 
  VideoInfoResponse, 
  DownloadRequest, 
  DownloadProgress, 
  DownloadResult,
  VideoFormat
} from '../../interfaces.js';

export class TwitterDownloader implements BaseDownloader {
  private extractTweetInfo(url: string): { handle: string; id: string } | null {
    const match = url.match(/https?:\/\/(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/);
    if (match) {
      return { handle: match[1], id: match[2] };
    }
    return null;
  }

  async getVideoInfo(url: string): Promise<VideoInfoResponse> {
    logger.info(`TwitterDownloader: Fetching info via FxTwitter for: ${url}`);
    try {
      const tweetInfo = this.extractTweetInfo(url);
      if (!tweetInfo) {
        throw new Error('Invalid Twitter/X URL format. Expected: https://x.com/user/status/id');
      }

      // Using FxTwitter API as it typically provides all variants/resolutions
      const apiUrl = `https://api.fxtwitter.com/${tweetInfo.handle}/status/${tweetInfo.id}`;
      logger.debug(`Fetching FxTwitter API: ${apiUrl}`);

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`FxTwitter API returned status ${response.status}`);
      }

      const data: any = await response.json();
      if (!data || !data.tweet || !data.tweet.media) {
        throw new Error('No media found in this tweet.');
      }

      const tweet = data.tweet;
      const media = tweet.media;
      
      // FxTwitter usually provides an array of videos, and each video might have multiple variants
      let allFormats: VideoFormat[] = [];

      if (media.videos && Array.isArray(media.videos)) {
        media.videos.forEach((video: any, videoIndex: number) => {
          // If the API provides variants directly (FixTweet schema)
          if (video.variants && Array.isArray(video.variants)) {
            video.variants.forEach((v: any) => {
              allFormats.push({
                id: v.url,
                ext: v.url.split('.').pop()?.split('?')[0] || 'mp4',
                resolution: v.width && v.height ? `${v.width}x${v.height}` : 'Video',
                filesize: 0,
                note: v.bitrate ? `Bitrate: ${(v.bitrate / 1000).toFixed(0)}kbps` : ''
              });
            });
          } else {
            // Fallback if variants are flat in the video object
            allFormats.push({
              id: video.url,
              ext: video.url.split('.').pop()?.split('?')[0] || 'mp4',
              resolution: video.width && video.height ? `${video.width}x${video.height}` : 'Best Quality',
              filesize: 0,
              note: `Video ${videoIndex + 1}`
            });
          }
        });
      }

      if (allFormats.length === 0) {
        throw new Error('No video formats found for this tweet.');
      }

      // Sort by resolution (width * height) descending
      allFormats.sort((a, b) => {
        const getResValue = (res: string) => {
          const m = res.match(/(\d+)x(\d+)/);
          return m ? parseInt(m[1]) * parseInt(m[2]) : 0;
        };
        return getResValue(b.resolution) - getResValue(a.resolution);
      });

      return {
        success: true,
        title: `${tweet.author?.name || 'Twitter User'} (@${tweet.author?.screen_name || ''}): ${tweet.text?.substring(0, 50)}${tweet.text?.length > 50 ? '...' : ''}`,
        thumbnail: media.videos[0]?.thumbnail_url || media.photos?.[0]?.url || '',
        formats: allFormats
      };
    } catch (error: any) {
      logger.error(`Error in TwitterDownloader.getVideoInfo: ${error.message}`);
      // Fallback to simpler VxTwitter if FxTwitter fails or schema is different
      return this.getVideoInfoVx(url);
    }
  }

  // Fallback downloader using VxTwitter which we know worked but only had one resolution
  private async getVideoInfoVx(url: string): Promise<VideoInfoResponse> {
    logger.info(`TwitterDownloader: Falling back to VxTwitter for: ${url}`);
    try {
      const tweetInfo = this.extractTweetInfo(url);
      if (!tweetInfo) throw new Error('Invalid URL');

      const apiUrl = `https://api.vxtwitter.com/status/${tweetInfo.id}`;
      const response = await fetch(apiUrl);
      const data: any = await response.json();

      const videoMedia = data.media_extended.filter((m: any) => m.type === 'video' || m.type === 'gif');
      const formats: VideoFormat[] = videoMedia.map((m: any) => ({
        id: m.url,
        ext: m.url.split('.').pop()?.split('?')[0] || 'mp4',
        resolution: m.size ? `${m.size.width}x${m.size.height}` : 'Best Quality',
        filesize: 0,
        note: 'VxTwitter (Best Quality)'
      }));

      return {
        success: true,
        title: `${data.user_name} (@${data.user_screen_name})`,
        thumbnail: videoMedia[0]?.thumbnail_url || '',
        formats
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async downloadVideo(request: DownloadRequest, onProgress: (progress: DownloadProgress) => void): Promise<DownloadResult> {
    const { url, outputPath, formatId } = request;
    const downloadUrl = formatId || url;
    
    logger.info(`TwitterDownloader: Starting download from: ${downloadUrl}`);

    return new Promise((resolve) => {
      const download = (targetUrl: string) => {
        https.get(targetUrl, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              download(redirectUrl);
              return;
            }
          }

          if (res.statusCode !== 200) {
            resolve({ success: false, error: `HTTP Error ${res.statusCode}` });
            return;
          }

          const totalSize = parseInt(res.headers['content-length'] || '0');
          const urlPath = new URL(targetUrl).pathname;
          let fileName = urlPath.split('/').pop() || `twitter_video_${Date.now()}.mp4`;
          
          fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
          if (!fileName.includes('.')) fileName += '.mp4';
          
          const fullPath = path.join(outputPath, fileName);
          const fileStream = fs.createWriteStream(fullPath);
          let downloadedSize = 0;
          const startTime = Date.now();

          res.pipe(fileStream);

          res.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize > 0) {
              const percent = (downloadedSize / totalSize) * 100;
              const elapsed = (Date.now() - startTime) / 1000;
              const speedBytes = downloadedSize / elapsed;
              const speed = this.formatSpeed(speedBytes);
              const remainingBytes = totalSize - downloadedSize;
              const eta = this.formatEta(remainingBytes / speedBytes);

              onProgress({
                percent,
                totalSize: this.formatBytes(totalSize),
                speed,
                eta
              });
            }
          });

          fileStream.on('finish', () => {
            fileStream.close();
            resolve({ success: true });
          });

          fileStream.on('error', (err) => {
            fs.unlink(fullPath, () => {});
            resolve({ success: false, error: err.message });
          });

        }).on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
      };

      download(downloadUrl);
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`;
  }

  private formatEta(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
