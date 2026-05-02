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

Based on the completed requirements and implementation details, the application currently features:

- **Format Selection:** Users can paste a video URL and the UI will display all available file types, sizes, and resolutions, allowing for specific quality choices.
- **Smart Configuration / Saved State:** The application remembers the user's preferred save location between sessions so it doesn't need to be set every time.
- **Real-Time Download Progress:** A detailed progress monitor displays the download speed (MB/s), estimated time remaining (ETA), and a completion percentage/progress bar.
- **Automatic Muxing:** Seamlessly handles the merging of high-quality separate video and audio streams into a single output file to prevent quality loss.
- **Platform Support:** 
  - Optimized support for **YouTube** (full metadata retrieval, all quality levels).
  - Support for **Twitter / X** media extraction.
  - Support for Reddit, TikTok, and Instagram downloads is fully implemented.
