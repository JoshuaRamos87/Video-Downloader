const fs = require('fs');
let css = fs.readFileSync('ui/src/app/app.css', 'utf8');
css = css.replace('.custom-titlebar {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  width: 100%;\n  height: 32px;\n  background-color: var(--bg-main);\n  color: var(--text-main);\n  border-bottom: 1px solid var(--border-color);\n  -webkit-app-region: drag;\n  user-select: none;\n  z-index: 1000;', '.custom-titlebar {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  width: 100%;\n  height: 32px;\n  background-color: var(--bg-main);\n  color: var(--text-main);\n  border-bottom: 1px solid var(--border-color);\n  -webkit-app-region: drag;\n  user-select: none;\n  z-index: 50;');
fs.writeFileSync('ui/src/app/app.css', css);
