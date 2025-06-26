/**
 * LogPanel.js
 * Orchestrates the LogPanel component, delegating tasks to specialized modules.
 */
import { appStore } from '/client/appState.js';
import { triggerActions } from '/client/actions.js';
import { appVer } from '/config.js';
import { setLogPanelInstance, logInfo, logError, logDebug, logWarn } from './LogCore.js';
import { createLogPanelDOM, createExpandedEntryToolbarDOM } from './logPanelDOM.js'; // Import from new DOM module
import { attachLogPanelEventListeners, removeLogPanelEventListeners } from './logPanelEvents.js';
import { 
    loadLogPanelPreferences, 
    saveLogPanelPreferences as saveLogPanelPreferencesState,
    subscribeToAppStoreChanges,
    updateSelectionButtonUI
} from './logPanelState.js'; // Placeholder for state module
import {
    updateLogEntryDisplay,
    enhanceCodeBlocksAndMermaid,
    showTemporaryFeedback,
    expandLogEntry,
    collapseLogEntry
} from './logPanelEntryDisplay.js'; // Placeholder for entry display module
import {
    updateTagsBar,
    applyFiltersToLogEntries,
    initializeLogFilterBar
} from './LogFilterBar.js';

import eventBus from '/client/eventBus.js';

// ADD: Import markdown rendering function AND post-processing
import { renderMarkdown, postProcessRender } from '/client/preview/renderers/MarkdownRenderer.js';

// At the top of the file, import the logger
import { createTimer } from '/client/utils.js';

import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

const LOG_VISIBLE_KEY = 'logVisible';
const LOG_HEIGHT_KEY = 'logHeight';
const DEFAULT_LOG_HEIGHT = 150;
const MIN_LOG_HEIGHT = 80;

// Assuming updatePreview might be needed later
// import { updatePreview } from '../preview.js'; // Potential path? Check correct path.

// ADD: Import the necessary functions from uiState
// import { getUIState, setUIState, subscribeToUIStateChange } from '/client/uiState.js';

// <<< NEW: Logging helper for this module (for BROWSER CONSOLE ONLY to avoid recursion) >>>
function logPanelInternalDebug(message, level = 'debug') { // Renamed to be clear it's for internal console debugging
    const type = 'LOG_PANEL_INTERNAL'; 
    // ALWAYS use console for this internal helper to avoid recursion
    const logFunc = 
        level === 'error' ? console.error : 
        level === 'warn' ? console.warn : 
        level === 'debug' ? console.debug :
        console.log; 
        logFunc(`[${type}] ${message}`);
}

export class LogPanel {
    constructor(containerElementId = 'log-container') {
        this.container = document.getElementById(containerElementId);
        if (!this.container) {
            // Use logError for important setup issues that should be in the UI log
            logError(`Container element with ID '${containerElementId}' not found. LogPanel will not function.`, { type: 'LOG_PANEL_SETUP' });
            return; 
        }

        // --- Initialize internal elements to null initially --- 
        this.toolbarElement = null;
        this.tagsBarElement = null; // ADDED: For filter tags
        this.logElement = null;
        this.statusElement = null;
        this.resizeHandle = null;
        this.minimizeButton = null;
        this.copyButton = null;
        this.clearButton = null;
        this.cliInputElement = null; // Add CLI input element
        this.appInfoElement = null; // Add App Info element
        this.appVersionElement = null; // Add element property
        // Buttons are now found via toolbarElement or have data-actions

        // <<< NEW: Store selection details for $$ command >>>
        this._lastCommandSelection = null;
        // <<< NEW: Store persistent selection states >>>
        this._selectionStateA = null; // { filePath: string, start: number, end: number, text: string }
        this._selectionStateB = null; // { filePath: string, start: number, end: number, text: string }

        // <<< ADDED: Buffers for code fence content >>>
        this._codeFenceBufferA = null; // Stores string content from code fences
        this._codeFenceBufferB = null; // Stores string content from code fences

        // <<< NEW: Constants for render modes >>>
        this.RENDER_MODE_RAW = 'raw';
        this.RENDER_MODE_MARKDOWN = 'markdown';
        this.RENDER_MODE_HTML = 'html';

        this.state = {
            entryCount: 0,
            clientLogIndex: 0
        };

        this._isResizing = false;
        this._startY = 0;
        this._startHeight = 0;

        // Bind core methods that might be called externally or as listeners
        this.addEntry = this.addEntry.bind(this);
        this.copyLog = this.copyLog.bind(this);
        this.clearLog = this.clearLog.bind(this);

        // REMOVED: property to store the uiState unsubscribe function
        // this._logVisibleUnsubscribe = null;
        this._appStateUnsubscribe = null; // ADDED: Store unsubscribe function for appState
        this._logFilteringUnsubscribe = null; // ADDED: For log filtering state

        // logPanelInternalDebug('Instance created.'); // Use internal debug for this kind of low-level trace
        logInfo('LogPanel instance created.', { type: 'LOG_PANEL', subtype: 'LIFECYCLE' });
        setLogPanelInstance(this); 
    }

    /**
     * Initializes the LogPanel: creates DOM, loads preferences, attaches listeners, updates UI.
     */
    initialize() {
        if (!this.container) {
            console.error('[LogPanel] Container element not found during initialization');
            return;
        }

        // Create DOM elements first
        createLogPanelDOM(this, appVer);
        
        // Wait for next frame to ensure DOM is updated
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                // Now initialize the rest of the functionality
                loadLogPanelPreferences(this, DEFAULT_LOG_HEIGHT, MIN_LOG_HEIGHT);
                subscribeToAppStoreChanges(this);
                attachLogPanelEventListeners(this);
                this._updateTagsBar();
                this.updateUI();
                this.updateEntryCount();

                // Expose globally for Clear Log button
                if (typeof window !== 'undefined') {
                    window.logPanel = this;
                }

                logInfo('LogPanel UI initialized successfully.', { type: 'LOG_PANEL', subtype: 'LIFECYCLE' });
                resolve();
            });
        });
    }

    /**
     * Adds a log message to the panel.
     * Accepts the NEW structured object form or the old (messageString, typeString) form.
     */
    addEntry(entryData, legacyTypeArgument = 'text') {
        // Create a timer for this operation
        const entryTimer = createTimer(`LogPanel.addEntry-${this.state.clientLogIndex}`);
        
        let messageForDisplay; 
        let level;
        let type;   
        let subtype; 
        let timestamp;
        let originalCoreMessage; 
        let source;

        if (entryData && typeof entryData === 'object' && entryData.message !== undefined) {
            // Object-based entry (from new log() function)
            originalCoreMessage = entryData.message;
            level = entryData.level || 'INFO';
            type = entryData.type || 'GENERAL';
            subtype = entryData.subtype || null;
            source = entryData.source || 'DEVPAGES';
            timestamp = entryData.ts ? new Date(entryData.ts).toLocaleTimeString() : new Date().toLocaleTimeString();
            
            // Add performance display
            let perfInfo = '';
            const showPerf = localStorage.getItem('performanceLoggingEnabled') === 'true';
            
            if (showPerf && entryData.perf) {
                perfInfo = ` [+${entryData.perf.sinceLast.toFixed(2)}ms | total: ${entryData.perf.sinceStart.toFixed(2)}ms]`;
            }

            let displayPrefix = `[${level}]`;
            if (type !== 'GENERAL' || subtype) {
                 displayPrefix += ` [${type}]`;
            }
            if (subtype) {
                displayPrefix += ` [${subtype}]`;
            }
            const coreMessageString = typeof originalCoreMessage === 'string' ? originalCoreMessage : JSON.stringify(originalCoreMessage);
            messageForDisplay = `${displayPrefix}${perfInfo} ${coreMessageString}`;

        } else if (typeof entryData === 'string') {
            // Legacy string processing
            source = 'DEVPAGES'; // ADD DEFAULT SOURCE
            // IMPROVED: Better parsing for complex bracket patterns
            // Expected patterns:
            // [LEVEL] [SOURCE] message
            // [LEVEL] [TYPE] [SUBTYPE] message
            // [SOURCE] message
            
            // Match multiple bracket patterns at the start
            const allBrackets = entryData.match(/^(\s*\[[^\]]+\])+/);
            if (allBrackets) {
                const brackets = entryData.match(/\[([^\]]+)\]/g);
                const values = brackets ? brackets.map(b => b.slice(1, -1).trim()) : [];
                
                if (values.length >= 1) {
                    // First bracket could be level or source
                    const firstValue = values[0].toUpperCase();
                    const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'SUCCESS', 'TIMING'];
                    
                    if (validLevels.includes(firstValue)) {
                        level = firstValue;
                        // If we have more brackets after level, use them for type/subtype
                        if (values.length >= 2) {
                            type = values[1].toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
                        }
                        if (values.length >= 3) {
                            subtype = values[2].toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
                        }
                    } else {
                        // First bracket is not a level, treat as source/type
                        type = firstValue.replace(/[^A-Z0-9_\-]/g, '_');
                        if (values.length >= 2) {
                            subtype = values[1].toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
                        }
                    }
                }
                
                // Extract the message content after all brackets
                const afterBrackets = entryData.replace(/^(\s*\[[^\]]+\])+\s*/, '');
                entryData = afterBrackets || entryData;
            }
            
            let displayPrefix = `[${level}]`;
            if (type !== 'GENERAL' && type !== 'TEXT') { 
                 displayPrefix += ` [${type}]`;
            }
            if (subtype) {
                displayPrefix += ` [${subtype}]`;
            }
            messageForDisplay = `${displayPrefix} ${entryData}`;

        } else {
            // This is the "final else" block (around line 655 in your file based on the latest stack)
            logPanelInternalDebug(`addEntry received invalid data (falling into final else): ${JSON.stringify(entryData)}. This entry will not be added to the UI log.`, 'error');
            return;
        }

        // Ensure level and type have defaults before use
        level = level || 'INFO';
        type = type || 'GENERAL';

        // Create checkpoints in complex operations
        entryTimer.checkpoint('parsed data');

        const upperCaseType = type.toUpperCase();

        if (messageForDisplay === undefined || messageForDisplay === null || String(messageForDisplay).trim() === '') {
            logPanelInternalDebug('Empty or whitespace-only log message after processing, ignoring', 'warn');
            return;
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-entry-${upperCaseType.toLowerCase()} log-level-${level.toLowerCase()}`;
        if (subtype) {
            logEntry.classList.add(`log-subtype-${subtype.toLowerCase().replace(/[^a-z0-9\\-]/g, '-')}`);
        }
        logEntry.style.display = 'flex';
        logEntry.style.justifyContent = 'space-between';
        logEntry.style.alignItems = 'flex-start';

        const textSpan = document.createElement('span');
        textSpan.className = 'log-entry-text-content';
        
        const fullDisplayMessage = `[${this.state.clientLogIndex}] ${timestamp} ${messageForDisplay}`;
        
        if (upperCaseType === 'JSON' && entryData && typeof entryData.message === 'object') { // Check original message type from entryData
            let jsonString = '[Error stringifying JSON]';
            try {
                jsonString = JSON.stringify(entryData.message, null, 2); // Stringify original object from entryData
            } catch (e) { /* keep default error string */ }
            
            const preForCollapsedView = document.createElement('pre');
            preForCollapsedView.textContent = jsonString;
            textSpan.textContent = `[${this.state.clientLogIndex}] ${timestamp} [${level}] [JSON]`; // Header
            textSpan.appendChild(preForCollapsedView);
        } else {
            textSpan.innerText = fullDisplayMessage;
        }
        
        logEntry.dataset.logIndex = this.state.clientLogIndex;
        logEntry.dataset.logTimestamp = timestamp;
        logEntry.dataset.logType = upperCaseType; 
        logEntry.dataset.logLevel = level;
        logEntry.dataset.source = source;
        if (subtype) {
            logEntry.dataset.logSubtype = subtype; 
        }
        logEntry.dataset.logCoreMessage = (typeof originalCoreMessage === 'string') ? originalCoreMessage : JSON.stringify(originalCoreMessage);
        logEntry.dataset.rawOriginalMessage = fullDisplayMessage; 
        
        // NEW: Store the raw content for display in <pre> tags when expanded
        const rawContentPart = (typeof originalCoreMessage === 'string') ? originalCoreMessage : messageForDisplay;
        logEntry.dataset.logRawContentPart = rawContentPart;

        const textWrapper = document.createElement('span');
        textWrapper.className = 'log-entry-text-wrapper';
        textWrapper.appendChild(textSpan);
        logEntry.appendChild(textWrapper);

        const originalCopyButton = document.createElement('button');
        originalCopyButton.innerHTML = '&#128203;';
        originalCopyButton.className = 'log-entry-button original-button';
        originalCopyButton.title = 'Copy log entry text (Shift+Click to Paste)'; 
        originalCopyButton.dataset.logText = fullDisplayMessage; 
        logEntry.appendChild(originalCopyButton);
        
        const expandedToolbar = document.createElement('div');
        expandedToolbar.className = 'log-entry-expanded-toolbar';
        logEntry.appendChild(expandedToolbar);

        if (this.logElement) {
            const expandedEntries = this.logElement.querySelectorAll('.log-entry.expanded');
            if (expandedEntries.length > 0) {
                const lastExpandedEntry = expandedEntries[expandedEntries.length - 1];
                lastExpandedEntry.after(logEntry);
            } else {
                this.logElement.prepend(logEntry); 
            }
            
            this.state.entryCount++;
            this.state.clientLogIndex++;
            this.updateEntryCount();
        } else {
            // Log element not available (happens during bootstrap)
            console.warn('[LogPanel] Cannot add entry: Log element not found or not initialized yet');
            // Don't increment counts or add to DOM in this case
        }

        const currentLogFilteringState = appStore.getState().logFiltering;
        let discoveredTypesChanged = false;
        let newDiscoveredTypes = [...(currentLogFilteringState.discoveredTypes || [])];
        
        // Only update active filters if not initialized
        if (!currentLogFilteringState.isInitialized) {
            if (!newDiscoveredTypes.includes(upperCaseType)) {
                newDiscoveredTypes.push(upperCaseType);
                discoveredTypesChanged = true;
            }
        }
        
        if (discoveredTypesChanged) {
            appStore.update(prevState => ({
                ...prevState,
                logFiltering: {
                    ...prevState.logFiltering,
                    discoveredTypes: newDiscoveredTypes
                }
            }));
            logPanelInternalDebug(`[LogPanel] Filters updated. Discovered Type: ${upperCaseType}`, 'debug');
        }

        // Apply current filters to the new entry
        const activeFilters = appStore.getState().logFiltering.activeFilters;
        if (activeFilters.includes('__CLEAR_ALL__') || 
            (activeFilters.length > 0 && !activeFilters.includes(`type:${upperCaseType}`))) {
            logEntry.classList.add('log-entry-hidden-by-filter');
        }

        entryTimer.checkpoint('added to DOM');
        
        // End timing when done
        entryTimer.end();
    }

    /**
     * Clears all entries from the log panel.
     */
    clearLog() {
        if (!this.logElement) return;
        this.logElement.innerHTML = '';
        this.state.entryCount = 0;
        this.state.clientLogIndex = 0;
        this.updateEntryCount();
        
        // Reset discovered types and active filters
        appStore.update(prevState => ({
            ...prevState,
            logFiltering: {
                discoveredTypes: [],
                activeFilters: [],
                isInitialized: false
            }
        }));
        logPanelInternalDebug('[LogPanel] Log cleared and filters reset.', 'info');
    }

    /**
     * Copies the current log content to the clipboard.
     */
    copyLog() {
        if (!this.logElement) return;

        const logText = Array.from(this.logElement.children)
            .filter(entry => !entry.classList.contains('log-entry-hidden-by-filter'))
            .map(entry => {
                const index = entry.dataset.logIndex;
                const timestamp = entry.dataset.logTimestamp;
                const rawMessage = entry.dataset.rawOriginalMessage;
                return `[${index}] ${timestamp} ${rawMessage}`;
            })
            .join('\n');

        navigator.clipboard.writeText(logText)
            .then(() => {
                logPanelInternalDebug('[LogPanel] Log copied to clipboard.', 'info');
                // Optional: Show temporary feedback like "Copied!"
            })
            .catch(err => {
                logPanelInternalDebug('[LogPanel] Failed to copy log:', err, 'error');
            });
    }

    /**
     * Updates the LogPanel's DOM based on the current central UI state (visibility) and internal state (height).
     */
    updateUI() {
        const appState = appStore.getState();
        if (!appState || !appState.ui) {
            console.warn('[LogPanel.js] Cannot updateUI, appState or appState.ui not available');
            return;
        }
        
        const { logVisible, logHeight, logMenuVisible } = appState.ui;
        
        // Update container visibility and height
        if (this.container) {
            this.container.classList.toggle('log-visible', logVisible);
            this.container.classList.toggle('log-hidden', !logVisible);
            
            // Apply height from appStore
            this.container.style.height = logVisible ? `${logHeight}px` : '0px';
            
            // Update CSS variable for other components
            document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
            document.documentElement.setAttribute('data-log-visible', logVisible.toString());
        }
        
        // Update log menu visibility
        const menuContainer = document.getElementById('log-menu-container');
        if (menuContainer) {
            menuContainer.classList.toggle('visible', logMenuVisible);
        }
    }

    /**
     * Updates the entry count display in the status bar.
     * Shows "visibleEntries/totalEntries entries".
     */
    updateEntryCount() {
        if (!this.statusElement) return;

        const totalEntries = this.state.entryCount;
        let visibleEntries = 0;

        if (this.logElement) {
            // Count children that do NOT have the 'log-entry-hidden-by-filter' class
            const allEntries = this.logElement.children;
            for (let i = 0; i < allEntries.length; i++) {
                if (!allEntries[i].classList.contains('log-entry-hidden-by-filter')) {
                    visibleEntries++;
                }
            }
        } else {
            // If logElement isn't available, assume no entries are visible
            visibleEntries = 0;
        }
        
        const entryText = totalEntries === 1 ? 'entry' : 'entries';
        
        // Show different formats based on filtering state
        if (visibleEntries === totalEntries) {
            this.statusElement.textContent = `${totalEntries} ${entryText}`;
        } else {
            this.statusElement.textContent = `${visibleEntries}/${totalEntries} ${entryText}`;
        }
    }

    /**
     * Scrolls the log view to the bottom.
     */
    scrollToBottom() {
         if (!this.logElement) return;
         // Simple scroll to bottom
         this.logElement.scrollTop = this.logElement.scrollHeight;
         // TODO: Add check for scroll lock toggle if implementing that feature
    }

    // --- Resize Handlers ---

    // Method to save preferences - called from logPanelEvents after resize
    // This should delegate to the function in logPanelState.js
    // saveLogPanelPreferences() {
    //     // logPanelInternalDebug('[LogPanel] saveLogPanelPreferences called.', 'debug');
    //     // The actual saving logic will be in logPanelState.js
    //     // For now, we assume a function saveLogPanelPreferencesState exists there.
    //     // This is a placeholder until logPanelState.js is fully implemented.
    //     if (typeof saveLogPanelPreferencesState === 'function') { // This refers to the imported function from logPanelState
    //         saveLogPanelPreferencesState(this); // Pass the instance
    //     } else {
    //         logWarn('saveLogPanelPreferences function from logPanelState.js not available.', {type: 'LOG_PANEL_STATE'});
    //     }
    // }

    /**
     * NEW: Updates the display content and button states for an expanded log entry.
     * @param {HTMLElement} logEntryDiv The .log-entry element.
     * @param {string} requestedMode 'raw', 'markdown', or 'html'.
     * @param {boolean} [forceRawState=false] If true, forces the state to raw (used on collapse).
     */
    async _updateLogEntryDisplay(logEntryDiv, requestedMode, forceRawState = false) {
        return updateLogEntryDisplay(logEntryDiv, requestedMode, forceRawState, this);
    }

    // +++ MODIFIED METHOD TO ADD HAMBURGER MENUS TO CODE FENCES AND MERMAID DIAGRAMS +++
    _enhanceCodeBlocksAndMermaid(parentElement, logEntryIndex) {
        return enhanceCodeBlocksAndMermaid(parentElement, logEntryIndex, this);
    }

    _showTemporaryFeedback(anchorElement, message, isError = false) {
        return showTemporaryFeedback(anchorElement, message, isError);
    }

    // +++ NEW METHODS FOR LOG FILTERING +++
    /**
     * Updates the tags bar with a "Clear Filters" button and buttons for each discovered log type.
     */
    _updateTagsBar() {
        // Initialize the tags bar if not already done
        if (this.tagsBarElement && !this.tagsBarElement._isInitialized) {
            initializeLogFilterBar(this.tagsBarElement);
            this.tagsBarElement._isInitialized = true;
        }
        return updateTagsBar(this.tagsBarElement, appStore.getState().logFiltering);
    }

    /**
     * Applies current filters to all visible log entries.
     * Shows/hides entries based on whether their type is in activeFilters.
     */
    _applyFiltersToLogEntries() {
        return applyFiltersToLogEntries(this.logElement, 
            appStore.getState().logFiltering.activeFilters, 
            this.updateEntryCount.bind(this));
    }
    // +++ END NEW METHODS FOR LOG FILTERING +++

    // <<< ADDED: Method to update Toolbar A/B button UI >>>
    updateSelectionButtonUI(bufferType, hasData, stateData = null) {
        return updateSelectionButtonUI(this.toolbarElement, bufferType, hasData, stateData);
    }
    // <<< END ADDED METHOD >>>

    // --- NEW HELPER: Expand Log Entry ---
    _expandLogEntry(logEntryDiv) {
        return expandLogEntry(logEntryDiv, this);
    }

    // --- NEW HELPER: Collapse Log Entry ---
    _collapseLogEntry(logEntryDiv) {
        return collapseLogEntry(logEntryDiv, this);
    }

    _attachEventListeners() {
        if (!this.logElement) return;

        // Remove any existing listeners first
        this._removeEventListeners();

        // Add click handler for log entries
        this.logElement.addEventListener('click', (event) => {
            const target = event.target;
            
            // Check if the click was on a filter button
            if (target.closest('.log-tag-button')) {
                return; // Let the LogFilterBar handle this
            }

            // Handle log entry clicks
            const logEntry = target.closest('.log-entry');
            if (logEntry) {
                const isExpanded = logEntry.classList.contains('expanded');
                if (isExpanded) {
                    collapseLogEntry(logEntry);
                } else {
                    expandLogEntry(logEntry);
                }
            }
        });

        // Add other event listeners as needed...
    }

    destroy() {
        logPanelInternalDebug('[LogPanel] Destroying...');
        if (this._appStateUnsubscribe) {
            this._appStateUnsubscribe();
            this._appStateUnsubscribe = null;
            logPanelInternalDebug('[LogPanel] Unsubscribed from appState.ui.logVisible changes.');
        }
        if (this._logFilteringUnsubscribe) { // ADDED: Unsubscribe from log filtering
            this._logFilteringUnsubscribe();
            this._logFilteringUnsubscribe = null;
            logPanelInternalDebug('[LogPanel] Unsubscribed from appState.logFiltering changes.');
        }
        
        // --- MODIFIED PART ---
        // Call the cleanup function from logPanelEvents.js
        if (typeof removeLogPanelEventListeners === 'function') {
            removeLogPanelEventListeners(this);
            logPanelInternalDebug('[LogPanel] Called removeLogPanelEventListeners.', 'debug');
        } else {
            logWarn('[LogPanel] removeLogPanelEventListeners is not available from logPanelEvents.js.', 'warn');
        }
        // --- END MODIFIED PART ---

        // Original cleanup of global listeners (now redundant if removeLogPanelEventListeners handles them)
        // document.removeEventListener('mousemove', this._handleResizeMouseMove); 
        // document.removeEventListener('mouseup', this._handleResizeMouseUp); 
        logPanelInternalDebug('[LogPanel] Destroyed.');
    }
}