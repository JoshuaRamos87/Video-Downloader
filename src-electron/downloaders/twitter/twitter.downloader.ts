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

  private async getFileSize(url: string): Promise<number> {
    return new Promise((resolve) => {
      const getHead = (targetUrl: string) => {
        const req = https.request(targetUrl, { method: 'HEAD' }, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode || 0)) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              getHead(redirectUrl);
              return;
            }
          }
          const size = parseInt(res.headers['content-length'] || '0');
          resolve(size);
        });
        req.on('error', () => resolve(0));
        req.end();
      };
      getHead(url);
    });
  }

  async getVideoInfo(url: string): Promise<VideoInfoResponse> {
    logger.info(`TwitterDownloader: Fetching info via FxTwitter for: ${url}`);
    try {
      const tweetInfo = this.extractTweetInfo(url);
      if (!tweetInfo) {
        throw new Error('Invalid Twitter/X URL format.');
      }

      const apiUrl = `https://api.fxtwitter.com/${tweetInfo.handle}/status/${tweetInfo.id}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`FxTwitter API status ${response.status}`);

      const data: any = await response.json();
      if (!data?.tweet?.media) throw new Error('No media found.');

      const tweet = data.tweet;
      const media = tweet.media;
      let allFormats: VideoFormat[] = [];

      if (media.videos && Array.isArray(media.videos)) {
        // Flatten all video variants into a single format list
        for (const video of media.videos) {
          const variants = video.variants || [];
          
          if (variants.length > 0) {
            for (const v of variants) {
              // Skip m3u8 playlists as they are not direct video files
              if (v.url.includes('.m3u8')) continue;

              // Extract resolution from URL if missing in variant metadata
              // Pattern: .../vid/720x1280/file.mp4
              let resolution = 'Video';
              const resMatch = v.url.match(/vid\/(\d+x\d+)\//);
              if (resMatch) {
                resolution = resMatch[1];
              } else if (video.width && video.height) {
                resolution = `${video.width}x${video.height}`;
              }

              // Only fetch file sizes for a reasonable number of variants to avoid slowing down UI
              // But for Twitter, there are usually only 3-4 variants total.
              const filesize = await this.getFileSize(v.url);

              allFormats.push({
                id: v.url,
                ext: 'mp4',
                resolution: resolution,
                filesize: filesize,
                note: v.bitrate ? `${(v.bitrate / 1000).toFixed(0)} kbps` : ''
              });
            }
          } else if (video.url) {
            // Single video fallback
            const filesize = await this.getFileSize(video.url);
            allFormats.push({
              id: video.url,
              ext: 'mp4',
              resolution: video.width && video.height ? `${video.width}x${video.height}` : 'Best Quality',
              filesize: filesize,
              note: 'Standard Quality'
            });
          }
        }
      }

      if (allFormats.length === 0) throw new Error('No video formats found.');

      // Remove duplicates and sort
      allFormats = allFormats.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      allFormats.sort((a, b) => {
        const getVal = (res: string) => {
          const m = res.match(/(\d+)x(\d+)/);
          return m ? parseInt(m[1]) * parseInt(m[2]) : 0;
        };
        return getVal(b.resolution) - getVal(a.resolution);
      });

      return {
        success: true,
        title: `${tweet.author?.name || 'User'} (@${tweet.author?.screen_name || ''}): ${tweet.text?.substring(0, 50)}...`,
        thumbnail: media.videos[0]?.thumbnail_url || media.photos?.[0]?.url || '',
        formats: allFormats
      };
    } catch (error: any) {
      logger.error(`TwitterDownloader Error: ${error.message}`);
      return this.getVideoInfoVx(url);
    }
  }

  private async getVideoInfoVx(url: string): Promise<VideoInfoResponse> {
    logger.info(`TwitterDownloader: Falling back to VxTwitter`);
    try {
      const tweetInfo = this.extractTweetInfo(url);
      if (!tweetInfo) throw new Error('Invalid URL');

      const apiUrl = `https://api.vxtwitter.com/status/${tweetInfo.id}`;
      const response = await fetch(apiUrl);
      const data: any = await response.json();

      const videoMedia = data.media_extended.filter((m: any) => m.type === 'video' || m.type === 'gif');
      const formats: VideoFormat[] = [];
      
      for (const m of videoMedia) {
        const filesize = await this.getFileSize(m.url);
        formats.push({
          id: m.url,
          ext: 'mp4',
          resolution: m.size ? `${m.size.width}x${m.size.height}` : 'Best Quality',
          filesize: filesize,
          note: 'Best Quality'
        });
      }

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
    
    return new Promise((resolve) => {
      const download = (targetUrl: string) => {
        https.get(targetUrl, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode || 0)) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              download(redirectUrl);
              return;
            }
          }

          if (res.statusCode !== 200) {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
            return;
          }

          const totalSize = parseInt(res.headers['content-length'] || '0');
          const urlPath = new URL(targetUrl).pathname;
          let fileName = urlPath.split('/').pop() || `twitter_${Date.now()}.mp4`;
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
              onProgress({
                percent,
                totalSize: this.formatBytes(totalSize),
                speed: `${this.formatBytes(speedBytes)}/s`,
                eta: this.formatEta((totalSize - downloadedSize) / speedBytes)
              });
            }
          });

          fileStream.on('finish', () => { fileStream.close(); resolve({ success: true }); });
          fileStream.on('error', (err) => { fs.unlink(fullPath, () => {}); resolve({ success: false, error: err.message }); });
        }).on('error', (err) => resolve({ success: false, error: err.message }));
      };
      download(downloadUrl);
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private formatEta(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
