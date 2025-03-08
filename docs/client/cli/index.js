// client/cli/index.js - Main integration for CLI component
import EventBus from '../eventBus.js';
import { CLI_EVENTS } from './cliEvents.js';
import { setupCliHandlers } from './handlers.js';  // Import the setupCliHandlers function
import './logger.js';    // Initialize CLI logger

// Export a function to initialize the CLI component
export function initializeCLI() {
  console.log('[CLI] Initializing CLI component');
  
  // Try to set up handlers
  setupCliHandlers();
  
  // Emit ready event (for other components that might be listening)
  EventBus.emit(CLI_EVENTS.CLI_READY, {
    timestamp: Date.now()
  });
  
  // Also set up a delayed initialization as a fallback
  setTimeout(() => {
    console.log('[CLI] Running delayed initialization');
    setupCliHandlers();
  }, 1000);
  
  return true;
}

// Initialize CLI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[CLI] DOMContentLoaded event in index.js');
  initializeCLI();
});

// Add a window load event as backup
window.addEventListener('load', () => {
  console.log('[CLI] Window load event, ensuring CLI is initialized');
  setupCliHandlers();
});

// Export events and functions
export { CLI_EVENTS, setupCliHandlers }; 