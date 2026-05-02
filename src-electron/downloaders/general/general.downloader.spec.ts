import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeneralDownloader } from './general.downloader.js';

const { mockYtdlFn, mockExecFn, mockOnBeforeRequest, mockOnHeadersReceived } = vi.hoisted(() => ({
  mockYtdlFn: vi.fn(),
  mockExecFn: vi.fn(),
  mockOnBeforeRequest: vi.fn(),
  mockOnHeadersReceived: vi.fn()
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

vi.mock('electron', () => {
  const MockBrowserWindow = vi.fn().mockImplementation(function() {
    return {
      webContents: {
        session: {
          webRequest: {
            onBeforeRequest: mockOnBeforeRequest,
            onHeadersReceived: mockOnHeadersReceived
          }
        }
      },
      loadURL: vi.fn().mockResolvedValue(undefined),
      isDestroyed: vi.fn().mockReturnValue(false),
      destroy: vi.fn()
    };
  });
  return {
    BrowserWindow: MockBrowserWindow
  };
});

vi.mock('../../logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('GeneralDownloader', () => {
  let downloader: GeneralDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    downloader = new GeneralDownloader();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getVideoInfo', () => {
    it('should sniff media links successfully', async () => {
      const infoPromise = downloader.getVideoInfo('https://example.com');

      // Capture the listeners registered by GeneralDownloader
      expect(mockOnBeforeRequest).toHaveBeenCalled();
      expect(mockOnHeadersReceived).toHaveBeenCalled();

      const onBeforeRequestCallback = mockOnBeforeRequest.mock.calls[0][1];
      const onHeadersReceivedCallback = mockOnHeadersReceived.mock.calls[0][1];

      // Simulate discovering a link via extension
      onBeforeRequestCallback({ url: 'https://example.com/video.mp4' }, vi.fn());

      // Simulate discovering a link via content-type
      onHeadersReceivedCallback({ 
        url: 'https://example.com/stream', 
        responseHeaders: { 'content-type': ['video/mp4'] } 
      }, vi.fn());

      // Advance timers by 10 seconds to trigger resolution
      vi.advanceTimersByTime(10000);

      const result = await infoPromise;
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.formats!.length).toBe(2);
        expect(result.formats![0].id).toBe('https://example.com/video.mp4');
        expect(result.formats![1].id).toBe('https://example.com/stream');
      }
    });

    it('should handle no media links found', async () => {
      const infoPromise = downloader.getVideoInfo('https://example.com');
      
      vi.advanceTimersByTime(10000);

      const result = await infoPromise;
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('No media links discovered on this page.');
      }
    });
  });

  describe('downloadVideo', () => {
    it('should complete download successfully', async () => {
      mockExecFn.mockReturnValue({
        stdout: { on: vi.fn((event: string, cb: any) => {
          if (event === 'data') {
            cb('[download] Destination: /mock/output/download_file.mp4\n');
          }
        })},
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') cb(0);
        }),
        catch: vi.fn()
      });

      const result = await downloader.downloadVideo({ 
        url: 'https://example.com', 
        outputPath: '/mock/output', 
        formatId: 'https://example.com/video.mp4', 
        ext: 'mp4' 
      }, vi.fn());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filePath).toBe('/mock/output/download_file.mp4');
      }
    });

    it('should return error on download failure', async () => {
      mockExecFn.mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn((event: string, cb: any) => {
          if (event === 'data') cb('Generic Error');
        })},
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') cb(1);
        }),
        catch: vi.fn()
      });

      const result = await downloader.downloadVideo({ 
        url: 'https://example.com', 
        outputPath: '/mock/output', 
        formatId: 'https://example.com/video.mp4', 
        ext: 'mp4' 
      }, vi.fn());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Generic Error');
      }
    });
  });
});
