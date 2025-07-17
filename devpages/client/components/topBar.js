import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

// --- Module-level state ---
let isInitialized = false;
let unsubscribeFromStore = null;

// Helper for logging within this module
function logTopBar(message, level = 'text') {
    const type = 'TOP_BAR';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message,type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${type}: ${message}`);
    }
}

/**
 * Initializes the Top Bar component, including its handlers and responsive behaviors.
 */
function init() {
    if (isInitialized) return;
    logTopBar('Initializing Top Bar...');
    
    updateContentHeight();
    attachTopBarHandlers();
    attachRefreshHandler();

    // Initialize the refresh system from refresh.js if available
    initializeRefreshSystem();

    // Listen for comprehensive refresh shortcut
    eventBus.on('shortcut:comprehensiveRefresh', () => {
        logTopBar('Comprehensive refresh triggered via keyboard shortcut');
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
    logTopBar('Top Bar Initialized.');
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
            logTopBar('Executing topBar refresh handler');
            return Promise.resolve();
        }, 'topBar-comprehensive');
        
        // Initialize the refresh button system
        initRefreshButton();
        
        // Make executeRefresh available globally
        const { executeRefresh } = await import('/client/refresh.js');
        window.executeRefresh = executeRefresh;
        
        logTopBar('Refresh system initialized successfully');
    } catch (error) {
        logTopBar(`Failed to initialize refresh system: ${error.message}`, 'warn');
    }
}

function refresh() {
    logTopBar('Refreshing Top Bar...');
    // For the top bar, a refresh might involve re-checking auth state or updating content.
    // For now, simply updating the content height is a good example.
    updateContentHeight();
    // Re-attach handlers to ensure they are fresh, especially if the DOM was manipulated.
    attachTopBarHandlers();
    attachRefreshHandler();
    logTopBar('Top Bar Refreshed.');
}

function destroy() {
    logTopBar('Destroying Top Bar...');
    // A real implementation would remove specific listeners.
    // For now, we just remove the global one we added.
    window.removeEventListener('resize', updateContentHeight);
    
    // Unsubscribe from the store to prevent memory leaks
    if (unsubscribeFromStore) {
        unsubscribeFromStore();
        unsubscribeFromStore = null;
    }

    isInitialized = false;
    logTopBar('Top Bar Destroyed.');
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
    
    logTopBar(`Preview container height updated. Top bar: ${topBarHeight}px, Log height: ${logHeight}px`);
}

// RESTORED: Essential UI handler functions
function attachTopBarHandlers() {
    logTopBar('Attaching top bar event handlers...');
    
    // Handle save button clicks
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            logTopBar('Save button clicked, dispatching action.');
            appStore.dispatch({ type: ActionTypes.FILE_SAVE_REQUEST });
        });
        logTopBar('Save button handler attached');
    }
    
    // Handle publish button clicks - REMOVED: Integration layer handles this now
    const publishBtn = document.getElementById('publish-btn');
    if (publishBtn) {
        // The click handling is now managed by PublishModalIntegration.js
        // No direct attachment needed here to avoid double handling or conflicts.
        logTopBar('Publish button handler will be managed by integration layer.');
    }
    
    logTopBar('Top bar handlers attached successfully');
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
            logTopBar('🔄 Comprehensive UI refresh triggered');
            
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
                logTopBar('Clearing caches...');
                clearCaches();
                
                // 2. Reload all CSS files
                logTopBar('Reloading CSS files...');
                await reloadAllCssSilent();
                
                // 3. Execute existing refresh handlers from refresh.js if available
                logTopBar('Executing registered refresh handlers...');
                await executeExistingRefreshHandlers();
                
                // 4. Refresh all registered components via UIManager
                logTopBar('Refreshing UI components...');
                await refreshUIComponents();
                
                // 5. Refresh all panels
                logTopBar('Refreshing panels...');
                await refreshPanels();
                
                // 6. Refresh preview
                logTopBar('Refreshing preview...');
                await refreshPreview();
                
                // 7. Emit comprehensive refresh events
                logTopBar('Emitting refresh events...');
                emitRefreshEvents();
                
                // 8. Refresh app state
                logTopBar('Refreshing app state...');
                await refreshAppState();
                
                logTopBar('✅ Comprehensive refresh completed successfully');
                
            } catch (error) {
                logTopBar(`❌ Refresh error: ${error.message}`, 'error');
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
                        logTopBar('Button text still shows refreshing, applying fallback restoration');
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
        logTopBar('Comprehensive refresh button handler attached');
    } else {
        logTopBar('Refresh button not found', 'warning');
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
                logTopBar('Executing existing refresh handlers...');
                window.executeRefresh();
                logTopBar('Existing refresh handlers executed');
            } else {
                logTopBar('No existing refresh handlers found', 'debug');
            }
        } catch (error) {
            logTopBar(`Error executing existing refresh handlers: ${error.message}`, 'warn');
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
        logTopBar(`Cleared cache key: ${key}`);
    });
    
    // Clear sessionStorage cache keys
    const sessionCacheKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('cache') || 
        key.includes('timestamp') || 
        key.includes('devpages')
    );
    sessionCacheKeys.forEach(key => {
        sessionStorage.removeItem(key);
        logTopBar(`Cleared session cache key: ${key}`);
    });
    
    // Clear service worker registrations if available
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
                registration.unregister();
                logTopBar('Unregistered service worker');
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
                        logTopBar(`Reloaded CSS: ${originalHref}`);
                        linkResolve();
                    };
                    
                    newLink.onerror = () => {
                        logTopBar(`Failed to reload CSS: ${originalHref}`, 'warn');
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
            logTopBar(`Reloaded ${reloadedCount} CSS files`);
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
                logTopBar('UIManager components refreshed');
            } else {
                logTopBar('UIManager not available for component refresh', 'warn');
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
                        logTopBar(`Refreshed component: ${componentName}`);
                    } catch (error) {
                        logTopBar(`Failed to refresh ${componentName}: ${error.message}`, 'warn');
                    }
                }
            });
            
        } catch (error) {
            logTopBar(`UI component refresh error: ${error.message}`, 'error');
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
                logTopBar('Panel manager refreshed');
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
            
            logTopBar('Panels refreshed');
            
        } catch (error) {
            logTopBar(`Panel refresh error: ${error.message}`, 'error');
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
                    logTopBar(`Preview refresh method failed: ${error.message}`, 'warn');
                }
            }
            
            if (previewRefreshed) {
                logTopBar('Preview refreshed');
            } else {
                logTopBar('No preview refresh method available', 'warn');
            }
            
        } catch (error) {
            logTopBar(`Preview refresh error: ${error.message}`, 'error');
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
            logTopBar(`Failed to emit ${eventName}: ${error.message}`, 'warn');
        }
    });
    
    logTopBar('Refresh events emitted');
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
                logTopBar('App state refreshed');
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
                        logTopBar(`Refreshed state manager: ${managerName}`);
                    } catch (error) {
                        logTopBar(`Failed to refresh ${managerName}: ${error.message}`, 'warn');
                    }
                }
            });
            
        } catch (error) {
            logTopBar(`App state refresh error: ${error.message}`, 'error');
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