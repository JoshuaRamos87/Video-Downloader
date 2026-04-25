import { Component, signal, OnInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
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

  // Filters
  selectedExtension = signal<string>('All');
  selectedResolution = signal<string>('All');

  // Progress Info
  progress = signal({
    percent: 0,
    speed: '',
    eta: '',
    totalSize: ''
  });

  @HostListener('window:focus')
  async onWindowFocus() {
    if (this.api && !this.isDownloading() && !this.isFetchingInfo()) {
      try {
        const clipboardText = await this.api.readClipboard();
        if (clipboardText) {
          const trimmedText = clipboardText.trim();
          // Regex to check for a basic YouTube URL (including shorts)
          const isYouTubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/.test(trimmedText);

          if (isYouTubeUrl && this.url() !== trimmedText) {
            this.api.log('INFO', 'Auto-filling valid YouTube URL from clipboard on focus');
            this.url.set(trimmedText);
          }
        }
      } catch (err: any) {
        this.api.log('WARN', `Failed to read clipboard on focus: ${err.message}`);
      }
    }
  }

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
        this.selectedExtension.set('All');
        this.selectedResolution.set('All');
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

  get availableExtensions(): string[] {
    const info = this.videoInfo();
    if (!info || !info.formats) return ['All'];
    const exts = new Set<string>();
    info.formats.forEach((f: any) => exts.add(f.ext));
    return ['All', ...Array.from(exts).sort()];
  }

  get availableResolutions(): string[] {
    const info = this.videoInfo();
    if (!info || !info.formats) return ['All'];
    const res = new Set<string>();
    info.formats.forEach((f: any) => res.add(f.resolution));
    return ['All', ...Array.from(res).sort((a, b) => {
      // Basic sorting for resolutions like 1080p, 720p, etc.
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numB - numA;
    })];
  }

  get filteredFormats(): any[] {
    const info = this.videoInfo();
    if (!info || !info.formats) return [];

    const ext = this.selectedExtension();
    const res = this.selectedResolution();

    return info.formats.filter((f: any) => {
      const matchExt = ext === 'All' || f.ext === ext;
      const matchRes = res === 'All' || f.resolution === res;
      return matchExt && matchRes;
    });
  }

  onFilterChange() {
    const formats = this.filteredFormats;
    if (formats.length > 0) {
      // If selected format is not in the filtered list, select the first one
      if (!formats.find(f => f.id === this.selectedFormatId())) {
        this.selectedFormatId.set(formats[0].id);
      }
    } else {
      this.selectedFormatId.set('');
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
