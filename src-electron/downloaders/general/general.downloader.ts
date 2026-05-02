import { BrowserWindow } from 'electron';
import youtubeDl from 'youtube-dl-exec';
const { create, constants } = youtubeDl as any;
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { logger } from '../../logger.js';
import { 
  BaseDownloader, 
  VideoInfoResponse, 
  DownloadRequest, 
  DownloadProgress, 
  DownloadResult,
  VideoFormat
} from '../../interfaces.js';

// Helper to fix paths when running from an ASAR archive
const fixPath = (p: string) => p.replace('app.asar', 'app.asar.unpacked');

const ytdlpBinary = fixPath(constants.YOUTUBE_DL_PATH);
const ytdl = create(ytdlpBinary);
const fixedFfmpegPath = fixPath(ffmpegPath);

export class GeneralDownloader implements BaseDownloader {
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
      const timeout = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        
        const formats: VideoFormat[] = Array.from(discoveredLinks.values()).map((link, index) => {
          const isStreaming = link.type === 'm3u8' || link.url.includes('m3u8');
          return {
            id: link.url,
            ext: isStreaming ? 'mp4' : link.type,
            resolution: isStreaming ? 'Streaming (HLS)' : 'Direct Link',
            filesize: 0,
            note: `Source ${index + 1}`
          };
        });

        cleanup();
        
        if (formats.length === 0) {
          logger.warn('GeneralDownloader: No media links discovered after timeout');
          resolve({ success: false, error: 'No media links discovered on this page.' });
        } else {
          logger.info(`GeneralDownloader: Found ${formats.length} media links`);
          resolve({
            success: true,
            title: `Media found on ${new URL(url).hostname}`,
            thumbnail: '', // Sniffer doesn't easily get thumbnails
            formats
          });
        }
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
