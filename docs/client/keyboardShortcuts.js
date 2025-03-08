/**
 * Keyboard Shortcuts Manager
 * Handles global keyboard shortcuts for the application
 */

import { logMessage } from './log/index.js';
import { saveFile } from './fileManager.js';
import { setView } from './viewManager.js';
import { executeRefresh } from './markdown-svg.js';

// Initialize keyboard shortcuts
export function initKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        // Save file: Ctrl+S
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            logMessage('[KEYBOARD] Save shortcut triggered (Ctrl+S)');
            await saveFile();
        }
        
        // Refresh SVG: Ctrl+Alt+R
        if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'r') {
            e.preventDefault();
            logMessage('[KEYBOARD] Refresh shortcut triggered (Ctrl+Alt+R)');
            executeRefresh();
        }
        
        // View modes
        if (e.ctrlKey && e.altKey) {
            // Code view: Ctrl+Alt+1
            if (e.key === '1') {
                e.preventDefault();
                setView('code');
                localStorage.setItem('viewMode', 'code');
                logMessage('[KEYBOARD] Code view shortcut triggered (Ctrl+Alt+1)');
            }
            
            // Preview view: Ctrl+Alt+2
            if (e.key === '2') {
                e.preventDefault();
                setView('preview');
                localStorage.setItem('viewMode', 'preview');
                logMessage('[KEYBOARD] Preview view shortcut triggered (Ctrl+Alt+2)');
            }
            
            // Split view: Ctrl+Alt+3
            if (e.key === '3') {
                e.preventDefault();
                setView('split');
                localStorage.setItem('viewMode', 'split');
                logMessage('[KEYBOARD] Split view shortcut triggered (Ctrl+Alt+3)');
            }
        }
    });
    
    logMessage('[KEYBOARD] Keyboard shortcuts initialized');
} 