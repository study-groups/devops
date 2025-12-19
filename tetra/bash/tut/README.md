# TUT - Tetra UI Toolkit

Design token management and tutorial generation for tetra.

## Quick Start

```bash
# Load module
source ~/tetra/tetra.sh

# Commands
tut source list              # List available sources
tut source build <name>      # Build tutorial HTML
tut doc serve                # Start preview server
tut doctor                   # Check environment
```

## Architecture

```
tut/
├── tut.sh              # Main CLI entry point
├── includes.sh         # Module loader
├── core/               # Bash CLI implementation
│   ├── source.sh       # tut source <verb>
│   ├── doc.sh          # tut doc <verb>
│   ├── recording.sh    # tut recording <verb>
│   ├── schema.sh       # tut schema <verb>
│   └── extra.sh        # tut extra <verb>
├── src/                # JS modules (bundled to dist/)
│   ├── themes.js       # Theme save/load/switch
│   ├── tokens.js       # CSS custom property management
│   ├── panel.js        # Design panel UI
│   ├── export.js       # JSON/CSS export
│   └── api.js          # Public API
├── dist/               # Bundled output
│   └── tut.js          # Combined JS for browser
├── templates/          # HTML/CSS templates
│   └── design-tokens.* # Standalone token editor
├── available/          # Tutorial source JSON files
└── schemas/            # JSON Schema definitions
```

## CLI Pattern

Resource-verb pattern (doctl-style):

```bash
tut <resource> <verb> [args]

# Resources: source, doc, recording, schema, extra
# Shortcuts: ls, b (build), s (serve), d (doctor)
```

## JS Modules (src/)

The `src/` directory contains modular JS that gets bundled:

| Module | Purpose |
|--------|---------|
| `themes.js` | Theme CRUD, built-in themes, localStorage |
| `tokens.js` | CSS variable management, defaults |
| `panel.js` | Design panel HTML generation |
| `export.js` | JSON/CSS/clipboard export |
| `fonts.js` | Google Fonts integration |
| `inspector.js` | Token value inspection |
| `api.js` | `window.TUT` public interface |

### Building dist/tut.js

```bash
# From terrain directory
./bundler/bundle.sh
```

## Refactor Suggestions

1. **Remove templates/design-tokens.js** - Superseded by src/ modules
2. **Consolidate schemas/** - Move to single schema file
3. **Split panel.js** - 30KB is too large, extract sections
4. **Add src/index.js** - Explicit module ordering for bundler
5. **TypeScript types** - Add .d.ts for API surface

## Dependencies

- bash 5.2+
- jq (JSON parsing)
- Python 3 (preview server)
