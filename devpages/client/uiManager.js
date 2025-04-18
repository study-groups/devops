/**
 * uiManager.js - Manages UI updates based on state changes and events.
 * Consolidates UI initialization and state reaction logic.
 */
import { eventBus } from '/client/eventBus.js';
import { logMessage } from '/client/log/index.js';
import { appState } from '/client/appState.js';
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

// --- appState Handler for UI & Auth ---
async function handleAppStateChange(newState, prevState) {
    // --- UI Slice Handling ---
    const viewModeChanged = newState.ui?.viewMode !== prevState.ui?.viewMode;
    const logVisibleChanged = newState.ui?.logVisible !== prevState.ui?.logVisible;
    const logHeightChanged = newState.ui?.logHeight !== prevState.ui?.logHeight;

    if (viewModeChanged || logVisibleChanged || logHeightChanged) {
        logUI(`Received appState change affecting UI. Changes: viewMode=${viewModeChanged}, logVisible=${logVisibleChanged}, logHeight=${logHeightChanged}`, 'debug', newState.ui);
        if (viewModeChanged) applyViewMode(newState.ui.viewMode);
        if (logVisibleChanged) applyLogVisibility(newState.ui.logVisible);
        if (logHeightChanged) applyLogHeight(newState.ui.logHeight);
    }

    // --- Auth Slice Handling (for FileManager interaction) ---
    const authChanged = newState.auth !== prevState.auth;
    const authCheckCompleted = newState.auth.authChecked && !prevState.auth?.authChecked;
    const loginStatusChanged = authChanged && newState.auth.isLoggedIn !== prevState.auth?.isLoggedIn;

    if (authCheckCompleted || loginStatusChanged) {
        logUI(`Handling auth state change for FileManager: isLoggedIn=${newState.auth.isLoggedIn}, authChecked=${newState.auth.authChecked}`);
        const isLoggedIn = newState.auth.isLoggedIn;
        const username = newState.auth.user?.username;
        
        // Dynamically import fileManager only when needed
        let fm = null;
        try {
             const fileManagerModule = await import('/client/fileManager.js');
             fm = fileManagerModule.default;
             if (!fm) throw new Error('fileManager default export is missing');
             
             const isFMInitialized = typeof fm.getIsInitialized === 'function' && fm.getIsInitialized();

             if (isLoggedIn) {
                 if (!isFMInitialized) {
                     logUI('User is authenticated & fileManager NOT initialized. Triggering fileManager.initializeFileManager()...');
                     if (typeof fm.initializeFileManager === 'function') {
                         await fm.initializeFileManager().catch(err => logUI(`FileManager initialization failed: ${err.message}`, 'error'));
                         logUI('initializeFileManager awaited.');
                     } else {
                         logUI('initializeFileManager function not found on fileManager module', 'error');
                     }
                 } else {
                     logUI('User authenticated & fileManager WAS initialized. Triggering fileManager.refreshFileManagerForUser()...');
                     if (typeof fm.refreshFileManagerForUser === 'function') {
                         await fm.refreshFileManagerForUser(username).catch(err => logUI(`FileManager refresh for user failed: ${err.message}`, 'error'));
                         logUI('refreshFileManagerForUser awaited.');
                     } else {
                         logUI('refreshFileManagerForUser function not available on fileManager module.', 'warning');
                     }
                 }
             } else { // User logged OUT
                 if (isFMInitialized) { // Only reset if it was initialized
                     logUI('User changed to logged-out. Clearing file manager state.');
                     if (typeof fm.resetFileManagerState === 'function') {
                         fm.resetFileManagerState();
                     } else {
                         logUI('resetFileManagerState function not available on fileManager module.', 'warning');
                     }
                 } else {
                      logUI('User is logged out, but fileManager was not initialized. No reset needed.');
                 }
             }
        } catch (err) {
            logUI(`Critical error importing or interacting with fileManager during auth change: ${err.message}`, 'error');
        }
        logUI('handleAuthStateChange finished.');
    }
}

// --- Event Bus Handlers ---
async function handleFileManagerStateSettled(eventData = {}) {
    logUI('Handling fileManager:stateSettled...');
    // Dynamically import fileManager
    let fm = null;
    try {
         const fileManagerModule = await import('/client/fileManager.js');
         fm = fileManagerModule.default;
         if (!fm) throw new Error('fileManager default export is missing');
    } catch (err) {
        logUI(`Critical error importing fileManager in stateSettled: ${err.message}`, 'error');
        return; 
    }
    updateActionButtonsState(fm);
    updateBreadcrumbs(fm);
     // Add check for Mike/logged-out root state rendering
     try {
         const currentAuthState = appState.getState().auth;
         const currentUsername = currentAuthState.user?.username;
         const isLoggedIn = currentAuthState.isLoggedIn;
         const currentTopDir = typeof fm.getCurrentTopLevelDirectory === 'function' ? fm.getCurrentTopLevelDirectory() : null;
         const availableTopDirs = typeof fm.getAvailableTopLevelDirs === 'function' ? fm.getAvailableTopLevelDirs() : [];

         if ((currentUsername?.toLowerCase() === 'mike' || !isLoggedIn) && !currentTopDir && availableTopDirs.length > 0) {
             logUI('State settled for Mike/LoggedOut at root. Emitting ui:renderFileList to show selector.');
             eventBus.emit('ui:renderFileList'); 
         } else {
             logUI('State settled, standard listing expected.');
         }
     } catch (error) {
         logUI(`Error during stateSettled check for selector: ${error.message}`, 'error');
     }
}

async function handleLoadingStateChange(eventData) {
    logUI(`Event received: loadingStateChanged. isLoading=${eventData?.isLoading}, isSaving=${eventData?.isSaving}`);
    // Dynamically import fileManager
     let fm = null;
    try {
         const fileManagerModule = await import('/client/fileManager.js');
         fm = fileManagerModule.default;
         if (!fm) throw new Error('fileManager default export is missing');
    } catch (err) {
        logUI(`Critical error importing fileManager in loadingStateChanged: ${err.message}`, 'error');
        return; 
    }
    updateActionButtonsState(fm); // Pass fm
}

// --- UI Update Functions (Called by handlers) ---
function updateActionButtonsState(fm) {
    const saveButton = document.getElementById('save-btn');
    if (!saveButton || !fm) return;
    try {
        const fmLoading = typeof fm.getIsLoading === 'function' ? fm.getIsLoading() : false;
        const fileSelected = typeof fm.getCurrentFile === 'function' ? fm.getCurrentFile() : null;
        const shouldDisableSave = fmLoading || !fileSelected;
        saveButton.disabled = shouldDisableSave;
        // ... (rest of button state update logic) ...
        logUI(`Save button state updated: disabled=${shouldDisableSave}`);
    } catch (error) { /* ... error handling ... */ }
}

function updateBreadcrumbs(fm) {
    if (!breadcrumbContainer || !fm) return;
    try {
        // ... (existing breadcrumb generation logic using fm getters) ...
        logUI(`Breadcrumbs updated.`);
    } catch (error) { /* ... error handling ... */ }
}

// --- Breadcrumb Listener Setup ---
function setupBreadcrumbListener() {
    const contextManagerContainer = document.getElementById('context-manager-container');
    breadcrumbContainer = contextManagerContainer?.querySelector('.context-breadcrumbs');
    
    if (!breadcrumbContainer) {
        logUI('Breadcrumb container not found for listener setup.', 'error');
        return;
    }
    
    breadcrumbContainer.addEventListener('click', (event) => {
        const target = event.target.closest('a[href="#"]');
        if (!target) return;
        event.preventDefault();
        const targetTop = target.dataset.targetTop;
        const targetRelative = target.dataset.targetRelative;
        const targetId = target.id;
        logUI(`Breadcrumb clicked: ID='${targetId}', Top='${targetTop}', Relative='${targetRelative}'`);
        let dirToLoad;
        if (targetId === 'breadcrumb-root') {
             dirToLoad = '';
             eventBus.emit('fileManager:navigate', { dir: dirToLoad }); 
        } else if (targetTop !== undefined && targetRelative !== undefined) {
            dirToLoad = targetRelative ? `${targetTop}/${targetRelative}` : targetTop;
            eventBus.emit('fileManager:navigate', { dir: dirToLoad });
        }
    });
    logUI('Breadcrumb click listener attached.');
}

// --- Main Exported Initialization Function ---
export async function initializeUI() {
    logUI('[UI_MANAGER] Initializing UI (v_consolidated)...');

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

    // 2. Setup appState Subscription (Handles UI and Auth changes)
    if (appStateUnsubscribe) appStateUnsubscribe(); // Clear previous if any
    appStateUnsubscribe = appState.subscribe(handleAppStateChange);
    logUI('[UI_MANAGER] Subscribed to appState changes.');

    // 3. Setup Event Bus Listeners (for non-UI state events like file loading)
    eventBus.off('fileManager:loadingStateChanged', handleLoadingStateChange);
    eventBus.off('fileManager:stateSettled', handleFileManagerStateSettled);
    eventBus.on('fileManager:loadingStateChanged', handleLoadingStateChange);
    eventBus.on('fileManager:stateSettled', handleFileManagerStateSettled);
    logUI('[UI_MANAGER] Event Bus listeners attached for fileManager events.');

    // 4. Setup Breadcrumb Listener
    setupBreadcrumbListener();

    // 5. Apply Initial UI and Auth State
    // Call the handler once with current state to set initial UI and trigger initial auth check
    await handleAppStateChange(appState.getState(), {});

    logUI('[UI_MANAGER] UI Initialization complete.');
}

// --- Optional: Cleanup Function ---
export function destroyUI() {
    logUI('[UI_MANAGER] Destroying UI...');
    if (appStateUnsubscribe) {
        appStateUnsubscribe();
        appStateUnsubscribe = null;
    }
    // Unsubscribe event bus listeners?
    eventBus.off('fileManager:loadingStateChanged', handleLoadingStateChange);
    eventBus.off('fileManager:stateSettled', handleFileManagerStateSettled);
    // Destroy components
    authDisplayComponent?.destroy();
    contextManagerComponent?.destroy();
    // Remove breadcrumb listener? If container persists.
    logUI('[UI_MANAGER] UI destroyed and listeners removed.');
}

// REMOVED the UIManager class and its default export

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