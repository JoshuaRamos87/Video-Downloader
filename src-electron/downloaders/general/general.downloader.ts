import { BrowserWindow } from 'electron';
import youtubeDl from 'youtube-dl-exec';
const { create, constants } = youtubeDl as any;
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../../logger.js';
import { 
  BaseDownloader, 
  VideoInfoResponse, 
  DownloadRequest, 
  DownloadProgress, 
  DownloadResult,
  VideoFormat
} from '../../interfaces.js';

const execPromise = promisify(exec);

// Helper to fix paths when running from an ASAR archive
const fixPath = (p: string) => p.replace('app.asar', 'app.asar.unpacked');

const ytdlpBinary = fixPath(constants.YOUTUBE_DL_PATH);
const ytdl = create(ytdlpBinary);
const fixedFfmpegPath = fixPath(ffmpegPath);

export class GeneralDownloader implements BaseDownloader {
  private async extractThumbnail(url: string): Promise<string> {
    // Skip if it's not a likely video/audio URL or too long
    if (url.length > 2048) return '';
    
    try {
      // Use ffmpeg to extract a frame at 1 second
      // -ss 1: seek to 1 second (faster than after -i)
      // -i url: input
      // -vframes 1: 1 frame
      // -f image2: output as image
      // -update 1: only one frame
      // pipe:1: output to stdout
      const cmd = `"${fixedFfmpegPath}" -ss 00:00:01 -i "${url}" -vframes 1 -f image2 -update 1 pipe:1`;
      const { stdout } = await execPromise(cmd, { 
        encoding: 'buffer', 
        maxBuffer: 5 * 1024 * 1024,
        timeout: 5000 // 5 seconds timeout per thumbnail
      });
      
      if (stdout && stdout.length > 0) {
        return `data:image/jpeg;base64,${stdout.toString('base64')}`;
      }
    } catch (err: any) {
      // Common for audio or broken streams, don't spam logs
      logger.debug(`GeneralDownloader: Thumbnail extraction failed for ${url.substring(0, 50)}: ${err.message}`);
    }
    return '';
  }

  async getVideoInfo(url: string): Promise<VideoInfoResponse> {
    logger.info(`GeneralDownloader: Sniffing media for: ${url}`);
    
    return new Promise((resolve) => {
      const discoveredLinks = new Map<string, { url: string; type: string }>();
      let isResolved = false;

      // Create a hidden window to load the page and sniff network traffic
      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true,
          // Use a unique session for each sniff to avoid caching issues
          partition: `sniffer_${Date.now()}`
        }
      });

      const cleanup = () => {
        if (!win.isDestroyed()) {
          win.destroy();
        }
      };

      const filter = {
        urls: ['*://*/*']
      };

      // Intercept outgoing requests
      win.webContents.session.webRequest.onBeforeRequest(filter, (details, callback) => {
        const lowerUrl = details.url.toLowerCase();
        // Look for common media extensions
        const extensionMatch = lowerUrl.match(/\.(mp4|m3u8|webm|mp3|m4a|wav|ogg|mov)(\?.*)?$/i);
        
        if (extensionMatch) {
          const ext = extensionMatch[1];
          // Filter out obvious ads or small chunks if necessary, but for now let's be inclusive
          if (!discoveredLinks.has(details.url)) {
            logger.info(`GeneralDownloader: Discovered media link: ${details.url}`);
            discoveredLinks.set(details.url, { url: details.url, type: ext });
          }
        }
        callback({});
      });

      // Also listen to headers to catch videos without extensions but with correct content-types
      win.webContents.session.webRequest.onHeadersReceived(filter, (details, callback) => {
        const contentType = (details.responseHeaders?.['content-type']?.[0] || details.responseHeaders?.['Content-Type']?.[0] || '').toLowerCase();
        
        if (contentType.startsWith('video/') || 
            contentType.startsWith('audio/') || 
            contentType.includes('application/x-mpegurl') || 
            contentType.includes('application/vnd.apple.mpegurl')) {
           
           if (!discoveredLinks.has(details.url)) {
             const ext = contentType.split('/')[1]?.split(';')[0] || 'mp4';
             logger.info(`GeneralDownloader: Discovered media link via content-type (${contentType}): ${details.url}`);
             discoveredLinks.set(details.url, { url: details.url, type: ext });
           }
        }
        callback({ cancel: false });
      });

      win.loadURL(url).catch(err => {
        logger.error(`GeneralDownloader: Failed to load URL: ${err.message}`);
      });

      // Resolve after a set period of sniffing
      const timeout = setTimeout(async () => {
        if (isResolved) return;
        isResolved = true;
        
        const discovered = Array.from(discoveredLinks.values()).slice(0, 10);
        
        if (discovered.length === 0) {
          cleanup();
          logger.warn('GeneralDownloader: No media links discovered after timeout');
          resolve({ success: false, error: 'No media links discovered on this page.' });
          return;
        }

        logger.info(`GeneralDownloader: Processing ${discovered.length} media links for thumbnails...`);
        
        const formats: VideoFormat[] = await Promise.all(discovered.map(async (link, index) => {
          const isStreaming = link.type === 'm3u8' || link.url.includes('m3u8');
          const isAudio = ['mp3', 'm4a', 'wav', 'ogg'].includes(link.type.toLowerCase());
          
          let thumbnail = '';
          // Only attempt thumbnail extraction for video-like links
          if (!isAudio) {
            thumbnail = await this.extractThumbnail(link.url);
          }

          return {
            id: link.url,
            ext: isStreaming ? 'mp4' : link.type,
            resolution: isStreaming ? 'Streaming (HLS)' : 'Direct Link',
            filesize: 0,
            note: `Source ${index + 1}`,
            thumbnail
          };
        }));

        cleanup();
        
        logger.info(`GeneralDownloader: Found ${formats.length} media links`);
        resolve({
          success: true,
          title: `Media found on ${new URL(url).hostname}`,
          thumbnail: formats.find(f => f.thumbnail)?.thumbnail || '',
          formats
        });
      }, 10000); // 10 seconds of sniffing
    });
  }

  async downloadVideo(request: DownloadRequest, onProgress: (progress: DownloadProgress) => void): Promise<DownloadResult> {
    const { url, outputPath, formatId } = request;
    // formatId in this downloader IS the direct URL found by the sniffer
    const downloadUrl = formatId || url;
    
    logger.info(`GeneralDownloader: Starting download for: ${downloadUrl}`);

    return new Promise((resolve) => {
      const uniqueSuffix = Date.now().toString(36);
      
      const flags: any = {
        output: path.join(outputPath, `download_${uniqueSuffix}.%(ext)s`),
        restrictFilenames: true,
        newline: true,
        noCheckCertificates: true,
        progress: true,
        ffmpegLocation: fixedFfmpegPath,
        // For direct links, we don't necessarily need a format filter, but yt-dlp handles it
        format: 'best',
        jsRuntime: 'node'
      };

      const ls = ytdl.exec(downloadUrl, flags, { 
        env: { 
          ...process.env, 
          PYTHONIOENCODING: 'utf-8'
        } 
      }) as any;

      let lastError = '';
      let finalPath = '';

      if (ls.stdout) {
        ls.stdout.on('data', (data: Buffer | string) => {
          const line = data.toString();
          
          const destMatch = line.match(/\[download\] Destination: (.+)/);
          if (destMatch) finalPath = destMatch[1].trim();
          
          const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/);
          if (mergeMatch) finalPath = mergeMatch[1].trim();

          const progressMatch = line.match(/\[download\]\s+(\d+\.\d+)% of\s+([\d\w\.]+)\s+at\s+([\d\w\.\/s]+)\s+ETA\s+([\d:]+)/);
          if (progressMatch) {
            onProgress({
              percent: parseFloat(progressMatch[1]),
              totalSize: progressMatch[2],
              speed: progressMatch[3],
              eta: progressMatch[4]
            });
          }
        });
      }

      if (ls.stderr) {
        ls.stderr.on('data', (data: Buffer | string) => {
          const errorMsg = data.toString();
          lastError += errorMsg;
          logger.warn(`[GeneralDownloader-YTDLP] ${errorMsg.trim()}`);
        });
      }

      ls.on('close', (code: number | null) => {
        if (code === 0) {
          resolve({ success: true, filePath: finalPath });
        } else {
          resolve({ success: false, error: lastError || `Exited with code ${code}` });
        }
      });

      ls.on('error', (err: Error) => {
        resolve({ success: false, error: err.message });
      });
    });
  }
}
