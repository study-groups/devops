# Log Module

This directory contains the modular logging system for the application.

## Structure

- **core.js**: Core logging functionality (logMessage, clearLog, etc.)
- **state.js**: Log visibility state management (toggle, show/hide)
- **ui.js**: UI interactions for the log component (toolbar, buttons, resize)
- **cli.js**: CLI input handling for the log component
- **index.js**: Main entry point that imports and re-exports from other modules

## Usage

Import from the log module using the `$log` alias:

```javascript
import { logMessage, toggleLog } from "$log";

// Log a message
logMessage("This is a log message");

// Toggle log visibility
toggleLog();
```

## Features

- Text and JSON logging
- CLI input handling
- Log visibility toggling
- Log resizing
- Click-to-preview functionality 