# Left Zone Dock System

## Overview

This document describes the new unified dock system for the left workspace zone that organizes all panels into structured, manageable docks with the Panel Manager at the top.

## Architecture

### Core Components

1. **LeftZoneDockManager** (`LeftZoneDockManager.js`)
   - Manages the overall dock structure in the left zone
   - Creates and organizes docks according to predefined layout
   - Handles panel registration to appropriate docks

2. **LeftZoneDock** (within `LeftZoneDockManager.js`)
   - Individual dock implementation
   - Supports tabbed panels, collapse/expand functionality
   - Manages panel mounting and switching

3. **WorkspaceZone** (updated)
   - Enhanced to support dock-based rendering for left zone
   - Maintains compatibility with other zones
   - Provides integration points for external panel systems

4. **PanelIntegrationBridge** (`PanelIntegrationBridge.js`)
   - Bridges different panel systems (Redux, client panels, settings panels)
   - Handles automatic registration of panels to appropriate docks
   - Provides unified interface for panel management

## Dock Structure

The left zone is organized into 4 main docks:

### 1. Panel Manager Dock (Special)
- **ID**: `panel-manager-dock`
- **Purpose**: Houses the Panel Control Center
- **Behavior**: Always visible, non-collapsible, stays at top
- **Panels**: `panel-control-center`

### 2. Primary Tools Dock
- **ID**: `primary-dock`
- **Purpose**: Main workspace panels for daily use
- **Height**: 40% of available space
- **Panels**: `files`, `context`, `published-summary`
- **Collapsible**: Yes (default expanded)

### 3. Settings Dock  
- **ID**: `settings-dock`
- **Purpose**: Settings and style configuration
- **Height**: 30% of available space
- **Panels**: `design-tokens`, `theme-selector`, `css-settings`, `preview-settings`, `icons-panel`
- **Collapsible**: Yes (default expanded)

### 4. Development Dock
- **ID**: `development-dock`
- **Purpose**: Development and debugging tools  
- **Height**: 30% of available space
- **Panels**: `pdata-panel`, `dom-inspector`, `console-log-panel`
- **Collapsible**: Yes (default expanded)

### 5. Utilities Dock
- **ID**: `utilities-dock`
- **Purpose**: Secondary tools and utilities
- **Height**: 20% of available space
- **Panels**: `mount-info-panel`, `log-panel`, `plugins-panel`
- **Collapsible**: Yes (default collapsed)

## Panel Registration

Panels are automatically registered to their home docks based on:

1. **Panel ID matching** - Each panel ID is mapped to a specific dock
2. **Panel type** - Redux panels, client panels, settings panels
3. **Manual registration** - External systems can register panels to specific docks

### Supported Panel Types

- **Redux Panels**: PDataPanel, MountInfoPanel (from `redux/components/`)
- **Client Panels**: ContextPanel, FileBrowserPanel, etc. (from `client/panels/`)
- **Settings Panels**: DesignTokensPanel, etc. (from `client/settings/panels/`)
- **Sidebar Panels**: PublishedSummaryPanel (from `client/sidebar/panels/`)

## Features

### Multi-Panel Docks
- Docks can contain multiple panels
- Tab-based panel switching within docks
- Active panel management

### Collapse/Expand
- Individual dock collapse/expand
- Global collapse/expand all
- Persistent state (planned)

### Responsive Design
- Adapts to different screen sizes
- Optimized tab layout for mobile
- Flexible height allocation

### Integration
- Works with existing panel systems
- Backward compatibility maintained
- Unified panel management interface

## Usage

### Testing the System

In browser console (development environment):

```javascript
// Test dock system initialization
testDockSystem()

// Test dock interactions (collapse/expand)
testDockInteractions()

// Create a test panel
createTestPanel()

// Access dock manager
const dockManager = window.APP.workspaceZones['workspace-zone-left'].getDockManager()

// Access panel bridge
const bridge = window.APP.panelBridge
console.log(bridge.getDebugInfo())
```

### Manual Panel Registration

```javascript
// Register a panel to a specific dock
const bridge = window.APP.panelBridge
bridge.registerPanelToDock('my-panel', panelInstance, 'primary-dock')
```

### Dock Operations

```javascript
// Toggle specific dock
bridge.toggleDock('development-dock')

// Collapse all docks
bridge.collapseAllDocks()

// Expand all docks
bridge.expandAllDocks()
```

## Styling

The dock system uses CSS custom properties for theming:
- `--color-bg`, `--color-bg-alt`, `--color-bg-elevated` for backgrounds
- `--color-border` for borders
- `--color-text`, `--color-text-secondary` for text
- `--color-primary` for highlights
- Transition and spacing variables for animations

## Future Enhancements

1. **Persistent State**: Save dock states (collapsed/expanded) to localStorage
2. **Drag & Drop**: Allow panels to be moved between docks
3. **Custom Layouts**: User-configurable dock arrangements
4. **Panel Floating**: Detach panels from docks as floating windows
5. **Dock Resizing**: Allow users to resize dock heights
6. **Keyboard Shortcuts**: Quick dock/panel access via keyboard

## Files Created/Modified

### New Files
- `client/layout/LeftZoneDockManager.js` - Main dock management system
- `client/layout/left-zone-docks.css` - Dock system styles
- `client/layout/PanelIntegrationBridge.js` - Panel system integration
- `client/layout/test-dock-system.js` - Testing utilities
- `client/layout/LEFT_ZONE_DOCK_SYSTEM.md` - This documentation

### Modified Files
- `client/layout/WorkspaceZone.js` - Added dock system support
- `client/layout/workspace-layout.css` - Import dock styles
- `client/bootloader.js` - Updated zone initialization

## Integration Status

✅ **Completed**:
- Dock structure creation
- Panel Control Center integration
- Redux panel system bridging
- Basic panel registration
- Testing framework

🔄 **In Progress**:
- Standard panel registration
- System testing and validation

📅 **Planned**:
- Persistent state management
- Enhanced user interactions
- Performance optimizations