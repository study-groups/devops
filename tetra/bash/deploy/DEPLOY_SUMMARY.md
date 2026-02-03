# Tetra Deploy System - Quick Reference

## Core Concepts

```
ORG → TARGET → PIPELINE → ENV
     └─ tetra-deploy.toml defines all of these
```

**Address syntax:** `[org:]target[:pipeline][:{items}] env`

Examples:
- `deploy docs prod` - full pipeline to prod
- `deploy docs:gdocs prod` - gdocs pipeline
- `deploy docs:{index} prod` - just index file
- `deploy nodeholder:docs:full prod` - with org

## tetra-deploy.toml Structure

```toml
[target]
name = "myapp"
source = "dist/"           # local build output
cwd = "/home/{{user}}/app" # remote destination

[env.prod]
ssh = "root@1.2.3.4"
user = "appuser"           # file ownership
domain = "app.example.com"
confirm = true

[env.dev]
inherit = "prod"
ssh = "root@dev.example.com"
confirm = false

[files]
all = "*.html"
index = "index.html"
assets = "assets/**"

[build]
pre = "npm install"        # runs once before builds

[build.all]
command = "npm run build"

[build.index]
command = "npm run build:index"

[push]
method = "rsync"
options = "-avz --checksum"
chown = "www-data:www-data"

[pipeline]
default = ["build:all", "build:index", "push"]
quick = ["push"]           # skip build
```

## Template Variables

| Variable | Value |
|----------|-------|
| `{{ssh}}` | user@host |
| `{{user}}` | remote user |
| `{{cwd}}` | remote path |
| `{{source}}` | local source dir |
| `{{env}}` | environment name |
| `{{name}}` | target name |
| `{{domain}}` | domain if set |

## DevPages Architecture Pattern

DevPages is vanilla NodeJS + vanilla JS (not Svelte):

```
devpages/
├── client/              # Browser code (vanilla JS + ES modules)
│   ├── index.html       # Entry point
│   ├── bootloader.js    # App initialization
│   ├── appState.js      # State management
│   ├── components/      # UI components (vanilla JS)
│   ├── services/        # API clients
│   ├── panels/          # Panel components
│   ├── store/           # Redux store (optional)
│   └── styles/          # CSS
├── server/              # Express server
│   ├── server.js        # Entry point
│   ├── api/             # API routes
│   ├── routes/          # Page routes
│   └── middleware/      # Auth, etc.
├── env/                 # Environment configs
│   └── local.env
└── package.json
```

Key patterns:
- **ES Modules** in browser (`type="module"` in script tags)
- **Express** for server (not Vite/bundler)
- **S3/Spaces** for static asset publishing
- **No build step** for client (modules served directly)

## Migration: Svelte → Vanilla JS

1. **Remove Svelte compiler** - serve raw .js files
2. **Convert .svelte → .js** - use ES6 classes or factory functions
3. **Keep component structure** - one file per component
4. **Use DOM API directly** - `document.createElement()`, template literals
5. **State management** - Redux, or simple event bus + state object

### Component Pattern (Vanilla)

```javascript
// components/MyPanel.js
export class MyPanel {
  constructor(container, options = {}) {
    this.container = container;
    this.state = { count: 0 };
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="my-panel">
        <h2>Count: ${this.state.count}</h2>
        <button data-action="increment">+</button>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('[data-action="increment"]')
      ?.addEventListener('click', () => this.increment());
  }

  increment() {
    this.state.count++;
    this.render();
  }
}
```

### Server Pattern (Express)

```javascript
// server/server.js
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Serve client files directly
app.use(express.static(join(__dirname, '../client')));

// API routes
app.use('/api', apiRouter);

app.listen(3000);
```

## Deploy Integration

For vanilla JS apps, the deploy TOML is simpler (no build step):

```toml
[target]
name = "myapp"
source = "client/"
cwd = "/var/www/myapp"

[build]
# No build step needed - just push

[pipeline]
default = ["push"]
```

Or with optional minification:

```toml
[build.all]
command = "esbuild client/*.js --bundle --minify --outdir=dist/"

[pipeline]
default = ["build:all", "push"]
```

## File Locations

- **Deploy configs:** `$TETRA_DIR/orgs/<org>/targets/<target>/tetra-deploy.toml`
- **Deploy module:** `$TETRA_SRC/bash/deploy/`
- **Full spec:** `$TETRA_SRC/bash/deploy/DEPLOY_TOML_SPEC.md`
