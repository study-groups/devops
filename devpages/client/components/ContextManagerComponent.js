// client/components/ContextManagerComponent.js
// REMOVE: import fileManager from '/client/filesystem/fileManager.js'; // No longer needed for state
import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js'; // Use central state for context
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js'; // Ensure these handle relative paths correctly ('', 'a', 'a/b')

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
        const isFileLoading = !isAuthInitializing && (!fileState.isInitialized || fileState.isLoading);
        const isOverallLoading = isAuthInitializing || isFileLoading || !!fetchingParentPath;
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

        logContext(`State Snapshot - Relative Pathname: '${currentPathname}', isDirectorySelected: ${isDirectorySelected}`);
        logContext(`State Snapshot - Auth: User='${username}', Role=${userRole}, isAdmin=${isAdmin}`);
        logContext(`Component State - activeSiblingDropdownPath: ${activeSiblingDropdownPath}, fetchingParentPath: ${fetchingParentPath}`);
        logContext(`Derived - selectedDirectoryPath: '${selectedDirectoryPath}', selectedFilename: '${selectedFilename}'`);


        // --- Line 1: Generate Breadcrumbs (Refactored with Corrected Prefix Handling) ---
        const separator = `<span class="breadcrumb-separator">/</span>`;
        let breadcrumbsHTML = '';
        // *** Corrected Prefix: Use the base directory DevPages uses ***
        // Match the prefix reported by the server log "[SERVER] Using MD_DIR: ..."
        // Ensure this includes the trailing slash if the server paths do.
        const CONTENT_ROOT_PREFIX = '/root/pj/pd/data/'; // <-- CHANGE THIS LINE

        if (isAuthInitializing || !isAuthenticated) {
            breadcrumbsHTML = `<span class="breadcrumb-info">${isAuthInitializing ? 'Authenticating...' : 'Please log in'}</span>`;
        } else {
            // --- Determine path characteristics and strip prefix ---
            let displayPathname = currentPathname;
            let detectedPrefix = ''; // Store the prefix actually found
            if (currentPathname !== null && currentPathname.startsWith(CONTENT_ROOT_PREFIX)) {
                 displayPathname = currentPathname.substring(CONTENT_ROOT_PREFIX.length);
                 detectedPrefix = CONTENT_ROOT_PREFIX;
                 logContext(`Detected and stripped prefix: '${CONTENT_ROOT_PREFIX}'. Display path: '${displayPathname}'`, 'DEBUG');
            } else if (currentPathname !== null) {
                 logContext(`Warning: currentPathname '${currentPathname}' does not start with expected prefix '${CONTENT_ROOT_PREFIX}'`, 'WARN');
                 displayPathname = currentPathname;
                 detectedPrefix = '';
            }


            const isEffectivelyAtRoot = displayPathname === null || displayPathname === '';
            const breadcrumbSegments = [];

            // Create an enhanced first separator with technical info tooltip
            const enhancedFirstSeparator = `
              <span class="breadcrumb-separator root-separator" title="Directory Structure Information">
                /
                <div class="technical-info-tooltip">
                  <strong>Directory Structure:</strong><br>
                  <ul>
                    <li><strong>PD_DIR</strong>: Main data root (${CONTENT_ROOT_PREFIX})</li>
                    <li><strong>MD_DIR</strong>: Content root (PD_DIR/data)</li>
                    <li>User content in: <code>users/&lt;username&gt;</code> or <code>projects/&lt;username&gt;</code></li>
                    <li>Pathname: ${displayPathname || '(Root)'}</li>
                  </ul>
                </div>
              </span>`;

            breadcrumbSegments.push(enhancedFirstSeparator); // Use enhanced first separator

            // --- Admin Rendering ---
            if (isAdmin) {
                if (isEffectivelyAtRoot) {
                    // Admin at root ('/') - Selector logic unchanged
                    let adminRootSelectorHTML = '';
                    if (isFileLoading && availableTopLevelDirs.length === 0) {
                        adminRootSelectorHTML = `<select class="breadcrumb-dir-select admin-top-select" title="Select Top Directory" disabled><option>Loading Dirs...</option></select>`;
                    } else if (availableTopLevelDirs.length > 0) {
                        let adminDirOptions = `<option value="" selected disabled>Select Directory...</option>`;
                        const sortedDirs = [...availableTopLevelDirs].sort();
                        // Value should be the directory name (e.g., 'mike')
                        sortedDirs.forEach(dir => { adminDirOptions += `<option value="${dir}">${dir}</option>`; });
                        adminRootSelectorHTML = `<select id="context-root-dir-select" class="breadcrumb-dir-select admin-top-select" title="Select Top Directory">${adminDirOptions}</select>`;
                    } else if (!isFileLoading){
                        adminRootSelectorHTML = `<span class="breadcrumb-info">No top-level directories found.</span>`;
                    } else {
                        adminRootSelectorHTML = `<span class="breadcrumb-info">Loading Dirs...</span>`;
                    }
                    breadcrumbSegments.push(adminRootSelectorHTML);

                } else if (displayPathname) {
                    // Admin viewing a path (e.g., 'mike/notes')
                    const pathParts = displayPathname.split('/').filter(p => p); // Parts from display path
                    // Base for FULL path starts with the DETECTED prefix
                    let cumulativeFullPathBase = detectedPrefix.endsWith('/') ? detectedPrefix.slice(0,-1) : detectedPrefix;

                    pathParts.forEach((part, index) => { // 'part' is prefix-free
                        const cumulativeFullPath = pathJoin(cumulativeFullPathBase, part);
                        const isLastPart = index === pathParts.length - 1;

                        // --- Define isAdminTopLevelContext for the current part ---
                        const targetName = part; // part is the segment name, e.g., "mike"
                        const parentOfCumulativeFullPath = getParentPath(cumulativeFullPath);
                        // Ensure detectedPrefix comparison is robust (e.g. handle trailing slashes consistently or lack thereof)
                        const effectiveDetectedPrefixRoot = detectedPrefix ? (detectedPrefix.endsWith('/') ? detectedPrefix.slice(0, -1) : detectedPrefix) : '';
                        const isAdminTopLevelContext = isAdmin && availableTopLevelDirs.includes(targetName) && parentOfCumulativeFullPath === effectiveDetectedPrefixRoot;
                        // --- End definition ---

                        // --- MODIFICATION: Skip filename part for breadcrumbsHTML if file is selected ---
                        if (isLastPart && !isDirectorySelected && selectedFilename && part === selectedFilename) {
                            return; // Skip this file part, it's handled by fileSelectorHTML
                        }
                        // --- END MODIFICATION ---

                        const isDirectorySegmentForDisplay = !isLastPart || (isLastPart && isDirectorySelected);

                        let segmentContent = '';
                        if (isDirectorySegmentForDisplay) {
                            const isDropdownActiveForThisSegment = activeSiblingDropdownPath === cumulativeFullPath;
                            // Case 1: Dropdown for Admin Top-Level Selection is Active
                             if (isAdminTopLevelContext && isDropdownActiveForThisSegment) {
                                let siblingOptions = `<option value="" selected disabled>Select Top Dir...</option>`;
                                const sortedSiblings = [...availableTopLevelDirs].sort();
                                sortedSiblings.forEach(siblingDir => { siblingOptions += `<option value="${siblingDir}" ${siblingDir === part ? 'selected' : ''}>${siblingDir}/</option>`; });
                                segmentContent = `<select class="breadcrumb-dir-select admin-top-sibling-select" data-current-segment-path="${cumulativeFullPath}" title="Change Top-Level Directory">${siblingOptions}</select>`;
                            }
                            // Case 2: Dropdown for Regular Sibling Selection is Active
                            else if (!isAdminTopLevelContext && isDropdownActiveForThisSegment && parentListing?.dirs && parentListing.pathname === getParentPath(cumulativeFullPath)) {
                                let siblingOptions = `<option value="" selected disabled>Change directory...</option>`;
                                const parentPathForDropdown = getParentPath(cumulativeFullPath) ?? '';
                                const sortedSiblings = [...parentListing.dirs].sort();
                                sortedSiblings.forEach(siblingDir => { siblingOptions += `<option value="${siblingDir}" ${siblingDir === part ? 'selected' : ''}>${siblingDir}/</option>`; });
                                segmentContent = `<select class="breadcrumb-dir-select sibling-select" data-parent-path="${parentPathForDropdown}" data-current-segment-path="${cumulativeFullPath}" title="Select Sibling Directory">${siblingOptions}</select>`;
                            }
                            // Case 3: Loading Sibling Information
                            else if (fetchingParentPath === cumulativeFullPath) {
                                segmentContent = `<span class="breadcrumb-item loading-segment" title="Loading siblings...">${part}(...)</span>`;
                            }
                            // Case 4: Clickable Directory Span
                            else {
                                let spanClass = "breadcrumb-item intermediate-dir";
                                let spanTitle = `Go to ${part}`;

                                // *** ADD THIS CHECK for last selected directory ***
                                if (isLastPart && isDirectorySelected) {
                                    spanClass += " current-dir-segment"; // New class for styling
                                    // Optionally change title, e.g., remove sibling hint if desired
                                    // spanTitle = `Current directory: ${part}`;
                                }
                                // *** END ADDED CHECK ***

                                if (isAdminTopLevelContext) {
                                     spanClass += " admin-top-segment"; // Style admin top level differently if needed
                                     spanTitle += ` / Click to change`; // Title indicates clicking shows dropdown
                                } else { // Non-top level dirs (admin or user)
                                    spanTitle += ` / Click to see siblings`;
                                }
                                // data-target-pathname always uses the *full* path
                                segmentContent = `<span class="${spanClass}" data-target-pathname="${cumulativeFullPath}" title="${spanTitle}">${part}</span>`;
                                // The unified handleDirectorySpanClick handler will be attached later
                            }
                        } else {
                             // Case 5: Last part is a file
                             segmentContent = `<span class="breadcrumb-item current-file">${part}</span>`;
                        }
                        breadcrumbSegments.push(segmentContent);

                        // Separator only after directory segments that are actually added
                        if (isDirectorySegmentForDisplay) { // Check based on what was processed
                            breadcrumbSegments.push(separator);
                        }

                        // Update the base path for the next iteration
                        if (isDirectorySegmentForDisplay) { // Only update if we actually displayed this segment
                            cumulativeFullPathBase = cumulativeFullPath; // Update base for next iteration
                        }
                     });

                    // After the loop, if a file was selected and breadcrumbs end with a separator, remove it.
                    if (!isDirectorySelected && selectedFilename) {
                        if (breadcrumbSegments.length > 1 && breadcrumbSegments[breadcrumbSegments.length - 1] === separator) {
                            breadcrumbSegments.pop();
                        }
                    }
                 }
            } else if (username) {
                // Instead of just displaying the username, let's break down the full path
                // Add a root segment
                breadcrumbSegments.push(`<span class="breadcrumb-item root-segment">/</span>`);
                
                // Add "users" segment - make it clickable to help navigate up
                const usersPath = detectedPrefix + "users";
                breadcrumbSegments.push(`<span class="breadcrumb-item intermediate-dir" data-target-pathname="${usersPath}" title="Go to users directory">users</span>`);
                breadcrumbSegments.push(separator);
                
                // Add username segment
                const userRootFullPath = detectedPrefix + "users/" + username;
                breadcrumbSegments.push(`<span class="breadcrumb-item non-admin-top root-link" data-target-pathname="${userRootFullPath}" title="Your root directory">${username}</span>`);
                
                const isDeeperPath = displayPathname && displayPathname !== username && 
                                     (displayPathname.startsWith(username + '/') || 
                                      displayPathname.startsWith("users/" + username + '/'));
                
                if (isDeeperPath) {
                    breadcrumbSegments.push(separator);
                    
                    // Adjust path extraction to work with both formats:
                    let relativePath;
                    if (displayPathname.startsWith("users/" + username + '/')) {
                        relativePath = displayPathname.substring(("users/" + username).length + 1);
                    } else if (displayPathname.startsWith(username + '/')) {
                        relativePath = displayPathname.substring(username.length + 1);
                    } else {
                        relativePath = displayPathname;
                    }
                    
                    const userPathParts = relativePath.split('/').filter(p => p);
                    let cumulativeFullPathBase = userRootFullPath;
                    
                    userPathParts.forEach((part, index) => { // 'part' is prefix-free and relative to username
                        const cumulativeFullPath = pathJoin(cumulativeFullPathBase, part);
                         const isLastPart = index === userPathParts.length - 1;

                        // --- MODIFICATION: Skip filename part for breadcrumbsHTML if file is selected ---
                        if (isLastPart && !isDirectorySelected && selectedFilename && part === selectedFilename) {
                            return; // Skip this file part, it's handled by fileSelectorHTML
                        }
                        // --- END MODIFICATION ---

                         const isDirectorySegmentForDisplay = !isLastPart || (isLastPart && isDirectorySelected);

                         let segmentContent = '';
                          if (isDirectorySegmentForDisplay) {
                             const isDropdownActiveForThisSegment = activeSiblingDropdownPath === cumulativeFullPath;
                              // Case 1: Dropdown for Regular Sibling Selection is Active
                              if (isDropdownActiveForThisSegment && parentListing?.dirs && parentListing.pathname === getParentPath(cumulativeFullPath)) {
                                  let siblingOptions = `<option value="" selected disabled>Change directory...</option>`;
                                  const parentPathForDropdown = getParentPath(cumulativeFullPath) ?? '';
                                  const sortedSiblings = [...parentListing.dirs].sort();
                                  sortedSiblings.forEach(siblingDir => { siblingOptions += `<option value="${siblingDir}" ${siblingDir === part ? 'selected' : ''}>${siblingDir}/</option>`; });
                                  segmentContent = `<select class="breadcrumb-dir-select sibling-select" data-parent-path="${parentPathForDropdown}" data-current-segment-path="${cumulativeFullPath}" title="Select Sibling Directory">${siblingOptions}</select>`;
                              }
                              // Case 2: Loading Sibling Information
                              else if (fetchingParentPath === cumulativeFullPath) {
                                  segmentContent = `<span class="breadcrumb-item loading-segment" title="Loading siblings...">${part}(...)</span>`;
                              }
                               // Case 3: Clickable Directory Span (Non-top level)
                              else {
                                  let spanClass = "breadcrumb-item intermediate-dir";
                                  let spanTitle = `Go to ${part} / Click to see siblings`;
                                  // data-target-pathname uses the full path relative to user root
                                  segmentContent = `<span class="${spanClass}" data-target-pathname="${cumulativeFullPath}" title="${spanTitle}">${part}</span>`;
                                  // Attach handleDirectorySpanClick later
                              }
                          } else {
                             // Case 4: Last part is a file
                             segmentContent = `<span class="breadcrumb-item current-file">${part}</span>`;
                         }
                         breadcrumbSegments.push(segmentContent);

                          // Separator only after directory segments that are actually added
                         if (isDirectorySegmentForDisplay) { // Check based on what was processed
                            breadcrumbSegments.push(separator);
                         }

                         // Update the base path for the next iteration
                         cumulativeFullPathBase = cumulativeFullPath; // Update base for next iteration
                     });

                    // After the loop, if a file was selected and breadcrumbs end with a separator, remove it.
                    if (!isDirectorySelected && selectedFilename) {
                        if (breadcrumbSegments.length > 1 && breadcrumbSegments[breadcrumbSegments.length - 1] === separator) {
                            breadcrumbSegments.pop();
                        }
                    }
                } else if (currentPathname === userRootFullPath && isDirectorySelected) {
                     breadcrumbSegments.push(separator);
                }

            } else {
                // --- Fallback / Not Logged In / Context Loading ---
                 if (isFileLoading || authState.isInitializing) {
                     breadcrumbsHTML = `<span class="breadcrumb-info">Loading context...</span>`;
                 } else {
                     breadcrumbsHTML = `<span class="breadcrumb-info">Context unavailable</span>`;
                 }
            }
            breadcrumbsHTML = breadcrumbSegments.join('');
        }
        // --- End Line 1 Refined ---

        // --- Line 2: Generate Unified Primary Selector (Logic remains the same) ---
        let primarySelectorHTML = '';
        const listingForSelector = currentListing?.pathname === selectedDirectoryPath ? currentListing : null;

        if (isAuthInitializing || !isAuthenticated) {
            primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>Login Required</option></select>`;
        } else if (selectedDirectoryPath === null) { // Covers admin at root or user at root before selection
           primarySelectorHTML = `<select class="context-selector" title="Select Item" disabled><option>${isAdmin ? 'Select directory' : 'Select item...'}</option></select>`;
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


        // --- Final Assembly ---
        const saveDisabled = !isAuthenticated || isOverallLoading || isSaving || isDirectorySelected || currentPathname === null;
        logContext(`Save button disabled check: !isAuth=${!isAuthenticated}, isLoading=${isOverallLoading}, isSaving=${isSaving}, isDir=${isDirectorySelected}, noPath=${currentPathname === null}. Final: ${saveDisabled}`);

        element.innerHTML = `
            <div class="context-breadcrumbs">${breadcrumbsHTML}</div>
            <div class="context-selection-row">
                ${primarySelectorHTML}
                <div class="file-action-buttons">
                    <button id="save-btn" data-action="saveFile" title="Save Current File" ${saveDisabled ? 'disabled' : ''}>${isSaving ? 'Saving...' : 'Save'}</button>
                    <button id="publish-btn" title="Publish File">Publish</button>
                </div>
            </div>
        `;
        if (isSaving) element.querySelector('#save-btn')?.classList.add('saving');
        logContext(`innerHTML updated.`);

        // --- Re-attach Event Listeners ---
        // Non-admin root link
        element.querySelectorAll('.breadcrumb-item.non-admin-top.root-link').forEach(span => {
            span.removeEventListener('click', handleNavigateToPathname); // Generic handler for direct nav
            span.addEventListener('click', handleNavigateToPathname);
        });
        // Intermediate directory spans (both admin and user, excluding non-admin root)
        element.querySelectorAll('.breadcrumb-item.intermediate-dir').forEach(span => {
            span.removeEventListener('click', handleDirectorySpanClick); // Use the unified handler
            span.addEventListener('click', handleDirectorySpanClick);
        });
         // Sibling selection dropdowns (regular and admin top-level)
        element.querySelectorAll('.sibling-select, .admin-top-sibling-select').forEach(select => {
            select.removeEventListener('change', handleSiblingDirectorySelectChange);
            select.addEventListener('change', handleSiblingDirectorySelectChange);
        });
        // Admin root directory selector (shown only when admin is at '/')
        element.querySelectorAll('.admin-top-select').forEach(select => {
             select.removeEventListener('change', handleRootDirectorySelectChange);
             select.addEventListener('change', handleRootDirectorySelectChange);
        });
        // Primary item selector
        const primarySelectElement = element.querySelector('#context-primary-select');
        if (primarySelectElement) {
             primarySelectElement.removeEventListener('change', handlePrimarySelectChange);
             primarySelectElement.addEventListener('change', handlePrimarySelectChange);
        }
        // Action buttons
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

        // Add a click handler for the technical info
        const techInfoSeparator = element.querySelector('#tech-info-separator');
        if (techInfoSeparator) {
            techInfoSeparator.removeEventListener('click', handleTechInfoClick);
            techInfoSeparator.addEventListener('click', handleTechInfoClick);
        }

        logContext(`Event listeners (re)attached. Render END.`);
    };

    // --- Event Handlers (Updated for pathname) ---

    // Generic handler for spans/links that directly navigate to a path
    const handleNavigateToPathname = (event) => {
         const relativePathname = event.currentTarget.dataset.targetPathname; // Should be relative
         logContext(`Navigate direct: Relative Pathname='${relativePathname}'`, "EVENT");
         activeSiblingDropdownPath = null; fetchingParentPath = null;
         eventBus.emit('navigate:pathname', { pathname: relativePathname, isDirectory: true }); // Emit relative path
    };

    // --- Unified handler for clickable directory spans ---
    const handleDirectorySpanClick = (event) => {
        const targetRelativePathname = event.currentTarget.dataset.targetPathname; // Should be relative
        if (targetRelativePathname === null || targetRelativePathname === undefined) return;
        logContext(`Directory span click: Relative Path='${targetRelativePathname}'`, "EVENT");

        const previouslyActiveDropdown = activeSiblingDropdownPath;
        const previouslyFetching = fetchingParentPath;

        // Reset dropdown states immediately
        activeSiblingDropdownPath = null;
        fetchingParentPath = null;

        // --- Action 1: Always navigate to the clicked directory ---
        eventBus.emit('navigate:pathname', { pathname: targetRelativePathname, isDirectory: true });

        // --- Action 2: If the same path wasn't already fetching or showing a dropdown, prepare to show it ---
        // This allows clicking an active segment to *just* navigate and close the dropdown.
        if (previouslyActiveDropdown === targetRelativePathname || previouslyFetching === targetRelativePathname) {
             logContext(`Clicked segment (${targetRelativePathname}) that was active/fetching. Clearing dropdown/fetch state only.`, "EVENT");
             // State is already cleared above. Render will happen due to navigation event.
             return;
        }

        // Determine if we should show admin top-level or regular siblings based on the targetPathname
        const currentState = appStore.getState();
        const isAdmin = currentState.auth.user?.role === 'admin';
        const fileState = currentState.file;
        const availableTopLevelDirs = fileState.availableTopLevelDirs || [];

        // Check if it's effectively a top-level directory click for an admin
        const targetName = targetRelativePathname.split('/')[0]; // Get the first part after prefix
        const isAdminTopLevelClick = isAdmin && availableTopLevelDirs.includes(targetName) && getParentPath(targetRelativePathname) === '';

        logContext(`Directory span click: isAdminTopLevelClick=${isAdminTopLevelClick}`, "EVENT");

        if (isAdminTopLevelClick) {
            // Target is a top-level directory (for admin)
            if (availableTopLevelDirs.length > 0) {
                 logContext(`Setting activeSiblingDropdownPath for top-level: ${targetRelativePathname}`, "EVENT");
                 activeSiblingDropdownPath = targetRelativePathname; // Set state for next render to show dropdown
             } else {
                 logContext(`Top-level dirs not available for dropdown.`, "EVENT");
                 // activeSiblingDropdownPath is already null
             }
        } else {
            // Target is a non-top-level directory (or user clicking within their dir)
            const parentRelativePath = getParentPath(targetRelativePathname);
            // Check if parent listing is already loaded in the state
            if (fileState.parentListing && fileState.parentListing.pathname === parentRelativePath && fileState.parentListing.dirs) {
                 logContext(`Setting activeSiblingDropdownPath for non-top-level: ${targetRelativePathname}`, "EVENT");
                 activeSiblingDropdownPath = targetRelativePathname; // Set state for next render
            } else {
                 logContext(`Requesting parent listing fetch for parent of: ${targetRelativePathname}`, "EVENT");
                 fetchingParentPath = targetRelativePathname; // Set state to indicate loading for this target
                 activeSiblingDropdownPath = null; // Ensure dropdown isn't shown while fetching
                 // Emit event to trigger the actual fetch in file manager / app state
                 eventBus.emit('context:requestParentListing', { parentPath: parentRelativePath, triggerPath: targetRelativePathname }); // Send parent path needed
            }
        }
        // No manual render needed here; the navigation event + potential state updates for dropdown/fetching
        // will trigger the store subscription, which calls render(). Render reads the new activeSibling/fetching state.
    };


    const handleSiblingDirectorySelectChange = (event) => {
        const selectedValue = event.target.value; // The directory name (e.g., 'notes' or 'jane')
        if (!selectedValue) return;

        const currentSegmentPath = event.target.dataset.currentSegmentPath; // Full path where dropdown appeared
        let newRelativePath;
        const CONTENT_ROOT_PREFIX = '/root/pj/pd/data/'; // <-- Use the same constant

        if (event.target.classList.contains('admin-top-sibling-select')) {
             // Admin changing top-level dir
             let prefix = '';
             // Check if context path starts with the known prefix
             if (currentSegmentPath && currentSegmentPath.startsWith(CONTENT_ROOT_PREFIX)) {
                 prefix = CONTENT_ROOT_PREFIX;
             } else if (currentSegmentPath) {
                 // Log if prefix doesn't match expectation
                 logContext(`Warning: Admin top-sibling select context path '${currentSegmentPath}' doesn't start with expected prefix '${CONTENT_ROOT_PREFIX}'`, 'WARN', 'EVENT');
                 // Attempt recovery? Maybe assume prefix anyway if context seems root-level? Risky.
                 // For now, stick to detected prefix logic. If currentSegmentPath is 'mike', prefix will be ''.
             }

             newRelativePath = prefix + selectedValue; // Construct full path: prefix + selected dir name
             logContext(`Admin top-level sibling change: Selected='${selectedValue}', Prefix='${prefix}', New Relative Path='${newRelativePath}'`, "EVENT");
        } else {
             // Regular sibling directory change
             const parentRelativePath = event.target.dataset.parentPath; // Full parent path
             newRelativePath = pathJoin(parentRelativePath, selectedValue); // Join full parent + selected dir name
             logContext(`Regular sibling directory change: Parent Relative='${parentRelativePath}', Selected='${selectedValue}', New Relative Path='${newRelativePath}'`, "EVENT");
        }

        activeSiblingDropdownPath = null; // Deactivate dropdown
        fetchingParentPath = null;
        eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: true }); // Navigate to full path
    };

    // Handles the dropdown shown only when admin is at root ('/')
    const handleRootDirectorySelectChange = (event) => {
         const selectedDir = event.target.value; // e.g., "data"
         if (!selectedDir) return;
         logContext(`Root directory select change: Selected dir='${selectedDir}' (relative path)`, "EVENT");
         activeSiblingDropdownPath = null;
         fetchingParentPath = null;
         // The selected directory name IS the relative path from root
         eventBus.emit('navigate:pathname', { pathname: selectedDir, isDirectory: true });
    };

    // handlePrimarySelectChange remains mostly the same, ensures pathJoin uses correct base
     const handlePrimarySelectChange = (event) => {
        const selectedOption = event.target.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) return; // Ignore "Select item..."

        const selectedValue = selectedOption.value; // e.g., "subdir" or "myfile.md"
        const selectedType = selectedOption.dataset.type; // "dir" or "file"

        // --- Get the base directory path FROM THE CURRENT STATE ---
        const fileState = appStore.getState().file;
        const currentPathname = fileState.currentPathname; // This should be the relative path
        const isDirectorySelected = fileState.isDirectorySelected;

        // Determine the base directory relative path at the moment the handler runs
        let baseRelativeDirectoryPath = null;
        if (currentPathname !== null) {
             // If a directory is selected, its path is the base.
             // If a file is selected, the parent path is the base.
             baseRelativeDirectoryPath = isDirectorySelected ? currentPathname : getParentPath(currentPathname);
        }
        // Handle potential null/empty base path (e.g., at root '')
        // If currentPathname is '' (root) and a directory is selected, the base is ''
        if (baseRelativeDirectoryPath === null || baseRelativeDirectoryPath === undefined) {
            if (currentPathname === '' && isDirectorySelected) {
                 baseRelativeDirectoryPath = ''; // Base is the root
             } else {
                 // Log an error if we still can't determine the base
                 logContext(`Error: Cannot determine base directory for primary selection. State Pathname: ${currentPathname}, isDirSelected: ${isDirectorySelected}`, 'error', 'EVENT');
                 alert("Error determining current directory. Cannot navigate.");
                 return;
             }
        }
        // --- End base directory calculation ---

        // Now join the relative base path with the selected item name
        const newRelativePath = pathJoin(baseRelativeDirectoryPath, selectedValue); // Joins relative paths
        logContext(`Primary select change: Base Relative='${baseRelativeDirectoryPath}', Selected='${selectedValue}', Type='${selectedType}', New Relative Path='${newRelativePath}'`, "EVENT");

        // Reset interaction states
        activeSiblingDropdownPath = null;
        fetchingParentPath = null;

        // Emit navigation event based on type using the new relative path
        if (selectedType === 'dir') {
            eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: true });
        } else if (selectedType === 'file') {
            eventBus.emit('navigate:pathname', { pathname: newRelativePath, isDirectory: false });
        } else {
            logContext(`Unknown item type selected: ${selectedType}`, 'warning', 'EVENT');
        }
    };


    // --- Info Popup Handler (No changes needed for this refactor) ---
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

    // --- Action Button Handlers (No changes needed for this refactor) ---
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

    // *** Add/Modify the Publish Button Click Handler ***
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

        // *** Call the action from triggerActions ***
        if (typeof window.triggerActions?.publishToSpaces === 'function') {
            logContext('Calling triggerActions.publishToSpaces()', 'debug', 'EVENT');
            window.triggerActions.publishToSpaces(); // Assumes actions.js makes triggerActions global
        } else {
            logContext('Cannot publish: triggerActions.publishToSpaces is not available.', 'error', 'EVENT');
            alert('Publish action is not configured correctly.');
            // Optionally log error to main console for debugging
            console.error("triggerActions.publishToSpaces is not defined on window.");
        }
    };

    // Define the handler
    const handleTechInfoClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Create a modal or use an existing popup mechanism
        const infoContent = `
            <h3>Directory Structure</h3>
            <ul>
                <li><strong>PD_DIR</strong>: Main data root</li>
                <li><strong>MD_DIR</strong>: Content root (PD_DIR/data)</li>
                <li>User content lives in: users/&lt;username&gt; or projects/&lt;username&gt;</li>
                <li>Current pathname: ${appStore.getState().file.currentPathname || '(Root)'}</li>
            </ul>
            <p>The system automatically checks both locations when resolving paths.</p>
        `;
        
        // Show in a modal, alert, or custom popup element
        showInfoPopup(infoContent, event.currentTarget);
    };

    // --- Component Lifecycle ---
    const mount = () => {
        element = document.getElementById(targetElementId);
        if (!element) {
            logContext(`Target element #${targetElementId} not found. Cannot mount.`, 'error');
            return false;
        }
        logContext(`Mounting component to #${targetElementId}`, 'MOUNT');

        // --- Store Subscription ---
        if (storeUnsubscribe) {
             logContext('Warning: mount called again without destroy, unsubscribing previous listener.', 'warn');
             storeUnsubscribe();
             storeUnsubscribe = null;
        }

        // Keep track of previous relevant state parts to minimize renders
        let previousAuthState = appStore.getState().auth;
        let previousFileState = appStore.getState().file;
        // Include component's local interactive state in the check
        let previousActiveDropdownPath = activeSiblingDropdownPath;
        let previousFetchingPath = fetchingParentPath;

        storeUnsubscribe = appStore.subscribe(currentState => {
            const newAuthState = currentState.auth;
            const newFileState = currentState.file;

            // --- Check for relevant state changes ---
            const authRelevantChanged =
                 newAuthState.isInitializing !== previousAuthState.isInitializing ||
                 newAuthState.isAuthenticated !== previousAuthState.isAuthenticated ||
                 newAuthState.user?.role !== previousAuthState.user?.role || // Check role change
                 newAuthState.user?.username !== previousAuthState.user?.username; // Check username change

            const fileRelevantChanged =
                 newFileState.isInitialized !== previousFileState.isInitialized ||
                 newFileState.isLoading !== previousFileState.isLoading ||
                 newFileState.isSaving !== previousFileState.isSaving ||
                 newFileState.currentPathname !== previousFileState.currentPathname ||
                 newFileState.isDirectorySelected !== previousFileState.isDirectorySelected ||
                 newFileState.currentListing !== previousFileState.currentListing || // Shallow compare is okay here
                 newFileState.parentListing !== previousFileState.parentListing ||   // Shallow compare okay
                 newFileState.availableTopLevelDirs !== previousFileState.availableTopLevelDirs; // Shallow compare okay

            // --- Handle parent listing fetch completion ---
            // This logic needs refinement based on the event emitted by handleDirectorySpanClick
            // Let's assume the store/fileManager updates parentListing and clears any 'isLoadingParent' flag.
             if (fetchingParentPath && // We were fetching for a specific RELATIVE segment
                  newFileState.parentListing && // A parent listing arrived
                  newFileState.parentListing.pathname === getParentPath(fetchingParentPath) && // Compare RELATIVE paths
                  !newFileState.isLoading // And general file loading is false (or a specific parent loading flag)
                 ) {
                 logContext(`Detected parent listing arrival relevant to ${fetchingParentPath} (relative). Activating dropdown.`, 'SUB');
                 activeSiblingDropdownPath = fetchingParentPath; // Activate dropdown using relative path
                 fetchingParentPath = null;
             } else if (fetchingParentPath && !newFileState.isLoading && fetchingParentPath !== activeSiblingDropdownPath) {
                  // If fetching was active, but loading finished and we didn't activate the dropdown
                  // (e.g., fetch failed, or listing arrived but didn't match), clear fetching state.
                  logContext(`Fetch seems complete/cancelled for ${fetchingParentPath} (relative). Clearing fetch state.`, 'SUB');
                  fetchingParentPath = null;
             }
            // --- End Parent Listing Fetch Handling ---

            // Check if component's local interactive state changed
            const localStateChanged = activeSiblingDropdownPath !== previousActiveDropdownPath ||
                                      fetchingParentPath !== previousFetchingPath;


            if (authRelevantChanged || fileRelevantChanged || localStateChanged) {
                logContext('Relevant state changed (Auth, File, or Local Interaction), calling render.', 'SUB');
                render(); // Trigger re-render
            }

            // Update previous state snapshot for the next comparison
            previousAuthState = newAuthState;
            previousFileState = newFileState;
            previousActiveDropdownPath = activeSiblingDropdownPath;
            previousFetchingPath = fetchingParentPath;
        });

        logContext('Performing initial render.', 'MOUNT');
        render(); // Perform initial render
        logContext('Component mounted and subscribed to appStore.', 'MOUNT');
        return true;
    };

    const destroy = () => {
        logContext(`Destroying component and unsubscribing...`, 'DESTROY');
        // Unsubscribe from appStore
        if (storeUnsubscribe) {
            storeUnsubscribe();
            storeUnsubscribe = null;
        }
        // Remove listeners explicitly (although they should be managed by render)
        if (element) {
             // Clear listeners using the latest handlers/selectors
              element.querySelectorAll('.breadcrumb-item.non-admin-top.root-link').forEach(span => span.removeEventListener('click', handleNavigateToPathname));
             element.querySelectorAll('.breadcrumb-item.intermediate-dir').forEach(span => span.removeEventListener('click', handleDirectorySpanClick));
             element.querySelectorAll('.sibling-select, .admin-top-sibling-select').forEach(select => select.removeEventListener('change', handleSiblingDirectorySelectChange));
             element.querySelectorAll('.admin-top-select').forEach(select => select.removeEventListener('change', handleRootDirectorySelectChange));
             const primarySelect = element.querySelector('#context-primary-select');
             if(primarySelect) primarySelect.removeEventListener('change', handlePrimarySelectChange);
             const saveBtn = element.querySelector('#save-btn');
             if(saveBtn) saveBtn.removeEventListener('click', handleSaveButtonClick);
              const publishBtn = element.querySelector('#publish-btn');
             if(publishBtn) publishBtn.removeEventListener('click', handlePublishButtonClick);

             // Optionally clear innerHTML on explicit destroy
             // element.innerHTML = '';
             logContext(`Listeners removed from element during destroy.`, 'DESTROY');
        }
        element = null; // Release reference
        activeSiblingDropdownPath = null; fetchingParentPath = null; // Reset local state
        logContext('Component destroyed.', 'DESTROY');
    };

    // pathJoin utility is assumed to be imported correctly
    // import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js';

    return { mount, destroy }; // Expose only mount/destroy typically
}
