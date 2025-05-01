// client/components/ContextManagerComponent.js
// REMOVE: import fileManager from '/client/filesystem/fileManager.js'; // No longer needed for state
import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js'; // Use central state for context
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js'; // Example: Create pathUtils.js

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
    let storeUnsubscribe = null; // Generic name for the unsubscribe function
    let infoPopupElement = null; // Reference to the popup

    // --- Component Local State ---
    // Stores the *pathname* of the directory segment whose siblings should be shown in a dropdown.
    // e.g., if path is 'mike/notes/subdir' and user clicks 'notes', this becomes 'mike/notes'
    let activeSiblingDropdownPath = null;
    // Stores the path whose parent listing is currently being fetched
    let fetchingParentPath = null;

    // --- Rendering Logic (Further Streamlined) ---
    const render = () => {
        if (!element) return;
        logContext('Render function START'); 

        const fileState = appStore.getState().file;
        const authState = appStore.getState().auth;

        // --- Get state & Determine Loading Status ---
        const isAuthInitializing = authState.isInitializing;
        // Consider file system loading if auth is done but file state isn't initialized or is explicitly loading
        const isFileLoading = !isAuthInitializing && (!fileState.isInitialized || fileState.isLoading);
        const isOverallLoading = isAuthInitializing || isFileLoading || !!fetchingParentPath; // Broader loading check
        const isSaving = fileState.isSaving;

        const currentPathname = fileState.currentPathname;
        const isDirectorySelected = fileState.isDirectorySelected;
        const currentListing = fileState.currentListing || { pathname: null, dirs: [], files: [] };
        const parentListing = fileState.parentListing || { pathname: null, dirs: [], files: [] };
        const availableTopLevelDirs = fileState.availableTopLevelDirs || [];
        const isAuthenticated = authState.isAuthenticated;
        const user = authState.user;
        const userRole = user?.role;
        const username = user?.username;
        const isAdmin = userRole === 'admin';

        // --- Derive UI values (Handle null pathname) ---
        const selectedDirectoryPath = currentPathname !== null
            ? (isDirectorySelected ? currentPathname : getParentPath(currentPathname))
            : null;
        const selectedFilename = currentPathname !== null && !isDirectorySelected
            ? getFilename(currentPathname)
            : null;
        // Only consider "at root" if authenticated and pathname is empty or null
        const isAtRoot = isAuthenticated && (currentPathname === null || currentPathname === '');

        logContext(`State Snapshot - isAuthInitializing: ${isAuthInitializing}, isFileLoading: ${isFileLoading}, isOverallLoading: ${isOverallLoading}`);
        logContext(`State Snapshot - Pathname: '${currentPathname}', isDirectorySelected: ${isDirectorySelected}, isAtRoot: ${isAtRoot}`);
        logContext(`State Snapshot - Auth: User='${username}', Role=${userRole}, isAdmin=${isAdmin}`);
        logContext(`State Snapshot - CurrentListing Path: '${currentListing.pathname}', Dirs: [${currentListing.dirs?.join(',')}]`);
        logContext(`State Snapshot - ParentListing Path: '${parentListing.pathname}', Dirs: [${parentListing.dirs?.join(',')}]`);
        logContext(`Component State - activeSiblingDropdownPath: ${activeSiblingDropdownPath}, fetchingParentPath: ${fetchingParentPath}`);
        logContext(`Derived - selectedDirectoryPath: '${selectedDirectoryPath}', selectedFilename: '${selectedFilename}'`);

        // --- Line 1: Generate Breadcrumbs (Refined) ---
        const separator = `<span class="breadcrumb-separator">/</span>`;
        let breadcrumbsHTML = '';

        if (isAuthInitializing || !isAuthenticated) {
            breadcrumbsHTML = `<span class="breadcrumb-info">${isAuthInitializing ? 'Authenticating...' : 'Please log in'}</span>`;
        } else if (isAtRoot) {
            // --- Root Rendering (Prefix with /) ---
            if (isAdmin) {
                if (isFileLoading && availableTopLevelDirs.length === 0) {
                    breadcrumbsHTML = separator + `<select class="breadcrumb-dir-select admin-top-select" title="Select Top Directory" disabled><option>Loading Dirs...</option></select>`;
                } else if (availableTopLevelDirs.length > 0) {
                    let adminDirOptions = `<option value="" selected disabled>Select Top Directory...</option>`;
                    const sortedDirs = [...availableTopLevelDirs].sort();
                    sortedDirs.forEach(dir => { adminDirOptions += `<option value="${dir}">${dir}/</option>`; });
                    breadcrumbsHTML = separator + `<select id="context-root-dir-select" class="breadcrumb-dir-select admin-top-select" title="Select Top Directory">${adminDirOptions}</select>`;
                } else if (!isFileLoading){
                    breadcrumbsHTML = `<span class="breadcrumb-info">No top-level directories found.</span>`;
                } else {
                    breadcrumbsHTML = `<span class="breadcrumb-info">Loading...</span>`;
                }
            } else { // Non-admin at root
                 if (username && availableTopLevelDirs.includes(username)) {
                      breadcrumbsHTML = separator + `<span class="breadcrumb-item non-admin-top root-link" data-target-pathname="${username}" title="Go to ${username} root">${username}</span>`;
                 } else if (isFileLoading || !fileState.isInitialized) {
                      breadcrumbsHTML = `<span class="breadcrumb-info">Loading context...</span>`;
                 } else {
                     breadcrumbsHTML = `<span class="breadcrumb-info">User: ${username || 'N/A'} (Context not set)</span>`;
                 }
            }
        } else if (currentPathname !== null) {
            // --- Path Segment Rendering ---
            logContext(`Rendering breadcrumbs for Pathname: '${currentPathname}'`);
            const pathParts = currentPathname.split('/').filter(p => p);
            let cumulativePath = '';
            const breadcrumbSegments = [];

            breadcrumbSegments.push(separator);

            pathParts.forEach((part, index) => {
                cumulativePath = pathJoin(cumulativePath, part);
                const isLastPart = index === pathParts.length - 1;
                // A segment represents a directory IF it's not the last part, OR if it is the last part AND a directory is selected overall
                const isDirectorySegment = !isLastPart || (isLastPart && isDirectorySelected);
                const isFirstSegmentAdmin = index === 0 && isAdmin;

                let segmentContent = '';

                if (isDirectorySegment) {
                    if (isFirstSegmentAdmin && activeSiblingDropdownPath === cumulativePath) {
                        let siblingOptions = `<option value="" selected disabled>Select Top Dir...</option>`;
                        const sortedSiblings = [...availableTopLevelDirs].sort();
                        sortedSiblings.forEach(siblingDir => {
                           siblingOptions += `<option value="${siblingDir}" ${siblingDir === part ? 'selected' : ''}>${siblingDir}/</option>`;
                        });
                        segmentContent = `<select class="breadcrumb-dir-select admin-sibling-select" data-current-segment-path="${cumulativePath}" title="Select Sibling Top-Level Directory">${siblingOptions}</select>`;
                    } else if (!isFirstSegmentAdmin && activeSiblingDropdownPath === cumulativePath && parentListing?.dirs && parentListing.pathname === getParentPath(cumulativePath)) {
                        let siblingOptions = `<option value="" selected disabled>Change directory...</option>`;
                        const parentPathForDropdown = getParentPath(cumulativePath) ?? '';
                        const sortedSiblings = [...parentListing.dirs].sort();
                        sortedSiblings.forEach(siblingDir => {
                            siblingOptions += `<option value="${siblingDir}" ${siblingDir === part ? 'selected' : ''}>${siblingDir}/</option>`;
                        });
                        segmentContent = `<select class="breadcrumb-dir-select sibling-select" data-parent-path="${parentPathForDropdown}" data-current-segment-path="${cumulativePath}" title="Select Sibling Directory">${siblingOptions}</select>`;
                    } else if (fetchingParentPath === cumulativePath) {
                       segmentContent = `<span class="breadcrumb-item loading-segment" title="Loading siblings...">${part}(...)</span>`;
                    } else {
                       const spanClass = isFirstSegmentAdmin ? "breadcrumb-item intermediate-dir admin-top-segment" : "breadcrumb-item intermediate-dir";
                       const spanTitle = isFirstSegmentAdmin ? `Go to ${part} / Click to change Top Dir` : `Go to ${part} / Click to see siblings`;
                       segmentContent = `<span class="${spanClass}" data-target-pathname="${cumulativePath}" title="${spanTitle}">${part}</span>`;
                    }
                    breadcrumbSegments.push( (index > 0 ? separator : '') + segmentContent );
                }
            });
            breadcrumbsHTML = breadcrumbSegments.join('');

        } else {
            breadcrumbsHTML = `<span class="breadcrumb-info">Initializing...</span>`;
        }
        // --- End Line 1 ---

        // --- Line 2: Generate Unified Primary Selector (Ensure file selection is handled correctly) ---
        let primarySelectorHTML = '';
        const listingForSelector = currentListing?.pathname === selectedDirectoryPath ? currentListing : null;

        if (isAuthInitializing || !isAuthenticated) {
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Login Required</option></select>`;
        } else if (isAtRoot) {
           primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Select directory</option></select>`;
        } else if (isFileLoading && !listingForSelector) {
           primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Loading Items...</option></select>`;
        } else if (listingForSelector) {
            const dirs = listingForSelector.dirs || [];
            const files = listingForSelector.files || [];
            const items = [
                ...dirs.map(name => ({ name, type: 'dir' })),
                ...files.map(name => ({ name, type: 'file' }))
            ].sort((a, b) => {
                if (a.type !== b.type) { return a.type === 'dir' ? -1 : 1; }
                return a.name.localeCompare(b.name);
            });

            if (items.length > 0) {
                const placeholderSelected = isDirectorySelected;
                let optionsHTML = `<option value="" ${placeholderSelected ? 'selected' : ''} disabled>Select item...</option>`;
                items.forEach(item => {
                    const displayName = item.type === 'dir' ? `${item.name}/` : item.name;
                    const isSelectedFile = !isDirectorySelected && selectedFilename && item.type === 'file' && item.name === selectedFilename;
                    optionsHTML += `<option value="${item.name}" data-type="${item.type}" ${isSelectedFile ? 'selected' : ''}>${displayName}</option>`;
                });
                primarySelectorHTML = `<select id="context-primary-select" class="context-selector" title="Select Directory or File">${optionsHTML}</select>`;
            } else {
                primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Directory empty</option></select>`;
            }
        } else {
             primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Select item...</option></select>`;
        }
        // --- End Line 2 Selector ---

        // --- Final Assembly ---
        const saveDisabled = !isAuthenticated || isOverallLoading || isSaving || isDirectorySelected;
        logContext(`Save button disabled check: !isAuthenticated=${!isAuthenticated}, isOverallLoading=${isOverallLoading}, isSaving=${isSaving}, isDirectorySelected=${isDirectorySelected}. Final: ${saveDisabled}`);

        element.innerHTML = `
            <div class="context-breadcrumbs">${breadcrumbsHTML}</div>
            <div class="context-selection-row">
                ${primarySelectorHTML}
                <div class="file-action-buttons">
                    <button id="save-btn" data-action="saveFile" title="Save Current File" ${saveDisabled ? 'disabled' : ''}>${isSaving ? 'Saving...' : 'Save'}</button>
                    <button id="context-info-btn" title="Show Context Info">Info</button>
                </div>
                <div id="context-info-popup" class="info-popup"></div>
            </div>
        `;
        infoPopupElement = element.querySelector('#context-info-popup');
        if (isSaving) element.querySelector('#save-btn')?.classList.add('saving');
        logContext(`innerHTML updated.`);

        // --- Re-attach Event Listeners ---
        element.querySelectorAll('.breadcrumb-item.non-admin-top.root-link').forEach(span => {
            span.removeEventListener('click', handleNavigateToPathname);
            span.addEventListener('click', handleNavigateToPathname);
        });
        element.querySelectorAll('.breadcrumb-item.intermediate-dir').forEach(span => {
            span.removeEventListener('click', handleIntermediateDirClick);
            span.addEventListener('click', handleIntermediateDirClick);
        });
        element.querySelectorAll('.sibling-select, .admin-sibling-select').forEach(select => {
            select.removeEventListener('change', handleSiblingDirectorySelectChange);
            select.addEventListener('change', handleSiblingDirectorySelectChange);
        });
        element.querySelectorAll('.admin-top-select').forEach(select => {
             select.removeEventListener('change', handleRootDirectorySelectChange);
             select.addEventListener('change', handleRootDirectorySelectChange);
        });
        const primarySelectElement = element.querySelector('#context-primary-select');
        if (primarySelectElement) {
             primarySelectElement.removeEventListener('change', handlePrimarySelectChange);
             primarySelectElement.addEventListener('change', handlePrimarySelectChange);
        }
        const infoButton = element.querySelector('#context-info-btn');
        if (infoButton) {
            infoButton.removeEventListener('mouseenter', handleInfoMouseEnter);
            infoButton.removeEventListener('mouseleave', handleInfoMouseLeave);
            infoButton.addEventListener('mouseenter', handleInfoMouseEnter);
            infoButton.addEventListener('mouseleave', handleInfoMouseLeave);
        }

        logContext(`Event listeners (re)attached. Render END.`);
        logContext(`Render function END`);

        // After attaching other event listeners, add:
        const saveButton = element.querySelector('#save-btn');
        if (saveButton) {
            saveButton.removeEventListener('click', handleSaveButtonClick);
            saveButton.addEventListener('click', handleSaveButtonClick);
        }
    };

    // --- Event Handlers (Updated for pathname) ---

    const handleNavigateToPathname = (event) => {
         const pathname = event.currentTarget.dataset.targetPathname;
         logContext(`Navigate direct: Pathname='${pathname}'`, "EVENT");
         activeSiblingDropdownPath = null; // Reset sibling state
         fetchingParentPath = null;
         // Emit event with full pathname, specifying it's a directory
         eventBus.emit('navigate:pathname', { pathname: pathname, isDirectory: true });
    };

     const handleIntermediateDirClick = (event) => {
        const segmentPath = event.currentTarget.dataset.targetPathname;
        const parentPath = getParentPath(segmentPath);
        const isAdminClicker = appStore.getState().auth.user?.role === 'admin';
        const isFirstSegment = parentPath === ''; // Check if it's a top-level dir

        logContext(`Intermediate dir click: Path='${segmentPath}', Parent='${parentPath}', isAdmin=${isAdminClicker}, isFirst=${isFirstSegment}`, "EVENT");

        // Always navigate to the directory when clicked, clearing everything to the right
        activeSiblingDropdownPath = null;
        fetchingParentPath = null;
        eventBus.emit('navigate:pathname', { pathname: segmentPath, isDirectory: true });
    };

    const handleSiblingDirectorySelectChange = (event) => {
        const selectedValue = event.target.value;
        if (!selectedValue) return;

        let newPath;
        // Check if it's the admin top-level sibling select
        if (event.target.classList.contains('admin-sibling-select')) {
             newPath = selectedValue; // The value is the full top-level path name
             logContext(`Admin top-level sibling change: Selected='${selectedValue}', New Pathname='${newPath}'`, "EVENT");
        } else {
             // Original logic for regular siblings
             const parentPath = event.target.dataset.parentPath;
             newPath = pathJoin(parentPath, selectedValue);
             logContext(`Regular sibling directory change: Parent='${parentPath}', Selected='${selectedValue}', New Pathname='${newPath}'`, "EVENT");
        }

        activeSiblingDropdownPath = null; // Deactivate dropdown
        fetchingParentPath = null;
        eventBus.emit('navigate:pathname', { pathname: newPath, isDirectory: true }); // Navigate
    };

    const handleRootDirectorySelectChange = (event) => {
         const selectedDir = event.target.value;
         if (!selectedDir) return;
         logContext(`Root directory select change: Selected dir='${selectedDir}'`, "EVENT");
         activeSiblingDropdownPath = null;
         fetchingParentPath = null;
         eventBus.emit('navigate:pathname', { pathname: selectedDir, isDirectory: true });
    };

    const handlePrimarySelectChange = (event) => {
        const selectedOption = event.target.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) return; // Ignore "Select item..."

        const selectedValue = selectedOption.value; // e.g., "subdir" or "myfile.md"
        const selectedType = selectedOption.dataset.type; // "dir" or "file"

        // Get the current directory path from state
        const fileState = appStore.getState().file;
        const baseDirectoryPath = fileState.isDirectorySelected
                               ? fileState.currentPathname
                               : getParentPath(fileState.currentPathname);

        if (baseDirectoryPath === null || baseDirectoryPath === undefined) {
            logContext(`Error: Cannot determine base directory for primary selection. State Pathname: ${fileState.currentPathname}`, 'error', 'EVENT');
            return;
        }

        const newPath = pathJoin(baseDirectoryPath, selectedValue);
        logContext(`Primary select change: Base='${baseDirectoryPath}', Selected='${selectedValue}', Type='${selectedType}', New Pathname='${newPath}'`, "EVENT");

        // Reset interaction states
        activeSiblingDropdownPath = null;
        fetchingParentPath = null;

        // Emit navigation event based on type
        if (selectedType === 'dir') {
            eventBus.emit('navigate:pathname', { pathname: newPath, isDirectory: true });
        } else if (selectedType === 'file') {
            eventBus.emit('navigate:pathname', { pathname: newPath, isDirectory: false });
        } else {
            logContext(`Unknown item type selected: ${selectedType}`, 'warning', 'EVENT');
        }
    };

    // --- Info Popup Handler (Improved Loading States) ---
    const handleInfoMouseEnter = (event) => {
        if (!infoPopupElement) return;

        const authState = appStore.getState().auth;
        const fileState = appStore.getState().file;

        // Determine status based on state flags
        const isAuthReady = !authState.isInitializing && authState.user;
        const isFileContextReady = fileState.isInitialized; // Check if file manager has done initial load attempt

        // Get values safely, providing loading indicators
        const username = isAuthReady ? authState.user.username : (authState.isInitializing ? 'Loading...' : 'N/A');
        const role = isAuthReady ? authState.user.role : (authState.isInitializing ? 'Loading...' : 'N/A');
        const currentPath = fileState.currentPathname ?? (isFileContextReady ? '(None)' : 'Loading...');
        const isDir = fileState.isDirectorySelected;
        const availableDirs = fileState.availableTopLevelDirs || [];

        let scopeText = 'Loading...'; // Default to loading
        if (isAuthReady) { // Only determine scope if auth is ready
             if (role === 'admin') scopeText = 'Admin (All Top Dirs)';
             else if (role === 'user') {
                 // Show N/A only if file context is ready but dirs are empty
                  scopeText = `User (${availableDirs.length > 0 ? availableDirs.join(', ') : (isFileContextReady ? 'N/A' : 'Loading...')})`;
             } else scopeText = 'N/A'; // Role is known but not admin/user
        } else if (!authState.isInitializing) {
             scopeText = 'N/A'; // Auth finished but no user/role
        }

        let selectedText = fileState.currentPathname === null
            ? (isFileContextReady ? 'N/A' : 'Loading...')
            : (isDir ? 'Directory' : 'File');

        const infoText = `
            User: ${username}<br>
            Role: ${role}<br>
            Scope: ${scopeText}<br>
            Current Path: ${currentPath === '' ? '(Root)' : currentPath}<br>
            Selected: ${selectedText}
        `.trim().replace(/\n +/g, '\n');

        // Still add specific admin dir list if available
        let finalInfoText = infoText; // Use a new variable instead of modifying infoText
        if (role === 'admin' && availableDirs.length > 0) {
            finalInfoText += `<br>Top Dirs: [${availableDirs.join(', ')}]`;
        }

        infoPopupElement.innerHTML = finalInfoText;
        infoPopupElement.style.display = 'block';
        const btnRect = event.currentTarget.getBoundingClientRect();
        infoPopupElement.style.left = `${btnRect.left}px`;
        infoPopupElement.style.top = `${btnRect.bottom + 5}px`;
    };

    const handleInfoMouseLeave = () => {
        if (infoPopupElement) {
            infoPopupElement.style.display = 'none';
            infoPopupElement.innerHTML = ''; // Clear content
            logContext(`Info popup hidden`, "EVENT");
        }
    };

    // Fix the save button click handler
    const handleSaveButtonClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        logContext('Save button clicked', 'EVENT');
        
        const authState = appStore.getState().auth;
        if (!authState.isAuthenticated || !authState.user) {
            logContext('Cannot save: User not authenticated', 'error', 'EVENT');
            return;
        }
        
        // Emit event to request file save
        eventBus.emit('file:save');
    };

    // --- Component Lifecycle ---
    const mount = () => {
        element = document.getElementById(targetElementId);
        if (!element) {
            logContext(`Target element #${targetElementId} not found. Cannot mount.`, 'error');
            return false;
        }
        logContext(`Mounting component to #${targetElementId}`, 'MOUNT');

        // Clear previous listeners if any (idempotency)
        // destroy(); // <<< REMOVE THIS LINE >>>

        // Make sure we don't double-subscribe if mount is called again without destroy
        if (storeUnsubscribe) {
             logContext('Warning: mount called again without destroy, unsubscribing previous listener.', 'warn');
             storeUnsubscribe();
             storeUnsubscribe = null;
        }

        // Subscribe to appStore changes
        let previousAuthState = appStore.getState().auth;
        let previousFileState = appStore.getState().file;
        storeUnsubscribe = appStore.subscribe(currentState => {
            const newAuthState = currentState.auth;
            const newFileState = currentState.file;
            // Check for relevant changes
            const authRelevantChanged =
                 newAuthState.isInitializing !== previousAuthState.isInitializing ||
                 newAuthState.isAuthenticated !== previousAuthState.isAuthenticated ||
                 newAuthState.user !== previousAuthState.user; // Shallow compare user object

            const fileRelevantChanged =
                 newFileState.isInitialized !== previousFileState.isInitialized || // Check init flag
                 newFileState.isLoading !== previousFileState.isLoading ||
                 newFileState.isSaving !== previousFileState.isSaving ||
                 newFileState.currentPathname !== previousFileState.currentPathname ||
                 newFileState.isDirectorySelected !== previousFileState.isDirectorySelected ||
                 newFileState.currentListing !== previousFileState.currentListing ||
                 newFileState.parentListing !== previousFileState.parentListing ||
                 newFileState.availableTopLevelDirs !== previousFileState.availableTopLevelDirs;

            // --- Handle parent listing fetch completion (existing logic) ---
             if (fetchingParentPath && newFileState.parentListing && fetchingParentPath === newFileState.parentListing.triggeringPath) {
                 logContext(`Detected parent listing arrival for path: ${fetchingParentPath}. Activating dropdown.`, 'SUB');
                 activeSiblingDropdownPath = fetchingParentPath; fetchingParentPath = null;
             } else if (fetchingParentPath && !newFileState.isLoading && fetchingParentPath !== activeSiblingDropdownPath) {
                  logContext(`Fetch seems complete/cancelled for ${fetchingParentPath}, but no dropdown activation. Clearing fetch state.`, 'SUB');
                  fetchingParentPath = null;
             }
            // --- End Parent Listing Fetch Handling ---

             const localStateChanged = fetchingParentPath !== previousFileState.fetchingParentPath || activeSiblingDropdownPath !== previousFileState.activeSiblingDropdownPath;

            if (authRelevantChanged || fileRelevantChanged || localStateChanged) {
                logContext('Relevant state changed (Auth, Store, or Local), calling render.', 'SUB');
                previousAuthState = newAuthState;
                previousFileState = { ...newFileState, fetchingParentPath, activeSiblingDropdownPath };
                render(); // Trigger re-render
            } else {
                // Update snapshot even if no render
                previousAuthState = newAuthState;
                previousFileState = { ...newFileState, fetchingParentPath, activeSiblingDropdownPath };
            }
        });

        logContext('Performing initial render.', 'MOUNT');
        render(); // Perform initial render
        logContext('Component mounted and subscribed to appStore.', 'MOUNT');
        return true;
    };

    const destroy = () => {
        logContext(`Destroying component and unsubscribing...`, 'info');
        // Unsubscribe from appStore
        if (storeUnsubscribe) {
            storeUnsubscribe();
            storeUnsubscribe = null;
        }
        // Remove listeners added directly in render (though re-render should handle this)
        if (element) {
             element.querySelectorAll('.breadcrumb-item.non-admin-top.root-link').forEach(span => span.removeEventListener('click', handleNavigateToPathname));
             element.querySelectorAll('.breadcrumb-item.intermediate-dir').forEach(span => span.removeEventListener('click', handleIntermediateDirClick));
             element.querySelectorAll('.sibling-select, .admin-sibling-select').forEach(select => select.removeEventListener('change', handleSiblingDirectorySelectChange));
             const rootDirSelect = element.querySelector('#context-root-dir-select');
             if(rootDirSelect) rootDirSelect.removeEventListener('change', handleRootDirectorySelectChange);
             const primarySelect = element.querySelector('#context-primary-select');
             if(primarySelect) primarySelect.removeEventListener('change', handlePrimarySelectChange);
             // Optionally clear innerHTML on explicit destroy, but maybe not needed if parent removes the element
             // element.innerHTML = ''; 
             logContext(`Listeners removed from element during destroy.`, 'DESTROY'); 
        }
        element = null; // Release reference
        infoPopupElement = null; // Clear popup reference
        activeSiblingDropdownPath = null; fetchingParentPath = null;
        logContext('Component destroyed.', 'info');
    };

    // REMOVED pathJoin as it's now internal to fileManager.js
    // function pathJoin(...parts) { ... } 

    return { mount, destroy, render }; // Expose render if needed for manual triggers, otherwise just mount/destroy
}
