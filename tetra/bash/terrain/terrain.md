# terrain — UI Platform Build System

terrain builds HTML from JSON configuration. It handles templates, modes, themes, and asset bundling.

## Two Build Paths

### 1. App Build (`terrain build`)

For terrain-based applications with a `terrain.config.json`:

```bash
terrain build                        # build in current dir
terrain build ~/src/myapp            # build in specific dir
terrain build ~/src/myapp -o out.html  # custom output path
```

**Config format** (`terrain.config.json`):
```json
{
  "terrain": { "name": "My App" },
  "mode": "freerange",
  "theme": "dark",
  "layout": { "columns": "1fr" },
  "panels": [...],
  "scripts": ["app.js"],
  "styles": ["app.css"]
}
```

### 2. Doc Build (`terrain doc`)

For standalone JSON documents (used by tut):

```bash
terrain doc file.json                # output to stdout
terrain doc file.json -o out.html    # output to file
```

**Type detection** (in priority order):
1. `.metadata.type` field — explicit type
2. `.steps` array — guide
3. `.groups` array — reference
4. `.sections` array — thesis

## Templates

Templates live in `$TERRAIN_SRC/core/templates/`:

| Template | Used For | Layout |
|----------|----------|--------|
| `guide.html` | Step-by-step tutorials | Split panels (narrative + terminal) |
| `reference.html` | Reference documentation | Sidebar nav + scrollable content |
| `thesis.html` | Long-form research | Sidebar TOC + reading column |
| `app.html` | Full terrain applications | Configurable grid layout |

All doc templates embed the JSON as `window.TerrainDocument` for client-side rendering.

```bash
terrain templates list               # list available templates
terrain templates show guide         # view template source
```

## Modes

Modes define UI configuration presets stored in `$TERRAIN_SRC/dist/modes/`:

```bash
terrain modes list                   # list available modes
terrain modes show freerange         # view mode config
```

Available: freerange, guide, reference, control, deploy, thesis, site, dashboard.

## Themes

CSS themes stored in `$TERRAIN_SRC/dist/themes/`:

```bash
terrain themes list                  # list available themes
terrain themes show dark             # view theme CSS
```

Available: dark, amber, forest, midnight, etc.

## Local Development

```bash
terrain local ./myapp               # build + setup dist/ with symlinks
terrain local clean ./myapp         # remove dist/
```

Creates a dist/ directory with symlinked terrain assets, ready for `tsm start http dist/`.

## Commands

| Command | Description |
|---------|-------------|
| `terrain build [dir] [-o path]` | Build HTML from terrain.config.json |
| `terrain doc <file> [-o path]` | Build HTML from JSON document |
| `terrain local [dir]` | Setup dist/ for local development |
| `terrain local clean [dir]` | Remove dist/ |
| `terrain config validate [path]` | Validate terrain.config.json |
| `terrain config show [path]` | Pretty-print config |
| `terrain modes list` | List available modes |
| `terrain modes show <name>` | Show mode config |
| `terrain themes list` | List available themes |
| `terrain themes show <name>` | Show theme CSS |
| `terrain templates list` | List available templates |
| `terrain templates show <name>` | Show template source |
| `terrain doctor [dir]` | Check setup and dependencies |

## Design Tokens

`data/tokens.json` is the single source of truth for colors, typography, spacing, and other design primitives. These feed into both CSS custom properties and the token editor UI.

## Bundler

The bundler (`bundler/bundler.sh`) concatenates and wraps source files into distribution bundles:

```bash
bundler.sh build core              # build terrain core bundle
bundler.sh build <module>          # build specific module
bundler.sh build --all             # build everything
```

Wrapper types: none, iife, terrain-module, standalone, custom.
