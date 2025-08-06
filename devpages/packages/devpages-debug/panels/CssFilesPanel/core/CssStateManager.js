/**
 * client/settings/panels/css-files/core/CssStateManager.js
 * Centralized state management for the CSS Files Panel
 */

// REMOVED: messageQueue import (file deleted)

const CSS_FILES_STATE_KEY = 'devpages_css_files_state';

export class CssStateManager {
    constructor() {
        this.state = {
            collapsedSections: {},
            lastRefresh: null,
            filters: {
                showDisabled: true,
                showEnabled: true,
                searchTerm: ''
            }
        };
        
        this.listeners = new Map();
        this.storageKey = 'css-files-panel-state';
    }

    /**
     * Initialize the state manager
     */
    initialize() {
        this.loadState();
        console.log('[CssStateManager] Initialized with state:', this.state);
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsedState = JSON.parse(saved);
                this.state = { ...this.state, ...parsedState };
            }
        } catch (error) {
            console.warn('[CssStateManager] Error loading state:', error);
        }
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('[CssStateManager] Error saving state:', error);
        }
    }

    /**
     * Get collapsed sections
     */
    getCollapsedSections() {
        return this.state.collapsedSections;
    }

    /**
     * Toggle section collapsed state
     */
    toggleSection(sectionId) {
        this.state.collapsedSections[sectionId] = !this.state.collapsedSections[sectionId];
        this.saveState();
        this.emit('sectionsChanged', this.state.collapsedSections);
    }

    /**
     * Set section collapsed state
     */
    setSectionCollapsed(sectionId, collapsed) {
        this.state.collapsedSections[sectionId] = collapsed;
        this.saveState();
        this.emit('sectionsChanged', this.state.collapsedSections);
    }

    /**
     * Get filters
     */
    getFilters() {
        return this.state.filters;
    }

    /**
     * Update filters
     */
    updateFilters(newFilters) {
        this.state.filters = { ...this.state.filters, ...newFilters };
        this.saveState();
        this.emit('filtersChanged', this.state.filters);
    }

    /**
     * Set last refresh time
     */
    setLastRefresh(timestamp) {
        this.state.lastRefresh = timestamp;
        this.saveState();
    }

    /**
     * Get last refresh time
     */
    getLastRefresh() {
        return this.state.lastRefresh;
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Emit event
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('[CssStateManager] Error in event listener:', error);
                }
            });
        }
    }

    /**
     * Destroy the state manager
     */
    destroy() {
        this.saveState();
        this.listeners.clear();
        console.log('[CssStateManager] Destroyed');
    }
} 