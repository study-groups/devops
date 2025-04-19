/**
 * Keyboard Shortcuts Manager
 * Handles global keyboard shortcuts for the application
 */

import { logMessage } from './log/index.js';
import { eventBus } from './eventBus.js';
// Remove imports for directly called functions and state
// import { saveFile } from './fileManager/index.js';
// import { setView } from './views.js';
// import { executeRefresh } from './markdown-svg.js';
// import { authState } from '/client/authState.js';

// Initialize keyboard shortcuts
export function initKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        // Save file: Ctrl+S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            logMessage('[KEYBOARD] Save shortcut triggered (Ctrl+S)');
            // Emit an event instead of calling saveFile and checking auth here
            eventBus.emit('shortcut:saveFile');
            /* Remove direct call and auth check
            if (authState.get().isAuthenticated) {
                logMessage('[KEYBOARD] User authenticated, triggering saveFile...');
                await saveFile();
            } else {
                logMessage('[KEYBOARD] Save shortcut ignored: User not authenticated.');
                alert('Please log in to save.');
            }
            */
        }
        
        // Refresh SVG: Ctrl+Alt+R
        if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'r') {
            e.preventDefault();
            logMessage('[KEYBOARD] Refresh shortcut triggered (Ctrl+Alt+R)');
            // Emit an event instead of calling executeRefresh
            eventBus.emit('shortcut:refreshPreview');
            // executeRefresh(); // Remove direct call
        }
        
        // View modes
        if (e.ctrlKey && e.altKey) {
            let viewMode = null;
            // Code view: Ctrl+Alt+1
            if (e.key === '1') {
                e.preventDefault();
                viewMode = 'code';
                logMessage('[KEYBOARD] Code view shortcut triggered (Ctrl+Alt+1)');
            }
            // Preview view: Ctrl+Alt+2
            else if (e.key === '2') { // Use else if for exclusivity
                e.preventDefault();
                viewMode = 'preview';
                logMessage('[KEYBOARD] Preview view shortcut triggered (Ctrl+Alt+2)');
            }
            // Split view: Ctrl+Alt+3
            else if (e.key === '3') { // Use else if for exclusivity
                e.preventDefault();
                viewMode = 'split';
                logMessage('[KEYBOARD] Split view shortcut triggered (Ctrl+Alt+3)');
            }
            
            if (viewMode) {
                 // Emit an event instead of calling setView and localStorage
                 eventBus.emit('shortcut:setViewMode', { viewMode });
                 // setView(viewMode); // Remove direct call
                 // localStorage.setItem('viewMode', viewMode); // Remove direct localStorage access
            }
        }
    });
    
    logMessage('[KEYBOARD] Keyboard shortcuts initialized', 'info');
} 