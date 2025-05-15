/**
 * LogPanel.js
 * Encapsulates the UI and logic for the log panel component.
 */

const LOG_VISIBLE_KEY = 'logVisible';
const LOG_HEIGHT_KEY = 'logHeight';
const DEFAULT_LOG_HEIGHT = 150;
const MIN_LOG_HEIGHT = 80;

// Assuming updatePreview might be needed later
// import { updatePreview } from '../preview.js'; // Potential path? Check correct path.

import eventBus from '/client/eventBus.js';

// ADD: Import the necessary functions from uiState
// import { getUIState, setUIState, subscribeToUIStateChange } from '/client/uiState.js';
import { appStore } from '/client/appState.js'; // CHANGED: Use appStore instead of appState

// ADD: Import triggerActions to call pasteLogEntry directly
import { triggerActions } from '/client/actions.js';
import { appVer } from '/config.js'; // Use absolute path

// ADD: Import markdown rendering function AND post-processing
import { renderMarkdown, postProcessRender } from '/client/preview/renderer.js';

// <<< NEW: Logging helper for this module >>>
function logPanelMessage(message, level = 'debug') {
    const type = 'LOG_PANEL'; 
    // ALWAYS use console for this internal helper to avoid recursion
    const logFunc = 
        level === 'error' ? console.error : 
        level === 'warn' ? console.warn : 
        level === 'debug' ? console.debug : // Use console.debug for debug level
        console.log; 
   // logFunc(`[${type}] ${message}`);
    /* // REMOVED Check for window.logMessage to prevent recursion
    if (typeof window.logMessage === 'function') {
        // Assuming window.logMessage takes message, level, type - THIS CAUSED RECURSION
        // window.logMessage(message, level, type); 
    } else {
        // Fallback to console
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
    */
}

export class LogPanel {
    constructor(containerElementId = 'log-container') {
        this.container = document.getElementById(containerElementId);
        if (!this.container) {
            console.error(`[LogPanel] Container element with ID '${containerElementId}' not found.`);
            return; // Prevent further errors if container doesn't exist
        }

        // --- Initialize internal elements to null initially --- 
        this.toolbarElement = null;
        this.logElement = null;
        this.statusElement = null;
        this.resizeHandle = null;
        this.minimizeButton = null;
        this.copyButton = null;
        this.clearButton = null;
        this.cliInputElement = null; // Add CLI input element
        this.appInfoElement = null; // Add App Info element
        this.appVersionElement = null; // Add element property
        this.pauseLogButton = null; // Add element property
        // Buttons are now found via toolbarElement or have data-actions

        // <<< NEW: Store selection details for $$ command >>>
        this._lastCommandSelection = null;
        // <<< NEW: Store persistent selection states >>>
        this._selectionStateA = null; // { filePath: string, start: number, end: number, text: string }
        this._selectionStateB = null; // { filePath: string, start: number, end: number, text: string }

        // <<< NEW: Constants for render modes >>>
        this.RENDER_MODE_RAW = 'raw';
        this.RENDER_MODE_MARKDOWN = 'markdown';
        this.RENDER_MODE_HTML = 'html';

        this.state = {
            height: DEFAULT_LOG_HEIGHT,
            entryCount: 0,
            clientLogIndex: 0 // <<< ADDED: Index counter for client logs
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

        // --- ADDED: Pause State ---
        this.isPaused = false;
        // --- END ADDED ---

        console.log('[LogPanel] Instance created.');
    }

    /**
     * Initializes the LogPanel: creates DOM, loads preferences, attaches listeners, updates UI.
     */
    initialize() {
        if (!this.container) return; // Don't initialize if container wasn't found

        console.log('[LogPanel] Initializing...');
        this.createDOMStructure(); // Create internal elements
        this.loadPreferences();
        this.attachEventListeners(); // Attach resize listener and potentially others
        this.subscribeToStateChanges(); // ADDED: Subscribe to appState.ui.logVisible
        this.updateUI();
        this.updateEntryCount(); // Initial count
        // Comment out the call to updateAppInfo
        // this.updateAppInfo();
        console.log('[LogPanel] Initialized successfully.');
    }

    /**
     * Creates the necessary DOM elements inside the container.
     */
    createDOMStructure() {
        // Clear any existing content (e.g., from static HTML)
        this.container.innerHTML = ''; 

        // Create Toolbar
        this.toolbarElement = document.createElement('div');
        this.toolbarElement.id = 'log-toolbar'; // Assign ID for CSS
        this.container.appendChild(this.toolbarElement);
        
        // <<< NEW: Add '' Toggle Button >>>
        const helpToggleButton = this._createToolbarButton('log-help-toggle-btn', '☰', 'toggleLogMenu', 'Toggle Log Menu');
        // helpToggleButton.style.marginRight = 'auto'; // Push other items right if needed
        // <<< END NEW >>>

        // Create CLI Input
        this.cliInputElement = document.createElement('input');
        this.cliInputElement.type = 'text';
        this.cliInputElement.id = 'cli-input';
        this.cliInputElement.placeholder = 'Enter command...';
        this.toolbarElement.appendChild(this.cliInputElement);
        
        // Create CLI Send Button
        const sendButton = document.createElement('button');
        sendButton.id = 'cli-send-button';
        sendButton.textContent = 'Send';
        this.toolbarElement.appendChild(sendButton);
        
        // <<< NEW: Add State A/B Buttons >>>
        const stateAButton = this._createToolbarButton('log-state-a-btn', 'A', 'setSelectionStateA', 'Store Editor Selection A');
        const stateBButton = this._createToolbarButton('log-state-b-btn', 'B', 'setSelectionStateB', 'Store Editor Selection B');
        // <<< END NEW >>>
        
        // Create App Info Span (Now after version)
        this.appInfoElement = document.createElement('span');
        this.appInfoElement.id = 'app-info';
        this.appInfoElement.className = 'app-info'; // Use class for styling
        this.appInfoElement.dataset.action = 'showAppInfo'; 
        this.toolbarElement.appendChild(this.appInfoElement);

        // --- ADDED: Create Right-aligned wrapper for status items ---
        const rightWrapper = document.createElement('div');
        rightWrapper.style.marginLeft = 'auto'; // Push to the right
        rightWrapper.style.display = 'flex';
        rightWrapper.style.alignItems = 'center';
        rightWrapper.style.gap = '0.5rem'; // Space between items
        this.toolbarElement.appendChild(rightWrapper);
        // --- END: Wrapper ---

        // Create App Version Span (will be added to wrapper)
        this.appVersionElement = document.createElement('span');
        this.appVersionElement.id = 'log-app-version';
        this.appVersionElement.className = 'app-version log-version'; // Class for styling
        this.appVersionElement.textContent = `v${appVer}`;
        this.appVersionElement.title = `App Version: ${appVer}`;
        // Don't append here, append to wrapper below

        // Create Minimize Button (will be added to wrapper)
        this.minimizeButton = this._createToolbarButton('minimize-log-btn', '✕', 'minimizeLog', 'Minimize Log', true); // Pass flag to not append yet

        // Create Status Span (will be added to wrapper)
        this.statusElement = document.createElement('span');
        this.statusElement.id = 'log-status';
        this.statusElement.textContent = '0 entries';
        // Don't append here, append to wrapper below
        if (this.statusElement) rightWrapper.appendChild(this.statusElement);
        if (this.minimizeButton) rightWrapper.appendChild(this.minimizeButton);
     
        // Create Log Content Area
        this.logElement = document.createElement('div');
        this.logElement.id = 'log';
        this.container.appendChild(this.logElement);

        // Create Resize Handle
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.id = 'log-resize-handle';
        this.resizeHandle.title = 'Resize Log';
        this.container.appendChild(this.resizeHandle);
        
        // <<< NEW: Create Log Menu Container (hidden initially) >>>
        const menuContainer = document.createElement('div');
        menuContainer.id = 'log-menu-container'; // Assign ID for styling/toggling
        // menuContainer.style.display = 'none'; // Hide via CSS initially
        
        const menuItems = [
            { text: 'Pause/Resume', action: 'toggleLogPause' },
            { text: 'Copy Log', action: 'copyLog' },
            { text: 'Clear Log', action: 'clearLog' },
            { text: 'Debug UI', action: 'runDebugUI' },
            { text: 'Sys Info', action: 'showSystemInfo' }, 
            { text: 'Static HTML', action: 'downloadStaticHTML' },
        ];
        
        // Add a separator before version info
        const separator = document.createElement('div');
        separator.className = 'log-menu-separator';
        menuContainer.appendChild(separator);

  

        menuItems.forEach(item => {
            const menuItem = document.createElement('div'); // Use div for block layout
            menuItem.className = 'log-menu-item';
            menuItem.textContent = item.text;
            menuItem.dataset.action = item.action;
            menuContainer.appendChild(menuItem);
        });

        // Add version info (non-actionable)
        const versionInfo = document.createElement('div');
        versionInfo.className = 'log-menu-version';
        versionInfo.textContent = `v${appVer}`;
        versionInfo.title = `App Version: ${appVer}`;
        menuContainer.appendChild(versionInfo);
        
        // Insert menu *after* toolbar, *before* log area
        this.container.insertBefore(menuContainer, this.logElement);
        // <<< END NEW >>>

        console.log('[LogPanel] DOM structure created.');
        // Update initial pause button state
        this.updatePauseButtonState();
    }
    
    /** Helper to create toolbar buttons */
    _createToolbarButton(id, text, action, title = null, noAppend = false) {
        if (!this.toolbarElement) return null;
        const button = document.createElement('button');
        button.id = id;
        button.textContent = text;
        if (action) {
            button.dataset.action = action; // Set data-action for global handler
        }
        if (title) {
            button.title = title;
        }
        if (!noAppend) {
            this.toolbarElement.appendChild(button);
        }
        return button; // Important: return the element
    }

    /**
     * Loads height preference from localStorage.
     */
    loadPreferences() {
        const savedHeight = localStorage.getItem(LOG_HEIGHT_KEY);

        this.state.height = parseInt(savedHeight, 10) || DEFAULT_LOG_HEIGHT;
        if (this.state.height < MIN_LOG_HEIGHT) {
            this.state.height = MIN_LOG_HEIGHT;
        }
        console.log(`[LogPanel] Preferences loaded: height=${this.state.height}`);
    }

    /**
     * Saves height preference to localStorage.
     */
    savePreferences() {
        try {
            localStorage.setItem(LOG_HEIGHT_KEY, String(this.state.height));
            console.log(`[LogPanel] Preferences saved: height=${this.state.height}`);
        } catch (error) {
            console.error(`[LogPanel] Failed to save preferences: ${error.message}`);
        }
    }

    /**
     * ADDED: Subscribe to relevant UI state changes from appState.
     */
    subscribeToStateChanges() {
        // Unsubscribe if already subscribed (e.g., during re-initialization)
        if (this._appStateUnsubscribe) {
            this._appStateUnsubscribe();
        }
        // Subscribe to appState changes
        this._appStateUnsubscribe = appStore.subscribe((newState, prevState) => {
             // Only react if the relevant UI slice changed
             if (newState.ui !== prevState.ui && newState.ui.logVisible !== prevState.ui?.logVisible) {
                 console.log(`%c[LogPanel] Received appState change via subscription: logVisible=${newState.ui.logVisible}`, 'color: cyan'); 
                 this.updateUI(); // Update UI when central state changes
             }
        });
        console.log('[LogPanel] Subscribed to appState.ui.logVisible changes.');
    }

    /**
     * Attaches necessary event listeners to the panel's elements.
     */
    attachEventListeners() {
        if (this.resizeHandle) {
            this.resizeHandle.addEventListener('mousedown', this._handleResizeMouseDown.bind(this));
        } else {
            console.warn('[LogPanel] Resize handle not found, resize disabled.');
        }

        this._handleResizeMouseMove = this._handleResizeMouseMove.bind(this);
        this._handleResizeMouseUp = this._handleResizeMouseUp.bind(this);

        // === ADD DELEGATED LISTENER FOR LOG ENTRIES ===
        if (this.logElement) {
            this.logElement.addEventListener('click', (event) => {
                const logEntryDiv = event.target.closest('.log-entry');
                if (!logEntryDiv) return; // Click wasn't inside a log entry

                // Check if the click was on a button within the entry
                const clickedButton = event.target.closest('.log-entry-button');

                if (clickedButton && !clickedButton.dataset.action?.startsWith('toggle')) { // Ignore toggle buttons here
                    // --- Clicked a Functional Button (Copy/Paste/etc.) ---
                    logPanelMessage('[LogPanel Listener] Clicked a functional button inside log entry.');

                    // Handle the original copy/paste button logic
                    if (clickedButton.classList.contains('original-button') || clickedButton.classList.contains('toolbar-button')) {
                        const logText = clickedButton.dataset.logText; // Get text from button's data attr
                        if (logText === undefined) {
                           console.warn('Copy/Paste button clicked, but logText data attribute is missing!');
                           return;
                        }

                        if (event.shiftKey) {
                            // Shift+Click: Paste to Editor
                            logPanelMessage('[LogPanel Listener] Shift+Click detected. Triggering pasteLogEntry...');
                            triggerActions.pasteLogEntry({ logText: logText }, clickedButton);
                        } else {
                            // Normal Click: Copy to Clipboard
                            logPanelMessage('[LogPanel Listener] Normal click detected. Triggering copyLogEntryToClipboard...');
                            triggerActions.copyLogEntryToClipboard({ logText: logText }, clickedButton);
                        }
                    }
                    // <<< Add handling for other button types here if needed >>>

                    // Prevent the click from also toggling the expand/collapse state or other button actions
                    event.stopPropagation();

                } else if (!clickedButton) { // Only toggle expand/collapse if clicking text area, not buttons
                    // --- Clicked the Log Entry Text Area (Toggle Expand/Collapse) ---
                    logPanelMessage('[LogPanel Listener] Clicked log entry text area (or whitespace). Toggling expand.');
                    const isCurrentlyExpanded = logEntryDiv.classList.contains('expanded');
                    const shouldExpand = !isCurrentlyExpanded;

                    logEntryDiv.classList.toggle('expanded', shouldExpand);

                    // Move expanded element to top
                    if (shouldExpand && this.logElement) {
                        this.logElement.prepend(logEntryDiv);
                    }

                    if (shouldExpand) {
                        console.log('[LogPanel Listener] Expanding entry, building toolbar and setting initial content.');
                        const expandedToolbar = logEntryDiv.querySelector('.log-entry-expanded-toolbar');
                        // --- Build the Expanded Toolbar (if not already built or needs refresh) ---
                        if (expandedToolbar && !expandedToolbar.dataset.toolbarBuilt) { // Check a flag
                            expandedToolbar.innerHTML = ''; // Clear previous content
                            const { logIndex, logTimestamp, logType, logSubtype, rawOriginalMessage } = logEntryDiv.dataset;
                            const createToken = (text, className) => {
                                const token = document.createElement('span');
                                token.className = `log-token ${className}`;
                                token.textContent = text;
                                return token;
                            };
                            if (logIndex !== undefined) expandedToolbar.appendChild(createToken(`[${logIndex}]`, 'log-token-index'));
                            if (logTimestamp) expandedToolbar.appendChild(createToken(logTimestamp, 'log-token-time'));
                            if (logType) expandedToolbar.appendChild(createToken(logType, `log-token-type log-type-${logType.toLowerCase()}` ));
                            if (logSubtype) expandedToolbar.appendChild(createToken(`[${logSubtype}]`, `log-token-subtype log-subtype-${logSubtype.toLowerCase().replace(/[^a-z0-9\-]/g, '-')}`));

                            // --- MD Toggle Button ---
                            const markdownToggleButton = document.createElement('button');
                            markdownToggleButton.textContent = 'MD';
                            markdownToggleButton.className = 'log-entry-button markdown-toggle-button';
                            markdownToggleButton.title = 'Toggle Markdown Rendering';
                            markdownToggleButton.dataset.action = 'toggleMarkdownRender'; // Used for internal listener
                            expandedToolbar.appendChild(markdownToggleButton);

                            // --- HTML Toggle Button ---
                            const htmlToggleButton = document.createElement('button');
                            htmlToggleButton.textContent = 'HTML';
                            htmlToggleButton.className = 'log-entry-button html-toggle-button';
                            htmlToggleButton.title = 'Toggle HTML Page Rendering (iframe)';
                            htmlToggleButton.dataset.action = 'toggleHtmlRender'; // Used for internal listener
                            expandedToolbar.appendChild(htmlToggleButton);
                            // --- End HTML Toggle Button ---

                            const toolbarCopyButton = document.createElement('button');
                            toolbarCopyButton.innerHTML = '&#128203;';
                            toolbarCopyButton.className = 'log-entry-button toolbar-button';
                            toolbarCopyButton.title = 'Copy log entry text (Shift+Click to Paste)';
                            toolbarCopyButton.dataset.logText = rawOriginalMessage || '';
                            expandedToolbar.appendChild(toolbarCopyButton);

                            expandedToolbar.dataset.toolbarBuilt = 'true'; // Mark toolbar as built

                            // --- Add Internal Click Listeners for Toggle Buttons ---
                            markdownToggleButton.addEventListener('click', (mdEvent) => {
                                mdEvent.stopPropagation();
                                const currentMode = logEntryDiv.dataset.renderMode;
                                const newMode = currentMode === this.RENDER_MODE_MARKDOWN ? this.RENDER_MODE_RAW : this.RENDER_MODE_MARKDOWN;
                                this._updateLogEntryDisplay(logEntryDiv, newMode);
                            });

                            htmlToggleButton.addEventListener('click', (htmlEvent) => {
                                htmlEvent.stopPropagation();
                                const currentMode = logEntryDiv.dataset.renderMode;
                                const newMode = currentMode === this.RENDER_MODE_HTML ? this.RENDER_MODE_RAW : this.RENDER_MODE_HTML;
                                this._updateLogEntryDisplay(logEntryDiv, newMode);
                            });
                             // --- End Internal Click Listeners ---
                        }

                        // --- Set Initial Content on Expand ---
                        // Default to raw unless a previous state was stored (implement if needed)
                        this._updateLogEntryDisplay(logEntryDiv, this.RENDER_MODE_RAW); // Start with raw view

                     } else if (!shouldExpand) { // Collapsing
                        logPanelMessage('[LogPanel Listener] Collapsing entry.');
                        // Reset content to raw text when collapsing
                        this._updateLogEntryDisplay(logEntryDiv, this.RENDER_MODE_RAW, true); // Pass true to force raw state reset
                     }

                    // Optional: Adjust scroll
                    // logEntryDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
            console.log('[LogPanel] Updated delegated click listener on #log element for expand/copy/paste/render toggle.');
        } else {
            console.warn('[LogPanel] #log element not found, cannot attach delegated listener.');
        }
        // === END DELEGATED LISTENER ===

        // <<< NEW: Add Editor Blur/Focus Listeners >>>
        const editorTextArea = document.querySelector('#editor-container textarea');
        if (editorTextArea) {
            editorTextArea.addEventListener('blur', (event) => {
                // <<< SIMPLIFIED LOGIC: Store selection on blur if it has length >>>
                const start = editorTextArea.selectionStart;
                const end = editorTextArea.selectionEnd;
                if (start !== end) {
                    this._selectionStateA = { start, end };
                    logPanelMessage(`Editor blurred. Stored selection: start=${start}, end=${end}`);
                } else {
                     // If selection has zero length on blur, clear stored value
                     this._selectionStateA = null;
                     logPanelMessage('Editor blurred with zero-length selection. Cleared stored selection.');
                }
                /* // OLD LOGIC with relatedTarget check
                const relatedTarget = event.relatedTarget;
                if (relatedTarget && (relatedTarget === this.cliInputElement || this.container.contains(relatedTarget))) {
                    this._editorSelectionBeforeCliFocus = { 
                        start: editorTextArea.selectionStart,
                        end: editorTextArea.selectionEnd
                    };
                    logPanelMessage(`Editor blurred towards log panel. Stored selection: start=${this._editorSelectionBeforeCliFocus.start}, end=${this._editorSelectionBeforeCliFocus.end}`);
                } else {
                     // Clear if blurring elsewhere
                     this._editorSelectionBeforeCliFocus = null;
                     logPanelMessage('Editor blurred, but not towards log panel. Cleared stored selection.');
                }
                */
            });
            // Clear stored selection if editor is focused again
            editorTextArea.addEventListener('focus', () => {
                logPanelMessage('Editor focused. Cleared stored selection.');
                this._selectionStateA = null;
            });
            logPanelMessage('Attached blur/focus listeners to editor textarea.');
        } else {
            logPanelMessage('Editor textarea not found during listener setup.', 'warning');
        }
        // <<< END NEW LISTENERS >>>
    }

    // --- Core Methods ---

    /**
     * Adds a log message to the panel, respecting the pause state.
     * @param {string|object} message - The message to log
     * @param {string} [type=\'text\'] - The message type (e.g., \'text\', \'json\', \'error\', \'cli-input\', \'cli-output\').
     */
    addEntry(message, type = 'text') {
        // <<< DEBUGGING: Log incoming message details >>>
        // console.log(`[LogPanel DEBUG] addEntry received:`, {
        //     message: message,
        //     typeofMessage: typeof message,
        //     messageStr: String(message),
        //     messageTrimmed: String(message).trim(),
        //     type: type
        // });
        // --- ADDED: Check Pause State ---
        // Allow specific types through even when paused
        const allowedTypesWhenPaused = ['cli-input', 'cli-output', 'cli-error', 'cli-local-echo']; // Added cli-local-echo
        if (this.isPaused && !allowedTypesWhenPaused.includes(type)) {
            // console.log(`[LogPanel] Paused. Ignoring entry type: ${type}`);
            return; // Don't add the entry if paused and type is not allowed
        }
        // --- END ADDED ---

        if (!this.logElement) {
             console.warn(`[LogPanel] Log element (#log) not found when trying to add entry:`, { message, type });
             return;
        }

        if (message === undefined || message === null) {
            console.warn('[LogPanel] Empty log message received, ignoring');
            return;
        }
        
        let messageStr = String(message);
        if (messageStr.trim() === '') {
             console.warn('[LogPanel] Empty or whitespace-only log message received, ignoring');
             return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-entry-${type} log-${type.toLowerCase()}`; 
        logEntry.style.display = 'flex';
        logEntry.style.justifyContent = 'space-between';
        logEntry.style.alignItems = 'flex-start';

        let subtype = null;
        let rawContentForDisplay = messageStr;    // Default for <pre> in raw view
        let coreMessageForProcessing = messageStr.trim(); // Default for MD/HTML processing

        const subtypeRegex = new RegExp('^\\s*\\[([A-Z0-9_-]+)\\]\\s*(.*)', 'is');
        const subtypeMatch = subtypeRegex.exec(messageStr);

        if (subtypeMatch) {
            subtype = subtypeMatch[1];
            rawContentForDisplay = subtypeMatch[2]; // Raw content after subtype
            coreMessageForProcessing = subtypeMatch[2].trim(); // Trimmed content for processing
            logEntry.classList.add(`log-subtype-${subtype.toLowerCase().replace(/[^a-z0-9\\-]/g, '-')}`);
        }

        const textSpan = document.createElement('span');
        textSpan.className = 'log-entry-text-content';
        let displayMessage = `[${this.state.clientLogIndex}] ${timestamp} ${messageStr}`;
        let rawMessageForCopyButton = messageStr;

        if (type === 'json') {
            let jsonString = '[Error stringifying JSON]';
            try {
                jsonString = JSON.stringify(message, null, 2);
                coreMessageForProcessing = jsonString; // For JSON, stringified is used for processing
                rawContentForDisplay = jsonString;     // And for raw display
                rawMessageForCopyButton = jsonString;
            } catch (e) { /* keep default error string */ }
            
            displayMessage = `[${this.state.clientLogIndex}] ${timestamp} [JSON]`;
            const preForCollapsedView = document.createElement('pre');
            preForCollapsedView.textContent = jsonString;
            textSpan.textContent = displayMessage;
            textSpan.appendChild(preForCollapsedView);
        } else {
            textSpan.innerText = displayMessage;
        }
        
        // --- Store Data Attributes on logEntry element ---
        logEntry.dataset.logIndex = this.state.clientLogIndex;
        logEntry.dataset.logTimestamp = timestamp;
        logEntry.dataset.logType = type;
        if (subtype) {
            logEntry.dataset.logSubtype = subtype;
        }
        logEntry.dataset.logCoreMessage = coreMessageForProcessing; 
        logEntry.dataset.logRawContentPart = rawContentForDisplay;   
        logEntry.dataset.rawOriginalMessage = messageStr;            
        // --- End Data Attributes ---

        const textWrapper = document.createElement('span');
        textWrapper.className = 'log-entry-text-wrapper';
        textWrapper.appendChild(textSpan);
        logEntry.appendChild(textWrapper);

        const originalCopyButton = document.createElement('button');
        originalCopyButton.innerHTML = '&#128203;';
        originalCopyButton.className = 'log-entry-button original-button';
        originalCopyButton.title = 'Copy log entry text (Shift+Click to Paste)'; 
        originalCopyButton.dataset.logText = rawMessageForCopyButton; 
        logEntry.appendChild(originalCopyButton);
        
        const expandedToolbar = document.createElement('div');
        expandedToolbar.className = 'log-entry-expanded-toolbar';
        logEntry.appendChild(expandedToolbar);

        // --- Insert the log entry --- 
        const expandedEntries = this.logElement.querySelectorAll('.log-entry.expanded');
        if (expandedEntries.length > 0) {
            // Find the last expanded entry
            const lastExpandedEntry = expandedEntries[expandedEntries.length - 1];
            // Insert the new entry *after* the last expanded one
            lastExpandedEntry.after(logEntry);
            logPanelMessage(`Prepended new entry after last expanded (Index: ${lastExpandedEntry.dataset.logIndex})`, 'debug');
        } else {
            // If no entries are expanded, prepend to the top as usual
            this.logElement.prepend(logEntry); 
            logPanelMessage(`Prepended new entry to top (no expanded entries found)`, 'debug');
        }
        // --- End Insertion Logic ---
        
        this.state.entryCount++;
        this.state.clientLogIndex++; // <<< Increment client log index AFTER using it
        this.updateEntryCount(); // Use internal method

        // Scroll to top (consider if this is always desired with prepending)
        // setTimeout(() => { 
        //     if (this.logElement) { // Check if element still exists
        //         this.logElement.scrollTop = 0; 
        //     }
        // }, 0); 

        // Also log to console for debugging
        // console.log(`${timestamp} [${type.toUpperCase()}] ${type === 'json' ? JSON.stringify(message) : messageStr}`); // Keep original console log format for now
    }

    /**
     * Clears all entries from the log panel.
     */
    clearLog() {
        if (!this.logElement) return;
        this.logElement.innerHTML = '';
        this.state.entryCount = 0;
        this.state.clientLogIndex = 0; // <<< ADDED: Reset client log index
        this.updateEntryCount(); // Use internal method
        console.log('[LogPanel] Log cleared.');
    }

    /**
     * Copies the current log content to the clipboard.
     */
    copyLog() {
        if (!this.logElement) return;

        const logText = Array.from(this.logElement.children)
            .map(entry => entry.textContent)
            .join('\n');

        navigator.clipboard.writeText(logText)
            .then(() => {
                console.log('[LogPanel] Log copied to clipboard.');
                // Optional: Show temporary feedback like "Copied!"
            })
            .catch(err => {
                console.error('[LogPanel] Failed to copy log:', err);
            });
    }

    /**
     * Updates the LogPanel's DOM based on the current central UI state (visibility) and internal state (height).
     */
    updateUI() {
        console.log('%c[LogPanel] updateUI() method called.', 'color: yellow');
        const mainContainer = document.getElementById('main-container'); // Get main container reference

        if (!this.container || !mainContainer) {
             console.warn('[LogPanel updateUI] Missing required elements (#log-container or #main-container), cannot update.');
             return;
        }

        // Get uiState state directly
        // const isVisible = getUIState('logVisible'); 
        const isVisible = appStore.getState().ui.logVisible; // CHANGED: Use appStore
        const currentHeight = this.state.height; // Still needed for --log-height

        console.log(`[LogPanel] Updating UI based on state: isVisible=${isVisible}`);

        // Set CSS variable ONLY when visible
        document.documentElement.style.setProperty('--log-height', isVisible ? `${currentHeight}px` : '0px');

        // Toggle classes on log container
        this.container.classList.toggle('log-visible', isVisible);
        this.container.classList.toggle('log-hidden', !isVisible);

        // Toggle classes on main container for content height adjustment
        mainContainer.classList.toggle('log-visible', isVisible);
        mainContainer.classList.toggle('log-hidden', !isVisible);

        // Optional: Update the button in ViewControls still needs doing there via its own subscription.
        // We don't need to update the button appearance from here anymore.

        console.log(`[LogPanel] UI Updated. Toggled classes. IsVisible: ${isVisible}`);

        // Emit resize event AFTER updating visibility/height potentially
        // so other components react to the final state
        eventBus.emit('layout:logResized', { height: isVisible ? currentHeight : 0 });

        this.updatePauseButtonState(); // Update pause button state too
    }

    /**
     * Updates the entry count display in the status bar.
     */
    updateEntryCount() {
        if (!this.statusElement) return;
        this.statusElement.textContent = `${this.state.entryCount} ${this.state.entryCount === 1 ? 'entry' : 'entries'}`;
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

    _handleResizeMouseDown(event) {
        event.preventDefault();
        event.stopPropagation();
        this._isResizing = true;
        this._startY = event.clientY;
        this._startHeight = this.container.offsetHeight;
        this.container.classList.add('resizing'); // Add class for potential styling

        document.addEventListener('mousemove', this._handleResizeMouseMove);
        document.addEventListener('mouseup', this._handleResizeMouseUp);
    }

    /**
     * Handles mouse move during resize.
     */
    _handleResizeMouseMove(event) {
        if (!this._isResizing) return;

        const deltaY = this._startY - event.clientY;
        let newHeight = this._startHeight + deltaY;

        if (newHeight < MIN_LOG_HEIGHT) {
            newHeight = MIN_LOG_HEIGHT;
        }
        // Add a max height constraint if desired, e.g.:
        // const maxHeight = window.innerHeight * 0.8; // 80% of viewport
        // if (newHeight > maxHeight) newHeight = maxHeight;

        this.state.height = newHeight;
        this.container.style.height = `${newHeight}px`;
        
        // Set the CSS variable immediately during resize
        document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
        
        // MODIFIED: Emit event during resize for immediate layout updates elsewhere
        eventBus.emit('layout:logResized', { height: newHeight });
    }

    /**
     * Handles mouse up after resize, saves the new height.
     */
    _handleResizeMouseUp() {
        if (!this._isResizing) return;
        this._isResizing = false;
        document.removeEventListener('mousemove', this._handleResizeMouseMove);
        document.removeEventListener('mouseup', this._handleResizeMouseUp);
        document.body.style.userSelect = ''; // Restore text selection

        this.savePreferences(); // Save the final height
        console.log(`[LogPanel] Resize ended. Final height: ${this.state.height}`);
        // Event emission is now handled during mousemove
    }

    // ADDED: Method to clean up subscriptions
    destroy() {
        console.log('[LogPanel] Destroying...');
        if (this._appStateUnsubscribe) {
            this._appStateUnsubscribe();
            this._appStateUnsubscribe = null;
            console.log('[LogPanel] Unsubscribed from appState changes.');
        }
        // Remove resize listener if necessary (though usually component is destroyed with page)
        if (this.resizeHandle) {
            this.resizeHandle.removeEventListener('mousedown', this._handleResizeMouseDown);
        }
        document.removeEventListener('mousemove', this._handleResizeMouseMove); // Clean up global listeners
        document.removeEventListener('mouseup', this._handleResizeMouseUp); // Clean up global listeners
        console.log('[LogPanel] Destroyed.');
    }

    // Comment out the entire method
    /*
    updateAppInfo() {
        if (!this.appInfoElement) return;
        // Set the text content to the imported version
        this.appInfoElement.textContent = `v${appVer}`;
        this.appInfoElement.title = `Application Version: ${appVer}`; // Add a tooltip
        console.log(`[LogPanel] App info updated: v${appVer}`);
    }
    */

    // --- ADDED: Pause Methods ---
    togglePause() {
        this.isPaused = !this.isPaused;
        console.log(`[LogPanel] Pause state toggled: ${this.isPaused}`);
        this.updatePauseButtonState();
    }

    updatePauseButtonState() {
        if (!this.pauseLogButton) return;
        if (this.isPaused) {
            this.pauseLogButton.textContent = '▶️ Resume';
            this.pauseLogButton.title = 'Resume Logging';
            this.pauseLogButton.classList.add('paused'); // Optional: Add class for styling
        } else {
            this.pauseLogButton.textContent = '⏸️ Pause';
            this.pauseLogButton.title = 'Pause Logging';
            this.pauseLogButton.classList.remove('paused');
        }
    }
    // --- END ADDED ---

    /**
     * NEW: Updates the display content and button states for an expanded log entry.
     * @param {HTMLElement} logEntryDiv The .log-entry element.
     * @param {string} requestedMode 'raw', 'markdown', or 'html'.
     * @param {boolean} [forceRawState=false] If true, forces the state to raw (used on collapse).
     */
    async _updateLogEntryDisplay(logEntryDiv, requestedMode, forceRawState = false) {
        if (!logEntryDiv || !logEntryDiv.classList.contains('expanded') && !forceRawState) {
             if(forceRawState) requestedMode = this.RENDER_MODE_RAW;
             else return; 
        }

        const textWrapper = logEntryDiv.querySelector('.log-entry-text-wrapper');
        const markdownToggleButton = logEntryDiv.querySelector('.markdown-toggle-button');
        const htmlToggleButton = logEntryDiv.querySelector('.html-toggle-button');
        const expandedToolbar = logEntryDiv.querySelector('.log-entry-expanded-toolbar');

        if (!textWrapper || !expandedToolbar) {
            console.warn('_updateLogEntryDisplay: Could not find required elements (wrapper or toolbar) for entry.');
            return;
        }

        // Use the trimmed coreMessage for processing (MD, HTML)
        const coreMessage = logEntryDiv.dataset.logCoreMessage || ''; 
        // Use the new rawContentPart for raw <pre> display
        const rawContentPart = logEntryDiv.dataset.logRawContentPart;
        const logType = logEntryDiv.dataset.logType;
        const logIndex = logEntryDiv.dataset.logIndex;

        const finalMode = forceRawState ? this.RENDER_MODE_RAW : requestedMode;
        logEntryDiv.dataset.renderMode = finalMode;
        logPanelMessage(`Updating entry ${logIndex} display to: ${finalMode}`, 'debug');

        if (markdownToggleButton) markdownToggleButton.classList.toggle('active', finalMode === this.RENDER_MODE_MARKDOWN);
        if (htmlToggleButton) htmlToggleButton.classList.toggle('active', finalMode === this.RENDER_MODE_HTML);

        // MODIFIED: Explicitly remove all mode classes, then add the current one
        textWrapper.classList.remove('markdown-rendered', 'html-rendered');
        if (finalMode === this.RENDER_MODE_MARKDOWN) {
            textWrapper.classList.add('markdown-rendered');
        } else if (finalMode === this.RENDER_MODE_HTML) {
            textWrapper.classList.add('html-rendered');
        }
        // If finalMode is RENDER_MODE_RAW, no specific mode class is added here.

        textWrapper.innerHTML = ''; 

        try {
            if (finalMode === this.RENDER_MODE_MARKDOWN) {
                logPanelMessage(`Rendering Markdown for entry ${logIndex}...`, 'debug');
                const result = await renderMarkdown(coreMessage); // Uses trimmed coreMessage
                textWrapper.innerHTML = result.html;
                await postProcessRender(textWrapper);
                logPanelMessage(`Markdown rendered and post-processed for entry ${logIndex}.`, 'debug');

            } else if (finalMode === this.RENDER_MODE_HTML) {
                logPanelMessage(`Rendering HTML in iframe for entry ${logIndex}...`, 'debug');
                const iframe = document.createElement('iframe');
                iframe.className = 'log-entry-html-iframe';
                iframe.style.width = '100%';
                iframe.style.height = '300px'; 
                iframe.style.border = '1px solid #ccc';
                iframe.style.backgroundColor = '#fff';
                iframe.srcdoc = coreMessage; // Uses trimmed coreMessage
                textWrapper.appendChild(iframe);
                logPanelMessage(`Iframe created and appended for entry ${logIndex}.`, 'debug');

            } else { // Default to Raw/Preformatted (finalMode === this.RENDER_MODE_RAW or JSON type)
                 logPanelMessage(`Rendering raw text/pre for entry ${logIndex}...`, 'debug');
                 const pre = document.createElement('pre');
                 // MODIFIED: Use rawContentPart if available, otherwise fallback to coreMessage
                 pre.textContent = (typeof rawContentPart === 'string') ? rawContentPart : coreMessage;
                 textWrapper.appendChild(pre);
            }
        } catch (err) {
             console.error(`Error rendering content for log entry ${logIndex} (mode: ${finalMode}):`, err);
             textWrapper.innerHTML = `<pre>Error rendering content (mode: ${finalMode}):\n${err}</pre>`;
        }
    }
}