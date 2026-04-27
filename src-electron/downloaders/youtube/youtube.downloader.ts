import { Innertube, UniversalCache } from 'youtubei.js';
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

export class YoutubeDownloader implements BaseDownloader {
  private ytInstances: Record<string, Innertube> = {};

  private async getYoutube(clientType: string = 'WEB'): Promise<Innertube | null> {
    if (this.ytInstances[clientType]) return this.ytInstances[clientType];

    try {
      logger.debug(`Initializing Innertube with client: ${clientType}`);
      // Use a more robust initialization for packaged apps
      const yt = await Innertube.create({ 
        client_type: clientType as any,
      });
      this.ytInstances[clientType] = yt;
      logger.info(`youtubei.js (${clientType}) initialized`);
      return yt;
    } catch (error: any) {
      logger.error(`Failed to initialize youtubei.js (${clientType}): ${error.message}`);
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
      let failureReasons: string[] = [];

      const browsers = ['chrome', 'edge', 'brave', null] as const;
      let ytdlInfo: any;
      
      for (const browser of browsers) {
        try {
          logger.debug(`Trying to fetch info using ${browser || 'no'} cookies...`);
          
          const flags: any = {
            dumpJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            noPlaylist: true,
            jsRuntime: 'node'
          };
          if (browser) flags.cookiesFromBrowser = browser;

          ytdlInfo = await ytdl(url, flags);
          
          if (ytdlInfo) {
            logger.info(`Successfully fetched info using ${browser || 'no'} cookies`);
            break;
          }
        } catch (e: any) { 
          const msg = e.message || String(e) || '';
          if (msg.includes('Sign in to confirm')) failureReasons.push('Bot detection triggered (Sign-in required)');
          if (msg.includes('confirm your age')) failureReasons.push('Age-restricted content');
          if (msg.includes('Private video')) failureReasons.push('Private video');
          if (msg.includes('not available in your country')) failureReasons.push('Geographically restricted');
          
          logger.warn(`Failed to fetch info using ${browser || 'no'} cookies: ${msg.split('\n')[0]}`);
          continue; 
        }
      }

      if (ytdlInfo) {
        title = ytdlInfo.title;
        thumbnail = ytdlInfo.thumbnail;
        allFormats = ytdlInfo.formats;
      } else {
        logger.info('Falling back to youtubei.js for video info');
        // Try multiple clients as some are more resilient to bot detection
        const clients = ['TVHTML5', 'IOS', 'ANDROID', 'MWEB', 'WEB'] as const;
        for (const client of clients) {
          try {
            logger.debug(`Trying youtubei.js with client: ${client}`);
            const yt = await this.getYoutube(client);
            if (!yt) {
              logger.warn(`Could not create youtubei.js instance for client: ${client}`);
              continue;
            }

            let info: any;
            try {
              info = await yt.getInfo(videoId);
            } catch (getInfoErr: any) {
              logger.error(`yt.getInfo (${client}) threw error: ${getInfoErr.message}`);
              if (getInfoErr.stack) logger.debug(`Stack: ${getInfoErr.stack}`);
              continue;
            }

            if (info) {
              // Extremely defensive extraction to find what's missing
              title = info.basic_info?.title || 'Unknown Title';
              
              logger.debug(`Processing info for client ${client}. Basic info present: ${!!info.basic_info}`);

              let thumbUrl = '';
              try {
                const thumbnails = info.basic_info?.thumbnail;
                if (Array.isArray(thumbnails) && thumbnails.length > 0) {
                  thumbUrl = thumbnails[0].url || '';
                } else if (thumbnails && (thumbnails as any).url) {
                  thumbUrl = (thumbnails as any).url;
                }
              } catch (thumbErr) {
                logger.warn(`Failed to extract thumbnail for ${client}:`, thumbErr);
              }
              thumbnail = thumbUrl;

              if (info.streaming_data) {
                allFormats = [
                  ...(info.streaming_data.formats || []), 
                  ...(info.streaming_data.adaptive_formats || [])
                ];
                logger.info(`Successfully fetched info using youtubei.js with ${client} client`);
                break;
              } else {
                logger.warn(`youtubei.js (${client}) returned info but no streaming data. This might be a restricted video.`);
              }
            }
          } catch (e: any) { 
            const msg = e.message || '';
            logger.error(`Outer catch in youtubei.js loop (${client}): ${msg}`);
            if (e.stack) logger.debug(`Stack: ${e.stack}`);
            
            if (msg.includes('Sign in to confirm')) failureReasons.push(`youtubei.js (${client}): Bot detection`);
            continue; 
          }
        }
      }

      if (allFormats.length === 0) {
        const uniqueReasons = [...new Set(failureReasons)];
        const reasonStr = uniqueReasons.length > 0 ? `Reasons: ${uniqueReasons.join(', ')}` : 'Could not retrieve metadata.';
        throw new Error(`Failed to fetch video info. ${reasonStr} Try closing your browser, signing in to YouTube in your browser, or trying again later.`);
      }
      
      const formats: VideoFormat[] = allFormats
        .map(f => {
          const mime = (f.mime_type || f.vcodec || '') as string;
          const isAudio = mime.includes('audio') || (f.acodec && f.acodec !== 'none' && f.vcodec === 'none');
          let resolution = 'Unknown';
          if (f.quality_label) resolution = f.quality_label;
          else if (f.height) resolution = `${f.height}p`;
          else if (isAudio) resolution = 'Audio only';

          // Only use quality if it's a descriptive string, not a ranking number
          const qualityNote = (typeof f.quality === 'string' && !/^\d+$/.test(f.quality)) ? f.quality : '';
          const formatNote = f.format_note || '';

          return {
            id: (f.itag?.toString() || f.format_id) as string,
            ext: ((f.mime_type ? f.mime_type.split(';')[0].split('/')[1] : f.ext) || 'mp4') as string,
            resolution,
            filesize: parseInt(f.content_length || f.filesize || f.filesize_approx) || 0,
            note: `${qualityNote} ${formatNote}`.trim()
          };
        })
        .filter(f => f.resolution !== 'Unknown' && f.ext !== 'mhtml' && f.filesize > 0);

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
          ffmpegLocation: fixedFfmpegPath,
          format: formatId ? `${formatId}+bestaudio/best` : 'bestvideo+bestaudio/best',
          jsRuntime: 'node'
        };

        if (browser) flags.cookiesFromBrowser = browser;

        logger.debug(`Starting download process with browser cookies: ${browser || 'none'}`);
        const ls = ytdl.exec(url, flags) as any;

        let lastError = '';
        let finalPath = '';

        (ls as any).catch((err: any) => {
          logger.error(`youtube-dl-exec process error: ${err.message}`);
        });

        if (ls.stdout) {
          ls.stdout.on('data', (data: Buffer | string) => {
            const line = data.toString();
            
            // Try to extract destination path
            const destMatch = line.match(/\[download\] Destination: (.+)/);
            if (destMatch) finalPath = destMatch[1].trim();
            
            const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/);
            if (mergeMatch) finalPath = mergeMatch[1].trim();

            const alreadyMatch = line.match(/\[download\] (.*?) has already been downloaded/);
            if (alreadyMatch) finalPath = alreadyMatch[1].trim();

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
          ls.stderr.on('data', (data: Buffer | string) => {
            const errorMsg = data.toString();
            lastError += errorMsg;
            logger.warn(`[YT-DLP] ${errorMsg.trim()}`);
          });
        }

        ls.on('close', (code: number | null) => {
          if (code === 0) {
            logger.info(`Download completed successfully: ${finalPath}`);
            resolve({ success: true, filePath: finalPath });
          } else {
            logger.error(`Download failed with exit code ${code}. Error: ${lastError.trim()}`);
            resolve({ success: false, error: lastError || `Exited with code ${code}` });
          }
        });

        ls.on('error', (err: Error) => {
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
