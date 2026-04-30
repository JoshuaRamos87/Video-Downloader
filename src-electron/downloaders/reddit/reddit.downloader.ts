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

export class RedditDownloader implements BaseDownloader {
  async getVideoInfo(url: string): Promise<VideoInfoResponse> {
    logger.info(`RedditDownloader: Fetching info for: ${url}`);
    try {
      const flags: any = {
        dumpJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        noPlaylist: true,
        jsRuntime: 'node'
      };

      const info = await ytdl(url, flags);
      
      if (!info) {
        throw new Error('Could not retrieve Reddit video metadata.');
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

      return {
        success: true,
        title: info.title || 'Reddit Video',
        thumbnail: info.thumbnail || '',
        formats: formats
      };
    } catch (error: any) {
      logger.error(`Error in RedditDownloader.getVideoInfo: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async downloadVideo(request: DownloadRequest, onProgress: (progress: DownloadProgress) => void): Promise<DownloadResult> {
    const { url, outputPath, formatId } = request;
    logger.info(`RedditDownloader: Download request: ${url} | Format: ${formatId}`);
    
    return new Promise((resolve) => {
      const uniqueSuffix = Date.now().toString(36);
      
      const flags: any = {
        output: path.join(outputPath, `reddit_%(title)s_${uniqueSuffix}.%(ext)s`),
        restrictFilenames: true,
        newline: true,
        noCheckCertificates: true,
        progress: true,
        ffmpegLocation: fixedFfmpegPath,
        format: formatId ? `${formatId}+bestaudio/best` : 'bestvideo+bestaudio/best',
        jsRuntime: 'node',
        mergeOutputFormat: 'mp4'
      };

      logger.debug(`Starting Reddit download process...`);
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
        ls.stdout.on('data', (data: Buffer | string) => {
          const line = Buffer.isBuffer(data) ? data.toString('utf8') : data;
          
          const destMatch = line.match(/\[download\] Destination: (.+)/);
          if (destMatch) finalPath = destMatch[1].trim();
          
          const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/);
          if (mergeMatch) finalPath = mergeMatch[1].trim();

          const alreadyMatch = line.match(/\[download\] (.*?) has already been downloaded/);
          if (alreadyMatch) finalPath = alreadyMatch[1].trim();

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
          logger.warn(`[Reddit-DLP] ${errorMsg.trim()}`);
        });
      }

      ls.on('close', (code: number | null) => {
        if (code === 0) {
          logger.info(`Reddit download completed successfully: ${finalPath}`);
          resolve({ success: true, filePath: finalPath });
        } else {
          logger.error(`Reddit download failed with exit code ${code}. Error: ${lastError.trim()}`);
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
