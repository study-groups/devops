/**
 * LogPanel.js
 * Encapsulates the UI and logic for the log panel component.
 */

const LOG_VISIBLE_KEY = 'logVisible';
const LOG_HEIGHT_KEY = 'logHeight';
const DEFAULT_LOG_HEIGHT = 120;
const MIN_LOG_HEIGHT = 80;

// Assuming updatePreview might be needed later
// import { updatePreview } from '../preview.js'; // Potential path? Check correct path.

// ADD: Import the event bus
import eventBus from '/client/eventBus.js';

// ADD: Import the necessary functions from uiState
import { getUIState, setUIState, subscribeToUIStateChange } from '/client/uiState.js';

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
        // Buttons are now found via toolbarElement or have data-actions

        this.state = {
            height: DEFAULT_LOG_HEIGHT,
            entryCount: 0,
        };

        this._isResizing = false;
        this._startY = 0;
        this._startHeight = 0;

        // Bind core methods that might be called externally or as listeners
        this.addEntry = this.addEntry.bind(this);
        this.copyLog = this.copyLog.bind(this);
        this.clearLog = this.clearLog.bind(this);

        // Add a property to store the unsubscribe function
        this._logVisibleUnsubscribe = null;

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
        this.subscribeToStateChanges(); // ADDED: Subscribe to uiState.logVisible
        this.updateUI();
        this.updateEntryCount(); // Initial count
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
        
        // Create Toolbar Buttons with data-actions
        this._createToolbarButton('copy-log-btn', 'Copy', 'copyLog');
        this._createToolbarButton('info-btn', 'ℹ️', 'showSystemInfo', 'System Information');
        this._createToolbarButton('clear-log-btn', 'Clear', 'clearLog');
        this._createToolbarButton('debug-btn', '🔍 Debug', 'runDebugUI', 'Run diagnostics');
        this._createToolbarButton('static-html-btn', 'Static HTML', 'downloadStaticHTML', 'Download Static HTML');

        // Create CLI Input
        this.cliInputElement = document.createElement('input');
        this.cliInputElement.type = 'text';
        this.cliInputElement.id = 'cli-input';
        this.cliInputElement.placeholder = 'Enter command...';
        // keydown listener for CLI is attached separately in cli/index.js
        this.toolbarElement.appendChild(this.cliInputElement);
        
        // Create CLI Send Button
        const sendButton = document.createElement('button');
        sendButton.id = 'cli-send-button';
        sendButton.textContent = 'Send';
        this.toolbarElement.appendChild(sendButton);
        
        // Create App Info Span
        this.appInfoElement = document.createElement('span');
        this.appInfoElement.id = 'app-info';
        this.appInfoElement.className = 'app-info'; // Use class for styling
        this.appInfoElement.dataset.action = 'showAppInfo'; 
        this.toolbarElement.appendChild(this.appInfoElement);

        // Create Minimize Button (Moved BEFORE status span)
        this._createToolbarButton('minimize-log-btn', '✕', 'minimizeLog', 'Minimize Log');

        // Create Status Span (Will be pushed right by margin-left: auto)
        this.statusElement = document.createElement('span');
        this.statusElement.id = 'log-status';
        this.statusElement.textContent = '0 entries';
        this.toolbarElement.appendChild(this.statusElement);

        // Create Log Content Area
        this.logElement = document.createElement('div');
        this.logElement.id = 'log';
        this.container.appendChild(this.logElement);

        // Create Resize Handle
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.id = 'log-resize-handle';
        this.resizeHandle.title = 'Resize Log';
        this.container.appendChild(this.resizeHandle);
        
        console.log('[LogPanel] DOM structure created.');
    }
    
    /** Helper to create toolbar buttons */
    _createToolbarButton(id, text, action, title = null) {
        if (!this.toolbarElement) return;
        const button = document.createElement('button');
        button.id = id;
        button.textContent = text;
        if (action) {
            button.dataset.action = action; // Set data-action for global handler
        }
        if (title) {
            button.title = title;
        }
        this.toolbarElement.appendChild(button);
        // Removed direct listener attachment here
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
     * ADDED: Subscribe to relevant UI state changes.
     */
    subscribeToStateChanges() {
        // Unsubscribe if already subscribed (e.g., during re-initialization)
        if (this._logVisibleUnsubscribe) {
            this._logVisibleUnsubscribe();
        }
        // Subscribe to logVisible changes and trigger UI update
        this._logVisibleUnsubscribe = subscribeToUIStateChange('logVisible', (isVisible) => {
            console.log(`%c[LogPanel] Received uiState change via subscription: logVisible=${isVisible}`, 'color: cyan'); 
            this.updateUI(); // Update UI when central state changes
        });
        console.log('[LogPanel] Subscribed to uiState.logVisible changes.');
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
        async function sendCommand() {
            const command = cliInput.value.trim();
            if (!command) return;
            
            console.log("[LOG] Sending command:", command);
            
            // Log the command to the UI
            if (typeof window.logMessage === 'function') {
                window.logMessage(`> ${command}`);
            }
            
            // Clear the input and refocus
            cliInput.value = '';
            cliInput.focus();
            
            try {
                // Import and use the handler module directly without destructuring
                const handlersModule = await import('/client/cli/handlers.js');
                if (handlersModule.executeRemoteCommand) {
                    await handlersModule.executeRemoteCommand(command);
                } else {
                    throw new Error("executeRemoteCommand function not found");
                }
            } catch (error) {
                console.error("[LOG] Error executing command:", error);
                if (typeof window.logMessage === 'function') {
                    window.logMessage(`[ERROR] ${error.message}`, 'error');
                }
            }
        }

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
    }

    // --- Core Methods ---

    /**
     * Adds a log message to the panel.
     * @param {string|object} message - The message to log
     * @param {string} [type='text'] - The message type ('text', 'json', 'error', 'warning', etc.). Used for styling.
     */
    addEntry(message, type = 'text') {
        if (!this.logElement) {
             console.warn('[LogPanel] Log element not ready for addEntry');
             return; 
        }

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-entry-${type}`; // Add type class for styling

        if (type === 'text') {
            logEntry.textContent = `${timestamp} ${message}`;
        } else if (type === 'json') {
            logEntry.textContent = `${timestamp} [JSON] `;
            const pre = document.createElement('pre');
            try {
                pre.textContent = JSON.stringify(message, null, 2); // Pretty-print JSON
            } catch (e) {
                pre.textContent = '[Error stringifying JSON]';
            }
            logEntry.appendChild(pre);
        } else {
            // Handle other types like 'error', 'warning' - maybe just add text?
             logEntry.textContent = `${timestamp} ${message}`;
        }

        // Add click event listener to add to preview (Optional - requires updatePreview)
        /* // Commented out for now to avoid circular dependency
        logEntry.addEventListener('click', () => {
            const editor = document.querySelector('#md-editor textarea'); // Example selector
            if (editor) {
                let contentToAdd = '';
                if (type === 'text') {
                    contentToAdd = message;
                } else if (type === 'json') {
                    try {
                       contentToAdd = JSON.stringify(message, null, 2);
                    } catch { contentToAdd = '[Unstringifiable JSON]'; }
                }
                if (contentToAdd) {
                    editor.value += contentToAdd + "\n";
                    // Need a way to call updatePreview safely here
                    // e.g., this.eventBus.emit('preview:updateRequest', editor.value);
                    // or if passed in: this.updatePreviewCallback(editor.value);
                    console.log('[LogPanel] Clicked log entry, requested preview update.');
                }
            }
        });
        */

        this.logElement.appendChild(logEntry);
        this.state.entryCount++;
        this.updateEntryCount(); // Use internal method
        this.scrollToBottom();

        // Also log to console for debugging
        console.log(`${timestamp} [${type.toUpperCase()}] ${type === 'json' ? JSON.stringify(message) : message}`);
    }

    /**
     * Clears all entries from the log panel.
     */
    clearLog() {
        if (!this.logElement) return;
        this.logElement.innerHTML = '';
        this.state.entryCount = 0;
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

        const isVisible = getUIState('logVisible');
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
        if (this._logVisibleUnsubscribe) {
            this._logVisibleUnsubscribe();
            this._logVisibleUnsubscribe = null;
            console.log('[LogPanel] Unsubscribed from uiState changes.');
        }
        // Remove resize listener if necessary (though usually component is destroyed with page)
        if (this.resizeHandle) {
            this.resizeHandle.removeEventListener('mousedown', this._handleResizeMouseDown);
        }
        document.removeEventListener('mousemove', this._handleResizeMouseMove); // Clean up global listeners
        document.removeEventListener('mouseup', this._handleResizeMouseUp); // Clean up global listeners
        console.log('[LogPanel] Destroyed.');
    }
} 