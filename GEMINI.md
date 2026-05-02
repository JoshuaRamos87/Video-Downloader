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

## Sub-Agent Orchestration & Workflow

To maintain context efficiency and project integrity, follow this tiered orchestration strategy when using sub-agents:

### 1. Specialized Agent Roles
- **`documentation-architect`**: Use for maintaining the project's knowledge base (`GEMINI.md`, `README.md`, `New-Requirements.MD`). It ensures documentation stays synced with code changes.
- **`developer-pro`**: Use for high-precision implementation of features, bug fixes, or UI components.
- **`build-specialist`**: Use exclusively to verify build status, resolve dependency conflicts, or fix configuration issues.
- **`test-engineer`**: Use to generate Vitest unit tests and ensure no regressions.
- **`angular-expert`**: Use for complex UI design or Signal-based state management.

### 2. Sequential "Pipeline" Orchestration
For major features or architectural changes, follow this 5-phase pipeline to ensure a "Verified Correct" and fully documented state:

1.  **Phase 1: Planning**: Invoke `documentation-architect` to outline the feature tasks in `New-Requirements.MD` and verify that the plan aligns with existing project rules.
2.  **Phase 2: Development**: Invoke `developer-pro` to implement the logic, UI, and IPC bridge according to the requirements, ensuring the code matches modern Angular and Electron standards.
3.  **Phase 3: Build Check**: Invoke `build-specialist` to run the project build, fix any compilation errors, and adjust configuration settings like CSS budgets if they cause failures.
4.  **Phase 5: Testing**: Invoke `test-engineer` to write tests(if needed) and run existing unit tests to verify the new feature works as expected and doesn't break existing functionality.
5.  **Phase 5: Review & Docs**: Invoke `documentation-architect` to check if the implementation matches the `New-Requirements.MD` list. If deviations are found, the architect must document them and report back to the Master Agent. The Master Agent will then decide to either send it back to Phase 2 for correction or update the user on this deviation to make the choice for the master agent. If compliant, update feature status and finalize documentation.

### 3. Reporting Protocol
Sub-agents must report a concise "Verification Summary" back to the main agent, including:
- **Build Status**: (e.g., "Build Successful" or "Failed with Error X").
- **Test Results**: (e.g., "All 5 tests passed").
- **Action Taken**: Brief summary of modified files.

The main agent (Orchestrator) is responsible for synthesizing these reports and providing the final update to the user. Do not return to the user until the Build Verification phase has passed.
