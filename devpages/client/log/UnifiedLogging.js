/**
 * @file UnifiedLogging.js
 * @description Centralized, structured logging system for the DevPages application.
 * This system is designed to be extensible, configurable, and consistent across the entire application.
 * It is exposed globally via the `window.APP.services.log` namespace.
 */

import { appStore } from '/client/appState.js';
import { logThunks } from '/client/store/slices/logSlice.js';

// Establish the global namespace
window.APP = window.APP || {};
window.APP.services = window.APP.services || {};

// --- Configuration ---
const config = {
  defaultMaxEntries: 50,
  defaultOrder: 'desc',
  // Standard levels with priorities (005.5.md)
  levels: {
    debug: { color: '#5c6370', priority: 0 },
    info: { color: '#61afef', priority: 1 },
    warn: { color: '#e5c07b', priority: 2 },
    error: { color: '#e06c75', priority: 3 }
  },
  // Standard types following 005.5.md taxonomy
  standardTypes: {
    BOOT: ['START', 'PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'SUCCESS', 'CRITICAL_FAILURE', 'SUMMARY', 'APP_READY', 'SPLASH_HIDDEN', 'SERVICE_INJECTED', 'STORE_EXPOSED'],
    LIFECYCLE: ['LOADING', 'STARTED', 'ENDED', 'CONNECTED', 'MOUNTED'],
    STATE: ['IDLE', 'SET_VOLUME', 'SUBMIT_SCORE', 'ACTIVE', 'PAUSED'],
    API: ['REQUEST', 'RESPONSE', 'ERROR', 'TIMEOUT'],
    SYSTEM: ['INIT', 'CONFIG', 'ERROR', 'SHUTDOWN'],
    USER: ['LOGIN', 'LOGOUT', 'ACTION', 'ERROR'],
    REDUX: ['ACTION', 'DISPATCH', 'STATE_CHANGE', 'MIDDLEWARE']
  }
};

// --- Type Handlers ---
const typeHandlersConfig = {
  // API Type Handler - Parses PJA Game API messages
  API: {
    name: 'PJA Game API Parser',
    parse: function(message, payload) {
      // If payload contains API data, format it specially
      if (payload && payload.apiEntry) {
        const api = payload.apiEntry;
        return {
          formatted: `${api.from}→${api.to}: ${api.action}${api.getDuration() ? ` (${api.getDuration().toFixed(2)}ms)` : ''}`,
          details: {
            action: api.action,
            route: `${api.from}→${api.to}`,
            timing: {
              sent: api.ttime,
              received: api.rtime,
              duration: api.getDuration()
            },
            data: api.data
          }
        };
      }
      
      // If payload has API-like structure, format accordingly
      if (payload && payload.action && payload.from && payload.to) {
        return {
          formatted: `${payload.from}→${payload.to}: ${payload.action}`,
          details: payload
        };
      }
      
      // Default API formatting
      return {
        formatted: message,
        details: payload
      };
    },
    
    // Quick API logging methods
    logSend: function(logger, action, to, data = null) {
      const apiData = {
        action,
        from: logger.source,
        to,
        ttime: performance.now(),
        data
      };
      return logger.log('INFO', 'API', 'SEND', `Sending ${action} to ${to}`, { apiEntry: apiData });
    },
    
    logReceive: function(logger, action, from, data = null) {
      const apiData = {
        action,
        from,
        to: logger.source,
        rtime: performance.now(),
        data
      };
      return logger.log('INFO', 'API', 'RECEIVE', `Received ${action} from ${from}`, { apiEntry: apiData });
    }
  },
  
  // SYSTEM Type Handler
  SYSTEM: {
    name: 'System Events Parser',
    parse: function(message, payload) {
      if (payload && payload.component) {
        return {
          formatted: `[${payload.component}] ${message}`,
          details: payload
        };
      }
      return {
        formatted: message,
        details: payload
      };
    }
  },
  
  // USER Type Handler
  USER: {
    name: 'User Actions Parser', 
    parse: function(message, payload) {
      if (payload && payload.userId) {
        return {
          formatted: `User ${payload.userId}: ${message}`,
          details: payload
        };
      }
      return {
        formatted: message,
        details: payload
      };
    }
  },
  
  // REDUX Type Handler - Clean Redux action formatting
  REDUX: {
    name: 'Redux Actions Parser',
    parse: function(message, payload) {
      // If this is an aggregated message, handle it specially
      if (payload && payload.aggregated) {
        return {
          formatted: `${message} (${payload.actionType})`,
          details: payload
        };
      }
      
      // For regular Redux actions, the message is already formatted by the middleware
      return {
        formatted: message,
        details: payload
      };
    }
  },
  
  // Default handler for unknown types
  DEFAULT: {
    name: 'Default Parser',
    parse: function(message, payload) {
      return {
        formatted: message,
        details: payload
      };
    }
  }
};

// --- Logger Class ---
class Logger {
  constructor(type, source = null, options = {}) {
    this.type = type.toUpperCase();
    this.source = source ? source.toUpperCase() : null;
    this.options = {
      containerId: options.containerId || (source ? `${source.toLowerCase()}-log` : 'global-log'),
      maxEntries: options.maxEntries || window.APP.services.log.config.defaultMaxEntries,
      enableConsole: options.enableConsole !== false,
      enablePanel: options.enablePanel !== false,
      ...options
    };
    
    // Bridge to existing systems
    this.consoleManager = options.consoleManager || window.consoleLogManager;
    this.logPanel = options.logPanel || window.logPanelInstance;
    
    console.log(`[DevPages.logging] Logger created for ${this.type}${this.source ? `-${this.source}` : ''}`);
  }

  /**
   * Core logging method implementing 005.5.md standard format:
   * [SOURCE-Component][TYPE][ACTION] message [LEVEL]
   * 
   * TYPE now acts as container switch to get TYPE handler/parser
   */
  log(level, action, message, payload = null) {
    const normalizedLevel = this.normalizeLevel(level);
    const normalizedType = this.type;
    const normalizedAction = action.toUpperCase();
    
    // Get TYPE handler for parsing
    const typeHandler = window.APP.services.log.typeHandlers[normalizedType] || 
                       window.APP.services.log.typeHandlers.DEFAULT;
    
    // Parse message using TYPE handler
    const parsed = typeHandler.parse(message, payload);
    
    // Validate against standard taxonomy (005.5.md recommendations) - suppressed for cleaner console
    // this.validateTypeAction(normalizedAction);
    
    const logEntry = {
      ts: Date.now(),
      source: this.source,
      type: normalizedType,
      action: normalizedAction,
      level: normalizedLevel,
      message: parsed.formatted, // Use parsed/formatted message
      payload: parsed.details,   // Use parsed details
      originalMessage: message,  // Keep original for reference
      typeHandler: typeHandler.name,
      formatted: this.formatMessage(normalizedLevel, normalizedType, normalizedAction, parsed.formatted)
    };
    
    // Route to existing systems
    if (this.options.enableConsole && this.consoleManager) {
      this.logToConsole(logEntry);
    }
    
    if (this.options.enablePanel && this.logPanel) {
      this.logToPanel(logEntry);
    }
    
    // BRIDGE: Also send to LogCore/LogDisplay system
    this.bridgeToLogCore(logEntry);
    
    return logEntry;
  }

  /**
   * Format message according to 005.5.md standard:
   * [SOURCE-Component][TYPE][ACTION] message [LEVEL]
   */
  formatMessage(level, type, action, message) {
    let prefix = `[${this.type}]`;
    if (this.source) {
      prefix += `[${this.source}]`;
    }
    prefix += `[${action}]`;
    
    return `${prefix} ${message} [${level}]`;
  }

  /**
   * Bridge UnifiedLogging messages to LogCore/LogDisplay system
   */
  bridgeToLogCore(logEntry) {
    try {
      // Dynamically import LogCore to avoid circular dependencies
      import('./LogCore.js').then(({ log: logCoreFunction }) => {
        // Convert UnifiedLogging format to LogCore format
        logCoreFunction({
          message: logEntry.message,
          source: logEntry.source || 'SYSTEM',
          level: logEntry.level,
          type: logEntry.type,
          action: logEntry.action,
          details: logEntry.payload,
          ts: logEntry.ts,
          forceConsole: false,
          component: this.source
        });
      }).catch(error => {
        // Silently fail if LogCore isn't available yet
        console.debug('[UnifiedLogging] LogCore bridge failed:', error.message);
      });
    } catch (error) {
      // Silently fail if bridging fails
      console.debug('[UnifiedLogging] LogCore bridge error:', error.message);
    }
  }

  /**
   * Validate type and action against standard taxonomy (005.5.md)
   */
  validateTypeAction(action) {
    const config = window.APP.services.log.config;
    if (config.standardTypes[this.type]) {
      if (!config.standardTypes[this.type].includes(action)) {
        console.warn(`[DevPages.logging] Non-standard ACTION '${action}' for TYPE '${this.type}'. Consider using: ${config.standardTypes[this.type].join(', ')}`);
      }
    }
  }

  /**
   * Normalize level to standard format
   */
  normalizeLevel(level) {
    const normalized = String(level).toUpperCase();
    const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    if (normalized === 'WARNING') return 'WARN';
    return validLevels.includes(normalized) ? normalized : 'INFO';
  }

  /**
   * Route to console logging system
   */
  logToConsole(logEntry) {
    if (this.consoleManager && typeof this.consoleManager.handleConsoleMethod === 'function') {
      const consoleLevel = logEntry.level.toLowerCase();
      // Pass all relevant info to the console handler
      this.consoleManager.handleConsoleMethod(consoleLevel, [logEntry.formatted, logEntry.payload]);
    } else {
      // Fallback to direct console
      const consoleMethod = console[logEntry.level.toLowerCase()] || console.log;
      // Pass both formatted message and the payload object
      consoleMethod(logEntry.formatted, logEntry.payload);
    }
  }

  /**
   * Route to panel logging system
   */
  logToPanel(logEntry) {
    if (this.logPanel) {
      const panelEntry = {
        ts: logEntry.ts,
        message: logEntry.message,
        source: logEntry.source,
        level: logEntry.level,
        type: logEntry.type,
        action: logEntry.action,
        details: logEntry.payload
      };
      appStore.dispatch(logThunks.addEntry(panelEntry));
    }
  }

  // Convenience methods
  debug(action, message, payload = null) {
    return this.log('DEBUG', action, message, payload);
  }

  info(action, message, payload = null) {
    return this.log('INFO', action, message, payload);
  }

  warn(action, message, payload = null) {
    return this.log('WARN', action, message, payload);
  }

  error(action, message, payload = null) {
    return this.log('ERROR', action, message, payload);
  }
}

// Create the logging service object
const loggingService = {
  config,
  typeHandlers: typeHandlersConfig,
  Logger,
  createLogger(type, source = null, options = {}) {
    return new loggingService.Logger(type, source, options);
  },
  directLog(level, from, type, action, message, data = null) {
    const logger = new loggingService.Logger(from || 'GLOBAL', null, {
      enableConsole: true,
      enablePanel: true
    });
    
    return logger.log(level, action, message, data);
  },
  setupControls(loggerInstance, controlsConfig = {}) {
    if (!loggerInstance.options.containerId) return;
    
    const containerId = loggerInstance.options.containerId;
    const {
      clearButtonSelector = `[data-action="${containerId}-clear"]`,
      copyButtonSelector = `[data-action="${containerId}-copy"]`
    } = controlsConfig;
    
    // Setup clear button
    document.querySelectorAll(clearButtonSelector).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (loggerInstance.logPanel) {
          loggerInstance.logPanel.clearLog();
        }
      });
    });
    
    // Setup copy button
    document.querySelectorAll(copyButtonSelector).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (loggerInstance.logPanel) {
          loggerInstance.logPanel.copyLog();
        }
      });
    });
    
    console.log(`[DevPages.logging] UI controls set up for ${loggerInstance.source}`);
  },
  pjaGameApi: {
    // Game API Actions from pjaSdk.module.js
    actions: {
      GAME_IDLE: "GAME_IDLE",
      GAME_LOADING: "GAME_LOADING", 
      GAME_LOADED: "GAME_LOADED",
      GAME_STARTED: "GAME_STARTED",
      GAME_ENDED: "GAME_ENDED",
      GAME_STATE_UPDATE: "GAME_STATE_UPDATE",
      PLAYER_ACTION: "PLAYER_ACTION",
      SUBMIT_SCORE: "SUBMIT_SCORE",
      SET_VOLUME: "SET_VOLUME",
      PLAY_GAME: "PLAY_GAME", 
      PAUSE_GAME: "PAUSE_GAME",
      GET_SCORE: "GET_SCORE",
      GET_USER: "GET_USER",
      SET_USER: "SET_USER",
      AUTHENTICATE: "AUTHENTICATE"
    },
    
    // Create API logger for specific role
    createApiLogger: function(role, targetWindow = null) {
      const logger = loggingService.createLogger(role, 'API');
      
      return {
        ...logger,
        
        // Send API message with logging
        send: function(action, to, data = null) {
          const apiEntry = {
            action,
            from: role,
            to,
            ttime: performance.now(),
            data
          };
          
          // Log the send
          logger.log('INFO', 'API', 'SEND', `Sending ${action} to ${to}`, { apiEntry: apiEntry });
          
          // If targetWindow provided, actually send via postMessage
          if (targetWindow && typeof targetWindow.postMessage === 'function') {
            targetWindow.postMessage({ type: action, data }, "*");
          }
          
          return apiEntry;
        },
        
        // Receive API message with logging  
        receive: function(action, from, data = null) {
          const apiEntry = {
            action,
            from,
            to: role,
            rtime: performance.now(),
            data
          };
          
          // Log the receive
          logger.log('INFO', 'API', 'RECEIVE', `Received ${action} from ${from}`, { apiEntry: apiEntry });
          
          return apiEntry;
        },
        
        // Convenience methods for game actions
        gameLoaded: () => logger.send('GAME_LOADED', 'HOST'),
        gameStarted: () => logger.send('GAME_STARTED', 'HOST'),
        gameEnded: (score) => logger.send('GAME_ENDED', 'HOST', { score }),
        submitScore: (score) => logger.send('SUBMIT_SCORE', 'SERVER', { score }),
        authenticate: (token) => logger.send('AUTHENTICATE', 'SERVER', { token })
      };
    }
  },
  // Define testLoggingSystem directly in the object
  testLoggingSystem() {
    console.log('[DevPages.logging] Running comprehensive logging system test...');
    
    const logger = new Logger('TEST', 'LOGGING_SYSTEM');
    
    // Test 1: Standard string message
    logger.log('INFO', 'TEST_ACTION', 'This is a standard string message');
    
    // Test 2: Object message
    logger.log('INFO', 'TEST_ACTION', { key: 'value', nested: { deep: 'object' } });
    
    // Test 3: Number message
    logger.log('INFO', 'TEST_ACTION', 42);
    
    // Test 4: Boolean message
    logger.log('INFO', 'TEST_ACTION', true);
    
    // Test 5: Null message
    logger.log('INFO', 'TEST_ACTION', null);
    
    // Test 6: Undefined message
    logger.log('INFO', 'TEST_ACTION', undefined);
    
    // Test 7: Complex object with toString method
    const complexObj = {
      toString() {
        return 'Custom toString representation';
      }
    };
    logger.log('INFO', 'TEST_ACTION', complexObj);
    
    console.log('[DevPages.logging] Logging system test completed.');
  }
};

// Expose the logging service globally
window.APP.services.log = loggingService;

// For backward compatibility
window.DevPages = window.DevPages || {};
window.DevPages.logging = loggingService;
window.PjaGames = window.PjaGames || {};
window.PjaGames.logging = loggingService;

// Export the logging service components
export const { 
  createLogger, 
  setupControls, 
  pjaGameApi,
  testLoggingSystem
} = loggingService;

export { Logger };
export const typeHandlers = typeHandlersConfig;

console.log('[DevPages.logging] Unified logging system with TYPE handlers and API parsers initialized'); 