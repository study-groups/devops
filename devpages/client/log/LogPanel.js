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

// ADD: Import the event bus
import eventBus from '/client/eventBus.js';

// ADD: Import the necessary functions from uiState
// import { getUIState, setUIState, subscribeToUIStateChange } from '/client/uiState.js';
import { appState } from '/client/appState.js'; // ADDED: Import central state

// ADD: Import triggerActions to call pasteLogEntry directly
import { triggerActions } from '/client/actions.js';

// Comment out the import
// import { appVer } from '/client/config.js';
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
    logFunc(`[${type}] ${message}`);
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
        this._appStateUnsubscribe = appState.subscribe((newState, prevState) => {
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
            this.resizeHandle.addEventListener('click', (e) => e.stopPropagation());
            console.log('[LogPanel] Resize listener attached.');
        } else {
            console.warn('[LogPanel] Resize handle not found, resize disabled.');
        }

        // REMOVED listeners for copy/clear/minimize buttons - handled by data-action

        this._handleResizeMouseMove = this._handleResizeMouseMove.bind(this);
        this._handleResizeMouseUp = this._handleResizeMouseUp.bind(this);

        // REMOVED: eventBus listener for toggle request
        // eventBus.on('logPanel:toggleRequest', this.toggle);

         // We might need a listener for CLI input here if not handled elsewhere
         // Or rely on the cli module attaching its own listener after DOM creation.
         console.log('[LogPanel] Core event listeners attached (resize). Button actions use data-action.');

        // Get the CLI input
        const cliInput = document.getElementById('cli-input');

        // Function to handle sending commands
        const sendCommand = async () => { 
            let originalCommand = cliInput.value.trim();
            let commandToSend = originalCommand;
            let selectionInfo = null;

            if (!originalCommand) return;
            
            // Log the original command input
            if (typeof window.logMessage === 'function') {
                window.logMessage(`> ${originalCommand}`, 'cli-input');
            }

            // <<< NEW: Handle $A / $B substitution >>>
            if (commandToSend.toLowerCase().includes('$a') && this._selectionStateA?.text) {
                commandToSend = commandToSend.replace(/\\$a/gi, this._selectionStateA.text);
                window.logMessage(`[DEBUG] Substituted $A with text (length ${this._selectionStateA.text.length}).`, 'debug');
            } else if (commandToSend.toLowerCase().includes('$a')) {
                 window.logMessage('[WARN] Command contains $A but state A is not set or has no text.', 'warning');
            }

            if (commandToSend.toLowerCase().includes('$b') && this._selectionStateB?.text) {
                commandToSend = commandToSend.replace(/\\$b/gi, this._selectionStateB.text);
                window.logMessage(`[DEBUG] Substituted $B with text (length ${this._selectionStateB.text.length}).`, 'debug');
            } else if (commandToSend.toLowerCase().includes('$b')) {
                 window.logMessage('[WARN] Command contains $B but state B is not set or has no text.', 'warning');
            }
            // <<< END $A / $B Handling >>>
            
            // Clear the input and refocus BEFORE execution
            cliInput.value = '';
            cliInput.focus();

            // <<< NEW: Handle local echo/show/paste for $A/$B >>>
            const commandLower = commandToSend.toLowerCase();
            let handledLocally = false;
            // Show $A
            if (commandLower === 'show $a') {
                if (this._selectionStateA) {
                    const state = this._selectionStateA;
                    const snippet = state.text.substring(0, 100).replace(/\n/g, ' ');
                    const output = `State A: File='${state.filePath}', Range=[${state.start}-${state.end}], Text="${snippet}..."`;
                    this.addEntry(output, 'cli-local-echo'); 
                } else {
                    this.addEntry('State A is not set.', 'cli-local-echo');
                }
                handledLocally = true;
            // Show $B
            } else if (commandLower === 'show $b') {
                if (this._selectionStateB) {
                    const state = this._selectionStateB;
                    const snippet = state.text.substring(0, 100).replace(/\n/g, ' ');
                    const output = `State B: File='${state.filePath}', Range=[${state.start}-${state.end}], Text="${snippet}..."`;
                    this.addEntry(output, 'cli-local-echo'); 
                } else {
                    this.addEntry('State B is not set.', 'cli-local-echo');
                }
                handledLocally = true;
            // Paste $A
            } else if (commandLower === 'paste $a' || commandLower === 'insert $a') {
                if (this._selectionStateA?.text) {
                    triggerActions.pasteTextAtCursor({ textToPaste: this._selectionStateA.text });
                    this.addEntry(`Pasted State A content into editor.`, 'cli-local-echo');
                } else {
                    this.addEntry('Cannot paste State A: State is not set or has no text.', 'cli-local-echo');
                }
                handledLocally = true;
            // Paste $B
            } else if (commandLower === 'paste $b' || commandLower === 'insert $b') {
                if (this._selectionStateB?.text) {
                    triggerActions.pasteTextAtCursor({ textToPaste: this._selectionStateB.text });
                     this.addEntry(`Pasted State B content into editor.`, 'cli-local-echo');
                } else {
                     this.addEntry('Cannot paste State B: State is not set or has no text.', 'cli-local-echo');
                }
                 handledLocally = true;
            }

            // If handled locally, don't send to remote
            if (handledLocally) {
                return;
            }
            // <<< END Local Echo/Show >>>

            // Execute the command (potentially modified)
            console.log("[LOG] Sending command to remote:", commandToSend);
            try {
                const handlersModule = await import('/client/cli/handlers.js');
                if (handlersModule.executeRemoteCommand) {
                    const result = await handlersModule.executeRemoteCommand(commandToSend);
                    // Process result (addEntry will check _lastCommandSelection)
                    if (result && typeof result === 'string') {
                         this.addEntry(result, 'cli-output'); 
                    } else if (result) {
                         this.addEntry(JSON.stringify(result), 'cli-output'); 
                    }
                } else {
                    throw new Error("executeRemoteCommand function not found");
                }
            } catch (error) {
                console.error("[LOG] Error executing command:", error);
                if (typeof window.logMessage === 'function') {
                    window.logMessage(`[ERROR] ${error.message}`, 'error');
                }
                this.addEntry(`[ERROR] ${error.message}`, 'cli-error'); // Log error output
            }
        };

        // Add click handler to button
        const sendButton = document.getElementById('cli-send-button');
        if (sendButton) {
            sendButton.addEventListener('click', sendCommand);
        }

        // Add Enter key handler to input
        if (cliInput) {
            cliInput.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    sendCommand();
                }
            });
        }

        // === ADD DELEGATED LISTENER FOR LOG ENTRIES ===
        if (this.logElement) {
            this.logElement.addEventListener('click', (event) => {
                const logEntryDiv = event.target.closest('.log-entry');
                if (!logEntryDiv) return; // Click wasn't inside a log entry

                // --- Helper Function to set content based on MD state (Defined higher up) ---
                const setContentByMarkdownState = async (entryDiv, isMarkdownActive, animate = false) => {
                    const textWrapper = entryDiv.querySelector('.log-entry-text-wrapper');
                    const markdownToggleButton = entryDiv.querySelector('.markdown-toggle-button'); // Query for the button
                    
                    if (!textWrapper) {
                        console.warn('setContentByMarkdownState: Could not find text wrapper for entry.');
                        return;
                    }

                    textWrapper.classList.toggle('markdown-rendered', isMarkdownActive);
                    if (markdownToggleButton) {
                       markdownToggleButton.classList.toggle('active', isMarkdownActive); 
                    } // Only toggle button if it exists

                    const coreMessage = entryDiv.dataset.logCoreMessage || '';
                    const logType = entryDiv.dataset.logType;
                    const isCurrentlyExpanded = entryDiv.classList.contains('expanded'); // Check current DOM state

                    textWrapper.innerHTML = ''; // Clear previous content

                    // Render MD only if Expanded AND MD Toggle is Active (and not JSON)
                    if (isCurrentlyExpanded && isMarkdownActive && logType !== 'json') {
                        // Render Markdown
                        try {
                            const result = await renderMarkdown(coreMessage);
                            textWrapper.innerHTML = result.html;
                            // Run post-processing AFTER setting innerHTML
                            await postProcessRender(textWrapper);
                            logPanelMessage(`Post-processing applied to log entry ${entryDiv.dataset.logIndex}.`, 'debug');
                        } catch (err) {
                            const logIndex = entryDiv.dataset.logIndex; // Get index for error message
                            console.error(`Error rendering markdown or post-processing for log entry ${logIndex}:`, err);
                            textWrapper.innerHTML = `<pre>Error rendering Markdown/processing content:\n${err}</pre>`;
                        }
                    } else {
                        // Revert to Raw Text (or JSON pre)
                        const pre = document.createElement('pre');
                        pre.textContent = coreMessage; // Use coreMessage which is already stringified JSON or raw text
                        textWrapper.appendChild(pre);
                    }
                    // Optional: Add animation class
                    // if (animate) { ... }
                };

                // Check if the click was on a button within the entry
                const clickedButton = event.target.closest('.log-entry-button');

                if (clickedButton) {
                    // --- Clicked a Button (Copy/Paste/etc.) ---
                    console.log('[LogPanel Listener] Clicked a button inside log entry.');
                    
                    // Handle the original copy/paste button logic
                    if (clickedButton.classList.contains('original-button') || clickedButton.classList.contains('toolbar-button')) {
                        const logText = clickedButton.dataset.logText; // Get text from button's data attr
                        if (logText === undefined) {
                           console.warn('Copy/Paste button clicked, but logText data attribute is missing!');
                           return; 
                        }

                        if (event.shiftKey) {
                            // Shift+Click: Paste to Editor
                            console.log('[LogPanel Listener] Shift+Click detected. Triggering pasteLogEntry...');
                            triggerActions.pasteLogEntry({ logText: logText }, clickedButton); 
                        } else {
                            // Normal Click: Copy to Clipboard
                            console.log('[LogPanel Listener] Normal click detected. Triggering copyLogEntryToClipboard...');
                            triggerActions.copyLogEntryToClipboard({ logText: logText }, clickedButton);
                        }
                    } 
                    // <<< Add handling for other button types (like paste-over) here if re-introduced >>>
                    
                    // Prevent the click from also toggling the expand/collapse state
                    event.stopPropagation(); 

                } else {
                    // --- Clicked the Log Entry Text Area (Toggle Expand/Collapse) ---
                    console.log('[LogPanel Listener] Clicked log entry text area (or whitespace).');
                    logEntryDiv.classList.toggle('expanded');
                    const isExpanded = logEntryDiv.classList.contains('expanded');
                    const expandedToolbar = logEntryDiv.querySelector('.log-entry-expanded-toolbar');
                    
                    // Move expanded element to top
                    if (isExpanded && this.logElement) {
                        this.logElement.prepend(logEntryDiv);
                    }

                    if (isExpanded && expandedToolbar) {
                        console.log('[LogPanel Listener] Expanding entry, building toolbar.');
                        // --- Build the Expanded Toolbar --- 
                        expandedToolbar.innerHTML = ''; // Clear previous content
                        const { logIndex, logTimestamp, logType, logSubtype, logCoreMessage, rawOriginalMessage } = logEntryDiv.dataset;
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
                        
                        const markdownToggleButton = document.createElement('button');
                        markdownToggleButton.textContent = 'MD';
                        markdownToggleButton.className = 'log-entry-button markdown-toggle-button';
                        markdownToggleButton.title = 'Toggle Markdown Rendering';
                        markdownToggleButton.dataset.action = 'toggleMarkdownRender'; 
                        expandedToolbar.appendChild(markdownToggleButton);

                        const toolbarCopyButton = document.createElement('button');
                        toolbarCopyButton.innerHTML = '&#128203;'; 
                        toolbarCopyButton.className = 'log-entry-button toolbar-button'; 
                        toolbarCopyButton.title = 'Copy log entry text (Shift+Click to Paste)'; 
                        toolbarCopyButton.dataset.logText = rawOriginalMessage || ''; 
                        expandedToolbar.appendChild(toolbarCopyButton);

                        // --- Set Initial Content and Button State on Expand ---
                        const isMarkdownRenderedInitially = logEntryDiv.dataset.markdownRendered === 'true';
                        (async () => {
                           // Pass logEntryDiv to the helper function
                           await setContentByMarkdownState(logEntryDiv, isMarkdownRenderedInitially, false);
                        })();
                         
                        // --- Add Click Listener for MD Toggle --- 
                        markdownToggleButton.addEventListener('click', async (mdEvent) => {
                            mdEvent.stopPropagation(); 
                            const currentState = logEntryDiv.dataset.markdownRendered === 'true';
                            const newState = !currentState;
                            logEntryDiv.dataset.markdownRendered = newState; // Update stored state
                            
                            // Pass logEntryDiv to the helper function
                            await setContentByMarkdownState(logEntryDiv, newState, true);
                        });

                     } else if (!isExpanded) { // Removed expandedToolbar check here, we always want to reset content on collapse
                        console.log('[LogPanel Listener] Collapsing entry.');
                        // Reset the stored state attribute on collapse
                        logEntryDiv.dataset.markdownRendered = 'false'; 

                        // Explicitly revert content to raw text when collapsing
                        (async () => {
                           // Pass logEntryDiv to the helper function
                           await setContentByMarkdownState(logEntryDiv, false, false);
                        })();
                     }
                     
                    // Optional: Adjust scroll if expanding makes it go off-screen
                    // logEntryDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
            console.log('[LogPanel] Updated delegated click listener on #log element for expand/copy/paste.');
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
             // <<< MODIFIED DEBUGGING >>>
             console.warn(`[LogPanel] Log element (#log) not found when trying to add entry:`, { message, type });
             return;
        }

        // Check for empty, undefined, or null messages
        if (message === undefined || message === null) {
            console.warn('[LogPanel] Empty log message received, ignoring');
            return;
        }
        
        // Convert to string if it's not already
        let messageStr = String(message);
        if (messageStr.trim() === '') { // Check trimmed empty string for *all* types now
             console.warn('[LogPanel] Empty or whitespace-only log message received, ignoring');
             return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-entry-${type}`;
        // Apply specific class for styling based on type (level) - moved earlier
        logEntry.classList.add(`log-${type.toLowerCase()}`); 
        logEntry.style.display = 'flex'; // Keep flex for main layout
        logEntry.style.justifyContent = 'space-between';
        logEntry.style.alignItems = 'flex-start'; // Align items to the top

        // --- Parse Subtype and Core Message ---
        let subtype = null;
        let coreMessage = messageStr;
        // Replace the line below completely to fix potential hidden character issues
        // const subtypeMatch = messageStr.match(/^\\s*\\[([A-Z0-9_-]+)\\]\\s*(.*)/i);
        // --- Try using RegExp constructor --- 
        const subtypeRegex = new RegExp('^\\s*\\[([A-Z0-9_-]+)\\]\\s*(.*)', 'i'); 
        const subtypeMatch = subtypeRegex.exec(messageStr);
        // --- End RegExp constructor attempt ---
        if (subtypeMatch) {
            subtype = subtypeMatch[1];
            coreMessage = subtypeMatch[2].trim(); // Use the rest as the core message
            // Add subtype class for potential styling
            logEntry.classList.add(`log-subtype-${subtype.toLowerCase().replace(/[^a-z0-9\\-]/g, '-')}`);
        }
        // --- End Subtype Parsing ---

        // --- Store Data Attributes on logEntry element ---
        const currentLogIndex = this.state.clientLogIndex; // Store before incrementing
        logEntry.dataset.logIndex = currentLogIndex;
        logEntry.dataset.logTimestamp = timestamp;
        logEntry.dataset.logType = type;
        if (subtype) {
            logEntry.dataset.logSubtype = subtype;
        }
        logEntry.dataset.logCoreMessage = coreMessage; // Store the message without the subtype prefix
        // Store the raw original string message as well for full copy/paste if needed
        logEntry.dataset.rawOriginalMessage = messageStr; 
        // --- End Data Attributes ---


        // Create a span for the actual text content to be displayed initially
        const textSpan = document.createElement('span');
        textSpan.className = 'log-entry-text-content'; // Assign class to inner content span
        
        let displayMessage = ''; // This will hold the formatted text shown initially
        let rawMessageForCopyButton = ''; // This will be stored in the copy button

        // Format the initially displayed message (index, timestamp, original message)
        // We include the subtype prefix here if it existed, for initial visibility.
        displayMessage = `[${currentLogIndex}] ${timestamp} ${messageStr}`; 
        // Set the raw message for the copy button to the original message string
        rawMessageForCopyButton = messageStr;

        // Handle JSON type separately for display formatting
        if (type === 'json') {
            let jsonString = '[Error stringifying JSON]';
             try {
                 // Use the original 'message' object here, not messageStr
                 jsonString = JSON.stringify(message, null, 2); 
                 coreMessage = jsonString; // Update core message for data attribute
                 logEntry.dataset.logCoreMessage = coreMessage; 
                 rawMessageForCopyButton = jsonString; // Update raw message for button
             } catch (e) {
                 // Keep default error string
             }
            // Display format for JSON
            displayMessage = `[${currentLogIndex}] ${timestamp} [JSON]`;
            const pre = document.createElement('pre');
            pre.textContent = jsonString;
            textSpan.textContent = displayMessage; // Set text part first
            textSpan.appendChild(pre); // Append JSON <pre> block
        } else {
            // For non-JSON types, just set the text content
            textSpan.innerText = displayMessage;
        }


        // >> Create a wrapper for the text content <<
        const textWrapper = document.createElement('span');
        textWrapper.className = 'log-entry-text-wrapper';
        // textWrapper.dataset.rawMessage = rawMessageForDataAttr; // REMOVED: raw message now on logEntry.dataset.rawOriginalMessage
        textWrapper.appendChild(textSpan); // Put the actual content span inside the wrapper

        // Append the text WRAPPER to the log entry
        logEntry.appendChild(textWrapper);

        // >>> Create the ORIGINAL copy button (visible when collapsed) <<<
        const originalCopyButton = document.createElement('button');
        originalCopyButton.innerHTML = '&#128203;'; // Clipboard emoji
        originalCopyButton.className = 'log-entry-button original-button'; // Add class to distinguish
        originalCopyButton.title = 'Copy log entry text (Shift+Click to Paste)'; 
        // Add the RAW message to the button's dataset for the action handler
        originalCopyButton.dataset.logText = rawMessageForCopyButton; 
        logEntry.appendChild(originalCopyButton);
        
        // >> NEW: Create the Expanded Toolbar (INITIALLY EMPTY) <<
        const expandedToolbar = document.createElement('div');
        expandedToolbar.className = 'log-entry-expanded-toolbar';
        // Don't add buttons or content here; it will be built on expand

        // Append the hidden toolbar to the log entry
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
        const isVisible = appState.getState().ui.logVisible; // ADDED: Get from appState
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
} 