import { Innertube, UniversalCache } from 'youtubei.js';
import youtubeDl from 'youtube-dl-exec';
const { exec } = youtubeDl;
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

export class YoutubeDownloader implements BaseDownloader {
  private ytInstances: Record<string, Innertube> = {};

  private async getYoutube(clientType: string = 'WEB'): Promise<Innertube | null> {
    if (this.ytInstances[clientType]) return this.ytInstances[clientType];

    try {
      logger.debug(`Initializing Innertube with client: ${clientType}`);
      const yt = await Innertube.create({ 
        cache: new UniversalCache(false),
        client_type: clientType as any,
        ...({ generate_session_store: true } as any)
      });
      this.ytInstances[clientType] = yt;
      logger.info(`youtubei.js (${clientType}) initialized`);
      return yt;
    } catch (error: any) {
      logger.error(`Failed to initialize youtubei.js (${clientType}):`, error.message);
      return null;
    }
  }

  async getVideoInfo(url: string): Promise<VideoInfoResponse> {
    logger.info(`YoutubeDownloader: Fetching info for: ${url}`);
    try {
      const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      if (!videoId) throw new Error('Invalid YouTube video URL');

      let allFormats: any[] = [];
      let title = 'Unknown Title';
      let thumbnail = '';

      const browsers = ['chrome', 'edge', 'brave'] as const;
      let ytdlInfo: any;
      
      for (const browser of browsers) {
        try {
          logger.debug(`Trying to fetch info using ${browser} cookies...`);
          ytdlInfo = await exec(url, {
            dumpJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            cookiesFromBrowser: browser,
            noPlaylist: true,
            jsRuntime: 'node'
          } as any);
          if (ytdlInfo) {
            logger.info(`Successfully fetched info using ${browser} cookies`);
            break;
          }
        } catch (e: any) { 
          logger.warn(`Failed to fetch info using ${browser} cookies: ${e.message}`);
          continue; 
        }
      }

      if (ytdlInfo) {
        title = ytdlInfo.title;
        thumbnail = ytdlInfo.thumbnail;
        allFormats = ytdlInfo.formats;
      } else {
        logger.info('Falling back to youtubei.js for video info');
        const clients = ['IOS', 'MWEB', 'TVHTML5', 'ANDROID', 'WEB'] as const;
        for (const client of clients) {
          try {
            logger.debug(`Trying youtubei.js with client: ${client}`);
            const yt = await this.getYoutube(client);
            if (!yt) continue;

            const info = await yt.getInfo(videoId);
            if (info && info.streaming_data) {
              title = info.basic_info.title || 'Unknown Title';
              thumbnail = info.basic_info.thumbnail?.[0]?.url || '';
              allFormats = [
                ...(info.streaming_data.formats || []), 
                ...(info.streaming_data.adaptive_formats || [])
              ];
              logger.info(`Successfully fetched info using youtubei.js with ${client} client`);
              break;
            }
          } catch (e: any) { 
            logger.warn(`youtubei.js failed with ${client} client: ${e.message}`);
            continue; 
          }
        }
      }

      if (allFormats.length === 0) {
        throw new Error('Could not fetch video info. Try closing your browser or signing in.');
      }
      
      const formats: VideoFormat[] = allFormats
        .map(f => {
          const mime = (f.mime_type || f.vcodec || '') as string;
          const isAudio = mime.includes('audio') || (f.acodec && f.acodec !== 'none' && f.vcodec === 'none');
          let resolution = 'Unknown';
          if (f.quality_label) resolution = f.quality_label;
          else if (f.height) resolution = `${f.height}p`;
          else if (isAudio) resolution = 'Audio only';

          return {
            id: (f.itag?.toString() || f.format_id) as string,
            ext: ((f.mime_type ? f.mime_type.split(';')[0].split('/')[1] : f.ext) || 'mp4') as string,
            resolution,
            filesize: parseInt(f.content_length || f.filesize || f.filesize_approx) || 0,
            note: `${f.quality || ''} ${f.format_note || ''}`.trim()
          };
        })
        .filter(f => f.resolution !== 'Unknown');

      formats.sort((a, b) => {
        if (a.resolution === 'Audio only' && b.resolution !== 'Audio only') return 1;
        if (a.resolution !== 'Audio only' && b.resolution === 'Audio only') return -1;
        return (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0);
      });

      return { success: true, title, thumbnail, formats };
    } catch (error: any) {
      logger.error(`Error in YoutubeDownloader.getVideoInfo: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async downloadVideo(request: DownloadRequest, onProgress: (progress: DownloadProgress) => void): Promise<DownloadResult> {
    const { url, outputPath, formatId } = request;
    logger.info(`YoutubeDownloader: Download request: ${url} | Format: ${formatId}`);
    
    const startDownload = (browser: string | null): Promise<DownloadResult> => {
      return new Promise((resolve) => {
        const flags: any = {
          output: path.join(outputPath, '%(title)s.%(ext)s'),
          newline: true,
          noCheckCertificates: true,
          progress: true,
          ffmpegLocation: ffmpegPath,
          format: formatId ? `${formatId}+bestaudio/best` : 'bestvideo+bestaudio/best',
          jsRuntime: 'node'
        };

        if (browser) flags.cookiesFromBrowser = browser;

        logger.debug(`Starting download process with browser cookies: ${browser || 'none'}`);
        const ls = exec(url, flags);

        let lastError = '';

        (ls as any).catch((err: any) => {
          logger.error(`youtube-dl-exec process error: ${err.message}`);
        });

        if (ls.stdout) {
          ls.stdout.on('data', (data) => {
            const line = data.toString();
            const progressMatch = line.match(/\[download\]\s+(\d+\.\d+)% of\s+([\d\w\.]+)\s+at\s+([\d\w\.\/s]+)\s+ETA\s+([\d:]+)/);
            if (progressMatch) {
              const progress: DownloadProgress = {
                percent: parseFloat(progressMatch[1]),
                totalSize: progressMatch[2],
                speed: progressMatch[3],
                eta: progressMatch[4]
              };
              onProgress(progress);
            }
          });
        }

        if (ls.stderr) {
          ls.stderr.on('data', (data) => {
            const errorMsg = data.toString();
            lastError += errorMsg;
            logger.warn(`[YT-DLP] ${errorMsg.trim()}`);
          });
        }

        ls.on('close', (code) => {
          if (code === 0) {
            logger.info('Download completed successfully');
            resolve({ success: true });
          } else {
            logger.error(`Download failed with exit code ${code}. Error: ${lastError.trim()}`);
            resolve({ success: false, error: lastError || `Exited with code ${code}` });
          }
        });

        ls.on('error', (err) => {
          logger.error(`Process error: ${err.message}`);
          resolve({ success: false, error: err.message });
        });
      });
    };

    const isCookieError = (err: string): boolean => {
      const msg = err.toLowerCase();
      return msg.includes('cookie database') || msg.includes('dpapi') || msg.includes('decrypt');
    };

    let result = await startDownload('chrome');
    
    if (!result.success && result.error && isCookieError(result.error)) {
      logger.warn('Chrome cookies inaccessible, trying Edge...');
      result = await startDownload('edge');
    }
    
    if (!result.success && result.error && isCookieError(result.error)) {
      logger.warn('All browser cookies inaccessible, falling back to cookie-less download...');
      result = await startDownload(null);
    }

    return result;
  }
}
