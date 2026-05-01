import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TwitterDownloader } from './twitter.downloader.js';
import fs from 'node:fs';
import https from 'node:https';
import { PassThrough } from 'node:stream';

vi.mock('node:fs', () => ({
  default: {
    createWriteStream: vi.fn(),
    unlink: vi.fn()
  }
}));

vi.mock('node:https', () => ({
  default: {
    request: vi.fn(),
    get: vi.fn()
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

describe('TwitterDownloader', () => {
  let downloader: TwitterDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn() as any;
    downloader = new TwitterDownloader();
  });

  describe('getVideoInfo', () => {
    it('should return video info successfully via FxTwitter', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          tweet: {
            author: { name: 'Test User', screen_name: 'testuser' },
            text: 'Test tweet',
            media: {
              videos: [
                {
                  url: 'https://video.twimg.com/video.mp4',
                  thumbnail_url: 'thumb.jpg',
                  variants: [{ url: 'https://video.twimg.com/vid/720x1280/file.mp4', bitrate: 1000000 }]
                }
              ]
            }
          }
        })
      });

      (https.request as any).mockImplementation((url, options, cb) => {
        const res = { statusCode: 200, headers: { 'content-length': '5000' } };
        cb(res);
        return { on: vi.fn(), end: vi.fn() };
      });

      const result = await downloader.getVideoInfo('https://twitter.com/testuser/status/123456');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toContain('Test User');
        expect(result.formats.length).toBeGreaterThan(0);
        expect(result.formats[0].resolution).toBe('720x1280');
      }
    });

    it('should fallback to VxTwitter if FxTwitter fails', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('FxTwitter failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            user_name: 'Test User',
            user_screen_name: 'testuser',
            media_extended: [
              { type: 'video', url: 'https://video.twimg.com/video.mp4', thumbnail_url: 'thumb.jpg', size: { width: 1280, height: 720 } }
            ]
          })
        });

      (https.request as any).mockImplementation((url, options, cb) => {
        const res = { statusCode: 200, headers: { 'content-length': '5000' } };
        cb(res);
        return { on: vi.fn(), end: vi.fn() };
      });

      const result = await downloader.getVideoInfo('https://twitter.com/testuser/status/123456');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toContain('Test User');
        expect(result.formats.length).toBeGreaterThan(0);
        expect(result.formats[0].resolution).toBe('1280x720');
      }
    });
  });

  describe('downloadVideo', () => {
    it('should download video successfully', async () => {
      const mockStream = new PassThrough();
      const mockFileStream = new PassThrough() as any;
      mockFileStream.close = vi.fn();
      
      (fs.createWriteStream as any).mockReturnValue(mockFileStream);
      
      (https.get as any).mockImplementation((url, cb) => {
        const res = Object.assign(mockStream, {
          statusCode: 200,
          headers: { 'content-length': '100' },
        });
        cb(res);
        return { on: vi.fn() };
      });

      const downloadPromise = downloader.downloadVideo({ url: 'https://video.twimg.com/vid.mp4', outputPath: '/mock/output', formatId: '' }, vi.fn());
      
      mockStream.emit('data', Buffer.from('test data'));
      mockFileStream.emit('finish');

      const result = await downloadPromise;
      expect(result.success).toBe(true);
      if (result.success) {
         expect(result.filePath).toContain('vid.mp4');
      }
    });
  });
});
