// log/core.js - Core logging functionality

/**
 * Log a message to the log container
 * @param {string|object} message - The message to log
 * @param {string} type - The type of message ('text' or 'json')
 */
import { updatePreview } from '../markdown.js';

export function logMessage(message, type = 'text') {
    const logContainer = document.getElementById('log');
    if (!logContainer) return;
    
    // Check for empty, undefined, or null messages
    if (message === undefined || message === null) {
        console.warn('[LOG] Empty log message received, ignoring');
        return;
    }
    
    // Convert to string if it's not already (handles empty strings)
    const messageStr = String(message);
    if (messageStr.trim() === '' && type === 'text') {
        console.warn('[LOG] Empty text log message received, ignoring');
        return;
    }
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    if (type === 'text') {
        logEntry.textContent = `${timestamp} ${messageStr}`;
    } else if (type === 'json') {
        logEntry.textContent = `${timestamp} [JSON] `;
        const pre = document.createElement('pre');
        try {
            pre.textContent = JSON.stringify(message, null, 2); // Pretty-print JSON
        } catch (e) {
            pre.textContent = '[Error stringifying JSON]';
        }
        logEntry.appendChild(pre);
    }
    
    // Add click event listener to add to preview
    logEntry.addEventListener('click', () => {
        const editor = document.querySelector('#md-editor textarea');
        if (editor) {
            // For text, simply append. For JSON, you might want to format it.
            if (type === 'text') {
                editor.value += messageStr + "\n";
            } else if (type === 'json') {
                try {
                    editor.value += JSON.stringify(message, null, 2) + "\n";
                } catch (e) {
                    editor.value += "[Error stringifying JSON]\n";
                }
            }
            updatePreview(editor.value);
        }
    });
    
    logContainer.appendChild(logEntry);
    
    // Auto-scroll to bottom if not manually scrolled up
    const logWrapper = document.getElementById('log-container');
    if (logWrapper && logWrapper.scrollTop + logWrapper.clientHeight >= logWrapper.scrollHeight - 50) {
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // Update the log status counter
    updateLogEntryCount();
    
    // Also log to console for debugging
    console.log(`${timestamp} ${type === 'json' ? JSON.stringify(message) : messageStr}`);
}

/**
 * Update the log entry count display
 */
export function updateLogEntryCount() {
    const logDiv = document.getElementById('log');
    const logStatus = document.getElementById('log-status');
    
    if (logDiv && logStatus) {
        const entryCount = logDiv.children.length;
        logStatus.textContent = `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`;
    }
} 