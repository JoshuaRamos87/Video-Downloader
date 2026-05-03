import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YtMusicDownloader } from './ytmusic.downloader.js';

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
      music: {
        getPlaylist: vi.fn().mockImplementation((listId) => {
          if (listId === 'invalid_playlist') return null;
          if (listId === 'artists_playlist') {
            return {
              header: { 
                title: { toString: () => 'Artists Playlist' }, 
                thumbnail: { contents: [{ url: 'mock_playlist_thumb.jpg' }] } 
              },
              items: [
                { 
                  type: 'MusicResponsiveListItem', 
                  id: 'mockid3', 
                  title: { toString: () => 'Song 3' }, 
                  artists: [{ name: 'Artist 3' }], 
                  thumbnail: { contents: [{ url: 'thumb3.jpg' }] } 
                }
              ]
            };
          }
          if (listId === 'header_text_playlist') {
            return {
              header: { 
                title: { text: 'Header Text Playlist' }, 
                thumbnails: [{ url: 'high_res_thumb.jpg' }] 
              },
              items: []
            };
          }
          if (listId === 'direct_array_playlist') {
            return {
              header: { 
                title: { text: 'Direct Array Playlist' }, 
                thumbnail: [
                  { url: 'low_res.jpg' },
                  { url: 'high_res_direct.jpg' }
                ]
              },
              items: [
                { 
                  type: 'MusicResponsiveListItem', 
                  id: 'direct_item_id', 
                  title: { toString: () => 'Direct Item' }, 
                  authors: [{ name: 'Direct Artist' }], 
                  thumbnail: [{ url: 'item_direct_thumb.jpg' }] 
                }
              ]
            };
          }
          if (listId === 'no_header_playlist') {
            return {
              header: undefined,
              items: [
                { 
                  type: 'MusicResponsiveListItem', 
                  id: 'fallback_id', 
                  title: { toString: () => 'Fallback Song' }, 
                  authors: [{ name: 'Fallback Artist' }], 
                  thumbnail: [{ url: 'fallback_item_thumb.jpg' }],
                  album: { name: 'Fallback Album' }
                }
              ]
            };
          }
          return {
            header: { 
              title: { toString: () => 'Mock Playlist' }, 
              thumbnail: { contents: [{ url: 'mock_playlist_thumb.jpg' }] } 
            },
            items: [
              { 
                type: 'MusicResponsiveListItem', 
                id: 'mockid1', 
                title: { toString: () => 'Song 1' }, 
                authors: [{ name: 'Artist 1' }], 
                thumbnail: { contents: [{ url: 'thumb1.jpg' }] } 
              },
              { 
                type: 'MusicResponsiveListItem', 
                id: 'mockid2', 
                title: { toString: () => 'Song 2' }, 
                authors: [{ name: 'Artist 2' }], 
                thumbnail: { contents: [{ url: 'thumb2.jpg' }] } 
              }
            ]
          };
        }),
        getInfo: vi.fn().mockImplementation((videoId) => {
          if (videoId === 'invalid1234') throw new Error('Video not found');
          return {
            basic_info: { title: 'Mock Song', thumbnail: [{ url: 'mock_song_thumb.jpg' }] }
          };
        })
      }
    })
  },
  ClientType: { MUSIC: 'MUSIC' }
}));

vi.mock('../../logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('YtMusicDownloader', () => {
  let downloader: YtMusicDownloader;

  beforeEach(() => {
    vi.clearAllMocks();
    downloader = new YtMusicDownloader();
  });

  describe('getVideoInfo', () => {
    it('should return playlist info successfully', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/playlist?list=PLmocklist123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isPlaylist).toBe(true);
        expect(result.title).toBe('Mock Playlist');
        expect(result.thumbnail).toBe('mock_playlist_thumb.jpg');
        expect(result.playlistItems).toBeDefined();
        expect(result.playlistItems!.length).toBe(2);
        expect(result.playlistItems![0].title).toBe('Song 1');
        expect(result.playlistItems![0].artist).toBe('Artist 1');
        expect(result.playlistItems![0].thumbnail).toBe('thumb1.jpg');
        expect(result.playlistItems![0].url).toBe('https://music.youtube.com/watch?v=mockid1');
        expect(result.formats!.length).toBe(1);
        expect(result.formats![0].id).toBe('bestaudio');
      }
    });

    it('should correctly extract artists when authors field is missing', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/playlist?list=artists_playlist');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.playlistItems).toBeDefined();
        expect(result.playlistItems!.length).toBe(1);
        expect(result.playlistItems![0].artist).toBe('Artist 3');
      }
    });

    it('should handle alternative header structures', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/playlist?list=header_text_playlist');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('Header Text Playlist');
        expect(result.thumbnail).toBe('high_res_thumb.jpg');
      }
    });

    it('should handle header.thumbnail as a direct array', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/playlist?list=direct_array_playlist');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('Direct Array Playlist');
        expect(result.thumbnail).toBe('high_res_direct.jpg');
        expect(result.playlistItems).toBeDefined();
        expect(result.playlistItems![0].thumbnail).toBe('item_direct_thumb.jpg');
      }
    });

    it('should use fallback title and thumbnail when header is missing', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/playlist?list=no_header_playlist');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.title).toBe('Fallback Album');
        expect(result.thumbnail).toBe('fallback_item_thumb.jpg');
      }
    });

    it('should return video info successfully', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/watch?v=mockid12345');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isPlaylist).toBe(false);
        expect(result.title).toBe('Mock Song');
        expect(result.thumbnail).toBe('mock_song_thumb.jpg');
        expect(result.formats!.length).toBe(1);
        expect(result.formats![0].id).toBe('bestaudio');
      }
    });

    it('should handle invalid playlist URL', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/playlist?list=');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid YouTube Music playlist URL');
      }
    });

    it('should handle invalid video URL', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/watch?v=short');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid YouTube Music video URL');
      }
    });

    it('should handle youtubei.js errors gracefully', async () => {
      const result = await downloader.getVideoInfo('https://music.youtube.com/watch?v=invalid1234');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Video not found');
      }
    });
  });

  describe('downloadVideo', () => {
    it('should complete download successfully and use unique suffix for single videos', async () => {
      mockExecFn.mockReturnValue({
        stdout: { on: vi.fn((event: string, cb: any) => {
          if (event === 'data') {
            cb('[download] Destination: /mock/output/song_unique.m4a\n');
          }
        })},
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') cb(0);
        }),
        catch: vi.fn()
      });

      const result = await downloader.downloadVideo({ url: 'https://music.youtube.com/watch?v=mock', outputPath: '/mock/output', formatId: 'bestaudio', ext: 'm4a' }, vi.fn());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.filePath).toBe('/mock/output/song_unique.m4a');
      }

      // Verify that the output flag contains a suffix (regex for base36 timestamp)
      const callArgs = mockExecFn.mock.calls[0];
      const flags = callArgs[1];
      expect(flags.output).toMatch(/%\(title\)s_[a-z0-9]+\.%\(ext\)s/);
    });

    it('should not use unique suffix for playlist downloads', async () => {
      mockExecFn.mockReturnValue({
        stdout: { on: vi.fn((event: string, cb: any) => {
          if (event === 'data') {
            cb('[download] Destination: /mock/output/song.m4a\n');
          }
        })},
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') cb(0);
        }),
        catch: vi.fn()
      });

      const result = await downloader.downloadVideo({ 
        url: 'https://music.youtube.com/playlist?list=mock', 
        outputPath: '/mock/output', 
        formatId: 'bestaudio', 
        ext: 'm4a',
        isPlaylistDownload: true 
      }, vi.fn());
      
      expect(result.success).toBe(true);
      
      const callArgs = mockExecFn.mock.calls[0];
      const flags = callArgs[1];
      expect(flags.output).toBe(require('path').join('/mock/output', '%(title)s.%(ext)s'));
    });

    it('should parse progress correctly', async () => {
      const onProgress = vi.fn();
      mockExecFn.mockReturnValue({
        stdout: { on: vi.fn((event: string, cb: any) => {
          if (event === 'data') {
            cb('[download]  50.0% of 10.00MiB at  1.00MiB/s ETA 00:05\n');
          }
        })},
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, cb: any) => {
          if (event === 'close') cb(0);
        }),
        catch: vi.fn()
      });

      await downloader.downloadVideo({ url: 'https://music.youtube.com/watch?v=mock', outputPath: '/mock/output', formatId: 'bestaudio', ext: 'm4a' }, onProgress);
      expect(onProgress).toHaveBeenCalledWith({
        percent: 50,
        totalSize: '10.00MiB',
        speed: '1.00MiB/s',
        eta: '00:05'
      });
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

      const result = await downloader.downloadVideo({ url: 'https://music.youtube.com/watch?v=mock', outputPath: '/mock/output', formatId: 'bestaudio', ext: 'm4a' }, vi.fn());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Mock error log');
      }
    });
  });
});
