# PanelPopup System

The `panelPopup` system provides a specialized popup mechanism for opening panels as floating windows in DevPages.

## Overview

The `panelPopup` system is designed to work with the existing panel registry and allows any registered panel to be opened as a draggable, resizable popup window.

## Usage

### Basic Usage

```javascript
// Open a panel as a popup
window.panelPopup.show('panel-id');

// Open with custom options
window.panelPopup.show('dev-tools', {
    width: 800,
    height: 600,
    x: 100,
    y: 50
});
```

### Available Methods

- `show(panelId, options)` - Open a panel as a popup
- `close(popupId)` - Close a specific popup
- `closeAll()` - Close all open popups
- `isOpen(panelId)` - Check if a panel popup is already open
- `bringToFront(popupId)` - Bring a popup to the front
- `getByPanelId(panelId)` - Get popup data by panel ID
- `getAll()` - Get all active popups

### Options

The `show()` method accepts the following options:

- `width` (number) - Popup width in pixels (default: 600)
- `height` (number) - Popup height in pixels (default: 500)
- `x` (number) - Initial X position (default: 150)
- `y` (number) - Initial Y position (default: 100)
- `draggable` (boolean) - Allow dragging (default: true)
- `resizable` (boolean) - Allow resizing (default: true)
- `closable` (boolean) - Show close button (default: true)
- `title` (string) - Custom title (defaults to panel title)

## Keyboard Shortcuts

The system integrates with the keyboard shortcut system:

- `Ctrl+Shift+T` - Open DevTools panel popup

## Features

### Dragging
Popups can be dragged by their header. The header shows the panel title and close button.

### Resizing
Popups can be resized using the resize handle in the bottom-right corner.

### Z-Index Management
Popups automatically manage their z-index using the `zIndexManager` system.

### Panel Integration
Popups work with any panel registered in the `panelRegistry` that has a `component` property.

### Focus Management
Clicking on a popup brings it to the front automatically.

## Example

```javascript
// Open DevTools panel as a popup
window.panelPopup.show('dev-tools', {
    width: 800,
    height: 600,
    x: 100,
    y: 50
});

// Check if DevTools popup is open
if (window.panelPopup.isOpen('dev-tools')) {
    console.log('DevTools popup is already open');
}

// Close all popups
window.panelPopup.closeAll();
```

## Testing

Use the global test function to verify the system is working:

```javascript
// Test the panelPopup system
window.testPanelPopup();
```

## Integration with Existing Systems

The `panelPopup` system integrates with:

- **Panel Registry** - Uses registered panels from `panelRegistry`
- **Z-Index Manager** - Manages popup layering
- **Keyboard Shortcuts** - Provides Ctrl+Shift+T for DevTools
- **DevTools Panel** - Works with the existing DevTools panel component

## Styling

Popups use CSS custom properties for theming:

- `--panel-background` - Popup background color
- `--panel-border` - Popup border color
- `--panel-radius` - Popup border radius
- `--panel-shadow` - Popup box shadow
- `--panel-header-bg` - Header background color
- `--panel-text` - Text color
- `--panel-text-muted` - Muted text color
- `--panel-hover-bg` - Hover background color 