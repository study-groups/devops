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

// REMOVED updateUserInfo function as it depended on fetchSystemInfo/uiState

// REMOVED attachTopBarHandlers function as handlers are managed centrally

// REMOVED loadCodebaseStructure function

// REMOVED userView and adminView HTML strings as structure is in index.html 