# Video Downloader Implementation Details

This document outlines the high-resilience architecture used to bypass anti-bot measures and ensure stable metadata retrieval and downloading.

## 1. The Metadata Challenge
Standard tools like `yt-dlp` often fail during the "Analysis" phase (JSON dumping) because the platform detects the automated request and returns a `403 Forbidden` or empty data. 

## 2. The "Hybrid" Architecture
We solve this by separating the **Retrieval** from the **Execution**.

### Phase A: Resilient Analysis (youtubei.js)
Instead of asking `yt-dlp` for video info, we use `youtubei.js` (Innertube).
- **Mechanism:** It mimics internal API calls (from Android/iOS/Web clients).
- **Metadata:** Fetches Title, Thumbnails, and `streaming_data`.
- **Formats:** We extract the `itag` list from `streaming_data.adaptive_formats` and `streaming_data.formats`. This provides us with resolution labels, extensions, and exact file sizes without triggering bot detection.

### Phase B: Binary Download (yt-dlp)
We only use `yt-dlp` for the actual bitstream downloading.
- **Mechanism:** It handles complex muxing (merging video and audio) and provides real-time progress via `stdout`.
- **Command:** `yt-dlp -f <itag> <url> -o <path>`.

## 3. Crucial Implementation Steps

1. **Video ID Extraction:** Always extract the 11-character Video ID first. This prevents issues with long, messy URLs containing tracking tokens.
2. **Platform Injection:** In Angular, ensure you use `isPlatformBrowser` checks. Electron apps often use SSR (Prerendering), which crashes if you try to access `window.electronAPI` or the `window` object during the build phase.
3. **Relative Base Href:** For Electron to find built Angular assets, the `index.html` MUST use `<base href="./">` instead of `<base href="/">`.
4. **IPC Security:** Use a `preload.js` with `contextBridge` to expose only necessary functions to the UI. Never enable `nodeIntegration` in the renderer for security reasons.
5. **Progress Parsing:** Use regex to parse the `stdout` of the `yt-dlp` spawn process to provide the user with MB/s, ETA, and Percentage updates.

## 4. Required Dependencies
- `youtubei.js`: For metadata and format analysis.
- `youtube-dl-exec`: As a wrapper for the `yt-dlp` binary.
- `electron`: To provide the desktop shell and system access.
