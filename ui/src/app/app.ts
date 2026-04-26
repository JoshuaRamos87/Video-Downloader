import { Component, signal, computed, OnInit, Inject, PLATFORM_ID, HostListener, NgZone, HostBinding } from '@angular/core';
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
  @HostBinding('class') get hostClass() {
    return this.themeClass();
  }

  url = signal('');
  outputPath = signal('');
  status = signal('');
  isDownloading = signal(false);
  isFetchingInfo = signal(false);
  toastMessage = signal('');

  // Settings and Theme State
  isSettingsOpen = signal(false);
  settingsView = signal<'main' | 'themes'>('main');
  selectedTheme = signal<string>('system'); // 'system', 'dark', 'light', 'sepia', 'dracula', 'nord'
  osTheme = signal<string>('light');
  private toastTimeout: any;

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

  // Computed theme class based on selection and OS setting
  themeClass = computed(() => {
    const theme = this.selectedTheme();
    if (theme === 'system') {
      return this.osTheme() === 'dark' ? 'theme-dark' : 'theme-light';
    }
    return `theme-${theme}`;
  });

  @HostListener('window:focus')
  @HostListener('focus')
  async onWindowFocus() {
    if (this.api && !this.isDownloading() && !this.isFetchingInfo()) {
      try {
        const clipboardText = await this.api.readClipboard();
        this.api.log('DEBUG', `Clipboard content on focus: ${clipboardText ? 'length ' + clipboardText.length : 'empty'}`);
        if (clipboardText) {
          const trimmedText = clipboardText.trim();
          // Regex to check for a basic YouTube URL (including shorts)
          const isYouTubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/.test(trimmedText);

          if (isYouTubeUrl) {
            this.ngZone.run(() => {
              if (this.url() !== trimmedText) {
                this.api.log('INFO', 'Auto-filling valid YouTube URL from clipboard on focus');
                this.url.set(trimmedText);
                this.showToast('Auto-filled YouTube link from clipboard!');
              } else {
                this.api.log('DEBUG', 'URL already set, showing reminder toast');
                this.showToast('YouTube link already in input!');
              }
            });
          }
        }
      } catch (err: any) {
        this.api.log('WARN', `Failed to read clipboard on focus: ${err.message}`);
      }
    }
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const api = (window as any).electronAPI;
      if (api) {
        api.log('INFO', 'Angular app initialized and connected to Electron');
        api.onDownloadProgress((data: any) => {
          this.ngZone.run(() => {
            this.progress.set(data);
          });
        });
      }

      // Listen for OS theme changes
      if (window.matchMedia) {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        this.osTheme.set(mql.matches ? 'dark' : 'light');
        mql.addEventListener('change', (e) => {
          this.ngZone.run(() => {
            this.osTheme.set(e.matches ? 'dark' : 'light');
          });
        });
      }
    }
  }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      if (this.api) {
        // Load persisted config
        const config = await this.api.getConfig();
        this.ngZone.run(() => {
          if (config.outputPath) {
            this.outputPath.set(config.outputPath);
            this.api.log('INFO', `Loaded output path from config: ${config.outputPath}`);
          }
          if (config.theme) {
            this.selectedTheme.set(config.theme);
            this.api.log('INFO', `Loaded theme from config: ${config.theme}`);
          }
        });
      }
    }
  }

  get api() {
    if (isPlatformBrowser(this.platformId)) {
      return (window as any).electronAPI;
    }
    return null;
  }

  // Settings Navigation
  toggleSettings() {
    this.isSettingsOpen.update(v => !v);
    if (!this.isSettingsOpen()) {
      // Reset view when closing
      setTimeout(() => this.settingsView.set('main'), 300);
    }
  }

  openSubmenu(view: 'themes') {
    this.settingsView.set(view);
  }

  goBack() {
    this.settingsView.set('main');
  }

  getBreadcrumbs() {
    switch(this.settingsView()) {
      case 'themes': return 'Settings > Themes';
      default: return 'Settings';
    }
  }

  async selectTheme(theme: string) {
    this.selectedTheme.set(theme);

    if (this.api) {
      const config = await this.api.getConfig();
      await this.api.setConfig({ ...config, theme: theme });
      this.api.log('INFO', `Saved theme preference: ${theme}`);
    }
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
      this.ngZone.run(() => {
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
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.api.log('ERROR', 'Critical error in fetchVideoInfo', err.message);
        this.isFetchingInfo.set(false);
        this.status.set(`Critical Error: ${err.message}`);
      });
    }
  }

  async selectDirectory() {
    if (!this.api) return;
    
    this.api.log('DEBUG', 'Opening directory selector');
    try {
      const path = await this.api.selectDirectory();
      if (path) {
        this.ngZone.run(async () => {
          this.api.log('INFO', `Directory selected: ${path}`);
          this.outputPath.set(path);
          // Persist path
          const config = await this.api.getConfig();
          await this.api.setConfig({ ...config, outputPath: path });
        });
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

      this.ngZone.run(() => {
        if (result.success) {
          this.api.log('INFO', 'Download finished successfully');
          this.status.set('Download completed successfully!');
        } else {
          this.api.log('ERROR', `Download failed: ${result.error}`);
          this.status.set(`Error: ${result.error}`);
        }
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.api.log('ERROR', 'Critical error in download', err.message);
        this.status.set(`Critical Error: ${err.message}`);
      });
    } finally {
      this.ngZone.run(() => {
        this.isDownloading.set(false);
      });
    }
  }

  get availableExtensions(): string[] {
    const info = this.videoInfo();
    if (!info || !info.formats) return ['All'];
    const exts = new Set<string>();
    info.formats.forEach((f: any) => exts.add(f.ext));
    return ['All', ...Array.from(exts).sort()];
  }

  showToast(message: string) {
    this.api.log('DEBUG', `Showing toast: ${message}`);
    this.ngZone.run(() => {
      this.toastMessage.set(message);
    });
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        this.toastMessage.set('');
      });
    }, 3000);
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
