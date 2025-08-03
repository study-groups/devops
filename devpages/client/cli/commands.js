
import { logMessage } from '../log/index.js';

// Define registerCliCommand at the top of the file
export function registerCliCommand(commandName, handlerFunction) {
    // Implementation depends on your application
    // Basic version:
    if (!window.CLI_COMMANDS) {
        window.CLI_COMMANDS = new Map();
    }
    window.CLI_COMMANDS.set(commandName, handlerFunction);
    console.log(`[CLI] Registered command: ${commandName}`);
}

// Add Mermaid diagram validation command
registerCliCommand('mermaid:validate', async (args) => {
    logMessage('[CLI] Validating Mermaid diagrams...');
    
    const editor = document.querySelector('#md-editor textarea');
    if (!editor) {
        logMessage('[CLI ERROR] Editor not found');
        return;
    }
    
    // Find all mermaid diagrams in the document
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
                content: mermaidContent
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
    let hasErrors = false;
    for (let i = 0; i < diagrams.length; i++) {
        const diagram = diagrams[i];
        logMessage(`[MERMAID] Validating diagram #${i + 1} (lines ${diagram.startLine}-${diagram.endLine})...`);
        
        try {
            // Parse the diagram
            await mermaid.parse(diagram.content);
            logMessage(`[MERMAID] ✅ Diagram #${i + 1} is valid`);
        } catch (error) {
            hasErrors = true;
            const errorMsg = error.str || error.message || String(error);
            logMessage(`[MERMAID] ❌ Error in diagram #${i + 1}:`, 'error');
            logMessage(`[MERMAID] ${errorMsg}`, 'error');
            
            // Try to extract line number information
            const lineMatch = errorMsg.match(/line (\d+)/i) || errorMsg.match(/Line #(\d+)/i);
            if (lineMatch && lineMatch[1]) {
                const lineNum = parseInt(lineMatch[1]);
                const actualLine = diagram.startLine + lineNum - 1;
                logMessage(`[MERMAID] Error is at line ${lineNum} in the diagram (editor line ${actualLine})`, 'error');
                
                // Highlight the error line
                const errorLine = lines[actualLine - 1] || '';
                logMessage(`[MERMAID] Code: ${errorLine.trim()}`, 'error');
            }
            
            // Show suggested fixes based on common errors
            suggestMermaidFixes(errorMsg);
        }
    }
    
    if (!hasErrors) {
        logMessage('[MERMAID] All diagrams are valid! 🎉');
    } else {
        logMessage('[MERMAID] 📝 Fixed your diagrams? Run "refresh" to update the preview');
    }
    
    // If 'refresh' argument is provided, refresh the preview
    if (args.includes('refresh')) {
        logMessage('[MERMAID] Refreshing preview...');
        document.getElementById('refresh-btn')?.click();
    }
});

// Helper function to suggest fixes based on common errors
function suggestMermaidFixes(errorMsg) {
    const lowerError = errorMsg.toLowerCase();
    
    if (lowerError.includes('syntax error') || lowerError.includes('unexpected token')) {
        logMessage('[MERMAID] 💡 Suggestion: Check for missing arrows (-->, ---) or incorrect brackets', 'info');
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

// This function call appears to be incorrect as it's not defined in the file
// Remove or comment it out
// validateMermaidDiagrams(); 

// Add a force reload command
registerCliCommand('force-reload', async (args) => {
    logMessage('[CLI] Force reloading current file...');
    
    try {
        // Get current file and directory from UI state
        const currentFile = uiState.currentFile;
        const currentDir = uiState.currentDir;
        
        if (!currentFile || !currentDir) {
            logMessage('[CLI ERROR] No file currently open', 'error');
            return;
        }
        
        logMessage(`[CLI] Reloading ${currentDir}/${currentFile}`);
        
        // Force reload the file
        await loadFile(currentFile, currentDir, true); // true = force reload
        
        logMessage('[CLI] File reloaded successfully');
    } catch (error) {
        logMessage(`[CLI ERROR] Failed to reload file: ${error.message}`, 'error');
    }
}); 