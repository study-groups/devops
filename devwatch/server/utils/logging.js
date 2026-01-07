/**
 * Unified Logging Utility
 * 
 * A single, powerful logger for the Playwright server. It combines the features
 * of the previous SimpleLogger and SystemLogger.
 * 
 * Features:
 * - Enforces logging to the PW_DIR data directory.
 * - Self-contained, size-based log rotation.
 * - Middleware-style "type handlers" for advanced log processing.
 * - Two logging methods:
 *   - .log(level, message, data): For simple, level-based logging.
 *   - .systemLog(logEntry): For structured, event-driven logging.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { parseSize } = require('../../utils/size-parser');

class UnifiedLogger {
    constructor(options = {}) {
        const pwDir = options.logDir || process.env.PW_DIR;
        if (!pwDir) {
            throw new Error(`
CRITICAL ERROR: PW_DIR environment variable is not set.
The server cannot start without a configured data directory for logs and other test assets.
Please set the PW_DIR environment variable before running the server.
Example:
$ export PW_DIR=/path/to/your/data/directory
$ node server/index.js
`);
        }

        this.baseLogDir = path.join(pwDir, 'logs');
        this.logFileCache = new Map();

        const enableConsoleEnv = process.env.LOG_ENABLE_CONSOLE;
        this.enableConsole = typeof enableConsoleEnv !== 'undefined'
            ? enableConsoleEnv === '1' || enableConsoleEnv === 'true'
            : (options.enableConsole !== false);

        // Rotation configuration
        const rotateSizeEnv = process.env.LOG_ROTATE_SIZE;
        const parsedSize = parseSize(rotateSizeEnv);
        this.maxSize = parsedSize !== null ? parsedSize : (options.maxSize || 5 * 1024 * 1024); // Default 5MB

        const maxFilesEnv = parseInt(process.env.LOG_ROTATE_FILES, 10);
        this.maxFiles = Number.isFinite(maxFilesEnv) ? maxFilesEnv : (options.maxFiles || 5);

        const rotateStrategyEnv = (process.env.LOG_ROTATE_STRATEGY || options.rotationStrategy || 'size').toLowerCase();
        this.rotationStrategy = ['size', 'daily'].includes(rotateStrategyEnv) ? rotateStrategyEnv : 'size';
        this.lastRotationDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD for daily rotation

        const compressEnv = process.env.LOG_ROTATE_COMPRESS;
        this.compressRotated = typeof compressEnv !== 'undefined'
            ? compressEnv === '1' || compressEnv === 'true'
            : (options.compressRotated || false);

        const levelFromEnv = (process.env.LOG_LEVEL || options.level || 'info').toLowerCase();
        this.level = ['error', 'warn', 'info', 'success', 'debug'].includes(levelFromEnv) ? levelFromEnv : 'info';
        this.typeHandlers = new Map();

        this.ensureLogDir(this.baseLogDir);
    }

    standardizeType(type, module) {
        const upperType = String(type).toUpperCase();
        if (['UI', 'SERVER', 'API', 'REDUX'].includes(upperType)) {
            return upperType;
        }
        // Heuristics based on module/type
        const lowerModule = String(module).toLowerCase();
        if (lowerModule === 'frontend' || upperType.includes('UI')) {
            return 'UI';
        }
        if (lowerModule === 'api' || upperType.includes('API')) {
            return 'API';
        }
        if (lowerModule === 'redux' || upperType.includes('REDUX')) {
            return 'REDUX';
        }
        return 'SERVER'; // Default
    }

    normalizeLogEntry(entry) {
        const stackTrace = this._getCallStack();

        // Find the first relevant stack frame (not from this file)
        // This is the actual source of the log call.
        const caller = stackTrace.find(frame => !frame.file.endsWith('server/utils/logging.js'));
        
        let from;
        if (entry.From || entry.FROM) {
            from = entry.From || entry.FROM;
        } else if (caller && caller.file !== 'unknown') {
             // 'server/routes/api/logs.js' -> 'server.routes.api.logs'
            const moduleName = caller.file
                .replace(/\.(js|ts)$/, '') // remove extension
                .replace(/[\/\\]/g, '.'); // replace path separators
            from = `${moduleName}`;
        } else {
            from = 'unknown.unknown';
        }

        const [module, ...actionParts] = from.split('.');
        const action = actionParts.join('.') || 'general';

        const type = entry.Type || entry.TYPE || 'SERVER'; // default to SERVER
        
        const standardizedType = this.standardizeType(type, module);

        return {
            timestamp: entry.Time || new Date().toISOString(),
            level: (entry.Level || 'info').toLowerCase(),
            type: standardizedType,
            module: module.toLowerCase(),
            action: action.toLowerCase(),
            message: entry.Message || entry.message || '',
            details: {
                ...(entry.Data || entry.data || {}),
                // Prioritize client-side stack if available, otherwise use server-side.
                stack: (entry.Data && entry.Data.clientStack) || stackTrace.slice(0, 5)
            }
        };
    }

    _getCallStack() {
        const err = new Error();
        Error.captureStackTrace(err, this._getCallStack);
        const stack = err.stack || '';

        // Clean up the stack trace
        return stack.split('\n')
            .slice(2) // Skip the first two lines (Error and the helper function itself)
            .map(line => line.trim())
            .filter(line => !line.includes('node_modules')) // Exclude node_modules
            .map(line => {
                // Updated regex to handle two common formats:
                // 1. at functionName (/path/to/file.js:line:col)
                // 2. at /path/to/file.js:line:col
                const match = line.match(/at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?/);
                if (match) {
                    const func = match[1] || 'anonymous';
                    const file = match[2];
                    const lineNum = match[3];
                    const colNum = match[4];
                    
                    const relativeFile = file.replace(process.cwd() + '/', '');
                    const editorLink = `file://${file}:${lineNum}:${colNum}`;
                    
                    return {
                        function: func,
                        file: relativeFile,
                        line: lineNum,
                        column: colNum,
                        raw: line,
                        link: editorLink
                    };
                }
                return { raw: line, function: 'unknown', file: 'unknown' };
            })
            .filter(Boolean);
    }

    ensureLogDir(dir) {
        if (!dir) return;
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (error) {
            console.error(`Failed to create log directory at ${dir}:`, error);
        }
    }
    
    _getLogFile(moduleType) {
        const normalizedModule = (moduleType || 'unknown').toLowerCase();
        if (this.logFileCache.has(normalizedModule)) {
            return this.logFileCache.get(normalizedModule);
        }

        const logDir = path.join(this.baseLogDir, normalizedModule);
        const logFile = path.join(logDir, `${normalizedModule}.log`);
        
        this.ensureLogDir(logDir);

        this.logFileCache.set(normalizedModule, logFile);
        return logFile;
    }

    // A structured event-based logging method.
    async recordEvent(logEntry) {
        const finalEntry = this.normalizeLogEntry(logEntry);

        // Use the existing FROM field to determine log file location
        const moduleType = this.validateFromFormat(logEntry.FROM || logEntry.From || 'unknown.general');
        const logFile = this._getLogFile(moduleType);
        this._checkAndRotate(logFile);

        const logLine = JSON.stringify(finalEntry) + '\n';
        this.write(logFile, logLine);

        if (this.enableConsole) {
            this.writeToConsole(finalEntry);
        }

        return finalEntry;
    }
    
    write(filePath, line) {
        if (!filePath) return;
        try {
            fs.appendFileSync(filePath, line);
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    writeToConsole(logEntry) {
        if (logEntry.type) { // Handle new, normalized format
            const { timestamp, level, type, module, action, message, details } = logEntry;
            const time = new Date(timestamp).toLocaleTimeString();
            const header = `${this.getEmoji(level)} ${time} ${level.toUpperCase()} [${type}/${module}] ${action} - ${message}`;
            
            const consoleMethod = {
                'error': console.error,
                'warn': console.warn,
                'debug': console.debug
            }[level] || console.log;

            // Avoid logging the entire stack trace to the console for cleaner output
            const detailsWithoutStack = { ...details };
            delete detailsWithoutStack.stack;

            consoleMethod(header, Object.keys(detailsWithoutStack).length > 0 ? detailsWithoutStack : '');
            return;
        }

        // Fallback for any old-format entries that might slip through
        const { Time, Level, Source, Message, data } = logEntry;
        const level = (Level || '').toLowerCase();

        const time = new Date(Time).toLocaleTimeString();
        const header = `${this.getEmoji(level)} ${time} ${Level} [${Source}] ${Message}`;
        
        const consoleMethod = {
            'error': console.error,
            'warn': console.warn,
            'debug': console.debug
        }[level] || console.log;

        consoleMethod(header, data || '');
    }

    registerTypeHandler(type, handler) {
        this.typeHandlers.set(type.toUpperCase(), handler);
    }
    
    _checkAndRotate(file) {
        if (!file) return;
        try {
            if (!fs.existsSync(file)) {
                return; // Nothing to rotate
            }

            const today = new Date().toISOString().split('T')[0];
            const needsDailyRotation = this.rotationStrategy === 'daily' && today !== this.lastRotationDate;
            const needsSizeRotation = this.rotationStrategy === 'size' && fs.statSync(file).size > this.maxSize;

            if (needsDailyRotation) {
                this._rotateLogs(file, 'daily');
                this.lastRotationDate = today;
            } else if (needsSizeRotation) {
                this._rotateLogs(file, 'size');
            }
        } catch (error) {
            console.error(`Error during log rotation check for ${file}:`, error);
        }
    }

    _rotateLogs(file, trigger) {
        try {
            const { dir, name, ext } = path.parse(file);
            const archiveName = `${name}${ext}.1`;
            const archivePath = path.join(dir, archiveName);

            // Rename the current log file first
            if (fs.existsSync(file)) {
                fs.renameSync(file, archivePath);
            } else {
                return; // Nothing to rotate
            }
            
            // Log the rotation event *before* compression
            this.recordEvent({
                Type: 'SERVER_INFO',
                From: `logger.rotation.${trigger}`,
                Level: 'info', // Assuming info for rotation events
                Message: `Log file rotated. Archived to ${archiveName}${this.compressRotated ? '.gz' : ''}.`,
                Data: { 
                    strategy: trigger, 
                    maxSize: trigger === 'size' ? this.maxSize : undefined,
                    oldFile: file,
                    newFile: `${archivePath}${this.compressRotated ? '.gz' : ''}`
                }
            });

            // Handle old files and compression asynchronously
            this._manageOldFiles(dir, name, ext).then(() => {
                if (this.compressRotated) {
                    this._compressFile(archivePath);
                }
            });

        } catch (err) {
            // Use console.error directly to avoid recursion if logging system is the source of the error
            console.error('Failed to rotate logs', { error: err.message, file });
        }
    }

    async _manageOldFiles(dir, name, ext) {
        try {
            const compressedExt = this.compressRotated ? '.gz' : '';

            // First, remove the oldest log file if it exists
            const oldestFile = path.join(dir, `${name}${ext}.${this.maxFiles}${compressedExt}`);
            if (fs.existsSync(oldestFile)) {
                fs.unlinkSync(oldestFile);
            }

            // Then, shift all other archived logs up by one index
            for (let i = this.maxFiles - 1; i >= 1; i--) {
                const currentFile = path.join(dir, `${name}${ext}.${i}${compressedExt}`);
                const nextFile = path.join(dir, `${name}${ext}.${i + 1}${compressedExt}`);
                if (fs.existsSync(currentFile)) {
                    fs.renameSync(currentFile, nextFile);
                }
            }
        } catch (error) {
            console.error('Error managing old log files:', error);
        }
    }

    _compressFile(filePath) {
        const source = fs.createReadStream(filePath);
        const destination = fs.createWriteStream(`${filePath}.gz`);
        const gzip = zlib.createGzip();

        source.pipe(gzip).pipe(destination)
            .on('finish', () => {
                fs.unlink(filePath, (err) => { // Delete the original file
                    if (err) {
                        console.error(`Failed to delete original log file after compression: ${filePath}`, err);
                    }
                });
            })
            .on('error', (err) => {
                console.error(`Failed to compress log file: ${filePath}`, err);
            });
    }

    /**
     * Manually triggers a log rotation for a specified file.
     * @param {string} file The full path to the log file to rotate.
     * @returns {{rotated: boolean, message: string}} Result of the operation.
     */
    forceRotate(file) {
        if (!file || typeof file !== 'string') {
            return { rotated: false, message: 'Invalid file path provided.' };
        }
        
        // Security check: ensure the file is within the configured log directory
        if (!file.startsWith(this.baseLogDir)) {
            const message = 'Rotation denied: File is outside of the configured log directory.';
            this.warn(message, { requestedFile: file, logDir: this.baseLogDir });
            return { rotated: false, message };
        }

        try {
            if (fs.existsSync(file)) {
                this._rotateLogs(file, 'manual');
                return { rotated: true, message: `Successfully rotated ${path.basename(file)}.` };
            } else {
                return { rotated: false, message: `File not found: ${path.basename(file)}.` };
            }
        } catch (error) {
            this.error('Manual rotation failed', { error: error.message, file });
            return { rotated: false, message: 'An unexpected error occurred during rotation.' };
        }
    }

    getEmoji(level) {
        const emojis = { 'info': 'ℹ️', 'warn': '⚠️', 'error': '❌', 'success': '✅', 'debug': '🐛' };
        return emojis[level.toLowerCase()] || '📝';
    }

    _isBelowThreshold(level) {
        const weights = { error: 0, warn: 1, info: 2, success: 2, debug: 3 };
        const current = weights[(this.level || 'info').toLowerCase()] ?? 2;
        const incoming = weights[(level || 'info').toLowerCase()] ?? 2;
        return incoming > current;
    }

    parseTypeWithLevel(type) {
        if (!type) {
            return { baseType: 'UNKNOWN', level: 'info' };
        }
        const parts = type.split('_');
        const levelSuffix = parts.length > 1 ? parts[parts.length - 1] : '';
        
        const levelMap = {
            'ERROR': 'error',
            'WARN': 'warn', 
            'DEBUG': 'debug',
            'INFO': 'info'
        };

        const level = levelMap[levelSuffix.toUpperCase()];
        
        if (level) {
            // It's a valid level suffix
            const baseType = parts.slice(0, -1).join('_');
            return { baseType: baseType.toUpperCase(), level };
        } else {
            // No valid level suffix, treat the whole thing as the type
            return { baseType: type.toUpperCase(), level: 'info' };
        }
    }

    validateFromFormat(from) {
        if (typeof from !== 'string' || from.split('.').length < 2) {
            this.recordEvent({
                Type: 'SERVER_WARN',
                From: 'logger.validation',
                Level: 'warn', // Assuming warn for validation errors
                Message: `Invalid 'From' format. Expected '<module>.<details>', but got '${from}'.`,
                Data: { originalFrom: from }
            });
            return 'unknown';
        }
        const moduleType = from.split('.')[0].toLowerCase();
        const validModules = ['playwright', 'monitor', 'command', 'event', 'logger', 'frontend'];
        
        return validModules.includes(moduleType) ? moduleType : 'server';
    }

    info(message, data = {}) { 
        return this.recordEvent({ 
            Type: 'SERVER', 
            Level: 'info', 
            Message: message, 
            Data: data 
        }); 
    }

    warn(message, data = {}) { 
        return this.recordEvent({ 
            Type: 'SERVER', 
            Level: 'warn', 
            Message: message, 
            Data: data 
        }); 
    }

    error(message, data = {}) { 
        return this.recordEvent({ 
            Type: 'SERVER', 
            Level: 'error', 
            Message: message, 
            Data: data 
        }); 
    }

    success(message, data = {}) { 
        return this.recordEvent({ 
            Type: 'SERVER', 
            Level: 'success', 
            Message: message, 
            Data: data 
        }); 
    }

    debug(message, data = {}) { 
        return this.recordEvent({ 
            Type: 'SERVER', 
            Level: 'debug', 
            Message: message, 
            Data: data 
        }); 
    }
    
}

let defaultLoggerInstance = null;

function getLogger() {
    if (!defaultLoggerInstance) {
        // Simple logs will go to 'playwright.log' by default.
        defaultLoggerInstance = new UnifiedLogger();
    }
    return defaultLoggerInstance;
}

function configureLogger(options = {}) {
    defaultLoggerInstance = new UnifiedLogger(options);
    return defaultLoggerInstance;
}

// Example TYPE Handler from old systemLogger
getLogger().registerTypeHandler('PLAYWRIGHT', (entry) => {
    if (entry.data.results && entry.data.results.stats) {
        const stats = entry.data.results.stats;
        entry.message = `Test run finished. Passed: ${stats.passed}, Failed: ${stats.failed}, Skipped: ${stats.skipped}.`;
    }
    return entry;
});

const api = {
    UnifiedLogger,
    configureLogger,
    getLogger,
    info: (msg, data = {}) => getLogger().recordEvent({ 
        Type: 'SERVER', 
        Level: 'info', 
        Message: msg, 
        Data: data 
    }),
    warn: (msg, data = {}) => getLogger().recordEvent({ 
        Type: 'SERVER', 
        Level: 'warn', 
        Message: msg, 
        Data: data 
    }),
    error: (msg, data = {}) => getLogger().recordEvent({ 
        Type: 'SERVER', 
        Level: 'error', 
        Message: msg, 
        Data: data 
    }),
    success: (msg, data = {}) => getLogger().recordEvent({ 
        Type: 'SERVER', 
        Level: 'success', 
        Message: msg, 
        Data: data 
    }),
    debug: (msg, data = {}) => getLogger().recordEvent({ 
        Type: 'SERVER', 
        Level: 'debug', 
        Message: msg, 
        Data: data 
    }),
    recordEvent: (entry) => getLogger().recordEvent(entry)
};

Object.defineProperty(api, 'defaultLogger', {
    enumerable: true,
    get: () => getLogger()
});

module.exports = api;
