// client/components/ContextManagerComponent.js
// Using window.APP.eventBus and window.APP.store instead of direct imports
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js';
import { appDispatch } from '/client/appDispatch.js';
import { pathThunks } from '/client/store/slices/pathSlice.js';
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
        // CRITICAL DEBUG - Is render even being called?
        
        // Reduced console.log verbosity
        // log.debug('RENDER', 'TOP_EXECUTION', 'Render function Top Execution Point.');

        if (!element) {
            log.error('RENDER', 'ELEMENT_NULL', 'Render SKIPPED: component "element" is null or undefined.');
            console.error('[PathManager RENDER] CRITICAL: render() called but this.element is not set!', element);
            return;
        }
        // Reduced verbosity - only log errors and warnings
        // log.debug('RENDER', 'ELEMENT_VALID', 'Render: Component "element" IS valid.');
        // log.debug('RENDER', 'TARGET_ID', `Render: Target Element ID during component init was: ${targetElementId}`);

        // CRITICAL DEBUG - Check if window.APP exists
        
        if (!window.APP?.store) {
            log.error('RENDER', 'STORE_UNAVAILABLE', 'CRITICAL: window.APP.store not available in render!');
            return;
        }
        
        const pathState = window.APP.store.getState().path || {};
        const fileState = window.APP.store.getState().file || {};
        const authState = window.APP.store.getState().auth || {};
        const settingsStateFromStore = window.APP.store.getState().settings || {};
        
        // CRITICAL DEBUG - State retrieved
        // log.debug('RENDER', 'STATE_RETRIEVED', 'State retrieved:', {
        //     pathState: !!pathState,
        //     fileState: !!fileState,
        //     authState: !!authState,
        //     isAuthenticated: authState.isAuthenticated
        // });
        
        const selectedOrg = settingsStateFromStore?.selectedOrg || 'pixeljam-arcade';
        const settingsState = {
            currentContentSubDir: settingsStateFromStore?.currentContentSubDir || 'data',
            availableContentSubDirs: settingsStateFromStore?.availableContentSubDirs || ['data'],
            doEnvVars: settingsStateFromStore?.doEnvVars || []
        };

        const isAuthInitializing = authState.isInitializing;
        const isAuthenticated = authState.isAuthenticated;
        const isPathLoading = pathState.status === 'loading';
        const isFileLoading = !isAuthInitializing && (!fileState.isInitialized || fileState.isLoading);
        const isOverallLoading = isAuthInitializing || isPathLoading || isFileLoading;
        const isSaving = pathState.isSaving || fileState.isSaving;
        
        // HYBRID: Use path state for current navigation, file state for legacy compatibility
        // Fix: Treat null as empty string for root directory navigation
        const currentPathname = pathState.currentPathname !== null 
            ? pathState.currentPathname 
            : (fileState.currentPathname !== null ? fileState.currentPathname : '');
        const isDirectorySelected = pathState.isDirectorySelected !== undefined 
            ? pathState.isDirectorySelected 
            : (fileState.isDirectorySelected !== undefined ? fileState.isDirectorySelected : true); // Default to true for root
        
        const user = authState.user;
        const userRole = user?.role;
        const username = user?.username;

        const selectedDirectoryPath = currentPathname !== null
            ? (isDirectorySelected ? currentPathname : getParentPath(currentPathname))
            : null;
        const selectedFilename = currentPathname !== null && !isDirectorySelected
            ? getFilename(currentPathname)
            : null;

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
        // log.debug('RENDER', 'CURRENT_LISTING_PATHNAME', `currentListing.pathname: '${fileState.currentListing?.pathname}'`);
        // log.debug('RENDER', 'CURRENT_LISTING_DIRS', `currentListing.dirs: [${(fileState.currentListing?.dirs || []).join(', ')}]`);
        // log.debug('RENDER', 'CURRENT_LISTING_FILES', `currentListing.files: [${(fileState.currentListing?.files || []).join(', ')}]`);
        // log.debug('RENDER', 'IS_OVERALL_LOADING', `isOverallLoading: ${isOverallLoading}`);
        // log.debug('RENDER', 'AVAILABLE_TOP_LEVEL_DIRS', `availableTopLevelDirs: [${(fileState.availableTopLevelDirs || []).join(', ')}]`);
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
            // HYBRID: Check both path and file state for current listing
            const pathListing = pathState.currentListing?.pathname === selectedDirectoryPath ? pathState.currentListing : null;
            const fileListing = fileState.currentListing?.pathname === selectedDirectoryPath ? fileState.currentListing : null;
            const listingForSelector = pathListing || fileListing;
            
            // Only log when there's an issue
            // log.debug('RENDER', 'LISTING_CHECK', `Listing check: selectedDirectoryPath='${selectedDirectoryPath}', currentListing.pathname='${fileState.currentListing?.pathname}', match=${!!listingForSelector}`);

            if (listingForSelector) {
                const dirs = listingForSelector.dirs || [];
                const files = listingForSelector.files || [];
                
                // Only log when there's an issue
                // log.debug('RENDER', 'LISTING_FOUND', `Found listing: ${dirs.length} dirs, ${files.length} files`);
                
                const items = [
                    ...dirs.map(name => ({ name, type: 'dir' })),
                    ...files.map(name => ({ name, type: 'file' }))
                ].sort((a, b) => {
                    if (a.type !== b.type) { return a.type === 'dir' ? -1 : 1; }
                    return a.name.localeCompare(b.name);
                });

                let optionsHTML = `<option value="" selected disabled>Select item...</option>`;
                
                if (selectedDirectoryPath !== '') {
                    const parentOfSelectedDir = getParentPath(selectedDirectoryPath);
                    optionsHTML += `<option value=".." data-type="parent" data-parent-path="${parentOfSelectedDir || ''}">..</option>`;
                }
                
                items.forEach(item => {
                    const displayName = item.type === 'dir' ? `${item.name}/` : item.name;
                    const optionSelected = !isDirectorySelected && item.name === selectedFilename && item.type === 'file';
                    optionsHTML += `<option value="${item.name}" data-type="${item.type}" ${optionSelected ? 'selected' : ''}>${displayName}</option>`;
                });
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Directory or File">${optionsHTML}</select>`;
            } else {
                // HYBRID: Use the latest available listing from either state
                const currentListing = pathState.currentListing || fileState.currentListing;
                if (currentListing && (currentListing.dirs?.length > 0 || currentListing.files?.length > 0)) {
                    // We have a current listing, use it even if path doesn't match exactly
                    const dirs = currentListing.dirs || [];
                    const files = currentListing.files || [];
                    
                    const items = [
                        ...dirs.map(name => ({ name, type: 'dir' })),
                        ...files.map(name => ({ name, type: 'file' }))
                    ].sort((a, b) => {
                        if (a.type !== b.type) { return a.type === 'dir' ? -1 : 1; }
                        return a.name.localeCompare(b.name);
                    });

                    let optionsHTML = `<option value="" selected disabled>Select item...</option>`;
                    
                    if (selectedDirectoryPath !== '') {
                        const parentOfSelectedDir = getParentPath(selectedDirectoryPath);
                        optionsHTML += `<option value=".." data-type="parent" data-parent-path="${parentOfSelectedDir || ''}">..</option>`;
                    }
                    
                    items.forEach(item => {
                        const displayName = item.type === 'dir' ? `${item.name}/` : item.name;
                        const optionSelected = !isDirectorySelected && item.name === selectedFilename && item.type === 'file';
                        optionsHTML += `<option value="${item.name}" data-type="${item.type}" ${optionSelected ? 'selected' : ''}>${displayName}</option>`;
                    });
                    primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Directory or File">${optionsHTML}</select>`;
                } else {
                    // No listing available at all - show basic navigation
                    let optionsHTML = `<option value="" selected disabled>No items available</option>`;
                    if (selectedDirectoryPath !== '') {
                        const parentOfSelectedDir = getParentPath(selectedDirectoryPath);
                        optionsHTML += `<option value=".." data-type="parent" data-parent-path="${parentOfSelectedDir || ''}">..</option>`;
                    }
                    primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Directory or File">${optionsHTML}</select>`;
                }
            }
        } else if (!isAuthenticated) {
            // log.debug('RENDER', 'BRANCH_2', 'Not authenticated');
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Login Required</option></select>`;
        } else if (isAuthenticated && (selectedDirectoryPath === null || selectedDirectoryPath === '')) {
            // Use the established window.APP convention 
            const topLevelDirs = fileState.availableTopLevelDirs || [];
            
            // IMMEDIATE DEBUG - log what we're seeing
            
            if (topLevelDirs.length > 0) {
                let optionsHTML = `<option value="" selected disabled>Select base directory...</option>`;
                topLevelDirs.forEach(dirName => {
                    optionsHTML += `<option value="${dirName}" data-type="dir">${dirName}/</option>`;
                });
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Base Directory">${optionsHTML}</select>`;
            } else {
                // No top-level directories available - run diagnostic
                log.warn('RENDER', 'NO_TOP_LEVEL_DIRS', 'No top-level directories available. Running diagnostic...');
                diagnoseTopDirIssue();
                
                // Use the established fileThunks pattern from bootloader
                if (!isOverallLoading) {
                    log.warn('RENDER', 'ATTEMPT_LOAD_DIRS', 'Attempting to load directories via fileThunks...');
                    setTimeout(async () => {
                        try {
                            const { fileThunks } = await import('/client/thunks/fileThunks.js');
                            window.APP.store.dispatch(fileThunks.loadTopLevelDirectories());
                        } catch (error) {
                            log.error('RENDER', 'LOAD_DIRS_FAILED', `Failed to load directories: ${error.message}`, error);
                        }
                    }, 0);
                }
                primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading directories...</option></select>`;
            }
        } else {
            // log.debug('RENDER', 'BRANCH_4', 'Unexpected case:', { isAuthenticated, selectedDirectoryPath });
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Unexpected state</option></select>`;
        }

        const saveDisabled = !isAuthenticated || isOverallLoading || isSaving || selectedFilename === null;

        // Reduced verbosity
        // log.debug('RENDER', 'SET_INNER_HTML', 'Render: About to set innerHTML.');
        
        // Simplified layout: Breadcrumbs, then the selection row
        element.innerHTML = `
            <div class="context-path-and-file-wrapper">
                <div class="context-breadcrumbs">${breadcrumbsHTML}</div>
            </div>
            <div class="context-selection-row">
                ${primarySelectorHTML}
                <div class="file-action-buttons">
                    <button id="save-btn" data-action="saveFile" title="Save Current File" ${saveDisabled ? 'disabled' : ''}>${isSaving ? 'Saving...' : 'Save'}</button>
                    <button id="publish-btn" title="Publish File" ${selectedFilename === null ? 'disabled' : ''}>Publish</button>
                    <button id="note-btn" title="Add to Context for Cursor AI" ${selectedFilename === null ? 'disabled' : ''} class="note-button">Note</button>
                </div>
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

        const pathState = window.APP.store.getState().path;
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

        // Emit additional events for editor integration (hybrid compatibility)
        window.APP.eventBus.emit('file:selected', { filename: selectedValue, directory: selectedType === 'dir' });          
        window.APP.eventBus.emit('file:loaded',  { content: selectedValue, pathname: newRelativePath });
    };

    const handleSaveButtonClick = (event) => {
        // Prevent default form submission behavior
        event.preventDefault();

        // Check for current pathname and if the file is not a directory
        const { currentPathname, isDirectorySelected } = window.APP.store.getState().path;
        if (!currentPathname || isDirectorySelected) {
            log.warn('SAVE', 'NO_FILE_SELECTED', 'Save button clicked but no file is selected.');
            return;
        }

        // Reduced verbosity
        // log.info('SAVE', 'BUTTON_CLICKED', `Save button clicked for: ${currentPathname}`);
        
        // Use established window.APP.eventBus pattern
        window.APP.eventBus.emit('file:save');
    };

    const handleRootBreadcrumbClick = (event) => {
        event.preventDefault();
        const { currentContentSubDir } = window.APP.store.getState().settings;
        log.info('BREADCRUMB', 'ROOT_CLICK', `Root breadcrumb clicked. Current content subdir: '${currentContentSubDir}'`);

        // The primary, default action is to toggle the sidebar.
        // We can access the global workspace panel manager instance if it's available.
        if (window.workspacePanelManager && typeof window.workspacePanelManager.toggleSidebar === 'function') {
            log.info('BREADCRUMB', 'TOGGLE_SIDEBAR', 'Toggling sidebar visibility');
            window.workspacePanelManager.toggleSidebar();
        } else {
            log.error('BREADCRUMB', 'NO_PANEL_MANAGER', 'WorkspacePanelManager not available, cannot toggle sidebar.');
            alert('Could not toggle the sidebar. The panel manager is not available.');
        }

        // Example of a secondary action (e.g., for showing the settings popup)
        if (event.ctrlKey || event.metaKey) {
            log.info('BREADCRUMB', 'SHOW_SETTINGS', 'Ctrl/Meta+Click detected, showing settings popup.');
            
            if (typeof window.uiComponents?.showPopup === 'function') {
                const fileState = window.APP.store.getState().file;
                const settingsState = window.APP.store.getState().settings;
                const availableTopDirs = fileState.availableTopLevelDirs || ['data'];

                const popupProps = {
                    pdDirBase: '/root/pj/pd/',
                    contentSubDir: settingsState?.currentContentSubDir || 'data',
                    availableSubDirs: availableTopDirs,
                    displayPathname: fileState?.currentPathname || '',
                    doEnvVars: settingsState?.doEnvVars || []
                };

                const success = window.uiComponents.showPopup('contextSettings', popupProps);
                if (!success) {
                    log.error('BREADCRUMB', 'SHOW_SETTINGS_FAILED', 'Failed to display context settings popup');
                    alert('Unable to open settings panel. Please check console for details.');
                }
            } else {
                log.error('BREADCRUMB', 'NO_UI_COMPONENTS', 'UI Components system not available for settings popup');
            }
        }
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
            
            if (typeof window.uiComponents?.showPopup === 'function') {
                log.info('SETTINGS', 'SHOW_POPUP_IMMEDIATE', 'UI Components system available, showing popup immediately');
                
                const fileState = window.APP.store.getState().file;
                const settingsState = window.APP.store.getState().settings;
                const availableTopDirs = fileState.availableTopLevelDirs || ['data'];
                
                const popupProps = {
                    pdDirBase: '/root/pj/pd/',
                    contentSubDir: settingsState?.currentContentSubDir || 'data',
                    availableSubDirs: availableTopDirs,
                    displayPathname: fileState?.currentPathname || '',
                    doEnvVars: settingsState?.doEnvVars || []
                };
                
                log.info('SETTINGS', 'POPUP_PROPS', `Showing context settings popup with props: ${JSON.stringify(popupProps)}`);
                
                const success = window.uiComponents.showPopup('contextSettings', popupProps);
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
            const state = window.APP.store.getState();
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

        storeUnsubscribe = window.APP.store.subscribe(() => {
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