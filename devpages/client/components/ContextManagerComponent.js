// client/components/ContextManagerComponent.js
import { eventBus } from '/client/eventBus.js';
// Import necessary functions from fileManager - Use default export
import fileManager from '/client/fileManager.js';
// Import authState to check the current user
import { authState } from '/client/authState.js';

// Assuming logMessage is globally available or import correctly
// import { logMessage } from '/client/log/index.js'; 

const logCtx = (message, level = 'debug') => { // Renamed log function
    const prefix = '[CTX_MGR]';
    if (typeof window.logMessage === 'function') {
        // Map 'debug' to 'text' or handle specific levels if logMessage supports them
        const logLevel = level === 'debug' ? 'text' : level;
        window.logMessage(`${prefix} ${message}`, logLevel);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
};


export function createContextManagerComponent(targetElementId) {
    let element = null;
    let unsubscribeFunctions = []; // Store all unsubscribe functions

    // --- Rendering Logic --- 
    const render = () => {
        if (!element) return;
        const logPrefix = '[CTX_MGR_RENDER]'; // Specific prefix
        logCtx(`${logPrefix} START`);

        // Get necessary state
        const isLoading = fileManager.getIsLoading();
        const topDir = fileManager.getCurrentTopLevelDirectory();
        const relPath = fileManager.getCurrentRelativePath();
        const currentFile = fileManager.getCurrentFile(); 
        const currentListing = fileManager.getCurrentListing ? fileManager.getCurrentListing() : { dirs: [], files: [] }; // Default to empty
        const availableTopDirs = fileManager.getAvailableTopLevelDirs ? fileManager.getAvailableTopLevelDirs() : []; // Default to empty array
        const currentUser = authState.get();
        const isMikeAtRoot = currentUser.username?.toLowerCase() === 'mike' && !topDir;
        const isOtherUserAtRoot = currentUser.isAuthenticated && !isMikeAtRoot && !topDir;
        
        logCtx(`${logPrefix} State Used - isLoading: ${isLoading}, isMikeAtRoot: ${isMikeAtRoot}, topDir: ${topDir}, relPath: ${relPath}, file: ${currentFile}`);
        // Log listing only if not loading and not Mike@Root (where it's irrelevant)
        if (!isLoading && !isMikeAtRoot) {
             logCtx(`${logPrefix} Listing Used: Dirs=[${currentListing?.dirs?.join(', ')}], Files=[${currentListing?.files?.join(', ')}]`); 
        } else if (isMikeAtRoot) {
             logCtx(`${logPrefix} Available Top Dirs for Mike Selector: [${availableTopDirs.join(', ')}]`);
        }

        // --- Line 1: Generate Breadcrumbs (New Approach) --- 
        const separator = `<span class="breadcrumb-separator">/</span>`;
        let breadcrumbsHTML = `<span class="breadcrumb-item root" data-target-top="" data-target-rel="" title="Go to Root">/</span>`;
        let isFirstNamedDirectory = true;  // State variable to track first named directory

        // Handle different cases without adding separator for root-level cases
        if (isMikeAtRoot) {
            logCtx(`${logPrefix} Determining Mike@Root post-root content`);
            if (!isLoading && availableTopDirs.length > 0) {
                let mikeDirOptions = `<option value="" selected disabled>Directory...</option>`;
                availableTopDirs.sort();
                availableTopDirs.forEach(dir => { mikeDirOptions += `<option value="${dir}">${dir}/</option>`; });
                breadcrumbsHTML += `<select id="context-mike-dir-select" class="breadcrumb-dir-select" title="Select Directory">${mikeDirOptions}</select>`;
            }
        } else if (isOtherUserAtRoot) {
            logCtx(`${logPrefix} Determining OtherUser@Root post-root content`);
            breadcrumbsHTML += `<span class="breadcrumb-info" title="Current User">${currentUser.username}</span>`;
        } else if (currentUser.isAuthenticated && topDir) {
            logCtx(`${logPrefix} Determining standard user post-root content`);
            let pathSegmentsArray = [];
            // Add topDir span first
            pathSegmentsArray.push(`<span class="breadcrumb-item" data-target-top="${topDir}" data-target-rel="" title="Go to ${topDir}">${topDir}</span>`);
            isFirstNamedDirectory = false;  // Mark that we've added the first directory
            
            const pathParts = relPath.split('/').filter(p => p);
            let cumulativePath = '';
            pathParts.forEach((part, index) => {
                cumulativePath = pathJoin(cumulativePath, part);
                pathSegmentsArray.push(`<span class="breadcrumb-item" data-target-top="${topDir}" data-target-rel="${cumulativePath}" title="Go to ${part}">${part}</span>`);
            });

            // Add Subdirectory selector segment if conditions met
            if (!isLoading) {
                const dirs = currentListing?.dirs || [];
                if (dirs.length > 0) {
                    let dirOptionsHTML = `<option value="" selected disabled>Subdirectory...</option>`;
                    dirs.sort();
                    dirs.forEach(dir => { dirOptionsHTML += `<option value="${dir}">${dir}/</option>`; });
                    pathSegmentsArray.push(`<select id="context-dir-select" class="breadcrumb-dir-select" title="Select Subdirectory">${dirOptionsHTML}</select>`);
                }
            }
            
            // Only add separator and path segments if we have segments
            if (pathSegmentsArray.length > 0) {
                // Don't add separator before first named directory
                breadcrumbsHTML += (isFirstNamedDirectory ? '' : separator) + pathSegmentsArray.join(separator);
            }
        }
        
        logCtx(`${logPrefix} Final Breadcrumbs HTML: ${breadcrumbsHTML}`);
        // --- End Line 1 ---
        
        // --- Line 2: Generate File Selector --- 
        let fileSelectorHTML = '';
        // Determine file selector content based on state
         if (isLoading) {
             fileSelectorHTML = `<select id="context-item-select-loading" class="context-selector" title="Select File" disabled><option>Loading Files...</option></select>`;
         } else if (isMikeAtRoot) {
             // Mike doesn't select files when at root
             fileSelectorHTML = `<select id="context-item-select-disabled" class="context-selector" title="Select File" disabled><option>Select directory above</option></select>`;
         } else if (topDir) {
            // Standard File Selector
            const files = currentListing?.files || [];
            const hasListingData = currentListing && currentListing.files !== undefined;
            if (files.length > 0) {
                 let fileOptionsHTML = `<option value="" ${!currentFile ? 'selected' : ''} disabled>Select file...</option>`;
                 files.sort((a, b) => a.localeCompare(b));
                 files.forEach(file => {
                     const isSelected = file === currentFile;
                     fileOptionsHTML += `<option value="${file}" ${isSelected ? 'selected' : ''}>${file}</option>`;
                 });
                 fileSelectorHTML = `<select id="context-item-select" class="context-selector" title="Select File">${fileOptionsHTML}</select>`;
            } else {
                 // Show disabled selector if no files found (and not loading)
                 fileSelectorHTML = `<select id="context-item-select-empty" class="context-selector" title="Select File" disabled><option>${hasListingData ? 'No files found' : 'Loading...'}</option></select>`;
            }
        } else {
             // Default placeholder when no directory context is selected (and not Mike)
             fileSelectorHTML = `<select id="context-item-select-placeholder" class="context-selector" title="Select File" disabled><option>Select directory context</option></select>`;
        }
        // --- End Line 2 Selector --- 

        // --- Final Assembly (CONFIRMED Two Lines) --- 
        element.innerHTML = `
            <div class="context-breadcrumbs">${breadcrumbsHTML}</div>
            <div class="context-selection-row">
                ${fileSelectorHTML} 
                <div class="file-action-buttons">
                    <button id="save-btn" data-action="saveFile" title="Save Current File" ${isLoading || !currentFile || isMikeAtRoot ? 'disabled' : ''}>Save</button>
                    <button id="community-link-btn" title="Add to Community Files" ${isLoading || !currentFile || isMikeAtRoot ? 'disabled' : ''}>Link</button>
                </div>
            </div>
        `;
        logCtx(`${logPrefix} innerHTML updated.`);

        // --- Re-attach Event Listeners --- 
        element.querySelectorAll('.breadcrumb-item').forEach(span => {
             if (span.dataset.targetTop !== undefined) { 
                 span.addEventListener('click', handleBreadcrumbClick);
             }
        });
        const dirSelectElement = element.querySelector('#context-dir-select');
        if (dirSelectElement) { dirSelectElement.addEventListener('change', handleDirectoryDropdownChange); }
        
        const mikeDirSelectElement = element.querySelector('#context-mike-dir-select');
        if (mikeDirSelectElement) { mikeDirSelectElement.addEventListener('change', handleMikeDirectorySelectChange); }
        
        const fileSelectElement = element.querySelector('#context-item-select');
        if (fileSelectElement) { fileSelectElement.addEventListener('change', handleFileDropdownChange); }
        
        logCtx(`${logPrefix} Event listeners attached. END.`);
    };

    // --- Event Handlers --- 
    const handleBreadcrumbClick = (event) => {
        const target = event.target;
        const top = target.dataset.targetTop;
        const rel = target.dataset.targetRel;
        logCtx(`Breadcrumb click: Top='${top}', Rel='${rel}'`);

        // --- Emit appropriate navigation event --- 
        if (top === '') {
             // Clicked root breadcrumb
             eventBus.emit('navigate:root'); 
        } else if (rel === '') {
            // Clicked top-level dir breadcrumb
             eventBus.emit('navigate:topLevelDir', { directory: top });
        } else {
            // Clicked intermediate path breadcrumb
            eventBus.emit('navigate:absolute', { topLevelDir: top, relativePath: rel }); 
        }
    };

    const handleFileDropdownChange = (event) => {
        const selectedValue = event.target.value;
        if (!selectedValue) return;
        logCtx(`File dropdown change: Selected file='${selectedValue}'`);
        // Emit navigate:file, value is just the filename
        eventBus.emit('navigate:file', { filename: selectedValue }); 
    };

    const handleDirectoryDropdownChange = (event) => {
        const selectedValue = event.target.value;
        if (!selectedValue) return;

        logCtx(`Directory dropdown change: Selected directory='${selectedValue}'`);
        eventBus.emit('navigate:directory', { directory: selectedValue });
    };
    
    // ADDED: Handler for Mike's directory selector
    const handleMikeDirectorySelectChange = (event) => {
        const selectedDir = event.target.value;
        if (!selectedDir) return;
        logCtx(`Mike directory select change: Selected directory='${selectedDir}'`);
        // This selection sets the top-level directory
        eventBus.emit('navigate:topLevelDir', { directory: selectedDir });
    };

    // --- State/Event Subscriptions --- 
    const handleStateUpdate = (eventData = {}) => {
        const eventType = eventData.eventType || 'unknown';
        logCtx(`[CTX_MGR_EVENT] Received event: ${eventType}. Triggering render.`);
        render(); // Re-render on any relevant state change from fileManager
    };

    // --- Lifecycle Methods --- 
    const mount = () => {
        logCtx('Mounting...');
        element = document.getElementById(targetElementId);
        if (!element) {
            logCtx(`Target element #${targetElementId} not found.`, 'error');
            return false;
        }

        // Subscribe ONLY to fileManager events now
        const fmEventsToSubscribe = [
            'fileManager:stateSettled',
            'fileManager:listingLoaded',
            'fileManager:loadingStateChanged' // Keep loading state for disabling UI
            // Removed file:loaded/loadError as stateSettled should cover necessary rerenders
        ];

        fmEventsToSubscribe.forEach(eventName => {
            const handler = (data) => handleStateUpdate({ ...data, eventType: eventName });
            eventBus.on(eventName, handler);
            unsubscribeFunctions.push(() => eventBus.off(eventName, handler));
            logCtx(`Subscribed to fileManager event: ${eventName}`);
        });

        // REMOVED: Subscription to authState changes
        /*
        const authUnsubscribe = authState.subscribe((newState) => {
            logCtx(`Received authState update: user=${newState.username}, authenticated=${newState.isAuthenticated}`);
            handleStateUpdate({ eventType: 'authStateChanged' }); // Trigger re-render
        });
        unsubscribeFunctions.push(() => { 
            authUnsubscribe(); 
            logCtx('Unsubscribed from authState'); 
        });
        logCtx('Subscribed to authState');
        */

        // Initial Render (will use current fileManager state)
        render(); 

        logCtx('Mounted.');
        return true;
    };

    const destroy = () => {
        logCtx('Destroying...');
        // Unsubscribe from all stored events
        unsubscribeFunctions.forEach(unsub => unsub());
        unsubscribeFunctions = [];

        if (element) {
            element.innerHTML = ''; // Clear content
        }
        element = null;
        logCtx('Destroyed.');
    };
    
     // Simple path join helper needed for breadcrumbs
    function pathJoin(...parts) {
        const filteredParts = parts.filter(part => part && part !== '/');
        if (filteredParts.length === 0) return '';
        return filteredParts.join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    }

    return {
        mount,
        destroy
    };
} 