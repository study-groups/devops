/**
 * Panel Event Bus System
 * Standardized message event patterns for DevPages settings panels
 * Integrates with the main application event bus for cross-system communication
 */

import { eventBus as mainEventBus } from '/client/eventBus.js';

// ===== EVENT TYPE CONSTANTS =====

export const PanelEvents = {
  // Theme-related events
  THEME_CHANGED: 'panel:theme:changed',
  THEME_VALIDATED: 'panel:theme:validated',
  THEME_EXPORT_REQUESTED: 'panel:theme:export',
  THEME_RELOAD_REQUESTED: 'panel:theme:reload',
  THEME_MODE_SWITCHED: 'panel:theme:mode:switched',
  
  // CSS-related events
  CSS_FILES_UPDATED: 'panel:css:files:updated',
  CSS_PREVIEW_REFRESH: 'panel:css:preview:refresh',
  CSS_VALIDATION_REQUESTED: 'panel:css:validation:requested',
  CSS_BUNDLING_CHANGED: 'panel:css:bundling:changed',
  
  // Cross-panel coordination
  PANEL_STATE_SYNC: 'panel:state:sync',
  PANEL_VALIDATION_REQUEST: 'panel:validation:request',
  PANEL_VALIDATION_RESPONSE: 'panel:validation:response',
  PANEL_DATA_REQUEST: 'panel:data:request',
  PANEL_DATA_RESPONSE: 'panel:data:response',
  
  // Publishing workflow
  PUBLISH_PREPARE: 'panel:publish:prepare',
  PUBLISH_STATUS: 'panel:publish:status',
  PUBLISH_COLLECT_DATA: 'panel:publish:collect:data',
  PUBLISH_VALIDATE_ALL: 'panel:publish:validate:all',
  
  // UI coordination
  UI_PANEL_FOCUS: 'panel:ui:focus',
  UI_PANEL_BLUR: 'panel:ui:blur',
  UI_NOTIFICATION: 'panel:ui:notification',
  UI_LOADING_STATE: 'panel:ui:loading',
  
  // System events
  SYSTEM_READY: 'panel:system:ready',
  SYSTEM_ERROR: 'panel:system:error',
  SYSTEM_DEBUG: 'panel:system:debug'
};

// ===== MESSAGE UTILITIES =====

let messageIdCounter = 0;

export function generateMessageId() {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

export function createPanelMessage(type, source, data, metadata = {}) {
  return {
    type,
    source,
    data,
    timestamp: Date.now(),
    id: generateMessageId(),
    ...metadata
  };
}

export function createValidationMessage(source, isValid, errors = [], data = {}) {
  return createPanelMessage(
    PanelEvents.PANEL_VALIDATION_RESPONSE,
    source,
    { isValid, errors, ...data },
    { responseType: 'validation' }
  );
}

export function createDataMessage(source, data, dataType = 'generic') {
  return createPanelMessage(
    PanelEvents.PANEL_DATA_RESPONSE,
    source,
    data,
    { responseType: 'data', dataType }
  );
}

// ===== ENHANCED EVENT BUS =====

export class PanelEventBus extends EventTarget {
  constructor() {
    super();
    this.debug = false;
    this.messageHistory = [];
    this.maxHistorySize = 100;
    this.pendingRequests = new Map();
    this.registeredPanels = new Set();
    
    // Integration with main event bus
    this.mainEventBus = mainEventBus;
    this.setupMainEventBusIntegration();
  }
  
  // ===== MAIN EVENT BUS INTEGRATION =====
  
  setupMainEventBusIntegration() {
    // Bridge panel events to main event bus for application-wide coordination
    this.addEventListener('*', (event) => {
      const message = event.detail;
      
      // Emit corresponding main event bus events for key panel changes
      switch (message.type) {
        case PanelEvents.THEME_CHANGED:
          this.mainEventBus.emit('preview:cssSettingsChanged', {
            reason: 'theme_changed',
            themeData: message.data
          });
          break;
          
        case PanelEvents.CSS_FILES_UPDATED:
          this.mainEventBus.emit('preview:cssSettingsChanged', {
            reason: 'css_files_updated',
            cssData: message.data
          });
          break;
          
        case PanelEvents.CSS_PREVIEW_REFRESH:
          this.mainEventBus.emit('preview:updated', {
            reason: 'panel_refresh_request',
            source: message.source
          });
          break;
      }
    });
    
    // Listen to main event bus for application events that affect panels
    this.mainEventBus.on('editor:contentChanged', (data) => {
      this.emit(PanelEvents.PANEL_STATE_SYNC, {
        trigger: 'editor_content_changed',
        editorData: data
      }, 'main-event-bus');
    });
    
    this.mainEventBus.on('auth:loginRequested', (data) => {
      this.emit(PanelEvents.SYSTEM_READY, {
        trigger: 'auth_state_changed',
        authData: data
      }, 'main-event-bus');
    });
  }
  
  // ===== BASIC EVENT METHODS =====
  
  emit(type, data, source = 'unknown') {
    const message = typeof data === 'object' && data.type 
      ? data 
      : createPanelMessage(type, source, data);
    
    this.logMessage('EMIT', message);
    this.addToHistory(message);
    
    // Emit on our event bus
    this.dispatchEvent(new CustomEvent(type, { 
      detail: message,
      bubbles: false,
      cancelable: true
    }));
    
    // Also emit a wildcard event for integration purposes
    this.dispatchEvent(new CustomEvent('*', {
      detail: message,
      bubbles: false,
      cancelable: true
    }));
    
    return message.id;
  }
  
  on(type, handler, options = {}) {
    const wrappedHandler = (event) => {
      this.logMessage('RECEIVE', event.detail);
      try {
        handler(event.detail, event);
      } catch (error) {
        this.logError('Handler error', error, event.detail);
      }
    };
    
    this.addEventListener(type, wrappedHandler, options);
    return () => this.removeEventListener(type, wrappedHandler);
  }
  
  once(type, handler) {
    return this.on(type, handler, { once: true });
  }
  
  off(type, handler) {
    this.removeEventListener(type, handler);
  }
  
  // ===== REQUEST/RESPONSE PATTERN =====
  
  async request(type, data, options = {}) {
    const {
      timeout = 5000,
      source = 'unknown',
      expectMultiple = false,
      responseType = type + ':response'
    } = options;
    
    const requestId = generateMessageId();
    const requestMessage = createPanelMessage(type, source, data, { 
      requestId,
      expectsResponse: true,
      responseType
    });
    
    return new Promise((resolve, reject) => {
      const responses = [];
      let timeoutId;
      let responseHandler;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (responseHandler) responseHandler();
        this.pendingRequests.delete(requestId);
      };
      
      const handleResponse = (responseMessage) => {
        if (responseMessage.requestId === requestId || 
            responseMessage.data?.requestId === requestId) {
          
          if (expectMultiple) {
            responses.push(responseMessage);
            // For multiple responses, we need a different completion strategy
            // For now, we'll resolve after a short delay to collect responses
            if (!timeoutId) {
              timeoutId = setTimeout(() => {
                cleanup();
                resolve(responses);
              }, 100);
            }
          } else {
            cleanup();
            resolve(responseMessage);
          }
        }
      };
      
      // Set up timeout
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Request timeout after ${timeout}ms for ${type}`));
      }, timeout);
      
      // Listen for responses
      responseHandler = this.on(responseType, handleResponse);
      
      // Store pending request
      this.pendingRequests.set(requestId, {
        type,
        data,
        timestamp: Date.now(),
        resolve,
        reject,
        cleanup
      });
      
      // Send the request
      this.emit(type, requestMessage, source);
    });
  }
  
  respond(originalMessage, responseData, source = 'unknown') {
    const responseType = originalMessage.responseType || 
                        originalMessage.type + ':response';
    
    const responseMessage = createPanelMessage(
      responseType,
      source,
      responseData,
      { 
        requestId: originalMessage.requestId || originalMessage.id,
        originalType: originalMessage.type,
        responseToId: originalMessage.id
      }
    );
    
    this.emit(responseType, responseMessage, source);
    return responseMessage.id;
  }
  
  // ===== PANEL REGISTRATION =====
  
  registerPanel(panelId, panelInstance) {
    this.registeredPanels.add(panelId);
    this.logMessage('REGISTER', { panelId, type: 'panel_registration' });
    
    // Notify other panels of new registration
    this.emit(PanelEvents.SYSTEM_READY, {
      panelId,
      action: 'panel_registered'
    }, 'event-bus');
    
    // Notify main event bus
    this.mainEventBus.emit('ui:panelRegistered', {
      panelId,
      panelType: 'settings'
    });
    
    return () => this.unregisterPanel(panelId);
  }
  
  unregisterPanel(panelId) {
    this.registeredPanels.delete(panelId);
    this.logMessage('UNREGISTER', { panelId, type: 'panel_unregistration' });
    
    // Notify main event bus
    this.mainEventBus.emit('ui:panelUnregistered', {
      panelId,
      panelType: 'settings'
    });
  }
  
  getRegisteredPanels() {
    return Array.from(this.registeredPanels);
  }
  
  // ===== BROADCAST METHODS =====
  
  broadcast(type, data, source = 'unknown', excludePanels = []) {
    const message = createPanelMessage(type, source, data, {
      broadcast: true,
      excludePanels
    });
    
    this.emit(type, message, source);
    return message.id;
  }
  
  broadcastToType(panelType, type, data, source = 'unknown') {
    const message = createPanelMessage(type, source, data, {
      targetPanelType: panelType
    });
    
    this.emit(type, message, source);
    return message.id;
  }
  
  // ===== VALIDATION HELPERS =====
  
  async validateAcrossPanels(validationType, data, options = {}) {
    const { timeout = 3000, requiredPanels = [] } = options;
    
    try {
      const responses = await this.request(
        PanelEvents.PANEL_VALIDATION_REQUEST,
        { validationType, data, requiredPanels },
        { timeout, expectMultiple: true }
      );
      
      const results = {
        overall: true,
        panelResults: {},
        errors: [],
        warnings: []
      };
      
      responses.forEach(response => {
        const panelId = response.source;
        const { isValid, errors = [], warnings = [] } = response.data;
        
        results.panelResults[panelId] = { isValid, errors, warnings };
        
        if (!isValid) {
          results.overall = false;
          results.errors.push(...errors.map(err => `${panelId}: ${err}`));
        }
        
        results.warnings.push(...warnings.map(warn => `${panelId}: ${warn}`));
      });
      
      // Notify main event bus of validation results
      this.mainEventBus.emit('ui:validationCompleted', {
        validationType,
        results,
        panelCount: responses.length
      });
      
      return results;
    } catch (error) {
      this.logError('Cross-panel validation failed', error);
      
      // Notify main event bus of validation failure
      this.mainEventBus.emit('ui:validationFailed', {
        validationType,
        error: error.message
      });
      
      return {
        overall: false,
        panelResults: {},
        errors: [`Validation timeout: ${error.message}`],
        warnings: []
      };
    }
  }
  
  // ===== PUBLISHING WORKFLOW =====
  
  async collectPublishData(publishTarget = 'spaces') {
    try {
      const responses = await this.request(
        PanelEvents.PUBLISH_COLLECT_DATA,
        { target: publishTarget },
        { timeout: 5000, expectMultiple: true }
      );
      
      const collectedData = {
        target: publishTarget,
        timestamp: Date.now(),
        panels: {}
      };
      
      responses.forEach(response => {
        collectedData.panels[response.source] = response.data;
      });
      
      // Notify main event bus of successful data collection
      this.mainEventBus.emit('ui:publishDataCollected', {
        target: publishTarget,
        panelCount: responses.length,
        dataSize: JSON.stringify(collectedData).length
      });
      
      return collectedData;
    } catch (error) {
      this.logError('Failed to collect publish data', error);
      
      // Notify main event bus of collection failure
      this.mainEventBus.emit('ui:publishDataFailed', {
        target: publishTarget,
        error: error.message
      });
      
      throw error;
    }
  }
  
  // ===== DEBUGGING & LOGGING =====
  
  enableDebug(enabled = true) {
    this.debug = enabled;
    this.logMessage('DEBUG', { enabled, type: 'debug_mode_changed' });
  }
  
  logMessage(action, message) {
    if (this.debug) {
      console.log(`[PanelEventBus:${action}]`, message);
    }
  }
  
  logError(message, error, context = {}) {
    console.error(`[PanelEventBus:ERROR] ${message}`, error, context);
    this.emit(PanelEvents.SYSTEM_ERROR, {
      message,
      error: error.message,
      stack: error.stack,
      context
    }, 'event-bus');
    
    // Also notify main event bus
    this.mainEventBus.emit('app:error', {
      source: 'panel-event-bus',
      message,
      error: error.message
    });
  }
  
  addToHistory(message) {
    this.messageHistory.push({
      ...message,
      timestamp: Date.now()
    });
    
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }
  
  getMessageHistory(filterType = null) {
    if (filterType) {
      return this.messageHistory.filter(msg => msg.type === filterType);
    }
    return [...this.messageHistory];
  }
  
  clearHistory() {
    this.messageHistory = [];
  }
  
  // ===== UTILITY METHODS =====
  
  getStats() {
    return {
      registeredPanels: this.registeredPanels.size,
      pendingRequests: this.pendingRequests.size,
      messageHistory: this.messageHistory.length,
      debugEnabled: this.debug,
      mainEventBusIntegrated: !!this.mainEventBus
    };
  }
  
  destroy() {
    // Clean up pending requests
    this.pendingRequests.forEach(request => {
      request.cleanup();
    });
    this.pendingRequests.clear();
    
    // Clear registered panels
    this.registeredPanels.clear();
    
    // Clear history
    this.clearHistory();
    
    // Notify main event bus
    this.mainEventBus.emit('ui:panelEventBusDestroyed');
    
    // Remove all event listeners
    // Note: EventTarget doesn't have a removeAllListeners method
    // Individual panels should clean up their own listeners
  }
}

// ===== GLOBAL INSTANCE =====

export const panelEventBus = new PanelEventBus();

// Enable debug mode in development
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
  panelEventBus.enableDebug(true);
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.panelEventBus = panelEventBus;
}

// ===== HELPER FUNCTIONS =====

export function createPanelMixin(panelId) {
  return {
    setupEventBus() {
      this.panelId = panelId;
      this.eventBus = panelEventBus;
      this.unregisterPanel = this.eventBus.registerPanel(panelId, this);
      this.eventListeners = [];
    },
    
    on(type, handler) {
      const unsubscribe = this.eventBus.on(type, handler);
      this.eventListeners.push(unsubscribe);
      return unsubscribe;
    },
    
    emit(type, data) {
      return this.eventBus.emit(type, data, this.panelId);
    },
    
    request(type, data, options = {}) {
      return this.eventBus.request(type, data, {
        ...options,
        source: this.panelId
      });
    },
    
    respond(originalMessage, responseData) {
      return this.eventBus.respond(originalMessage, responseData, this.panelId);
    },
    
    destroyEventBus() {
      // Clean up event listeners
      this.eventListeners.forEach(unsubscribe => unsubscribe());
      this.eventListeners = [];
      
      // Unregister panel
      if (this.unregisterPanel) {
        this.unregisterPanel();
      }
    }
  };
} 