# Three-Tier Logging System Examples

This document demonstrates the three distinct logging systems and how they work together:

1. **ConsoleLog**: Browser console logging with interception
2. **AppLog**: Application UI logging (LogPanel) 
3. **ApiLog**: PJA Game API communication logging

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ConsoleLog    │    │     AppLog      │    │     ApiLog      │
│                 │    │                 │    │                 │
│ Browser console │    │ UI LogPanel     │    │ API comms only  │
│ All log levels  │    │ Structured logs │    │ action/to/from/ │
│ Performance     │    │ Filtering       │    │ ttime/rtime     │
│ Timing info     │    │ Visual display  │    │ Pure protocol   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ TYPE Handlers   │
                    │                 │
                    │ Container switch│
                    │ API parsers     │
                    │ Message format  │
                    └─────────────────┘
```

## Basic Usage Examples

### 1. ConsoleLog - Browser Console Logging

```javascript
// Traditional console usage with interception
console.log('Simple message');                    // [DEVPAGES][GENERAL] Simple message [INFO]
console.log('[USER] User logged in');             // [DEVPAGES][USER] User logged in [INFO]
console.error('[SYSTEM] Critical error');         // [DEVPAGES][SYSTEM] Critical error [ERROR]

// Structured console logging
console.log({
  message: 'User action',
  level: 'DEBUG',
  type: 'USER',
  action: 'CLICK'
});
```

### 2. AppLog - Application UI Logging

```javascript
// LogPanel logging through LogCore
import { log } from '/client/log/index.js';

log({
  message: 'User clicked save button',
  source: 'UI',
  component: 'SAVE_DIALOG',
  level: 'INFO',
  type: 'USER', 
  action: 'CLICK',
  details: { buttonId: 'save', timestamp: Date.now() }
});
```

### 3. ApiLog - Pure API Communication

```javascript
// Pure API data (no level, no message formatting)
import { GameApiManager } from '/client/log/index.js';

const apiManager = new GameApiManager({ role: 'CLIENT' });

// Send API message
const sentEntry = apiManager.send('GAME_LOADED', 'HOST', { loadTime: 1.2 });
// Creates: { action: 'GAME_LOADED', from: 'CLIENT', to: 'HOST', ttime: 123.45, data: {...} }

// Receive API message  
const receivedEntry = apiManager.receive('SUBMIT_SCORE', 'CLIENT', { score: 1000 });
// Marks: { action: 'SUBMIT_SCORE', from: 'CLIENT', to: 'HOST', rtime: 125.67, duration: 2.22 }
```

## Unified System with TYPE Handlers

### Creating Loggers with TYPE Switching

```javascript
import { createLogger } from '/client/log/index.js';

// Create loggers for different components
const hostLogger = createLogger('HOST', 'GameManager');
const clientLogger = createLogger('CLIENT', 'GameEngine');
const serverLogger = createLogger('SERVER', 'ScoreService');
```

### TYPE Handlers in Action

**TYPE determines which parser handles the message:**

```javascript
// API TYPE - Uses PJA Game API Parser
hostLogger.log('INFO', 'API', 'SEND', 'Sending game command', {
  apiEntry: {
    action: 'GAME_STARTED',
    from: 'HOST',
    to: 'CLIENT',
    ttime: performance.now(),
    data: { gameId: 123 }
  }
});
// Result: [HOST][GameManager][API][SEND] HOST→CLIENT: GAME_STARTED [INFO]

// SYSTEM TYPE - Uses System Events Parser  
hostLogger.log('WARN', 'SYSTEM', 'ERROR', 'Configuration missing', {
  component: 'ConfigLoader',
  missing: ['apiKey', 'gameId']
});
// Result: [HOST][GameManager][SYSTEM][ERROR] [ConfigLoader] Configuration missing [WARN]

// USER TYPE - Uses User Actions Parser
clientLogger.log('INFO', 'USER', 'CLICK', 'Player clicked start', {
  userId: 'player123',
  buttonId: 'start-game'
});
// Result: [CLIENT][GameEngine][USER][CLICK] User player123: Player clicked start [INFO]
```

## PJA Game API Integration

### Simple Clean API (inspired by pjaSdk.module.js)

```javascript
// Create API logger for game client
const gameApi = DevPages.logging.pjaGameApi.createApiLogger('CLIENT', window.parent);

// Send game lifecycle events
gameApi.gameLoaded();           // Logs: [CLIENT][API][SEND] Sending GAME_LOADED to HOST [INFO]
gameApi.gameStarted();          // Logs: [CLIENT][API][SEND] Sending GAME_STARTED to HOST [INFO]  
gameApi.gameEnded(1000);        // Logs: [CLIENT][API][SEND] Sending GAME_ENDED to HOST [INFO]

// Send score
gameApi.submitScore(1500);      // Logs: [CLIENT][API][SEND] Sending SUBMIT_SCORE to SERVER [INFO]

// Manual API calls
gameApi.send('SET_VOLUME', 'HOST', { volume: 0.8 });
gameApi.receive('GET_USER', 'SERVER', { userId: 123 });
```

### Host Side API

```javascript
// Create API logger for game host
const hostApi = DevPages.logging.pjaGameApi.createApiLogger('HOST', gameWindow);

// Send commands to game
hostApi.send('PLAY_GAME', 'CLIENT');
hostApi.send('PAUSE_GAME', 'CLIENT');
hostApi.send('SET_VOLUME', 'CLIENT', { volume: 0.5 });

// Receive game events
window.addEventListener('message', (event) => {
  const { type, data } = event.data;
  hostApi.receive(type, 'CLIENT', data);
});
```

## Advanced Integration Examples

### 1. Game Loading Sequence

```javascript
// Host initiates game load
const hostLogger = createLogger('HOST', 'GameManager');
const hostApi = DevPages.logging.pjaGameApi.createApiLogger('HOST', gameIframe.contentWindow);

// Step 1: Host requests game load
hostLogger.system('INIT', 'Starting game load sequence');
const loadEntry = hostApi.send('PLAY_GAME', 'CLIENT', { gameId: 'puzzle123' });

// Step 2: Client receives and processes
const clientLogger = createLogger('CLIENT', 'GameEngine');
const clientApi = DevPages.logging.pjaGameApi.createApiLogger('CLIENT', window.parent);

window.addEventListener('message', (event) => {
  if (event.data.type === 'PLAY_GAME') {
    clientApi.receive('PLAY_GAME', 'HOST', event.data.data);
    clientLogger.lifecycle('LOADING', 'Game load started', event.data.data);
    
    // Simulate loading
    setTimeout(() => {
      clientLogger.lifecycle('LOADED', 'Game assets loaded');
      clientApi.gameLoaded();
    }, 1000);
  }
});

// Step 3: Host receives game loaded confirmation  
window.addEventListener('message', (event) => {
  if (event.data.type === 'GAME_LOADED') {
    hostApi.receive('GAME_LOADED', 'CLIENT');
    hostLogger.lifecycle('READY', 'Game is ready to play');
  }
});
```

### 2. Score Submission Flow

```javascript
// Client submits score
const clientLogger = createLogger('CLIENT', 'ScoreManager');
const clientApi = DevPages.logging.pjaGameApi.createApiLogger('CLIENT');

function submitPlayerScore(score) {
  clientLogger.user('SCORE', 'Player achieved score', { score, timestamp: Date.now() });
  
  // Log API submission
  clientApi.submitScore(score);
  
  // Also log to app for UI feedback
  clientLogger.system('API_CALL', 'Score submitted to server', { 
    score, 
    endpoint: '/api/scores',
    status: 'pending'
  });
}

// Server processes score
const serverLogger = createLogger('SERVER', 'ScoreService');

function processScore(scoreData) {
  serverLogger.api('RECEIVE', 'Score submission received', scoreData);
  
  // Validate score
  if (scoreData.score > 0) {
    serverLogger.lifecycle('VALIDATED', 'Score validation passed');
    serverLogger.api('RESPONSE', 'Score saved successfully', { scoreId: 'abc123' });
  } else {
    serverLogger.error('API', 'VALIDATION', 'Invalid score submitted', scoreData);
  }
}
```

### 3. Error Handling and Debugging

```javascript
// Debug API communication issues
const hostLogger = createLogger('HOST', 'Debugger');

// Enable API debugging
const gameApi = DevPages.logging.pjaGameApi.createApiLogger('HOST', gameWindow);

// Monitor API timing
const debugMessage = (action, to, data) => {
  const entry = gameApi.send(action, to, data);
  
  // Log timing info
  hostLogger.debug('API', 'TIMING', `Message sent: ${action}`, {
    sentAt: entry.ttime,
    target: to,
    payload: data
  });
  
  // Set timeout to detect unresponded messages
  setTimeout(() => {
    if (!entry.rtime) {
      hostLogger.warn('API', 'TIMEOUT', `No response to ${action}`, {
        sentAt: entry.ttime,
        elapsed: performance.now() - entry.ttime
      });
    }
  }, 5000);
};

// Usage
debugMessage('GET_USER', 'SERVER', { userId: 123 });
debugMessage('AUTHENTICATE', 'SERVER', { token: 'abc123' });
```

## Filtering and Analysis

### Console Filtering
```javascript
// Filter by TYPE
window.setIncludeTypes(['API', 'SYSTEM']);  // Only show API and SYSTEM logs
window.setExcludeLevels(['DEBUG']);         // Hide debug messages

// Filter API communications only
window.setIncludeKeywords('HOST→CLIENT CLIENT→HOST');
```

### AppLog Filtering  
```javascript
// Filter LogPanel by source and type
logPanel.updateTagsBar({
  activeFilters: {
    source: ['HOST'],
    type: ['API'],
    level: ['INFO', 'WARN', 'ERROR']
  }
});
```

### API Analysis
```javascript
// Get API statistics
const apiManager = new GameApiManager({ role: 'HOST' });
const stats = apiManager.getStats();

console.log('API Stats:', {
  totalMessages: stats.totalMessages,
  averageLatency: stats.averageDuration,
  topActions: Object.entries(stats.actionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5),
  unreceived: stats.unreceived
});
```

## Summary

This three-tier system provides:

1. **Separation of Concerns**: Each logging tier has a specific purpose
2. **TYPE-Based Parsing**: Container logs use TYPE to switch parsers for different message formats  
3. **Unified Interface**: Single `createLogger()` works across all tiers
4. **API Protocol Logging**: Pure communication data separate from presentation
5. **Backward Compatibility**: All existing logging continues to work
6. **Rich Debugging**: Cross-tier correlation and analysis capabilities 