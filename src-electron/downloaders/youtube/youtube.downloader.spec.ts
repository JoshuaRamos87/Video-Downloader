import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YoutubeDownloader } from './youtube.downloader.js';

const { mockYtdlFn, mockExecFn } = vi.hoisted(() => ({
  mockYtdlFn: vi.fn(),
  mockExecFn: vi.fn()
}));

vi.mock('youtube-dl-exec', () => {
  return {
    default: {
      create: vi.fn().mockReturnValue(
        Object.assign(mockYtdlFn, {
          exec: mockExecFn
        })
      ),
      constants: { YOUTUBE_DL_PATH: '/mock/ytdl/path' }
    }
  };
});

vi.mock('ffmpeg-static', () => ({
  default: '/mock/ffmpeg/path'
}));

vi.mock('youtubei.js', () => ({
  Innertube: {
    create: vi.fn().mockResolvedValue({
      getInfo: vi.fn().mockResolvedValue({
        basic_info: { title: 'Mock YouTube Video', thumbnail: [{ url: 'mock_thumb.jpg' }] },
        streaming_data: { formats: [{ itag: '18', mime_type: 'video/mp4', quality_label: '360p', content_length: '1000' }] }
      })
    })
  }
}));

vi.mock('../../logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('YoutubeDownloader', () => {
  let downloader: YoutubeDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    downloader = new YoutubeDownloader();
  });

  describe('getVideoInfo', () => {
    it('should return video info successfully', async () => {
      mockYtdlFn.mockResolvedValueOnce({
        title: 'YTDL Title',
        thumbnail: 'ytdl_thumb.jpg',
        formats: [
          { format_id: '137', ext: 'mp4', height: 1080, filesize: 5000, vcodec: 'h264' }
        ]
      });

      const result = await downloader.getVideoInfo('https://youtube.com/watch?v=mockid12345');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('YTDL Title');
        expect(result.formats!.length).toBeGreaterThan(0);
        expect(result.formats![0].resolution).toBe('1080p');
      }
    });

    it('should fall back to youtubei.js on ytdl failure', async () => {
      mockYtdlFn.mockRejectedValue(new Error('Sign in to confirm'));

      const result = await downloader.getVideoInfo('https://youtube.com/watch?v=mockid12345');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('Mock YouTube Video');
        expect(result.formats!.length).toBeGreaterThan(0);
        expect(result.formats![0].resolution).toBe('360p');
      }
    });

    it('should handle invalid URL', async () => {
      const result = await downloader.getVideoInfo('https://youtube.com/invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid YouTube video URL');
      }
    });
  });

  describe('downloadVideo', () => {
    it('should complete download successfully', async () => {
      mockExecFn.mockReturnValue({
        stdout: { on: vi.fn((event: string, cb: any) => {
          if (event === 'data') {
            cb('[download] Destination: /mock/output/video.mp4\n');
          }
        })},
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') cb(0);
        }),
        catch: vi.fn()
      });

      const result = await downloader.downloadVideo({ url: 'https://youtube.com/watch?v=mock', outputPath: '/mock/output', formatId: '18', ext: 'mp4' }, vi.fn());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filePath).toBe('/mock/output/video.mp4');
      }
    });

    it('should return error on download failure', async () => {
       mockExecFn.mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn((event: string, cb: any) => {
          if (event === 'data') cb('Mock error log');
        })},
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') cb(1);
        }),
        catch: vi.fn()
      });

      const result = await downloader.downloadVideo({ url: 'https://youtube.com/watch?v=mock', outputPath: '/mock/output', formatId: '18', ext: 'mp4' }, vi.fn());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Mock error log');
      }
    });
  });
});
