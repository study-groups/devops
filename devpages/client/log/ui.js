// log/ui.js - UI interactions for the log component
// import { showSystemInfo } from '../uiManager.js';
import { uiSlice } from '/client/store/uiSlice.js';
import { appStore } from '/client/appState.js';

const log = window.APP.services.log.createLogger('LogUI');

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
        log.info('LOG', 'TOOLBAR_ALREADY_INITIALIZED', 'Log toolbar already initialized');
        return true;
    }
    
    const logContainer = document.getElementById('log-container');
    if (!logContainer) {
        log.warn('LOG', 'LOG_CONTAINER_NOT_FOUND', 'Log container not found during toolbar initialization');
        return false;
    }

    // Set up resize handle
    setupLogResize();
    
    // Connect info button to showSystemInfo function
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        /*
        infoBtn.addEventListener('click', async () => {
            try {
                await showSystemInfo();
            } catch (error) {
                log.error('LOG', 'SHOW_SYSTEM_INFO_ERROR', `Failed to show system info: ${error.message}`, error);
                console.error('[ERROR] Failed to show system info:', error);
            }
        });
        log.info('LOG', 'INFO_BUTTON_CONNECTED', 'Info button connected to showSystemInfo function');
        */
        infoBtn.dataset.visible = 'false'; // Hide the button as it does nothing
        log.info('LOG', 'INFO_BUTTON_DISCONNECTED', 'Info button is disconnected and hidden as its function was removed.');

    }
    
    // Mark as initialized
    toolbarInitialized = true;
    log.info('LOG', 'TOOLBAR_INITIALIZED', 'Log toolbar initialized');
    
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
    
    const handleMouseMove = (e) => {
        const newHeight = startHeight - (e.clientY - startY);
        if (newHeight >= 80) { // Minimum height
            document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
        }
    };

    const handleMouseUp = () => {
        const newHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--log-height'), 10);
        
        // Dispatch the action to the global store
        appStore.dispatch(uiSlice.actions.updateSetting({ key: 'logHeight', value: newHeight }));
        
        log.info('LOG', 'RESIZE_COMPLETE', `Resize complete. New height: ${newHeight}px`);
        
        // Clean up
        resizeHandle.classList.remove('resizing');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    resizeHandle.addEventListener('mousedown', (e) => {
        startY = e.clientY;
        startHeight = logContainer.offsetHeight;
        
        resizeHandle.classList.add('resizing');
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        e.stopPropagation();
        e.preventDefault();
    });
}

/**
 * Connect log buttons to their event handlers
 */
export function ensureLogButtonsConnected() {
    // Only run once
    if (buttonsConnected) return;

    const connectButton = (id, action) => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                appStore.dispatch(action);
            });
        }
    };
    
    // Connect the log button in the nav bar and the minimize button
    connectButton('log-btn', uiSlice.actions.updateSetting({ key: 'logVisible', value: !appStore.getState().ui.logVisible }));
    connectButton('minimize-log-btn', uiSlice.actions.updateSetting({ key: 'logVisible', value: !appStore.getState().ui.logVisible }));
    
    buttonsConnected = true;
    log.info('LOG', 'BUTTONS_CONNECTED', 'Log buttons connected');
}

/**
 * Handle scroll lock changes
 */
export function handleScrollLockChange() {
    // Don't toggle the log when scroll lock changes
    // Just log the event if needed
    log.info('UI', 'SCROLL_LOCK_CHANGED', 'Scroll lock state changed');
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
                log.info('UI', 'EDITOR_TAB_CLICKED', `Editor tab clicked: ${button.textContent}`);
                
                // Prevent this click from toggling the log
                e.stopPropagation();
                
                // Call the original handler if it exists
                if (originalClickHandler) {
                    return originalClickHandler.call(this, e);
                }
            };
            
            log.info('UI', 'INTERCEPTOR_ADDED', `Added interceptor to tab button: ${button.textContent}`);
        });
        
        // Also try to intercept clicks on the tab container
        const tabContainers = document.querySelectorAll('.editor-tabs, .editor-mode-tabs');
        tabContainers.forEach(container => {
            container.addEventListener('click', (e) => {
                log.info('UI', 'TAB_CONTAINER_CLICKED', 'Tab container clicked');
                e.stopPropagation();
            }, true);
        });
    });
} 