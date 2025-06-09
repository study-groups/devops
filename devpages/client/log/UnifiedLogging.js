/**
 * UnifiedLogging.js - Harmonized logging system implementing standards from:
 * - 005.5.md: DevPages API, SDK & Logging Standards
 * - 006.md: Namespace breakdown and refactoring
 * - 007.md: PJA Games unified logging approach
 * 
 * This bridges the current dual-track system (AppLog* and ConsoleLog*) with
 * the proposed unified standards while maintaining backward compatibility.
 */

// Import existing components
import { log as logCore } from './LogCore.js';
import { ConsoleLogManager } from './ConsoleLogManager.js';
import { LogPanel } from './LogPanel.js';

// TODO: Import ApiLog components when available
// import { ApiLogEntry, GameApiManager, GAME_API_ACTIONS } from './ApiLog.js';

// Namespace definition following 007.md approach
window.DevPages = window.DevPages || {};
window.DevPages.logging = window.DevPages.logging || {};

// Also support PJA Games namespace for SDK compatibility (007.md)
window.PjaGames = window.PjaGames || {};
window.PjaGames.logging = window.PjaGames.logging || {};

// Configuration following 005.5.md standards (no subtypes, structured format)
window.DevPages.logging.config = {
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
    LIFECYCLE: ['LOADING', 'STARTED', 'ENDED', 'CONNECTED', 'MOUNTED'],
    STATE: ['IDLE', 'SET_VOLUME', 'SUBMIT_SCORE', 'ACTIVE', 'PAUSED'],
    API: ['REQUEST', 'RESPONSE', 'ERROR', 'TIMEOUT'],
    SYSTEM: ['INIT', 'CONFIG', 'ERROR', 'SHUTDOWN'],
    USER: ['LOGIN', 'LOGOUT', 'ACTION', 'ERROR']
  }
};

// TYPE Handlers - Each TYPE gets a parser that knows how to handle its messages
window.DevPages.logging.typeHandlers = {
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

// Enhanced Logger class following 006.md structure
window.DevPages.logging.Logger = class Logger {
  constructor(source, component = null, options = {}) {
    this.source = source.toUpperCase();
    this.component = component ? component.toUpperCase() : null;
    this.options = {
      containerId: options.containerId || `${source.toLowerCase()}-log`,
      maxEntries: options.maxEntries || window.DevPages.logging.config.defaultMaxEntries,
      enableConsole: options.enableConsole !== false,
      enablePanel: options.enablePanel !== false,
      ...options
    };
    
    // Bridge to existing systems
    this.consoleManager = options.consoleManager || window.consoleLogManager;
    this.logPanel = options.logPanel || window.logPanelInstance;
    
    console.log(`[DevPages.logging] Logger created for ${this.source}${this.component ? '-' + this.component : ''}`);
  }

  /**
   * Core logging method implementing 005.5.md standard format:
   * [SOURCE-Component][TYPE][ACTION] message [LEVEL]
   * 
   * TYPE now acts as container switch to get TYPE handler/parser
   */
  log(level, type, action, message, payload = null) {
    const normalizedLevel = this.normalizeLevel(level);
    const normalizedType = type.toUpperCase();
    const normalizedAction = action.toUpperCase();
    
    // Get TYPE handler for parsing
    const typeHandler = window.DevPages.logging.typeHandlers[normalizedType] || 
                       window.DevPages.logging.typeHandlers.DEFAULT;
    
    // Parse message using TYPE handler
    const parsed = typeHandler.parse(message, payload);
    
    // Validate against standard taxonomy (005.5.md recommendations)
    this.validateTypeAction(normalizedType, normalizedAction);
    
    const logEntry = {
      ts: Date.now(),
      source: this.source,
      component: this.component,
      type: normalizedType,
      action: normalizedAction, // Using ACTION instead of subtype (005.5.md)
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
    
    return logEntry;
  }

  /**
   * Format message according to 005.5.md standard:
   * [SOURCE-Component][TYPE][ACTION] message [LEVEL]
   */
  formatMessage(level, type, action, message) {
    let prefix = `[${this.source}]`;
    if (this.component) {
      prefix += `[${this.component}]`;
    }
    prefix += `[${type}][${action}]`;
    
    return `${prefix} ${message} [${level}]`;
  }

  /**
   * Validate type and action against standard taxonomy (005.5.md)
   */
  validateTypeAction(type, action) {
    const config = window.DevPages.logging.config;
    if (config.standardTypes[type]) {
      if (!config.standardTypes[type].includes(action)) {
        console.warn(`[DevPages.logging] Non-standard ACTION '${action}' for TYPE '${type}'. Consider using: ${config.standardTypes[type].join(', ')}`);
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
      this.consoleManager.handleConsoleMethod(consoleLevel, [logEntry.formatted]);
    } else {
      // Fallback to direct console
      const consoleMethod = console[logEntry.level.toLowerCase()] || console.log;
      consoleMethod(logEntry.formatted);
    }
  }

  /**
   * Route to panel logging system
   */
  logToPanel(logEntry) {
    if (this.logPanel && typeof this.logPanel.addEntry === 'function') {
      // Convert to LogPanel format
      const panelEntry = {
        ts: logEntry.ts,
        message: logEntry.message,
        source: logEntry.source,
        component: logEntry.component,
        level: logEntry.level,
        type: logEntry.type,
        action: logEntry.action, // Include action
        details: logEntry.payload
      };
      this.logPanel.addEntry(panelEntry);
    }
  }

  // Convenience methods following 005.5.md recommendations
  debug(type, action, message, payload = null) {
    return this.log('DEBUG', type, action, message, payload);
  }

  info(type, action, message, payload = null) {
    return this.log('INFO', type, action, message, payload);
  }

  warn(type, action, message, payload = null) {
    return this.log('WARN', type, action, message, payload);
  }

  error(type, action, message, payload = null) {
    return this.log('ERROR', type, action, message, payload);
  }

  // Domain-specific convenience methods (005.5.md examples)
  lifecycle(action, message, payload = null) {
    return this.info('LIFECYCLE', action, message, payload);
  }

  state(action, message, payload = null) {
    return this.info('STATE', action, message, payload);
  }

  // API convenience methods - use API TYPE handler
  apiSend(action, to, data = null) {
    const handler = window.DevPages.logging.typeHandlers.API;
    return handler.logSend(this, action, to, data);
  }

  apiReceive(action, from, data = null) {
    const handler = window.DevPages.logging.typeHandlers.API;
    return handler.logReceive(this, action, from, data);
  }

  system(action, message, payload = null) {
    return this.info('SYSTEM', action, message, payload);
  }

  user(action, message, payload = null) {
    return this.info('USER', action, message, payload);
  }
};

// Factory function following 006.md recommendations
window.DevPages.logging.createLogger = function(source, component = null, options = {}) {
  return new window.DevPages.logging.Logger(source, component, options);
};

// Bridge for PJA Games SDK (007.md compatibility)
window.PjaGames.logging.createLogger = window.DevPages.logging.createLogger;
window.PjaGames.logging.Logger = window.DevPages.logging.Logger;
window.PjaGames.logging.config = window.DevPages.logging.config;
window.PjaGames.logging.typeHandlers = window.DevPages.logging.typeHandlers;

// Enhanced global directLog function for backward compatibility
window.directLog = function(level, from, to, type, action, message, data = null) {
  // Create temporary logger if none exists
  const logger = new window.DevPages.logging.Logger(from || 'GLOBAL', null, {
    enableConsole: true,
    enablePanel: true
  });
  
  return logger.log(level, type, action, message, data);
};

// Setup controls following 007.md pattern
window.DevPages.logging.setupControls = function(loggerInstance, controlsConfig = {}) {
  if (!loggerInstance.options.containerId) return;
  
  const containerId = loggerInstance.options.containerId;
  const {
    clearButtonSelector = `[data-action="${containerId}-clear"]`,
    toggleOrderButtonSelector = `[data-action="${containerId}-toggle-order"]`,
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
};

// === PJA GAME API INTEGRATION ===
// Simple clean pjaGameApi inspired by pjaSdk.module.js

window.DevPages.logging.pjaGameApi = {
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
    const logger = window.DevPages.logging.createLogger(role, 'API');
    
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
        logger.apiSend(action, to, data);
        
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
        logger.apiReceive(action, from, data);
        
        return apiEntry;
      },
      
      // Convenience methods for game actions
      gameLoaded: () => logger.apiSend('GAME_LOADED', 'HOST'),
      gameStarted: () => logger.apiSend('GAME_STARTED', 'HOST'),
      gameEnded: (score) => logger.apiSend('GAME_ENDED', 'HOST', { score }),
      submitScore: (score) => logger.apiSend('SUBMIT_SCORE', 'SERVER', { score }),
      authenticate: (token) => logger.apiSend('AUTHENTICATE', 'SERVER', { token })
    };
  }
};

// Export for module usage
export const Logger = window.DevPages.logging.Logger;
export const createLogger = window.DevPages.logging.createLogger;
export const setupControls = window.DevPages.logging.setupControls;
export const typeHandlers = window.DevPages.logging.typeHandlers;
export const pjaGameApi = window.DevPages.logging.pjaGameApi;

console.log('[DevPages.logging] Unified logging system with TYPE handlers and API parsers initialized'); 