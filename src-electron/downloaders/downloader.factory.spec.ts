import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

import { DownloaderFactory } from './downloader.factory.js';
import { YoutubeDownloader } from './youtube/youtube.downloader.js';
import { TwitterDownloader } from './twitter/twitter.downloader.js';
import { RedditDownloader } from './reddit/reddit.downloader.js';
import { InstagramDownloader } from './instagram/instagram.downloader.js';
import { TiktokDownloader } from './tiktok/tiktok.downloader.js';
import { GeneralDownloader } from './general/general.downloader.js';

describe('DownloaderFactory', () => {
  it('should return YoutubeDownloader for YouTube URLs', () => {
    expect(DownloaderFactory.getDownloader('https://youtube.com/watch?v=123')).toBeInstanceOf(YoutubeDownloader);
    expect(DownloaderFactory.getDownloader('https://youtu.be/123')).toBeInstanceOf(YoutubeDownloader);
  });

  it('should return TwitterDownloader for Twitter/X URLs', () => {
    expect(DownloaderFactory.getDownloader('https://twitter.com/user/status/123')).toBeInstanceOf(TwitterDownloader);
    expect(DownloaderFactory.getDownloader('https://x.com/user/status/123')).toBeInstanceOf(TwitterDownloader);
  });

  it('should return RedditDownloader for Reddit URLs', () => {
    expect(DownloaderFactory.getDownloader('https://reddit.com/r/funny/comments/123/haha')).toBeInstanceOf(RedditDownloader);
    expect(DownloaderFactory.getDownloader('https://redd.it/123')).toBeInstanceOf(RedditDownloader);
  });

  it('should return InstagramDownloader for Instagram URLs', () => {
    expect(DownloaderFactory.getDownloader('https://instagram.com/p/123')).toBeInstanceOf(InstagramDownloader);
    expect(DownloaderFactory.getDownloader('https://instagram.com/reel/123')).toBeInstanceOf(InstagramDownloader);
  });

  it('should return TiktokDownloader for TikTok URLs', () => {
    expect(DownloaderFactory.getDownloader('https://tiktok.com/@user/video/123')).toBeInstanceOf(TiktokDownloader);
    expect(DownloaderFactory.getDownloader('https://vm.tiktok.com/123')).toBeInstanceOf(TiktokDownloader);
  });

  it('should return GeneralDownloader for other URLs', () => {
    expect(DownloaderFactory.getDownloader('https://example.com/video')).toBeInstanceOf(GeneralDownloader);
  });
});
