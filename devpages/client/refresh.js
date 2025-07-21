// refresh.js - Unified refresh functionality for the editor
const log = window.APP.services.log.createLogger('Refresh');

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
        log.info('REFRESH', 'HANDLER_REGISTERED', `Registered new handler: ${name}`);
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
    
    log.info('REFRESH', 'START', 'Starting refresh process...');
    
    // Execute all registered refresh handlers
    const promises = refreshHandlers.map(handler => {
        try {
            log.info('REFRESH', 'EXECUTE_HANDLER', `Executing handler: ${handler.name}`);
            const result = handler.func();
            return result instanceof Promise ? result : Promise.resolve(result);
        } catch (error) {
            log.error('REFRESH', 'HANDLER_ERROR', `Handler ${handler.name} failed: ${error.message}`, error);
            return Promise.resolve();
        }
    });
    
    // When all handlers have completed
    Promise.all(promises).then(() => {
        if (refreshBtn) {
            refreshBtn.classList.remove('refreshing');
            refreshBtn.disabled = false;
        }
        log.info('REFRESH', 'COMPLETE', 'Refresh process completed');
    });
}

/**
 * Initialize the refresh button
 */
export function initRefreshButton() {
    // Find the refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (!refreshBtn) {
        log.warn('REFRESH', 'BUTTON_NOT_FOUND', 'Refresh button not found, looking for svg-refresh-btn as fallback');
        
        // Try to find the SVG refresh button as a fallback
        const svgRefreshBtn = document.getElementById('svg-refresh-btn');
        if (svgRefreshBtn) {
            log.info('REFRESH', 'FALLBACK_BUTTON', 'Using svg-refresh-btn as fallback');
            
            // Clone and replace to remove existing listeners
            const newRefreshBtn = svgRefreshBtn.cloneNode(true);
            svgRefreshBtn.parentNode.replaceChild(newRefreshBtn, svgRefreshBtn);
            
            // Update ID to match our new convention
            newRefreshBtn.id = 'refresh-btn';
            newRefreshBtn.title = 'Refresh Preview & SVG';
            
            // Add click handler
            newRefreshBtn.addEventListener('click', executeRefresh);
        } else {
            log.error('REFRESH', 'NO_BUTTON_FOUND', 'No refresh button found');
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
            log.info('REFRESH', 'KEYBOARD_TRIGGER', 'Triggered by keyboard shortcut (Ctrl+R)');
        }
    });
    
    log.info('REFRESH', 'INITIALIZED', 'Refresh system initialized');
} 