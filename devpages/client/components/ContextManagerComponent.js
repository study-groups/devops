// client/components/ContextManagerComponent.js
import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

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

    // --- Rendering Logic ---
    const render = () => {
        console.log('[CTX RENDER] >>>>> Render function CALLED <<<<<');
        logContext('Render function Top Execution Point.', 'DEBUG_RENDER_FLOW');

        if (!element) {
            logContext('Render SKIPPED: component "element" is null or undefined.', 'ERROR_RENDER_FLOW');
            console.error('[CTX RENDER] CRITICAL: render() called but this.element is not set!', element);
            return;
        }
        logContext('Render: Component "element" IS valid.', 'DEBUG_RENDER_FLOW');
        console.log('[CTX RENDER] Current component "element":', element);
        logContext(`Render: Target Element ID during component init was: ${targetElementId}`, 'DEBUG_RENDER_FLOW');

        const fileState = appStore.getState().file;
        const authState = appStore.getState().auth;
        const settingsStateFromStore = appStore.getState().settings;
        const selectedOrg = settingsStateFromStore?.selectedOrg || 'pixeljam-arcade';
        const settingsState = {
            currentContentSubDir: (settingsStateFromStore && typeof settingsStateFromStore.currentContentSubDir === 'string')
                ? settingsStateFromStore.currentContentSubDir
                : 'data',
            availableContentSubDirs: (settingsStateFromStore && Array.isArray(settingsStateFromStore.availableContentSubDirs))
                ? settingsStateFromStore.availableContentSubDirs
                : ['data'],
            doEnvVars: (settingsStateFromStore && Array.isArray(settingsStateFromStore.doEnvVars))
                ? settingsStateFromStore.doEnvVars
                : []
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
        logContext(`Using STATIC CONTENT_ROOT_PREFIX for test: '${CONTENT_ROOT_PREFIX}'`, 'CONFIG');

        logContext(`State Snapshot - Relative Pathname: '${currentPathname}', isDirectorySelected: ${isDirectorySelected}`);
        logContext(`State Snapshot - Auth: User='${username}', Role=${userRole}, Org=${selectedOrg}`);
        logContext(`Component State - activeSiblingDropdownPath: ${activeSiblingDropdownPath}, fetchingParentPath: ${fetchingParentPath}`);
        logContext(`Derived - selectedDirectoryPath: '${selectedDirectoryPath}', selectedFilename: '${selectedFilename}'`);

        // Generate breadcrumbs for the selected DIRECTORY path
        const breadcrumbsHTML = generateBreadcrumbsHTML(
            selectedDirectoryPath,
            selectedOrg, 
            username,
            isAuthenticated
        );

        let primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading...</option></select>`;
        if (isAuthenticated && selectedDirectoryPath !== null) {
            const listingForSelector = fileState.currentListing?.pathname === selectedDirectoryPath ? fileState.currentListing : null;

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
                let optionsHTML = `<option value="" selected disabled>Loading items...</option>`;
                if (selectedDirectoryPath !== '') {
                    const parentOfSelectedDir = getParentPath(selectedDirectoryPath);
                    optionsHTML += `<option value=".." data-type="parent" data-parent-path="${parentOfSelectedDir || ''}">..</option>`;
                }
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Directory or File">${optionsHTML}</select>`;
            }
        } else if (!isAuthenticated) {
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Login Required</option></select>`;
        } else if (isAuthenticated && selectedDirectoryPath === null) {
            const topLevelDirs = fileState.availableTopLevelDirs || [];
            if (topLevelDirs.length > 0) {
                let optionsHTML = `<option value="" selected disabled>Select base directory...</option>`;
                topLevelDirs.forEach(dirName => {
                    optionsHTML += `<option value="${dirName}" data-type="dir">${dirName}/</option>`;
                });
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Base Directory">${optionsHTML}</select>`;
            } else {
                primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>No base directories</option></select>`;
            }
        }

        const saveDisabled = !isAuthenticated || isOverallLoading || isSaving || selectedFilename === null;

        logContext('Render: About to set innerHTML.', 'DEBUG_RENDER_FLOW');
        console.log('[CTX RENDER] About to set innerHTML for element:', element);
        
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
                </div>
            </div>
        `;
        logContext('Render: innerHTML HAS BEEN SET.', 'DEBUG_RENDER_FLOW');
        console.log('[CTX RENDER] innerHTML set. Current element.innerHTML:', element.innerHTML.substring(0, 200) + "...");

        // --- Re-attach Event Listeners ---
        const primarySelectElement = element.querySelector('#context-primary-select');
        if (primarySelectElement) {
            primarySelectElement.removeEventListener('change', handlePrimarySelectChange);
            primarySelectElement.addEventListener('change', handlePrimarySelectChange);
        }
        const publishButton = element.querySelector('#publish-btn');
        if (publishButton) {
            publishButton.removeEventListener('click', handlePublishButtonClick);
            publishButton.addEventListener('click', handlePublishButtonClick);
        }
        const saveButton = element.querySelector('#save-btn');
        if (saveButton) {
            saveButton.removeEventListener('click', handleSaveButtonClick);
            saveButton.addEventListener('click', handleSaveButtonClick);
        }

        // --- Context Settings Trigger Event Listener ---
        const settingsTrigger = element.querySelector('#context-settings-trigger');
        if (settingsTrigger) {
            settingsTrigger.removeEventListener('click', handleSettingsClick);
            settingsTrigger.addEventListener('click', handleSettingsClick);
            logContext('Settings trigger event listener attached.', 'DEBUG_EVENT');
        } else {
            logContext('Settings trigger element not found in DOM.', 'ERROR_EVENT');
        }

        // --- Breadcrumb Navigation Event Listener ---
        const breadcrumbContainer = element.querySelector('.context-breadcrumbs');
        if (breadcrumbContainer) {
            breadcrumbContainer.removeEventListener('click', handleBreadcrumbClick);
            breadcrumbContainer.addEventListener('click', handleBreadcrumbClick);
            logContext('Breadcrumb navigation event listener attached.', 'DEBUG_EVENT');
        } else {
            logContext('Breadcrumb container element not found in DOM.', 'ERROR_EVENT');
        }

        // Add event listener for the filename input if you want interaction
        const filenameInputElement = element.querySelector('.selected-filename-input');
        if (filenameInputElement && !filenameInputElement.disabled) {
            // filenameInputElement.removeEventListener('focus', handleFilenameFocus);
            // filenameInputElement.addEventListener('focus', handleFilenameFocus);
            // filenameInputElement.removeEventListener('click', handleFilenameClick);
            // filenameInputElement.addEventListener('click', handleFilenameClick);
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
            return; // Let handleSettingsClick handle this
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
    };

    const handleSaveButtonClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        logContext('Save button clicked', 'EVENT');
        const authState = appStore.getState().auth;
        if (!authState.isAuthenticated || !authState.user) {
            logContext('Cannot save: User not authenticated', 'error', 'EVENT');
            return;
        }
        eventBus.emit('file:save');
    };

    const handlePublishButtonClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        logContext('Publish button clicked', 'EVENT');
        const fileState = appStore.getState().file;
        if (fileState.isDirectorySelected || !fileState.currentPathname) {
            logContext('Cannot publish: No file selected or directory view.', 'warn', 'EVENT');
            alert('Please select a file to publish.');
            return;
        }
        if (typeof window.triggerActions?.publishToSpaces === 'function') {
            window.triggerActions.publishToSpaces();
        } else {
            logContext('Cannot publish: triggerActions.publishToSpaces is not available.', 'error', 'EVENT');
            alert('Publish action is not configured correctly.');
        }
    };

    const handleSettingsClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        logContext('Settings trigger clicked', 'EVENT');
        
        // Determine if this click is from the navbar or sidebar
        const isFromSidebar = targetElementId === 'sidebar-context-manager-container';
        const isFromNavbar = targetElementId === 'context-manager-container';
        
        logContext(`Settings click from: ${isFromSidebar ? 'sidebar' : isFromNavbar ? 'navbar' : 'unknown'}`, 'EVENT');
        
        if (isFromNavbar) {
            // Navbar click: Toggle left sidebar visibility
            logContext('Navbar settings click: toggling left sidebar', 'EVENT');
            
                         // Use the layout manager to toggle the left sidebar
             if (window.layoutManager && typeof window.layoutManager.toggleLeftSidebar === 'function') {
                 window.layoutManager.toggleLeftSidebar();
             } else {
                 // Fallback: dispatch action directly
                 dispatch({ type: ActionTypes.UI_TOGGLE_LEFT_SIDEBAR });
             }
        } else if (isFromSidebar) {
            // Sidebar click: Show popup
            logContext('Sidebar settings click: showing popup', 'EVENT');
            
            // Check if UI components system is available
            if (typeof window.uiComponents?.showPopup === 'function') {
                logContext('UI Components system available, showing popup immediately', 'EVENT');
                
                // Get current state to pass to popup
                const fileState = appStore.getState().file;
                const settingsState = appStore.getState().settings;
                
                // Use the actual available top-level directories instead of hardcoded ['data']
                const availableTopDirs = fileState.availableTopLevelDirs || ['data'];
                
                const popupProps = {
                    pdDirBase: '/root/pj/pd/',
                    contentSubDir: settingsState?.currentContentSubDir || 'data',
                    availableSubDirs: availableTopDirs, // Use actual top-level dirs
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
        } else {
            logContext('Unknown settings click source, defaulting to popup', 'warn', 'EVENT');
            // Default to popup for unknown sources
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
                
                window.uiComponents.showPopup('contextSettings', popupProps);
            }
        }
    };

    // --- Component Lifecycle ---
    const mount = () => {
        console.log('[CTX MOUNT CM] >>>>> ContextManagerComponent mount CALLED <<<<<');
        logContext(`Mount_CM: Initializing for targetElementId: ${targetElementId}`, 'DEBUG_LIFECYCLE');

        element = document.getElementById(targetElementId);
        if (!element) {
            logContext(`Mount_CM CRITICAL FAILURE: Target element #${targetElementId} NOT FOUND.`, 'ERROR_LIFECYCLE');
            console.error(`[CTX MOUNT CM] CRITICAL: Element with ID '${targetElementId}' not found.`);
            return false;
        }
        logContext('Mount_CM: Target element for ContextManagerComponent FOUND.', 'DEBUG_LIFECYCLE');
        console.log('[CTX MOUNT CM] ContextManagerComponent "element":', element);

        if (storeUnsubscribe) {
            logContext('Warning: mount called again, unsubscribing previous.', 'warn');
            storeUnsubscribe();
        }

        let previousAuthState = appStore.getState().auth;
        let previousFileState = appStore.getState().file;
        let previousSettingsState = appStore.getState().settings;

        storeUnsubscribe = appStore.subscribe(currentState => {
            const newAuthState = currentState.auth;
            const newFileState = currentState.file;
            const newSettingsState = currentState.settings;

            const authRelevantChanged =
                newAuthState.isInitializing !== previousAuthState.isInitializing ||
                newAuthState.isAuthenticated !== previousAuthState.isAuthenticated;

            const fileRelevantChanged =
                newFileState.isInitialized !== previousFileState.isInitialized ||
                newFileState.isLoading !== previousFileState.isLoading ||
                newFileState.isSaving !== previousFileState.isSaving ||
                newFileState.currentPathname !== previousFileState.currentPathname ||
                newFileState.isDirectorySelected !== previousFileState.isDirectorySelected ||
                newFileState.currentListing !== previousFileState.currentListing ||
                newFileState.parentListing !== previousFileState.parentListing ||
                newFileState.availableTopLevelDirs !== previousFileState.availableTopLevelDirs;

            const settingsRelevantChanged = !previousSettingsState ||
                newSettingsState?.currentContentSubDir !== previousSettingsState?.currentContentSubDir;

            if (authRelevantChanged || fileRelevantChanged || settingsRelevantChanged) {
                logContext('Relevant state changed (Auth, File, or Settings), calling render.', 'SUB');
                render();
            }

            previousAuthState = newAuthState;
            previousFileState = newFileState;
            previousSettingsState = newSettingsState;
        });

        logContext('Mount_CM: Calling initial render for ContextManagerComponent.', 'DEBUG_LIFECYCLE');
        render();
        logContext('Mount_CM: ContextManagerComponent mounted and initial render done.', 'DEBUG_LIFECYCLE');
        return true;
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
            if (settingsTrigger) settingsTrigger.removeEventListener('click', handleSettingsClick);
            const breadcrumbContainer = element.querySelector('.context-breadcrumbs');
            if (breadcrumbContainer) breadcrumbContainer.removeEventListener('click', handleBreadcrumbClick);

            logContext(`Listeners removed from element during destroy.`, 'DESTROY');
        }
        element = null;
        logContext('Component destroyed.', 'DESTROY');
    };

    return { mount, destroy };
}
