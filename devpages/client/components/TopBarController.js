/**
 * TopBarController.js - Unified top bar button handler system
 * Consolidates all top bar interactions into a single, consistent system
 */

import { appStore, dispatch } from '/client/appState.js';
import { uiActions } from '/client/store/uiSlice.js';
import { fileThunks } from '/client/store/slices/fileSlice.js';
import { renderMarkdown } from '/client/store/slices/previewSlice.js';
// Use unified logging system
let log;
function getLogger() {
    if (!log && window.APP?.services?.log) {
        log = window.APP.services.log.createLogger('UI', 'TopBarController');
    }
    return log || {
        info: (action, msg) => console.log(`[UI][TopBarController][${action}] ${msg}`),
        warn: (action, msg) => console.warn(`[UI][TopBarController][${action}] ${msg}`),
        debug: (action, msg) => console.debug(`[UI][TopBarController][${action}] ${msg}`),
        error: (action, msg) => console.error(`[UI][TopBarController][${action}] ${msg}`)
    };
}

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
            getLogger().info('TOGGLE_EDITOR', `Toggling editor: ${currentState} → ${!currentState}`);
            dispatch(uiActions.toggleEditorVisibility());
        });

        this.actionHandlers.set('togglePreview', () => {
            const currentState = appStore.getState().ui?.previewVisible;
            getLogger().info('TOGGLE_PREVIEW', `Toggling preview: ${currentState} → ${!currentState}`);
            dispatch(uiActions.togglePreviewVisibility());
            getLogger().info('TOGGLE_PREVIEW', 'Preview visibility toggled');
        });

        this.actionHandlers.set('toggleSidebar', () => {
            const currentState = appStore.getState().ui?.leftSidebarVisible;
            const newState = currentState === false; // If false, make true; if true/undefined, make false
            getLogger().info('TOGGLE_SIDEBAR', `Toggling sidebar: ${currentState} → ${newState}`);
            dispatch(uiActions.setLeftSidebarVisible(newState));
            getLogger().info('TOGGLE_SIDEBAR', `Sidebar visibility: ${currentState} → ${newState}`);
        });

        this.actionHandlers.set('toggleLogVisibility', () => {
            const currentState = appStore.getState().ui?.logVisible;
            dispatch(uiActions.toggleLogVisibility());
            getLogger().info('TOGGLE_LOG', `Log visibility: ${currentState} → ${!currentState}`);
        });

        // File Actions
        this.actionHandlers.set('saveFile', (e) => {
            console.log('[TopBarController] saveFile handler called with event:', {
                eventType: e?.type,
                target: e?.target?.tagName,
                targetId: e?.target?.id
            });
            
            e.preventDefault();
            e.stopPropagation();
            
            const state = appStore.getState();
            const { currentPathname, isDirectorySelected } = state.path;
            const isModified = state.editor?.isModified || false; // Use editor isModified state

            console.log('[TopBarController] saveFile state check:', {
                currentPathname,
                isDirectorySelected,
                isModified,
                pathState: state.path,
                editorState: state.editor,
                authState: { 
                    isAuthenticated: state.auth?.isAuthenticated, 
                    authChecked: state.auth?.authChecked 
                }
            });

            if (!currentPathname || isDirectorySelected) {
                console.warn('[TopBarController] Save blocked - no file selected');
                getLogger().warn('SAVE_NO_FILE', 'Save button clicked but no file is selected');
                return;
            }

            if (!isModified) {
                console.warn('[TopBarController] Save blocked - no changes detected');
                getLogger().info('SAVE_NO_CHANGES', 'Save button clicked but no changes to save');
                return;
            }
            
            console.log('[TopBarController] Dispatching saveFile thunk...');
            getLogger().info('SAVE_FILE', `Dispatching saveFile thunk for: ${currentPathname}`);
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
            
            getLogger().info('FULL_REFRESH', 'CSS reload + Preview update triggered');
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
                            getLogger().warn('CSS_RELOAD_FAILED', `Failed to reload CSS: ${originalHref}`);
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
            getLogger().warn('ALREADY_INITIALIZED', 'TopBarController already initialized');
            return;
        }

        // Subscribe to state changes for button updates with selective monitoring
        this.setupSelectiveStateSubscription();
        
        // Attach global click handler
        this.attachGlobalHandler();
        getLogger().info('HANDLER_ATTACHED', 'Global click handler attached');
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Initial button state update
        this.updateButtonStates();
        
        // Debug: Log all registered action handlers
        getLogger().info('HANDLERS_REGISTERED', `Registered ${this.actionHandlers.size} action handlers: ${Array.from(this.actionHandlers.keys()).join(', ')}`);
        
        this.initialized = true;
        getLogger().info('INIT_COMPLETE', 'TopBarController initialized with keyboard shortcuts');
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
            
            // Always update button states on any tracked state change
            lastRelevantState = currentRelevantState;
            
            // Debounce button updates to prevent rapid-fire changes
            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }
            updateTimeout = setTimeout(() => {
                this.updateButtonStates();
                updateTimeout = null;
            }, 200); // 200ms debounce to reduce flickering
        });
    }

    setupKeyboardShortcuts() {
        // REMOVED: Keyboard shortcuts now handled by centralized KeyboardShortcutManager
        // This prevents conflicts and ensures consistent behavior
        getLogger().info('SHORTCUTS_DELEGATED', 'Keyboard shortcuts delegated to centralized KeyboardShortcutManager');
    }

    attachGlobalHandler() {
        // Single delegated event handler for all top bar buttons
        document.addEventListener('click', (e) => {
            // Skip if event was already handled by another component
            if (e.alreadyHandled) return;
            
            const button = e.target.closest('button[data-action]');
            if (!button) {
                // Debug: Log all button clicks to trace save button issues
                const clickedButton = e.target.closest('button');
                if (clickedButton) {
                    console.log(`[TopBarController] Button clicked without data-action:`, {
                        id: clickedButton.id,
                        className: clickedButton.className,
                        textContent: clickedButton.textContent?.trim(),
                        hasDataAction: clickedButton.hasAttribute('data-action'),
                        dataAction: clickedButton.dataset.action,
                        allAttributes: Array.from(clickedButton.attributes).map(a => `${a.name}="${a.value}"`),
                        parentElement: clickedButton.parentElement?.tagName
                    });
                }
                return;
            }

            const action = button.dataset.action;
            const handler = this.actionHandlers.get(action);
            
            // Debug: Log all data-action button clicks
            console.log(`[TopBarController] Button with data-action clicked:`, {
                action,
                buttonId: button.id,
                hasHandler: !!handler,
                handlerKeys: Array.from(this.actionHandlers.keys()),
                buttonDisabled: button.disabled,
                buttonText: button.textContent?.trim()
            });
            
            if (handler) {
                // Mark event as handled to prevent other handlers
                e.alreadyHandled = true;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                try {
                    console.log(`[TopBarController] Executing handler for action: ${action}`);
                    handler(e, button);
                    // Remove focus from button after click to prevent lingering border
                    button.blur();
                } catch (error) {
                    console.error(`[TopBarController] Handler error for ${action}:`, error);
                    getLogger().error('ACTION_ERROR', `Error handling action ${action}: ${error.message}`);
                }
            } else {
                console.warn(`[TopBarController] No handler found for action: ${action}`);
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
            
            // Debug: Log save button state calculation
            console.log('[TopBarController] Save button state:', {
                buttonExists: !!saveButton,
                currentPathname,
                isDirectorySelected,
                isEditorModified,
                isAuthenticated,
                authChecked: auth.authChecked,
                isOverallLoading,
                isSaving,
                hasFile,
                isFileModified,
                saveDisabled,
                saveText,
                buttonCurrentlyDisabled: saveButton.disabled,
                buttonCurrentText: saveButton.textContent?.trim(),
                hasDataAction: saveButton.hasAttribute('data-action'),
                dataAction: saveButton.dataset.action,
                buttonId: saveButton.id
            });
            
            if (saveButton.disabled !== saveDisabled) {
                console.log(`[TopBarController] Changing save button disabled state: ${saveButton.disabled} -> ${saveDisabled}`);
                saveButton.disabled = saveDisabled;
            }
            if (saveButton.textContent !== saveText) {
                console.log(`[TopBarController] Changing save button text: "${saveButton.textContent}" -> "${saveText}"`);
                saveButton.textContent = saveText;
            }

            // Toggle dirty class for styling
            saveButton.classList.toggle('is-dirty', isFileModified && !saveDisabled);
        } else {
            console.warn('[TopBarController] Save button (#save-btn) not found in the DOM');
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
        getLogger().info('DESTROYED', 'TopBarController destroyed');
    }

    // Debug helper to manually test save button functionality
    debugSaveButton() {
        console.log('=== SAVE BUTTON DEBUG ANALYSIS ===');
        
        const saveButton = document.querySelector('#save-btn');
        console.log('1. Button exists:', !!saveButton);
        
        if (!saveButton) {
            console.error('Save button not found in DOM');
            return;
        }

        console.log('2. Button attributes:', {
            id: saveButton.id,
            disabled: saveButton.disabled,
            textContent: saveButton.textContent?.trim(),
            hasDataAction: saveButton.hasAttribute('data-action'),
            dataAction: saveButton.dataset.action,
            classList: Array.from(saveButton.classList),
            allAttributes: Array.from(saveButton.attributes).map(a => `${a.name}="${a.value}"`)
        });

        const handler = this.actionHandlers.get('saveFile');
        console.log('3. Handler registration:', {
            hasHandler: !!handler,
            handlerType: typeof handler,
            allHandlers: Array.from(this.actionHandlers.keys())
        });

        console.log('4. Current state for save logic:');
        const state = appStore.getState();
        const saveState = {
            path: state.path,
            editor: state.editor,
            auth: { isAuthenticated: state.auth?.isAuthenticated, authChecked: state.auth?.authChecked },
            file: { status: state.file?.status },
            ui: { isLoading: state.ui?.isLoading }
        };
        console.log(saveState);

        console.log('5. Testing manual save trigger...');
        if (handler) {
            try {
                const mockEvent = {
                    type: 'click',
                    target: saveButton,
                    preventDefault: () => console.log('preventDefault called'),
                    stopPropagation: () => console.log('stopPropagation called')
                };
                handler(mockEvent);
                console.log('Manual save trigger completed');
            } catch (error) {
                console.error('Manual save trigger failed:', error);
            }
        }
    }
}

// Create singleton instance
export const topBarController = new TopBarController();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.topBarController = topBarController;
    
    // Add global debug helpers
    window.debugSaveButton = () => topBarController.debugSaveButton();
    window.testSaveButton = () => {
        console.log('Testing save button click...');
        const saveButton = document.querySelector('#save-btn');
        if (saveButton) {
            saveButton.click();
        } else {
            console.error('Save button not found');
        }
    };
}
