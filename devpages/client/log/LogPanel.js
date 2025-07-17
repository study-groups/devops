/**
 * LogPanel.js
 * 
 * Updated to use the new log slice for state management.
 * This provides better app logging functionality with StateKit createSlice.
 */
import { appStore } from '/client/appState.js';
import { triggerActions } from '/client/actions.js';
import { appVer } from '/config.js';
import { setLogPanelInstance, logInfo, logError, logDebug, logWarn } from './LogCore.js';
import { createLogPanelDOM, createExpandedEntryToolbarDOM } from './logPanelDOM.js';
import { attachLogPanelEventListeners, removeLogPanelEventListeners } from './logPanelEvents.js';
import { updateLogEntryDisplay, enhanceCodeBlocksAndMermaid } from './logPanelEntryDisplay.js';
import { updateTagsBar, applyFiltersToLogEntries, initializeLogFilterBar } from './LogFilterBar.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

// Import log slice actions and selectors
import { 
    addEntry as addLogEntry,
    clearEntries as clearLogEntries,
    setActiveFilters,
    toggleFilter,
    setSearchTerm,
    selectLogEntries,
    selectFilteredEntries,
    selectActiveFilters,
    selectDiscoveredTypes,
    selectLogStats
} from '/client/store/slices/logSlice.js';

const MIN_LOG_HEIGHT = 80;

/**
 * LogPanel class.
 * Now integrated with the new log slice for better state management.
 */
export class LogPanel {
    constructor(containerElementId = 'log-container') {
        this.container = document.getElementById(containerElementId);
        if (!this.container) {
            logError(`Container element with ID '${containerElementId}' not found. LogPanel will not function.`, 'LOG_PANEL_SETUP');
            return;
        }

        // UI elements
        this.toolbarElement = null;
        this.tagsBarElement = null;
        this.logElement = null;
        this.statusElement = null;
        this.resizeHandle = null;
        this.minimizeButton = null;
        this.copyButton = null;
        this.clearButton = null;
        this.cliInputElement = null;
        this.appInfoElement = null;
        this.appVersionElement = null;

        // Panel state (not in global store)
        this._lastCommandSelection = null;
        this._selectionStateA = null;
        this._selectionStateB = null;
        this._codeFenceBufferA = null;
        this._codeFenceBufferB = null;
        this._updateTagsBarTimeout = null;
        this.isUpdatingFromState = false; // Flag to prevent circular dispatching

        // Render modes
        this.RENDER_MODE_RAW = 'raw';
        this.RENDER_MODE_MARKDOWN = 'markdown';
        this.RENDER_MODE_HTML = 'html';

        // Internal UI state (separate from global app state)
        this.internalState = {
            logOrder: localStorage.getItem('logOrder') || 'recent'
        };

        // Resize handling
        this._isResizing = false;
        this._startY = 0;
        this._startHeight = 0;

        // Bind methods
        this.startResize = this.startResize.bind(this);
        this._doResize = this.doResize.bind(this);
        this._endResize = this.endResize.bind(this);
        this.addEntry = this.addEntry.bind(this);
        this.copyLog = this.copyLog.bind(this);
        this.clearLog = this.clearLog.bind(this);
        this._updateLogEntryDisplay = this._updateLogEntryDisplay.bind(this);
        this._enhanceCodeBlocksAndMermaid = this._enhanceCodeBlocksAndMermaid.bind(this);

        // Store subscriptions
        this._appStateUnsubscribe = null;
        this._logStateUnsubscribe = null;
        this._uiStateUnsubscribe = null; // New subscription for UI state

        logInfo('LogPanel instance created with new log slice integration.', 'LOG_PANEL_LIFECYCLE');
        setLogPanelInstance(this);
    }

    initialize() {
        if (!this.container) return;

        createLogPanelDOM(this, appVer);
        
        // Subscribe to the store to sync the component with global state
        this.subscribeToStore();

        // Manually attach event listeners for resizing, etc.
        attachLogPanelEventListeners(this);

        if (typeof window !== 'undefined') window.logPanel = this;
        logInfo('LogPanel UI initialized and subscribed to new log slice.', 'LOG_PANEL_LIFECYCLE');
    }

    /**
     * Subscribes the component to the appStore to keep its UI in sync with the global state.
     */
    subscribeToStore() {
        // Unsubscribe from previous subscriptions
        if (this._appStateUnsubscribe) {
            this._appStateUnsubscribe();
        }
        if (this._logStateUnsubscribe) {
            this._logStateUnsubscribe();
        }
        if (this._uiStateUnsubscribe) { // Unsubscribe new subscription
            this._uiStateUnsubscribe();
        }

        // Subscribe to UI state changes (visibility and height)
        this._uiStateUnsubscribe = appStore.subscribe((newState, oldState) => {
            if (newState.ui.logVisible !== oldState.ui.logVisible || newState.ui.logHeight !== oldState.ui.logHeight) {
                // Removed verbose console logging to prevent spam
                this.isUpdatingFromState = true; // Prevent circular dispatching during UI updates
                try {
                    this.syncWithState(newState.ui);
                } finally {
                    this.isUpdatingFromState = false; // Always reset the flag
                }
            }
        });

        // Subscribe to log state changes  
        this._logStateUnsubscribe = appStore.subscribe((newState, oldState) => {
            // Check if log entries or filters changed
            const logChanged = newState.log !== oldState.log;
            
            if (logChanged) {
                // Removed verbose console logging to prevent spam
                this.isUpdatingFromState = true; // Prevent circular dispatching
                try {
                    this.updateLogDisplay();
                    this.updateEntryCount();
                    this._updateTagsBar();
                } finally {
                    this.isUpdatingFromState = false; // Always reset the flag
                }
            }
        });
        
        // Immediately sync with the current state upon subscription
        // Removed verbose console logging to prevent spam
        this.syncWithState(appStore.getState().ui);
        this.updateLogDisplay();
        this.updateEntryCount();
        this._updateTagsBar();
    }

    /**
     * Centralized method to update the LogPanel's DOM to match the global app state.
     */
    syncWithState(uiState) {
        console.log('[LogPanel] syncWithState called with:', uiState);
        
        if (!this.container || !uiState) {
            console.log('[LogPanel] syncWithState early return - container:', !!this.container, 'uiState:', !!uiState);
            return;
        }
        
        const { logVisible, logHeight } = uiState;
        console.log('[LogPanel] Applying visibility:', logVisible, 'height:', logHeight);

        // Set the CSS variable FIRST before applying classes
        document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
        
        // Force a reflow to ensure the CSS variable is processed
        this.container.offsetHeight;

        // Sync visibility
        this.container.classList.toggle('log-visible', logVisible);
        this.container.classList.toggle('log-hidden', !logVisible);
        
        // Remove any conflicting 'hidden' class
        this.container.classList.remove('hidden');
        
        console.log('[LogPanel] Container classes after update:', this.container.classList.toString());
    }

    /**
     * Updates the log display based on the current log state
     */
    updateLogDisplay() {
        if (!this.logElement) return;

        const state = appStore.getState();
        const filteredEntries = selectFilteredEntries(state);
        
        // Clear current display
        this.logElement.innerHTML = '';

        // Render filtered entries
        filteredEntries.forEach((entry, index) => {
            this.renderLogEntry(entry, index);
        });

        // Apply filters to newly rendered entries
        this.applyCurrentFilters();
    }

    /**
     * Renders a single log entry to the DOM
     */
    renderLogEntry(entry, index) {
        if (!this.logElement) return;

        const logEntryDiv = document.createElement('div');
        logEntryDiv.className = 'log-entry';

        // TIME
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'log-entry-timestamp';
        timestampSpan.textContent = entry.formattedTime || new Date(entry.timestamp).toLocaleTimeString();

        // LEVEL
        const levelSpan = document.createElement('span');
        levelSpan.className = 'log-entry-level';
        levelSpan.textContent = entry.level || 'INFO';

        // TYPE
        const typeSpan = document.createElement('span');
        typeSpan.className = 'log-entry-type';
        typeSpan.textContent = entry.type || 'GENERAL';

        // SOURCE/COMPONENT
        const originSpan = document.createElement('span');
        originSpan.className = 'log-entry-origin';
        const origin = entry.component ? `${entry.source}-${entry.component}` : entry.source;
        originSpan.textContent = origin || 'SYSTEM';

        // ACTION (if present)
        let actionSpan = null;
        if (entry.action) {
            actionSpan = document.createElement('span');
            actionSpan.className = 'log-entry-action';
            actionSpan.textContent = entry.action;
        }

        // MESSAGE
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-entry-message';
        messageSpan.textContent = entry.message || '';

        // COPY button
        const copyButton = document.createElement('button');
        copyButton.className = 'original-button';
        copyButton.innerHTML = `<img src="/client/styles/icons/copy.svg" alt="Copy" width="14" height="14">`;
        copyButton.title = 'Copy Original Message';
        copyButton.dataset.logText = entry.message || '';

        // Assemble the entry
        logEntryDiv.appendChild(timestampSpan);
        logEntryDiv.appendChild(levelSpan);
        logEntryDiv.appendChild(typeSpan);
        logEntryDiv.appendChild(originSpan);
        if (actionSpan) {
            logEntryDiv.appendChild(actionSpan);
        }
        logEntryDiv.appendChild(messageSpan);
        logEntryDiv.appendChild(copyButton);

        // Set data attributes
        logEntryDiv.dataset.logType = entry.type || 'GENERAL';
        logEntryDiv.dataset.logLevel = entry.level || 'INFO';
        logEntryDiv.dataset.logSource = entry.source || 'UNKNOWN';
        logEntryDiv.dataset.renderMode = this.RENDER_MODE_RAW;
        logEntryDiv.dataset.logIndex = index.toString();
        logEntryDiv.dataset.logTimestamp = entry.formattedTime || new Date(entry.timestamp).toLocaleTimeString();
        logEntryDiv.dataset.entryId = entry.id;

        // Insert based on log order
        if (this.internalState.logOrder === 'recent') {
            this.logElement.insertBefore(logEntryDiv, this.logElement.firstChild);
        } else {
            this.logElement.appendChild(logEntryDiv);
        }
    }

    /**
     * Adds a log entry to the store (with safety against reducer dispatch)
     * @param {Object} entryData - The log entry data
     * @param {string} legacyTypeArgument - Legacy type argument for backward compatibility
     */
    addEntry(entryData, legacyTypeArgument = 'text') {
        let logEntry;

        if (entryData && typeof entryData === 'object' && entryData.message !== undefined) {
            // Handle structured log object
            logEntry = {
                message: entryData.message,
                level: entryData.level || 'INFO',
                source: entryData.source || 'UNKNOWN',
                component: entryData.component || null,
                type: entryData.type || 'GENERAL',
                action: entryData.action || null,
                details: entryData.details || null,
                caller: entryData.caller || null
            };
        } else {
            // Handle legacy string entry
            logEntry = {
                message: String(entryData),
                level: 'INFO',
                source: 'LEGACY',
                type: legacyTypeArgument.toUpperCase(),
                action: null,
                details: null,
                caller: null
            };
        }

        // Use setTimeout to break out of any reducer context
        setTimeout(() => {
            try {
                dispatch({ type: ActionTypes.LOG_ADD_ENTRY, payload: logEntry });
            } catch (error) {
                console.error('[LogPanel] Failed to dispatch log entry:', error);
            }
        }, 0);
    }

    /**
     * Clears all log entries using the new log slice
     */
    clearLog() {
        dispatch({ type: ActionTypes.LOG_CLEAR_ENTRIES });
        logInfo('Log cleared using new log slice.', 'LOG_PANEL_STATE');
    }

    /**
     * Sets the log order and updates display
     */
    setLogOrder(order) {
        if (!this.logElement) return;
        
        this.internalState.logOrder = order;
        localStorage.setItem('logOrder', order);
        
        // Re-render with new order
        this.updateLogDisplay();
        
        logInfo(`Log order set to: ${order}`, 'LOG_PANEL_STATE');
    }

    /**
     * Updates the entry count display
     */
    updateEntryCount() {
        if (!this.statusElement) return;
        
        const state = appStore.getState();
        const stats = selectLogStats(state);
        
        let statusText = `${stats.totalEntries} entries`;
        
        if (stats.filteredEntries !== stats.totalEntries) {
            statusText += ` (${stats.filteredEntries} filtered)`;
        }
        
        if (stats.discoveredTypes > 0) {
            statusText += `, ${stats.discoveredTypes} types`;
        }
        
        this.statusElement.textContent = statusText;
    }

    /**
     * Updates discovered types for filter bar
     */
    _updateDiscoveredTypes(newType) {
        // This is now handled automatically by the log slice
        // when entries are added via addEntry action
        console.log('[LogPanel] Type discovery now handled by log slice:', newType);
    }

    /**
     * Updates the tags bar based on current log state
     */
    _updateTagsBar() {
        if (!this.tagsBarElement) return;

        // Clear any existing timeout
        if (this._updateTagsBarTimeout) {
            clearTimeout(this._updateTagsBarTimeout);
        }

        // Debounce the update
        this._updateTagsBarTimeout = setTimeout(() => {
            const state = appStore.getState();
            const discoveredTypes = selectDiscoveredTypes(state);
            const activeFilters = selectActiveFilters(state);
            
            // Create a state object for updateTagsBar
            const logFilteringState = {
                discoveredTypes,
                activeFilters
            };
            
            updateTagsBar(this.tagsBarElement, logFilteringState);
        }, 100);
    }

    /**
     * Apply current filters to log entries
     */
    applyCurrentFilters() {
        if (!this.logElement) return;
        
        const state = appStore.getState();
        const activeFilters = selectActiveFilters(state);
        
        applyFiltersToLogEntries(this.logElement, activeFilters);
    }

    /**
     * Copy current log entries to clipboard
     */
    copyLog() {
        const state = appStore.getState();
        const entries = selectFilteredEntries(state);
        
        if (entries.length === 0) {
            logInfo('No log entries to copy.', 'LOG_PANEL_ACTION');
            return;
        }

        const logText = entries.map(entry => {
            const timestamp = entry.formattedTime || new Date(entry.timestamp).toLocaleTimeString();
            const origin = entry.component ? `${entry.source}-${entry.component}` : entry.source;
            const action = entry.action ? `[${entry.action}]` : '';
            return `[${timestamp}] [${entry.level}] [${entry.type}] [${origin}] ${action} ${entry.message}`;
        }).join('\n');

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(logText).then(() => {
                logInfo(`Copied ${entries.length} log entries to clipboard.`, 'LOG_PANEL_ACTION');
            }).catch(err => {
                logError(`Failed to copy log to clipboard: ${err.message}`, 'LOG_PANEL_ACTION');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = logText;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                logInfo(`Copied ${entries.length} log entries to clipboard.`, 'LOG_PANEL_ACTION');
            } catch (err) {
                logError(`Failed to copy log to clipboard: ${err.message}`, 'LOG_PANEL_ACTION');
            }
            document.body.removeChild(textArea);
        }
    }

    // Resize functionality
    startResize(e) {
        this._isResizing = true;
        this._startY = e.clientY;
        this._startHeight = parseInt(document.documentElement.style.getPropertyValue('--log-height'), 10) || 200;
        e.preventDefault();
    }

    doResize(e) {
        if (!this._isResizing) return;
        const deltaY = this._startY - e.clientY;
        const newHeight = Math.max(MIN_LOG_HEIGHT, this._startHeight + deltaY);
        
        document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
        
        // Update the store
        dispatch({ 
            type: ActionTypes.UI_SET_LOG_HEIGHT, 
            payload: { height: newHeight } 
        });
    }

    endResize() {
        this._isResizing = false;
    }

    // Method delegation for backward compatibility
    _updateLogEntryDisplay(...args) {
        return updateLogEntryDisplay(...args);
    }

    _enhanceCodeBlocksAndMermaid(...args) {
        return enhanceCodeBlocksAndMermaid(...args);
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this._appStateUnsubscribe) {
            this._appStateUnsubscribe();
        }
        if (this._logStateUnsubscribe) {
            this._logStateUnsubscribe();
        }
        if (this._uiStateUnsubscribe) { // Unsubscribe new subscription
            this._uiStateUnsubscribe();
        }
        if (this._updateTagsBarTimeout) {
            clearTimeout(this._updateTagsBarTimeout);
        }
        
        removeLogPanelEventListeners(this);
        
        logInfo('LogPanel destroyed and unsubscribed from store.', 'LOG_PANEL_LIFECYCLE');
    }
} 