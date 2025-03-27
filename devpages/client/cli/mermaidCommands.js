// client/cli/mermaidCommands.js - Mermaid-specific commands
import { logMessage } from '../log/index.js';
import { registerCliCommand } from './registry.js';

// Export a function that registers all mermaid-related commands
export async function registerMermaidCommands() {
  console.log('[CLI] Registering Mermaid commands');
  
  // Register the mermaid:validate command
  registerCliCommand('mermaid:validate', async (args) => {
    logMessage('[CLI] Validating Mermaid diagrams...');
    const { validateMermaidDiagrams } = await import('./mermaidValidation.js');
    return validateMermaidDiagrams(args);
  });
  
  // Register other mermaid-related commands if needed
  
  console.log('[CLI] Mermaid commands registered');
}

// Function to validate Mermaid diagrams and display errors
export async function validateMermaidDiagrams(args) {
  logMessage('[MERMAID] Starting diagram validation...');
  
  try {
    // Get the editor content
    const editor = document.querySelector('#md-editor textarea');
    if (!editor) {
      logMessage('[MERMAID ERROR] Editor not found');
      return 'Error: Editor not found';
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
      return 'No Mermaid diagrams found';
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
        }
        
        // Provide suggestions
        provideMermaidErrorSuggestions(errorMsg);
      }
    }
    
    // Summary
    if (errorDiagrams === 0) {
      logMessage(`[MERMAID] 🎉 All ${validDiagrams} diagram(s) are valid!`);
      return `All ${validDiagrams} diagram(s) are valid!`;
    } else {
      const summaryMsg = `Found ${errorDiagrams} diagram(s) with errors out of ${diagrams.length} total`;
      logMessage(`[MERMAID] ${summaryMsg}`);
      logMessage(`[MERMAID] 📝 After fixing errors, click the refresh button (↻) to update the preview`);
      return summaryMsg;
    }
  } catch (error) {
    console.error('Error during Mermaid validation:', error);
    logMessage(`[MERMAID ERROR] Validation failed: ${error.message}`, 'error');
    return `Validation failed: ${error.message}`;
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