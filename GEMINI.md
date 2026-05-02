# Project Context: Video Downloader

## Overview
This project is a sleek, desktop-based utility designed to streamline the process of archiving online media content. It allows users to retrieve and save videos directly to their local machines with a focus on high performance and a distraction-free, modern interface.

### Technical Architecture
- **Desktop Shell:** Electron (cross-platform system access, local file writing).
- **Frontend:** Angular (responsive, modern UI).
- **Hybrid Download Engine:** 
  - **Analysis Phase:** Uses `youtubei.js` (Innertube API) to fetch metadata and format lists reliably without triggering bot detection (403 Forbidden errors).
  - **Execution Phase:** Uses `yt-dlp` (via `youtube-dl-exec`) solely for downloading bitstreams and performing complex muxing (merging video and audio).

## Current Features

Based on the completed codebase review, the application currently features:

- **Format Selection & Filtering:** Users can paste a video URL and the UI displays available file types, sizes, and resolutions. Users can actively filter these formats by extension (e.g., MP4, WEBM) and resolution (e.g., 1080p, 720p).
- **Smart Configuration / Saved State:** The application remembers the user's preferred save location and theme between sessions.
- **Real-Time Download Progress:** A detailed progress monitor displays the download speed (MB/s), estimated time remaining (ETA), and a completion percentage/progress bar.
- **Automatic Muxing:** Seamlessly handles the merging of high-quality separate video and audio streams into a single output file to prevent quality loss.
- **Clipboard Monitoring:** The app automatically reads the clipboard on window focus and auto-fills the input if a supported video URL is detected.
- **Download History & Management:** A searchable history interface tracks all downloads. Users can copy original links, natively open the downloaded file's folder via OS integration, delete specific history items (and optionally the downloaded file itself), or wipe the entire history.
- **Theming:** Includes a robust theming engine supporting 'system', 'dark', 'light', 'sepia', 'dracula', and 'nord' themes.
- **Developer Tools:** A dedicated developer settings view that displays real-time, streaming backend logs in the UI.
- **Platform Support:** 
  - Optimized support for **YouTube** (full metadata retrieval, all quality levels).
  - Support for **Twitter / X** media extraction.
  - Support for **Reddit**, **TikTok**, and **Instagram** downloads is fully implemented.
