# Logging Contract Implementation Plan

## Phase 1: Enhanced UnifiedLogger (Backend)

### Update `server/utils/logging.js`:

```javascript
// Add level extraction from TYPE
async systemLog(logEntry) {
    const { TYPE, FROM, message, data = {} } = logEntry;
    
    // Extract level from TYPE suffix
    const { baseType, level } = this.parseTypeWithLevel(TYPE);
    
    let finalEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        TYPE: baseType,                    // Store base type
        LEVEL: level,                      // Explicit level
        FROM: this.validateFromFormat(FROM), // Validate module.function format
        message: message || '',
        data
    };
    
    // Use extracted level for console/file output
    this._logWithLevel(level, finalEntry);
}

parseTypeWithLevel(type) {
    const parts = type.split('_');
    const baseType = parts[0];
    const suffix = parts[1];
    
    const levelMap = {
        'ERROR': 'error',
        'WARN': 'warn', 
        'DEBUG': 'debug',
        'INFO': 'info'
    };
    
    return {
        baseType,
        level: levelMap[suffix] || 'info'  // Default to info
    };
}

validateFromFormat(from) {
    // Enforce module.function.details format
    const parts = from.split('.');
    if (parts.length < 2) {
        console.warn(`Invalid FROM format: ${from}. Expected: module.function[.details]`);
        return `unknown.${from}`;
    }
    return from;
}
```

## Phase 2: Enhanced Logging Client (Frontend) 

### Update `server/static/js/logger.js`:

```javascript
async function logApiError(errorData, responseText) {
    try {
        await fetch('/api/system-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                TYPE: 'API_ERROR',                    // Will auto-map to ERROR level
                FROM: 'frontend.api.loggedFetch',     // Clear module path
                message: `API Error: ${errorData.method} ${errorData.url}`,
                data: {
                    ...errorData,
                    responseText: responseText ? truncateOutput(responseText) : null,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    currentPage: window.location.pathname
                }
            })
        });
    } catch (logError) {
        console.warn('Failed to send error log to backend:', logError);
    }
}
```

## Phase 3: Update Specific Components

### System Commands:
```javascript
// In system command handling:
systemLog({
    TYPE: 'SYSTEM_ERROR', 
    FROM: 'system.command.execution',
    message: 'System command failed',
    data: { command, error: e.message }
});
```

## Phase 4: Migration Strategy

1. **Backward Compatibility**: Old TYPE formats continue to work, just default to INFO level
2. **Gradual Rollout**: Update high-traffic endpoints first (command/run, system logs) 
3. **Testing**: Verify log levels appear correctly in log viewer
4. **Documentation**: Update team on new logging conventions

## Benefits

- **Clear Error Levels**: API_ERROR → ERROR level, system warnings → WARN level
- **Traceable Origins**: module.function.details tells exactly where logs originate
- **Consistent Format**: All logs follow same TYPE_{LEVEL} and FROM conventions
- **Better Debugging**: Easier to filter and trace issues across components

### Client-Side Integration

- **`server/static/js/dashboard-client.js`**: Refactored to use `window.Logger`.
- **`server/static/js/command-runner.js`**: Refactored to use `window.Logger`.

### The New Central Logger
The `window.Logger` object provides the following methods:

- `Logger.log(level, from, message, details)`: The core logging function.
- `Logger.info(from, message, details)`: Shortcut for info-level logs.
- `Logger.warn(from, message, details)`: Shortcut for warning-level logs.
- `Logger.error(from, message, details)`: Shortcut for error-level logs.
- `Logger.executeCommandWithLogging(command, params)`: Wraps an API call with standardized logging.
- `Logger.displayUserError(message, details)`: Shows an error to the user and logs it.

The logger also automatically captures and reports:

1.  Unhandled JavaScript exceptions (`window.onerror`).
2.  Unhandled promise rejections (`unhandledrejection` event).

This ensures that all critical frontend errors are logged centrally.
