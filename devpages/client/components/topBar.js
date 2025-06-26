// import { eventBus } from '/client/eventBus.js'; // Unused

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
 * Update content height based on actual top bar height
 * This is important for responsive layouts where the top bar height may change
 */
function updateContentHeight() {
    // Get the actual height of the top bar
    const topBar = document.querySelector('nav.top-bar') || document.querySelector('.top-bar');
    if (!topBar) return;
    
    const topBarHeight = topBar.offsetHeight;
    const mainContainer = document.getElementById('main-container');
    const content = document.getElementById('content');
    
    if (!mainContainer || !content) return;
    
    // Get log container height if visible
    const logVisible = document.documentElement.getAttribute('data-log-visible') === 'true';
    const logHeight = logVisible ? (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--log-height')) || 120) : 0;
    
    // Update content max-height
    content.style.maxHeight = `calc(100vh - ${topBarHeight}px${logVisible ? ` - ${logHeight}px` : ''})`;
    
    logTopBar(`Content height updated. Top bar: ${topBarHeight}px, Log height: ${logHeight}px`);
}

// Add resize listener to update content height when window is resized
window.addEventListener('resize', updateContentHeight);

// Ensure content height is updated when the page loads
document.addEventListener('DOMContentLoaded', updateContentHeight);

// RESTORED: Essential UI handler functions
export function attachTopBarHandlers() {
    logTopBar('Attaching top bar event handlers...');
    
    // Handle save button clicks
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            logTopBar('Save button clicked');
            
            // Check authentication
            const authState = window.appStore?.getState()?.auth;
            if (!authState?.isAuthenticated) {
                logTopBar('Save attempted but user not authenticated', 'warning');
                return;
            }
            
            // Emit save event
            if (window.eventBus) {
                window.eventBus.emit('file:save');
            }
        });
        logTopBar('Save button handler attached');
    }
    
    // Handle publish button clicks
    const publishBtn = document.getElementById('publish-btn');
    if (publishBtn) {
        publishBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            logTopBar('Publish button clicked');
            
            // Open publish modal if available
            if (typeof window.openPublishModal === 'function') {
                const fileState = window.appStore?.getState()?.file;
                if (fileState?.currentPathname && !fileState.isDirectorySelected) {
                    window.openPublishModal(fileState.currentPathname);
                } else {
                    alert('Please select a file to publish.');
                }
            } else if (typeof window.triggerActions?.publishToSpaces === 'function') {
                window.triggerActions.publishToSpaces();
            }
        });
        logTopBar('Publish button handler attached');
    }
    
    logTopBar('Top bar handlers attached successfully');
}

export function updateUserInfo(userData) {
    logTopBar(`Updating user info: ${userData?.username || 'No user'}`);
    
    // Update any user-specific UI elements in the top bar
    const authContainer = document.getElementById('auth-component-container');
    if (authContainer && userData) {
        // The AuthDisplay component should handle this, but we can trigger an update
        if (window.eventBus) {
            window.eventBus.emit('auth:userInfoUpdated', userData);
        }
    }
    
    logTopBar('User info update completed');
}

// Initialize top bar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    updateContentHeight();
    
    // Small delay to ensure other components are initialized
    setTimeout(() => {
        attachTopBarHandlers();
    }, 100);
});

// REMOVED loadCodebaseStructure function

// REMOVED userView and adminView HTML strings as structure is in index.html 