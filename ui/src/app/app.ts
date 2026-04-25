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
      // Listen for progress updates from Electron
      const api = (window as any).electronAPI;
      if (api) {
        api.onDownloadProgress((data: any) => {
          this.progress.set(data);
        });
      }
    }
  }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const api = (window as any).electronAPI;
      if (api) {
        // Load persisted output path
        const config = await api.getConfig();
        if (config.outputPath) {
          this.outputPath.set(config.outputPath);
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
    console.log('[ANGULAR] fetchVideoInfo called');
    if (!this.url() || !this.api) {
      console.warn('[ANGULAR] URL or API missing');
      return;
    }

    this.isFetchingInfo.set(true);
    this.status.set('Fetching video information...');
    this.videoInfo.set(null);

    try {
      const result = await this.api.getVideoInfo(this.url());
      this.isFetchingInfo.set(false);

      if (result.success) {
        this.videoInfo.set(result);
        this.status.set('');
        if (result.formats && result.formats.length > 0) {
          this.selectedFormatId.set(result.formats[0].id);
        }
      } else {
        this.status.set(`Error: ${result.error}`);
      }
    } catch (err: any) {
      console.error('[ANGULAR] Error in fetchVideoInfo:', err);
      this.isFetchingInfo.set(false);
      this.status.set(`Critical Error: ${err.message}`);
    }
  }

  async selectDirectory() {
    console.log('[ANGULAR] selectDirectory clicked');
    if (!this.api) {
      console.error('[ANGULAR] API not found');
      return;
    }
    try {
      const path = await this.api.selectDirectory();
      console.log('[ANGULAR] selectDirectory result:', path);
      if (path) {
        this.outputPath.set(path);
        // Persist path
        await this.api.setConfig({ outputPath: path });
      }
    } catch (err: any) {
      console.error('[ANGULAR] Error in selectDirectory:', err);
    }
  }

  async download() {
    if (!this.url() || !this.outputPath() || !this.api) {
      this.status.set('Please provide a URL and select an output path.');
      return;
    }

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
        this.status.set('Download completed successfully!');
      } else {
        this.status.set(`Error: ${result.error}`);
      }
    } catch (err: any) {
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
