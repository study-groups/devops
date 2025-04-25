// client/components/ContextManagerComponent.js
// REMOVE: import fileManager from '/client/filesystem/fileManager.js'; // No longer needed for state
import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js'; // Use central state for context

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

    // --- Rendering Logic (Uses appStore state) ---
    const render = () => {
        if (!element) return;
        logContext('Render function START'); 

        const fileState = appStore.getState().file;
        const authState = appStore.getState().auth;

        const isLoading = fileState.isLoading || fileState.isSaving;
        const topDir = fileState.topLevelDirectory;
        const relPath = fileState.currentRelativePath || '';
        const currentFile = fileState.currentFile;
        const currentListing = fileState.currentListing || { dirs: [], files: [] };
        const availableTopDirs = fileState.availableTopLevelDirs || [];
        
        const isMikeAtRoot = authState.user?.username?.toLowerCase() === 'mike' && !topDir;
        const isOtherUserAtRoot = authState.isAuthenticated && !isMikeAtRoot && !topDir;

        logContext(`State Snapshot - isLoading: ${isLoading}, isSaving: ${fileState.isSaving}, isInitialized: ${fileState.isInitialized}`);
        logContext(`State Snapshot - TopDir: ${topDir}, RelPath: '${relPath}', CurrentFile: ${currentFile}`);
        logContext(`State Snapshot - Auth: User='${authState.user?.username}', IsAuth=${authState.isAuthenticated}`);
        logContext(`State Snapshot - AvailableTopDirs: [${availableTopDirs.join(',')}]`);
        logContext(`State Snapshot - CurrentListing Dirs: [${currentListing.dirs?.join(',')}]`);
        logContext(`State Snapshot - CurrentListing Files: [${currentListing.files?.join(',')}]`);
        logContext(`Calculated Flags: isMikeAtRoot=${isMikeAtRoot}, isOtherUserAtRoot=${isOtherUserAtRoot}`);

        // --- Line 1: Generate Breadcrumbs (Logic mostly unchanged, uses new state variables) ---
        const separator = `<span class=\"breadcrumb-separator\">/</span>`;
        let breadcrumbsHTML = `<span class=\"breadcrumb-item root\" data-target-top=\"\" data-target-rel=\"\" title=\"Go to Root\">/</span>`;
        let addedPathSegment = false;

        if (isMikeAtRoot) {
            logContext(`Rendering Mike@Root selector`);
            if (!isLoading && availableTopDirs.length > 0) {
                let mikeDirOptions = `<option value=\"\" selected disabled>Directory...</option>`;
                // Ensure sorting happens on a copy if needed, though sort is in-place
                const sortedDirs = [...availableTopDirs].sort(); 
                sortedDirs.forEach(dir => { mikeDirOptions += `<option value=\"${dir}\">${dir}/</option>`; });
                breadcrumbsHTML += ` <select id=\"context-mike-dir-select\" class=\"breadcrumb-dir-select\" title=\"Select Directory\">${mikeDirOptions}</select>`;
                addedPathSegment = true;
            }
        } else if (isOtherUserAtRoot) {
            logContext(`Rendering OtherUser@Root info`);
            breadcrumbsHTML += `${separator}<span class=\"breadcrumb-info\" title=\"Current User\">${authState.user?.username}</span>`;
            addedPathSegment = true;
        } else if (authState.isAuthenticated && topDir) {
            logContext(`Rendering standard user path`);
            let pathSegmentsArray = [];

            pathSegmentsArray.push(`<span class=\"breadcrumb-item\" data-target-top=\"${topDir}\" data-target-rel=\"\" title=\"Go to ${topDir}\">${topDir}</span>`);

            const pathParts = relPath.split('/').filter(p => p);
            let cumulativePath = '';
            pathParts.forEach((part, index) => {
                cumulativePath = pathJoin(cumulativePath, part);
                pathSegmentsArray.push(`<span class=\"breadcrumb-item\" data-target-top=\"${topDir}\" data-target-rel=\"${cumulativePath}\" title=\"Go to ${part}\">${part}</span>`);
            });

            if (!isLoading) {
                const dirs = currentListing?.dirs || [];
                if (dirs.length > 0) {
                    let dirOptionsHTML = `<option value=\"\" selected disabled>Subdirectory...</option>`;
                    // Sort dirs
                    const sortedDirs = [...dirs].sort();
                    sortedDirs.forEach(dir => { dirOptionsHTML += `<option value=\"${dir}\">${dir}/</option>`; });
                    pathSegmentsArray.push(`<select id=\"context-dir-select\" class=\"breadcrumb-dir-select\" title=\"Select Subdirectory\">${dirOptionsHTML}</select>`);
                }
            }

            if (pathSegmentsArray.length > 0) {
                breadcrumbsHTML += ` ${pathSegmentsArray.join(separator)}`;
                addedPathSegment = true;
            }
        }

        logContext(`Final Breadcrumbs HTML: ${breadcrumbsHTML}`);
        // --- End Line 1 ---

        // --- Line 2: Generate File Selector (Logic mostly unchanged, uses new state variables) ---
        let fileSelectorHTML = '';
        if (isLoading && !isMikeAtRoot && topDir) { // Show loading only if expecting files
            fileSelectorHTML = `<select id=\"context-item-select-loading\" class=\"context-selector\" title=\"Select File\" disabled><option>Loading Files...</option></select>`;
        } else if (isMikeAtRoot) {
            fileSelectorHTML = `<select id=\"context-item-select-disabled\" class=\"context-selector\" title=\"Select File\" disabled><option>Select directory above</option></select>`;
        } else if (topDir) {
            const files = currentListing?.files || [];
            const hasListingData = currentListing && currentListing.files !== undefined; // Or check !isLoading
            if (files.length > 0) {
                let fileOptionsHTML = `<option value=\"\" ${!currentFile ? 'selected' : ''} disabled>Select file...</option>`;
                const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));
                sortedFiles.forEach(file => {
                    const isSelected = file === currentFile;
                    fileOptionsHTML += `<option value=\"${file}\" ${isSelected ? 'selected' : ''}>${file}</option>`;
                });
                fileSelectorHTML = `<select id=\"context-item-select\" class=\"context-selector\" title=\"Select File\">${fileOptionsHTML}</select>`;
            } else {
                // Use isLoading flag to differentiate between "loading" and "empty"
                const message = isLoading ? 'Loading...' : 'No files found';
                fileSelectorHTML = `<select id=\"context-item-select-empty\" class=\"context-selector\" title=\"Select File\" disabled><option>${message}</option></select>`;
            }
        } else {
            fileSelectorHTML = `<select id=\"context-item-select-placeholder\" class=\"context-selector\" title=\"Select File\" disabled><option>Select directory context</option></select>`;
        }
        // --- End Line 2 Selector ---

        // --- Final Assembly (Buttons use new state variables) ---
        const saveDisabled = isLoading || !currentFile || isMikeAtRoot;
        const linkDisabled = true; // Disable community link button for now

        // <<< ADD LOGGING HERE >>>
        logContext(`FINAL HTML - Breadcrumbs: ${breadcrumbsHTML}`);
        logContext(`FINAL HTML - File Selector: ${fileSelectorHTML}`);
        // <<< END LOGGING >>>

        element.innerHTML = `
            <div class=\"context-breadcrumbs\">${breadcrumbsHTML}</div>
            <div class=\"context-selection-row\">
                ${fileSelectorHTML}
                <div class=\"file-action-buttons\">
                    <button id=\"save-btn\" data-action=\"saveFile\" title=\"Save Current File\" ${saveDisabled ? 'disabled' : ''}>${fileState.isSaving ? 'Saving...' : 'Save'}</button>
                    <button id=\"community-link-btn\" data-action=\"toggleCommunityLink\" title=\"Add to Community Files (Not Implemented)\" ${linkDisabled ? 'disabled' : ''}>Link</button>
                </div>
            </div>
        `;
        if (fileState.isSaving) {
            element.querySelector('#save-btn')?.classList.add('saving');
        }
        logContext(`innerHTML updated.`);

        // --- Re-attach Event Listeners (No changes here, they emit events for fileManager) ---
        element.querySelectorAll('.breadcrumb-item.clickable, .breadcrumb-item.root').forEach(span => {
            span.removeEventListener('click', handleBreadcrumbClick); // Prevent duplicates
            span.addEventListener('click', handleBreadcrumbClick);
        });
        const dirSelectElement = element.querySelector('#context-dir-select');
        if (dirSelectElement) { 
             dirSelectElement.removeEventListener('change', handleDirectoryDropdownChange); // Prevent duplicates
             dirSelectElement.addEventListener('change', handleDirectoryDropdownChange); 
        }

        const mikeDirSelectElement = element.querySelector('#context-mike-dir-select');
        if (mikeDirSelectElement) { 
            mikeDirSelectElement.removeEventListener('change', handleMikeDirectorySelectChange); // Prevent duplicates
            mikeDirSelectElement.addEventListener('change', handleMikeDirectorySelectChange); 
        }

        const fileSelectElement = element.querySelector('#context-item-select');
        if (fileSelectElement) { 
             fileSelectElement.removeEventListener('change', handleFileDropdownChange); // Prevent duplicates
             fileSelectElement.addEventListener('change', handleFileDropdownChange); 
        }

        logContext(`Event listeners (re)attached. Render END.`);
        logContext(`Render function END`);
    };

    // --- Event Handlers (No changes needed for these, they emit events) ---
    const handleBreadcrumbClick = (event) => {
        const targetSpan = event.currentTarget;
        const top = targetSpan.dataset.targetTop;
        const rel = targetSpan.dataset.targetRel;
        logContext(`Breadcrumb click: Top='${top}', Rel='${rel}'`, "EVENT");

        if (top === '' && rel === '') { // Check for root specifically
            eventBus.emit('navigate:root');
        } else if (top && rel === '') { // Clicked top-level dir breadcrumb
            // Navigate to top-level dir root - use navigate:absolute for consistency
            eventBus.emit('navigate:absolute', { dir: top, path: '', file: '' }); 
            // Original: eventBus.emit('navigate:topLevelDir', { directory: top }); 
        } else if (top && rel) { // Clicked intermediate path breadcrumb
            eventBus.emit('navigate:absolute', { dir: top, path: rel, file: '' });
        }
    };

    const handleFileDropdownChange = (event) => {
        const selectedValue = event.target.value;
        if (!selectedValue) return;
        logContext(`File dropdown change: Selected file='${selectedValue}'`, "EVENT");
        eventBus.emit('navigate:file', { filename: selectedValue });
    };

    const handleDirectoryDropdownChange = (event) => {
        const selectedValue = event.target.value;
        if (!selectedValue) return;
        logContext(`Directory dropdown change: Selected subdir='${selectedValue}'`, "EVENT");
        // Get current state to build the path correctly
        const currentState = appStore.getState().file;
        eventBus.emit('navigate:directory', { directory: selectedValue }); // Pass only the subdir name
    };
    
    const handleMikeDirectorySelectChange = (event) => {
        const selectedValue = event.target.value;
        if (!selectedValue) return;
        logContext(`Mike directory select change: Selected dir='${selectedValue}'`, "EVENT");
        eventBus.emit('navigate:topLevelDir', { directory: selectedValue });
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
        let previousFileState = appStore.getState().file; // Store initial state for comparison
        storeUnsubscribe = appStore.subscribe(newState => {
            const fileStateChanged = newState.file !== previousFileState;
            logContext(`Subscription triggered. File state changed: ${fileStateChanged}`, 'SUB'); 
            if (fileStateChanged) {
                logContext(`Prev File State: ${JSON.stringify(previousFileState)}`, 'SUB_DETAIL');
                logContext(`New File State: ${JSON.stringify(newState.file)}`, 'SUB_DETAIL');
                logContext('File state changed, calling render.', 'SUB');
                previousFileState = newState.file; // Update previous state
                render();
            } else {
                logContext('File state unchanged, skipping render.', 'SUB');
            }
        });

        // Perform initial render based on current store state
        logContext('Performing initial render.', 'MOUNT');
        render(); 
        
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
             element.querySelectorAll('.breadcrumb-item.clickable, .breadcrumb-item.root').forEach(span => span.removeEventListener('click', handleBreadcrumbClick));
             const dirSelect = element.querySelector('#context-dir-select');
             if(dirSelect) dirSelect.removeEventListener('change', handleDirectoryDropdownChange);
             const mikeDirSelect = element.querySelector('#context-mike-dir-select');
             if(mikeDirSelect) mikeDirSelect.removeEventListener('change', handleMikeDirectorySelectChange);
             const fileSelect = element.querySelector('#context-item-select');
             if(fileSelect) fileSelect.removeEventListener('change', handleFileDropdownChange);
             // Optionally clear innerHTML on explicit destroy, but maybe not needed if parent removes the element
             // element.innerHTML = ''; 
             logContext(`Listeners removed from element during destroy.`, 'DESTROY'); 
        }
        element = null; // Release reference
        logContext('Component destroyed.', 'info');
    };

    // REMOVED pathJoin as it's now internal to fileManager.js
    // function pathJoin(...parts) { ... } 

    return { mount, destroy, render }; // Expose render if needed for manual triggers, otherwise just mount/destroy
}

// Helper function (can be moved if needed)
function pathJoin(...parts) {
    const filteredParts = parts.filter(part => part && part !== '/');
    if (filteredParts.length === 0) return '';
    return filteredParts.join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
} 