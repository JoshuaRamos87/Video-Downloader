---
name: persist-feature-state
description: Procedural pattern for implementing persistent application settings/state using Angular Signals and Electron IPC. Use when adding new toggleable features, user preferences (e.g., "Enable History"), or persistent UI states that must survive application restarts.
---

# Persist Feature State

This skill outlines the standard 5-step pattern for adding persistent settings or state to the application. The architecture uses Angular Signals for reactive UI updates and Electron's `userData` directory for permanent JSON storage.

## Procedure

### 1. Update the Data Model
Add the new property to the `AppConfig` interface in `src-electron/interfaces.ts`. Always make new properties **optional** (`?`) to ensure backward compatibility with existing `config.json` files.

```typescript
// src-electron/interfaces.ts
export interface AppConfig {
  // ... existing fields
  myNewSetting?: boolean; 
}
```

### 2. Define the UI Signal
In the Angular component (`ui/src/app/app.ts`), add a new `signal` to manage the state. Initialize it with a sensible default.

```typescript
// ui/src/app/app.ts
export class App implements OnInit {
  myNewSetting = signal(true); // Default to true
  // ...
}
```

### 3. Load State on Initialization
Update the `ngOnInit` method in `app.ts` to fetch the configuration from Electron and update the signal.

```typescript
// ui/src/app/app.ts -> ngOnInit()
const config = await this.api.getConfig();
if (config.myNewSetting !== undefined) {
  this.myNewSetting.set(config.myNewSetting);
}
```

### 4. Implement the Persistence Method
Create a method in the component to toggle or update the setting. This method must update the signal and call `this.api.setConfig()` to write the change to disk.

```typescript
// ui/src/app/app.ts
async toggleMySetting() {
  const newValue = !this.myNewSetting();
  this.myNewSetting.set(newValue);
  
  if (this.api) {
    const currentConfig = await this.api.getConfig();
    await this.api.setConfig({ ...currentConfig, myNewSetting: newValue });
    this.api.log('INFO', `Setting 'myNewSetting' updated to: ${newValue}`);
  }
}
```

### 5. Add the UI Control
Update the template (`ui/src/app/app.html`) to include a control (e.g., a checkbox or button) that triggers the update method and reflects the signal state.

```html
<!-- ui/src/app/app.html -->
<label class="setting-item">
  <input type="checkbox" [checked]="myNewSetting()" (change)="toggleMySetting()">
  Enable My Awesome Feature
</label>
```

## Verification & Pitfalls

### Race Conditions
Always use the spread operator `{ ...currentConfig, key: value }` when calling `setConfig`. The backend's `saveConfig` function also performs a merge, but merging on the frontend ensures that you don't accidentally overwrite other settings if two updates happen in quick succession.

### Backward Compatibility
Existing users will have a `config.json` that lacks your new key. Always check for `undefined` when loading (Step 3) and provide a fallback or use the signal's default value.

### Type Safety
If the setting is complex (e.g., an object or array), ensure you update any related interfaces in `interfaces.ts` and use them consistently in the `App` component's signals.
