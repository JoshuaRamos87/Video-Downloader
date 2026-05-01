import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstagramDownloader } from './instagram.downloader.js';

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

describe('InstagramDownloader', () => {
  let downloader: InstagramDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    downloader = new InstagramDownloader();
  });

  describe('getVideoInfo', () => {
    it('should return video info successfully', async () => {
      mockYtdlFn.mockResolvedValueOnce({
        title: 'Instagram Video',
        thumbnail: 'thumb.jpg',
        formats: [
          { format_id: '1', ext: 'mp4', height: 1080, filesize: 5000, vcodec: 'h264' }
        ]
      });

      const result = await downloader.getVideoInfo('https://instagram.com/p/123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('Instagram Video');
        expect(result.formats.length).toBeGreaterThan(0);
        expect(result.formats[0].resolution).toBe('1080p');
      }
    });

    it('should fallback to cookies if initial metadata fetch fails', async () => {
      mockYtdlFn
        .mockRejectedValueOnce(new Error('Login required'))
        .mockResolvedValueOnce({
          title: 'Instagram Video Cookie',
          formats: [{ format_id: '1', ext: 'mp4', height: 720, filesize: 5000, vcodec: 'h264' }]
        });

      const result = await downloader.getVideoInfo('https://instagram.com/p/123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('Instagram Video Cookie');
        expect(result.formats[0].resolution).toBe('720p');
      }
    });
  });

  describe('downloadVideo', () => {
    it('should complete download successfully', async () => {
      mockExecFn.mockReturnValue({
        stdout: { on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb('[download] Destination: /mock/output/ig_video.mp4\n');
          }
        })},
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
          if (event === 'close') cb(0);
        }),
        catch: vi.fn()
      });

      const result = await downloader.downloadVideo({ url: 'https://instagram.com/p/123', outputPath: '/mock/output', formatId: '1', ext: 'mp4' }, vi.fn());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filePath).toBe('/mock/output/ig_video.mp4');
      }
    });
  });
});
