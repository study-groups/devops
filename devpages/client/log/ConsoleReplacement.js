/**
 * ConsoleReplacement.js - Enhanced console replacement with source location tracking
 * 
 * Provides console-like logging methods that automatically capture source location
 * information while routing through the unified APP.log system.
 */

import { log as logCore, createLogger } from './LogCore.js';

/**
 * Enhanced logger that captures source location information
 * Uses Error stack traces to determine the calling file and line number
 */
class SourceAwareLogger {
    constructor(module = null, source = 'CLIENT', performanceMode = false) {
        this.module = module;
        this.source = source;
        this.performanceMode = performanceMode;
        this.baseLogger = module ? createLogger(module) : null;
        this._isLogging = false; // Circuit breaker flag
    }

    /**
     * Extracts source location from Error stack trace
     * @returns {Object} { filename, line, column }
     */
    getSourceLocation() {
        // Performance optimization: reduce stack parsing overhead
        try {
            const stack = new Error().stack;
            if (!stack) return { filename: 'unknown', line: 0, column: 0 };

            const lines = stack.split('\n');
            // Skip the first few lines (Error, getSourceLocation, the logging method)
            // Limit search to first 8 lines for performance
            const maxLines = Math.min(lines.length, 8);
            for (let i = 3; i < maxLines; i++) {
            const line = lines[i];
            
            // Match various stack trace formats
            // Chrome: "at functionName (file.js:line:col)"
            // Firefox: "functionName@file.js:line:col"
            const chromeMatch = line.match(/at (?:.*?\s+)?\(?([^)]+):(\d+):(\d+)\)?/);
            const firefoxMatch = line.match(/@([^:]+):(\d+):(\d+)/);
            
            const match = chromeMatch || firefoxMatch;
            if (match) {
                const [, filepath, lineNum, colNum] = match;
                
                // Extract just the filename from the full path
                const filename = filepath.split('/').pop() || filepath.split('\\').pop() || filepath;
                
                // Skip internal framework files
                if (filename.includes('LogCore.js') || 
                    filename.includes('ConsoleReplacement.js') ||
                    filename.includes('webpack') ||
                    filename.includes('node_modules')) {
                    continue;
                }
                
                return {
                    filename,
                    line: parseInt(lineNum),
                    column: parseInt(colNum),
                    fullPath: filepath
                };
            }
        }
        
        return { filename: 'unknown', line: 0, column: 0 };
        } catch (error) {
            // Fallback if stack parsing fails
            return { filename: 'unknown', line: 0, column: 0 };
        }
    }

    /**
     * Enhanced logging method with source location and loop prevention
     */
    logWithSource(level, message, details = null, options = {}) {
        // Circuit breaker: prevent infinite logging loops
        if (this._isLogging) {
            // Fallback to original console to prevent infinite recursion
            if (window.originalConsole && window.originalConsole[level.toLowerCase()]) {
                window.originalConsole[level.toLowerCase()](`[LOOP-PREVENTION] ${message}`);
            }
            return;
        }
        
        // Set flag to prevent recursive calls
        this._isLogging = true;
        
        try {
            // Performance optimization: skip source location in high-frequency scenarios
            const location = this.performanceMode ? 
                { filename: 'perf-mode', line: 0, column: 0 } : 
                this.getSourceLocation();
            
            // Skip internal logging system files to prevent feedback loops
            const filename = location.filename || 'unknown';
            if (filename.includes('LogDisplay.js') || 
                filename.includes('LogCore.js') ||
                filename.includes('ConsoleReplacement.js') ||
                filename.includes('UnifiedLogging.js') ||
                filename.includes('ApiLog.js') ||
                filename.includes('test-console-manager.js') ||
                filename.includes('debug-tools.js')) {
                
                // Route internal logging system messages to original console
                if (window.originalConsole && window.originalConsole[level.toLowerCase()]) {
                    window.originalConsole[level.toLowerCase()](`[INTERNAL] ${message}`);
                }
                return;
            }
            
            // Create enhanced message with source location
            const sourceInfo = `${location.filename}:${location.line}`;
            const enhancedMessage = `${message} [${sourceInfo}]`;
            
            // Determine module from filename if not provided
            const moduleFromFile = this.module || location.filename.replace(/\.[^.]*$/, '').toUpperCase();
            
            logCore({
                message: enhancedMessage,
                source: this.source,
                level: level.toUpperCase(),
                type: options.type || moduleFromFile,
                module: options.module || moduleFromFile,
                action: options.action || 'LOG',
                details: {
                    ...details,
                    sourceLocation: location,
                    originalMessage: message
                },
                forceConsole: options.forceConsole || false,
                ts: Date.now()
            });
        } catch (error) {
            // Fallback to original console if APP.log fails
            if (window.originalConsole && window.originalConsole.error) {
                window.originalConsole.error('[ConsoleReplacement] Error in logWithSource:', error);
                window.originalConsole[level.toLowerCase()](message);
            }
        } finally {
            // Always clear the flag to prevent deadlock
            this._isLogging = false;
        }
    }

    // Console-compatible methods
    log(message, ...args) {
        const details = args.length > 0 ? { args } : null;
        this.logWithSource('INFO', message, details);
    }

    info(message, ...args) {
        const details = args.length > 0 ? { args } : null;
        this.logWithSource('INFO', message, details);
    }

    warn(message, ...args) {
        const details = args.length > 0 ? { args } : null;
        this.logWithSource('WARN', message, details);
    }

    error(message, ...args) {
        const details = args.length > 0 ? { args } : null;
        this.logWithSource('ERROR', message, details);
    }

    debug(message, ...args) {
        const details = args.length > 0 ? { args } : null;
        this.logWithSource('DEBUG', message, details);
    }

    // Enhanced methods for structured logging
    logWithContext(level, message, context = {}) {
        this.logWithSource(level, message, null, context);
    }

    // Method to create a tagged logger for a specific module
    static createModuleLogger(moduleName, source = 'CLIENT') {
        return new SourceAwareLogger(moduleName, source);
    }
}

/**
 * Factory functions for different logging patterns
 */

// Create a global logger instance
const globalLogger = new SourceAwareLogger();

// Console replacement functions that maintain API compatibility
export const consoleLog = (message, ...args) => globalLogger.log(message, ...args);
export const consoleInfo = (message, ...args) => globalLogger.info(message, ...args);
export const consoleWarn = (message, ...args) => globalLogger.warn(message, ...args);
export const consoleError = (message, ...args) => globalLogger.error(message, ...args);
export const consoleDebug = (message, ...args) => globalLogger.debug(message, ...args);

// Enhanced structured logging functions
export const logWithLocation = (level, message, details, options) => 
    globalLogger.logWithSource(level, message, details, options);

// Module-specific logger factory
export const createModuleLogger = (moduleName, source = 'CLIENT') => 
    SourceAwareLogger.createModuleLogger(moduleName, source);

// Global console replacement object
export const enhancedConsole = {
    log: consoleLog,
    info: consoleInfo,
    warn: consoleWarn,
    error: consoleError,
    debug: consoleDebug,
    
    // Enhanced methods
    logWithContext: (level, message, context) => globalLogger.logWithContext(level, message, context),
    createLogger: createModuleLogger
};

/**
 * Console replacement installer
 * WARNING: This replaces the global console object
 */
export function installConsoleReplacement(options = {}) {
    const { 
        preserveOriginal = true,
        enableInProduction = false,
        performanceMode = false,
        modules = ['log', 'info', 'warn', 'error', 'debug']
    } = options;

    // Store original console methods
    if (preserveOriginal) {
        window.originalConsole = {
            log: console.log.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
            debug: console.debug.bind(console)
        };
    }

    // Check if we should enable in production (browser-safe check)
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isProduction && !enableInProduction) {
        console.warn('[ConsoleReplacement] Skipping console replacement in production');
        return;
    }

    // Create performance-optimized logger
    const logger = new SourceAwareLogger(null, 'CLIENT', performanceMode);
    
    // Create enhanced console methods
    const enhancedMethods = {
        log: (...args) => logger.log(...args),
        info: (...args) => logger.info(...args), 
        warn: (...args) => logger.warn(...args),
        error: (...args) => logger.error(...args),
        debug: (...args) => logger.debug(...args)
    };

    // Replace console methods
    modules.forEach(method => {
        if (enhancedMethods[method]) {
            console[method] = enhancedMethods[method];
        }
    });

    console.info('[ConsoleReplacement] Console replacement installed');
}

/**
 * Utility to restore original console
 */
export function restoreOriginalConsole() {
    if (window.originalConsole) {
        Object.assign(console, window.originalConsole);
        console.info('[ConsoleReplacement] Original console restored');
    }
}

// Auto-install if requested via environment or global flag
if (typeof window !== 'undefined' && window.ENABLE_CONSOLE_REPLACEMENT) {
    installConsoleReplacement({
        enableInProduction: window.ENABLE_CONSOLE_IN_PRODUCTION || false
    });
}

export default enhancedConsole;