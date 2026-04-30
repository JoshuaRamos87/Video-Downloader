import { YoutubeDownloader } from './youtube/youtube.downloader.js';
import { TwitterDownloader } from './twitter/twitter.downloader.js';
import { RedditDownloader } from './reddit/reddit.downloader.js';
import { BaseDownloader } from '../interfaces.js';

export class DownloaderFactory {
  private static youtubeDownloader = new YoutubeDownloader();
  private static twitterDownloader = new TwitterDownloader();
  private static redditDownloader = new RedditDownloader();

  static getDownloader(url: string): BaseDownloader {
    const youtubeRegex = /(?:youtube\.com|youtu\.be)/i;
    const twitterRegex = /(?:twitter\.com|x\.com)/i;
    const redditRegex = /(?:reddit\.com|redd\.it)/i;

    if (youtubeRegex.test(url)) {
      return this.youtubeDownloader;
    }

    if (twitterRegex.test(url)) {
      return this.twitterDownloader;
    }

    if (redditRegex.test(url)) {
      return this.redditDownloader;
    }

    throw new Error('Unsupported platform. Please provide a YouTube, Twitter/X, or Reddit URL.');
  }
}
