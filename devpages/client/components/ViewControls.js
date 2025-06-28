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
                logMessage(`Reloading CSS: ${originalHref}`, 'debug', 'VIEW_CONTROLS');
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
        
        // Trigger a preview refresh after CSS reload
        setTimeout(() => {
            if (window.previewManager && typeof window.previewManager.refresh === 'function') {
                window.previewManager.refresh();
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

export function createViewControlsComponent(targetElementId, layoutManager) {
    let element = null;
    let appStateUnsubscribe = null; // ADDED: Store unsubscribe function for appState

    const updateToggleButtons = (panelsState) => {
        if (!element) {
            console.error('[ViewControls] updateToggleButtons called but element is null');
            return;
        }
        
        const editorPanelState = panelsState['editor-panel'];
        const previewPanelState = panelsState['preview-panel'];

        // Update Edit toggle (editor panel visibility)
        const editToggle = element.querySelector('#edit-toggle');
        if (editToggle && editorPanelState) {
            editToggle.classList.toggle('active', editorPanelState.visible);
            editToggle.title = editorPanelState.visible ? 'Hide Editor Panel (Alt+T)' : 'Show Editor Panel (Alt+T)';
        }
        
        // Update Preview toggle (preview panel visibility)
        const previewToggle = element.querySelector('#preview-toggle');
        if (previewToggle && previewPanelState) {
            previewToggle.classList.toggle('active', previewPanelState.visible);
            previewToggle.title = previewPanelState.visible ? 'Hide Preview Panel (Alt+P)' : 'Show Preview Panel (Alt+P)';
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

    // Handle app state changes
    const handleAppStateChange = (newState, prevState) => {
        const newPanels = newState?.panels || {};
        const prevPanels = prevState?.panels || {};

        if (JSON.stringify(newPanels) !== JSON.stringify(prevPanels)) {
            updateToggleButtons(newPanels);
        }

        const newUi = newState?.ui || {};
        updateLogButtonState(newUi.logVisible || false);
    };

    const mount = () => {
        logMessage('Mounting ViewControls with text/preview system...', 'info', 'VIEW_CONTROLS');
        
        element = document.getElementById(targetElementId);
        if (!element) {
            logMessage(`Target element #${targetElementId} not found.`, 'error', 'VIEW_CONTROLS');
            return false;
        }

        // Render the updated toggle buttons for editor/preview system
        element.innerHTML = `
            <button id="edit-toggle" title="Toggle Editor Panel (Alt+T)" data-action="toggleEdit">Edit</button>
            <button id="preview-toggle" title="Toggle Preview Panel (Alt+P)" data-action="togglePreview">Preview</button>
            <button id="log-toggle-btn" title="Show Log (Alt+L)" data-action="toggleLogVisibility">Log</button>
            <button id="preview-reload-btn" title="Soft Reload - Refresh All CSS" data-action="refreshPreview">&#x21bb;</button>
        `;
        
        // Subscribe to app state changes
        if (appStateUnsubscribe) appStateUnsubscribe();
        appStateUnsubscribe = appStore.subscribe(handleAppStateChange);
        
        // Subscribe to layout system events
        if (eventBus && typeof eventBus.on === 'function') {
            eventBus.on('layout:panelStateChanged', (layoutState) => {
                updateToggleButtons(layoutState);
            });
        }
        
        // Set initial button states - delay to ensure store is initialized
        setTimeout(() => {
            const initialAppState = appStore.getState();
            updateToggleButtons(initialAppState.panels || {});
            updateLogButtonState(initialAppState.ui?.logVisible || false);
        }, 0);

        // Handle button clicks
        element.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            e.preventDefault();
            e.stopPropagation();

            switch (action) {
                case 'toggleLogVisibility':
                    dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
                    break;
                    
                case 'toggleEdit':
                    dispatch({ type: ActionTypes.PANEL_TOGGLE_VISIBILITY, payload: { panelId: 'editor-panel' } });
                    break;
                    
                case 'togglePreview':
                    dispatch({ type: ActionTypes.PANEL_TOGGLE_VISIBILITY, payload: { panelId: 'preview-panel' } });
                    break;
                    
                case 'refreshPreview':
                    // Perform soft page reload - reload all CSS files
                    reloadAllCss();
                    break;
            }
        });

        logMessage('ViewControls mounted and subscribed.', 'info', 'VIEW_CONTROLS');
        return true;
    };

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
        mount,
        destroy
    };
}