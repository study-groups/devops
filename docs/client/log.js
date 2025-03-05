// Move this near the top of the file
let forceVisibleOnLog = false;
let lastToggleTime = 0;
const TOGGLE_DEBOUNCE = 200; // ms
const recentMessages = new Set();
const MESSAGE_DEBOUNCE = 300; // ms

// Track how the toggle was initiated
let toggleSource = '';

// Add a flag to track if we're interacting with a split
let interactingWithSplit = false;

// Add a flag to track view changes
export let recentViewChange = false;

// Add initialization tracking
let initialized = false;

// FORCE LOG TO ALWAYS BE HIDDEN BY DEFAULT NO MATTER WHAT
export function forceLogHidden(saveToStorage = true) {
    console.log('[LOG] Forcing log to be hidden');
    logState.visible = false;
    
    // Only update localStorage if requested
    if (saveToStorage) {
        localStorage.setItem('logVisible', 'false');
    }
    
    // Set the data attribute on the HTML element for CSS to use
    document.documentElement.setAttribute('data-log-visible', 'false');
    
    // Directly manipulate the DOM to hide the log
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        logContainer.style.display = 'none';
        logContainer.style.visibility = 'hidden';
        logContainer.classList.remove('visible');
        logContainer.classList.add('hidden');
        logContainer.setAttribute('data-log-visible', 'false');
    } else {
        console.log('[LOG] Log container not found in DOM');
    }
    
    // Update buttons and UI state
    logState.updateUI();
    return false;
}

// Log message functionality
export function logMessage(message) {
    // Debounce certain messages like UI toggle messages
    if (message.includes('[UI] Log toggled')) {
        const key = `${message}-${Date.now() - (Date.now() % MESSAGE_DEBOUNCE)}`;
        if (recentMessages.has(key)) {
            return; // Skip duplicate UI toggle messages
        }
        
        // Add to recent messages and set timeout to remove
        recentMessages.add(key);
        setTimeout(() => {
            recentMessages.delete(key);
        }, MESSAGE_DEBOUNCE);
    }
    
    const logDiv = document.getElementById('log');
    if (!logDiv) return;
    
    const timeStamp = new Date().toLocaleTimeString();
    const formattedMessage = `${timeStamp} ${message}`;
    
    // Add color coding based on message type
    let className = 'log-normal';
    if (message.includes('ERROR')) className = 'log-error';
    if (message.includes('WARN')) className = 'log-warning';
    if (message.includes('CONFIG')) className = 'log-config';
    
    const newEntry = document.createElement('div');
    newEntry.className = className;
    newEntry.textContent = formattedMessage;
    logDiv.appendChild(newEntry);
    
    // Check if the line is truncated
    setTimeout(() => {
        if (newEntry.scrollWidth > newEntry.clientWidth) {
            newEntry.classList.add('truncated');
        }
    }, 0);
    
    logDiv.scrollTop = logDiv.scrollHeight;
    
    // Update log status count if available
    const logStatus = document.getElementById('log-status');
    if (logStatus) {
        const count = logDiv.children.length;
        logStatus.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;
    }
    
    // Remove or modify the auto-show behavior
    // Only force log to be visible if explicitly requested
    if (forceVisibleOnLog && !message.includes('[LOG] Log shown') && 
        !message.includes('[LOG] Log hidden') && 
        !logState._suppressLogging && 
        message.includes('[FORCE_LOG]')) { // Only show for critical messages
        logState._suppressLogging = true;
        logState.setVisible(true);
        logState._suppressLogging = false;
    }
}

// Log state module with a single source of truth
export const logState = {
    visible: false, // Default to hidden
    height: 120,    // Default value
    _suppressLogging: false,
    
    toggle() {
        this.visible = !this.visible;
        this.saveState();
        this.updateUI();
        console.log('[LOG DEBUG] Log toggled, new state:', this.visible); // Add debug log
        
        if (!this._suppressLogging) {
            this._suppressLogging = true;
            logMessage(`[LOG] Log ${this.visible ? 'shown' : 'hidden'}`);
            this._suppressLogging = false;
        }
        
        return this.visible;
    },
    
    setVisible(visible) {
        if (this.visible !== visible) {
            this.visible = visible;
            this.saveState();
            this.updateUI();
            console.log('[LOG DEBUG] Log visibility set to:', visible); // Add debug log
            
            if (!this._suppressLogging) {
                this._suppressLogging = true;
                logMessage(`[LOG] Log ${this.visible ? 'shown' : 'hidden'}`);
                this._suppressLogging = false;
            }
        }
        return this.visible;
    },
    
    setHeight(height) {
        this.height = Math.max(80, height);
        this.saveState();
        this.updateUI();
    },
    
    updateUI() {
        const logContainer = document.getElementById('log-container');
        if (!logContainer) {
            console.log('[LOG] Log container not found during updateUI');
            return;
        }
        
        // Update the data attribute on both the log container and the HTML element
        logContainer.setAttribute('data-log-visible', this.visible ? 'true' : 'false');
        document.documentElement.setAttribute('data-log-visible', this.visible ? 'true' : 'false');
        
        // Always update the CSS variable for height, regardless of visibility
        document.documentElement.style.setProperty('--log-height', `${this.height}px`);
        
        if (this.visible) {
            logContainer.style.display = 'flex';
            logContainer.style.opacity = '1';
            logContainer.style.height = `${this.height}px`;
            logContainer.style.visibility = 'visible';
            logContainer.classList.remove('log-hiding');
            logContainer.classList.add('log-showing');
            
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.classList.add('log-visible');
                mainContainer.classList.remove('log-hidden');
            }
            
            // Update log button state
            const logButton = document.getElementById('log-btn');
            if (logButton) {
                logButton.classList.add('active');
            }
        } else {
            // Immediately hide from flow
            logContainer.style.display = 'none';
            logContainer.style.opacity = '0';
            logContainer.style.visibility = 'hidden';
            logContainer.classList.remove('log-showing');
            logContainer.classList.add('log-hiding');
            logContainer.style.height = '0px';
            logContainer.style.minHeight = '0px';
            logContainer.style.overflow = 'hidden';
            
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.classList.remove('log-visible');
                mainContainer.classList.add('log-hidden');
            }
            
            // Update log button state
            const logButton = document.getElementById('log-btn');
            if (logButton) {
                logButton.classList.remove('active');
            }
        }
        
        // Always update buttons for consistency
        this.updateButtons();
    },
    
    updateButtons() {
        const logBtn = document.getElementById('log-btn');
        if (logBtn) {
            logBtn.classList.toggle('active', this.visible);
        }
        
        const minimizeBtn = document.getElementById('minimize-log-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = '×';
            minimizeBtn.title = this.visible ? 'Hide Log' : 'Show Log';
            minimizeBtn.style.opacity = '0.7';
            minimizeBtn.style.cursor = 'pointer';
        }
    },
    
    saveState() {
        localStorage.setItem('logVisible', String(this.visible));
        localStorage.setItem('logHeight', String(this.height));
        console.log(`[LOG DEBUG] State saved to localStorage: visible=${this.visible}, height=${this.height}`);
    }
};

// Listen for view change events
document.addEventListener('view:changed', (e) => {
    console.log('View change detected:', e.detail);
    
    // Set a flag to prevent log toggling during view changes
    recentViewChange = true;
    
    // Reset the flag after a short delay
    setTimeout(() => {
        recentViewChange = false;
    }, 500);
});

// Update toggleLog to check for recent view changes
export function toggleLog(source = 'button') {
    // Simple check for active input elements
    const activeElement = document.activeElement;
    if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable
    )) {
        // Don't toggle if we're in an input
        return logState.visible;
    }
    
    // Don't toggle during split interactions
    if (interactingWithSplit || recentViewChange) {
        return logState.visible;
    }
    
    // Debounce rapid toggles
    const now = Date.now();
    if (now - lastToggleTime < TOGGLE_DEBOUNCE) {
        return logState.visible;
    }
    
    lastToggleTime = now;
    console.log('[LOG] Toggling log visibility');
    
    // Call the simpler toggle function
    toggleSource = source;
    return toggleLogWithoutAutoShow(source);
}

// Initialize log toolbar with resize functionality
export function initLogToolbar() {
    // Only run once
    if (window._logToolbarInitialized) {
        console.log('[LOG] Log toolbar already initialized');
        return true;
    }
    
    const logContainer = document.getElementById('log-container');
    if (!logContainer) {
        console.log('[LOG] Log container not found during toolbar initialization');
        return false;
    }

    // Apply current state
    logState.updateUI();

    // Set up resize handle
    setupLogResize();
    
    // Add app name and version to log bar
    addAppInfoToLogBar();
    
    // Connect info button to showSystemInfo function
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', async () => {
            try {
                // Import the showSystemInfo function from uiManager.js
                const { showSystemInfo } = await import('./uiManager.js');
                await showSystemInfo();
            } catch (error) {
                logMessage(`[ERROR] Failed to show system info: ${error.message}`);
            }
        });
        console.log('[LOG] Info button connected to showSystemInfo function');
    }
    
    // Mark as initialized
    window._logToolbarInitialized = true;
    console.log('[LOG] Log toolbar initialized');
    
    return true;
}

// Set up log resize functionality
function setupLogResize() {
    const logContainer = document.getElementById('log-container');
    const resizeHandle = document.getElementById('log-resize-handle');
    
    if (!logContainer || !resizeHandle) return;
    
    let startY, startHeight;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        startY = e.clientY;
        startHeight = logContainer.offsetHeight;
        
        resizeHandle.classList.add('resizing');
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Prevent event from propagating to parent elements
        e.stopPropagation();
        e.preventDefault();
    });
    
    // Add click handler directly to the resize handle
    resizeHandle.addEventListener('click', (e) => {
        // Prevent clicks on the resize handle from affecting the log toggle
        e.stopPropagation();
        e.preventDefault();
        console.log('Resize handle clicked (propagation stopped)');
    });
    
    function handleMouseMove(e) {
        const newHeight = startHeight - (e.clientY - startY);
        if (newHeight >= 80) { // Minimum height
            // Update both the inline style and the CSS variable
            logContainer.style.height = `${newHeight}px`;
            document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
            
            // Update the content area to reflect the new log height
            const mainContainer = document.getElementById('main-container');
            if (mainContainer && mainContainer.classList.contains('log-visible')) {
                const content = document.getElementById('content');
                if (content) {
                    content.style.maxHeight = `calc(100vh - ${newHeight}px - 50px)`;
                }
            }
        }
    }
    
    function handleMouseUp(e) {
        // Get the current height of the log container
        const currentHeight = logContainer.offsetHeight;
        
        // Store the user's preferred height in the state
        logState.setHeight(currentHeight);
        
        // Also update the CSS variable directly
        document.documentElement.style.setProperty('--log-height', `${currentHeight}px`);
        
        // Save to localStorage directly to ensure it's saved
        localStorage.setItem('logHeight', String(currentHeight));
        
        console.log(`[LOG] Resize complete. New height: ${currentHeight}px`);
        
        // Clean up
        resizeHandle.classList.remove('resizing');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
}

// Clear log function
export function clearLog() {
    const logDiv = document.getElementById('log');
    if (logDiv) {
        logDiv.innerHTML = '';
        
        // Update log status count
        const logStatus = document.getElementById('log-status');
        if (logStatus) {
            logStatus.textContent = '0 entries';
        }
        
        logMessage('[LOG] Log cleared');
    }
}

// Copy log function
export function copyLog() {
    const logDiv = document.getElementById('log');
    if (logDiv) {
        const logText = Array.from(logDiv.children)
            .map(entry => entry.textContent)
            .join('\n');
        
        navigator.clipboard.writeText(logText)
            .then(() => {
                logMessage('[LOG] Log copied to clipboard');
            })
            .catch(err => {
                logMessage('[LOG ERROR] Failed to copy log: ' + err);
            });
    }
}

// Connect log buttons
export function ensureLogButtonsConnected() {
    // Only run once
    if (window._logButtonsConnected) return;
    
    // Connect the log button in the nav bar
    const logBtn = document.getElementById('log-btn');
    if (logBtn) {
        // Remove any existing event listeners
        logBtn.replaceWith(logBtn.cloneNode(true));
        
        // Get the fresh reference
        const freshLogBtn = document.getElementById('log-btn');
        
        // Add our click handler
        freshLogBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[LOG] Log button clicked');
            toggleLog('button');
        });
    }
    
    // Connect the minimize button in the log toolbar
    const minimizeBtn = document.getElementById('minimize-log-btn');
    if (minimizeBtn) {
        // Remove any existing event listeners
        minimizeBtn.replaceWith(minimizeBtn.cloneNode(true));
        
        // Get the fresh reference
        const freshMinimizeBtn = document.getElementById('minimize-log-btn');
        
        // Add our click handler
        freshMinimizeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[LOG] Minimize button clicked');
            toggleLog('button');
        });
    }
    
    window._logButtonsConnected = true;
    console.log('[LOG] Log buttons connected');
}

// Initialize log visibility from localStorage
export function initLogVisibility() {
    if (initialized) {
        console.log('[LOG] Already initialized, skipping');
        return;
    }

    console.log('[LOG] Starting log initialization');
    
    // Get ALL localStorage values related to log state for debugging
    const storedVisibility = localStorage.getItem('logVisible');
    const storedHeight = localStorage.getItem('logHeight');
    
    // Debug all current localStorage values
    console.log('[LOG] LOCALSTORAGE VALUES:');
    console.log('[LOG] - logVisible:', storedVisibility);
    console.log('[LOG] - logHeight:', storedHeight);
    console.log('[LOG] - All localStorage:', Object.entries(localStorage).filter(([key]) => key.includes('log')));
    
    // Set the data attribute on the HTML element for CSS to use
    document.documentElement.setAttribute('data-log-visible', storedVisibility === 'true' ? 'true' : 'false');
    
    // Also set it on the log container if it exists
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        logContainer.setAttribute('data-log-visible', storedVisibility === 'true' ? 'true' : 'false');
    }
    
    // CRITICAL: Set visibility DIRECTLY from localStorage, with no additional logic
    if (storedVisibility === 'true') {
        logState.visible = true;
        console.log('[LOG] *** RESPECTING USER PREFERENCE: Setting log VISIBLE from localStorage ***');
        // DO NOT save anything to localStorage here as it might override user's value
    } else {
        logState.visible = false;
        console.log('[LOG] Setting log HIDDEN (default or from localStorage)');
        
        // Only set localStorage if null (don't overwrite false value)
        if (storedVisibility === null) {
            localStorage.setItem('logVisible', 'false');
            console.log('[LOG] No stored value, saving default (false) to localStorage');
        }
    }

    // Handle height
    if (storedHeight !== null) {
        logState.height = parseInt(storedHeight, 10) || 120;
        console.log('[LOG] Using stored height:', logState.height);
        
        // Set the CSS variable for height
        document.documentElement.style.setProperty('--log-height', `${logState.height}px`);
    } else {
        localStorage.setItem('logHeight', String(logState.height));
        console.log('[LOG] No stored height, saving default:', logState.height);
        
        // Set the CSS variable for height with the default value
        document.documentElement.style.setProperty('--log-height', `${logState.height}px`);
    }

    // IMPORTANT - Disable auto-saving state to localStorage during initialization
    const originalSaveState = logState.saveState;
    logState.saveState = function() {
        console.log('[LOG] State save PREVENTED during initialization');
    };
    
    // Connect buttons once during initialization
    ensureLogButtonsConnected();
    
    // Initialize the log toolbar
    initLogToolbar();
    
    // Update UI based on the stored state
    logState.updateUI();
    
    // Mark as initialized
    initialized = true;
    console.log('[LOG] Log initialization complete');
    
    // Restore save state functionality after a short delay
    setTimeout(() => {
        logState.saveState = originalSaveState;
        console.log('[LOG] Normal state saving restored');
    }, 500);
    
    // Final debug - confirm log state in console
    console.log('[LOG] FINAL STATE AFTER INIT:');
    console.log('[LOG] - logState.visible =', logState.visible);
    console.log('[LOG] - logState.height =', logState.height);
    console.log('[LOG] - localStorage.logVisible =', localStorage.getItem('logVisible'));
}

// Consolidate all DOMContentLoaded listeners into one
let domReadyHandled = false;
document.addEventListener('DOMContentLoaded', () => {
    if (domReadyHandled) return;
    domReadyHandled = true;
    
    console.log('[LOG] DOM Content Loaded - starting initialization');
    
    // Complete initialization in one place - respects localStorage
    initLogVisibility();
    
    // Add view change listener
    document.addEventListener('view:changed', (e) => {
        console.log('View change detected:', e.detail);
        recentViewChange = true;
        
        // Update UI when view changes - don't change visibility
        logState.updateUI();
        
        // Reset the flag after a short delay
        setTimeout(() => {
            recentViewChange = false;
        }, 500);
    });
});

// Add a window load event to ensure log state is correctly reflected in UI
window.addEventListener('load', () => {
    console.log('[LOG] Window loaded - checking localStorage state');
    
    // Wait for any other onload handlers to complete
    setTimeout(() => {
        const storedVisibility = localStorage.getItem('logVisible');
        console.log('[LOG] Window loaded check - localStorage.logVisible =', storedVisibility);
        
        // CRITICAL: Ensure UI reflects localStorage without triggering saveState()
        if (storedVisibility === 'true' && !logState.visible) {
            console.log('[LOG] *** FIXING UI: Making log visible based on localStorage ***');
            
            // Temporarily disable saveState
            const originalSaveState = logState.saveState;
            logState.saveState = function() {
                console.log('[LOG] State save PREVENTED during visibility fix');
            };
            
            // Update both logState and UI - this will fix button state too
            logState.visible = true;
            logState.updateUI();
            
            // Restore original saveState
            setTimeout(() => {
                logState.saveState = originalSaveState;
                console.log('[LOG] Normal state saving restored after visibility fix');
            }, 100);
            
        } else if (storedVisibility === 'false' && logState.visible) {
            console.log('[LOG] *** FIXING UI: Making log hidden based on localStorage ***');
            
            // Temporarily disable saveState
            const originalSaveState = logState.saveState;
            logState.saveState = function() {
                console.log('[LOG] State save PREVENTED during visibility fix');
            };
            
            // Update both logState and UI - this will fix button state too
            logState.visible = false;
            logState.updateUI();
            
            // Restore original saveState
            setTimeout(() => {
                logState.saveState = originalSaveState;
                console.log('[LOG] Normal state saving restored after visibility fix');
            }, 100);
        } else {
            console.log('[LOG] UI already matches localStorage value:', storedVisibility);
        }
        
        // Final verification
        console.log('[LOG] After window.load fixes:');
        console.log('[LOG] - logState.visible =', logState.visible);
        console.log('[LOG] - localStorage.logVisible =', localStorage.getItem('logVisible'));
        console.log('[LOG] - Log button state =', document.getElementById('log-btn')?.classList.contains('active'));
    }, 200);
});

// Immediately expose these functions to the global scope
if (typeof window !== 'undefined') {
    window.clearLog = clearLog;
    window.copyLog = copyLog;
    window.toggleLog = toggleLog;
    window.debugSplitInteraction = () => interactingWithSplit;
    window.recentViewChange = recentViewChange;
}

// Create a utility function to handle scroll lock changes
export function handleScrollLockChange() {
    // Don't toggle the log when scroll lock changes
    // Just log the event if needed
    logMessage('[UI] Scroll lock state changed');
}

// Add a global click handler to isolate and diagnose the issue
document.addEventListener('click', (e) => {
    // Check if this click is related to a split or resize handle
    if (e.target.classList.contains('resize-handle') || 
        e.target.classList.contains('split-handle') ||
        e.target.closest('.resize-handle') ||
        e.target.closest('.split-handle')) {
        
        // Log for debugging
        console.log('Click on split/resize detected:', e.target);
        
        // Prevent event propagation
        e.stopPropagation();
    }
});

// Add a more targeted fix for editor tab buttons
document.addEventListener('DOMContentLoaded', () => {
    // Find all editor tab buttons
    const editorTabs = document.querySelectorAll('.editor-tabs button, .editor-mode-tabs button');
    
    // Add a click interceptor to each tab button
    editorTabs.forEach(button => {
        // Wrap the existing click handler
        const originalClickHandler = button.onclick;
        
        button.onclick = function(e) {
            console.log('Editor tab clicked:', button.textContent);
            
            // Prevent this click from toggling the log
            e.stopPropagation();
            
            // Call the original handler if it exists
            if (originalClickHandler) {
                return originalClickHandler.call(this, e);
            }
        };
        
        console.log('Added interceptor to tab button:', button.textContent);
    });
    
    // Also try to intercept clicks on the tab container
    const tabContainers = document.querySelectorAll('.editor-tabs, .editor-mode-tabs');
    tabContainers.forEach(container => {
        container.addEventListener('click', (e) => {
            console.log('Tab container clicked');
            e.stopPropagation();
        }, true);
    });
});

// Add a diagnostic click logger
document.addEventListener('click', (e) => {
    // Log all clicks to help diagnose the issue
    console.log('Click detected on:', e.target.tagName, e.target.className, e.target.id);
    
    // Check specifically for editor tab buttons
    if (e.target.closest('.editor-tabs') || e.target.closest('.editor-mode-tabs')) {
        console.log('Editor tab area clicked - preventing propagation');
        e.stopPropagation();
    }
}, true); // Use capture phase to intercept before other handlers

// Add a more direct fix by monkey patching the viewManager
document.addEventListener('DOMContentLoaded', () => {
    // Wait for all scripts to load
    setTimeout(() => {
        // Try to find the viewManager in the global scope
        if (window.viewManager) {
            console.log('Found viewManager, applying direct patch');
            
            // Save the original setView function
            const originalSetView = window.viewManager.setView;
            
            // Replace it with our patched version
            window.viewManager.setView = function(viewName) {
                console.log('Patched setView called with:', viewName);
                
                // Temporarily disable log toggling
                const originalToggleLog = window.toggleLog;
                window.toggleLog = function() {
                    console.log('Toggle prevented during view change');
                    return logState.visible;
                };
                
                // Call the original function
                const result = originalSetView.call(this, viewName);
                
                // Restore the original toggleLog after a delay
                setTimeout(() => {
                    window.toggleLog = originalToggleLog;
                }, 500);
                
                return result;
            };
        }
    }, 1000); // Wait 1 second for all scripts to initialize
});

// Add back the toggleLogWithoutAutoShow function
export function toggleLogWithoutAutoShow(source = 'button') {
    console.log(`[LOG] Toggle log called with source: ${source}`);
    toggleSource = source;
    forceVisibleOnLog = false;
    
    // Simple toggle - if visible, hide; if hidden, show
    const oldState = logState.visible;
    const newState = !oldState;
    const oldStoredValue = localStorage.getItem('logVisible');
    
    console.log(`[LOG] Toggle: ${oldState ? 'visible→hidden' : 'hidden→visible'}`);
    console.log(`[LOG] Previous localStorage value: ${oldStoredValue}`);
    
    // Set the state directly
    logState.visible = newState;
    
    // Save to localStorage and log the change
    localStorage.setItem('logVisible', String(newState));
    console.log(`[LOG] Saved new state to localStorage: logVisible=${newState}`);
    
    // Update the UI
    logState.updateUI();
    
    // Re-enable auto-show after a delay
    setTimeout(() => {
        forceVisibleOnLog = true;
        toggleSource = '';
    }, 500);
    
    return logState.visible;
}

// Add app name and version to log bar
function addAppInfoToLogBar() {
    const logToolbar = document.getElementById('log-toolbar');
    if (!logToolbar) {
        console.log('[LOG DEBUG] Log toolbar not found - ID: log-toolbar');
        return;
    }
    
    console.log('[LOG DEBUG] Found log toolbar');
    
    // Create app info element if it doesn't exist already
    let appInfo = document.getElementById('app-info');
    if (!appInfo) {
        console.log('[LOG DEBUG] App info element not found, creating it');
        appInfo = document.createElement('div');
        appInfo.id = 'app-info';
        appInfo.className = 'app-info';
        logToolbar.appendChild(appInfo);
    }
    
    // Add app name and version
    if (window.APP_CONFIG) {
        appInfo.textContent = `${window.APP_CONFIG.name} ${window.APP_CONFIG.version}`;
    } else {
        appInfo.textContent = 'devPages 003m2';
    }
    
    console.log('[LOG DEBUG] App info added to toolbar');
} 