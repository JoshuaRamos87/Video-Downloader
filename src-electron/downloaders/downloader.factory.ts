import { YoutubeDownloader } from './youtube/youtube.downloader.js';
import { TwitterDownloader } from './twitter/twitter.downloader.js';
import { BaseDownloader } from '../interfaces.js';

export class DownloaderFactory {
  private static youtubeDownloader = new YoutubeDownloader();
  private static twitterDownloader = new TwitterDownloader();

  static getDownloader(url: string): BaseDownloader {
    const youtubeRegex = /(?:youtube\.com|youtu\.be)/i;
    const twitterRegex = /(?:twitter\.com|x\.com)/i;

    if (youtubeRegex.test(url)) {
      return this.youtubeDownloader;
    }

    if (twitterRegex.test(url)) {
      return this.twitterDownloader;
    }

    throw new Error('Unsupported platform. Please provide a YouTube or Twitter/X URL.');
  }
}
