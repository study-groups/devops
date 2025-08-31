/**
 * TopBarController.js - Unified top bar button handler system
 * Consolidates all top bar interactions into a single, consistent system
 */

import { appStore, dispatch } from '/client/appState.js';
import { uiActions } from '/client/store/uiSlice.js';
import { fileThunks } from '/client/store/slices/fileSlice.js';
import { renderMarkdown } from '/client/store/slices/previewSlice.js';
import { logMessage } from '/client/log/index.js';

export class TopBarController {
    constructor() {
        this.initialized = false;
        this.stateUnsubscribe = null;
        this.actionHandlers = new Map();
        this.setupActionHandlers();
    }

    setupActionHandlers() {
        // UI Toggle Actions
        this.actionHandlers.set('toggleEdit', () => {
            const currentState = appStore.getState().ui?.editorVisible;
            console.log(`[TopBarController] Toggling editor: ${currentState} → ${!currentState}`);
            dispatch(uiActions.toggleEditorVisibility());
            logMessage('Editor visibility toggled', 'info', 'TOP_BAR');
        });

        this.actionHandlers.set('togglePreview', () => {
            const currentState = appStore.getState().ui?.previewVisible;
            console.log(`[TopBarController] Toggling preview: ${currentState} → ${!currentState}`);
            dispatch(uiActions.togglePreviewVisibility());
            logMessage('Preview visibility toggled', 'info', 'TOP_BAR');
        });

        this.actionHandlers.set('toggleSidebar', () => {
            const currentState = appStore.getState().ui?.leftSidebarVisible;
            const newState = currentState === false; // If false, make true; if true/undefined, make false
            console.log(`[TopBarController] Toggling sidebar: ${currentState} → ${newState}`);
            dispatch(uiActions.setLeftSidebarVisible(newState));
            logMessage(`Sidebar visibility toggled: ${currentState} → ${newState}`, 'info', 'TOP_BAR');
        });

        this.actionHandlers.set('toggleLogVisibility', () => {
            dispatch(uiActions.toggleLogVisibility());
            logMessage('Log visibility toggled', 'info', 'TOP_BAR');
        });

        // File Actions
        this.actionHandlers.set('saveFile', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const state = appStore.getState();
            const { currentPathname, isDirectorySelected } = state.path;
            const isModified = state.editor?.isModified || false; // Use editor isModified state

            if (!currentPathname || isDirectorySelected) {
                logMessage('Save button clicked but no file is selected', 'warn', 'TOP_BAR');
                return;
            }

            if (!isModified) {
                logMessage('Save button clicked but no changes to save', 'info', 'TOP_BAR');
                return;
            }
            
            logMessage(`Dispatching saveFile thunk for: ${currentPathname}`, 'info', 'TOP_BAR');
            dispatch(fileThunks.saveFile());
        });

        // Refresh Actions
        this.actionHandlers.set('refreshPreview', async (e, button) => {
            // Visual feedback
            if (button) {
                button.style.transform = 'rotate(360deg)';
                button.style.transition = 'transform 0.6s ease';
                setTimeout(() => {
                    button.style.transform = '';
                    button.style.transition = '';
                }, 600);
            }

            // Reload CSS silently
            await this.reloadAllCssSilent();
            
            // Refresh preview content
            const { editor } = appStore.getState();
            dispatch(renderMarkdown(editor.content));
            
            logMessage('Full refresh triggered: CSS reload + Preview update', 'info', 'TOP_BAR');
        });
    }

    async reloadAllCssSilent() {
        return new Promise((resolve) => {
            const timestamp = Date.now();
            const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            
            if (linkElements.length === 0) {
                resolve();
                return;
            }
            
            const processLink = (link) => {
                return new Promise((linkResolve) => {
                    const originalHref = link.getAttribute('href');
                    if (originalHref) {
                        const newHref = originalHref.split('?')[0] + `?t=${timestamp}`;
                        
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
                            linkResolve();
                        };
                        
                        newLink.onerror = () => {
                            logMessage(`Failed to reload CSS: ${originalHref}`, 'warn', 'TOP_BAR');
                            linkResolve();
                        };
                        
                        link.parentNode.insertBefore(newLink, link.nextSibling);
                    } else {
                        linkResolve();
                    }
                });
            };
            
            Promise.all(linkElements.map(processLink)).then(resolve);
        });
    }

    initialize() {
        if (this.initialized) {
            logMessage('TopBarController already initialized', 'warn', 'TOP_BAR');
            return;
        }

        // Subscribe to state changes for button updates with selective monitoring
        this.setupSelectiveStateSubscription();
        
        // Attach global click handler
        this.attachGlobalHandler();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Initial button state update
        this.updateButtonStates();
        
        this.initialized = true;
        logMessage('TopBarController initialized with keyboard shortcuts', 'info', 'TOP_BAR');
    }

    setupSelectiveStateSubscription() {
        let lastRelevantState = null;
        let updateTimeout = null;
        
        this.stateUnsubscribe = appStore.subscribe(() => {
            const state = appStore.getState();
            
            // Only track UI-related state that affects button appearance
            const currentRelevantState = {
                leftSidebarVisible: state.ui?.leftSidebarVisible,
                editorVisible: state.ui?.editorVisible,
                previewVisible: state.ui?.previewVisible,
                logVisible: state.ui?.logVisible,
                isAuthenticated: state.auth?.isAuthenticated,
                isLoading: state.ui?.isLoading,
                fileStatus: state.file?.status,
                currentPathname: state.path?.currentPathname,
                isDirectorySelected: state.path?.isDirectorySelected,
                isModified: state.editor?.isModified
            };
            
            // Only update if relevant state actually changed
            if (!lastRelevantState || JSON.stringify(currentRelevantState) !== JSON.stringify(lastRelevantState)) {
                // Debug: Log what changed
                if (lastRelevantState) {
                    const changes = Object.keys(currentRelevantState).filter(key => 
                        currentRelevantState[key] !== lastRelevantState[key]
                    );
                    console.log('[TopBarController] State changed:', changes);
                    
                    // CRITICAL FIX: Only update if changes are actually view-control related
                    const viewControlChanges = changes.filter(change => 
                        ['leftSidebarVisible', 'editorVisible', 'previewVisible', 'logVisible'].includes(change)
                    );
                    
                    if (viewControlChanges.length === 0) {
                        console.log('[TopBarController] Ignoring non-view-control changes:', changes);
                        lastRelevantState = currentRelevantState;
                        return;
                    }
                    
                    console.log('[TopBarController] Processing view control changes:', viewControlChanges);
                }
                
                lastRelevantState = currentRelevantState;
                
                // Debounce button updates to prevent rapid-fire changes
                if (updateTimeout) {
                    clearTimeout(updateTimeout);
                }
                updateTimeout = setTimeout(() => {
                    this.updateButtonStates();
                    updateTimeout = null;
                }, 5); // 5ms debounce
            }
        });
    }

    setupKeyboardShortcuts() {
        // REMOVED: Keyboard shortcuts now handled by centralized KeyboardShortcutManager
        // This prevents conflicts and ensures consistent behavior
        logMessage('Keyboard shortcuts delegated to centralized KeyboardShortcutManager', 'info', 'TOP_BAR');
    }

    attachGlobalHandler() {
        // Single delegated event handler for all top bar buttons
        document.addEventListener('click', (e) => {
            // Skip if event was already handled by another component
            if (e.alreadyHandled) return;
            
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const handler = this.actionHandlers.get(action);
            
            if (handler) {
                // Mark event as handled to prevent other handlers
                e.alreadyHandled = true;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                try {
                    handler(e, button);
                    // Remove focus from button after click to prevent lingering border
                    button.blur();
                } catch (error) {
                    logMessage(`Error handling action ${action}: ${error.message}`, 'error', 'TOP_BAR');
                }
            }
        });
    }

    updateButtonStates() {
        const state = appStore.getState();
        const ui = state.ui || {};
        const file = state.file || {};
        const auth = state.auth || {};
        
        // CRITICAL FIX: Use proper defaults when state is undefined
        const buttonUpdates = [
            {
                selector: '#sidebar-toggle',
                active: ui.leftSidebarVisible !== false, // Default to true
                title: (ui.leftSidebarVisible !== false) ? 'Hide Sidebar (Alt+S)' : 'Show Sidebar (Alt+S)'
            },
            {
                selector: '#edit-toggle',
                active: ui.editorVisible !== false, // Default to true
                title: (ui.editorVisible !== false) ? 'Hide Editor Panel (Alt+T)' : 'Show Editor Panel (Alt+T)'
            },
            {
                selector: '#preview-toggle',
                active: ui.previewVisible !== false, // Default to true
                title: (ui.previewVisible !== false) ? 'Hide Preview (Alt+P)' : 'Show Preview (Alt+P)'
            },
            {
                selector: '#log-toggle-btn',
                active: ui.logVisible !== false, // Default to true
                title: (ui.logVisible !== false) ? 'Hide Log (Alt+L)' : 'Show Log (Alt+L)'
            }
        ];
        
        console.log('[TopBarController] Button states:', {
            leftSidebarVisible: ui.leftSidebarVisible,
            editorVisible: ui.editorVisible,
            previewVisible: ui.previewVisible,
            logVisible: ui.logVisible,
            buttonStates: buttonUpdates.map(b => ({ selector: b.selector, active: b.active }))
        });

        buttonUpdates.forEach(({ selector, active, title }) => {
            const button = document.querySelector(selector);
            if (button) {
                const currentlyActive = button.classList.contains('active');
                if (currentlyActive !== active) {
                    console.log(`[TopBarController] BUTTON UPDATE: ${selector} from ${currentlyActive} to ${active}`);
                    button.classList.toggle('active', active);
                }
                if (button.title !== title) {
                    button.title = title;
                }
            }
        });

        // Handle save button separately as it has different logic
        const saveButton = document.querySelector('#save-btn');
        if (saveButton) {
            const path = state.path || {};
            const currentPathname = path.currentPathname;
            const isDirectorySelected = path.isDirectorySelected;
            
            const editor = state.editor || {};
            const isEditorModified = editor.isModified || false;
            
            const isAuthenticated = auth.authChecked && auth.isAuthenticated;
            const isOverallLoading = ui.isLoading;
            const isSaving = file.status === 'loading';
            const hasFile = currentPathname && !isDirectorySelected;
            const isFileModified = isEditorModified;
            
            const saveDisabled = !isAuthenticated || isOverallLoading || isSaving || !hasFile || !isFileModified;
            const saveText = isSaving ? 'Saving...' : 'Save';
            
            if (saveButton.disabled !== saveDisabled) {
                saveButton.disabled = saveDisabled;
            }
            if (saveButton.textContent !== saveText) {
                saveButton.textContent = saveText;
            }
        }
    }

    // New debug method to capture detailed button information
    _getButtonDebugInfo(selector) {
        const button = document.querySelector(selector);
        if (!button) return null;

        const computedStyle = window.getComputedStyle(button);
        const boundingRect = button.getBoundingClientRect();

        // Log extreme details about button
        console.error(`🔍 BUTTON FORENSICS: ${selector}`, {
            exists: !!button,
            classList: Array.from(button.classList),
            attributes: Array.from(button.attributes).map(attr => ({ 
                name: attr.name, 
                value: attr.value 
            })),
            computedStyle: {
                width: computedStyle.width,
                height: computedStyle.height,
                minWidth: computedStyle.minWidth,
                maxWidth: computedStyle.maxWidth,
                padding: computedStyle.padding,
                margin: computedStyle.margin,
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                opacity: computedStyle.opacity,
                transform: computedStyle.transform,
                transition: computedStyle.transition
            },
            boundingRect: {
                width: boundingRect.width,
                height: boundingRect.height,
                top: boundingRect.top,
                left: boundingRect.left
            },
            // Extreme tracking
            offsetWidth: button.offsetWidth,
            offsetHeight: button.offsetHeight,
            clientWidth: button.clientWidth,
            clientHeight: button.clientHeight
        });

        return {
            exists: !!button,
            width: boundingRect.width,
            height: boundingRect.height
        };
    }

    destroy() {
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        this.initialized = false;
        logMessage('TopBarController destroyed', 'info', 'TOP_BAR');
    }
}

// Create singleton instance
export const topBarController = new TopBarController();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.topBarController = topBarController;
}
