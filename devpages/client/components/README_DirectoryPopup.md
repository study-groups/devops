# DirectoryPopup Module

## Overview
The DirectoryPopup module provides a context popup for quick directory navigation, showing all sibling directories at the current level with the ability to quickly jump between them.

## Features
- **Smart Positioning**: Popup appears near clicked element
- **Visual Hierarchy**: Highlights currently selected directory
- **Quick Navigation**: Click any directory to navigate instantly  
- **Keyboard Support**: Press `Escape` to close
- **Click Outside**: Auto-dismisses when clicking elsewhere
- **Responsive Design**: Adapts to screen boundaries

## Usage

### Basic Implementation
```javascript
import { createDirectoryPopup } from '/client/components/DirectoryPopup.js';

// Initialize
const directoryPopup = createDirectoryPopup(eventBus);

// Show popup
directoryPopup.show(
    'blogs',                    // Currently selected directory
    ['blogs', 'images', 'docs'], // All sibling directories  
    'projects',                 // Parent path
    clickEvent                  // Original click event for positioning
);

// Hide popup
directoryPopup.hide();

// Cleanup
directoryPopup.destroy();
```

### Integration with PathManagerComponent
The PathManagerComponent automatically creates directory popups on:
- **Right-click** on directory options in dropdown
- **Double-click** on directory options in dropdown

Event handlers are attached during component render and cleaned up on destroy.

## API Reference

### Class: DirectoryPopup

#### Constructor
```javascript
new DirectoryPopup(eventBus)
```
- `eventBus`: Event bus instance for navigation events

#### Methods

**show(clickedDir, allDirs, parentPath, clickEvent)**
- `clickedDir`: Name of the currently selected directory
- `allDirs`: Array of all directory names at this level
- `parentPath`: Parent directory path (for navigation)
- `clickEvent`: Original click event for positioning

**hide()**
- Closes and removes the popup from DOM

**destroy()**
- Complete cleanup including event listeners

### Factory Function
```javascript
createDirectoryPopup(eventBus)
```
Returns a new DirectoryPopup instance.

## Styling
The popup uses inline styles for maximum compatibility:
- **Modern Design**: Rounded corners, subtle shadows
- **Clean Typography**: System fonts for consistency
- **Interactive States**: Hover effects and selection highlighting
- **Responsive**: Adapts to viewport boundaries

## Event Integration
- Emits `navigate:pathname` events through provided eventBus
- Handles `Escape` key and click-outside dismissal
- Integrates seamlessly with existing navigation system

## Future Enhancements
- Keyboard navigation (arrow keys)
- Search/filter within popup
- Custom styling themes
- Drag-and-drop support
- Icon customization 