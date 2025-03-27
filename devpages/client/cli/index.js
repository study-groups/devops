// client/cli/index.js - Main CLI integration
import { logMessage } from '../log/index.js';
import EventBus from '../eventBus.js';
import { CLI_EVENTS } from './cliEvents.js';
import { registerCliCommand, executeCliCommand } from './registry.js';

// Log successful import
console.log('[CLI] Core imports completed');

// Export the initialization function
export async function initializeCLI() {
    console.log('[CLI] Starting CLI initialization');
    
    try {
        // Register core commands first
        registerCliCommand('force-reload', async (args) => {
            logMessage('[CLI] Force reloading current file...');
            try {
                const currentFile = window.uiState?.currentFile || document.getElementById('file-select')?.value;
                const currentDir = window.uiState?.currentDir || document.getElementById('dir-select')?.value;
                
                if (!currentFile || !currentDir) {
                    logMessage('[CLI ERROR] No file currently open', 'error');
                    return;
                }
                
                const { loadFile } = await import('../fileManager/operations.js');
                await loadFile(currentFile, currentDir, true);
                logMessage('[CLI] File reloaded successfully');
            } catch (error) {
                logMessage(`[CLI ERROR] Failed to reload file: ${error.message}`, 'error');
            }
        });

        // Register Mermaid commands
        const { registerMermaidCommands } = await import('./mermaidCommands.js');
        await registerMermaidCommands();
        
        // Set up command handling
        window.addEventListener('cli:execute', async (event) => {
            const { command, args } = event.detail;
            await executeCliCommand(command, args);
        });

        // Emit ready event
        EventBus.emit(CLI_EVENTS.CLI_READY, {
            timestamp: Date.now()
        });

        console.log('[CLI] Initialization complete');
        return true;
    } catch (error) {
        console.error('[CLI] Initialization failed:', error);
        return false;
    }
}

// Export necessary functions
export { registerCliCommand, executeCliCommand }; 