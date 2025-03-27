// log/ui.js - UI interactions for the log component
import { logMessage } from './core.js';
import { logState, toggleLog } from './state.js';
import { showSystemInfo } from '../uiManager.js';

// Track initialization
let toolbarInitialized = false;
let buttonsConnected = false;

/**
 * Initialize log toolbar with resize functionality
 * @returns {boolean} - Whether initialization was successful
 */
export function initLogToolbar() {
    // Only run once
    if (toolbarInitialized) {
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
    
    // Connect info button to showSystemInfo function
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', async () => {
            try {
                await showSystemInfo();
            } catch (error) {
                logMessage(`[ERROR] Failed to show system info: ${error.message}`);
                console.error('[ERROR] Failed to show system info:', error);
            }
        });
        console.log('[LOG] Info button connected to showSystemInfo function');
    }
    
    // Mark as initialized
    toolbarInitialized = true;
    console.log('[LOG] Log toolbar initialized');
    
    return true;
}

/**
 * Set up log resize functionality
 */
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

/**
 * Connect log buttons to their event handlers
 */
export function ensureLogButtonsConnected() {
    // Only run once
    if (buttonsConnected) return;
    
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
    
    buttonsConnected = true;
    console.log('[LOG] Log buttons connected');
}

/**
 * Handle scroll lock changes
 */
export function handleScrollLockChange() {
    // Don't toggle the log when scroll lock changes
    // Just log the event if needed
    logMessage('[UI] Scroll lock state changed');
}

// Add diagnostic click handlers
export function setupDiagnosticHandlers() {
    // Add a global click handler to isolate and diagnose issues
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
} 