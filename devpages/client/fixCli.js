// client/fixCli.js - Following working community link pattern
// Import globalFetch from the module
import { globalFetch } from './globalFetch.js';

console.log('[FIX CLI] Loading CLI handler with correct import pattern');

// Function to execute CLI command using the working pattern from community link
async function executeCLICommand(command) {
  try {
    console.log(`[CLI] Executing command: ${command}`);
    
    // Log the command to the UI
    if (window.logMessage) {
      window.logMessage(`[CLI] $ ${command}`);
    }
    
    // Use the same pattern as the working community link
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
    console.log('[CLI] Command response:', data);
    
    // Log the response
    if (window.logMessage) {
      if (data.output) {
        window.logMessage(`[CLI] ${data.output}`);
      } else {
        window.logMessage(`[CLI] Command executed successfully`);
      }
    }
    
    return data;
  } catch (error) {
    console.error(`[CLI] Error executing command:`, error);
    if (window.logMessage) {
      window.logMessage(`[CLI ERROR] ${error.message}`);
    }
    throw error;
  }
}

// Function to directly initialize the CLI
function initCLI() {
  const cliInput = document.getElementById('cli-input');
  if (!cliInput) {
    console.warn('[FIX CLI] CLI input element not found');
    return false;
  }
  
  console.log('[FIX CLI] Attaching CLI handler');
  
  // Attach the keydown event handler
  cliInput.addEventListener('keydown', async function(event) {
    if (event.key !== 'Enter') return;
    
    const command = this.value.trim();
    if (!command) return;
    
    // Clear the input
    this.value = '';
    
    try {
      // Execute the command
      await executeCLICommand(command);
    } catch (error) {
      // Error is already logged in executeCLICommand
    }
  });
  
  console.log('[FIX CLI] CLI handler attached successfully');
  return true;
}

// Initialize when the document is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initCLI();
} else {
  document.addEventListener('DOMContentLoaded', initCLI);
}

// Also expose globally for debugging
window.executeCLICommand = executeCLICommand;

// Create this new file to patch the CLI system without major changes

// Execute when the page loads
(function() {
    console.log('[FixCLI] Installing CLI command interceptor');
    
    // Store the original globalFetch function
    const originalFetch = window.globalFetch;
    
    // Replace it with our version that intercepts mermaid commands
    window.globalFetch = async function(url, options) {
        // Check if this is a CLI command to the API
        if (url === '/api/cli' && options?.method === 'POST' && options?.body) {
            try {
                // Parse the command from the request body
                const body = JSON.parse(options.body);
                const command = body.command;
                
                // Intercept mermaid commands
                if (command === 'mermaid:check' || command === 'mermaid:validate') {
                    console.log('[FixCLI] Intercepted mermaid command:', command);
                    
                    // Run the validation function
                    setTimeout(() => {
                        validateMermaidDiagrams();
                    }, 0);
                    
                    // Return a fake successful response
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ 
                            output: "Performing client-side Mermaid validation...",
                            success: true
                        })
                    };
                }
            } catch (e) {
                console.error('[FixCLI] Error parsing command:', e);
            }
        }
        
        // For all other requests, use the original fetch
        return originalFetch(url, options);
    };
    
    console.log('[FixCLI] CLI command interceptor installed');
})(); 