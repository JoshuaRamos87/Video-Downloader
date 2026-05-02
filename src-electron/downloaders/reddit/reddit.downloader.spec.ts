import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedditDownloader } from './reddit.downloader.js';

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

describe('RedditDownloader', () => {
  let downloader: RedditDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    downloader = new RedditDownloader();
  });

  describe('getVideoInfo', () => {
    it('should return video info successfully', async () => {
      mockYtdlFn.mockResolvedValueOnce({
        title: 'Reddit Video',
        thumbnail: 'thumb.jpg',
        formats: [
          { format_id: '1', ext: 'mp4', height: 720, width: 1280, filesize: 5000, vcodec: 'h264' }
        ]
      });

      const result = await downloader.getVideoInfo('https://reddit.com/r/videos/123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('Reddit Video');
        expect(result.formats!.length).toBeGreaterThan(0);
        expect(result.formats![0].resolution).toBe('720p');
      }
    });

    it('should handle ytdl failure', async () => {
      mockYtdlFn.mockRejectedValue(new Error('Failed to fetch'));

      const result = await downloader.getVideoInfo('https://reddit.com/r/videos/123');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to fetch');
      }
    });
  });

  describe('downloadVideo', () => {
    it('should complete download successfully', async () => {
      mockExecFn.mockReturnValue({
        stdout: { on: vi.fn((event: string, cb: any) => {
          if (event === 'data') {
            cb('[download] Destination: /mock/output/reddit_video.mp4\n');
          }
        })},
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') cb(0);
        }),
        catch: vi.fn()
      });

      const result = await downloader.downloadVideo({ url: 'https://reddit.com/r/videos/123', outputPath: '/mock/output', formatId: '1', ext: 'mp4' }, vi.fn());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filePath).toBe('/mock/output/reddit_video.mp4');
      }
    });
  });
});
