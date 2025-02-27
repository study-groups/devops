// Move this near the top of the file
let forceVisibleOnLog = true;
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
    
    // Only force log to be visible for normal logs, not for state change logs
    if (!message.includes('[LOG] Log shown') && !message.includes('[LOG] Log hidden') && 
        forceVisibleOnLog && !logState._suppressLogging) {
        logState._suppressLogging = true;
        logState.setVisible(true);
        logState._suppressLogging = false;
    }
}

// Log state module with a single source of truth
export const logState = {
    visible: true,
    height: 120,
    _suppressLogging: false, // Flag to prevent infinite loops
    
    toggle() {
        this.visible = !this.visible;
        this.updateUI();
        
        // Only log if not suppressing
        if (!this._suppressLogging) {
            this._suppressLogging = true; // Set flag before logging
            logMessage(`[LOG] Log ${this.visible ? 'shown' : 'hidden'}`);
            this._suppressLogging = false; // Reset flag after logging
        }
        
        return this.visible;
    },
    
    setVisible(visible) {
        if (this.visible !== visible) {
            this.visible = visible;
            this.updateUI();
            
            // Only log if not suppressing
            if (!this._suppressLogging) {
                this._suppressLogging = true; // Set flag before logging
                logMessage(`[LOG] Log ${this.visible ? 'shown' : 'hidden'}`);
                this._suppressLogging = false; // Reset flag after logging
            }
        }
        return this.visible;
    },
    
    setHeight(height) {
        this.height = Math.max(80, height);
        this.updateUI();
    },
    
    updateUI() {
        // If this update was triggered by a scroll event, ignore it
        if (toggleSource === 'scroll') return;
        
        const logContainer = document.getElementById('log-container');
        if (!logContainer) return;
        
        if (this.visible) {
            // Show log with important flags to override any other styles
            logContainer.style.display = 'flex';
            logContainer.style.opacity = '1';
            logContainer.style.height = `${this.height}px`;
            logContainer.style.visibility = 'visible';
            logContainer.classList.remove('log-hiding');
            logContainer.classList.add('log-showing');
            
            // Update main container
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.classList.add('log-visible');
                mainContainer.classList.remove('log-hidden');
            }
        } else {
            // Force hide with multiple properties and !important
            logContainer.style.opacity = '0';
            logContainer.style.visibility = 'hidden';
            logContainer.classList.remove('log-showing');
            logContainer.classList.add('log-hiding');
            
            // Immediately make it visually hidden while maintaining space
            logContainer.style.height = '0px';
            logContainer.style.minHeight = '0px';
            logContainer.style.overflow = 'hidden';
            
            // Update main container right away
            const mainContainer = document.getElementById('main-container');
            if (mainContainer) {
                mainContainer.classList.remove('log-visible');
                mainContainer.classList.add('log-hidden');
            }
            
            // Actually hide after animation with display:none
            setTimeout(() => {
                if (!this.visible) {
                    logContainer.style.display = 'none';
                    
                    // Double-check main container state
                    if (mainContainer) {
                        mainContainer.classList.remove('log-visible');
                        mainContainer.classList.add('log-hidden');
                    }
                }
            }, 300);
        }
        
        // Update button states
        this.updateButtons();
    },
    
    updateButtons() {
        // Update top nav button
        const logBtn = document.getElementById('log-btn');
        if (logBtn) {
            logBtn.classList.toggle('active', this.visible);
        }
        
        // Update log nav button
        const minimizeBtn = document.getElementById('minimize-log-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = '×';
            minimizeBtn.title = this.visible ? 'Hide Log' : 'Show Log';
            minimizeBtn.style.opacity = '0.7';
            minimizeBtn.style.cursor = 'pointer';
        }
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
    // Check if this is happening during a view change
    if (recentViewChange && source !== 'explicit') {
        console.log('Toggle prevented due to recent view change');
        return logState.visible;
    }
    
    // Get the active element when toggle is called
    const activeElement = document.activeElement;
    
    // Check if the active element is an editor tab button
    if (activeElement && 
        (activeElement.closest('.editor-tabs') || 
         activeElement.closest('.editor-mode-tabs'))) {
        console.log('Toggle prevented due to editor tab interaction');
        return logState.visible;
    }
    
    // If we're interacting with a split, don't toggle
    if (interactingWithSplit) {
        console.log('Toggle prevented due to split interaction');
        return logState.visible;
    }
    
    // Check if this is coming from a resize or split related event
    if (source === 'resize' || source === 'split') {
        return logState.visible; // Don't change visibility
    }
    
    // Debounce rapid toggles to prevent double-firing
    const now = Date.now();
    if (now - lastToggleTime < TOGGLE_DEBOUNCE) {
        return logState.visible;
    }
    
    lastToggleTime = now;
    return toggleLogWithoutAutoShow(source);
}

// Initialize log toolbar with resize functionality
export function initLogToolbar() {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) {
        return false;
    }

    // Apply current state
    logState.updateUI();

    // Set up resize handle
    setupLogResize();
    
    // Connect log buttons
    ensureLogButtonsConnected();
    
    // Add app name and version to log bar
    addAppInfoToLogBar();
    
    // Log a message to confirm initialization
    logMessage('[LOG] Log toolbar initialized');
    
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
            logContainer.style.height = `${newHeight}px`;
            document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
        }
    }
    
    function handleMouseUp(e) {
        // Store the user's preferred height in the state
        logState.setHeight(logContainer.offsetHeight);
        
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
    const copyLogBtn = document.getElementById('copy-log-btn');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const infoBtn = document.getElementById('info-btn');
    const minimizeBtn = document.getElementById('minimize-log-btn');
    
    if (copyLogBtn) {
        copyLogBtn.onclick = copyLog;
    }
    
    if (clearLogBtn) {
        clearLogBtn.onclick = clearLog;
    }
    
    if (infoBtn) {
        infoBtn.onclick = () => {
            if (window.showSystemInfo) {
                window.showSystemInfo();
            } else {
                logMessage('[LOG] System info function not available');
            }
        };
    }
    
    // Connect the minimize button to toggle state
    if (minimizeBtn) {
        minimizeBtn.textContent = '×';
        minimizeBtn.title = 'Hide Log';
        minimizeBtn.style.fontSize = '18px';
        minimizeBtn.style.fontWeight = 'normal';
        minimizeBtn.style.border = 'none';
        minimizeBtn.style.background = 'transparent';
        minimizeBtn.style.cursor = 'pointer';
        
        minimizeBtn.addEventListener('mouseover', () => {
            minimizeBtn.style.opacity = '1';
        });
        
        minimizeBtn.addEventListener('mouseout', () => {
            minimizeBtn.style.opacity = '0.7';
        });
        
        minimizeBtn.onclick = toggleLog;
    }
}

// Update the initialization to connect the top nav button
document.addEventListener('DOMContentLoaded', () => {
    // Initialize immediately with no delay
    initLogToolbar();
    
    // Force log to be visible initially
    logState.setVisible(true);
    
    // Also update UI when viewManager changes views
    document.addEventListener('view:changed', () => {
        logState.updateUI();
    });
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
    toggleSource = source;
    forceVisibleOnLog = false;
    const result = logState.toggle();
    // Re-enable after a delay, after all related logs are processed
    setTimeout(() => {
        forceVisibleOnLog = true;
        toggleSource = '';
    }, 500);
    return result;
}

// Add app name and version to log bar
function addAppInfoToLogBar() {
    const logToolbar = document.querySelector('.log-toolbar');
    if (!logToolbar) {
        console.log('Log toolbar not found!'); // Add debug output
        return;
    }
    
    console.log('Found log toolbar:', logToolbar); // Debug output
    
    // Create app info element
    const appInfo = document.createElement('div');
    appInfo.id = 'log-app-info';
    appInfo.className = 'log-app-info';
    
    // Style the app info element - make it more visible for debugging
    appInfo.style.marginLeft = '10px';
    appInfo.style.fontSize = '12px';
    appInfo.style.opacity = '1'; // Increased from 0.7 for visibility
    appInfo.style.fontWeight = 'bold'; // Changed to bold for visibility
    appInfo.style.display = 'flex';
    appInfo.style.alignItems = 'center';
    appInfo.style.color = '#ff5500'; // Add a distinctive color for debugging
    
    // Get app name and version from window or environment variables
    const appName = window.APP_NAME || 'App';
    const appVersion = window.APP_VERSION || '1.0.0';
    
    // Set the content
    appInfo.textContent = `${appName} v${appVersion}`;
    console.log('Adding app info:', appInfo.textContent); // Debug output
    
    // Directly append to the toolbar for now
    logToolbar.appendChild(appInfo);
    
    console.log('App info added to toolbar'); // Debug output
} 