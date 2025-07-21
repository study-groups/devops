import { appStore } from '/client/appState.js'; // CHANGED: Use appStore
import eventBus from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
import { logMessage } from '/client/log/index.js'; // Use the central logger
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

/**
 * Reload all CSS stylesheets by appending a timestamp to force cache busting
 * Uses smooth loading to minimize visual disruption
 */
function reloadAllCss() {
    logMessage('🔄 Performing soft page reload - reloading all CSS...', 'info', 'VIEW_CONTROLS');
    
    const timestamp = Date.now();
    let reloadedCount = 0;
    
    // Add a subtle loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 123, 255, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease;
    `;
    loadingIndicator.textContent = '🔄 Refreshing CSS...';
    document.body.appendChild(loadingIndicator);
    
    // Find all link elements with rel="stylesheet"
    const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    
    // Process CSS files in batches to reduce visual jarring
    const batchSize = 3;
    let currentBatch = 0;
    
    const processBatch = () => {
        const startIndex = currentBatch * batchSize;
        const endIndex = Math.min(startIndex + batchSize, linkElements.length);
        const batch = linkElements.slice(startIndex, endIndex);
        
        batch.forEach((link) => {
            const originalHref = link.getAttribute('href');
            if (originalHref) {
                // Create new URL with timestamp
                const separator = originalHref.includes('?') ? '&' : '?';
                const newHref = `${originalHref}${separator}t=${timestamp}`;
                
                // Create a new link element to replace the old one
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
                
                // Wait for the new stylesheet to load before removing the old one
                newLink.onload = () => {
                    // Small delay to ensure smooth transition
                    setTimeout(() => {
                        if (link.parentNode) {
                            link.remove();
                        }
                    }, 50);
                };
                
                newLink.onerror = () => {
                    logMessage(`Failed to reload CSS: ${originalHref}`, 'warn', 'VIEW_CONTROLS');
                };
                
                // Insert new link before old one
                link.parentNode.insertBefore(newLink, link);
                
                reloadedCount++;
                // Removed debug logging to prevent spam
            }
        });
        
        currentBatch++;
        
        // Process next batch or finish
        if (currentBatch * batchSize < linkElements.length) {
            setTimeout(processBatch, 100); // Small delay between batches
        } else {
            // All batches processed, handle style elements and cleanup
            finishReload();
        }
    };
    
    const finishReload = () => {
        // Also reload any <style> elements that might have @import statements
        const styleElements = document.querySelectorAll('style');
        styleElements.forEach((style) => {
            const content = style.textContent;
            if (content && content.includes('@import')) {
                // Force reparse by temporarily removing and re-adding
                const parent = style.parentNode;
                const nextSibling = style.nextSibling;
                parent.removeChild(style);
                setTimeout(() => {
                    parent.insertBefore(style, nextSibling);
                }, 10);
            }
        });
        
        // Remove loading indicator
        setTimeout(() => {
            loadingIndicator.style.opacity = '0';
            setTimeout(() => {
                if (loadingIndicator.parentNode) {
                    loadingIndicator.remove();
                }
            }, 300);
        }, 500);
        
        logMessage(`✅ Soft reload complete - reloaded ${reloadedCount} CSS files`, 'info', 'VIEW_CONTROLS');
        
        // Trigger a preview refresh after CSS reload using window.eventBus (to match PreviewPanel)
        setTimeout(() => {
            if (window.eventBus && typeof window.eventBus.emit === 'function') {
                window.eventBus.emit('preview:forceRefresh');
                logMessage('Preview refresh event emitted via window.eventBus after CSS reload', 'debug', 'VIEW_CONTROLS');
            } else {
                logMessage('window.eventBus not available for preview refresh after CSS reload', 'warn', 'VIEW_CONTROLS');
            }
        }, 200);
    };
    
    // Start processing batches
    if (linkElements.length > 0) {
        processBatch();
    } else {
        finishReload();
    }
}

/**
 * Reload all CSS files silently (without popup)
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
                        // Removed debug logging to prevent spam
                        linkResolve();
                    };
                    
                    newLink.onerror = () => {
                        logMessage(`Failed to reload CSS: ${originalHref}`, 'warn', 'VIEW_CONTROLS');
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
            // Removed debug logging to prevent spam
            resolve();
        });
    });
}

export function createViewControlsComponent(targetElementId, layoutManager = null) {
    let element = null;
    let appStateUnsubscribe = null; // ADDED: Store unsubscribe function for appState

    const updateToggleButtons = (workspaceState) => {
        if (!element) {
            console.error('[ViewControls] updateToggleButtons called but element is null');
            return;
        }
        
        // Update Edit toggle (editor panel visibility) - use workspace state
        const editToggle = element.querySelector('#edit-toggle');
        if (editToggle && workspaceState?.editor) {
            editToggle.classList.toggle('active', workspaceState.editor.visible);
            editToggle.title = workspaceState.editor.visible ? 'Hide Editor Panel (Alt+T)' : 'Show Editor Panel (Alt+T)';
        }

    };
    
    const updateLogButtonState = (isVisible) => {
        if (!element) return;
        
        const logButton = element.querySelector('#log-toggle-btn');
        if (logButton) {
            logButton.classList.toggle('active', isVisible);
            logButton.title = isVisible ? 'Hide Log (Alt+L)' : 'Show Log (Alt+L)';
        }
    };

    function init() {
        logMessage('Mounting ViewControls with text/preview system...', 'info', 'VIEW_CONTROLS');
        
        element = document.getElementById(targetElementId);
        if (!element) {
            logMessage(`Target element #${targetElementId} not found.`, 'error', 'VIEW_CONTROLS');
            return false;
        }

        // Render the updated toggle buttons for workspace system
        element.innerHTML = `
            <button id="edit-toggle" class="btn btn-ghost btn-sm" title="Open Editor (Alt+T)" data-action="toggleEdit">Edit</button>
            <button id="log-toggle-btn" class="btn btn-ghost btn-sm" title="Show Log (Alt+L)" data-action="toggleLogVisibility">Log</button>
            <button id="preview-reload-btn" class="btn btn-ghost btn-sm" title="Soft Reload - Refresh All CSS" data-action="refreshPreview">&#x21bb;</button>
        `;
        
        let prevState = appStore.getState(); // Initialize previous state
        appStateUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            handleAppStateChange(newState, prevState);
            prevState = newState; // Update previous state
        });

        // Initial render
        handleAppStateChange(appStore.getState(), {});
        
        // Subscribe to layout system events
        if (eventBus && typeof eventBus.on === 'function') {
            eventBus.on('layout:panelStateChanged', (layoutState) => {
                updateToggleButtons(layoutState);
            });
        }
        
        // Set initial button states - delay to ensure store is initialized
        setTimeout(() => {
            const initialAppState = appStore.getState();
            updateToggleButtons(initialAppState.workspace || {});
            updateLogButtonState(initialAppState.ui?.logVisible || false);
        }, 0);

        // Handle button clicks
        element.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            e.preventDefault();
            e.stopPropagation();

            switch (action) {
                case 'toggleLogVisibility':
                    if (window.logPanel && typeof window.logPanel.toggleVisibility === 'function') {
                        window.logPanel.toggleVisibility();
                    }
                    break;
                    
                case 'toggleEdit':
                    // Use the workspace panel manager to toggle the editor
                    if (window.workspaceLayoutManager) {
                        window.workspaceLayoutManager.toggleEditor();
                    }
                    break;
                    
                case 'togglePanels':
                    // Use the workspace panel manager to toggle the sidebar
                    if (window.workspaceLayoutManager) {
                        window.workspaceLayoutManager.toggleSidebar();
                    }
                    break;
                    
                case 'refreshPreview':
                    // Provide visual feedback
                    button.style.transform = 'rotate(360deg)';
                    button.style.transition = 'transform 0.6s ease';
                    setTimeout(() => {
                        button.style.transform = '';
                        button.style.transition = '';
                    }, 600);
                    
                    // Debug logging for eventBus instances
                            // Removed excessive debug logging to prevent spam
                    // Perform soft page reload - reload all CSS files
                    reloadAllCssSilent();
                    
                    // Trigger preview refresh using window.eventBus (to match PreviewPanel)
                    // Debug information (only log in case of errors)
                    if (!window.eventBus && !eventBus) {
                        logMessage('Warning: Neither window.eventBus nor imported eventBus available for preview refresh', 'warn', 'VIEW_CONTROLS');
                    }
                    
                    // Try to emit via window.eventBus first
                    if (window.eventBus && typeof window.eventBus.emit === 'function') {
                        try {
                            window.eventBus.emit('preview:forceRefresh');
                            // Only log success on errors, not every time
                        } catch (error) {
                            logMessage(`Preview force refresh event failed: ${error.message}`, 'error', 'VIEW_CONTROLS');
                        }
                    } else if (eventBus && typeof eventBus.emit === 'function') {
                        // Use imported eventBus as fallback
                        try {
                            eventBus.emit('preview:forceRefresh');
                            // Only log success on errors, not every time
                        } catch (error) {
                            logMessage(`Preview force refresh event failed: ${error.message}`, 'error', 'VIEW_CONTROLS');
                        }
                    } else {
                        logMessage('Neither window.eventBus nor imported eventBus available for preview refresh', 'warn', 'VIEW_CONTROLS');
                    }
                    
                    // Also emit CSS settings changed event for good measure
                    if (window.eventBus && typeof window.eventBus.emit === 'function') {
                        try {
                            window.eventBus.emit('preview:cssSettingsChanged', { reason: 'manual_refresh' });
                            logMessage('CSS settings changed event emitted via window.eventBus', 'debug', 'VIEW_CONTROLS');
                        } catch (error) {
                            logMessage(`CSS settings changed event failed: ${error.message}`, 'error', 'VIEW_CONTROLS');
                        }
                    } else if (eventBus && typeof eventBus.emit === 'function') {
                        try {
                            eventBus.emit('preview:cssSettingsChanged', { reason: 'manual_refresh' });
                            logMessage('CSS settings changed event emitted via imported eventBus', 'debug', 'VIEW_CONTROLS');
                        } catch (error) {
                            logMessage(`CSS settings changed event failed: ${error.message}`, 'error', 'VIEW_CONTROLS');
                        }
                    }
                    
                    logMessage('🔄 Full refresh triggered: CSS reload + Preview update via eventBus', 'info', 'VIEW_CONTROLS');
                    break;
            }
        });

        logMessage('ViewControls mounted and subscribed.', 'info', 'VIEW_CONTROLS');       return true;
    }

    function handleAppStateChange(newState, prevState) {
        if (!prevState) return; // Guard against initial undefined state
        const newViewMode = newState.ui.viewMode;
        const oldViewMode = prevState.ui.viewMode;

        if (newViewMode !== oldViewMode) {
            // This function is now called directly by the subscribe callback,
            // so we don't need to call render() here.
            // The updateToggleButtons and updateLogButtonState functions
            // will be called by the subscribe callback.
        }
    }

    const destroy = () => {
        logMessage('Destroying ViewControls...', 'info', 'VIEW_CONTROLS');
        // Unsubscribe from appState changes
        if (appStateUnsubscribe) {
            appStateUnsubscribe();
            appStateUnsubscribe = null;
            logMessage('ViewControls unsubscribed from appState changes.', 'info', 'VIEW_CONTROLS');
        }
        
        if (element) {
            element.innerHTML = '';
        }
        element = null;
        logMessage('ViewControls destroyed.', 'info', 'VIEW_CONTROLS');
    };

    return {
        init, // Changed from mount to init
        destroy
    };
}