/**
 * @file enhanced-logging.js
 * @description A comprehensive logging utility for the PJA dashboard.
 * This script should be loaded in any HTML document that needs to send structured logs to the server.
 * It provides a global `EnhancedLogging` object with methods for different log levels (info, warn, error)
 * and handles unhandled promise rejections and JavaScript errors.
 */

window.APP = window.APP || {};

(function() {
    'use strict';

    const LOG_LEVELS = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3
    };

    let currentLogLevel = LOG_LEVELS.INFO;
    let logBuffer = [];
    const MAX_LOG_BUFFER = 100;

    // Configure based on environment
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
        currentLogLevel = LOG_LEVELS.DEBUG;
    }

    /**
     * Enhanced fetch wrapper with comprehensive logging and error handling
     */
    async function loggedFetch(url, options = {}, context = {}) {
        const startTime = Date.now();
        const requestId = generateRequestId();
        const logContext = {
            requestId,
            url,
            method: options.method || 'GET',
            context: context.component || 'unknown',
            ...context
        };

        // Log request start
        log('DEBUG', `API Request: ${logContext.method} ${url}`, {
            ...logContext,
            phase: 'start',
            body: options.body ? JSON.parse(options.body) : undefined
        });

        try {
            const response = await fetch(url, options);
            const duration = Date.now() - startTime;
            const success = response.ok;

            // Enhanced response logging
            const responseLog = {
                ...logContext,
                phase: 'complete',
                status: response.status,
                statusText: response.statusText,
                duration: `${duration}ms`,
                success
            };

            if (success) {
                log('INFO', `API Success: ${logContext.method} ${url} (${response.status})`, responseLog);
            } else {
                log('ERROR', `API Error: ${logContext.method} ${url} (${response.status})`, responseLog);
                
                // Send API error to backend for centralized logging
                logApiError(responseLog, await getResponseText(response));
            }

            return response;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorLog = {
                ...logContext,
                phase: 'error',
                duration: `${duration}ms`,
                error: error.message,
                errorType: error.name
            };

            log('ERROR', `API Exception: ${logContext.method} ${url}`, errorLog);
            
            // Send network error to backend
            logApiError(errorLog, null);
            
            throw error;
        }
    }

    /**
     * Enhanced command execution with comprehensive logging
     */
    async function executeCommandWithLogging(command, options = {}) {
        const context = {
            component: options.component || 'command-runner',
            commandType: options.type || 'unknown',
            environment: options.environment || 'dev',
            command: truncateCommand(command)
        };

        log('INFO', `Executing ${context.commandType} command`, context);

        try {
            let apiUrl, requestBody;
            
            if (context.commandType === 'system') {
                apiUrl = '/api/system/run';
                requestBody = { command, type: 'system' };
            } else {
                apiUrl = '/api/command/run';
                requestBody = { command, env: context.environment };
            }

            const response = await loggedFetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }, context);

            const result = await response.json();
            const success = response.ok && result.success !== false;
            
            // Handle specific HTTP status codes
            if (response.status === 409) {
                // Conflict - test already running - don't log to console, let UI handle it
                const conflictError = new Error(result.error || 'A test run is already in progress.');
                conflictError.statusCode = 409;
                conflictError.type = 'CONFLICT';
                conflictError.suppressConsoleLog = true; // Flag to suppress console logging
                throw conflictError;
            }

            // Enhanced result logging
            const resultContext = {
                ...context,
                success,
                activityId: result.activityId,
                statusCode: response.status
            };

            if (success) {
                log('INFO', `Command completed successfully`, {
                    ...resultContext,
                    result: truncateOutput(result)
                });
            } else {
                // Don't log 409 conflicts to console - let UI handle them
                if (response.status !== 409) {
                    log('ERROR', `Command failed: ${result.error || 'Unknown error'}`, {
                        ...resultContext,
                        error: result.error,
                        hint: result.hint
                    });
                    // Also send this failure to the backend system log
                    logToServer('COMMAND_ERROR', `command.execution.${context.commandType}`, `Command failed: ${result.error || 'Unknown error'}`, {
                        ...resultContext,
                        error: result.error,
                        hint: result.hint
                    });
                }
            }

            return { response, result, success };

        } catch (error) {
            // Don't log 409 conflicts to console - let UI handle them
            if (error.statusCode !== 409 && !error.suppressConsoleLog) {
                log('ERROR', `Command execution failed: ${error.message}`, {
                    ...context,
                    error: error.message,
                    errorType: error.name
                });
                // Also send this failure to the backend system log
                logToServer('COMMAND_ERROR', `command.execution.${context.commandType}`, `Command execution exception: ${error.message}`, {
                    ...context,
                    error: error.message,
                    errorType: error.name
                });
            }
            throw error;
        }
    }

    /**
     * Send API errors to backend for centralized logging
     */
    async function logApiError(errorData, responseText) {
        try {
            // Don't log errors for the logging endpoint itself
            if (errorData.url && (errorData.url.includes('/api/system-logs') || errorData.url.includes('/api/logs/system'))) {
                return;
            }

            await fetch('/api/logs/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level: 'ERROR',           // Clear log level
                    type: 'API',             // Log category (API, SERVER, etc.)
                    from: `frontend.api.${errorData.context || 'unknown'}`,
                    message: `API Error: ${errorData.method} ${errorData.url} (${errorData.status})`,
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

    /**
     * Generic client-side logger that sends data to the backend system log.
     */
    async function logToServer(level, from, message, data = {}) {
        // Ensure data is a plain object before sending
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            console.warn(`Sanitizing invalid data for log entry from "${from}". Expected an object, but received:`, data);
            data = { value: data }; // Wrap non-object data
        }

        // Validate inputs before sending
        if (!level || !message) {
            console.warn('logToServer called with missing level or message:', { level, from, message });
            return;
        }

        // Construct payload explicitly
        const payload = {
            level: level.toUpperCase(),   // Clear log level (ERROR, WARN, INFO, etc.)
            type: data.type || 'SERVER',  // Log category 
            from: from,
            message: message,
            data: {
                ...data,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                currentPage: window.location.pathname
            }
        };
        
        try {
            const response = await fetch('/api/logs/system', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        } catch (logError) {
            console.warn(`Failed to send log [${level}] to backend:`, logError);
            
            // Try to log this failure locally if possible
            log('ERROR', `Failed to send log to backend: ${logError.message}`, {
                originalLevel: level,
                originalFrom: from,
                originalMessage: message,
                error: logError.message,
                component: 'logger'
            });
        }
    }

    /**
     * Core logging function with buffering and console output
     */
    function log(level, message, data = {}) {
        const numericLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
        
        if (numericLevel > currentLogLevel) {
            return; // Skip if below threshold
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            component: data.component || 'frontend'
        };

        // Add to buffer
        logBuffer.push(logEntry);
        if (logBuffer.length > MAX_LOG_BUFFER) {
            logBuffer.shift();
        }

        // Console output with enhanced formatting
        const emoji = getLogEmoji(level);
        const timeStr = new Date().toLocaleTimeString();
        
        if (level === 'ERROR') {
            console.error(`${emoji} ${timeStr} [${data.component || 'Frontend'}] ${message}`, data);
        } else if (level === 'WARN') {
            console.warn(`${emoji} ${timeStr} [${data.component || 'Frontend'}] ${message}`, data);
        } else {
            console.log(`${emoji} ${timeStr} [${data.component || 'Frontend'}] ${message}`, data);
        }

        // Trigger UI updates if logging components are available
        if (window.APP && window.APP.bus) {
            window.APP.bus.emit('log:entry', logEntry);
        }
    }

    /**
     * User-friendly error display with technical details
     */
    function displayUserError(userMessage, technicalData = {}) {
        const errorId = generateRequestId();
        
        log('ERROR', `User Error: ${userMessage}`, {
            ...technicalData,
            errorId,
            userFacing: true
        });

        // Display in UI if possible
        if (window.DevWatch && typeof window.DevWatch.addLogEntry === 'function') {
            window.DevWatch.addLogEntry(userMessage, 'error', {
                errorId,
                data: 'Check browser console for technical details'
            });
        }

        // Fallback to alert for critical errors
        if (technicalData.critical) {
            alert(`Error: ${userMessage}\n\nError ID: ${errorId}\nPlease check the console for technical details.`);
        }

        return errorId;
    }

    /**
     * Network connectivity and API health checker
     */
    async function checkApiHealth() {
        const healthChecks = [
            { name: 'Health Check', url: '/health' },
            { name: 'System Environment', url: '/api/system/environment' },
            { name: 'System Stats', url: '/api/stats' }
        ];

        const results = [];
        
        for (const check of healthChecks) {
            try {
                const response = await fetch(check.url, { 
                    method: 'GET',
                    timeout: 5000 
                });
                
                results.push({
                    name: check.name,
                    url: check.url,
                    status: response.status,
                    success: response.ok,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                results.push({
                    name: check.name,
                    url: check.url,
                    status: 0,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        log('INFO', 'API Health Check Complete', { results });
        return results;
    }

    // Utility functions
    function generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function getLogEmoji(level) {
        const emojis = {
            ERROR: '❌',
            WARN: '⚠️',
            INFO: 'ℹ️',
            DEBUG: '🔍'
        };
        return emojis[level] || '📝';
    }

    function truncateCommand(command) {
        if (typeof command !== 'string') return command;
        return command.length > 100 ? command.slice(0, 100) + '...' : command;
    }

    function truncateOutput(output) {
        if (typeof output === 'object') {
            return JSON.stringify(output).length > 500 ? 
                JSON.stringify(output).slice(0, 500) + '...' : output;
        }
        if (typeof output === 'string') {
            return output.length > 500 ? output.slice(0, 500) + '...' : output;
        }
        return output;
    }

    async function getResponseText(response) {
        try {
            const clone = response.clone();
            return await clone.text();
        } catch {
            return null;
        }
    }



    // Public API
    const publicApi = {
        log,
        logToServer, // Retaining for internal use if needed, but prefer level-methods.
        loggedFetch,
        executeCommandWithLogging,
        displayUserError,
        checkApiHealth,
        getLogBuffer: () => [...logBuffer],
        setLogLevel: (level) => { 
            if (LOG_LEVELS[level] !== undefined) {
                currentLogLevel = LOG_LEVELS[level];
                log('INFO', `Log level set to ${level}`);
            }
        },
        
        // Convenience methods for the new standard
        info: (from, msg, data) => logToServer('INFO', from, msg, data),
        // Modify warn method to prioritize UI type warnings
        warn: (from, message, data = {}) => {
            // Determine if this is a UI warning based on the 'from' parameter
            const isUIWarning = from.toLowerCase().includes('ui') || 
                                from.toLowerCase().includes('frontend') || 
                                from.toLowerCase().includes('dashboard');

            return publicApi.recordEvent({ 
                Type: isUIWarning ? 'UI' : 'SERVER', 
                Level: 'warn', 
                From: from,
                Message: message, 
                Data: data
            }); 
        },
        error: (from, msg, data) => logToServer('ERROR', from, msg, data),
        debug: (from, msg, data) => logToServer('DEBUG', from, msg, data)
    };
    
    // Global logger reference with deprecation warning
    Object.defineProperty(window, 'Logger', {
        get() {
            publicApi.warn('frontend.deprecation', 'Use window.APP.log instead of window.Logger. window.Logger will be removed in a future version.');
            return publicApi;
        }
    });

    // Extend logging with PJA-style methods
    publicApi.addLogEntry = (message, type = 'info', data = {}) => {
        const entry = {
            id: publicApi.generateId(),
            message,
            type,
            timestamp: publicApi.timestamp(),
            data
        };

        // Log to server
        publicApi.logToServer(type.toUpperCase(), 'activity', message, data);

        // Optional: Store in local storage if needed
        try {
            const storedLogs = JSON.parse(localStorage.getItem('playwright_log') || '[]');
            storedLogs.unshift(entry);
            localStorage.setItem('playwright_log', JSON.stringify(storedLogs.slice(0, 100)));
        } catch (error) {
            console.warn('Failed to store log entry:', error);
        }

        return entry;
    };

    publicApi.updateLogEntry = (entryId, updates = {}) => {
        try {
            const storedLogs = JSON.parse(localStorage.getItem('playwright_log') || '[]');
            const index = storedLogs.findIndex(entry => entry.id === entryId);
            
            if (index !== -1) {
                storedLogs[index] = { 
                    ...storedLogs[index], 
                    ...updates 
                };
                
                localStorage.setItem('playwright_log', JSON.stringify(storedLogs));
                return true;
            }
            return false;
        } catch (error) {
            console.warn('Failed to update log entry:', error);
            return false;
        }
    };

    // Add recordEvent method to publicApi
    publicApi.recordEvent = (entry) => {
        // Use logToServer as a fallback if needed
        const type = entry.Type || entry.type || 'SERVER';
        const level = entry.Level || entry.level || 'info';
        const from = entry.From || entry.from || 'unknown';
        const message = entry.Message || entry.message || '';
        const data = entry.Data || entry.data || {};

        return publicApi.logToServer(level.toUpperCase(), from, message, {
            ...data,
            type: type
        });
    };

    // Add timestamp and ID generation utilities
    publicApi.timestamp = () => new Date().toLocaleString();
    publicApi.generateId = () => `pja_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Extend storage utilities
    publicApi.storage = {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(`pja_${key}`);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                publicApi.warn('storage.get', `Error reading from storage: ${key}`, { error });
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(`pja_${key}`, JSON.stringify(value));
            } catch (error) {
                publicApi.warn('storage.set', `Error writing to storage: ${key}`, { error });
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(`pja_${key}`);
            } catch (error) {
                publicApi.warn('storage.remove', `Error removing from storage: ${key}`, { error });
            }
        }
    };

    window.APP.log = publicApi;
    window.APP.utils = {
        ...publicApi.storage,
        timestamp: publicApi.timestamp,
        generateId: publicApi.generateId
    };

    // Global error handler for unhandled promise rejections and errors
    window.addEventListener('unhandledrejection', (event) => {
        publicApi.error('frontend.global', 'Unhandled Promise Rejection', {
            error: event.reason?.message || event.reason,
            stack: event.reason?.stack,
            component: 'global-handler'
        });
    });

    window.addEventListener('error', (event) => {
        publicApi.error('frontend.global', 'Unhandled JavaScript Error', {
            error: event.error?.message || event.message,
            stack: event.error?.stack,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            component: 'global-handler'
        });
    });

    console.log('✅ Enhanced Logging System loaded and ready');
})();
