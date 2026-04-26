const fs = require('fs');
let css = fs.readFileSync('ui/src/app/app.css', 'utf8');
css = css.replace('.slide-menu {\n  position: fixed;\n  top: 0;\n  left: -350px;\n  width: 350px;\n  height: 100%;\n  background: var(--bg-container);\n  border-right: 1px solid var(--border-color);\n  box-shadow: 4px 0 8px var(--shadow-light);\n  transition: left 0.3s ease;\n  z-index: 100;', '.slide-menu {\n  position: fixed;\n  top: 0;\n  left: -350px;\n  width: 350px;\n  height: 100%;\n  background: var(--bg-container);\n  border-right: 1px solid var(--border-color);\n  box-shadow: 4px 0 8px var(--shadow-light);\n  transition: left 0.3s ease;\n  z-index: 10001;');
fs.writeFileSync('ui/src/app/app.css', css);
