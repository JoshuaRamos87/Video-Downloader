import { Component, signal, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  url = signal('');
  outputPath = signal('');
  status = signal('');
  isDownloading = signal(false);
  isFetchingInfo = signal(false);

  // Video Info
  videoInfo = signal<any>(null);
  selectedFormatId = signal('');

  // Progress Info
  progress = signal({
    percent: 0,
    speed: '',
    eta: '',
    totalSize: ''
  });

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      const api = (window as any).electronAPI;
      if (api) {
        api.log('INFO', 'Angular app initialized and connected to Electron');
        api.onDownloadProgress((data: any) => {
          this.progress.set(data);
        });
      }
    }
  }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      if (this.api) {
        // Load persisted output path
        const config = await this.api.getConfig();
        if (config.outputPath) {
          this.outputPath.set(config.outputPath);
          this.api.log('INFO', `Loaded output path from config: ${config.outputPath}`);
        }
      }
    }
  }

  get api() {
    if (isPlatformBrowser(this.platformId)) {
      return (window as any).electronAPI;
    }
    return null;
  }

  async fetchVideoInfo() {
    if (!this.url() || !this.api) {
      if (this.api) this.api.log('WARN', 'fetchVideoInfo called but URL is empty');
      return;
    }

    this.api.log('INFO', `Requesting info for URL: ${this.url()}`);
    this.isFetchingInfo.set(true);
    this.status.set('Fetching video information...');
    this.videoInfo.set(null);

    try {
      const result = await this.api.getVideoInfo(this.url());
      this.isFetchingInfo.set(false);

      if (result.success) {
        this.api.log('INFO', `Successfully fetched info for: ${result.title}`);
        this.videoInfo.set(result);
        this.status.set('');
        if (result.formats && result.formats.length > 0) {
          this.selectedFormatId.set(result.formats[0].id);
        }
      } else {
        this.api.log('ERROR', `Failed to fetch video info: ${result.error}`);
        this.status.set(`Error: ${result.error}`);
      }
    } catch (err: any) {
      this.api.log('ERROR', 'Critical error in fetchVideoInfo', err.message);
      this.isFetchingInfo.set(false);
      this.status.set(`Critical Error: ${err.message}`);
    }
  }

  async selectDirectory() {
    if (!this.api) return;
    
    this.api.log('DEBUG', 'Opening directory selector');
    try {
      const path = await this.api.selectDirectory();
      if (path) {
        this.api.log('INFO', `Directory selected: ${path}`);
        this.outputPath.set(path);
        // Persist path
        await this.api.setConfig({ outputPath: path });
      } else {
        this.api.log('DEBUG', 'Directory selection cancelled');
      }
    } catch (err: any) {
      this.api.log('ERROR', 'Error in selectDirectory', err.message);
    }
  }

  async download() {
    if (!this.url() || !this.outputPath() || !this.api) {
      this.status.set('Please provide a URL and select an output path.');
      if (this.api) this.api.log('WARN', 'Download attempted with missing URL or output path');
      return;
    }

    this.api.log('INFO', `Starting download: ${this.url()} to ${this.outputPath()} (Format: ${this.selectedFormatId()})`);
    this.isDownloading.set(true);
    this.status.set('Download started...');
    this.progress.set({ percent: 0, speed: '', eta: '', totalSize: '' });

    try {
      const result = await this.api.downloadVideo({
        url: this.url(),
        outputPath: this.outputPath(),
        formatId: this.selectedFormatId()
      });

      if (result.success) {
        this.api.log('INFO', 'Download finished successfully');
        this.status.set('Download completed successfully!');
      } else {
        this.api.log('ERROR', `Download failed: ${result.error}`);
        this.status.set(`Error: ${result.error}`);
      }
    } catch (err: any) {
      this.api.log('ERROR', 'Critical error in download', err.message);
      this.status.set(`Critical Error: ${err.message}`);
    } finally {
      this.isDownloading.set(false);
    }
  }

  formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
