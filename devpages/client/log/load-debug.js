/**
 * Load Log Debug Tools
 * Simple loader for log debugging utilities
 */

// Load debug tools if not already loaded
if (!window.APP?.debug?.log) {
    import('./debug-tools.js').then(() => {
        console.log('🔧 Log debug tools loaded. Try: APP.debug.log.analyze()');
    }).catch(error => {
        console.error('Failed to load log debug tools:', error);
    });
} else {
    console.log('🔧 Log debug tools already loaded');
}