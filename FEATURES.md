## Current Features

Based on the completed codebase review, the application currently features:

- **Version 5.1.0:** Application updated to version 5.1.0.
- **In-App Video Playback:** Users can play downloaded videos directly within the application by clicking on their thumbnails in the history list. This feature uses a custom `media-loader://` protocol for secure, high-performance streaming of local files, supporting full seeking and playback controls.
- **Format Selection & Filtering:** Users can paste a video URL and the UI displays available file types, sizes, and resolutions. Users can actively filter these formats by extension (e.g., MP4, WEBM) and resolution (e.g., 1080p, 720p).
- **Format Preview:** Users can click a 'Preview' button on any format selection to open a native video player modal, allowing them to preview the specific format's video and audio quality before downloading.
- **Smart Configuration / Saved State:** The application remembers the user's preferred save location and theme between sessions.
- **Real-Time Download Progress:** A detailed progress monitor displays the download speed (MB/s), estimated time remaining (ETA), and a completion percentage/progress bar.
- **Video Preview on Hover:** Hovering over a video thumbnail (in both standard and sniffed results) triggers a live video preview, providing an instant glimpse of the content.
- **Automatic Muxing:** Seamlessly handles the merging of high-quality separate video and audio streams into a single output file to prevent quality loss.
- **Clipboard Monitoring:** The app automatically reads the clipboard on window focus and auto-fills the input if a supported video URL is detected.
- **Download History & Management:** A searchable history interface tracks all downloads. Users can copy original links, natively open the downloaded file's folder via OS integration, delete specific history items (and optionally the downloaded file itself), or wipe the entire history.
- **Batch Downloading & Playlists:** Supports downloading entire albums or playlists concurrently (up to 5 at a time), automatically organizing them into dedicated subfolders.
- **Theming:** Includes a robust theming engine supporting 'system', 'dark', 'light', 'sepia', 'dracula', and 'nord' themes.
- **Developer Tools:** A dedicated developer settings view that displays real-time, streaming backend logs in the UI.
- **Platform Support:** - Optimized support for **YouTube** (full metadata retrieval, all quality levels).
  - Specialized support for **YouTube Music** (album/playlist parsing, high-resolution album art extraction, automatic M4A conversion, and ID3 metadata tagging).
  - **Interactive Playlist Player:** YouTube Music playlists now feature an integrated audio player. Users can preview individual tracks with a dedicated play/pause button, or use the main playlist play button to toggle playback for the entire album. Includes a visual EQ animation for the currently playing track.
  - **Smart Playlist UI:** Automatically hides redundant download buttons and format selectors when downloading YouTube Music playlists, defaulting to the best available audio format.
  - **Clean File Naming:** Playlist downloads now use clean `Title.ext` naming conventions, while single downloads retain unique suffixes to prevent collisions.
  - Support for **Twitter / X** media extraction.
  - Support for **Reddit**, **TikTok**, and **Instagram** downloads is fully implemented.