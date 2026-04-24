import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  url = signal('');
  outputPath = signal('');
  status = signal('');
  isDownloading = signal(false);

  async selectDirectory() {
    const api = (window as any).electronAPI;
    
    if (!api) {
      this.status.set('Error: electronAPI not found.');
      return;
    }

    try {
      const path = await api.selectDirectory();
      if (path) {
        this.outputPath.set(path);
      }
    } catch (err) {
      console.error('ANGULAR: IPC Call Failed:', err);
      this.status.set('Failed to open directory dialog.');
    }
  }

  async download() {
    if (!this.url() || !this.outputPath()) {
      this.status.set('Please provide a URL and select an output path.');
      return;
    }

    this.isDownloading.set(true);
    this.status.set('Downloading...');

    const result = await (window as any).electronAPI.downloadVideo({
      url: this.url(),
      outputPath: this.outputPath()
    });

    this.isDownloading.set(false);
    if (result.success) {
      this.status.set('Download completed successfully!');
    } else {
      this.status.set(`Error: ${result.error}`);
    }
  }
}
