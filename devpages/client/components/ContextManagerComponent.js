// client/components/ContextManagerComponent.js
import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

const logContext = (message, level = 'debug', subtype = 'RENDER') => {
    const type = "CTX";
    const fullType = `${type}${subtype ? `_${subtype}` : ''}`;

    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, fullType);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : (level === 'info' ? console.info : console.log));
        logFunc(`[${fullType}] ${message}`);
    }
};

export function createContextManagerComponent(targetElementId) {
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
        // Reduced console.log verbosity
        // logContext('Render function Top Execution Point.', 'debug');

        if (!element) {
            logContext('Render SKIPPED: component "element" is null or undefined.', 'error');
            console.error('[CTX RENDER] CRITICAL: render() called but this.element is not set!', element);
            return;
        }
        // Reduced verbosity - only log errors and warnings
        // logContext('Render: Component "element" IS valid.', 'debug');
        // logContext(`Render: Target Element ID during component init was: ${targetElementId}`, 'debug');

        const fileState = appStore.getState().file || {};
        const authState = appStore.getState().auth || {};
        const settingsStateFromStore = appStore.getState().settings || {};
        
        const selectedOrg = settingsStateFromStore?.selectedOrg || 'pixeljam-arcade';
        const settingsState = {
            currentContentSubDir: settingsStateFromStore?.currentContentSubDir || 'data',
            availableContentSubDirs: settingsStateFromStore?.availableContentSubDirs || ['data'],
            doEnvVars: settingsStateFromStore?.doEnvVars || []
        };

        const isAuthInitializing = authState.isInitializing;
        const isAuthenticated = authState.isAuthenticated;
        const isFileLoading = !isAuthInitializing && (!fileState.isInitialized || fileState.isLoading);
        const isOverallLoading = isAuthInitializing || isFileLoading;
        const isSaving = fileState.isSaving;
        const currentPathname = fileState.currentPathname;
        const isDirectorySelected = fileState.isDirectorySelected;
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
        // logContext(`Using STATIC CONTENT_ROOT_PREFIX for test: '${CONTENT_ROOT_PREFIX}'`, 'debug');

        // Reduced verbosity - combine state logging into fewer entries
        // logContext(`State Snapshot - Relative Pathname: '${currentPathname}', isDirectorySelected: ${isDirectorySelected}`, 'debug');
        // logContext(`State Snapshot - Auth: User='${username}', Role=${userRole}, Org=${selectedOrg}`, 'debug');
        // logContext(`Component State - activeSiblingDropdownPath: ${activeSiblingDropdownPath}, fetchingParentPath: ${fetchingParentPath}`, 'debug');
        // logContext(`Derived - selectedDirectoryPath: '${selectedDirectoryPath}', selectedFilename: '${selectedFilename}'`, 'debug');

        // Removed verbose debug block - only log when there are issues
        // logContext('=== RENDER DEBUG INFO ===', 'debug');
        // logContext(`isAuthenticated: ${isAuthenticated}`, 'debug');
        // logContext(`selectedDirectoryPath: '${selectedDirectoryPath}'`, 'debug');
        // logContext(`currentPathname: '${currentPathname}'`, 'debug');
        // logContext(`isDirectorySelected: ${isDirectorySelected}`, 'debug');
        // logContext(`currentListing.pathname: '${fileState.currentListing?.pathname}'`, 'debug');
        // logContext(`currentListing.dirs: [${(fileState.currentListing?.dirs || []).join(', ')}]`, 'debug');
        // logContext(`currentListing.files: [${(fileState.currentListing?.files || []).join(', ')}]`, 'debug');
        // logContext(`isOverallLoading: ${isOverallLoading}`, 'debug');
        // logContext(`availableTopLevelDirs: [${(fileState.availableTopLevelDirs || []).join(', ')}]`, 'debug');
        // logContext('=== END RENDER DEBUG ===', 'debug');

        // Generate breadcrumbs for the selected DIRECTORY path
        const breadcrumbsHTML = generateBreadcrumbsHTML(
            selectedDirectoryPath,
            selectedOrg, 
            username,
            isAuthenticated
        );

        // Generate primary selector
        let primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading...</option></select>`;
        
        if (isAuthenticated && selectedDirectoryPath !== null) {
            // Improved listing matching logic
            const listingForSelector = fileState.currentListing?.pathname === selectedDirectoryPath ? fileState.currentListing : null;
            
            // Only log when there's an issue
            // logContext(`Listing check: selectedDirectoryPath='${selectedDirectoryPath}', currentListing.pathname='${fileState.currentListing?.pathname}', match=${!!listingForSelector}`, 'debug');

            if (listingForSelector) {
                const dirs = listingForSelector.dirs || [];
                const files = listingForSelector.files || [];
                
                // Only log when there's an issue
                // logContext(`Found listing: ${dirs.length} dirs, ${files.length} files`, 'debug');
                
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
                // Use the latest available listing instead of trying to load missing ones
                const currentListing = fileState.currentListing;
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
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Login Required</option></select>`;
        } else if (isAuthenticated && (selectedDirectoryPath === null || selectedDirectoryPath === '')) {
            const topLevelDirs = fileState.availableTopLevelDirs || [];
            // Only log when there's an issue
            // logContext(`No directory selected or at root. Available top-level dirs: [${topLevelDirs.join(', ')}]`, 'debug');
            
            if (topLevelDirs.length > 0) {
                let optionsHTML = `<option value="" selected disabled>Select base directory...</option>`;
                topLevelDirs.forEach(dirName => {
                    optionsHTML += `<option value="${dirName}" data-type="dir">${dirName}/</option>`;
                });
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Base Directory">${optionsHTML}</select>`;
            } else {
                // Trigger loading of top-level directories if not available
                if (!isOverallLoading) {
                    logContext('No top-level directories available. Triggering navigation to root...', 'warn');
                    setTimeout(() => {
                        eventBus.emit('navigate:pathname', { pathname: '', isDirectory: true });
                    }, 0);
                }
                primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading directories...</option></select>`;
            }
        }

        const saveDisabled = !isAuthenticated || isOverallLoading || isSaving || selectedFilename === null;

        // Reduced verbosity
        // logContext('Render: About to set innerHTML.', 'debug');
        // console.log('[CTX RENDER] About to set innerHTML for element:', element);
        
        // Simplified layout: Breadcrumbs, then the selection row
        element.innerHTML = `
            <div class="context-path-and-file-wrapper">
                <div class="context-breadcrumbs">${breadcrumbsHTML}</div>
            </div>
            <div class="context-selection-row">
                ${primarySelectorHTML}
                <div class="file-action-buttons">
                    <button id="save-btn" class="btn btn--primary btn--sm" data-action="saveFile" title="Save Current File" ${saveDisabled ? 'disabled' : ''}>${isSaving ? 'Saving...' : 'Save'}</button>
                    <button id="publish-btn" class="btn btn--secondary btn--sm" title="Publish File" ${selectedFilename === null ? 'disabled' : ''}>Publish</button>
                    <button id="note-btn" class="btn btn--secondary btn--sm note-button" title="Add to Context for Cursor AI" ${selectedFilename === null ? 'disabled' : ''}>Note</button>
                </div>
            </div>
            <select id="file-select" style="display: none;"><option value="">Hidden compatibility element</option></select>
        `;
        // Reduced verbosity
        // logContext('Render: innerHTML HAS BEEN SET.', 'debug');
        // console.log('[CTX RENDER] innerHTML set. Current element.innerHTML:', element.innerHTML.substring(0, 200) + "...");

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
            // logContext('Settings trigger event listener attached.', 'debug');
        } else {
            logContext('Settings trigger element not found in DOM.', 'error');
        }

        // --- Breadcrumb Navigation Event Listener ---
        const breadcrumbContainer = element.querySelector('.context-breadcrumbs');
        if (breadcrumbContainer) {
            breadcrumbContainer.addEventListener('click', handleBreadcrumbClick);
            // Reduced verbosity - only log errors
            // logContext('Breadcrumb navigation event listener attached.', 'debug');
        } else {
            logContext('Breadcrumb container element not found in DOM.', 'error');
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
    
    // Improved breadcrumb navigation handler
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
            const isDirectory = target.dataset.isDirectory === 'true';
            
            logContext(`Breadcrumb navigation: '${pathname}' (directory: ${isDirectory})`, 'EVENT');
            
            // Special case for root directory (empty path)
            if (pathname === '') {
                logContext('Navigating to root directory', 'EVENT');
                eventBus.emit('navigate:pathname', { pathname: '', isDirectory: true });
            } else {
                eventBus.emit('navigate:pathname', { pathname, isDirectory });
            }
        }
    };

    const handlePrimarySelectChange = (event) => {
        const selectedOption = event.target.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) return;

        const selectedValue = selectedOption.value;
        const selectedType = selectedOption.dataset.type;

        // Handle parent directory navigation
        if (selectedType === 'parent') {
            const parentPath = selectedOption.dataset.parentPath;
            logContext(`Navigating to parent directory: '${parentPath}'`, 'EVENT');
            eventBus.emit('navigate:pathname', { pathname: parentPath, isDirectory: true });
            return;
        }

        const fileState = appStore.getState().file;
        const currentPathname = fileState.currentPathname;
        const isDirectorySelected = fileState.isDirectorySelected;

        let baseRelativeDirectoryPath = null;
        if (currentPathname !== null) {
            baseRelativeDirectoryPath = isDirectorySelected ? currentPathname : getParentPath(currentPathname);
        }
        if (baseRelativeDirectoryPath === null || baseRelativeDirectoryPath === undefined) {
            if (currentPathname === '' && isDirectorySelected) {
                baseRelativeDirectoryPath = '';
            } else {
                logContext(`Error: Cannot determine base directory for primary selection.`, 'error', 'EVENT');
                return;
            }
        }

        const newRelativePath = pathJoin(baseRelativeDirectoryPath, selectedValue);
        logContext(`Primary select change: Base Rel='${baseRelativeDirectoryPath}', Sel='${selectedValue}', Type='${selectedType}', New Rel Path='${newRelativePath}'`, "EVENT");

        if (selectedType === 'dir') {
            eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: true });
        } else if (selectedType === 'file') {
            eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: false });
        }

        // after you have pathname & content
        eventBus.emit('file:selected', { filename: selectedValue, directory: selectedType === 'dir' });          // optional
        eventBus.emit('file:loaded',  { content: selectedValue, pathname: newRelativePath });             // makes EditorPanel update
        dispatch({
          type: ActionTypes.FS_SET_STATE,
          payload: { content: selectedValue, currentPathname: newRelativePath }
        });
    };

    const handleSaveButtonClick = (event) => {
        // Prevent default form submission behavior
        event.preventDefault();

        // Check for current pathname and if the file is not a directory
        const { currentPathname, isDirectorySelected } = appStore.getState().file;
        if (!currentPathname || isDirectorySelected) {
            logContext('Save button clicked but no file is selected.', 'warning', 'EVENT');
            return;
        }

        // Reduced verbosity
        // logContext(`Save button clicked for: ${currentPathname}`, 'info', 'EVENT');
        
        // Dispatch the action to save the file
        eventBus.emit('file:save');
    };

    const handleRootBreadcrumbClick = (event) => {
        event.preventDefault();
        const { currentContentSubDir } = appStore.getState().settings;
        logContext(`Root breadcrumb clicked. Current content subdir: '${currentContentSubDir}'`, 'EVENT');

        // The primary, default action is to toggle the sidebar.
        // We can access the global workspace layout manager instance if it's available.
        if (window.workspaceLayoutManager && typeof window.workspaceLayoutManager.toggleSidebar === 'function') {
            logContext('Toggling sidebar visibility', 'EVENT');
            window.workspaceLayoutManager.toggleSidebar();
        } else {
            logContext('WorkspaceLayoutManager not available, cannot toggle sidebar.', 'error', 'EVENT');
            alert('Could not toggle the sidebar. The layout manager is not available.');
        }

        // Example of a secondary action (e.g., for showing the settings popup)
        if (event.ctrlKey || event.metaKey) {
            logContext('Ctrl/Meta+Click detected, showing settings popup.', 'EVENT');
            
            if (typeof window.uiComponents?.showPopup === 'function') {
                const fileState = appStore.getState().file;
                const settingsState = appStore.getState().settings;
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
                    logContext('Failed to display context settings popup', 'error', 'EVENT');
                    alert('Unable to open settings panel. Please check console for details.');
                }
            } else {
                logContext('UI Components system not available for settings popup', 'error', 'EVENT');
            }
        }
    };

    const handleSettingsClick = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const isFromSidebar = event.target.closest('#panel-content');
        const isFromBreadcrumb = event.target.id === 'context-settings-trigger';

        logContext(`Settings click: fromSidebar=${!!isFromSidebar}, fromBreadcrumb=${isFromBreadcrumb}`, 'EVENT');

        // Existing logic for opening the popup from the sidebar can remain.
        // The breadcrumb click is now handled by handleRootBreadcrumbClick.
        if (isFromSidebar) {
            // Sidebar click: Show popup
            logContext('Sidebar settings click: showing popup', 'EVENT');
            
            if (typeof window.uiComponents?.showPopup === 'function') {
                logContext('UI Components system available, showing popup immediately', 'EVENT');
                
                const fileState = appStore.getState().file;
                const settingsState = appStore.getState().settings;
                const availableTopDirs = fileState.availableTopLevelDirs || ['data'];
                
                const popupProps = {
                    pdDirBase: '/root/pj/pd/',
                    contentSubDir: settingsState?.currentContentSubDir || 'data',
                    availableSubDirs: availableTopDirs,
                    displayPathname: fileState?.currentPathname || '',
                    doEnvVars: settingsState?.doEnvVars || []
                };
                
                logContext(`Showing context settings popup with props: ${JSON.stringify(popupProps)}`, 'EVENT');
                
                const success = window.uiComponents.showPopup('contextSettings', popupProps);
                if (success) {
                    logContext('Context settings popup displayed successfully', 'EVENT');
                } else {
                    logContext('Failed to display context settings popup', 'error', 'EVENT');
                    alert('Unable to open settings panel. Please check console for details.');
                }
            } else {
                logContext('UI Components system not available yet', 'error', 'EVENT');
                alert('Settings panel is not ready yet. Please wait for the app to finish loading.');
            }
        } else if (isFromBreadcrumb) {
            // This case is now handled by the dedicated root breadcrumb handler.
            // We can just log it for now or remove this block.
            logContext('Breadcrumb settings click is now handled by handleRootBreadcrumbClick.', 'info');
            // To prevent accidental double-handling, we do nothing here.
        }
    };

    const handleNoteButtonClick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        logContext('Note button clicked - adding to context', 'EVENT');
        
        let originalText;
        const noteBtn = event.target;

        try {
            const state = appStore.getState();
            const fileState = state.file;
            const contextName = state.context?.activeContext || 'default'; // Get active context

            if (fileState.isDirectorySelected || !fileState.currentPathname) {
                logContext('Cannot add note: No file selected or directory view.', 'warn', 'EVENT');
                alert('Please select a file to add to context.');
                return;
            }

            // Use a more robust selector to find the editor instance
            const editor = document.querySelector('#md-editor textarea, #editor-container textarea, textarea');
            if (!editor) {
                logContext('Editor element not found.', 'error', 'EVENT');
                alert('Could not find the editor content.');
                return;
            }

            const markdownContent = editor.value;
            const pathname = fileState.currentPathname;
            
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
                logContext(`Successfully added '${pathname}' to context '${contextName}'.`, 'info', 'EVENT');
            } else {
                throw new Error(result.error || 'The server reported an issue, but did not provide an error message.');
            }

        } catch (error) {
            logContext(`Error in note button handler: ${error.message}`, 'error', 'EVENT');
            console.error('[CTX] Note button error:', error);
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
        logContext(`Mount_CM: Initializing for targetElementId: ${targetElementId}`, 'INFO');

        element = document.getElementById(targetElementId);
        if (!element) {
            logContext(`Mount_CM FAILED: Target element with ID '${targetElementId}' not found in DOM.`, 'ERROR');
            console.error(`[ContextManagerComponent] Mount failed: target element #${targetElementId} not found.`);
            return;
        }
        logContext('Mount_CM: Target element found.', 'INFO');

        if (storeUnsubscribe) {
            storeUnsubscribe();
            logContext('Mount_CM: Existing store subscription found and removed.', 'DEBUG');
        }

        storeUnsubscribe = appStore.subscribe(render);
        logContext('Mount_CM: Subscribed to appStore changes.', 'INFO');
        
        // Initial render
        logContext('Mount_CM: Calling initial render.', 'INFO');
        render();
        logContext('Mount_CM: Initial render complete.', 'INFO');
    };

    const destroy = () => {
        console.log('[CTX DESTROY] >>>>> Destroy function CALLED <<<<<');
        logContext(`Destroying component and unsubscribing...`, 'DESTROY');
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

            logContext(`Listeners removed from element during destroy.`, 'DESTROY');
        }
        element = null;
        logContext('Component destroyed.', 'DESTROY');
    };

    return { mount, destroy };
}
