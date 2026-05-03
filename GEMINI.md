# Project Context: Video Downloader

## Overview
This project is a sleek, desktop-based utility designed to streamline the process of archiving online media content. It allows users to retrieve and save videos directly to their local machines with a focus on high performance and a distraction-free, modern interface.

### Technical Architecture
- **Desktop Shell:** Electron (cross-platform system access, local file writing).
- **Frontend:** Angular (responsive, modern UI).
- **Hybrid Download Engine:** - **Analysis Phase:** Uses `youtubei.js` (Innertube API) to fetch metadata and format lists reliably without triggering bot detection (403 Forbidden errors).
  - **Execution Phase:** Uses `yt-dlp` (via `youtube-dl-exec`) solely for downloading bitstreams and performing complex muxing (merging video and audio).

## Current Features

Based on the completed codebase review, the application currently features:

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
  - **Smart Playlist UI:** Automatically hides redundant download buttons and format selectors when downloading YouTube Music playlists, defaulting to the best available audio format.
  - **Clean File Naming:** Playlist downloads now use clean `Title.ext` naming conventions, while single downloads retain unique suffixes to prevent collisions.
  - Support for **Twitter / X** media extraction.
  - Support for **Reddit**, **TikTok**, and **Instagram** downloads is fully implemented.

## Sub-Agent Orchestration & Workflow

To maintain context efficiency and project integrity, follow this tiered orchestration strategy when using sub-agents:

### 1. Specialized Agent Roles
- **`documentation-architect`**: Use for maintaining the project's knowledge base (`GEMINI.md`, `README.md`, `New-Requirements.MD`).
- **`New-Requirements.MD` Lifecycle**: This file is a **transient, task-scoped checklist**. It MUST only contain requirements for the current task. Completed items are moved to `GEMINI.md` as "Current Features" during Phase 5, and the file is reset for the next task.
- **`developer-pro`**: Use for high-precision implementation of features, bug fixes, or UI components.
- **`build-specialist`**: Use exclusively to verify build status, resolve dependency conflicts, or fix configuration issues.
- **`test-engineer`**: Use to generate Vitest unit tests and ensure no regressions.
- **`angular-expert`**: Use for complex UI design or Signal-based state management.

### 2. Global Token Management (Anti-Exhaustion)
To prevent Context Window Exhaustion and reasoning degradation across the orchestration pipeline, agents MUST adhere to these operational limits:
- **The "Search/Replace" & File Creation Rule:** Sub-agents must never pass back entire existing code files. Modifications MUST use targeted Search/Replace blocks (e.g., `<<<< SEARCH` ... `>>>> REPLACE`). Do NOT attempt standard Git `.patch` formatting. **CRITICAL:** The `<<<< SEARCH` block must be an exact, character-for-character copy of the existing code, preserving all original indentation and blank lines to prevent automated diffing failures. If creating a brand new file, the agent must output the full file contents using exact `<<<< NEW FILE: path/to/file.ext >>>>` and `<<<< END NEW FILE >>>>` boundaries.
- **Ephemeral Scoping:** Sub-agents only receive the minimal file set required for their specific task, rather than the entire repository or chat history.

### 3. Sequential "Pipeline" Orchestration
The **Master Agent** serves as the primary orchestrator, managing the 5-phase pipeline to ensure a "Verified Correct" and fully documented state for all major features or architectural changes.

**MANDATORY TRIGGER:** Whenever the user explicitly requests a new task, feature, or significant codebase change, you MUST automatically initiate this 5-phase pipeline starting with Phase 1. Do not ask for permission to begin planning; immediately invoke the `documentation-architect` to outline the task in `New-Requirements.MD`.

1.  **Phase 1: Planning**: Invoke `documentation-architect` to outline the feature tasks in `New-Requirements.MD`. The architect is responsible for using `ask_user` to clarify any ambiguities or missing specifications before finalizing the checklist and verifying alignment with project rules.
    * **MANDATORY APPROVAL GATE:** After Phase 1 completes, the Master Agent MUST present the finalized `New-Requirements.MD` to the user and ask for explicit approval. Do NOT initiate Phase 2 until the user approves the plan.
2.  **Phase 2: Development**: Invoke `developer-pro` to implement the tasks outlined in `New-Requirements.MD`. 
    * **Code Modifications:** The agent MUST NOT output full existing files. All code modifications must be formatted as strict Search/Replace blocks using exact `<<<< SEARCH` and `>>>> REPLACE` boundaries. The 'Search' block must include enough surrounding lines of code to ensure a 100% unique match within the target Angular or Electron file.
    * **Uniqueness Pro-Tip:** To ensure a 100% match, the `<<<< SEARCH` block should ideally include at least one unique function name, variable definition, or structural landmark (like a class header) alongside the specific lines being changed.
    * **New Files:** If a new file is required, use the `<<<< NEW FILE: path/to/file >>>>` and `<<<< END NEW FILE >>>>` syntax.
    * **Dependencies:** If a new npm package is required, explicitly list the necessary `npm install <package>` command at the top of the response and **specify whether it should be a standard dependency or a `devDependency`** so the environment can be updated before proceeding.
3.  **Phase 3: Build Check**: Invoke `build-specialist` to run the project build. It is responsible for fixing "mechanical" errors (e.g., environment setup, dependency conflicts, CSS budgets). If a build failure is caused by an implementation error or logic flaw, it must generate a "Failure Report" and report back to the Master Agent to restart Phase 2.
    * **Explicit Build Commands:** Verify the environment by executing specific project scripts (e.g., `npm run build` or the dedicated Angular/Electron build commands defined in `package.json`) rather than guessing.
    * **Dependency Verification:** If a new module was introduced in Phase 2, the `build-specialist` must verify `package.json` integrity and check for peer dependency warnings.
    * **Protocol (Truncated Logs):** If a build fails, extract only the first 20 lines and the last 20 lines of the error trace, along with the triggering file path. Do NOT dump massive Angular compilation or TypeScript stack traces into the context.
    * **Circuit Breaker:** If Phase 3 fails three consecutive times, the Master Agent MUST pause the pipeline, present the failure logs to the user, and request manual intervention to prevent infinite failure loops.
4.  **Phase 4: Testing**: Invoke `test-engineer` to write tests (if needed) or run existing unit tests to verify the new feature works as expected. If tests fail due to implementation flaws, it must report back to the Master Agent to restart Phase 2.
    * **Protocol (Truncated Logs):** Report a concise Test Coverage Summary. Specific failure logs must use the strict 20-line head/tail truncation rule established in Phase 3.
    * **Circuit Breaker:** If Phase 4 fails three consecutive times, the Master Agent MUST pause the pipeline, present the failure logs to the user, and request manual intervention.
5.  **Phase 5: Review & Docs**: Invoke `documentation-architect` to review if the implementation matches the `New-Requirements.MD` list. If deviations are found, the `documentation-architect` must document them and report back to the Master Agent. The Master Agent will then decide to either approve the deviation or send it back to Phase 2 for correction. If compliant, update feature status, move completed specs **specifically to the "Current Features" section of this `GEMINI.md` document** (ensuring no orchestration rules are altered), and reset the requirements file.

### 4. Reporting Protocol
Sub-agents must report a concise "Verification Summary" back to the main agent, including:
- **Build Status**: (e.g., "Build Successful" or "Failed with Error X").
- **Test Results**: (e.g., "All 5 tests passed").
- **Action Taken**: Brief summary of modified files using Search/Replace targets or new file additions.

The main agent (Orchestrator) is responsible for synthesizing these reports and providing the final update to the user. Do not return to the user until the Build Verification phase has passed.