# DevPages Logging System Migration Guide

This guide helps migrate from the current dual-track logging system to the harmonized unified logging approach that implements standards from documents 005.5.md, 006.md, and 007.md.

## Overview of Changes

### Standards Implemented

1. **005.5.md**: Removes subtypes, enforces `[SOURCE-Component][TYPE][ACTION]` format
2. **006.md**: Unified namespace structure with shared components
3. **007.md**: PJA Games SDK compatibility with frontmatter includes

### Format Evolution

**Before (Current)**:
```javascript
// Multiple inconsistent formats
console.log('[USER] User logged in');
console.log('[API] [REQUEST] GET /users');
logMessage('User action', 'INFO', 'USER');
```

**After (Harmonized)**:
```javascript
// Consistent [SOURCE][COMPONENT][TYPE][ACTION] format
const logger = DevPages.logging.createLogger('APP', 'UserManager');
logger.user('LOGIN', 'User logged in', { userId: 123 });
logger.api('REQUEST', 'GET /users', { endpoint: '/users' });
```

## Migration Steps

### Step 1: Include Unified Logging

Add to your HTML frontmatter or module imports:

```javascript
// As ES6 module
import { createLogger } from '/client/log/UnifiedLogging.js';

// Or as script include (007.md approach)
---
js_includes:
  - ../client/log/UnifiedLogging.js
---
```

### Step 2: Replace Existing Loggers

**Old ConsoleLogManager Pattern**:
```javascript
// Old way
window.consoleLogManager.log('info', ['User logged in']);
console.log('[USER] User logged in');
```

**New Unified Pattern**:
```javascript
// New way
const logger = DevPages.logging.createLogger('APP', 'UserManager');
logger.user('LOGIN', 'User logged in', { userId: 123 });
```

**Old LogCore Pattern**:
```javascript
// Old way
import { log } from '/client/log/LogCore.js';
log({ message: 'User action', level: 'INFO', type: 'USER' });
```

**New Unified Pattern**:
```javascript
// New way
const logger = DevPages.logging.createLogger('APP');
logger.user('ACTION', 'User action', { action: 'click' });
```

### Step 3: Update Log Format

**Subtype Removal (005.5.md)**:
```javascript
// OLD: Using subtypes (deprecated)
log({ type: 'USER', subtype: 'LOGIN', message: 'Login attempt' });

// NEW: Using actions
logger.user('LOGIN', 'Login attempt');
```

**Standard Actions (005.5.md)**:
```javascript
// Use standard action taxonomies
logger.lifecycle('LOADING', 'Application starting');
logger.lifecycle('STARTED', 'Application ready');
logger.state('IDLE', 'Waiting for user input');
logger.state('SET_VOLUME', 'Volume changed', { volume: 0.8 });
logger.api('REQUEST', 'Fetching user data');
logger.api('RESPONSE', 'User data received');
logger.system('INIT', 'Component initialized');
logger.user('LOGIN', 'User authenticated');
```

### Step 4: PJA Games SDK Integration (007.md)

For PJA Games SDK compatibility:

```javascript
// Host environment
const hostLogger = PjaGames.logging.createLogger('HOST', 'GameManager');
hostLogger.lifecycle('STARTED', 'Game host initialized');

// Client/game environment  
const gameLogger = PjaGames.logging.createLogger('GAME', 'GameSDK');
gameLogger.state('LOADED', 'Game assets loaded');

// Setup UI controls
PjaGames.logging.setupControls(hostLogger);
```

### Step 5: Configure Filters and Controls

**Console Filtering**:
```javascript
// Enable/disable specific types
DevPages.logging.config.standardTypes.LIFECYCLE.forEach(action => {
  console.log(`Standard LIFECYCLE action: ${action}`);
});

// Filter by source and type
logger.debug('API', 'REQUEST', 'Debug API call'); // Can be filtered out
logger.error('SYSTEM', 'ERROR', 'Critical failure'); // Always visible
```

**UI Controls Setup**:
```html
<!-- Add control buttons -->
<button data-action="app-log-clear">Clear Log</button>
<button data-action="app-log-copy">Copy Log</button>

<script>
// Setup controls for your logger
const logger = DevPages.logging.createLogger('APP');
DevPages.logging.setupControls(logger);
</script>
```

## Backward Compatibility

The unified system maintains backward compatibility:

```javascript
// Legacy functions still work
window.logMessage('Old format message', 'INFO', 'GENERAL');
window.directLog('INFO', 'SOURCE', 'TARGET', 'TYPE', 'ACTION', 'Message');

// Existing ConsoleLogManager functions
window.enableConsoleLogging();
window.getLogBuffer();
```

## Benefits After Migration

1. **Consistent Format**: All logs follow `[SOURCE][COMPONENT][TYPE][ACTION] message [LEVEL]`
2. **Better Filtering**: Precise filtering by source, type, and action
3. **IDE Support**: Autocompletion for standard actions
4. **Unified API**: Single logger works with both console and panel
5. **Performance**: Built-in timing and performance tracking
6. **Validation**: Warns about non-standard type/action combinations

## Common Migration Patterns

### Game Development (PJA Games)

```javascript
// Host side
const hostLogger = PjaGames.logging.createLogger('HOST', 'GameManager');
hostLogger.lifecycle('CONNECTED', 'Game client connected');
hostLogger.api('COMMAND', 'Sending game command', { command: 'start' });

// Game side  
const gameLogger = PjaGames.logging.createLogger('GAME', 'Engine');
gameLogger.lifecycle('LOADED', 'Game loaded successfully', { loadTime: 1.2 });
gameLogger.state('PLAYING', 'Game started');
gameLogger.user('SCORE', 'Player scored', { score: 1000 });
```

### DevPages Application

```javascript
// Different modules
const uiLogger = DevPages.logging.createLogger('UI', 'LogPanel');
const apiLogger = DevPages.logging.createLogger('API', 'DataService');
const sysLogger = DevPages.logging.createLogger('SYSTEM', 'Core');

// Usage
uiLogger.user('CLICK', 'User clicked button', { buttonId: 'save' });
apiLogger.api('REQUEST', 'Fetching data', { url: '/api/data' });
sysLogger.system('CONFIG', 'Configuration loaded', config);
```

## Troubleshooting

### Common Issues

1. **Action Validation Warnings**: Use standard actions from `DevPages.logging.config.standardTypes`
2. **Missing Logs**: Check that both `enableConsole` and `enablePanel` are true
3. **Format Confusion**: Use the new `[TYPE][ACTION]` instead of `[TYPE][SUBTYPE]`

### Debug Information

```javascript
// Check configuration
console.log(DevPages.logging.config);

// Verify logger setup
const logger = DevPages.logging.createLogger('TEST');
console.log(logger);

// Test logging
logger.system('TEST', 'Migration test message');
```

This migration preserves all existing functionality while providing a path toward the unified, standards-compliant logging system. 