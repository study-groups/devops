import { eventBus } from '/client/eventBus.js';
import { UIManager } from '/client/ui/UIManager.js';
import { appStore, ActionTypes } from '/client/state/appStore.js';

// --- Module-level state ---
let isInitialized = false;
let unsubscribeFromStore = null;

// Helper for logging within this module
function logTopBar(message, level = 'text') {
    const type = 'TOP_BAR';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message,type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${type}: ${message}`);
    }
}

/**
 * Renders the auth state based on the store.
 */
function renderAuthState(authState) {
    const authContainer = document.getElementById('auth-component-container');
    const saveBtn = document.getElementById('save-btn');
    const publishBtn = document.getElementById('publish-btn');

    if (!authContainer) return;

    if (authState.isAuthenticated) {
        authContainer.textContent = `Welcome, ${authState.user.username}`;
        if (saveBtn) saveBtn.disabled = false;
        if (publishBtn) publishBtn.disabled = false;
    } else {
        authContainer.textContent = 'Not Authenticated';
        if (saveBtn) saveBtn.disabled = true;
        if (publishBtn) publishBtn.disabled = true;
    }
}

/**
 * Initializes the Top Bar component, including its handlers and responsive behaviors.
 */
function init() {
    if (isInitialized) return;
    logTopBar('Initializing Top Bar...');
    
    updateContentHeight();
    attachTopBarHandlers();
    attachRefreshHandler();

    window.addEventListener('resize', updateContentHeight);
    
    // Subscribe to the store and render the initial state
    if (!unsubscribeFromStore) {
        unsubscribeFromStore = appStore.subscribe(() => {
            renderAuthState(appStore.getState().auth);
        });
    }
    renderAuthState(appStore.getState().auth);

    isInitialized = true;
    logTopBar('Top Bar Initialized.');
}

function refresh() {
    logTopBar('Refreshing Top Bar...');
    // For the top bar, a refresh might involve re-checking auth state or updating content.
    // For now, simply updating the content height is a good example.
    updateContentHeight();
    // Re-attach handlers to ensure they are fresh, especially if the DOM was manipulated.
    attachTopBarHandlers();
    attachRefreshHandler();
    // Re-render state from the store
    renderAuthState(appStore.getState().auth);
    logTopBar('Top Bar Refreshed.');
}

function destroy() {
    logTopBar('Destroying Top Bar...');
    // A real implementation would remove specific listeners.
    // For now, we just remove the global one we added.
    window.removeEventListener('resize', updateContentHeight);
    
    // Unsubscribe from the store to prevent memory leaks
    if (unsubscribeFromStore) {
        unsubscribeFromStore();
        unsubscribeFromStore = null;
    }

    isInitialized = false;
    logTopBar('Top Bar Destroyed.');
}

/**
 * Update content height based on actual top bar height
 * This is important for responsive layouts where the top bar height may change
 */
function updateContentHeight() {
    // Get the actual height of the top bar
    const topBar = document.querySelector('nav.top-bar') || document.querySelector('.top-bar');
    if (!topBar) return;
    
    const topBarHeight = topBar.offsetHeight;
    const previewContainer = document.querySelector(".preview-container");
    
    if (!previewContainer) return;
    
    // Get log container height if visible
    const logVisible = document.documentElement.getAttribute('data-log-visible') === 'true';
    const logHeight = logVisible ? (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--log-height')) || 120) : 0;
    
    // Update preview container max-height
    previewContainer.style.maxHeight = `calc(100vh - ${topBarHeight}px${logVisible ? ` - ${logHeight}px` : ''})`;
    
    logTopBar(`Preview container height updated. Top bar: ${topBarHeight}px, Log height: ${logHeight}px`);
}

// RESTORED: Essential UI handler functions
function attachTopBarHandlers() {
    logTopBar('Attaching top bar event handlers...');
    
    // Handle save button clicks
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            logTopBar('Save button clicked, dispatching action.');
            appStore.dispatch({ type: ActionTypes.FILE_SAVE_REQUEST });
        });
        logTopBar('Save button handler attached');
    }
    
    // Handle publish button clicks - REMOVED: Integration layer handles this now
    const publishBtn = document.getElementById('publish-btn');
    if (publishBtn) {
        // The click handling is now managed by PublishModalIntegration.js
        // No direct attachment needed here to avoid double handling or conflicts.
        logTopBar('Publish button handler will be managed by integration layer.');
    }
    
    logTopBar('Top bar handlers attached successfully');
}

/**
 * Attaches a handler to the refresh button to trigger a soft UI refresh.
 */
function attachRefreshHandler() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            logTopBar('UI refresh triggered');
            
            // Dispatch a global event for components to listen to
            eventBus.emit('ui:refresh');
        });
        logTopBar('Refresh button handler attached');
    } else {
        logTopBar('Refresh button not found', 'warning');
    }
}

// --- Component Definition ---

const TopBarComponent = {
    name: 'TopBar',
    init,
    refresh,
    destroy
};

// --- Registration ---
UIManager.register(TopBarComponent);

// REMOVED loadCodebaseStructure function

// REMOVED userView and adminView HTML strings as structure is in index.html 