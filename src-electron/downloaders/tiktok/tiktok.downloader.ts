import youtubeDl from 'youtube-dl-exec';
const { create, constants } = youtubeDl as any;
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import * as readline from 'node:readline';
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

export class TiktokDownloader implements BaseDownloader {
  async getVideoInfo(url: string): Promise<VideoInfoResponse> {
    logger.info(`TiktokDownloader: Fetching info for: ${url}`);
    try {
      const flags: any = {
        dumpJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        noPlaylist: true
      };

      const info = await ytdl(url, flags);
      
      if (!info) {
        throw new Error('Could not retrieve TikTok video metadata.');
      }

      const allFormats = info.formats || [];
      const formats: VideoFormat[] = allFormats
        .map((f: any) => {
          let resolution = 'Unknown';
          if (f.quality_label) resolution = f.quality_label;
          else if (f.height) resolution = `${f.height}p`;
          else if (f.vcodec !== 'none' && f.width && f.height) resolution = `${f.width}x${f.height}`;

          return {
            id: f.format_id as string,
            ext: (f.ext || 'mp4') as string,
            resolution,
            filesize: parseInt(f.content_length || f.filesize || f.filesize_approx) || 0,
            note: f.format_note || ''
          };
        })
        .filter((f: VideoFormat) => f.resolution !== 'Unknown' && f.filesize > 0);

      // Sort formats by resolution (highest first)
      formats.sort((a, b) => {
        const getVal = (res: string) => {
          const m = res.match(/(\d+)/);
          return m ? parseInt(m[1]) : 0;
        };
        return getVal(b.resolution) - getVal(a.resolution);
      });

      // Try to find the best thumbnail from the array if the main one is missing
      let thumbnail = info.thumbnail || '';
      if (Array.isArray(info.thumbnails) && info.thumbnails.length > 0) {
        thumbnail = info.thumbnails[info.thumbnails.length - 1].url || thumbnail;
      }

      return {
        success: true,
        title: info.title || info.description?.substring(0, 50) || 'TikTok Video',
        thumbnail: thumbnail,
        formats: formats.length > 0 ? formats : [{ id: 'best', ext: 'mp4', resolution: 'Best Quality', filesize: 0, note: '' }]
      };
    } catch (error: any) {
      logger.error(`Error in TiktokDownloader.getVideoInfo: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async downloadVideo(request: DownloadRequest, onProgress: (progress: DownloadProgress) => void): Promise<DownloadResult> {
    const { url, outputPath, formatId } = request;
    logger.info(`TiktokDownloader: Download request: ${url} | Format: ${formatId}`);
    
    return new Promise((resolve) => {
      const uniqueSuffix = Date.now().toString(36);
      
      const flags: any = {
        output: path.join(outputPath, `tiktok_%(title)s_${uniqueSuffix}.%(ext)s`),
        restrictFilenames: true,
        newline: true,
        noCheckCertificates: true,
        progress: true,
        ffmpegLocation: fixedFfmpegPath,
        format: formatId && formatId !== 'best' ? `${formatId}+bestaudio/best` : 'bestvideo+bestaudio/best',
        mergeOutputFormat: 'mp4'
      };

      logger.debug(`Starting TikTok download process...`);
      const ls = ytdl.exec(url, flags, { 
        env: { 
          ...process.env, 
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        } 
      }) as any;

      let lastError = '';
      let finalPath = '';

      if (ls.stdout) {
        const rl = readline.createInterface({ input: ls.stdout });
        rl.on('line', (line) => {
          const destMatch = line.match(/\[download\] Destination: (.+)/);
          if (destMatch) finalPath = path.resolve(destMatch[1].trim());
          
          const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/);
          if (mergeMatch) finalPath = path.resolve(mergeMatch[1].trim());

          const alreadyMatch = line.match(/\[download\] (.*?) has already been downloaded/);
          if (alreadyMatch) finalPath = path.resolve(alreadyMatch[1].trim());

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
          logger.warn(`[TK-DLP] ${errorMsg.trim()}`);
        });
      }

      ls.on('close', (code: number | null) => {
        if (code === 0) {
          logger.info(`TikTok download completed successfully: ${finalPath}`);
          resolve({ success: true, filePath: finalPath ? path.resolve(finalPath) : outputPath });
        } else {
          logger.error(`TikTok download failed with exit code ${code}. Error: ${lastError.trim()}`);
          resolve({ success: false, error: lastError || `Exited with code ${code}` });
        }
      });

      ls.on('error', (err: Error) => {
        logger.error(`Process error: ${err.message}`);
        resolve({ success: false, error: err.message });
      });
    });
  }
}
