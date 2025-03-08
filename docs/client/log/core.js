// log/core.js - Core logging functionality

/**
 * Log a message to the log container
 * @param {string|object} message - The message to log
 * @param {string} type - The type of message ('text' or 'json')
 */
export function logMessage(message, type = 'text') {
    const logContainer = document.getElementById('log');
    if (!logContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    if (type === 'text') {
        logEntry.textContent = `${timestamp} ${message}`;
    } else if (type === 'json') {
        logEntry.textContent = `${timestamp} [JSON] `;
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(message, null, 2); // Pretty-print JSON
        logEntry.appendChild(pre);
    }
    
    // Add click event listener to add to preview
    logEntry.addEventListener('click', () => {
        const editor = document.querySelector('#md-editor textarea');
        if (editor) {
            // For text, simply append. For JSON, you might want to format it.
            if (type === 'text') {
                editor.value += message + "\n";
            } else if (type === 'json') {
                editor.value += JSON.stringify(message, null, 2) + "\n";
            }
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
    console.log(`${timestamp} ${message}`);
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

/**
 * Clear all log entries
 */
export function clearLog() {
    const logDiv = document.getElementById('log');
    if (logDiv) {
        logDiv.innerHTML = '';
        
        // Update log status count
        updateLogEntryCount();
        
        // Use direct console.log instead of logMessage to avoid circular reference
        console.log('[LOG] Log cleared');
    }
}

/**
 * Copy log contents to clipboard
 */
export function copyLog() {
    const logDiv = document.getElementById('log');
    if (logDiv) {
        const logText = Array.from(logDiv.children)
            .map(entry => entry.textContent)
            .join('\n');
        
        navigator.clipboard.writeText(logText)
            .then(() => {
                // Use direct console.log instead of logMessage to avoid circular reference
                console.log('[LOG] Log copied to clipboard');
            })
            .catch(err => {
                console.error('[LOG ERROR] Failed to copy log: ' + err);
            });
    }
} 