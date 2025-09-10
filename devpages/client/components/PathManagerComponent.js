// client/components/ContextManagerComponent.js
// ✅ MODERNIZED: Enhanced Redux patterns with optimized selectors
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js';
import { appStore } from '/client/appState.js';
import { fileThunks } from '/client/store/slices/fileSlice.js';
import { pathThunks } from '/client/store/slices/pathSlice.js';
import { diagnoseTopDirIssue } from '/client/utils/topDirDiagnostic.js';
import { uiThunks } from '/client/store/uiSlice.js';
import { getCommonAppState, getFileState, getAuthState, getUIState } from '/client/store/enhancedSelectors.js';
import { topBarController } from './TopBarController.js';
import { apiSlice } from '/client/store/apiSlice.js';

const log = window.APP.services.log.createLogger('PathManagerComponent');

export function createPathManagerComponent(targetElementId) {
    let element = null;
    let storeUnsubscribe = null;

    // --- Component Local State ---
    let activeSiblingDropdownPath = null;
    let fetchingParentPath = null;
    let publishStatus = { isPublished: false, url: null };
    let _loadingRequested = false;
    let _lastLoggedWarning = null; // Track last warning to prevent spam

    // --- Rendering Logic ---
    const render = () => {
        if (!element) {
            console.error('[PathManager RENDER] CRITICAL: render() called but this.element is not set!', element);
            return;
        }

        if (!appStore) {
            return;
        }

        // ✅ MODERNIZED: Use enhanced selectors instead of direct state access
        const uiState = getUIState(appStore.getState());
        if (!uiState.contextManagerVisible) {
            element.style.display = 'none';
            return;
        }
        element.style.display = 'block';

        // Get auth state to check if we should show authentication-related content
        const authState = getAuthState(appStore.getState());
        
        // Guard against invalid auth state during logout
        if (!authState || typeof authState !== 'object') {
            console.warn('[PathManager] Invalid auth state, showing loading');
            element.innerHTML = `
                <div class="path-manager-loading">
                    <div class="loading-spinner"></div>
                    <span>Loading...</span>
                </div>
            `;
            return;
        }
        
        // Show loading state during auth initialization
        if (!authState.authChecked || authState.isLoading) {
            element.innerHTML = `
                <div class="path-manager-loading">
                    <div class="loading-spinner"></div>
                    <span>Checking authentication...</span>
                </div>
            `;
            return;
        }

        // Show login prompt if not authenticated - keep four-corner toggle as branding
        if (!authState.isAuthenticated) {
            element.innerHTML = `
                <div class="path-manager-auth-required" style="display: flex; align-items: center;">
                    <div id="sidebar-toggle-btn" class="sidebar-toggle" title="Login required" style="opacity: 0.5; cursor: default;">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M4 4h6v6H4V4zm8 0h6v6h-6V4zM4 14h6v6H4v-6zm8 0h6v6h-6v-6z"/>
                        </svg>
                    </div>
                    <span style="color: #6c757d; font-size: 14px; margin-left: 8px;">login required</span>
                </div>
            `;
            // Add event listener even when not authenticated (for testing)
            const sidebarToggleButton = element.querySelector('#sidebar-toggle-btn');
            if (sidebarToggleButton) {
                sidebarToggleButton.addEventListener('click', handleSidebarToggleClick);
            }
            return;
        }
        
        // ✅ MODERNIZED: Use enhanced selectors for better performance
        const pathState = appStore.getState().path || {};
        const fileState = getFileState(appStore.getState());
        const settingsStateFromStore = appStore.getState().settings || {};
        
        const selectedOrg = settingsStateFromStore?.selectedOrg || 'pixeljam-arcade';
        const settingsState = {
            currentContentSubDir: settingsStateFromStore?.currentContentSubDir || 'data',
            availableContentSubDirs: settingsStateFromStore?.availableContentSubDirs || ['data'],
            doEnvVars: settingsStateFromStore?.doEnvVars || []
        };

        // Authentication status (needed for breadcrumbs and other logic)
        const isAuthenticated = authState.isAuthenticated;
        const isPathLoading = pathState.status === 'loading';
        const isFileLoading = fileState.isLoading;
        const isOverallLoading = isPathLoading || isFileLoading;
        const isSaving = fileState.isSaving; // Use enhanced selector property
        
        const currentPathname = pathState.currentPathname || '';
        const isDirectorySelected = pathState.isDirectorySelected;
        
        const user = authState.user;
        const username = user?.username;

        const selectedDirectoryPath = isDirectorySelected ? currentPathname : getParentPath(currentPathname);
        const selectedFilename = isDirectorySelected ? null : getFilename(currentPathname);

        // Debug path matching
        console.log('[PATHXXX] PathManager render - Debug path matching:', {
            currentPathname,
            isDirectorySelected,
            selectedDirectoryPath,
            selectedFilename,
            currentListingPathname: pathState.currentListing?.pathname,
            currentListingDirs: pathState.currentListing?.dirs?.length || 0,
            currentListingFiles: pathState.currentListing?.files?.length || 0,
            listingForSelectorWillBeNull: !pathState.currentListing || pathState.currentListing.pathname !== selectedDirectoryPath
        });

        // Handle path matching with normalization for root paths
        let listingForSelector = null;
        if (pathState.currentListing) {
            const currentListingPath = pathState.currentListing.pathname;
            const normalizedCurrentPath = currentListingPath === null || currentListingPath === '' ? '/' : currentListingPath;
            const normalizedSelectedPath = selectedDirectoryPath === null || selectedDirectoryPath === '' ? '/' : selectedDirectoryPath;
            
            console.log('[PATHXXX] PathManager render - Path normalization:', {
                originalCurrentPath: currentListingPath,
                normalizedCurrentPath,
                originalSelectedPath: selectedDirectoryPath,
                normalizedSelectedPath,
                pathsMatch: normalizedCurrentPath === normalizedSelectedPath
            });
            
            if (normalizedCurrentPath === normalizedSelectedPath) {
                listingForSelector = pathState.currentListing;
            }
        }
        
        // If we're viewing a file but don't have the parent directory listing, load it
        if (!isDirectorySelected && selectedDirectoryPath && !listingForSelector && isAuthenticated) {
            console.log(`[PATHXXX] PathManager render - Missing parent directory listing for '${selectedDirectoryPath}', loading...`);
            // Use a timeout to avoid infinite re-renders
            setTimeout(() => {
                console.log(`[PATHXXX] PathManager render - Dispatching getDirectoryListing for: '${selectedDirectoryPath}'`);
                // Only fetch the directory listing, don't change the current path
                appStore.dispatch(apiSlice.endpoints.getDirectoryListing.initiate(selectedDirectoryPath));
            }, 0);
        }

        const CONTENT_ROOT_PREFIX = '/root/pj/pd/data/';
        
        // Generate breadcrumbs for the selected DIRECTORY path
        const breadcrumbsHTML = generateBreadcrumbsHTML(
            selectedDirectoryPath,
            selectedOrg, 
            username,
            isAuthenticated
        );

        // Generate primary selector
        let primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading...</option></select>`;
        
        // Check for path errors and show appropriate message
        const pathError = pathState.error;
        if (pathError && pathState.status === 'failed') {
            console.warn('[PathManager] Path error detected:', pathError);
            primarySelectorHTML = `<select class="context-selector" title="Error loading directory" disabled><option>Error: ${pathError}</option></select>`;
        }
        
        if (isAuthenticated && selectedDirectoryPath !== null && selectedDirectoryPath !== '') {
            if (listingForSelector) {
                const dirs = listingForSelector.dirs || [];
                const files = listingForSelector.files || [];
                
                const items = [
                    ...dirs.map(name => ({ name, type: 'dir' })),
                    ...files.map(name => ({ name, type: 'file' }))
                ].sort((a, b) => {
                    if (a.type !== b.type) { return a.type === 'dir' ? -1 : 1; }
                    return a.name.localeCompare(b.name);
                });

                let optionsHTML = `<option value="" selected disabled>Select item...</option>`;
                
                const parentOfSelectedDir = getParentPath(selectedDirectoryPath);
                if (parentOfSelectedDir !== null && parentOfSelectedDir !== undefined) {
                    optionsHTML += `<option value=".." data-type="parent" data-parent-path="${parentOfSelectedDir}">..</option>`;
                }
                
                items.forEach(item => {
                    const displayName = item.type === 'dir' ? `${item.name}/` : item.name;
                    const isSelected = item.type === 'file' && item.name === selectedFilename;
                    optionsHTML += `<option value="${item.name}" data-type="${item.type}" ${isSelected ? 'selected' : ''}>${displayName}</option>`;
                });
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Directory or File">${optionsHTML}</select>`;
            } else {
                // No listing available for the selected path, so show a loading or empty state.
                let optionsHTML = `<option value="" selected disabled>Loading items...</option>`;
                const parentOfSelectedDir = getParentPath(selectedDirectoryPath);
                if (parentOfSelectedDir !== null && parentOfSelectedDir !== undefined) {
                    optionsHTML += `<option value=".." data-type="parent" data-parent-path="${parentOfSelectedDir}">..</option>`;
                }
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Directory or File" disabled>${optionsHTML}</select>`;
            }
        } else if (!isAuthenticated) {
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Login Required</option></select>`;
        } else if (isAuthenticated && (selectedDirectoryPath === null || selectedDirectoryPath === '')) {
            // Use the established window.APP convention 
            const topLevelDirs = pathState.topLevelDirs || [];
            
            console.log(`[PATHXXX] PathManager render - Root directory case:`, {
                topLevelDirsCount: topLevelDirs.length,
                pathStatus: pathState.status,
                topLevelDirs
            });
            
            if (pathState.status === 'loading') {
                primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading directories...</option></select>`;
            } else if (topLevelDirs.length > 0) {
                let optionsHTML = `<option value="" selected disabled>Select base directory...</option>`;
                topLevelDirs.forEach(dirName => {
                    optionsHTML += `<option value="${dirName}" data-type="dir">${dirName}/</option>`;
                });
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Base Directory">${optionsHTML}</select>`;
            } else {
                // If we have no top-level directories and we're authenticated, try to load them
                console.log(`[PATHXXX] PathManager render - No top-level directories found, attempting to load...`);
                setTimeout(() => {
                    console.log(`[PATHXXX] PathManager render - Dispatching loadTopLevelDirectories`);
                    appStore.dispatch(pathThunks.loadTopLevelDirectories());
                }, 0);
                primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading directories...</option></select>`;
            }
        } else {
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Unexpected state</option></select>`;
        }

        const isFileModified = fileState.currentFile?.isModified || false;
        const saveDisabled = !isAuthenticated || isOverallLoading || isSaving || selectedFilename === null || !isFileModified;

        // Simplified layout: Breadcrumbs, then the selection row with buttons immediately adjacent
        element.innerHTML = `
            <div class="context-path-and-file-wrapper" style="display: flex !important; align-items: center !important; gap: 8px; flex-wrap: nowrap !important; width: 100%; box-sizing: border-box;">
                <div id="file-browser-toggle-btn" class="sidebar-toggle" title="Toggle File Browser" style="flex-shrink: 0 !important; display: inline-flex !important; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M4 4h6v6H4V4zm8 0h6v6h-6V4zM4 14h6v6H4v-6zm8 0h6v6h-6v-6z"/>
                    </svg>
                </div>
                <div class="context-breadcrumbs" style="display: inline-flex !important; align-items: center;">${breadcrumbsHTML}</div>
                <div>${primarySelectorHTML}</div>
                <button id="save-btn" data-action="saveFile" title="Save Current File" ${saveDisabled ? 'disabled' : ''} style="flex-shrink: 0;">${isSaving ? 'Saving...' : 'Save'}</button>
                <button id="publish-btn" title="Publish File" ${selectedFilename === null ? 'disabled' : ''} style="flex-shrink: 0;">Publish</button>
                <button id="note-btn" title="Add to Context for Cursor AI" ${selectedFilename === null ? 'disabled' : ''} class="note-button" style="flex-shrink: 0;">Note</button>
                <div style="flex: 1;"></div>
            </div>
            <select id="file-select" style="display: none;"><option value="">Hidden compatibility element</option></select>
        `;

        // --- Attach Event Listeners (FIXED: No need to remove from fresh DOM elements) ---
        const primarySelectElement = element.querySelector('#context-primary-select');
        if (primarySelectElement) {
            primarySelectElement.addEventListener('change', handlePrimarySelectChange);
        }
        
        // Save button is handled by TopBarController - no need for separate handler

        // --- Breadcrumb Navigation Event Listener ---
        const breadcrumbContainer = element.querySelector('.context-breadcrumbs');
        if (breadcrumbContainer) {
            breadcrumbContainer.addEventListener('click', handleBreadcrumbClick);
        } else {
            log.error('RENDER', 'BREADCRUMB_CONTAINER_NOT_FOUND', 'Breadcrumb container element not found in DOM.');
        }

        // Add event listener for the filename input if you want interaction
        const filenameInputElement = element.querySelector('.selected-filename-input');
        if (filenameInputElement && !filenameInputElement.disabled) {
            // filenameInputElement.removeEventListener('focus', handleFilenameFocus);
            // filenameInputElement.addEventListener('focus', handleFilenameFocus);
            // filenameInputElement.removeEventListener('click', handleFilenameClick);
            // filenameInputElement.addEventListener('click', handleFilenameClick);
        }

        // Add Note button event listener
        const noteButton = element.querySelector('#note-btn');
        if (noteButton) {
            noteButton.addEventListener('click', handleNoteButtonClick);
        }

        // Sidebar toggle button event listener - keep the branded four boxes
        const fileBrowserToggleButton = element.querySelector('#file-browser-toggle-btn');
        if (fileBrowserToggleButton) {
            fileBrowserToggleButton.addEventListener('click', handleFileBrowserToggleClick);
        }

        // Initialize TopBarController for save button and other actions
        if (!topBarController.initialized) {
            topBarController.initialize();
        }
    };

    // --- Breadcrumb Generation Function ---
    const generateBreadcrumbsHTML = (selectedDirectoryPath, selectedOrg, username, isAuthenticated) => {
        let breadcrumbHTML = '';
        
        // Settings trigger (/) - now navigates to root
        breadcrumbHTML += `
            <span id="context-settings-trigger"
                  class="breadcrumb-item breadcrumb-separator root-settings-trigger clickable"
                  title="Navigate to Root | Current Org: ${selectedOrg}">
                /
                <div class="technical-info-tooltip">
                    <strong>Context Information:</strong><br>
                    <code>User:</code> ${username || 'Not logged in'}<br>
                    <code>Org:</code> ${selectedOrg}<br>
                    <small>Click to navigate to the root directory</small>
                </div>
            </span>`;

        if (isAuthenticated && selectedDirectoryPath) {
            const pathSegments = selectedDirectoryPath.split('/').filter(segment => segment);
            let currentBuiltPath = '';
            
            pathSegments.forEach((segment, index) => {
                currentBuiltPath = pathJoin(currentBuiltPath, segment); 
                const classes = `breadcrumb-item clickable`;
                const segmentSpanHTML = `
                        <span class="${classes}" 
                              data-navigate-path="${currentBuiltPath}"
                              data-is-directory="true"
                              title="Navigate to ${currentBuiltPath}/">
                            ${segment}
                        </span>`;

                if (index === 0) {
                    breadcrumbHTML += ' ' + segmentSpanHTML;
                } else {
                    breadcrumbHTML += ' / ' + segmentSpanHTML;
                }
            });
        } else if (!isAuthenticated) {
            breadcrumbHTML += ` <span class="breadcrumb-item" style="color: #6c757d; font-style: italic;">Login Required</span>`;
        }
        return breadcrumbHTML;
    };

    // --- Event Handlers ---
    
    // Hybrid breadcrumb navigation handler
    const handleBreadcrumbClick = (event) => {
        event.alreadyHandled = true;
        event.preventDefault();
        event.stopPropagation();
        const target = event.target.closest('.clickable'); // Find the nearest clickable parent
        if (!target) return;
        
        // Handle root breadcrumb click (navigates to top-level dirs)
        if (target.id === 'context-settings-trigger') {
            console.log(`[PATHXXX] PathManager handleBreadcrumbClick - Navigating to root`);
            log.info('BREADCRUMB', 'NAVIGATE_ROOT', 'Breadcrumb navigation to root.');
            appStore.dispatch(pathThunks.navigateToPath({ pathname: '', isDirectory: true }));
            return;
        }
        
        // Handle other path navigation clicks
        if (target.hasAttribute('data-navigate-path')) {
            const pathname = target.dataset.navigatePath;
            console.log(`[PATHXXX] PathManager handleBreadcrumbClick - Navigating to path: '${pathname}'`);
            log.info('BREADCRUMB', 'NAVIGATE', `Breadcrumb navigation: '${pathname}'`);
            appStore.dispatch(pathThunks.navigateToPath({ pathname, isDirectory: true }));
        }
    };

    const handlePrimarySelectChange = async (event) => {
        event.alreadyHandled = true;
        event.preventDefault();
        event.stopPropagation();
        const selectedOption = event.target.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) return;

        const selectedValue = selectedOption.value;
        const selectedType = selectedOption.dataset.type;

        const pathState = appStore.getState().path;
        const currentPathname = pathState.currentPathname;
        const isDirectorySelected = pathState.isDirectorySelected;

        // Determine current directory for building new paths
        let currentDirectory = null;
        
        // Debug current state
        console.log('[PATHXXX] PathManager handlePrimarySelectChange - Navigation debug:', {
            currentPathname,
            isDirectorySelected,
            selectedValue,
            selectedType
        });
        
        // Handle root directory case first
        if (currentPathname === '' || currentPathname === null) {
            currentDirectory = '';
        } else {
            currentDirectory = isDirectorySelected ? currentPathname : getParentPath(currentPathname);
        }
        
        // Final validation
        if (currentDirectory === null || currentDirectory === undefined) {
            currentDirectory = '';
        }
        
        console.log('[PATHXXX] PathManager handlePrimarySelectChange - Path building:', {
            currentDirectory,
            selectedValue,
            willBecomeNewPath: pathJoin(currentDirectory, selectedValue)
        });

        // Handle parent directory navigation
        if (selectedType === 'parent') {
            const parentPath = selectedOption.dataset.parentPath;
            console.log(`[PATHXXX] PathManager handlePrimarySelectChange - Navigating to parent directory: '${parentPath}'`);
            log.info('SELECT', 'NAVIGATE_PARENT', `Navigating to parent directory: '${parentPath}'`);
            appStore.dispatch(pathThunks.navigateToPath({ pathname: parentPath, isDirectory: true }));
            return;
        }

        const newRelativePath = pathJoin(currentDirectory, selectedValue);
        log.info('SELECT', 'PRIMARY_SELECT_CHANGE', `Primary select change: Base Dir='${currentDirectory}', Selected='${selectedValue}', Type='${selectedType}', New Path='${newRelativePath}'`);

        // Primary navigation uses the new thunk
        if (selectedType === 'dir') {
            console.log(`[PATHXXX] PathManager handlePrimarySelectChange - Navigating to directory: '${newRelativePath}'`);
            appStore.dispatch(pathThunks.navigateToPath({ pathname: newRelativePath, isDirectory: true }));
        } else if (selectedType === 'file') {
            console.log(`[PATHXXX] PathManager handlePrimarySelectChange - Navigating to file: '${newRelativePath}'`);
            appStore.dispatch(pathThunks.navigateToPath({ pathname: newRelativePath, isDirectory: false }));
        }
    };

    // Save button handler moved to TopBarController for unified handling

    // DEPRECATED: handleRootBreadcrumbClick and handleSettingsClick are no longer used.
    // The main handleBreadcrumbClick now manages all breadcrumb interactions.

    const handleNoteButtonClick = async (event) => {
        event.alreadyHandled = true;
        event.preventDefault();
        event.stopPropagation();
        log.info('NOTE', 'BUTTON_CLICK', 'Note button clicked - adding to context');
        
        let originalText;
        const noteBtn = event.target;

        try {
            const state = appStore.getState();
            const pathState = state.path;
            const contextName = state.context?.activeContext || 'default'; // Get active context

            if (pathState.isDirectorySelected || !pathState.currentPathname) {
                log.warn('NOTE', 'NO_FILE_SELECTED', 'Cannot add note: No file selected or directory view.');
                alert('Please select a file to add to context.');
                return;
            }

            // Use a more robust selector to find the editor instance
            const editor = document.querySelector('#md-editor textarea, #editor-container textarea, textarea');
            if (!editor) {
                log.error('NOTE', 'EDITOR_NOT_FOUND', 'Editor element not found.');
                alert('Could not find the editor content.');
                return;
            }

            const markdownContent = editor.value;
            const pathname = pathState.currentPathname;
            
            originalText = noteBtn.textContent;
            noteBtn.textContent = 'Adding...';
            noteBtn.disabled = true;

            const response = await fetch('/api/publish/context', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'credentials': 'include'
                },
                body: JSON.stringify({
                    pathname,
                    contextName: contextName,
                    markdownContent,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(errorData.error || `Server responded with ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                noteBtn.classList.add('noted');
                noteBtn.title = `Added to context: ${contextName}`;
                log.info('NOTE', 'ADD_SUCCESS', `Successfully added '${pathname}' to context '${contextName}'.`);
            } else {
                throw new Error(result.error || 'The server reported an issue, but did not provide an error message.');
            }

        } catch (error) {
            log.error('NOTE', 'HANDLER_ERROR', `Error in note button handler: ${error.message}`, error);
            console.error('[PathManager] Note button error:', error);
            alert(`Failed to add note to context: ${error.message}`);
        } finally {
            if (noteBtn) {
                // Return to original state after a delay to show "noted" status
                setTimeout(() => {
                    noteBtn.textContent = originalText;
                    noteBtn.disabled = false;
                    noteBtn.classList.remove('noted');
                    noteBtn.title = 'Add to Context for Cursor AI';
                }, 2000);
            }
        }
    };

    const handleSidebarToggleClick = (e) => {
        // Mark event as handled to prevent TopBarController from also handling it
        if (e) {
            e.alreadyHandled = true;
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Use Redux store instead of deprecated WorkspaceManager
        appStore.dispatch(uiThunks.toggleLeftSidebar());
    };

    // Alias for consistency - both buttons do the same thing
    const handleFileBrowserToggleClick = handleSidebarToggleClick;

    // --- Component Lifecycle ---
    const mount = () => {
        console.log(`[PATHXXX] PathManager mount - Starting initialization for targetElementId: ${targetElementId}`);
        log.info('MOUNT', 'START', `Mount_CM: Initializing for targetElementId: ${targetElementId}`);

        element = document.getElementById(targetElementId);
        if (!element) {
            console.error(`[PATHXXX] PathManager mount - Target element #${targetElementId} not found`);
            log.error('MOUNT', 'TARGET_NOT_FOUND', `Mount_CM FAILED: Target element with ID '${targetElementId}' not found in DOM.`);
            console.error(`[ContextManagerComponent] Mount failed: target element #${targetElementId} not found.`);
            return;
        }
        console.log(`[PATHXXX] PathManager mount - Target element found`);
        log.info('MOUNT', 'TARGET_FOUND', 'Mount_CM: Target element found.');

        if (storeUnsubscribe) {
            storeUnsubscribe();
            log.debug('MOUNT', 'UNSUBSCRIBE_EXISTING', 'Mount_CM: Existing store subscription found and removed.');
        }

        storeUnsubscribe = appStore.subscribe(() => {
            try {
                // Guard against invalid state during logout
                const state = appStore.getState();
                if (!state || typeof state !== 'object') {
                    console.warn('[PATHXXX] PathManager subscription - Invalid state during subscription update, skipping render');
                    return;
                }
                render();
            } catch (error) {
                console.error('[PATHXXX] PathManager subscription - Error in store subscription:', error);
            }
        });
        console.log(`[PATHXXX] PathManager mount - Subscribed to appStore changes`);
        log.info('MOUNT', 'SUBSCRIBE_SUCCESS', 'Mount_CM: Subscribed to appStore changes.');
        
        // URL parameter handling is done by the bootloader, so we don't need to duplicate it here
        // Just log the current state for debugging
        const currentState = appStore.getState();
        const currentPathname = currentState.path?.currentPathname;
        const authState = currentState.auth;
        
        console.log(`[PATHXXX] PathManager mount - Current state on mount:`, {
            currentPathname,
            isAuthenticated: authState?.isAuthenticated,
            authChecked: authState?.authChecked,
            pathStatus: currentState.path?.status
        });
        
        // No need for navigate:pathname listener - we'll use direct actions
        log.info('MOUNT', 'DIRECT_ACTIONS', 'Mount_CM: Using direct file system actions.');
        
        // Initial render
        console.log(`[PATHXXX] PathManager mount - Calling initial render`);
        log.info('MOUNT', 'INITIAL_RENDER', 'Mount_CM: Calling initial render.');
        render();
        console.log(`[PATHXXX] PathManager mount - Initial render complete`);
        log.info('MOUNT', 'INITIAL_RENDER_COMPLETE', 'Mount_CM: Initial render complete.');
    };

    const destroy = () => {
        log.info('DESTROY', 'START', `Destroying component and unsubscribing...`);
        if (storeUnsubscribe) {
            storeUnsubscribe();
            storeUnsubscribe = null;
        }
        if (element) {
            const primarySelect = element.querySelector('#context-primary-select');
            if (primarySelect) primarySelect.removeEventListener('change', handlePrimarySelectChange);
            // Save button cleanup handled by TopBarController
            const publishBtn = element.querySelector('#publish-btn');
            if (publishBtn) publishBtn.removeEventListener('click', handlePublishButtonClick);
            const breadcrumbContainer = element.querySelector('.context-breadcrumbs');
            if (breadcrumbContainer) breadcrumbContainer.removeEventListener('click', handleBreadcrumbClick);

            log.info('DESTROY', 'LISTENERS_REMOVED', `Listeners removed from element during destroy.`);
        }
        element = null;
        log.info('DESTROY', 'COMPLETE', 'Component destroyed.');
    };

    return { mount, destroy };
}