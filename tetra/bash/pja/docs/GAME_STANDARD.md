# Pixeljam Arcade Web Platform Game Standard

## Overview

This document defines the standard for creating games for the Pixeljam Arcade Web Platform. All PJA games must follow these conventions to ensure proper integration with the host platform.

## Game Structure

### Directory Structure
```
admin/games/{game-name}/latest/
├── index.html          # Main game file (never in root slug directory)
├── {game-name}.css     # Game styles
├── {game-name}.js      # Game logic
├── manifest.json       # Game metadata
└── assets/             # Game assets (optional)
```

**Important**: The game's `index.html` must always be in a versioned subdirectory (e.g., `latest/`), never directly in the slug directory.

### Required Files

#### 1. index.html
Must include the PJA SDK:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Game Name</title>
    <link rel="stylesheet" href="your-game.css">
    <!-- PJA SDK for communication with the host platform -->
    <script src="/static/js/PjaSdk.js"></script>
</head>
<body>
    <div id="game-container">
        <!-- Your game content -->
    </div>
    <script src="your-game.js"></script>
</body>
</html>
```

#### 2. Game JavaScript Integration
All games must initialize the PJA SDK using the modular API:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    if (window.PJA) {
        // Initialize game with PJA host
        PJA.game.init({
            onReady: () => {
                console.log('Game connected to PJA host');
                PJA.game.setTitle('Your Game Title');
            },
            onTheme: (theme) => {
                console.log(`Theme changed to: ${theme}`);
            }
        });

        // Handle iframe messages from host
        PJA.iframe.on('custom-message', (data) => {
            console.log('Custom message from host:', data);
        });

        // Handle game-specific events
        PJA.game.on('ready', () => {
            console.log('Game is ready');
        });

        PJA.game.on('theme-changed', ({ theme }) => {
            console.log(`Game theme changed to: ${theme}`);
        });
    }
    
    // Your game initialization code here
});
```

## PJA SDK API


The PJA SDK is installed on `window.PJA` and provides a modular API with two main modules:

### PJA.game Module

The game module handles game-specific functionality and lifecycle:

#### `PJA.game.init(options)`
Initialize the game with PJA host:
- `options.onReady()` - Called when connected to host
- `options.onTheme(theme)` - Called when theme changes
- `options.onMessage(type, data)` - Called for custom messages (legacy)
- `options.onUnload()` - Called before page unloads
- `options.enableSecurity` - Enable domain validation (default: true)
- `options.autoSendTitle` - Auto-send title to host (default: true)
- `options.hideTitle` - Hide title elements in iframe (default: true)

#### `PJA.game.on(eventType, handler)`
Register handler for game events:
- `'ready'` - Game initialization complete
- `'theme-changed'` - Theme was updated
- Custom events emitted by your game
Returns unsubscribe function.

#### `PJA.game.emit(eventType, data)`
Emit custom game event to other handlers.

#### `PJA.game.setTitle(title)`
Send the game title to the host.

#### `PJA.game.setTheme(theme)`
Apply a theme to the game. Automatically sets `data-theme` attribute.

#### `PJA.game.getTheme()`
Get the current theme name.

#### `PJA.game.checkAuth()`
Check if user is authenticated. Returns a Promise that resolves to user object or null.

#### `PJA.game.log(message, level, data)`
Log activity for debugging and analytics.

### PJA.iframe Module

The iframe module handles communication with the host platform:

#### `PJA.iframe.on(eventType, handler)`
Register handler for messages from host:
- `'pja-set-theme'` - Theme change from host
- `'pja-ping'` - Connection test from host
- Custom message types from host
Returns unsubscribe function.

#### `PJA.iframe.send(type, data)`
Send message to the host platform.

#### `PJA.iframe.isReady()`
Check if iframe is ready for communication.

#### `PJA.iframe.getTheme()`
Get current theme from iframe context.

### Legacy Direct Access

For backward compatibility, these methods are available directly on `PJA`:

#### `PJA.init(options)` → `PJA.game.init(options)`
#### `PJA.sendMessage(type, data)` → `PJA.iframe.send(type, data)`
#### `PJA.sendTitle(title)` → `PJA.game.setTitle(title)`

### Theme System

Games automatically receive theme updates via the `onTheme` callback. The SDK:
1. Sets `data-theme` attribute on `document.documentElement`
2. Updates CSS custom property `--game-accent` if `--pja-primary` is available
3. Calls your `onTheme` callback for custom theme handling

### CSS Conventions

Use these CSS custom properties for theme integration:
```css
:root {
    --game-accent: var(--pja-primary, #4CAF50);
    --game-bg: var(--pja-bg, #000);
    --game-text: var(--pja-text, #fff);
}

/* Theme-specific styles */
[data-theme="matrix"] {
    --game-accent: #00ff41;
}

[data-theme="neon"] {
    --game-accent: #ff0080;
}
```

## Host Integration

### Iframe Standards

The host platform embeds games using iframes with these requirements:

#### HTML Structure
```html
<iframe 
    class="game-iframe" 
    name="game-iframe"
    src="/admin/games/{game-slug}/latest/"
    frameborder="0"
    allowfullscreen>
</iframe>
```

#### CSS Requirements
```css
.game-iframe {
    width: 100%;
    height: 100vh;
    border: none;
    background: #000;
}
```

### Message Protocol

Communication between host and game uses `postMessage` API:

#### Host → Game Messages
- `pja-set-theme` - Theme change notification
- `pja-ping` - Connection test
- Custom messages for game-specific features

#### Game → Host Messages  
- `pja-game-ready` - Game initialization complete
- `pja-title-update` - Title change notification
- `pja-asset-info` - Asset list for debugging
- `pja-game-log` - Activity logging
- `pja-pong` - Response to ping

### Security

The SDK includes domain validation to ensure games only run on authorized platforms:
- `pixeljamarcade.com`
- `dev.pixeljamarcade.com`
- `staging.pixeljamarcade.com`
- `localhost` (development)

Games running on unauthorized domains will show a security warning.

## Legacy Compatibility

The SDK provides backward compatibility with existing games:

### PJA_IFRAME_HELPER (Legacy)
```javascript
window.PJA_IFRAME_HELPER = {
    init: (options) => PJA.game.init(options),
    on: (eventType, handler) => PJA.iframe.on(eventType, handler),
    sendMessage: (type, data) => PJA.iframe.send(type, data),
    sendTitle: (title) => PJA.game.setTitle(title)
};
```

### PJA_GAME_API (Legacy)
```javascript
window.PJA_GAME_API = {
    checkAuth: () => PJA.game.checkAuth()
};
```

## Best Practices

1. **Always use the latest PJA SDK** - Include `/static/js/PjaSdk.js`
2. **Handle themes gracefully** - Implement `onTheme` callback
3. **Send meaningful titles** - Use descriptive game titles
4. **Log important events** - Use `PJA.game.log()` for debugging
5. **Test in standalone mode** - Games should work outside iframes for development
6. **Follow CSS conventions** - Use PJA theme variables
7. **Handle security** - Don't disable security checks in production

## Example Implementation

See the reference implementations:
- **Quadrapong**: `/playwright/server/static/games/quadrapong/`
- **PJA Docs**: `/src/routes/admin/games/pja-docs/latest/`

Both games demonstrate proper PJA SDK integration and theme handling.
