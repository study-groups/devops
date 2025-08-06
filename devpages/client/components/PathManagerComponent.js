// client/components/ContextManagerComponent.js
// Standardized Redux store access
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js';
import { appStore } from '/client/appState.js';
import { fileThunks } from '/client/thunks/fileThunks.js';
import { diagnoseTopDirIssue } from '/client/utils/topDirDiagnostic.js';

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
            log.error('RENDER', 'ELEMENT_NULL', 'Render SKIPPED: component "element" is null or undefined.');
            console.error('[PathManager RENDER] CRITICAL: render() called but this.element is not set!', element);
            return;
        }

        if (!appStore) {
            log.error('RENDER', 'STORE_UNAVAILABLE', 'CRITICAL: appStore not available in render!');
            return;
        }

        const uiState = appStore.getState().ui || {};
        if (!uiState.contextManagerVisible) {
            element.style.display = 'none';
            return;
        }
        element.style.display = 'block';


        // Get auth state to check if we should show authentication-related content
        const authState = appStore.getState().auth || {};
        
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
        
        // Now we know we're authenticated, get all necessary state
        const pathState = appStore.getState().path || {};
        const fileState = appStore.getState().file || {};
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
        const isFileLoading = fileState.status === 'loading';
        const isOverallLoading = isPathLoading || isFileLoading;
        const isSaving = fileState.status === 'saving'; // Correctly check file state for saving status
        
        const currentPathname = pathState.currentPathname || '';
        const isDirectorySelected = pathState.isDirectorySelected;
        
        const user = authState.user;
        const username = user?.username;

        const selectedDirectoryPath = isDirectorySelected ? currentPathname : getParentPath(currentPathname);
        const selectedFilename = isDirectorySelected ? null : getFilename(currentPathname);

        const listingForSelector = pathState.currentListing?.pathname === selectedDirectoryPath ? pathState.currentListing : null;

        const CONTENT_ROOT_PREFIX = '/root/pj/pd/data/';
        // Reduced verbosity - only log when needed
        // log.debug('RENDER', 'STATIC_CONTENT_ROOT', `Using STATIC CONTENT_ROOT_PREFIX for test: '${CONTENT_ROOT_PREFIX}'`);

        // Reduced verbosity - combine state logging into fewer entries
        // log.debug('RENDER', 'STATE_SNAPSHOT', `State Snapshot - Relative Pathname: '${currentPathname}', isDirectorySelected: ${isDirectorySelected}`);
        // log.debug('RENDER', 'AUTH_SNAPSHOT', `State Snapshot - Auth: User='${username}', Role=${userRole}, Org=${selectedOrg}`);
        // log.debug('RENDER', 'COMPONENT_STATE', `Component State - activeSiblingDropdownPath: ${activeSiblingDropdownPath}, fetchingParentPath: ${fetchingParentPath}`);
        // log.debug('RENDER', 'DERIVED_STATE', `Derived - selectedDirectoryPath: '${selectedDirectoryPath}', selectedFilename: '${selectedFilename}'`);

        // Removed verbose debug block - only log when there are issues
        // log.debug('RENDER', 'DEBUG_INFO_START', '=== RENDER DEBUG INFO ===');
        // log.debug('RENDER', 'IS_AUTHENTICATED', `isAuthenticated: ${isAuthenticated}`);
        // log.debug('RENDER', 'SELECTED_DIRECTORY_PATH', `selectedDirectoryPath: '${selectedDirectoryPath}'`);
        // log.debug('RENDER', 'CURRENT_PATHNAME', `currentPathname: '${currentPathname}'`);
        // log.debug('RENDER', 'IS_DIRECTORY_SELECTED', `isDirectorySelected: ${isDirectorySelected}`);
        // log.debug('RENDER', 'CURRENT_LISTING_PATHNAME', `currentListing.pathname: '${pathState.currentListing?.pathname}'`);
        // log.debug('RENDER', 'CURRENT_LISTING_DIRS', `currentListing.dirs: [${(pathState.currentListing?.dirs || []).join(', ')}]`);
        // log.debug('RENDER', 'CURRENT_LISTING_FILES', `currentListing.files: [${(pathState.currentListing?.files || []).join(', ')}]`);
        // log.debug('RENDER', 'IS_OVERALL_LOADING', `isOverallLoading: ${isOverallLoading}`);
        // log.debug('RENDER', 'AVAILABLE_TOP_LEVEL_DIRS', `availableTopLevelDirs: [${(pathState.availableTopLevelDirs || []).join(', ')}]`);
        // log.debug('RENDER', 'DEBUG_INFO_END', '=== END RENDER DEBUG ===');

        // Generate breadcrumbs for the selected DIRECTORY path
        const breadcrumbsHTML = generateBreadcrumbsHTML(
            selectedDirectoryPath,
            selectedOrg, 
            username,
            isAuthenticated
        );

        // CRITICAL DEBUG - Before primary selector logic
        // log.debug('RENDER', 'ABOUT_TO_GENERATE_PRIMARY_SELECTOR', 'About to generate primary selector:', {
        //     isAuthenticated,
        //     selectedDirectoryPath,
        //     pathLogic: `isAuthenticated=${isAuthenticated} && selectedDirectoryPath=${selectedDirectoryPath} (null or empty = ${selectedDirectoryPath === null || selectedDirectoryPath === ''})`
        // });
        
        // Generate primary selector
        let primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading...</option></select>`;
        
        if (isAuthenticated && selectedDirectoryPath !== null && selectedDirectoryPath !== '') {
            // log.debug('RENDER', 'BRANCH_1', 'Directory path exists:', selectedDirectoryPath);
            const listingForSelector = pathState.currentListing?.pathname === selectedDirectoryPath ? pathState.currentListing : null;

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
            // log.debug('RENDER', 'BRANCH_2', 'Not authenticated');
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Login Required</option></select>`;
        } else if (isAuthenticated && (selectedDirectoryPath === null || selectedDirectoryPath === '')) {
            // Use the established window.APP convention 
            const topLevelDirs = pathState.topLevelDirs || [];
            
            if (pathState.status === 'loading') {
                primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading directories...</option></select>`;
            } else if (topLevelDirs.length > 0) {
                let optionsHTML = `<option value="" selected disabled>Select base directory...</option>`;
                topLevelDirs.forEach(dirName => {
                    optionsHTML += `<option value="${dirName}" data-type="dir">${dirName}/</option>`;
                });
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Base Directory">${optionsHTML}</select>`;
            } else {
                primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>No directories found</option></select>`;
            }
        } else {
            // log.debug('RENDER', 'BRANCH_4', 'Unexpected case:', { isAuthenticated, selectedDirectoryPath });
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Unexpected state</option></select>`;
        }

        const isFileDirty = fileState.currentFile?.isDirty || false;
        const saveDisabled = !isAuthenticated || isOverallLoading || isSaving || selectedFilename === null || !isFileDirty;

        // Reduced verbosity
        // log.debug('RENDER', 'SET_INNER_HTML', 'Render: About to set innerHTML.');
        
        // Simplified layout: Breadcrumbs, then the selection row with buttons immediately adjacent
        element.innerHTML = `
            <div class="context-path-and-file-wrapper" style="display: flex !important; align-items: center !important; gap: 8px; flex-wrap: nowrap !important; width: 100%; box-sizing: border-box;">
                <div id="sidebar-toggle-btn" class="sidebar-toggle" title="Toggle Sidebar" style="flex-shrink: 0 !important; display: inline-flex !important; align-items: center; justify-content: center;">
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
        // Reduced verbosity
        // log.debug('RENDER', 'INNER_HTML_SET', 'Render: innerHTML HAS BEEN SET.');

        // --- Attach Event Listeners (FIXED: No need to remove from fresh DOM elements) ---
        const primarySelectElement = element.querySelector('#context-primary-select');
        if (primarySelectElement) {
            primarySelectElement.addEventListener('change', handlePrimarySelectChange);
        }
        
        const saveButton = element.querySelector('#save-btn');
        if (saveButton) {
            saveButton.addEventListener('click', handleSaveButtonClick);
        }

        // --- Context Settings Trigger Event Listener ---
        const settingsTrigger = element.querySelector('#context-settings-trigger');
        if (settingsTrigger) {
            settingsTrigger.addEventListener('click', handleRootBreadcrumbClick);
            // Reduced verbosity - only log errors
            // log.debug('RENDER', 'SETTINGS_TRIGGER_LISTENER_ATTACHED', 'Settings trigger event listener attached.');
        } else {
            log.error('RENDER', 'SETTINGS_TRIGGER_NOT_FOUND', 'Settings trigger element not found in DOM.');
        }

        // --- Breadcrumb Navigation Event Listener ---
        const breadcrumbContainer = element.querySelector('.context-breadcrumbs');
        if (breadcrumbContainer) {
            breadcrumbContainer.addEventListener('click', handleBreadcrumbClick);
            // Reduced verbosity - only log errors
            // log.debug('RENDER', 'BREADCRUMB_NAV_LISTENER_ATTACHED', 'Breadcrumb navigation event listener attached.');
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
        const sidebarToggleButton = element.querySelector('#sidebar-toggle-btn');
        if (sidebarToggleButton) {
            sidebarToggleButton.addEventListener('click', handleSidebarToggleClick);
        }
        
        // CRITICAL DEBUG - Render function completed
        // log.debug('RENDER', 'FUNCTION_COMPLETED', 'Render function completed successfully');
    };

    // --- Breadcrumb Generation Function ---
    const generateBreadcrumbsHTML = (selectedDirectoryPath, selectedOrg, username, isAuthenticated) => {
        let breadcrumbHTML = '';
        
        // Settings trigger (/) - always clickable
        breadcrumbHTML += `
            <span id="context-settings-trigger"
                  class="breadcrumb-item breadcrumb-separator root-settings-trigger clickable"
                  title="Click: Open Settings | Current Org: ${selectedOrg}">
                /
                <div class="technical-info-tooltip">
                    <strong>Context Information:</strong><br>
                    <code>User:</code> ${username || 'Not logged in'}<br>
                    <code>Org:</code> ${selectedOrg}<br>
                    <small>Click to open Context Manager Settings</small>
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
        const target = event.target;
        
        // Handle settings trigger click (don't navigate)
        if (target.id === 'context-settings-trigger') {
            return; // Let handleRootBreadcrumbClick handle this
        }
        
        // Handle path navigation clicks
        if (target.classList.contains('clickable') && target.hasAttribute('data-navigate-path')) {
            event.preventDefault();
            event.stopPropagation();
            
            const pathname = target.dataset.navigatePath;
            
            log.info('BREADCRUMB', 'NAVIGATE', `Breadcrumb navigation: '${pathname}'`);
            
            // Use established eventBus pattern
            window.APP.eventBus.emit('navigate:pathname', { pathname, isDirectory: true });
        }
    };

    const handlePrimarySelectChange = async (event) => {
        const selectedOption = event.target.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) return;

        const selectedValue = selectedOption.value;
        const selectedType = selectedOption.dataset.type;

        const pathState = appStore.getState().path;
        const currentPathname = pathState.currentPathname;
        const isDirectorySelected = pathState.isDirectorySelected;

        // DEBUG: Log the state we're working with
        // log.debug('SELECT', 'DROPDOWN_SELECTION_DEBUG', 'DROPDOWN SELECTION DEBUG:', {
        //     selectedValue,
        //     selectedType,
        //     currentPathname,
        //     isDirectorySelected,
        //     pathState
        // });

        // Determine current directory for building new paths
        let currentDirectory = null;
        
        // Handle root directory case first
        if (currentPathname === '' || currentPathname === null) {
            // log.debug('SELECT', 'ROOT_CASE', 'ROOT CASE: Using empty string as current directory');
            currentDirectory = '';
        } else {
            currentDirectory = isDirectorySelected ? currentPathname : getParentPath(currentPathname);
            // log.debug('SELECT', 'CURRENT_DIRECTORY_CALCULATED', 'Current directory calculated:', currentDirectory);
        }
        
        // Final validation
        if (currentDirectory === null || currentDirectory === undefined) {
            // log.debug('SELECT', 'FALLBACK', 'FALLBACK: Using empty string for undefined current directory');
            currentDirectory = '';
        }

        // Handle parent directory navigation
        if (selectedType === 'parent') {
            const parentPath = selectedOption.dataset.parentPath;
            log.info('SELECT', 'NAVIGATE_PARENT', `Navigating to parent directory: '${parentPath}'`);
            window.APP.eventBus.emit('navigate:pathname', { pathname: parentPath, isDirectory: true });
            return;
        }

        const newRelativePath = pathJoin(currentDirectory, selectedValue);
        log.info('SELECT', 'PRIMARY_SELECT_CHANGE', `Primary select change: Base Dir='${currentDirectory}', Selected='${selectedValue}', Type='${selectedType}', New Path='${newRelativePath}'`);

        // Primary navigation - let the bootloader's navigate:pathname handler do the heavy lifting
        if (selectedType === 'dir') {
            window.APP.eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: true });
        } else if (selectedType === 'file') {
            window.APP.eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: false });
        }
        window.APP.eventBus.emit('file:selected', { filename: selectedValue, directory: selectedType === 'dir' });
    };

    const handleSaveButtonClick = (event) => {
        event.preventDefault();
        
        const state = appStore.getState();
        const { currentPathname, isDirectorySelected } = state.path;
        const isDirty = state.file.currentFile.isDirty;

        if (!currentPathname || isDirectorySelected) {
            log.warn('SAVE', 'NO_FILE_SELECTED', 'Save button clicked but no file is selected.');
            return;
        }

        if (!isDirty) {
            log.info('SAVE', 'NOT_DIRTY', 'Save button clicked but no changes to save.');
            // Optionally, provide feedback to the user that there's nothing to save.
            return;
        }
        
        log.info('SAVE', 'DISPATCHING_SAVE_THUNK', `Dispatching saveFile thunk for: ${currentPathname}`);
        appStore.dispatch(fileThunks.saveFile());
    };

    const handleRootBreadcrumbClick = (event) => {
        event.preventDefault();
        log.info('BREADCRUMB', 'ROOT_CLICK', 'Toggling mount info panel.');
        console.log("Toggling mount info panel is disabled for now.");
    };

    const handleSettingsClick = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const isFromSidebar = event.target.closest('#panel-content');
        const isFromBreadcrumb = event.target.id === 'context-settings-trigger';

        log.info('SETTINGS', 'CLICK', `Settings click: fromSidebar=${!!isFromSidebar}, fromBreadcrumb=${isFromBreadcrumb}`);

        // Existing logic for opening the popup from the sidebar can remain.
        // The breadcrumb click is now handled by handleRootBreadcrumbClick.
        if (isFromSidebar) {
            // Sidebar click: Show popup
            log.info('SETTINGS', 'SHOW_POPUP_SIDEBAR', 'Sidebar settings click: showing popup');
            
            if (typeof window.APP?.services?.uiComponents?.showPopup === 'function') {
                log.info('SETTINGS', 'SHOW_POPUP_IMMEDIATE', 'UI Components system available, showing popup immediately');
                
                const state = appStore.getState();
                const pathState = state.path || {};
                const settingsState = state.settings || {};
                const availableTopDirs = pathState.availableTopLevelDirs || ['data'];
                
                const popupProps = {
                    pdDirBase: '/root/pj/pd/',
                    contentSubDir: settingsState.currentContentSubDir || 'data',
                    availableSubDirs: availableTopDirs,
                    displayPathname: pathState.currentPathname || '',
                    doEnvVars: settingsState.doEnvVars || []
                };
                
                log.info('SETTINGS', 'POPUP_PROPS', `Showing context settings popup with props: ${JSON.stringify(popupProps)}`);
                
                const success = window.APP?.services?.uiComponents.showPopup('contextSettings', popupProps);
                if (success) {
                    log.info('SETTINGS', 'POPUP_SUCCESS', 'Context settings popup displayed successfully');
                } else {
                    log.error('SETTINGS', 'POPUP_FAILED', 'Failed to display context settings popup');
                    alert('Unable to open settings panel. Please check console for details.');
                }
            } else {
                log.error('SETTINGS', 'NO_UI_COMPONENTS', 'UI Components system not available yet');
                alert('Settings panel is not ready yet. Please wait for the app to finish loading.');
            }
        } else if (isFromBreadcrumb) {
            // This case is now handled by the dedicated root breadcrumb handler.
            // We can just log it for now or remove this block.
            log.info('SETTINGS', 'BREADCRUMB_CLICK_HANDLED', 'Breadcrumb settings click is now handled by handleRootBreadcrumbClick.');
            // To prevent accidental double-handling, we do nothing here.
        }
    };

    const handleNoteButtonClick = async (event) => {
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

    const handleSidebarToggleClick = () => {
        if (window.APP && window.APP.services && window.APP.services.workspaceManager) {
            window.APP.services.workspaceManager.toggleLeftSidebar();
        } else {
            console.error('[PathManager] WorkspaceManager not found on window.APP.services.');
        }
    };

    // --- Component Lifecycle ---
    const mount = () => {
        log.info('MOUNT', 'START', `Mount_CM: Initializing for targetElementId: ${targetElementId}`);

        element = document.getElementById(targetElementId);
        if (!element) {
            log.error('MOUNT', 'TARGET_NOT_FOUND', `Mount_CM FAILED: Target element with ID '${targetElementId}' not found in DOM.`);
            console.error(`[ContextManagerComponent] Mount failed: target element #${targetElementId} not found.`);
            return;
        }
        log.info('MOUNT', 'TARGET_FOUND', 'Mount_CM: Target element found.');

        if (storeUnsubscribe) {
            storeUnsubscribe();
            log.debug('MOUNT', 'UNSUBSCRIBE_EXISTING', 'Mount_CM: Existing store subscription found and removed.');
        }

        storeUnsubscribe = appStore.subscribe(() => {
            render();
        });
        log.info('MOUNT', 'SUBSCRIBE_SUCCESS', 'Mount_CM: Subscribed to appStore changes.');
        
        // No need for navigate:pathname listener - we'll use direct actions
        log.info('MOUNT', 'DIRECT_ACTIONS', 'Mount_CM: Using direct file system actions.');
        
        // Initial render
        log.info('MOUNT', 'INITIAL_RENDER', 'Mount_CM: Calling initial render.');
        render();
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
            const saveBtn = element.querySelector('#save-btn');
            if (saveBtn) saveBtn.removeEventListener('click', handleSaveButtonClick);
            const publishBtn = element.querySelector('#publish-btn');
            if (publishBtn) publishBtn.removeEventListener('click', handlePublishButtonClick);
            const settingsTrigger = element.querySelector('#context-settings-trigger');
            if (settingsTrigger) settingsTrigger.removeEventListener('click', handleRootBreadcrumbClick);
            const breadcrumbContainer = element.querySelector('.context-breadcrumbs');
            if (breadcrumbContainer) breadcrumbContainer.removeEventListener('click', handleBreadcrumbClick);

            log.info('DESTROY', 'LISTENERS_REMOVED', `Listeners removed from element during destroy.`);
        }
        element = null;
        log.info('DESTROY', 'COMPLETE', 'Component destroyed.');
    };

    return { mount, destroy };
}