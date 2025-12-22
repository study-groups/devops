# TERRAIN Module Migration Notes

## Deleted Files Status

The following files were removed as part of the modular architecture refactor:

### js/modules/iframes.js → js/core/terrain-bridge.js

**Status: FULLY MIGRATED**

All iframe management functionality has been migrated to `TERRAIN.Bridge`:

| Old Function | New Location |
|--------------|--------------|
| `IframeManager.handleMessage()` | `TERRAIN.Bridge.handleMessage()` |
| `IframeManager.getTargets()` | `TERRAIN.Bridge.getTargets()` |
| `IframeManager.get(id)` | `TERRAIN.Bridge.getTarget(id)` |
| `IframeManager.sendToNode()` | `TERRAIN.Bridge.sendToNode()` |
| `IframeManager.sendToTarget()` | `TERRAIN.Bridge.sendToTarget()` |
| `IframeManager.injectTokens()` | `TERRAIN.Bridge.injectTokens()` |
| `IframeManager.extractTokens()` | `TERRAIN.Bridge.extractTokens()` |

**Backwards Compatibility:** `TERRAIN.IframeManager` shim is provided in terrain-bridge.js for legacy code.

### js/core/auth.js

**Status: REMOVED (never integrated)**

This was a stub authentication module with placeholder implementations. It was never loaded by the bootloader or integrated into the main application flow. If authentication is needed in the future, implement as a separate module.

### js/core/router.js

**Status: REMOVED (optional feature)**

Hash-based client-side routing module. This was an optional feature for multi-page terrain apps. The current architecture uses modes and config-driven layouts instead of client-side routing. If needed, can be re-implemented as an optional plugin.

### js/core/skins.js

**Status: SUPERSEDED by mode system**

Skin functionality (discovery method, card appearance, token overrides) is now handled by:
- `js/core/mode.js` - Mode configuration and application
- `js/core/terrain-css.js` - Theme and token management
- Config files in `dist/modes/` - Mode-specific settings

## Refactoring Changes (Current Session)

1. **Centralized Constants** - Magic numbers moved to `Terrain.Config.constants`
2. **Registry Pattern** - Module init uses `TERRAIN.modules` registry
3. **Cleanup Handlers** - Canvas and Grid modules have `destroy()` methods
4. **Error Boundaries** - Module init wrapped in try/catch
5. **HTML Template** - Build system uses `core/templates/app.html`
6. **CSS Token Source** - `data/tokens.json` as single source of truth
7. **Strict Validation** - `terrain_config_validate_strict()` function added

## TUT → Terrain.Css.fab Migration

**Status: COMPLETED**

The TUT design panel module (2,983 lines, 104KB) has been consolidated into `Terrain.Css.fab`.

### Old Architecture
```
dist/modules/tut.js     (104KB) - Loaded conditionally
dist/modules/tut.css    (16KB)  - Loaded conditionally
TERRAIN.TUT.init()              - Initialized by bootloader
```

### New Architecture
```
js/core/terrain-css.js  (~800 lines) - Always loaded with core
Terrain.Css.fab.init()               - Initialized when designMode=true
```

### API Changes

| Old (TUT) | New (Terrain.Css) |
|-----------|-------------------|
| `TERRAIN.TUT.init()` | `Terrain.Css.fab.init()` |
| `TERRAIN.TUT.togglePanel()` | `Terrain.Css.fab.toggle()` |
| `TERRAIN.TUT.getToken(name)` | `Terrain.Css.tokens.get(name)` |
| `TERRAIN.TUT.setToken(name, val)` | `Terrain.Css.tokens.set(name, val)` |
| `TERRAIN.TUT.resetTokens()` | `Terrain.Css.tokens.reset()` |
| `TERRAIN.TUT.exportJSON()` | `Terrain.Css.fab._handleExportJSON()` |
| `TERRAIN.TUT.applyTheme(theme)` | `Terrain.Css.theme.apply(theme)` |

### Namespace Convention

Changed from `TERRAIN.CSS` (uppercase) to `Terrain.Css` (camelCase) for consistency with other modules.

Backwards compatibility alias provided: `TERRAIN.CSS = Terrain.Css`

### Files Removed
- `dist/modules/tut.js`
- `dist/modules/tut.css`
