import { Component, signal, computed, OnInit, Inject, PLATFORM_ID, HostListener, NgZone, effect, Renderer2, ElementRef } from '@angular/core';
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
  isSuccess = signal(false);
  isFetchingInfo = signal(false);
  toastMessage = signal('');

  // Settings and Theme State
  isSettingsOpen = signal(false);
  isHistoryOpen = signal(false);
  settingsView = signal<'main' | 'themes' | 'dev' | 'history'>('main');
  selectedTheme = signal<string>('system'); // 'system', 'dark', 'light', 'sepia', 'dracula', 'nord'
  osTheme = signal<string>('light');
  showDevLogs = signal(false);
  enableDownloadHistory = signal(true);
  appVersion = signal('3.0.0');
  showAboutModal = signal(false);
  logs = signal<any[]>([]);
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

  downloadHistory = signal<any[]>([]);
  historySearchQuery = signal<string>('');
  activeHistoryMenu = signal<string | null>(null);
  showWipeConfirm = signal(false);
  isWiping = signal(false);

  // Computed filtered history based on search query
  filteredDownloadHistory = computed(() => {
    const query = this.historySearchQuery().toLowerCase().trim();
    const history = this.downloadHistory();
    if (!query) return history;
    return history.filter(item => 
      item.title?.toLowerCase().includes(query)
    );
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
          
          const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
          const twitterRegex = /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.*\/status\/\d+/;
          const redditRegex = /^(https?:\/\/)?(www\.)?(reddit\.com|redd\.it)\//;
          const instagramRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\//;
          const tiktokRegex = /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)\//;

          const isVideoUrl = youtubeRegex.test(trimmedText) || 
                             twitterRegex.test(trimmedText) || 
                             redditRegex.test(trimmedText) ||
                             instagramRegex.test(trimmedText) ||
                             tiktokRegex.test(trimmedText);

          if (isVideoUrl) {
            this.ngZone.run(() => {
              if (this.url() !== trimmedText) {
                this.api.log('INFO', 'Auto-filling valid video URL from clipboard on focus');
                this.url.set(trimmedText);
                this.showToast('Auto-filled link from clipboard!');
              } else {
                this.api.log('DEBUG', 'URL already set, showing reminder toast');
                this.showToast('Link already in input!');
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
    private ngZone: NgZone,
    private renderer: Renderer2,
    private el: ElementRef
  ) {
    // Explicitly manage theme classes using an effect
    effect(() => {
      const className = this.themeClass();
      if (isPlatformBrowser(this.platformId)) {
        const themes = ['theme-dark', 'theme-light', 'theme-sepia', 'theme-dracula', 'theme-nord'];
        // Clean up existing theme classes
        themes.forEach(t => this.renderer.removeClass(this.el.nativeElement, t));
        // Apply the new theme class
        this.renderer.addClass(this.el.nativeElement, className);
        if (this.api) this.api.log('DEBUG', `Theme effect applied class: ${className}`);
      }
    });

    if (isPlatformBrowser(this.platformId)) {
      const api = (window as any).electronAPI;
      if (api) {
        api.log('INFO', 'Angular app initialized and connected to Electron');
        
        api.onDownloadProgress((data: any) => {
          this.ngZone.run(() => {
            this.progress.set(data);
          });
        });

        api.onNewLog((entry: any) => {
          this.ngZone.run(() => {
            this.logs.update(l => [...l, entry].slice(-1000));
            this.scrollToBottom();
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
        try {
          this.api.log('INFO', 'Loading configuration from Electron...');
          const config = await this.api.getConfig();
          
          this.ngZone.run(async () => {
            if (config.outputPath) {
              this.outputPath.set(config.outputPath);
            }
            
            if (config.theme) {
              this.api.log('INFO', `Setting theme from config: ${config.theme}`);
              this.selectedTheme.set(config.theme);
            } else {
              this.api.log('INFO', 'No theme found in config, using default (system)');
            }

            if (config.showDevLogs) {
              this.showDevLogs.set(true);
              const allLogs = await this.api.getAllLogs();
              this.logs.set(allLogs);
              this.scrollToBottom();
            }
            if (config.downloadHistory) {
              this.downloadHistory.set(config.downloadHistory);
            }
            if (config.enableDownloadHistory !== undefined) {
              this.enableDownloadHistory.set(config.enableDownloadHistory);
            }
          });
        } catch (err: any) {
          this.api.log('ERROR', `Failed to initialize app config: ${err.message}`);
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

  // Settings Navigation
  toggleSettings() {
    this.isSettingsOpen.update(v => !v);
    if (!this.isSettingsOpen()) {
      // Reset view when closing
      setTimeout(() => this.settingsView.set('main'), 300);
    }
  }

  toggleHistory() {
    this.isHistoryOpen.update(v => !v);
  }

  openSubmenu(view: 'themes' | 'dev' | 'history') {
    this.settingsView.set(view);
  }

  goBack() {
    this.settingsView.set('main');
  }

  getBreadcrumbs() {
    switch(this.settingsView()) {
      case 'themes': return 'Settings > Themes';
      case 'dev': return 'Settings > Developer';
      case 'history': return 'Settings > Download History';
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

  async toggleDownloadHistorySetting() {
    const newValue = !this.enableDownloadHistory();
    this.enableDownloadHistory.set(newValue);
    
    if (this.api) {
      const config = await this.api.getConfig();
      await this.api.setConfig({ ...config, enableDownloadHistory: newValue });
      this.api.log('INFO', `Download history visibility toggled: ${newValue}`);
      
      if (!newValue) {
        this.isHistoryOpen.set(false);
      }
    }
  }

  async toggleDevLogs() {
    const newValue = !this.showDevLogs();
    this.showDevLogs.set(newValue);
    
    if (this.api) {
      const config = await this.api.getConfig();
      await this.api.setConfig({ ...config, showDevLogs: newValue });
      this.api.log('INFO', `Developer logs toggled: ${newValue}`);
      
      if (newValue) {
        const allLogs = await this.api.getAllLogs();
        this.logs.set(allLogs);
        this.scrollToBottom();
      }
    }
  }

  private scrollToBottom() {
    if (this.showDevLogs()) {
      setTimeout(() => {
        const logContent = document.querySelector('.log-content');
        if (logContent) {
          logContent.scrollTop = logContent.scrollHeight;
        }
      }, 50);
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
    this.isSuccess.set(false);
    this.status.set('Download started...');
    this.progress.set({ percent: 0, speed: '', eta: '', totalSize: '' });

    try {
      const info = this.videoInfo();
      const selectedFormat = info?.formats?.find((f: any) => f.id === this.selectedFormatId());
      
      const result = await this.api.downloadVideo({
        url: this.url(),
        outputPath: this.outputPath(),
        formatId: this.selectedFormatId(),
        ext: selectedFormat?.ext
      });

      this.ngZone.run(async () => {
        if (result.success) {
          this.api.log('INFO', 'Download finished successfully');
          this.status.set('Download completed successfully! Click here to open folder.');
          this.isSuccess.set(true);

          // Add to history
          const info = this.videoInfo();
          if (info) {
            const newItem = {
              id: Date.now().toString(),
              title: info.title || 'Unknown Video',
              thumbnail: info.thumbnail || '',
              filePath: result.filePath || this.outputPath(),
              timestamp: Date.now(),
              originalUrl: this.url()
            };
            this.downloadHistory.update(h => [newItem, ...h]);
            
            // Save history to config
            const config = await this.api.getConfig();
            await this.api.setConfig({ ...config, downloadHistory: this.downloadHistory() });
          }
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

  openFolder() {
    if (this.api && this.outputPath()) {
      this.api.openPath(this.outputPath());
    }
  }

  openFileFolder(path: string) {
    if (this.api && path) {
      this.api.openPath(path);
    }
  }

  async deleteHistoryItem(id: string) {
    this.downloadHistory.update(h => h.filter(item => item.id !== id));
    if (this.api) {
      // Use the dedicated backend handler to ensure config.json is in sync
      await this.api.deleteHistoryItem(id);
      this.api.log('INFO', `History item ${id} deleted`);
    }
    this.activeHistoryMenu.set(null);
  }

  toggleHistoryMenu(event: Event, id: string) {
    event.stopPropagation();
    if (this.activeHistoryMenu() === id) {
      this.activeHistoryMenu.set(null);
    } else {
      this.activeHistoryMenu.set(id);
    }
  }

  @HostListener('document:click')
  closeMenus() {
    this.activeHistoryMenu.set(null);
  }

  async deleteFileWithHistory(item: any) {
    if (!this.api) return;
    
    this.api.log('INFO', `Attempting to delete file and history for item ID: ${item.id}`);
    const result = await this.api.deleteFile(item.id);
    
    if (result.success) {
      this.showToast('File moved to trash');
      // Only remove from history if the file operation actually worked
      await this.deleteHistoryItem(item.id);
    } else {
      this.api.log('ERROR', `Failed to delete file: ${result.error}`);
      this.showToast(`Error: ${result.error || 'Could not delete file'}`);
    }
  }

  async copyOriginalLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      this.showToast('Link copied to clipboard!');
      this.activeHistoryMenu.set(null);
      if (this.api) this.api.log('INFO', 'Original link copied to clipboard from history');
    } catch (err: any) {
      if (this.api) this.api.log('ERROR', `Failed to copy link: ${err.message}`);
      this.showToast('Failed to copy link');
    }
  }

  confirmWipeHistory() {
    this.showWipeConfirm.set(true);
  }

  cancelWipeHistory() {
    this.showWipeConfirm.set(false);
  }

  async wipeAllHistory() {
    if (!this.api || this.isWiping()) return;

    this.isWiping.set(true);
    this.api.log('INFO', 'Starting WIPE ALL HISTORY operation');

    try {
      const items = [...this.downloadHistory()];
      
      // Attempt to delete files for all history items
      for (const item of items) {
        try {
          await this.api.deleteFile(item.id);
        } catch (err) {
          // Ignore errors (e.g. file not found)
          this.api.log('DEBUG', `Skipping file deletion for ${item.id} during wipe`);
        }
      }

      // Clear history in config
      const config = await this.api.getConfig();
      await this.api.setConfig({ ...config, downloadHistory: [] });
      
      // Update local state
      this.ngZone.run(() => {
        this.downloadHistory.set([]);
        this.showWipeConfirm.set(false);
        this.isWiping.set(false);
        this.showToast('History wiped and files deleted!');
      });

      this.api.log('INFO', 'WIPE ALL HISTORY operation completed successfully');
    } catch (err: any) {
      this.api.log('ERROR', `Error during wipe operation: ${err.message}`);
      this.ngZone.run(() => {
        this.isWiping.set(false);
        this.showToast('Failed to complete wipe operation');
      });
    }
  }

  get availableExtensions(): string[] {
    const info = this.videoInfo();
    if (!info || !info.formats) return ['All'];
    const exts = new Set<string>();
    info.formats.forEach((f: any) => {
      if (f.ext !== 'mhtml') {
        exts.add(f.ext);
      }
    });
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

    const filtered = info.formats.filter((f: any) => {
      const matchExt = ext === 'All' || f.ext === ext;
      const matchRes = res === 'All' || f.resolution === res;
      return matchExt && matchRes;
    });

    const uniqueFormats = [];
    const seen = new Set();
    for (const f of filtered) {
      const key = `${f.resolution}-${f.ext}-${f.filesize}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFormats.push(f);
      }
    }

    return uniqueFormats;
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

  minimizeWindow() {
    if (this.api) this.api.windowMinimize();
  }

  maximizeWindow() {
    if (this.api) this.api.windowMaximize();
  }

  closeWindow() {
    if (this.api) this.api.windowClose();
  }
}
