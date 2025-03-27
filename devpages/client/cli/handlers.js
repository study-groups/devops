// client/cli/handlers.js - CLI handlers with globalFetch integration
import EventBus from '../eventBus.js';
import Handlers from '../handlers.js';
import { CLI_EVENTS } from './cliEvents.js';
import { globalFetch } from '../globalFetch.js';
import { logMessage } from '../log/core.js';
import { 
  isClientCommand, 
  executeClientCommand, 
  registerClientCommand 
} from './commandRegistry.js';

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
    
    // First log the command to the UI
    logMessage('[CLI] $ ' + command);
    
    // Check if this is a client-side command
    if (isClientCommand(command)) {
      console.log(`[CLI] Handling '${command}' as client-side command`);
      
      // Execute the client-side command from registry
      const output = await executeClientCommand(command);
      
      // Log the output if available
      if (output && typeof output === 'string') {
        logMessage(`[CLI] ${output}`);
      }
      
      // Emit success events
      EventBus.emit(CLI_EVENTS.COMMAND_RESPONSE, {
        command,
        result: output,
        success: true,
        source: 'client',
        timestamp: Date.now()
      });
      
      EventBus.emit(CLI_EVENTS.COMMAND_EXECUTED, {
        command,
        result: output,
        success: true,
        source: 'client',
        timestamp: Date.now()
      });
      
      return output;
    }
    
    // If not a client command, continue with normal server execution
    EventBus.emit(CLI_EVENTS.COMMAND_PROCESSING, {
      command,
      timestamp: Date.now()
    });
    
    // Make the server request as before
    const response = await globalFetch('/api/cli', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command })
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

// Add this to your CLI handlers
registerCliCommand('mermaid:check', (args) => {
    logMessage('[CLI] Checking Mermaid diagrams...');
    const editor = document.querySelector('#md-editor textarea');
    if (!editor) {
        logMessage('[CLI ERROR] Editor not found');
        return;
    }
    
    const content = editor.value;
    const lines = content.split('\n');
    
    // Find mermaid blocks
    const mermaidBlocks = [];
    let inMermaidBlock = false;
    let startLine = 0;
    let blockNumber = 0;
    let currentBlock = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('```mermaid')) {
            inMermaidBlock = true;
            startLine = i;
            blockNumber++;
            currentBlock = {
                start: i,
                content: [],
                blockNumber
            };
        } else if (inMermaidBlock && line.startsWith('```')) {
            inMermaidBlock = false;
            currentBlock.end = i;
            mermaidBlocks.push(currentBlock);
            currentBlock = null;
        } else if (inMermaidBlock) {
            currentBlock.content.push(line);
        }
    }
    
    if (mermaidBlocks.length === 0) {
        logMessage('[MERMAID] No Mermaid diagrams found in document');
        return;
    }
    
    logMessage(`[MERMAID] Found ${mermaidBlocks.length} diagram(s) in document`);
    
    // Check each diagram
    mermaidBlocks.forEach(block => {
        const diagram = block.content.join('\n');
        try {
            // Try to parse the diagram
            logMessage(`[MERMAID] Checking diagram #${block.blockNumber} (lines ${block.start+1}-${block.end+1})...`);
            mermaid.parse(diagram);
            logMessage(`[MERMAID] ✅ Diagram #${block.blockNumber} is valid`);
        } catch (error) {
            const errorMsg = error.str || error.message || String(error);
            logMessage(`[MERMAID] ❌ Diagram #${block.blockNumber} has errors:`, 'error');
            logMessage(`[MERMAID] ${errorMsg}`, 'error');
            
            // Try to extract line number from error
            const lineMatch = errorMsg.match(/Line #(\d+)/i);
            if (lineMatch && lineMatch[1]) {
                const errorLine = parseInt(lineMatch[1]);
                const editorLine = block.start + errorLine + 1;
                logMessage(`[MERMAID] Error at line ${errorLine} of diagram (editor line ${editorLine})`);
            }
        }
    });
    
    logMessage('[MERMAID] Diagram check complete');
    
    // If force=true, force refresh the preview
    if (args.includes('force')) {
        document.getElementById('refresh-btn')?.click();
    }
});

// Replace the existing client-side Mermaid command handler with this
document.addEventListener('DOMContentLoaded', () => {
    console.log('[CLI] Setting up client-side Mermaid check handler');
    
    // Function to handle installation
    function installMermaidHandler() {
        const cliInput = document.getElementById('cli-input');
        if (!cliInput) {
            console.warn('[CLI] CLI input not found, will try again in 500ms');
            setTimeout(installMermaidHandler, 500);
            return;
        }
        
        // Important: REPLACE the main keydown handler rather than adding another one
        const originalKeydownHandler = cliInput.onkeydown;
        
        cliInput.onkeydown = function(event) {
            if (event.key === 'Enter') {
                const command = this.value.trim();
                
                // Check if it's our mermaid command
                if (command === 'mermaid:check' || command === 'mermaid:validate') {
                    // Stop ALL event propagation
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // Mark the command as handled
                    console.log('[CLI] Handling mermaid command client-side:', command);
                    logMessage('[CLI] $ ' + command);
                    
                    // Clear the input
                    this.value = '';
                    
                    // Run the validation
                    validateMermaidDiagrams();
                    
                    // Prevent any other handlers from running
                    return false;
                }
                
                // Let other commands go through to the original handler
                if (typeof originalKeydownHandler === 'function') {
                    return originalKeydownHandler.call(this, event);
                }
            }
        };
        
        // Remove any existing event listeners to prevent duplicates
        const oldListeners = cliInput.getEventListeners?.('keydown') || [];
        if (oldListeners.length > 0) {
            console.log(`[CLI] Removing ${oldListeners.length} existing keydown listeners`);
            for (const listener of oldListeners) {
                cliInput.removeEventListener('keydown', listener.listener);
            }
        }
        
        console.log('[CLI] Mermaid command handler installed successfully');
        
        // Test handler is working
        console.log('[CLI] Testing mermaid:check handler - handler should intercept this message');
        EventBus.emit(CLI_EVENTS.COMMAND_ENTERED, { command: 'mermaid:check', timestamp: Date.now() });
    }
    
    // Start the installation process
    installMermaidHandler();
});

// Function to validate Mermaid diagrams and display errors
function validateMermaidDiagrams() {
    logMessage('[MERMAID] Starting diagram validation...');
    
    try {
        // Get the editor content
        const editor = document.querySelector('#md-editor textarea');
        if (!editor) {
            logMessage('[MERMAID ERROR] Editor not found');
            return;
        }
        
        // Find all Mermaid diagrams in the document
        const content = editor.value;
        const lines = content.split('\n');
        let inMermaidBlock = false;
        let startLine = 0;
        let mermaidContent = '';
        let diagrams = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.trim().startsWith('```mermaid')) {
                inMermaidBlock = true;
                startLine = i + 1;
                mermaidContent = '';
            } else if (inMermaidBlock && line.trim().startsWith('```')) {
                inMermaidBlock = false;
                diagrams.push({
                    startLine,
                    endLine: i - 1,
                    content: mermaidContent,
                    index: diagrams.length
                });
            } else if (inMermaidBlock) {
                mermaidContent += line + '\n';
            }
        }
        
        if (diagrams.length === 0) {
            logMessage('[MERMAID] No Mermaid diagrams found in the document');
            return;
        }
        
        logMessage(`[MERMAID] Found ${diagrams.length} diagram(s) to validate`);
        
        // Validate each diagram
        let validDiagrams = 0;
        let errorDiagrams = 0;
        
        for (let i = 0; i < diagrams.length; i++) {
            const diagram = diagrams[i];
            logMessage(`[MERMAID] Checking diagram #${i + 1} (lines ${diagram.startLine}-${diagram.endLine})...`);
            
            try {
                // Parse the diagram - this will throw an error if there's a syntax issue
                window.mermaid.parse(diagram.content);
                logMessage(`[MERMAID] ✅ Diagram #${i + 1} is valid`);
                validDiagrams++;
            } catch (error) {
                errorDiagrams++;
                const errorMsg = error.str || error.message || String(error);
                logMessage(`[MERMAID] ❌ Error in diagram #${i + 1}:`, 'error');
                logMessage(`[MERMAID] ${errorMsg}`, 'error');
                
                // Try to extract line number information
                const lineMatch = errorMsg.match(/line (\d+)/i) || errorMsg.match(/Line #(\d+)/i);
                if (lineMatch && lineMatch[1]) {
                    const lineNum = parseInt(lineMatch[1]);
                    const actualLine = diagram.startLine + lineNum - 1;
                    logMessage(`[MERMAID] Error at line ${lineNum} in diagram (editor line ${actualLine})`, 'error');
                    
                    // Show the problematic line
                    const errorLine = lines[actualLine - 1] || '';
                    logMessage(`[MERMAID] Code: ${errorLine.trim()}`, 'error');
                    
                    // Add functionality to highlight the error in the editor
                    logMessage(`[MERMAID] 🔍 To highlight this line, click the line number ${actualLine} in the editor`, 'info');
                }
                
                // Provide suggestions
                provideMermaidErrorSuggestions(errorMsg);
            }
        }
        
        // Summary
        if (errorDiagrams === 0) {
            logMessage(`[MERMAID] 🎉 All ${validDiagrams} diagram(s) are valid!`);
        } else {
            logMessage(`[MERMAID] Found ${errorDiagrams} diagram(s) with errors out of ${diagrams.length} total`);
            logMessage(`[MERMAID] 📝 After fixing errors, click the refresh button (↻) to update the preview`);
        }
        
        // Validate against preview errors
        validatePreviewMermaidErrors();
        
    } catch (error) {
        console.error('Error during Mermaid validation:', error);
        logMessage(`[MERMAID ERROR] Validation failed: ${error.message}`, 'error');
    }
}

// Helper function to provide suggestions based on common errors
function provideMermaidErrorSuggestions(errorMsg) {
    const lowerError = errorMsg.toLowerCase();
    
    if (lowerError.includes('syntax error') || lowerError.includes('unexpected token')) {
        logMessage('[MERMAID] 💡 Suggestion: Check for missing arrows (-->, ---) or incorrect brackets', 'info');
    }
    
    if (lowerError.includes('illegal return')) {
        logMessage('[MERMAID] 💡 Suggestion: Avoid using "return" as a node ID or put it in quotes/brackets', 'info');
        logMessage('[MERMAID] Example: A["return value"] instead of A[return value]', 'info');
    }
    
    if (lowerError.includes('invalid direction')) {
        logMessage('[MERMAID] 💡 Suggestion: Use valid graph directions: TB, BT, RL, or LR', 'info');
    }
    
    if (lowerError.includes('undefined') && lowerError.includes('node')) {
        logMessage('[MERMAID] 💡 Suggestion: Ensure all nodes are defined before being referenced', 'info');
    }
    
    if (lowerError.includes('missing') && lowerError.includes('key')) {
        logMessage('[MERMAID] 💡 Suggestion: Check that all objects have required fields', 'info');
    }
}

// Function to validate Mermaid errors in the preview
function validatePreviewMermaidErrors() {
    try {
        // Check if we can find any Mermaid error elements in the preview
        const preview = document.getElementById('md-preview');
        if (!preview) {
            return;
        }
        
        // Look for elements with the class 'mermaid-error' or similar
        const errorElements = preview.querySelectorAll('.mermaid-error, .error');
        if (errorElements && errorElements.length > 0) {
            logMessage(`[MERMAID] Found ${errorElements.length} error(s) in the preview pane`, 'warning');
            logMessage('[MERMAID] Switch to Preview mode to see detailed error messages', 'info');
        }
    } catch (error) {
        console.error('Error checking preview errors:', error);
    }
}

// Export functions for use in other modules
export { executeCommand, handleClientSide, setupCliHandlers }; 