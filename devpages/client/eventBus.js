/**
 * client/eventBus.js
 * A simple event bus implementation for loose component coupling and communication.
 * 
 * The EventBus follows the publish-subscribe pattern allowing components to communicate
 * without direct dependencies. Components can emit events and subscribe to events
 * from other components.
 * 
 * Common event naming convention: 'domain:action'
 * Examples: 'editor:contentChanged', 'auth:loginRequested', 'file:save'
 */
import { logEventBusEvent } from './store/slices/commSlice.js';

// Store injection to break circular dependency with appState.js
let _appStore = null;
export function setEventBusStore(store) {
    _appStore = store;
}

export class EventBus {
    constructor() {
        this.handlers = new Map();
        // Track subscriptions by source (panel ID, component ID, etc.) for cleanup
        this.sourceSubscriptions = new Map();
    }

    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
        return this;
    }

    off(event, handler) {
        const handlers = this.handlers.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
        return this;
    }

    /**
     * Subscribe with source tracking for automatic cleanup
     * @param {string} sourceId - ID of subscribing component (panel ID, etc.)
     * @param {string} eventName - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} Unsubscribe function
     */
    subscribeAs(sourceId, eventName, handler) {
        if (!sourceId || !eventName || typeof handler !== 'function') {
            console.error('[EventBus] Invalid subscribeAs parameters', { sourceId, eventName });
            return () => {};
        }

        // Track subscription for cleanup
        if (!this.sourceSubscriptions.has(sourceId)) {
            this.sourceSubscriptions.set(sourceId, []);
        }

        // Wrap handler for error handling
        const wrappedHandler = (data) => {
            try {
                const result = handler(data);
                if (result && typeof result.catch === 'function') {
                    result.catch(error => {
                        console.error(`[EventBus] Async error in handler for ${eventName} (source: ${sourceId}):`, error);
                    });
                }
            } catch (error) {
                console.error(`[EventBus] Error in handler for ${eventName} (source: ${sourceId}):`, error);
            }
        };

        this.on(eventName, wrappedHandler);
        this.sourceSubscriptions.get(sourceId).push({ eventName, handler: wrappedHandler });

        // Return unsubscribe function
        return () => {
            this.off(eventName, wrappedHandler);
            this._removeSourceSubscription(sourceId, wrappedHandler);
        };
    }

    /**
     * Clean up all subscriptions for a source
     * @param {string} sourceId - Source ID to cleanup
     */
    cleanupSource(sourceId) {
        const subs = this.sourceSubscriptions.get(sourceId);
        if (!subs) return;

        for (const { eventName, handler } of subs) {
            this.off(eventName, handler);
        }
        this.sourceSubscriptions.delete(sourceId);
        console.log(`[EventBus] Cleaned up subscriptions for source: ${sourceId}`);
    }

    /**
     * Get all sources with active subscriptions
     * @returns {string[]} Array of source IDs
     */
    getActiveSources() {
        return Array.from(this.sourceSubscriptions.keys());
    }

    /**
     * Get subscription count for a source
     * @param {string} sourceId
     * @returns {number}
     */
    getSourceSubscriptionCount(sourceId) {
        const subs = this.sourceSubscriptions.get(sourceId);
        return subs ? subs.length : 0;
    }

    /**
     * @private
     */
    _removeSourceSubscription(sourceId, handler) {
        const subs = this.sourceSubscriptions.get(sourceId);
        if (!subs) return;

        const index = subs.findIndex(s => s.handler === handler);
        if (index !== -1) {
            subs.splice(index, 1);
        }
        if (subs.length === 0) {
            this.sourceSubscriptions.delete(sourceId);
        }
    }

    emit(eventName, data) {
        const logEntry = {
            name: eventName,
            payload: data,
            timestamp: new Date().toISOString()
        };
        if (_appStore) {
            _appStore.dispatch(logEventBusEvent(logEntry));
        }

        if (!this.handlers.has(eventName)) {
            return;
        }
        
        const handlers = this.handlers.get(eventName);
        handlers.forEach(handler => {
            try {
                const result = handler(data);
                if (result && typeof result.catch === 'function') {
                    result.catch(error => {
                        console.error(`[EventBus] Async error in event handler for ${eventName}:`, error);
                    });
                }
            } catch (error) {
                console.error(`[EventBus] Error in event handler for ${eventName}:`, error);
            }
        });
    }
}

// Create and export a singleton instance
export const eventBus = new EventBus();

// Also export as default for convenience
export default eventBus; 

/**
 * Common Events in DevPages:
 * 
 * Editor Events:
 * - 'editor:contentChanged' - Fired when editor content changes
 * - 'editor:initialized' - Fired when editor is initialized
 * - 'editor:save' - Request to save the current file
 * - 'editor:focus' - Editor gained focus
 * - 'editor:blur' - Editor lost focus
 * 
 * Navigation Events:
 * - 'navigate:pathname' - Navigate to specified path
 * - 'navigate:absolute' - Navigate to absolute path
 * - 'navigate:root' - Navigate to root directory
 * 
 * Auth Events:
 * - 'auth:loginRequested' - Login requested with credentials
 * 
 * UI Events:
 * - 'ui:viewModeChanged' - View mode changed (editor/preview/split)
 * - 'ui:renderFileList' - Request to render file list
 * 
 * Preview Events:
 * - 'preview:initialized' - Preview component initialized
 * - 'preview:updated' - Preview content updated
 * - 'preview:cssSettingsChanged' - CSS settings changed
 * 
 * File Events:
 * - 'file:save' - Request to save current file
 * 
 * Image Events:
 * - 'image:uploaded' - Image upload completed
 * - 'image:uploadError' - Image upload failed
 * - 'image:deleted' - Image deleted
 * 
 * App Events:
 * - 'app:ready' - Application initialization complete
 *
 * Panel Events:
 * - 'panels:expandAll' - Request to expand ALL panels across ALL zones
 * - 'panels:collapseAll' - Request to collapse ALL panels across ALL zones  
 * - 'panels:toggleManager' - Request to toggle specific panel manager (source-specific)
 * - 'panels:toggleVisibility' - Request to toggle individual panel visibility (global)
 * - 'panels:toggleCollapse' - Request to toggle individual panel collapse state (global)
 * - 'panels:stateChanged' - Panel state has changed (global event for UI updates)
 * - 'panels:managerToggled' - Panel manager visibility toggled (source-specific)
 * - 'panels:panelVisibilityChanged' - Individual panel visibility changed (global)
 * - 'panels:panelCollapseChanged' - Individual panel collapse state changed (global)
 * - 'panels:panelRegistered' - New panel registered in system (global)
 * - 'panels:panelMounted' - Panel mounted/shown (global)
 * - 'panels:panelUnmounted' - Panel unmounted/hidden (global)
 *
 * A key benefit of using the EventBus is the ability to decouple
 * components. For example, the editor component can emit content changes
 * without knowing which components need to respond (preview, autosave, etc).
 * Similarly, panel management actions are broadcast via events so any component
 * can respond without tight coupling to the WorkspaceZone.
 */ 