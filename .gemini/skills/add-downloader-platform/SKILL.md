---
name: add-downloader-platform
description: Procedural guide for adding support for a new video platform (e.g., TikTok, Instagram, Reddit) to the application's modular downloader architecture. Use when a user requests to "add support for X" or "implement Y downloader".
---

# Add Downloader Platform

This skill provides the standard procedure for extending the application's multi-platform download capabilities. The architecture uses a Strategy/Factory pattern to isolate platform-specific logic.

## Procedure

### 1. Implement the Downloader Class
Create a new directory and class file: `src-electron/downloaders/{platform}/{platform}.downloader.ts`.
Implement the `BaseDownloader` interface from `src-electron/interfaces.ts`:

```typescript
import { BaseDownloader, VideoInfoResponse, DownloadRequest, DownloadProgress, DownloadResult } from '../../interfaces.js';

export class MyPlatformDownloader implements BaseDownloader {
  async getVideoInfo(url: string): Promise<VideoInfoResponse> {
    // 1. Validate URL
    // 2. Fetch metadata (Title, Thumbnail)
    // 3. Fetch formats (Resolution, Extension, Filesize)
    // 4. Return VideoInfoResponse
  }

  async downloadVideo(request: DownloadRequest, onProgress: (p: DownloadProgress) => void): Promise<DownloadResult> {
    // 1. Execute download (yt-dlp or direct stream)
    // 2. Track progress and call onProgress()
    // 3. Return absolute filePath on success
  }
}
```

### 2. Choose Retrieval Method
- **Standard (yt-dlp)**: Use for sites with complex DASH streams or many formats (Reddit, Instagram).
- **High-Resilience (Innertube)**: Use `youtubei.js` for YouTube to bypass 403 Forbidden errors.
- **Direct API (VxTwitter/FxTwitter)**: Use for platforms where `yt-dlp` is unreliable but public proxies exist.

### 3. Register in Factory
Update `src-electron/downloaders/downloader.factory.ts`:
1. Import the new downloader class.
2. Instantiate it as a static property.
3. Add a regex check to `getDownloader(url)` to route the URL to the new instance.

### 4. Update UI Auto-Paste
Update `ui/src/app/app.ts`:
1. Define a platform-specific regex constant (e.g., `instagramRegex`).
2. Add the regex test to the `isVideoUrl` check in the `onWindowFocus` listener.
3. This ensures clipboard content is automatically captured and analyzed when the user switches to the app.

## Common Patterns & Pitfalls

### Audio/Video Merging & Electron ASAR Packaging (CRITICAL)
When building the app for production, binaries imported from `node_modules` (like `ffmpeg-static` and `youtube-dl-exec`) are packaged inside the `app.asar` archive. Binaries **cannot** be executed from within an ASAR archive. You must fix the paths to point to the `app.asar.unpacked` directory:

```typescript
// Helper to fix paths when running from an ASAR archive
const fixPath = (p: string) => p.replace('app.asar', 'app.asar.unpacked');

const ytdlpBinary = fixPath(constants.YOUTUBE_DL_PATH);
const ytdl = create(ytdlpBinary);
const fixedFfmpegPath = fixPath(ffmpegPath);
```

When using `yt-dlp` for high-resolution streams that separate video and audio:
- Pass `ffmpegLocation: fixedFfmpegPath` in the flags.
- Set the `format` dynamically. Do not blindly append `+bestaudio/best` if the ID is already `'best'`:
  `format: formatId && formatId !== 'best' ? \`${formatId}+bestaudio/best\` : 'bestvideo+bestaudio/best'`

### 403 Forbidden Thumbnails
Instagram and other platforms often block direct hotlinking.
- **Fix**: Scan the `thumbnails` array provided by `yt-dlp` and pick the highest-resolution CDN link (usually the last entry), as primary links are often temporary.

### Absolute Paths
Always resolve the `finalPath` to an **absolute path** before returning it from `downloadVideo`.
- **Reason**: The "Show in folder" feature depends on an absolute path to highlight the file in Windows Explorer.

### Buffer Fragmentation
When parsing `yt-dlp` stdout for progress or filenames:
- Use `node:readline` to process output line-by-line. Standard `data` buffers can fragment multi-byte characters (like full-width pipes `｜`) or long paths, causing mangled data.
