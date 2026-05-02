---
name: angular-build-css-budget
description: Procedure for resolving Angular build errors when component styles (like themes) exceed the default CSS budget in angular.json. Use when 'ng build' fails with 'exceeded maximum budget'.
---

# Angular Build CSS Budget

As the application adds more visual themes and complex UI components, the compiled CSS for the main `App` component may exceed the default Angular "budget" (typically 10kB/20kB). This results in build failures.

## Trigger
- **Build Error**: `[ERROR] src/app/app.css exceeded maximum budget. Budget 20.00 kB was not met...`
- **Build Warning**: `[WARNING] src/app/styles/themes.css exceeded maximum budget...`

## Procedure

### 1. Identify Target Budgets
Open `ui/angular.json` and locate the `budgets` array within the `architect.build.configurations.production` section.

### 2. Increase anyComponentStyle Limits
Increase the `maximumWarning` and `maximumError` values for the `anyComponentStyle` type to accommodate the theme bundle.

**Recommended Settings**:
- `maximumWarning`: `30kB`
- `maximumError`: `50kB`

```json
{
  "type": "anyComponentStyle",
  "maximumWarning": "30kB",
  "maximumError": "50kB"
}
```

### 3. Verify Fix
Run the production build command to ensure the budget check passes:
```bash
npm run build --prefix ui
```

## Verification Checklist

- [ ] `ng build` completes without CSS budget errors.
- [ ] No new warnings appear for `anyComponentStyle`.
- [ ] Application themes load correctly in the browser/Electron.
