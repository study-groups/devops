// log/cli.js - CLI input handling for the log component
import { logMessage } from './core.js';
import { globalFetch } from '../globalFetch.js';

/**
 * Add CLI input to the log toolbar
 */
export function addCLIToLogBar() {
    const logToolbar = document.getElementById('log-toolbar');
    if (!logToolbar) {
        console.log('[LOG DEBUG] Log toolbar not found - ID: log-toolbar');
        return;
    }
    
    console.log('[LOG DEBUG] Found log toolbar');
    
    // Create CLI input element if it doesn't exist
    let cliInput = document.getElementById('cli-input');
    if (!cliInput) {
        console.log('[LOG DEBUG] CLI input element not found, creating it');
        cliInput = document.createElement('input');
        cliInput.id = 'cli-input';
        cliInput.type = 'text';
        cliInput.placeholder = 'Enter command...';
        cliInput.className = 'cli-input';
        logToolbar.appendChild(cliInput);
    }

    // Always ensure the event listener is attached
    cliInput.removeEventListener('keydown', handleCLIInput); // Remove any existing listener
    cliInput.addEventListener('keydown', handleCLIInput); // Add fresh listener

    // Remove old app info (or hide it if you want to keep it around)
    let appInfo = document.getElementById('app-info');
    if (appInfo) {
        appInfo.remove(); // Or appInfo.style.display = 'none';
    }

    console.log('[LOG DEBUG] CLI input initialized with event listener');
}

/**
 * Handle CLI input events
 * @param {KeyboardEvent} event - The keyboard event
 */
async function handleCLIInput(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent the default Enter behavior
        const command = event.target.value.trim();
        if (!command) return; // Don't process empty commands
        
        event.target.value = ''; // Clear the input

        logMessage(`[CLI] $ ${command}`);

        try {
            const response = await globalFetch('/api/cli', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command }),
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            logMessage(`[CLI] Response: ${data.output}`);
        } catch (error) {
            logMessage(`[CLI ERROR] ${error.message}`);
        }
    }
} 