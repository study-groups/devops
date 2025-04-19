// client/components/ContextManagerComponent.js
import { eventBus } from '/client/eventBus.js';
import fileManager from '/client/fileManager.js';
import { appState } from '/client/appState.js';

const logContext = (message, level = 'debug') => {
    const type = "CTX";
    const fullType = type;

    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, fullType);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : (level === 'info' ? console.info : console.log));
        logFunc(`[${fullType}] ${message}`);
    }
};


export function createContextManagerComponent(targetElementId) {
    let element = null;
    let unsubscribeFunctions = []; // Store all unsubscribe functions

    // --- Rendering Logic --- 
    const render = () => {
        if (!element) return;
        const subtype = 'RENDER'; // Specific prefix
        logContext('Starting render logic', 'info');

        // Get necessary state
        const isLoading = fileManager.getIsLoading();
        const topDir = fileManager.getCurrentTopLevelDirectory();
        const relPath = fileManager.getCurrentRelativePath();
        const currentFile = fileManager.getCurrentFile(); 
        const currentListing = fileManager.getCurrentListing ? fileManager.getCurrentListing() : { dirs: [], files: [] }; // Default to empty
        const availableTopDirs = fileManager.getAvailableTopLevelDirs ? fileManager.getAvailableTopLevelDirs() : []; // Default to empty array
        const currentAuthState = appState.getState().auth;
        const isMikeAtRoot = currentAuthState.user?.username?.toLowerCase() === 'mike' && !topDir;
        const isOtherUserAtRoot = currentAuthState.isLoggedIn && !isMikeAtRoot && !topDir;
        
        logContext(`Render Check: User='${currentAuthState.user?.username}', TopDir='${topDir}', isMike@Root=${isMikeAtRoot}, AvailableTopDirs=[${availableTopDirs?.join(',')}]`, 'info');
        logContext(`State Used - isLoading: ${isLoading}, isMikeAtRoot: ${isMikeAtRoot}, topDir: ${topDir}, relPath: ${relPath}, file: ${currentFile}`, 'info');
        // Log listing only if not loading and not Mike@Root (where it's irrelevant)
        if (!isLoading && !isMikeAtRoot) {
             logContext(`Listing Used: Dirs=[${currentListing?.dirs?.join(', ')}], Files=[${currentListing?.files?.join(', ')}]`, subtype); 
        } else if (isMikeAtRoot) {
             logContext(`Available Top Dirs for Mike Selector: [${availableTopDirs.join(', ')}]`, subtype);
        }

        // --- Line 1: Generate Breadcrumbs (Refined Logic) --- 
        const separator = `<span class="breadcrumb-separator">/</span>`;
        // Always start with the clickable root link
        let breadcrumbsHTML = `<span class="breadcrumb-item root" data-target-top="" data-target-rel="" title="Go to Root">/</span>`;
        
        // Track if we have added any path segments after the root
        let addedPathSegment = false; 

        if (isMikeAtRoot) {
            logContext( `Rendering Mike@Root selector`,subtype);
            // Add selector right after root, no separator needed yet
            if (!isLoading && availableTopDirs.length > 0) {
                let mikeDirOptions = `<option value="" selected disabled>Directory...</option>`;
                availableTopDirs.sort();
                availableTopDirs.forEach(dir => { mikeDirOptions += `<option value="${dir}">${dir}/</option>`; });
                // CORRECTED: Remove separator before Mike's directory selector when at root
                // breadcrumbsHTML += `${separator}<select id="context-mike-dir-select" class="breadcrumb-dir-select" title="Select Directory">${mikeDirOptions}</select>`; 
                breadcrumbsHTML += ` <select id="context-mike-dir-select" class="breadcrumb-dir-select" title="Select Directory">${mikeDirOptions}</select>`; // Added space for visual separation
                addedPathSegment = true;
            }
        } else if (isOtherUserAtRoot) {
            logContext(`Rendering OtherUser@Root info`,subtype);
            // Add username info right after root, add separator before
            breadcrumbsHTML += `${separator}<span class="breadcrumb-info" title="Current User">${currentAuthState.user?.username}</span>`;
            addedPathSegment = true;
        } else if (currentAuthState.isLoggedIn && topDir) {
            logContext(`Rendering standard user path`,subtype);
            let pathSegmentsArray = [];
            
            // Add topDir span first (always add separator before this)
            pathSegmentsArray.push(`<span class="breadcrumb-item" data-target-top="${topDir}" data-target-rel="" title="Go to ${topDir}">${topDir}</span>`);
            
            // Add intermediate relative path parts
            const pathParts = relPath.split('/').filter(p => p);
            let cumulativePath = '';
            pathParts.forEach((part, index) => {
                cumulativePath = pathJoin(cumulativePath, part);
                pathSegmentsArray.push(`<span class="breadcrumb-item" data-target-top="${topDir}" data-target-rel="${cumulativePath}" title="Go to ${part}">${part}</span>`);
            });

            // Add Subdirectory selector segment at the end if conditions met
            if (!isLoading) {
                const dirs = currentListing?.dirs || [];
                if (dirs.length > 0) {
                    let dirOptionsHTML = `<option value="" selected disabled>Subdirectory...</option>`;
                    dirs.sort();
                    dirs.forEach(dir => { dirOptionsHTML += `<option value="${dir}">${dir}/</option>`; });
                    pathSegmentsArray.push(`<select id="context-dir-select" class="breadcrumb-dir-select" title="Select Subdirectory">${dirOptionsHTML}</select>`);
                }
            }
            
            // Join the path segments with separators and add to the initial root link
            if (pathSegmentsArray.length > 0) {
                 // CORRECTED: Join the array with the separator, and append that *directly* after the initial root `/`.
                 // The separator will only appear *between* the items in the array.
                 // breadcrumbsHTML += separator + pathSegmentsArray.join(separator); // OLD INCORRECT LOGIC
                 breadcrumbsHTML += ` ${pathSegmentsArray.join(separator)}` // Add space for visual separation from root?
                 // If no space needed: breadcrumbsHTML += pathSegmentsArray.join(separator);
                 addedPathSegment = true;
            }
        }
        
        logContext(`inal Breadcrumbs HTML: ${breadcrumbsHTML}`, subtype);
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
            <div class="context-selection-row">                ${fileSelectorHTML} 
                <div class="file-action-buttons">                    <button id="save-btn" data-action="saveFile" title="Save Current File" ${isLoading || !currentFile || isMikeAtRoot ? 'disabled' : ''}>Save</button>
                    <button id="community-link-btn" data-action="toggleCommunityLink" title="Add to Community Files" ${isLoading || !currentFile || isMikeAtRoot ? 'disabled' : ''}>Link</button>
                </div>
            </div>
        `;
        logContext(`innerHTML updated.`, subtype);

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
        
        logContext(`Event listeners attached. END.`, subtype);
    };

    // --- Event Handlers --- 
    const handleBreadcrumbClick = (event) => {
        // Use currentTarget to ensure we reference the element the listener is attached to
        const targetSpan = event.currentTarget; 
        const top = targetSpan.dataset.targetTop;
        const rel = targetSpan.dataset.targetRel;
        logContext(`Breadcrumb click: Top='${top}', Rel='${rel}'`,"EVENT");

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
        logContext(`File dropdown change: Selected file='${selectedValue}'`,"EVENT");
        // Emit navigate:file, value is just the filename
        eventBus.emit('navigate:file', { filename: selectedValue }); 
    };

    const handleDirectoryDropdownChange = (event) => {
        const selectedValue = event.target.value;
        if (!selectedValue) return;
        logContext(`Directory dropdown change: Selected directory='${selectedValue}'`,"EVENT");
        eventBus.emit('navigate:directory', { directory: selectedValue });
    };
    
    // ADDED: Handler for Mike's directory selector
    const handleMikeDirectorySelectChange = (event) => {
        const selectedDir = event.target.value;
        if (!selectedDir) return;
        logContext(`Mike directory select CHANGE event fired. Selected: '${selectedDir}'`, "EVENT");
        logContext(`Mike directory select change: Selected directory='${selectedDir}'`,"EVENT");
        // This selection sets the top-level directory
        eventBus.emit('navigate:topLevelDir', { directory: selectedDir });
    };

    // --- State/Event Subscriptions --- 
    const handleStateUpdate = (eventData = {}) => {
        const eventType = eventData.eventType || 'unknown';
        logContext(`Received event: ${eventType}. Triggering render.`,'EVENT');
        render(); // Re-render on any relevant state change from fileManager
    };

    // --- Lifecycle Methods --- 
    const mount = () => {
        logContext('Mounting...','info');
        element = document.getElementById(targetElementId);
        if (!element) {
            logContext(`Target element #${targetElementId} not found.`, 'error');
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
            logContext(`Subscribed to fileManager event: ${eventName}`, "info");
        });

        // REMOVED: Subscription to authState changes -> Re-enable this block
        // Uncomment the following block
        const authUnsubscribe = appState.subscribe((newState, prevState) => {
            // Only re-render if the auth part of the state has changed
            if (newState.auth !== prevState.auth) {
                logContext(`Received authState update: user=${newState.auth.user?.username}, authenticated=${newState.auth.isLoggedIn}`, 'EVENT', 'AUTH');
                handleStateUpdate({ eventType: 'authStateChanged' });
            }
        });
        unsubscribeFunctions.push(() => { 
            authUnsubscribe(); 
            logContext('Unsubscribed from authState', 'EVENT', 'AUTH');
        });
        logContext('Subscribed to authState', 'info');
        

        // Initial Render (will use current fileManager state)
        render(); 

        logContext('Mounted.',"COMPLETE");
        return true;
    };

    const destroy = () => {
        logContext('Destroying...');
        // Unsubscribe from all stored events
        unsubscribeFunctions.forEach(unsub => unsub());
        unsubscribeFunctions = [];

        if (element) {
            element.innerHTML = ''; // Clear content
        }
        element = null;
        logContext('Destroyed.');
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