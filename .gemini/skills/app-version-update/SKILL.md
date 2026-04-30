---
name: app-version-update
description: Workflow for updating the application version across Electron, Angular, and UI files. Use when a user asks to bump the version, update the version number, or prepare a new release.
---

# App Version Update

This skill provides a concrete procedure for updating the application version in this specific repository. Versions must be kept in sync across the backend configuration, frontend configuration, and UI state.

## Procedure

1. **Update Root Package**: Modify the `version` field in `package.json` (Root Electron configuration).
2. **Update UI Package**: Modify the `version` field in `ui/package.json` (Angular frontend configuration).
3. **Update UI Display**: Modify the `appVersion` signal value in `ui/src/app/app.ts`. This value is displayed in the "About" modal.

## Verification

- Run `grep_search` for the new version string (e.g., `2.6.0`) to ensure all occurrences were updated.
- Verify that `package.json` and `ui/package.json` are consistent.
- Check `ui/src/app/app.ts` to ensure the `appVersion` signal matches the package versions.
