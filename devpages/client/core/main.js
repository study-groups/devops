/**
 * core/main.js
 * Main application entry point with centralized initialization
 */
import { logMessage } from '../log/index.js';
import { initAuth } from './auth.js';
import { initViewControls } from './views.js';
import { registerButtons } from './buttons.js';
import { eventBus } from '../eventBus.js';
import { initializeFileManager, loadFile, saveFile } from './fileManager.js';
import { initializePreview, setupContentViewer, refreshPreview } from './preview.js';
import { initializeEditor } from './editor.js';

// Track initialization state
let initialized = false;

/**
 * Initialize the application
 */
export async function initializeApplication() {
    if (initialized) {
        logMessage('[MAIN] Application already initialized');
        return;
    }
    
    logMessage('[MAIN] Starting application initialization...');
    
    try {
        // Event bus is already initialized on import
        logMessage('[MAIN] Event bus is available for component communication');
        
        // Initialize authentication
        initAuth();
        logMessage('[MAIN] Authentication system initialized');
        
        // Initialize view system
        initViewControls();
        logMessage('[MAIN] View system initialized');
        
        // Initialize file system
        await initializeFileManager();
        logMessage('[MAIN] File system initialized');
        
        // Initialize preview system
        await initializePreview();
        logMessage('[MAIN] Preview system initialized');
        
        // Setup content viewer for previews
        setupContentViewer();
        logMessage('[MAIN] Content viewer initialized');
        
        // Initialize UI buttons for file operations
        registerFileButtons();
        logMessage('[MAIN] File operation buttons initialized');
        
        // Initialize editor-related functionality
        await initializeEditor();
        logMessage('[MAIN] Editor initialized');
        
        // Initialize log visibility button
        setupLogButton();
        logMessage('[MAIN] Log button initialized');
        
        // Handle initial log visibility
        handleLogVisibility();
        
        initialized = true;
        logMessage('[MAIN] Application initialization complete!');
    } catch (error) {
        console.error('[MAIN] Error during application initialization:', error);
        logMessage(`[MAIN] Initialization error: ${error.message}`, 'error');
    }
}

/**
 * Register file operation button handlers
 */
function registerFileButtons() {
    registerButtons({
        'load-btn': {
            handler: () => {
                loadFile();
            },
            description: 'Load selected file'
        },
        'save-btn': {
            handler: () => {
                saveFile();
            },
            description: 'Save current file'
        },
        'refresh-btn': {
            handler: () => {
                refreshPreview();
            },
            description: 'Refresh preview'
        }
    });
}

/**
 * Set up log button
 */
function setupLogButton() {
    registerButtons({
        'log-btn': {
            handler: () => {
                toggleLogVisibility();
            },
            description: 'Toggle log visibility'
        },
        'minimize-log-btn': {
            handler: () => {
                setLogVisible(false);
            },
            description: 'Hide log'
        }
    });
}

/**
 * Toggle log visibility
 */
function toggleLogVisibility() {
    const mainContainer = document.getElementById('main-container');
    const logContainer = document.getElementById('log-container');
    
    if (!mainContainer || !logContainer) return;
    
    const isLogVisible = mainContainer.classList.contains('log-visible');
    setLogVisible(!isLogVisible);
}

/**
 * Set log visibility
 */
function setLogVisible(visible) {
    const mainContainer = document.getElementById('main-container');
    const logContainer = document.getElementById('log-container');
    
    if (!mainContainer || !logContainer) return;
    
    if (visible) {
        mainContainer.classList.remove('log-hidden');
        mainContainer.classList.add('log-visible');
        logContainer.style.display = 'block';
        logContainer.style.visibility = 'visible';
        logContainer.style.height = localStorage.getItem('logHeight') || '120px';
        logContainer.setAttribute('data-log-visible', 'true');
    } else {
        mainContainer.classList.remove('log-visible');
        mainContainer.classList.add('log-hidden');
        logContainer.style.display = 'none';
        logContainer.style.visibility = 'hidden';
        logContainer.style.height = '0';
        logContainer.setAttribute('data-log-visible', 'false');
    }
    
    // Save state to localStorage
    localStorage.setItem('logVisible', visible ? 'true' : 'false');
    
    // Update document
    document.documentElement.setAttribute('data-log-visible', visible ? 'true' : 'false');
    
    logMessage(`[MAIN] Log visibility set to ${visible}`);
}

/**
 * Handle initial log visibility based on localStorage
 */
function handleLogVisibility() {
    const visible = localStorage.getItem('logVisible') === 'true';
    setLogVisible(visible);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApplication);

// Also run immediately if document is already loaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initializeApplication();
}

// Export for module use
export default {
    initializeApplication
}; 