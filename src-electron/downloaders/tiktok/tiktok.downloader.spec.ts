import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TiktokDownloader } from './tiktok.downloader.js';
import path from 'node:path';

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

vi.mock('../../logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

vi.mock('node:readline', () => ({
  createInterface: vi.fn().mockReturnValue({
    on: vi.fn((event, cb) => {
      if (event === 'line') cb('[download] Destination: /mock/output/tiktok.mp4');
    }),
    close: vi.fn()
  })
}));

describe('TiktokDownloader', () => {
  let downloader: TiktokDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    downloader = new TiktokDownloader();
  });

  describe('getVideoInfo', () => {
    it('should return video info successfully', async () => {
      mockYtdlFn.mockResolvedValueOnce({
        title: 'TikTok Video',
        thumbnail: 'thumb.jpg',
        formats: [
          { format_id: '1', ext: 'mp4', height: 1080, filesize: 5000, vcodec: 'h264' }
        ]
      });

      const result = await downloader.getVideoInfo('https://tiktok.com/@user/video/123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('TikTok Video');
        expect(result.formats.length).toBeGreaterThan(0);
        expect(result.formats[0].resolution).toBe('1080p');
      }
    });

    it('should handle metadata error', async () => {
      mockYtdlFn.mockRejectedValue(new Error('Failed to fetch'));

      const result = await downloader.getVideoInfo('https://tiktok.com/@user/video/123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to fetch');
      }
    });
  });

  describe('downloadVideo', () => {
    it('should complete download successfully', async () => {
      mockExecFn.mockReturnValue({
        stdout: { 
          on: vi.fn(), // readline needs an EventEmitter or stream
          pipe: vi.fn()
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
        catch: vi.fn()
      });

      // since we use readline.createInterface on stdout, we need to mock it properly, or just mock readline entirely.
      // But let's mock readline in the file or just emit 'close' event directly and test it handles it.
      // the path will resolve to outputPath if finalPath is empty, let's verify.
      const result = await downloader.downloadVideo({ url: 'https://tiktok.com/@user/video/123', outputPath: '/mock/output', formatId: '1', ext: 'mp4' }, vi.fn());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filePath).toContain('tiktok.mp4');
      }
    });
  });
});
