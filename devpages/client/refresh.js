// refresh.js - Unified refresh functionality for the editor
import { logMessage } from "./log/index.js";
import { updatePreview } from './preview/markdown.js';

// Track registered refresh handlers
const refreshHandlers = [];

/**
 * Register a function to be executed during refresh
 * @param {Function} handler - The function to register
 * @param {string} name - Optional name for the handler
 */
export function registerRefreshHandler(handler, name = 'unnamed') {
    if (typeof handler === 'function' && !refreshHandlers.some(h => h.func === handler)) {
        refreshHandlers.push({
            func: handler,
            name: name
        });
        logMessage(`[REFRESH] Registered new handler: ${name}`);
    }
}

/**
 * Execute all registered refresh handlers
 */
export function executeRefresh() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.classList.add('refreshing');
        refreshBtn.disabled = true;
    }
    
    logMessage('[REFRESH] Starting refresh process...');
    
    // Execute all registered refresh handlers
    const promises = refreshHandlers.map(handler => {
        try {
            logMessage(`[REFRESH] Executing handler: ${handler.name}`);
            const result = handler.func();
            return result instanceof Promise ? result : Promise.resolve(result);
        } catch (error) {
            logMessage(`[REFRESH ERROR] Handler ${handler.name} failed: ${error.message}`);
            return Promise.resolve();
        }
    });
    
    // When all handlers have completed
    Promise.all(promises).then(() => {
        if (refreshBtn) {
            refreshBtn.classList.remove('refreshing');
            refreshBtn.disabled = false;
        }
        logMessage('[REFRESH] Refresh process completed');
    });
}

/**
 * Initialize the refresh button
 */
export function initRefreshButton() {
    // First register the core refresh handlers
    registerCoreHandlers();
    
    // Find the refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (!refreshBtn) {
        logMessage('[REFRESH] Refresh button not found, looking for svg-refresh-btn as fallback');
        
        // Try to find the SVG refresh button as a fallback
        const svgRefreshBtn = document.getElementById('svg-refresh-btn');
        if (svgRefreshBtn) {
            logMessage('[REFRESH] Using svg-refresh-btn as fallback');
            
            // Clone and replace to remove existing listeners
            const newRefreshBtn = svgRefreshBtn.cloneNode(true);
            svgRefreshBtn.parentNode.replaceChild(newRefreshBtn, svgRefreshBtn);
            
            // Update ID to match our new convention
            newRefreshBtn.id = 'refresh-btn';
            newRefreshBtn.title = 'Refresh Preview & SVG';
            
            // Add click handler
            newRefreshBtn.addEventListener('click', executeRefresh);
        } else {
            logMessage('[REFRESH ERROR] No refresh button found');
            return;
        }
    } else {
        // Add click handler to the existing refresh button
        refreshBtn.addEventListener('click', executeRefresh);
    }
    
    // Add keyboard shortcut (Ctrl+R)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.altKey && !e.shiftKey) {
            e.preventDefault(); // Prevent browser refresh
            executeRefresh();
            logMessage('[REFRESH] Triggered by keyboard shortcut (Ctrl+R)');
        }
    });
    
    logMessage('[REFRESH] Refresh system initialized');
}

/**
 * Register the core refresh handlers
 */
function registerCoreHandlers() {
    // Register markdown preview update handler
    registerRefreshHandler(() => {
        try {
            const editor = document.querySelector('#md-editor textarea');
            if (editor) {
                const content = editor.value;
                
                // Update the preview (SVG processing is now handled within updatePreview)
                updatePreview(content);
                logMessage('[REFRESH] Markdown preview refreshed');
                return Promise.resolve(true);
            }
        } catch (error) {
            logMessage(`[REFRESH ERROR] Markdown preview update failed: ${error.message}`);
        }
        return Promise.resolve(false);
    }, 'markdown-preview');
} 