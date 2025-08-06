# @devpages/debug

Debug tools and panels for DevPages development.

## Installation

This is an internal package developed within the DevPages project.

```javascript
import { initializeDebugPanels, DevToolsPanel } from '@devpages/debug';
```

## Features

- **StateKit DevTools**: Action history, time travel, performance monitoring
- **CSS Files Panel**: CSS debugging and analysis
- **DOM Inspector**: Real-time DOM inspection
- **JavaScript Info**: JavaScript debugging utilities
- **Panel System**: Debug panel registration and lifecycle

## Usage

### Initialize All Debug Panels
```javascript
import { initializeDebugPanels } from '@devpages/debug';

await initializeDebugPanels();
```

### Import Individual Panels
```javascript
import { DevToolsPanel, CssFilesPanel } from '@devpages/debug';
```

## Development

This package is developed in place within the DevPages project. All panels are integrated with the sidebar system via `WorkspaceManager`.

## Architecture

- `debugPanelInitializer.js` - Main initialization
- `devtools/` - StateKit integration and DevTools panel
- `panels/` - Individual debug panels
- `index.js` - Package exports

## Integration

Panels are registered with the sidebar system and managed by Redux state. No floating panels - everything integrates cleanly with the main UI.