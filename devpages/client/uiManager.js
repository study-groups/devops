/**
 * uiManager.js - Manages UI updates based on state changes and events.
 * Consolidates UI initialization and state reaction logic.
 */
import { eventBus } from '/client/eventBus.js';
import { logMessage } from '/client/log/index.js';
import { appStore } from '/client/appState.js';
import { createAuthDisplayComponent } from '/client/components/AuthDisplay.js';
import { createContextManagerComponent } from '/client/components/ContextManagerComponent.js';

// --- Module State ---
let appStateUnsubscribe = null;
let authDisplayComponent = null;
let contextManagerComponent = null;
let breadcrumbContainer = null; // Keep reference for listener

// --- Logging Helper ---
function logUI(message, type = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, type, 'UI_MANAGER');
    } else {
        console.log(`[UI_MANAGER] ${message}`);
    }
}

// --- UI Applying Functions ---
function applyViewMode(mode) {
    logUI(`Applying view mode: ${mode}`);
    const body = document.body;
    logUI(`Body classes BEFORE remove: ${body.className}`);
    body.classList.remove('view-code', 'view-preview', 'view-split');
    logUI(`Body classes AFTER remove: ${body.className}`);
    switch (mode) {
        case 'editor': 
            logUI(`Adding class: view-code`);
            body.classList.add('view-code'); 
            break;
        case 'preview': 
            logUI(`Adding class: view-preview`);
            body.classList.add('view-preview'); 
            break;
        case 'split': 
            logUI(`Adding class: view-split (explicit)`);
            body.classList.add('view-split'); 
            break;
        default: 
            logUI(`Adding class: view-split (default)`);
            body.classList.add('view-split'); 
            break;
    }
    logUI(`Body classes after applyViewMode('${mode}'): ${body.className}`);
    window.dispatchEvent(new Event('resize'));
}

function applyLogVisibility(isVisible) {
    logUI(`Applying log visibility: ${isVisible}`);
    document.documentElement.setAttribute('data-log-visible', isVisible.toString());
    window.dispatchEvent(new Event('resize'));
}

function applyLogHeight(height) {
    logUI(`Applying log height: ${height}px`);
    document.documentElement.style.setProperty('--log-height', `${height}px`);
    window.dispatchEvent(new Event('resize'));
}

// --- Central State Change Handler ---
async function handleAppStateChange(newState, prevState) {
    // Determine if a change relevant to UIManager occurred
    const authChanged = newState.auth !== prevState.auth;
    const fileChanged = newState.file !== prevState.file;
    const settingsPanelChanged = newState.settingsPanel !== prevState.settingsPanel;
    
    let uiManagerSpecificUiChange = false;
    if (newState.ui !== prevState.ui) {
        if (newState.ui.isLoading !== prevState.ui?.isLoading) { // Example specific interest
            uiManagerSpecificUiChange = true;
        }
        // Add other checks for ui properties UIManager directly acts upon
    }

    const uimanagerRelevantChange = authChanged || fileChanged || settingsPanelChanged || uiManagerSpecificUiChange;

    if (uimanagerRelevantChange) {
        if (typeof window.logMessage === 'function') {
            window.logMessage(`[UIManager] handleAppStateChange processing relevant changes.`, 'debug', 'APP_STATE', 
                { auth: authChanged, file: fileChanged, settingsPanel: settingsPanelChanged, uiRelevant: uiManagerSpecificUiChange });
        } else {
            console.log(`[APP_STATE] [UIManager] Processing relevant state changes.`);
        }
    }
    // No early return here, as individual handlers below still need to process their slices if they changed.

    // --- Auth State Handling (existing logic) ---
    if (authChanged) {
        logUI(`Auth state changed: isAuthenticated=${newState.auth.isAuthenticated}, isInitializing=${newState.auth.isInitializing}`);
        // Handle FileManager initialization/reset based on auth changes
        // Only proceed if auth is no longer initializing
        if (!newState.auth.isInitializing) {
            const username = newState.auth.user?.username;
            const wasLoggedIn = prevState.auth?.isAuthenticated; // Check previous state if available
            const isLoggedIn = newState.auth.isAuthenticated;
            const isFMInitialized = newState.file?.isInitialized; // Check file state

            try {
                // Dynamically import fileManager *only when needed* for actions
                const fmModule = await import('/client/filesystem/fileManager.js');
                const fm = fmModule.default;
                if (!fm) throw new Error('fileManager default export is missing');

                if (isLoggedIn && !wasLoggedIn) { // User just logged in
                    logUI(`User logged in: ${username}. Initializing/refreshing file manager...`);
                    if (!isFMInitialized) {
                         if (typeof fm.initializeFileManager === 'function') {
                            await fm.initializeFileManager().catch(err => logUI(`FileManager initialization failed: ${err.message}`, 'error'));
                         } else {
                             logUI('initializeFileManager function not found on fileManager module', 'error');
                         }
                    } else {
                        // If already initialized (e.g., page refresh while logged in), refresh context
                        if (typeof fm.refreshFileManagerForUser === 'function') {
                             await fm.refreshFileManagerForUser(username).catch(err => logUI(`FileManager refresh for user failed: ${err.message}`, 'error'));
                             logUI('refreshFileManagerForUser awaited.');
                         } else {
                             logUI('refreshFileManagerForUser function not available on fileManager module.', 'warning');
                         }
                    }
                } else if (!isLoggedIn && wasLoggedIn) { // User just logged out
                     if (isFMInitialized) {
                         logUI('User logged out. Resetting file manager state.');
                         if (typeof fm.resetFileManagerState === 'function') {
                             fm.resetFileManagerState(); // This function now dispatches actions
                         } else {
                             logUI('resetFileManagerState function not available on fileManager module.', 'warning');
                         }
                     } else {
                          logUI('User logged out, but fileManager was not initialized. No reset needed.');
                     }
                }
            } catch (err) {
                logUI(`Critical error importing or interacting with fileManager during auth change: ${err.message}`, 'error');
            }
        }
        logUI('Auth state change handling finished.');
    }

    // --- File System State Handling ---
    if (fileChanged) {
        logUI(`File state changed. isLoading: ${newState.file.isLoading}, currentPathname: ${newState.file.currentPathname}`, 'debug');

        // Update UI components based on the new file state
        updateActionButtonsState(newState.file);
        updateBreadcrumbs(newState.file);

        // Logic previously in handleFileManagerStateSettled for showing top-level selector
        const currentAuthState = newState.auth; // Use the current auth state
        const currentUsername = currentAuthState.user?.username;
        const isLoggedIn = currentAuthState.isAuthenticated;
        const currentTopDir = newState.file.topLevelDirectory;
        const availableTopDirs = newState.file.availableTopLevelDirs;

        // Condition to show the top-level selector (e.g., logged out or specific user at root)
        const showSelectorCondition = (!isLoggedIn || currentUsername?.toLowerCase() === 'mike') && !currentTopDir && availableTopDirs.length > 0;

        if (showSelectorCondition) {
            logUI('State changed to root/selector view. Emitting ui:renderFileList to show selector.');
            // We might still need this specific event if ContextManagerComponent doesn't subscribe to the store directly yet
            eventBus.emit('ui:renderFileList');
        } else {
            logUI('State changed, standard listing/file view expected.');
            // If ContextManagerComponent subscribes, it will handle rendering the listing itself.
            // If not, you might need to emit a different event here or pass data.
            // For now, assume ContextManagerComponent will handle it via store subscription.
        }
    }

    // --- Settings Panel State Handling (Example) ---
    if (settingsPanelChanged) {
        // Update settings panel UI if needed
        logUI('Settings Panel state changed.', 'debug');
    }

    // --- UI State Handling (Example for properties uiManager itself handles like global isLoading) ---
     if (uiManagerSpecificUiChange) { 
         if (typeof window.logMessage === 'function') {
            window.logMessage(`[UIManager] Global UI properties changed (e.g., isLoading: ${newState.ui.isLoading})`, 'debug', 'APP_STATE', { isLoading: newState.ui.isLoading });
         } else {
            console.log(`[APP_STATE] [UIManager] Global UI properties changed (e.g. isLoading).`);
         }
     }
}

// --- UI Update Functions (Modified) ---
// Now accept state directly instead of the fileManager module
function updateActionButtonsState(fileState) { // Accepts file state slice
    const saveButton = document.getElementById('save-btn');
    if (!saveButton) return;

    try {
        // Use properties from the passed state object
        const isLoading = fileState?.isLoading || false;
        const isSaving = fileState?.isSaving || false;
        const fileSelected = fileState?.currentFile !== null;

        const shouldDisableSave = isLoading || isSaving || !fileSelected;
        saveButton.disabled = shouldDisableSave;
        
        // Add visual indication for saving
        if (isSaving) {
            saveButton.textContent = 'Saving...';
            saveButton.classList.add('saving'); 
        } else {
            saveButton.textContent = 'Save';
            saveButton.classList.remove('saving');
        }

        // Maybe disable other actions during loading/saving?
        // e.g., document.getElementById('new-file-btn').disabled = isLoading || isSaving;

        logUI(`Save button state updated: disabled=${shouldDisableSave}, isSaving=${isSaving}`);
    } catch (error) {
         logUI(`Error updating action buttons state: ${error?.message}`, 'error');
    }
}

function updateBreadcrumbs(fileState) { // Accepts file state slice
    if (!breadcrumbContainer) return;

    try {
        // Use properties from the passed state object
        const topLevelDir = fileState?.topLevelDirectory;
        const relativePath = fileState?.currentRelativePath;
        const currentFile = fileState?.currentFile;

        // --- Breadcrumb Generation Logic ---
        breadcrumbContainer.innerHTML = ''; // Clear existing

        // Root link (always present, navigates to top-level selection)
        const rootLink = document.createElement('span');
        rootLink.textContent = 'Root';
        rootLink.classList.add('breadcrumb-item');
        if (topLevelDir || relativePath || currentFile) {
            rootLink.classList.add('clickable');
            rootLink.onclick = () => eventBus.emit('navigate:root'); // Keep using eventBus for UI interactions -> actions
        } else {
             rootLink.classList.add('active'); // Active if currently at root
        }
        breadcrumbContainer.appendChild(rootLink);

        // Top Level Directory
        if (topLevelDir) {
            breadcrumbContainer.appendChild(document.createTextNode(' / '));
            const topDirLink = document.createElement('span');
            topDirLink.textContent = topLevelDir;
            topDirLink.classList.add('breadcrumb-item');
            if (relativePath || currentFile) {
                topDirLink.classList.add('clickable');
                // Navigate to top-level dir root
                topDirLink.onclick = () => eventBus.emit('navigate:absolute', { dir: topLevelDir, path: '', file: '' });
            } else {
                 topDirLink.classList.add('active'); // Active if this is the current view
            }
            breadcrumbContainer.appendChild(topDirLink);
        }

        // Relative Path segments
        if (relativePath) {
            const pathSegments = relativePath.split('/');
            let currentBuiltPath = '';
            pathSegments.forEach((segment, index) => {
                if (!segment) return; // Skip empty segments
                currentBuiltPath = pathJoin(currentBuiltPath, segment);
                breadcrumbContainer.appendChild(document.createTextNode(' / '));
                const segmentLink = document.createElement('span');
                segmentLink.textContent = segment;
                segmentLink.classList.add('breadcrumb-item');
                
                // If it's not the last segment OR if no file is selected, it's clickable
                if (index < pathSegments.length - 1 || !currentFile) {
                    segmentLink.classList.add('clickable');
                    // Navigate to this specific path segment
                    segmentLink.onclick = () => eventBus.emit('navigate:absolute', { dir: topLevelDir, path: currentBuiltPath, file: '' });
                } else {
                     segmentLink.classList.add('active'); // Active if it's the last part and a file is selected
                }
                breadcrumbContainer.appendChild(segmentLink);
            });
        }

        // Current File
        if (currentFile) {
            breadcrumbContainer.appendChild(document.createTextNode(' / '));
            const fileSpan = document.createElement('span');
            fileSpan.textContent = currentFile;
            fileSpan.classList.add('breadcrumb-item', 'active'); // File is always the end of the path
            breadcrumbContainer.appendChild(fileSpan);
        }
        // --- End Breadcrumb Generation ---

        logUI(`Breadcrumbs updated.`);
    } catch (error) {
        logUI(`Error updating breadcrumbs: ${error?.message}`, 'error');
        console.error("Breadcrumb update error:", error); // Log full error for debugging
    }
}

// --- Main Exported Initialization Function ---
export async function initializeUI() {
    logUI('[UI_MANAGER] Initializing UI (v_state_refactor)...'); // Updated version log

    // 1. Mount Core Components
    try {
        authDisplayComponent = createAuthDisplayComponent('auth-component-container');
        authDisplayComponent.mount();
        contextManagerComponent = createContextManagerComponent('context-manager-container');
        contextManagerComponent.mount();
        
        // Initialize ViewControls component
        try {
            const { createViewControlsComponent } = await import('/client/components/ViewControls.js');
            const viewControls = createViewControlsComponent('view-controls-container');
            if (viewControls.mount()) {
                logUI('ViewControlsComponent mounted successfully.');
            } else {
                logUI('ViewControlsComponent failed to mount.', 'error');
            }
        } catch (vcError) {
            logUI(`Failed to initialize ViewControlsComponent: ${vcError.message}`, 'error');
            console.error('[VIEW_CONTROLS ERROR]', vcError);
        }
        
        try {
            const { createContentViewComponent } = await import('/client/components/ContentView.js');
            const contentView = createContentViewComponent('content-view-wrapper');
            if (contentView.mount()) {
                window.APP = window.APP || {};
                window.APP.contentView = contentView;
                logUI('ContentViewComponent mounted successfully.');
            } else {
                logUI('ContentViewComponent failed to mount.', 'error');
            }
        } catch (cvError) {
            logUI(`Failed to initialize ContentViewComponent: ${cvError.message}`, 'error');
            console.error('[CONTENT_VIEW ERROR]', cvError);
        }
        
        logUI('Core UI components mounted.');
    } catch (e) {
        logUI(`[UI_MANAGER] Failed to mount core components: ${e.message}`, 'error');
        console.error('[BOOTSTRAP_CORE_COMPONENTS] Failed:', e);
    }

    // 2. Setup appState Subscription (Handles UI, Auth, AND File state changes)
    if (appStateUnsubscribe) appStateUnsubscribe(); 
    appStateUnsubscribe = appStore.subscribe(handleAppStateChange); // Use appStore
    logUI('[UI_MANAGER] Subscribed to appState changes.');

    // 3. Remove Event Bus Listeners for fileManager state
    // eventBus.off('fileManager:loadingStateChanged', handleLoadingStateChange); // No longer needed
    // eventBus.off('fileManager:stateSettled', handleFileManagerStateSettled); // No longer needed
    logUI('[UI_MANAGER] Removed specific fileManager event bus listeners.');

    // 4. Setup Breadcrumb Listener - Removed (handled by store subscription now)

    // 5. Apply Initial UI State from Store
    // Call the handler once with current state to set initial UI based on store
    // Pass an empty object for prevState to ensure all checks run
    await handleAppStateChange(appStore.getState(), {}); 

    logUI('[UI_MANAGER] UI Initialization complete.');
}

// --- Optional: Cleanup Function ---
export function destroyUI() {
    logUI('[UI_MANAGER] Destroying UI...');
    if (appStateUnsubscribe) {
        appStateUnsubscribe();
        appStateUnsubscribe = null;
    }
    // No fileManager listeners to remove now
    // eventBus.off('fileManager:loadingStateChanged', handleLoadingStateChange);
    // eventBus.off('fileManager:stateSettled', handleFileManagerStateSettled);
    
    // Destroy components
    authDisplayComponent?.destroy();
    contextManagerComponent?.destroy();
    // ... destroy other components ...
    
    logUI('[UI_MANAGER] UI destroyed and listeners removed.');
}

// --- Path Display Helper --- (Based on fileManager state)
function constructDisplayPath(...parts) {
    const filteredParts = parts.filter(part => part && part !== '/');
    if (filteredParts.length === 0) return '/';
    return '/' + filteredParts.join('/').replace(/\/+/g, '/');
}

// --- Exports ---
// export default uiManager;

// Removed specific exports like showSystemInfo if not needed
// export const showSystemInfo = () => uiManager.showSystemInfo(); 