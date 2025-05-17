# DevPages Logging System

This directory contains the DevPages logging system, which consists of two main components:

1. **LogPanel** - A UI component for displaying log messages in the application
2. **ConsoleLogManager** - A console logging manager for browser console logs

## Console Log Manager

The `ConsoleLogManager.js` module provides enhanced browser console logging with structured filtering, performance timing, and a buffer of recent log messages. It's designed to work with the LogPanel and follows the same structured log format.

### Key Features

- **Structured Log Format** - Uses `[Level] [Type] [SubType]` format for all logs
- **Log Levels** - Supports DEBUG, INFO, WARN, ERROR, and TIMING levels
- **Timestamp Support** - Can display timestamps with all log messages
- **Type & Subtype Filtering** - Filter logs by type (e.g., `[API]`) and subtype (e.g., `[REQUEST]`)
- **Level Filtering** - Filter logs by level (e.g., show only ERRORs or exclude DEBUG)
- **Keyword Filtering** - Filter logs by included or excluded keywords
- **Performance Timing** - Track and display timing information
- **Silent Timers** - Measure performance without console output
- **Log Buffer** - Store recent log messages for later retrieval
- **Browser Integration** - All functionality is available on `window` for easy debugging

### Basic Usage

```javascript
// Basic logging with implicit INFO level
console.log('Simple message');
console.info('Info message');
console.debug('Debug message');
console.warn('Warning message');
console.error('Error message');
console.timing('Timing message'); // Special method for TIMING level

// Structured logging with [Type] [SubType]
console.log('[USER] User logged in');
console.log('[API] [REQUEST] GET /api/users');
console.log('[DATABASE] [QUERY] SELECT * FROM users');

// Object-based structured logging with explicit level
console.log({
  message: 'User logged in',
  level: 'DEBUG', // Supports DEBUG, INFO, WARN, ERROR, TIMING
  type: 'USER',
  subtype: 'LOGIN'
});
```

### Console Log Configuration

```javascript
// Enable/disable console logging
window.enableConsoleLogging(true); // true to persist setting
window.disableConsoleLogging(true);

// Check if logging is enabled
window.isConsoleLoggingEnabled();

// Enable/disable timestamps
window.enableTimestamps(true);
window.disableTimestamps(true);
window.areTimestampsEnabled();

// Level Filtering
window.setIncludeLevels(['INFO', 'WARN', 'ERROR'], true); // Show only these levels
window.setExcludeLevels(['DEBUG'], true); // Hide these levels

// Type & Subtype Filtering
window.setIncludeTypes(['USER', 'API'], true);
window.setExcludeTypes(['DEBUG'], true);
window.setIncludeSubtypes(['LOGIN'], true);
window.setExcludeSubtypes(['VERBOSE'], true);

// Keyword Filtering
window.setIncludeKeywords('error important', true);
window.setExcludeKeywords('minor trivial', true);

// Clear all filters
window.clearAllFilters(true);

// Get discovered types and subtypes
window.getDiscoveredTypes();
window.getDiscoveredSubtypes();
```

### Buffer Management

```javascript
// Get the log buffer
const logs = window.getLogBuffer();

// Clear the buffer
window.clearLogBuffer();

// Get buffer size
const size = window.getLogBufferSize();

// Register for buffer updates
window.registerOnBufferUpdate(function(newEntry) {
  console.log('New log entry:', newEntry);
});

// Unregister from buffer updates
window.unregisterOnBufferUpdate(callbackFunction);
```

### Performance Timing

```javascript
// Enable/disable performance logging
window.enablePerformanceLogging(true);
window.disablePerformanceLogging(true);
window.isPerformanceLoggingEnabled();

// Enable/disable detailed timing
window.enableDetailedTiming(true);
window.disableDetailedTiming(true);
window.isDetailedTimingEnabled();

// Create and use a timer (logs to console)
const timer = window.createTimer('MyOperation');
// ... do some work
timer.checkpoint('After first step');
// ... do more work
const duration = timer.end();

// Create and use a silent timer (doesn't log to console)
const silentTimer = window.createSilentTimer('SilentOperation');
// ... do some work
silentTimer.checkpoint('After first step');
// ... do more work
const duration = silentTimer.end(); // Records in history but doesn't log
silentTimer.log(); // Optionally log results with TIMING level

// Time a function
const timedFunction = window.timeFunction(myFunction, {
  name: 'MyFunction',
  logLevel: 'debug',
  thresholdMs: 100 // Only log if function takes longer than 100ms
});

// Get timing history
const timingData = window.getTimingHistory();

// Clear timing history
window.clearTimingHistory();

// Get timing report
const report = window.getTimingReport();

// Reset timers
window.resetTimers();
```

## Integration with LogPanel

The ConsoleLogManager is designed to work with the LogPanel component. The LogPanel uses the same log format with [Type] [SubType] tags, making it easy to correlate logs between the browser console and the LogPanel UI.

## Testing

You can test the ConsoleLogManager using the `test-console-manager.js` script:

```javascript
// In browser console
import '/client/log/test-console-manager.js';
window.testConsoleManager.runAllTests();
```

## Console Log Panel

The ConsoleLogPanel (`/client/settings/ConsoleLogPanel.js`) provides a UI for configuring the ConsoleLogManager. It allows users to:

1. Enable/disable console logging
2. Enable/disable timestamps
3. Configure performance timing
4. Set up log level filters (DEBUG, INFO, WARN, ERROR, TIMING)
5. Set up type and subtype filters
6. Set keyword filters
7. View and download the log buffer

## License

Internal use only - DevPages project 