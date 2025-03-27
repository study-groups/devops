// client/cli/commandRegistry.js - Centralized command registry

// Command registry to store all client-side commands
const clientCommands = new Map();

/**
 * Register a client-side command
 * @param {string} commandName - The command name (e.g., 'mermaid:check')
 * @param {function} handler - Function that executes when command is called
 * @param {string} description - Description of what the command does
 */
export function registerClientCommand(commandName, handler, description = '') {
  console.log(`[CLI] Registering client command: ${commandName}`);
  clientCommands.set(commandName, {
    handler,
    description
  });
}

/**
 * Check if a command should be handled client-side
 * @param {string} command - The full command string
 * @returns {boolean} - Whether this is a registered client command
 */
export function isClientCommand(command) {
  // Extract the base command (everything before the first space)
  const baseCommand = command.split(' ')[0];
  return clientCommands.has(baseCommand);
}

/**
 * Execute a client-side command
 * @param {string} command - The full command string
 * @returns {Promise<string>} - Output from the command
 */
export async function executeClientCommand(command) {
  const parts = command.split(' ');
  const baseCommand = parts[0];
  const args = parts.slice(1);
  
  if (!clientCommands.has(baseCommand)) {
    throw new Error(`Unknown client command: ${baseCommand}`);
  }
  
  const { handler } = clientCommands.get(baseCommand);
  try {
    const result = await handler(args);
    return result || `Command ${baseCommand} executed successfully`;
  } catch (error) {
    console.error(`[CLI] Error executing ${baseCommand}:`, error);
    throw error;
  }
}

/**
 * Get a list of all registered client commands
 * @returns {Array} - Array of command objects with name and description
 */
export function getClientCommands() {
  return Array.from(clientCommands.entries()).map(([name, { description }]) => ({
    name,
    description
  }));
} 