# Project Context: Video Downloader

## Overview
This project is a sleek, desktop-based utility designed to streamline the process of archiving online media content. It allows users to retrieve and save videos directly to their local machines with a focus on high performance and a distraction-free, modern interface.

### Technical Architecture
- **Desktop Shell:** Electron (cross-platform system access, local file writing).
- **Frontend:** Angular (responsive, modern UI).
- **Hybrid Download Engine:** - **Analysis Phase:** Uses `youtubei.js` (Innertube API) to fetch metadata and format lists reliably without triggering bot detection (403 Forbidden errors).
  - **Execution Phase:** Uses `yt-dlp` (via `youtube-dl-exec`) solely for downloading bitstreams and performing complex muxing (merging video and audio).

## Current Features
If needed, see [FEATURES.md](./FEATURES.md) for the full list of implemented features.

## Sub-Agent Orchestration & Workflow

To maintain context efficiency and project integrity, follow this tiered orchestration strategy when using sub-agents:

### 1. Specialized Agent Roles
- **`documentation-architect`**: Use for maintaining the project's knowledge base (`GEMINI.md`, `README.md`, `New-Requirements.MD`, `FEATURES.md`).
- **`New-Requirements.MD` Lifecycle**: This file is a **transient, task-scoped checklist**. It MUST only contain requirements for the current task. Completed items are moved to `FEATURES.md` during Phase 5, and the file is reset for the next task.
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
    * **MANDATORY APPROVAL GATE:** After Phase 1 completes, the Master Agent MUST notify the user that `New-Requirements.MD` has been updated and ask for explicit approval. **Do NOT repost the file content**; simply prompt the user to review the file on disk. Do NOT initiate Phase 2 until the user approves the plan.
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
5.  **Phase 5: Review & Docs**: Invoke `documentation-architect` to review if the implementation matches the `New-Requirements.MD` list. If deviations are found, the `documentation-architect` must document them and report back to the Master Agent. The Master Agent will then decide to either approve the deviation or send it back to Phase 2 for correction. If compliant, update feature status, move completed specs **specifically to the "Current Features" section of the `FEATURES.md` document** (ensuring no orchestration rules are altered), and reset the requirements file.

### 4. Reporting Protocol
Sub-agents must report a concise "Verification Summary" back to the main agent, tailored to their specific phase:
- **Phase 2 (Dev):** Reports "Action Taken" (files modified/created) and "Dependencies Required" (explicit npm commands).
- **Phase 3 (Build):** Reports "Build Status" (e.g., "Build Successful" or 20-line failure logs).
- **Phase 4 (Test):** Reports "Test Results" (e.g., "All tests passed" or coverage summary).

The main agent (Orchestrator) is responsible for synthesizing these reports and providing the final update to the user. Do not return to the user until the Build Verification phase has passed.