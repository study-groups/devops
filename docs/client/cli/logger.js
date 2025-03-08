// client/cli/logger.js - Bridge between CLI events and logging system
import EventBus from '../eventBus.js';
import { CLI_EVENTS } from './cliEvents.js';
import { logMessage } from '../log/core.js';

// Bridge CLI events to the logging system
function setupCliLogging() {
  console.log('[CLI LOGGER] Setting up CLI event logging');
  
  // Log commands entered
  EventBus.on(CLI_EVENTS.COMMAND_ENTERED, (data) => {
    logMessage(`[CLI] $ ${data.command}`);
  });
  
  // Log command processing
  EventBus.on(CLI_EVENTS.COMMAND_PROCESSING, (data) => {
    // Optionally log processing if needed
    // logMessage(`[CLI] Processing: ${data.command}`);
  });
  
  // Log command responses
  EventBus.on(CLI_EVENTS.COMMAND_RESPONSE, (data) => {
    logMessage(`[CLI] ${data.source === 'client' ? 'Client' : 'Server'} response: ${data.result}`);
  });
  
  // Log command errors
  EventBus.on(CLI_EVENTS.COMMAND_ERROR, (data) => {
    logMessage(`[CLI ERROR] ${data.error}`);
  });
  
  console.log('[CLI LOGGER] CLI event logging setup complete');
}

// Setup logging when page loads
document.addEventListener('DOMContentLoaded', () => {
  setupCliLogging();
});

// Export for use in other modules
export { setupCliLogging }; 