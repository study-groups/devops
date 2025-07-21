import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('TopBar');

// --- Module-level state ---
let isInitialized = false;
let unsubscribeFromStore = null;

/**
 * Initializes the Top Bar component, including its handlers and responsive behaviors.
 */
function init() {
    if (isInitialized) return;
    log.info('TOP_BAR', 'INIT_START', 'Initializing Top Bar...');
    
    updateContentHeight();
    attachTopBarHandlers();
    attachRefreshHandler();

    // Initialize the refresh system from refresh.js if available
    initializeRefreshSystem();

    // Listen for comprehensive refresh shortcut
    eventBus.on('shortcut:comprehensiveRefresh', () => {
        log.info('TOP_BAR', 'REFRESH_SHORTCUT', 'Comprehensive refresh triggered via keyboard shortcut');
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.click();
        }
    });

    window.addEventListener('resize', updateContentHeight);
    
    // Subscribe to the store to update button states
    if (!unsubscribeFromStore) {
        unsubscribeFromStore = appStore.subscribe(() => {
            const { auth } = appStore.getState();
            const saveBtn = document.getElementById('save-btn');
            const publishBtn = document.getElementById('publish-btn');
            if (saveBtn) saveBtn.disabled = !auth.isAuthenticated;
            if (publishBtn) publishBtn.disabled = !auth.isAuthenticated;
        });
    }
    // Set initial button states
    const { auth } = appStore.getState();
    const saveBtn = document.getElementById('save-btn');
    const publishBtn = document.getElementById('publish-btn');
    if (saveBtn) saveBtn.disabled = !auth.isAuthenticated;
    if (publishBtn) publishBtn.disabled = !auth.isAuthenticated;

    isInitialized = true;
    log.info('TOP_BAR', 'INIT_COMPLETE', 'Top Bar Initialized.');
}

/**
 * Initialize the refresh system from refresh.js
 */
async function initializeRefreshSystem() {
    try {
        // Import and initialize the refresh system
        const { initRefreshButton, registerRefreshHandler } = await import('/client/refresh.js');
        
        // Register additional refresh handlers for our comprehensive refresh
        registerRefreshHandler(() => {
            log.info('TOP_BAR', 'REFRESH_HANDLER', 'Executing topBar refresh handler');
            return Promise.resolve();
        }, 'topBar-comprehensive');
        
        // Initialize the refresh button system
        initRefreshButton();
        
        // Make executeRefresh available globally
        const { executeRefresh } = await import('/client/refresh.js');
        window.executeRefresh = executeRefresh;
        
        log.info('TOP_BAR', 'REFRESH_SYSTEM_INIT', 'Refresh system initialized successfully');
    } catch (error) {
        log.warn('TOP_BAR', 'REFRESH_SYSTEM_INIT_FAILED', `Failed to initialize refresh system: ${error.message}`);
    }
}

function refresh() {
    log.info('TOP_BAR', 'REFRESH_START', 'Refreshing Top Bar...');
    // For the top bar, a refresh might involve re-checking auth state or updating content.
    // For now, simply updating the content height is a good example.
    updateContentHeight();
    // Re-attach handlers to ensure they are fresh, especially if the DOM was manipulated.
    attachTopBarHandlers();
    attachRefreshHandler();
    log.info('TOP_BAR', 'REFRESH_COMPLETE', 'Top Bar Refreshed.');
}

function destroy() {
    log.info('TOP_BAR', 'DESTROY_START', 'Destroying Top Bar...');
    // A real implementation would remove specific listeners.
    // For now, we just remove the global one we added.
    window.removeEventListener('resize', updateContentHeight);
    
    // Unsubscribe from the store to prevent memory leaks
    if (unsubscribeFromStore) {
        unsubscribeFromStore();
        unsubscribeFromStore = null;
    }

    isInitialized = false;
    log.info('TOP_BAR', 'DESTROY_COMPLETE', 'Top Bar Destroyed.');
}

/**
 * Update content height based on actual top bar height
 * This is important for responsive layouts where the top bar height may change
 */
function updateContentHeight() {
    // Get the actual height of the top bar
    const topBar = document.querySelector('nav.top-bar') || document.querySelector('.top-bar');
    if (!topBar) return;
    
    const topBarHeight = topBar.offsetHeight;
    const previewContainer = document.querySelector(".preview-container");
    
    if (!previewContainer) return;
    
    // Get log container height if visible
    const logVisible = document.documentElement.getAttribute('data-log-visible') === 'true';
    const logHeight = logVisible ? (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--log-height')) || 120) : 0;
    
    // Update preview container max-height
    previewContainer.style.maxHeight = `calc(100vh - ${topBarHeight}px${logVisible ? ` - ${logHeight}px` : ''})`;
    
    log.info('TOP_BAR', 'UPDATE_CONTENT_HEIGHT', `Preview container height updated. Top bar: ${topBarHeight}px, Log height: ${logHeight}px`);
}

// RESTORED: Essential UI handler functions
function attachTopBarHandlers() {
    log.info('TOP_BAR', 'ATTACH_HANDLERS_START', 'Attaching top bar event handlers...');
    
    // Handle save button clicks
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            log.info('TOP_BAR', 'SAVE_BUTTON_CLICKED', 'Save button clicked, dispatching action.');
            appStore.dispatch({ type: ActionTypes.FILE_SAVE_REQUEST });
        });
        log.info('TOP_BAR', 'SAVE_BUTTON_HANDLER_ATTACHED', 'Save button handler attached');
    }
    
    // Handle publish button clicks - REMOVED: Integration layer handles this now
    const publishBtn = document.getElementById('publish-btn');
    if (publishBtn) {
        // The click handling is now managed by PublishModalIntegration.js
        // No direct attachment needed here to avoid double handling or conflicts.
        log.info('TOP_BAR', 'PUBLISH_BUTTON_HANDLER_SKIPPED', 'Publish button handler will be managed by integration layer.');
    }
    
    log.info('TOP_BAR', 'ATTACH_HANDLERS_COMPLETE', 'Top bar handlers attached successfully');
}

/**
 * Attaches a handler to the refresh button to trigger a comprehensive UI refresh.
 */
function attachRefreshHandler() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            log.info('TOP_BAR', 'COMPREHENSIVE_REFRESH_START', '🔄 Comprehensive UI refresh triggered');
            
            // Add visual feedback
            refreshBtn.classList.add('refreshing');
            refreshBtn.disabled = true;
            
            // Store original content (handle both text and HTML content)
            const originalContent = refreshBtn.innerHTML;
            const originalText = refreshBtn.textContent;
            
            // Set refreshing text
            refreshBtn.innerHTML = '🔄 Refreshing...';
            
            try {
                // 1. Clear various caches
                log.info('TOP_BAR', 'CLEAR_CACHES', 'Clearing caches...');
                clearCaches();
                
                // 2. Reload all CSS files
                log.info('TOP_BAR', 'RELOAD_CSS', 'Reloading CSS files...');
                await reloadAllCssSilent();
                
                // 3. Execute existing refresh handlers from refresh.js if available
                log.info('TOP_BAR', 'EXECUTE_REFRESH_HANDLERS', 'Executing registered refresh handlers...');
                await executeExistingRefreshHandlers();
                
                // 4. Refresh all registered components via UIManager
                log.info('TOP_BAR', 'REFRESH_UI_COMPONENTS', 'Refreshing UI components...');
                await refreshUIComponents();
                
                // 5. Refresh all panels
                log.info('TOP_BAR', 'REFRESH_PANELS', 'Refreshing panels...');
                appStore.dispatch({ type: ActionTypes.REFRESH_PANELS });
                
                // 6. Refresh preview
                log.info('TOP_BAR', 'REFRESH_PREVIEW', 'Refreshing preview...');
                await refreshPreview();
                
                // 7. Emit comprehensive refresh events
                log.info('TOP_BAR', 'EMIT_REFRESH_EVENTS', 'Emitting refresh events...');
                emitRefreshEvents();
                
                // 8. Refresh app state
                log.info('TOP_BAR', 'REFRESH_APP_STATE', 'Refreshing app state...');
                await refreshAppState();
                
                log.info('TOP_BAR', 'COMPREHENSIVE_REFRESH_SUCCESS', '✅ Comprehensive refresh completed successfully');
                
            } catch (error) {
                log.error('TOP_BAR', 'COMPREHENSIVE_REFRESH_FAILED', `❌ Refresh error: ${error.message}`, error);
                console.error('[TopBar] Refresh error:', error);
            } finally {
                // Restore button state
                refreshBtn.classList.remove('refreshing');
                refreshBtn.disabled = false;
                
                // Restore original content (prefer innerHTML if it was different from textContent)
                if (originalContent !== originalText) {
                    refreshBtn.innerHTML = originalContent;
                } else {
                    refreshBtn.textContent = originalText;
                }
                
                // Fallback: If the button still shows "Refreshing...", force restore to a default
                setTimeout(() => {
                    if (refreshBtn.textContent.includes('Refreshing') || refreshBtn.innerHTML.includes('Refreshing')) {
                        log.warn('TOP_BAR', 'REFRESH_BUTTON_STUCK', 'Button text still shows refreshing, applying fallback restoration');
                        // Try to restore to a sensible default based on common refresh button patterns
                        if (originalContent.includes('&#x21bb;') || originalContent.includes('↻')) {
                            refreshBtn.innerHTML = '&#x21bb;';
                        } else if (originalContent.includes('🔄')) {
                            refreshBtn.innerHTML = '🔄';
                        } else if (originalText.trim() === '') {
                            refreshBtn.innerHTML = 'Refresh';
                        } else {
                            refreshBtn.textContent = originalText || 'Refresh';
                        }
                    }
                }, 100);
            }
        });
        log.info('TOP_BAR', 'REFRESH_HANDLER_ATTACHED', 'Comprehensive refresh button handler attached');
    } else {
        log.warn('TOP_BAR', 'REFRESH_BUTTON_NOT_FOUND', 'Refresh button not found');
    }
}

/**
 * Execute existing refresh handlers from refresh.js if available
 */
async function executeExistingRefreshHandlers() {
    return new Promise((resolve) => {
        try {
            // Check if the refresh system from refresh.js is available
            if (window.executeRefresh && typeof window.executeRefresh === 'function') {
                log.info('TOP_BAR', 'EXECUTE_EXISTING_REFRESH', 'Executing existing refresh handlers...');
                window.executeRefresh();
                log.info('TOP_BAR', 'EXISTING_REFRESH_EXECUTED', 'Existing refresh handlers executed');
            } else {
                log.debug('TOP_BAR', 'NO_EXISTING_REFRESH', 'No existing refresh handlers found');
            }
        } catch (error) {
            log.warn('TOP_BAR', 'EXISTING_REFRESH_ERROR', `Error executing existing refresh handlers: ${error.message}`);
        }
        resolve();
    });
}

/**
 * Clear various caches to ensure fresh data
 */
function clearCaches() {
    // Clear localStorage cache keys
    const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || 
        key.includes('timestamp') || 
        key.includes('devpages_css') ||
        key.includes('preview') ||
        key.includes('panel')
    );
    cacheKeys.forEach(key => {
        localStorage.removeItem(key);
        log.info('TOP_BAR', 'CACHE_CLEARED', `Cleared cache key: ${key}`);
    });
    
    // Clear sessionStorage cache keys
    const sessionCacheKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('cache') || 
        key.includes('timestamp') || 
        key.includes('devpages')
    );
    sessionCacheKeys.forEach(key => {
        sessionStorage.removeItem(key);
        log.info('TOP_BAR', 'SESSION_CACHE_CLEARED', `Cleared session cache key: ${key}`);
    });
    
    // Clear service worker registrations if available
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
                registration.unregister();
                log.info('TOP_BAR', 'SERVICE_WORKER_UNREGISTERED', 'Unregistered service worker');
            });
        });
    }
}

/**
 * Reload all CSS files with cache busting
 */
async function reloadAllCssSilent() {
    return new Promise((resolve) => {
        const timestamp = Date.now();
        let reloadedCount = 0;
        const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        
        if (linkElements.length === 0) {
            resolve();
            return;
        }
        
        const processLink = (link, index) => {
            return new Promise((linkResolve) => {
                const originalHref = link.getAttribute('href');
                if (originalHref) {
                    const separator = originalHref.includes('?') ? '&' : '?';
                    const newHref = `${originalHref}${separator}t=${timestamp}`;
                    
                    const newLink = document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.type = 'text/css';
                    newLink.href = newHref;
                    
                    // Copy other attributes
                    Array.from(link.attributes).forEach(attr => {
                        if (attr.name !== 'href') {
                            newLink.setAttribute(attr.name, attr.value);
                        }
                    });
                    
                    newLink.onload = () => {
                        setTimeout(() => {
                            if (link.parentNode) {
                                link.remove();
                            }
                        }, 50);
                        reloadedCount++;
                        log.info('TOP_BAR', 'CSS_RELOADED', `Reloaded CSS: ${originalHref}`);
                        linkResolve();
                    };
                    
                    newLink.onerror = () => {
                        log.warn('TOP_BAR', 'CSS_RELOAD_FAILED', `Failed to reload CSS: ${originalHref}`);
                        linkResolve();
                    };
                    
                    link.parentNode.insertBefore(newLink, link);
                } else {
                    linkResolve();
                }
            });
        };
        
        // Process all links in parallel
        Promise.all(linkElements.map(processLink)).then(() => {
            log.info('TOP_BAR', 'CSS_RELOAD_COMPLETE', `Reloaded ${reloadedCount} CSS files`);
            resolve();
        });
    });
}

/**
 * Refresh all registered UI components
 */
async function refreshUIComponents() {
    return new Promise((resolve) => {
        try {
            // Check if UIManager is available
            if (window.UIManager && typeof window.UIManager.refreshAll === 'function') {
                window.UIManager.refreshAll();
                log.info('TOP_BAR', 'UI_MANAGER_REFRESHED', 'UIManager components refreshed');
            } else {
                log.warn('TOP_BAR', 'UI_MANAGER_NOT_FOUND', 'UIManager not available for component refresh');
            }
            
            // Also try to refresh specific components if they exist
            const componentsToRefresh = [
                'editorPanel',
                'previewPanel', 
                'logPanel',
                'panelManager',
                'workspaceLayoutManager'
            ];
            
            componentsToRefresh.forEach(componentName => {
                const component = window[componentName];
                if (component && typeof component.refresh === 'function') {
                    try {
                        component.refresh();
                        log.info('TOP_BAR', 'COMPONENT_REFRESHED', `Refreshed component: ${componentName}`);
                    } catch (error) {
                        log.warn('TOP_BAR', 'COMPONENT_REFRESH_FAILED', `Failed to refresh ${componentName}: ${error.message}`);
                    }
                }
            });
            
        } catch (error) {
            log.error('TOP_BAR', 'UI_COMPONENT_REFRESH_ERROR', `UI component refresh error: ${error.message}`, error);
        }
        resolve();
    });
}

/**
 * Refresh all panels
 */
async function refreshPanels() {
    return new Promise((resolve) => {
        try {
            // Refresh panel manager if available
            if (window.panelManager && typeof window.panelManager.refresh === 'function') {
                window.panelManager.refresh();
                log.info('TOP_BAR', 'PANEL_MANAGER_REFRESHED', 'Panel manager refreshed');
            }
            
            // Refresh individual panels
            const panelSelectors = [
                '.settings-panel',
                '.debug-panel',
                '.preview-panel',
                '.log-panel'
            ];
            
            panelSelectors.forEach(selector => {
                const panels = document.querySelectorAll(selector);
                panels.forEach(panel => {
                    // Trigger a custom refresh event on each panel
                    const refreshEvent = new CustomEvent('panel:refresh', {
                        detail: { timestamp: Date.now() }
                    });
                    panel.dispatchEvent(refreshEvent);
                });
            });
            
            log.info('TOP_BAR', 'PANELS_REFRESHED', 'Panels refreshed');
            
        } catch (error) {
            log.error('TOP_BAR', 'PANEL_REFRESH_ERROR', `Panel refresh error: ${error.message}`, error);
        }
        resolve();
    });
}

/**
 * Refresh preview
 */
async function refreshPreview() {
    return new Promise((resolve) => {
        try {
            // Try multiple preview refresh methods
            const previewMethods = [
                () => {
                    if (window.eventBus && typeof window.eventBus.emit === 'function') {
                        window.eventBus.emit('preview:forceRefresh');
                        return true;
                    }
                    return false;
                },
                () => {
                    if (eventBus && typeof eventBus.emit === 'function') {
                        eventBus.emit('preview:forceRefresh');
                        return true;
                    }
                    return false;
                },
                () => {
                    if (window.refreshPreview && typeof window.refreshPreview === 'function') {
                        window.refreshPreview();
                        return true;
                    }
                    return false;
                },
                () => {
                    if (window.updateMarkdownPreview && typeof window.updateMarkdownPreview === 'function') {
                        window.updateMarkdownPreview();
                        return true;
                    }
                    return false;
                }
            ];
            
            let previewRefreshed = false;
            for (const method of previewMethods) {
                try {
                    if (method()) {
                        previewRefreshed = true;
                        break;
                    }
                } catch (error) {
                    log.warn('TOP_BAR', 'PREVIEW_REFRESH_METHOD_FAILED', `Preview refresh method failed: ${error.message}`);
                }
            }
            
            if (previewRefreshed) {
                log.info('TOP_BAR', 'PREVIEW_REFRESHED', 'Preview refreshed');
            } else {
                log.warn('TOP_BAR', 'NO_PREVIEW_REFRESH_METHOD', 'No preview refresh method available');
            }
            
        } catch (error) {
            log.error('TOP_BAR', 'PREVIEW_REFRESH_ERROR', `Preview refresh error: ${error.message}`, error);
        }
        resolve();
    });
}

/**
 * Emit comprehensive refresh events
 */
function emitRefreshEvents() {
    const events = [
        'ui:refresh',
        'preview:forceRefresh', 
        'preview:cssSettingsChanged',
        'css:changed',
        'panel:refresh',
        'components:refresh'
    ];
    
    events.forEach(eventName => {
        try {
            if (window.eventBus && typeof window.eventBus.emit === 'function') {
                window.eventBus.emit(eventName, { reason: 'comprehensive_refresh', timestamp: Date.now() });
            } else if (eventBus && typeof eventBus.emit === 'function') {
                eventBus.emit(eventName, { reason: 'comprehensive_refresh', timestamp: Date.now() });
            }
        } catch (error) {
            log.warn('TOP_BAR', 'EMIT_REFRESH_EVENT_FAILED', `Failed to emit ${eventName}: ${error.message}`);
        }
    });
    
    log.info('TOP_BAR', 'REFRESH_EVENTS_EMITTED', 'Refresh events emitted');
}

/**
 * Refresh app state
 */
async function refreshAppState() {
    return new Promise((resolve) => {
        try {
            // Refresh app store state if available
            if (window.appStore && typeof window.appStore.dispatch === 'function') {
                // Dispatch a refresh action
                window.appStore.dispatch({ 
                    type: 'APP_REFRESH', 
                    payload: { timestamp: Date.now() }
                });
                log.info('TOP_BAR', 'APP_STATE_REFRESHED', 'App state refreshed');
            }
            
            // Refresh any global state managers
            const stateManagers = [
                'debugPanelManager',
                'workspaceLayoutManager',
                'panelManager'
            ];
            
            stateManagers.forEach(managerName => {
                const manager = window[managerName];
                if (manager && typeof manager.refresh === 'function') {
                    try {
                        manager.refresh();
                        log.info('TOP_BAR', 'STATE_MANAGER_REFRESHED', `Refreshed state manager: ${managerName}`);
                    } catch (error) {
                        log.warn('TOP_BAR', 'STATE_MANAGER_REFRESH_FAILED', `Failed to refresh ${managerName}: ${error.message}`);
                    }
                }
            });
            
        } catch (error) {
            log.error('TOP_BAR', 'APP_STATE_REFRESH_ERROR', `App state refresh error: ${error.message}`, error);
        }
        resolve();
    });
}

/**
 * Initializes the entire top bar functionality.
 * This function should be called once on application startup.
 */
export function initializeTopBar() {
    init();
}

// Add global test function for comprehensive refresh
window.testComprehensiveRefresh = function() {
    console.log('=== TESTING COMPREHENSIVE REFRESH ===');
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        console.log('Found refresh button, triggering comprehensive refresh...');
        refreshBtn.click();
        return true;
    } else {
        console.error('Refresh button not found!');
        return false;
    }
};

// Add global function to check refresh system status
window.checkRefreshSystemStatus = function() {
    console.log('=== REFRESH SYSTEM STATUS ===');
    console.log('Refresh button exists:', !!document.getElementById('refresh-btn'));
    console.log('window.executeRefresh exists:', !!window.executeRefresh);
    console.log('window.UIManager exists:', !!window.UIManager);
    console.log('window.panelManager exists:', !!window.panelManager);
    console.log('window.eventBus exists:', !!window.eventBus);
    console.log('window.appStore exists:', !!window.appStore);
    console.log('Available refresh methods:');
    console.log('- Click refresh button');
    console.log('- Press Ctrl+Shift+R (comprehensive refresh)');
    console.log('- Press Alt+R (preview refresh)');
    console.log('- Call window.testComprehensiveRefresh()');
};

// Add debug function to check button content
window.debugRefreshButton = function() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        console.log('=== REFRESH BUTTON DEBUG ===');
        console.log('Buttonelement:', refreshBtn);
        console.log('Button innerHTML:', refreshBtn.innerHTML);
        console.log('Button textContent:', refreshBtn.textContent);
        console.log('Button has refreshing class:', refreshBtn.classList.contains('refreshing'));
        console.log('Button disabled:', refreshBtn.disabled);
        console.log('Button title:', refreshBtn.title);
    } else {
        console.log('Refresh button not found!');
    }
};

// Add function to check for CSS popup sources
window.debugCssPopup = function() {
    console.log('=== CSS POPUP DEBUG ===');
    console.log('ViewControls reloadAllCss function exists:', typeof window.reloadAllCss === 'function');
    console.log('topBar reloadAllCssSilent function exists:', typeof window.reloadAllCssSilent === 'function');
    console.log('Note: CSS popup comes from ViewControls.js reloadAllCss() function');
    console.log('Our comprehensive refresh uses reloadAllCssSilent() which does NOT create popups');
    
    // Test if ViewControls is using the silent version
    const viewControlsBtn = document.querySelector('#preview-reload-btn');
    if (viewControlsBtn) {
        console.log('ViewControls refresh button found:', viewControlsBtn);
        console.log('Button action:', viewControlsBtn.dataset.action);
    } else {
        console.log('ViewControls refresh button not found');
    }
    
    // Test if our topBar refresh button exists
    const topBarBtn = document.getElementById('refresh-btn');
    if (topBarBtn) {
        console.log('TopBar refresh button found:', topBarBtn);
    } else {
        console.log('TopBar refresh button not found');
    }
};

// Add function to test both refresh buttons
window.testBothRefreshButtons = function() {
    console.log('=== TESTING BOTH REFRESH BUTTONS ===');
    
    // Test ViewControls refresh button
    const viewControlsBtn = document.querySelector('#preview-reload-btn');
    if (viewControlsBtn) {
        console.log('Testing ViewControls refresh button...');
        viewControlsBtn.click();
    } else {
        console.log('ViewControls refresh button not found');
    }
    
    // Test TopBar refresh button
    const topBarBtn = document.getElementById('refresh-btn');
    if (topBarBtn) {
        console.log('Testing TopBar refresh button...');
        topBarBtn.click();
    } else {
        console.log('TopBar refresh button not found');
    }
};

// REMOVED loadCodebaseStructure function

// REMOVED userView and adminView HTML strings as structure is in index.html 