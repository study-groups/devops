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
            dispatch(uiActions.toggleEditorVisibility());
            logMessage('Editor visibility toggled', 'info', 'TOP_BAR');
        });

        this.actionHandlers.set('togglePreview', () => {
            dispatch(uiActions.togglePreviewVisibility());
            logMessage('Preview visibility toggled', 'info', 'TOP_BAR');
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

        // Subscribe to state changes for button updates
        this.stateUnsubscribe = appStore.subscribe(this.updateButtonStates.bind(this));
        
        // Attach global click handler
        this.attachGlobalHandler();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Initial button state update
        this.updateButtonStates();
        
        this.initialized = true;
        logMessage('TopBarController initialized with keyboard shortcuts', 'info', 'TOP_BAR');
    }

    setupKeyboardShortcuts() {
        // REMOVED: Keyboard shortcuts now handled by centralized KeyboardShortcutManager
        // This prevents conflicts and ensures consistent behavior
        logMessage('Keyboard shortcuts delegated to centralized KeyboardShortcutManager', 'info', 'TOP_BAR');
    }

    attachGlobalHandler() {
        // Single delegated event handler for all top bar buttons
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const handler = this.actionHandlers.get(action);
            
            if (handler) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.alreadyHandled = true;
                
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
        const buttons = [
            { selector: '#edit-toggle', name: 'Edit Toggle' },
            { selector: '#preview-toggle', name: 'Preview Toggle' },
            { selector: '#log-toggle-btn', name: 'Log Toggle' },
            { selector: '#save-btn', name: 'Save Button' }
        ];

        buttons.forEach(({ selector, name }) => {
            const button = document.querySelector(selector);
            if (!button) return;

            const rect = button.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(button);
        });

        const state = appStore.getState();
        const ui = state.ui || {};
        const file = state.file || {};
        const auth = state.auth || {};
        
        const editToggle = document.querySelector('#edit-toggle');
        if (editToggle) {
            editToggle.classList.toggle('active', ui.editorVisible);
            editToggle.title = ui.editorVisible ? 'Hide Editor Panel (Alt+T)' : 'Show Editor Panel (Alt+T)';
        }

        const previewToggle = document.querySelector('#preview-toggle');
        if (previewToggle) {
            previewToggle.classList.toggle('active', ui.previewVisible);
            previewToggle.title = ui.previewVisible ? 'Hide Preview (Alt+P)' : 'Show Preview (Alt+P)';
        }

        const logButton = document.querySelector('#log-toggle-btn');
        if (logButton) {
            logButton.classList.toggle('active', ui.logVisible);
            logButton.title = ui.logVisible ? 'Hide Log (Alt+L)' : 'Show Log (Alt+L)';
        }

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
            
            saveButton.disabled = saveDisabled;
            saveButton.textContent = isSaving ? 'Saving...' : 'Save';
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
