import { Innertube, ClientType } from 'youtubei.js';
import youtubeDl from 'youtube-dl-exec';
import path from 'node:path';
import fs from 'node:fs';
import ffmpegPath from 'ffmpeg-static';
import { logger } from '../../logger.js';
import { 
  BaseDownloader, 
  VideoInfoResponse, 
  DownloadRequest, 
  DownloadProgress, 
  DownloadResult,
  PlaylistItem
} from '../../interfaces.js';
import { ChildProcess } from 'node:child_process';

const { create, constants } = youtubeDl as unknown as { create: (binaryPath: string) => any, constants: { YOUTUBE_DL_PATH: string } };

const fixPath = (p: string) => p.replace('app.asar', 'app.asar.unpacked');
const ytdlpBinary = fixPath(constants.YOUTUBE_DL_PATH);
const ytdl = create(ytdlpBinary);
const fixedFfmpegPath = fixPath(ffmpegPath || '');

interface YoutubeiItem {
  id?: string;
  title?: { toString(): string };
  authors?: { name: string }[];
  thumbnails?: { url: string }[];
}

export class YtMusicDownloader implements BaseDownloader {
  private ytInstance: Innertube | null = null;

  private async getYoutube(): Promise<Innertube | null> {
    if (this.ytInstance) return this.ytInstance;
    try {
      this.ytInstance = await Innertube.create({ client_type: ClientType.MUSIC });
      return this.ytInstance;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize youtubei.js (YTMUSIC): ${msg}`);
      return null;
    }
  }

  async getVideoInfo(url: string): Promise<VideoInfoResponse> {
    logger.info(`YtMusicDownloader: Fetching info for: ${url}`);
    try {
      const yt = await this.getYoutube();
      if (!yt) throw new Error('Could not initialize YouTube Music client');

      const isPlaylist = url.includes('list=');
      
      if (isPlaylist) {
        const listIdMatch = url.match(/[?&]list=([^&]+)/);
        const listId = listIdMatch ? listIdMatch[1] : null;
        if (!listId) throw new Error('Invalid YouTube Music playlist URL');

        const playlist = await yt.music.getPlaylist(listId);
        if (!playlist) throw new Error('Could not fetch playlist info');

        const header = playlist.header as any;
        const title = header?.title?.text || header?.title?.toString() || 'Unknown Playlist';
        
        // Get high-res thumbnail from header
        let thumbnail = '';
        if (header?.thumbnail?.contents && header.thumbnail.contents.length > 0) {
          // Use the last one for highest resolution
          thumbnail = header.thumbnail.contents[header.thumbnail.contents.length - 1].url;
        }
        
        const playlistItems: PlaylistItem[] = [];
        
        if (playlist.items) {
          for (const item of playlist.items) {
            if (item.type === 'MusicResponsiveListItem') {
              const musicItem = item as any;
              if (musicItem.id) {
                let itemThumb = '';
                if (musicItem.thumbnail?.contents && musicItem.thumbnail.contents.length > 0) {
                  itemThumb = musicItem.thumbnail.contents[0].url;
                }

                playlistItems.push({
                  id: musicItem.id,
                  title: musicItem.title?.toString() || 'Unknown Title',
                  artist: musicItem.authors?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
                  thumbnail: itemThumb,
                  url: `https://music.youtube.com/watch?v=${musicItem.id}`,
                  selected: true
                });
              }
            }
          }
        }

        return {
          success: true,
          title,
          thumbnail,
          isPlaylist: true,
          playlistItems,
          formats: [{
            id: 'bestaudio',
            ext: 'm4a',
            resolution: 'Audio only',
            filesize: 0,
            note: 'Best Audio (M4A)'
          }]
        };
      } else {
        const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        if (!videoId) throw new Error('Invalid YouTube Music video URL');

        const info = await yt.music.getInfo(videoId);
        const title = info.basic_info?.title || 'Unknown Title';
        const thumbnail = info.basic_info?.thumbnail?.[0]?.url || '';
        
        return {
          success: true,
          title,
          thumbnail,
          isPlaylist: false,
          formats: [{
            id: 'bestaudio',
            ext: 'm4a',
            resolution: 'Audio only',
            filesize: 0,
            note: 'Best Audio (M4A)'
          }]
        };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Error in YtMusicDownloader.getVideoInfo: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async downloadVideo(request: DownloadRequest, onProgress: (progress: DownloadProgress) => void): Promise<DownloadResult> {
    const { url, outputPath } = request;
    logger.info(`YtMusicDownloader: Download request: ${url}`);
    
    return new Promise((resolve) => {
      const uniqueSuffix = Date.now().toString(36);
      const outputTemplate = request.isPlaylistDownload 
        ? '%(title)s.%(ext)s' 
        : `%(title)s_${uniqueSuffix}.%(ext)s`;
      
      const flags = {
        output: path.join(outputPath, outputTemplate),
        restrictFilenames: true,
        newline: true,
        noCheckCertificates: true,
        progress: true,
        ffmpegLocation: fixedFfmpegPath,
        format: 'bestaudio[ext=m4a]/bestaudio/best',
        extractAudio: true,
        audioFormat: 'm4a',
        addMetadata: true,
        embedThumbnail: true,
        jsRuntime: 'node'
      };

      const ls = ytdl.exec(url, flags, { 
        env: { 
          ...process.env, 
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8'
        } 
      }) as unknown as ChildProcess & Promise<unknown>;

      let lastError = '';
      let finalPath = '';

      ls.catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`youtube-dl-exec process error: ${msg}`);
      });

      if (ls.stdout) {
        ls.stdout.on('data', (data: Buffer | string) => {
          const line = Buffer.isBuffer(data) ? data.toString('utf8') : data;
          
          const destMatch = line.match(/\[download\] Destination: (.+)/);
          if (destMatch) finalPath = destMatch[1].trim();
          
          const extractMatch = line.match(/\[ExtractAudio\] Destination: (.+)/);
          if (extractMatch) finalPath = extractMatch[1].trim();

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
  }
}

