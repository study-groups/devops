// client/cli/handlers.js - CLI handlers with globalFetch integration
import EventBus from '../eventBus.js';
import Handlers from '../handlers.js';
import { CLI_EVENTS } from './cliEvents.js';
import { globalFetch } from '../globalFetch.js';
import { logMessage } from '../log/core.js';

// Handler for CLI input
function handleCliInput(event) {
  if (event.key !== 'Enter') return;
  
  const command = event.target.value.trim();
  if (!command) return;
  
  console.log(`[CLI] Command entered: ${command}`);
  
  // Clear input field
  event.target.value = '';
  
  // Emit command entered event
  EventBus.emit(CLI_EVENTS.COMMAND_ENTERED, { 
    command, 
    timestamp: Date.now() 
  });
  
  // Execute command
  executeCommand(command);
}

// Execute a CLI command using globalFetch
async function executeCommand(command) {
  try {
    console.log(`[CLI] Executing command: ${command}`);
    
    // Emit processing event
    EventBus.emit(CLI_EVENTS.COMMAND_PROCESSING, {
      command,
      timestamp: Date.now()
    });
    
    // Get authentication info if available
    let headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authentication if it exists in window.authState
    if (window.authState && window.authState.username && window.authState.hashedPassword) {
      console.log('[CLI] Adding authentication to request');
      headers['Authorization'] = `Basic ${btoa(`${window.authState.username}:${window.authState.hashedPassword}`)}`;
    } else {
      console.log('[CLI] No authentication available');
    }
    
    // Use globalFetch to make the API call to server/routes/cli.js
    const response = await globalFetch('/api/cli', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ command }),
      credentials: 'include' // Include cookies for session-based auth
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[CLI] Server response:', data);
    
    // Emit success events
    EventBus.emit(CLI_EVENTS.COMMAND_RESPONSE, {
      command,
      result: data.output,
      success: true,
      timestamp: Date.now()
    });
    
    EventBus.emit(CLI_EVENTS.COMMAND_EXECUTED, {
      command,
      result: data.output,
      success: true,
      timestamp: Date.now()
    });
    
    return data.output;
  } catch (error) {
    console.error(`[CLI] Command execution error:`, error);
    
    // Emit error event
    EventBus.emit(CLI_EVENTS.COMMAND_ERROR, {
      command,
      error: error.message,
      timestamp: Date.now()
    });
    
    // Fall back to client-side handling
    return handleClientSide(command);
  }
}

// Handle command on client-side as fallback
function handleClientSide(command) {
  console.log(`[CLI] Handling command client-side: ${command}`);
  let output = '';
  
  // Parse the command
  const parts = command.trim().split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');
  
  // Basic client-side commands
  if (cmd === 'help') {
    output = 'Available commands: help, echo, date, ls, version, clear';
  } else if (cmd === 'echo') {
    output = args;
  } else if (cmd === 'date') {
    output = new Date().toString();
  } else if (cmd === 'ls') {
    output = 'Client-side ls: Simulated directory listing';
  } else if (cmd === 'version') {
    output = 'CLI Version 1.0.0';
  } else if (cmd === 'clear') {
    const logContainer = document.getElementById('log');
    if (logContainer) {
      logContainer.innerHTML = '';
    }
    output = 'Log cleared';
  } else {
    output = `Unknown command: ${cmd}. Try 'help' for a list of commands.`;
  }
  
  // Emit event for client-side result
  EventBus.emit(CLI_EVENTS.COMMAND_RESPONSE, {
    command,
    result: output,
    success: true,
    source: 'client',
    timestamp: Date.now()
  });
  
  return output;
}

// Function to set up the CLI handlers
function setupCliHandlers() {
  console.log('[CLI] Setting up CLI handlers');
  
  // Get the CLI input element
  const cliInput = document.getElementById('cli-input');
  
  if (cliInput) {
    console.log('[CLI] Found CLI input element, attaching handler');
    
    // Remove any existing handlers first
    cliInput.removeEventListener('keydown', handleCliInput);
    
    // Attach fresh handler
    cliInput.addEventListener('keydown', handleCliInput);
    
    console.log('[CLI] CLI input handler attached successfully');
    
    // Emit ready event
    EventBus.emit(CLI_EVENTS.CLI_READY, {
      timestamp: Date.now(),
      element: cliInput
    });
    
    return true;
  } else {
    console.warn('[CLI] CLI input element not found, will retry later');
    return false;
  }
}

// Setup CLI handlers when either event fires
document.addEventListener('DOMContentLoaded', () => {
  console.log('[CLI] DOMContentLoaded event received');
  
  // Try to set up handlers immediately
  if (!setupCliHandlers()) {
    // If it fails, wait a bit and try again
    console.log('[CLI] Will retry handler setup after short delay');
    setTimeout(setupCliHandlers, 500);
  }
});

// Also listen for handlers:ready event as a backup
document.addEventListener('handlers:ready', () => {
  console.log('[CLI] handlers:ready event received');
  setupCliHandlers();
});

// Add a MutationObserver as a final fallback to detect when the CLI input is added to the DOM
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length) {
      const cliInput = document.getElementById('cli-input');
      if (cliInput) {
        console.log('[CLI] CLI input detected via MutationObserver');
        observer.disconnect();
        setupCliHandlers();
        break;
      }
    }
  }
});

// Start observing once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  observer.observe(document.body, { childList: true, subtree: true });
});

// Listen for the CLI input element being created
document.addEventListener('cli:input-created', (event) => {
  console.log('[CLI] cli:input-created event received');
  setupCliHandlers();
});

// Export functions for use in other modules
export { executeCommand, handleClientSide, setupCliHandlers }; 