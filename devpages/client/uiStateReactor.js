/**
 * uiManager.js - Manages UI updates based on state changes and events.
 * Consolidates UI initialization and state reaction logic.
 */
import { eventBus } from '/client/eventBus.js';
import { logMessage } from '/client/log/index.js';
import { appStore } from '/client/appState.js';
import { createAuthDisplayComponent } from '/client/components/AuthDisplay.js';
import { createPathManagerComponent } from '/client/components/PathManagerComponent.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('uiStateReactor');

// --- Module State ---
let appStateUnsubscribe = null;
let lastKnownState = {};
let authDisplayComponent = null;
let pathManagerComponent = null;
let sidebarPathManagerComponent = null; // New sidebar instance
let breadcrumbContainer = null; // Keep reference for listener
// Panel management now handled by WorkspaceLayoutManager and PanelManager

// --- UI Applying Functions ---
function applyViewMode(mode) {
    log.info('UI', 'APPLY_VIEW_MODE', `Applying view mode: ${mode}`);
    const body = document.body;
    log.debug('UI', 'APPLY_VIEW_MODE_BEFORE', `Body classes BEFORE remove: ${body.className}`);
    body.classList.remove('view-code', 'view-preview', 'view-split', 'view-blank');
    log.debug('UI', 'APPLY_VIEW_MODE_AFTER', `Body classes AFTER remove: ${body.className}`);
    switch (mode) {
        case 'editor': 
            log.debug('UI', 'APPLY_VIEW_MODE_ADD', `Adding class: view-code`);
            body.classList.add('view-code'); 
            break;
        case 'preview': 
            log.debug('UI', 'APPLY_VIEW_MODE_ADD', `Adding class: view-preview`);
            body.classList.add('view-preview'); 
            break;
        case 'split': 
            log.debug('UI', 'APPLY_VIEW_MODE_ADD', `Adding class: view-split`);
            body.classList.add('view-split'); 
            break;
        case 'blank':
            log.debug('UI', 'APPLY_VIEW_MODE_ADD', `Adding class: view-blank`);
            body.classList.add('view-blank');
            break;
        default: 
            log.warn('UI', 'APPLY_VIEW_MODE_UNKNOWN', `Unknown view mode '${mode}', defaulting to split view.`);
            body.classList.add('view-split'); 
            break;
    }
    log.info('UI', 'APPLY_VIEW_MODE_FINAL', `Body classes after applyViewMode('${mode}'): ${body.className}`);
    window.dispatchEvent(new Event('resize'));
}

function applyLogVisibility(isVisible) {
    log.info('UI', 'APPLY_LOG_VISIBILITY', `Applying log visibility: ${isVisible}`);
    document.documentElement.setAttribute('data-log-visible', isVisible.toString());
    window.dispatchEvent(new Event('resize'));
}

function applyLogHeight(height) {
    log.info('UI', 'APPLY_LOG_HEIGHT', `Applying log height: ${height}px`);
    document.documentElement.style.setProperty('--log-height', `${height}px`);
    window.dispatchEvent(new Event('resize'));
}

// --- Central State Change Handler ---
function init() {
    let prevState = appStore.getState(); // Initialize previous state
    appStateUnsubscribe = appStore.subscribe(() => {
        const newState = appStore.getState();
        handleAppStateChange(newState, prevState);
        prevState = newState; // Update previous state
    });

    // Initial state handling
    handleAppStateChange(appStore.getState(), {});
}

function handleAppStateChange(newState, prevState) {
    if (!prevState) return; // Guard against initial undefined state
    // Determine if a change relevant to UIManager occurred
    const authChanged = newState.auth !== prevState.auth;
    const fileChanged = newState.file !== prevState.file;
    const settingsPanelChanged = newState.settingsPanel !== prevState.settingsPanel;
    
    let uiManagerSpecificUiChange = false;
    if (newState.ui !== prevState.ui) {
        if (newState.ui.isLoading !== prevState.ui?.isLoading) { // Example specific interest
            uiManagerSpecificUiChange = true;
        }
        // ADDED: Handle viewMode changes for body class application
        if (newState.ui.viewMode !== prevState.ui?.viewMode) {
            uiManagerSpecificUiChange = true;
            log.info('UI', 'VIEW_MODE_CHANGED', `View mode changed from '${prevState.ui?.viewMode}' to '${newState.ui.viewMode}'`);
            applyViewMode(newState.ui.viewMode);
        }
        // Add other checks for ui properties UIManager directly acts upon
    }

    const uimanagerRelevantChange = authChanged || fileChanged || settingsPanelChanged || uiManagerSpecificUiChange;

    if (uimanagerRelevantChange) {
        log.debug('UI', 'STATE_CHANGE_RELEVANT', `handleAppStateChange processing relevant changes.`, 
            { auth: authChanged, file: fileChanged, settingsPanel: settingsPanelChanged, uiRelevant: uiManagerSpecificUiChange });
    }
    // No early return here, as individual handlers below still need to process their slices if they changed.

    // --- Auth State Handling (existing logic) ---
    if (authChanged) {
        log.info('UI', 'AUTH_STATE_CHANGED', `Auth state changed: isAuthenticated=${newState.auth.isAuthenticated}, isInitializing=${newState.auth.isInitializing}`);
        // The fileManager now listens for auth changes internally.
        // The uiManager's responsibility is just to react to UI-related state, not to orchestrate other modules.
        // All logic for calling initializeFileManager, refreshFileManagerForUser, or resetFileManagerState has been removed.
        log.info('UI', 'AUTH_STATE_HANDLED', 'Auth state change handling finished.');
    }

    // --- File System State Handling ---
    if (fileChanged) {
        // Only log and react to STRUCTURAL file changes, not content changes
        const structuralChange = (
            newState.file.currentPathname !== prevState.file?.currentPathname ||
            newState.file.isDirectorySelected !== prevState.file?.isDirectorySelected ||
            newState.file.isLoading !== prevState.file?.isLoading ||
            newState.file.currentListing !== prevState.file?.currentListing ||
            newState.file.availableTopLevelDirs !== prevState.file?.availableTopLevelDirs
        );
        
        // Don't react to content-only changes (from typing in editor)
        if (!structuralChange) {
            // Skip updating UI for content-only changes
            return;
        }
        
        log.info('UI', 'FILE_STATE_CHANGED', `File state changed structurally. isLoading: ${newState.file.isLoading}, currentPathname: ${newState.file.currentPathname}`);

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
            log.info('UI', 'RENDER_FILE_LIST', 'State changed to root/selector view. Emitting ui:renderFileList to show selector.');
            // We might still need this specific event if PathManagerComponent doesn't subscribe to the store directly yet
            eventBus.emit('ui:renderFileList');
        } else {
            log.info('UI', 'STANDARD_LISTING_VIEW', 'State changed, standard listing/file view expected.');
            // If PathManagerComponent subscribes, it will handle rendering the listing itself.
            // If not, you might need to emit a different event here or pass data.
            // For now, assume PathManagerComponent will handle it via store subscription.
        }
    }

    // --- Settings Panel State Handling (Example) ---
    if (settingsPanelChanged) {
        // Update settings panel UI if needed
        log.debug('UI', 'SETTINGS_PANEL_STATE_CHANGED', 'Settings Panel state changed.');
    }

    // --- UI State Handling (Example for properties uiManager itself handles like global isLoading) ---
     if (uiManagerSpecificUiChange) { 
        log.debug('UI', 'GLOBAL_UI_PROPERTIES_CHANGED', `Global UI properties changed (e.g., isLoading: ${newState.ui.isLoading})`, { isLoading: newState.ui.isLoading });
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

        log.debug('UI', 'SAVE_BUTTON_STATE_UPDATED', `Save button state updated: disabled=${shouldDisableSave}, isSaving=${isSaving}`);
    } catch (error) {
         log.error('UI', 'UPDATE_ACTION_BUTTONS_ERROR', `Error updating action buttons state: ${error?.message}`, error);
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

        log.debug('UI', 'BREADCRUMBS_UPDATED', `Breadcrumbs updated.`);
    } catch (error) {
        log.error('UI', 'UPDATE_BREADCRUMBS_ERROR', `Error updating breadcrumbs: ${error?.message}`, error);
        console.error("Breadcrumb update error:", error); // Log full error for debugging
    }
}

// --- Lifecycle Functions ---
/**
 * Subscribes the UIManager to the central app state.
 * This is called from bootstrap.js after all components are mounted.
 */
export function subscribeUIManager() {
    if (appStateUnsubscribe) {
        log.warn('UI', 'ALREADY_SUBSCRIBED', 'UIManager is already subscribed. Skipping.');
        return;
    }
    log.info('UI', 'SUBSCRIBING', 'Subscribing UIManager to app state changes...');
    init(); // Call init to set up the subscription
}

/**
 * Unsubscribes the UIManager from the central app state.
 */
export function unsubscribeUIManager() {
    if (appStateUnsubscribe) {
        appStateUnsubscribe();
        appStateUnsubscribe = null;
        log.info('UI', 'UNSUBSCRIBED', 'UIManager unsubscribed from app state changes.');
    }
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