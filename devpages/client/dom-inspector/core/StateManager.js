/**
 * client/dom-inspector/core/StateManager.js
 * Centralized state management for the DOM Inspector
 */

import { appStore } from "/client/appState.js";
import { dispatch, ActionTypes } from "/client/messaging/messageQueue.js";

const DOM_INSPECTOR_STATE_KEY = 'devpages_dom_inspector_state';

export class StateManager {
    constructor() {
        this.stateUnsubscribe = null;
        this.listeners = new Map(); // Event listeners for state changes
    }

    /**
     * Initialize the state manager and subscribe to store changes
     */
    initialize() {
        // Load persisted state if available
        const persistedState = this.loadPersistedState();
        if (persistedState) {
            dispatch({
                type: ActionTypes.DOM_INSPECTOR_SET_STATE,
                payload: persistedState
            });
        }

        // Subscribe to store changes
        this.subscribeToStore();
    }

    /**
     * Load persisted state from localStorage
     * @returns {Object|null} Persisted state or null if not found
     */
    loadPersistedState() {
        try {
            const savedState = localStorage.getItem(DOM_INSPECTOR_STATE_KEY);
            if (savedState) {
                return JSON.parse(savedState);
            }
        } catch (e) {
            console.error('Failed to load DOM Inspector state:', e);
        }
        return null;
    }

    /**
     * Persist current state to localStorage
     * @param {Object} state - State to persist
     */
    persistState(state) {
        try {
            localStorage.setItem(DOM_INSPECTOR_STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to persist DOM Inspector state:', e);
        }
    }

    /**
     * Subscribe to store changes
     */
    subscribeToStore() {
        this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
            const oldInspectorState = prevState.domInspector;
            const newInspectorState = newState.domInspector;

            console.log('[GENERAL] StateManager: Store subscription triggered');
            console.log('[GENERAL] StateManager: Old visible =', oldInspectorState.visible);
            console.log('[GENERAL] StateManager: New visible =', newInspectorState.visible);

            let hasChanges = false;

            // Emit specific change events only when values actually changed
            if (oldInspectorState.visible !== newInspectorState.visible) {
                console.log('[GENERAL] StateManager: Visibility changed, emitting visibilityChanged event');
                this.emit('visibilityChanged', newInspectorState.visible, oldInspectorState.visible);
                hasChanges = true;
            }

            if (JSON.stringify(oldInspectorState.position) !== JSON.stringify(newInspectorState.position)) {
                this.emit('positionChanged', newInspectorState.position, oldInspectorState.position);
                hasChanges = true;
            }

            if (JSON.stringify(oldInspectorState.size) !== JSON.stringify(newInspectorState.size)) {
                this.emit('sizeChanged', newInspectorState.size, oldInspectorState.size);
                hasChanges = true;
            }

            if (JSON.stringify(oldInspectorState.highlight) !== JSON.stringify(newInspectorState.highlight)) {
                this.emit('highlightChanged', newInspectorState.highlight, oldInspectorState.highlight);
                hasChanges = true;
            }

            if (JSON.stringify(oldInspectorState.selectorHistory) !== JSON.stringify(newInspectorState.selectorHistory)) {
                this.emit('historyChanged', newInspectorState.selectorHistory, oldInspectorState.selectorHistory);
                hasChanges = true;
            }

            if (JSON.stringify(oldInspectorState.collapsedSections) !== JSON.stringify(newInspectorState.collapsedSections)) {
                this.emit('sectionsChanged', newInspectorState.collapsedSections, oldInspectorState.collapsedSections);
                hasChanges = true;
            }

            if (JSON.stringify(oldInspectorState.treeState) !== JSON.stringify(newInspectorState.treeState)) {
                this.emit('treeStateChanged', newInspectorState.treeState, oldInspectorState.treeState);
                hasChanges = true;
            }

            if (oldInspectorState.splitPosition !== newInspectorState.splitPosition) {
                this.emit('splitPositionChanged', newInspectorState.splitPosition, oldInspectorState.splitPosition);
                hasChanges = true;
            }

            // Only emit general state change event if there were actual changes
            if (hasChanges) {
                console.log('[GENERAL] StateManager: emit() called for event: stateChanged args:', [newInspectorState, oldInspectorState]);
                this.emit('stateChanged', newInspectorState, oldInspectorState);
                
                // Persist state changes only when there are actual changes
                this.persistState(newInspectorState);
            } else {
                console.log('[GENERAL] StateManager: Has listeners for event: false');
            }
        });
    }

    /**
     * Get current DOM Inspector state
     * @returns {Object} Current state
     */
    getState() {
        return appStore.getState().domInspector;
    }

    /**
     * Set panel visibility
     * @param {boolean} visible - Whether panel should be visible
     */
    setVisible(visible) {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_VISIBLE, payload: visible });
    }

    /**
     * Set panel position
     * @param {Object} position - Position object with x and y properties
     */
    setPosition(position) {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_POSITION, payload: position });
    }

    /**
     * Set panel size
     * @param {Object} size - Size object with width and height properties
     */
    setSize(size) {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_SIZE, payload: size });
    }

    /**
     * Set split position
     * @param {number} splitPosition - Split position as percentage (0-100)
     */
    setSplitPosition(splitPosition) {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_SPLIT_POSITION, payload: splitPosition });
    }

    /**
     * Set highlight settings
     * @param {Object} highlight - Highlight settings object
     */
    setHighlight(highlight) {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_HIGHLIGHT, payload: highlight });
    }

    /**
     * Add selector to history
     * @param {string} selector - CSS selector to add
     */
    addToHistory(selector) {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_ADD_SELECTOR_HISTORY, payload: selector });
    }

    /**
     * Remove selector from history
     * @param {string} selector - CSS selector to remove
     */
    removeFromHistory(selector) {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_REMOVE_SELECTOR_HISTORY, payload: selector });
    }

    /**
     * Set section collapsed state
     * @param {string} id - Section ID
     * @param {boolean} collapsed - Whether section should be collapsed
     */
    setSectionCollapsed(id, collapsed) {
        dispatch({
            type: ActionTypes.DOM_INSPECTOR_SET_SECTION_COLLAPSED,
            payload: { id, collapsed }
        });
    }

    /**
     * Set tree state
     * @param {Object} treeState - Tree state object
     */
    setTreeState(treeState) {
        dispatch({
            type: ActionTypes.DOM_INSPECTOR_SET_TREE_STATE,
            payload: treeState
        });
    }

    /**
     * Set selected element
     * @param {Object} element - The selected element
     */
    setSelectedElement(element) {
        // Don't store the DOM element in state as it can't be serialized
        // Instead, emit the element selection event directly to listeners
        console.log('[GENERAL] StateManager: Setting selected element (not storing in state):', element);
        this.emit('selectedElementChanged', element, null);
    }

    /**
     * Get selector history
     * @returns {Array} Array of selector strings
     */
    getSelectorHistory() {
        return this.getState().selectorHistory || [];
    }

    /**
     * Get collapsed sections
     * @returns {Object} Object mapping section IDs to collapsed state
     */
    getCollapsedSections() {
        return this.getState().collapsedSections || {};
    }

    /**
     * Get tree state
     * @returns {Object} Tree state object
     */
    getTreeState() {
        return this.getState().treeState || {};
    }

    /**
     * Check if panel is visible
     * @returns {boolean} True if panel is visible
     */
    isVisible() {
        return this.getState().visible;
    }

    /**
     * Get current position
     * @returns {Object} Position object with x and y properties
     */
    getPosition() {
        return this.getState().position;
    }

    /**
     * Get current size
     * @returns {Object} Size object with width and height properties
     */
    getSize() {
        return this.getState().size;
    }

    /**
     * Get highlight settings
     * @returns {Object} Highlight settings object
     */
    getHighlight() {
        return this.getState().highlight;
    }

    /**
     * Get split position
     * @returns {number} Split position as percentage
     */
    getSplitPosition() {
        return this.getState().splitPosition || 33; // Default to 33%
    }

    /**
     * Add event listener for state changes
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    /**
     * Remove event listener for state changes
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Emit event to listeners
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to listeners
     */
    emit(event, ...args) {
        console.log(`[GENERAL] StateManager: emit() called for event: ${event} args:`, args);
        if (this.listeners.has(event)) {
            console.log(`[GENERAL] StateManager: Has listeners for event: true`);
            this.listeners.get(event).forEach(callback => callback(...args));
        } else {
            console.log(`[GENERAL] StateManager: Has listeners for event: false`);
        }
    }

    /**
     * Reset the DOM Inspector state to its initial values
     */
    resetState() {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_RESET_STATE });
        this.persistState(appStore.getState().domInspector);
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        this.listeners.clear();
        console.log('StateManager destroyed');
    }
} 