/**
 * client/dom-inspector/core/StateManager.js
 * Centralized state management for the DOM Inspector
 */

import { appStore, dispatch } from '/client/appState.js';
import { DomUtils } from '../utils/DomUtils.js';
import { ElementManager } from '../managers/ElementManager.js';
import { setState } from '/client/store/slices/domInspectorSlice.js';

const log = window.APP.services.log.createLogger('DOMInspectorStateManager');

const DOM_INSPECTOR_STATE_KEY = 'devpages_dom_inspector_state';

export class StateManager {
    constructor() {
        this.domUtils = new DomUtils();
        this.elementManager = new ElementManager(this.domUtils);
        this.stateUnsubscribe = null;
        this.listeners = new Map(); // Event listeners for state changes
    }

    /**
     * Initialize the state manager and subscribe to store changes
     */
    initialize() {
        if (this.stateUnsubscribe) {
            // Already initialized
            return;
        }

        log.debug('DOM_INSPECTOR', 'INIT', 'Initializing DOM Inspector State Manager...');

        const loadedState = this.loadPersistedState();
        if (loadedState) {
            dispatch({ type: 'domInspector/setState', payload: loadedState });
            log.debug('DOM_INSPECTOR', 'LOADED_STATE', 'Dispatched loaded state to sync store.');
        } else {
            log.debug('DOM_INSPECTOR', 'NO_SAVED_STATE', 'No saved state found, using default state.');
        }

        let prevState = appStore.getState();
        this.stateUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            const oldInspectorState = prevState.domInspector || {};
            const newInspectorState = newState.domInspector || {};

            if (newInspectorState === oldInspectorState) {
                prevState = newState;
                return;
            }

            let hasChanges = false;

            if (oldInspectorState.visible !== newInspectorState.visible) {
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

            if (hasChanges) {
                this.emit('stateChanged', newInspectorState, oldInspectorState);
                this.persistState(newInspectorState);
            }

            prevState = newState;
        });
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
            log.error('DOM_INSPECTOR', 'LOAD_STATE_ERROR', 'Failed to load DOM Inspector state:', e);
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
            log.error('DOM_INSPECTOR', 'PERSIST_STATE_ERROR', 'Failed to persist DOM Inspector state:', e);
        }
    }

    /**
     * Helper to update parts of the DOM Inspector state
     * @param {Object} partialState - A partial state object to merge
     */
    updateState(partialState) {
        const currentState = this.getState() || {};
        dispatch(setState({ ...currentState, ...partialState }));
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
        this.updateState({ visible });
    }

    /**
     * Set panel position
     * @param {Object} position - Position object with x and y properties
     */
    setPosition(position) {
        this.updateState({ position });
    }

    /**
     * Set panel size
     * @param {Object} size - Size object with width and height properties
     */
    setSize(size) {
        this.updateState({ size });
    }

    /**
     * Set split position
     * @param {number} splitPosition - Split position as percentage (0-100)
     */
    setSplitPosition(splitPosition) {
        this.updateState({ splitPosition });
    }

    /**
     * Set highlight settings
     * @param {Object} highlight - Highlight settings object
     */
    setHighlight(highlight) {
        this.updateState({ highlight });
    }

    /**
     * Add selector to history
     * @param {string} selector - CSS selector to add
     */
    addToHistory(selector) {
        const history = this.getSelectorHistory();
        if (history.includes(selector)) return;
        const newHistory = [selector, ...history].slice(0, 20); // Keep last 20
        this.updateState({ selectorHistory: newHistory });
    }

    /**
     * Remove selector from history
     * @param {string} selector - CSS selector to remove
     */
    removeFromHistory(selector) {
        const history = this.getSelectorHistory();
        const newHistory = history.filter(s => s !== selector);
        this.updateState({ selectorHistory: newHistory });
    }

    /**
     * Set section collapsed state
     * @param {string} id - Section ID
     * @param {boolean} collapsed - Whether section should be collapsed
     */
    setSectionCollapsed(id, collapsed) {
        const collapsedSections = this.getCollapsedSections();
        this.updateState({
            collapsedSections: {
                ...collapsedSections,
                [id]: collapsed
            }
        });
    }

    /**
     * Set tree state
     * @param {Object} treeState - Tree state object
     */
    setTreeState(treeState) {
        this.updateState({ treeState });
    }

    /**
     * Set selected element
     * @param {Object} element - The selected element
     */
    setSelectedElement(element) {
        // Don't store the DOM element in state as it can't be serialized
        // Instead, emit the element selection event directly to listeners
        log.debug('DOM_INSPECTOR', 'SET_SELECTED_ELEMENT', 'Setting selected element (not storing in state):', { element });
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
        const state = this.getState();
        return state ? state.splitPosition || 33 : 33; // Default to 33%
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
        log.debug('DOM_INSPECTOR', 'EMIT_EVENT', `emit() called for event: ${event}`, { args });
        if (this.listeners.has(event)) {
            log.debug('DOM_INSPECTOR', 'HAS_LISTENERS', `Has listeners for event: true`);
            this.listeners.get(event).forEach(callback => callback(...args));
        } else {
            log.debug('DOM_INSPECTOR', 'NO_LISTENERS', `Has listeners for event: false`);
        }
    }

    /**
     * Reset the DOM Inspector state to its initial values
     */
    resetState() {
        dispatch({ type: 'domInspector/resetState' }); // This might need a dedicated reducer case
        const initialState = appStore.getState().domInspector;
        this.persistState(initialState);
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
        log.info('DOM_INSPECTOR', 'DESTROY', 'StateManager destroyed');
    }
} 