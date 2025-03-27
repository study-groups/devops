// client/cli/registry.js - Core CLI command registry
import { logMessage } from '../log/index.js';

// Create the command registry
const CLI_REGISTRY = new Map();

// Export the registration function
export function registerCliCommand(commandName, handlerFunction) {
    if (!commandName || typeof handlerFunction !== 'function') {
        console.error('[CLI Registry] Invalid command registration:', { commandName, handlerType: typeof handlerFunction });
        return false;
    }
    
    CLI_REGISTRY.set(commandName, handlerFunction);
    console.log(`[CLI Registry] Registered command: ${commandName}`);
    return true;
}

// Export the command execution function
export async function executeCliCommand(commandName, args = []) {
    const handler = CLI_REGISTRY.get(commandName);
    if (!handler) {
        logMessage(`[CLI ERROR] Command not found: ${commandName}`, 'error');
        return false;
    }
    
    try {
        await handler(args);
        return true;
    } catch (error) {
        logMessage(`[CLI ERROR] Command "${commandName}" failed: ${error.message}`, 'error');
        return false;
    }
}

// Export the registry for debugging
export function getRegisteredCommands() {
    return Array.from(CLI_REGISTRY.keys());
} 