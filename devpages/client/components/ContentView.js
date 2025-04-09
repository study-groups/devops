import { eventBus } from '/client/eventBus.js'; // Keep for potential future use? Or remove if truly unused.

// Helper to get logMessage safely
function logMessage(message, level = 'text') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level);
    } else {
        console.log(`[ContentView] ${message}`); // Fallback logging
    }
}

export function createContentViewComponent(targetElementId) {
    let element = null;
    let editorContainer = null;
    let previewContainer = null;
    let currentViewMode = 'split'; // Default view mode
    let isLogVisible = false; // Assume initially hidden

    // --- Rendering / Layout Logic ---
    const updateLayout = () => {
        console.log(`[DEBUG ContentView.js] updateLayout called. Mode: ${currentViewMode}, Log Visible: ${isLogVisible}`);
        if (!element) {
            console.warn('[DEBUG ContentView.js] updateLayout called but element is null!');
            return;
        }

        logMessage(`[ContentView] Updating layout. Mode: ${currentViewMode}, Log Visible: ${isLogVisible}`);

        // Remove previous classes
        const oldClasses = Array.from(element.classList).filter(c => c.startsWith('mode-'));
        console.log(`[DEBUG ContentView.js] Removing classes: ${oldClasses.join(', ')}`);
        element.classList.remove('mode-editor', 'mode-preview', 'mode-split');
        
        // Use the main container for log visibility class
        const mainContainer = document.getElementById('main-container');
        if(mainContainer) {
           console.log(`[DEBUG ContentView.js] Toggling log classes on main-container. isLogVisible: ${isLogVisible}`);
           mainContainer.classList.toggle('log-visible', isLogVisible);
           mainContainer.classList.toggle('log-hidden', !isLogVisible);
        } else {
            console.warn('[DEBUG ContentView.js] #main-container not found for log classes.');
        }

        // Add current mode class to the component's root element
        console.log(`[DEBUG ContentView.js] Adding class: mode-${currentViewMode}`);
        element.classList.add(`mode-${currentViewMode}`);
        console.log(`[DEBUG ContentView.js] Current element classes: ${element.className}`);

        // Trigger a resize event to help editor/preview adapt if needed
        console.log(`[DEBUG ContentView.js] Dispatching resize event.`);
        window.dispatchEvent(new Event('resize')); 
    };

    // --- NEW Update Method --- 
    const update = (data = {}) => {
        let needsLayoutUpdate = false;
        console.log('[DEBUG ContentView.js] update called with data:', data);

        if (data.viewMode !== undefined && data.viewMode !== currentViewMode) {
            if (['editor', 'preview', 'split'].includes(data.viewMode)) {
                logMessage(`[ContentView] Updating view mode to: ${data.viewMode}`);
                currentViewMode = data.viewMode;
                needsLayoutUpdate = true;
            } else {
                 logMessage(`[ContentView] update received invalid view mode: ${data.viewMode}`, 'warn');
            }
        }

        if (data.isLogVisible !== undefined && data.isLogVisible !== isLogVisible) {
            logMessage(`[ContentView] Updating log visibility to: ${data.isLogVisible}`);
            isLogVisible = !!data.isLogVisible;
            needsLayoutUpdate = true;
        }

        if (needsLayoutUpdate) {
            console.log('[DEBUG ContentView.js] update triggering updateLayout()');
            updateLayout();
        } else {
             console.log('[DEBUG ContentView.js] update called but no relevant state changed.');
        }
    };

    // --- Lifecycle Methods ---
    const mount = () => {
        logMessage('[ContentView] Mounting...');
        element = document.getElementById(targetElementId);
        if (!element) {
            console.error(`[ContentView] Target element #${targetElementId} not found.`);
            logMessage(`[ContentView] Target element #${targetElementId} not found.`, 'error');
            return false; // Indicate failure
        }

        // Create the structure for editor and preview inside the target element
        element.innerHTML = `
            <div id="editor-container" class="content-pane editor-pane">
                <!-- Editor (e.g., textarea) will go here -->
                 <textarea placeholder="Write Markdown here..."></textarea> 
                 <div class="resize-handle"></div>
            </div>
            <div id="preview-container" class="content-pane preview-pane">
                <!-- Preview content will go here -->
            </div>
        `;
        editorContainer = element.querySelector('#editor-container');
        previewContainer = element.querySelector('#preview-container');

        // Add class to element for component-specific styling if needed
        element.classList.add('content-view-component'); 

        logMessage('Event bus subscriptions skipped (handled by uiManager).');

        // Apply initial layout based on defaults
        console.log('[DEBUG ContentView.js] mount triggering initial updateLayout()');
        updateLayout(); // Apply layout based on initial default state

        logMessage('[ContentView] Mounted.');
        return true; // Indicate success
    };

    const destroy = () => {
        logMessage('[ContentView] Destroying...');
        if (element) {
            element.innerHTML = ''; // Clear content
            element.classList.remove('content-view-component', 'mode-editor', 'mode-preview', 'mode-split');
        }
        element = null;
        editorContainer = null;
        previewContainer = null;
        logMessage('[ContentView] Destroyed.');
    };

    return {
        mount,
        update, // Expose the update method
        destroy,
    };
} 