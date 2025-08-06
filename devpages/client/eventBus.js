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
import { appStore } from './appState.js';
import { logEventBusEvent } from './store/slices/commSlice.js';

export class EventBus {
    constructor() {
        this.handlers = new Map();
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

    emit(eventName, data) {
        const logEntry = {
            name: eventName,
            payload: data,
            timestamp: new Date().toISOString()
        };
        if (appStore) {
            appStore.dispatch(logEventBusEvent(logEntry));
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