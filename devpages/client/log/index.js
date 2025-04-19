// log/index.js - Exports the globally defined logging function and LogPanel component

// Define the logMessage function to safely access the global one
// This ensures modules can import it reliably.
export function logMessage(message, type = 'info', subtype = null) { 
    // Default type to 'info' if not provided or null/undefined
    const logType = type || 'info'; 
    
    if (typeof window.logMessage === 'function') {
        // Call the global logMessage (bound to LogPanel.addEntry)
        // Pass the message and the determined type. 
        // Note: LogPanel.addEntry expects (message, type) signature.
        // The 'subtype' concept is handled by prepending it to the 'message' string at the call site.
        window.logMessage(message, logType); 
    } else {
        // Fallback if the global function isn't set up yet (shouldn't happen after bootstrap)
        const subtypePrefix = subtype ? `[${subtype.toUpperCase()}] ` : '';
        console.warn(`[LOG FALLBACK] ${subtypePrefix}${message} (Type: ${logType})`);
    }
}

// Import and re-export the LogPanel class
import { LogPanel } from './LogPanel.js';
export { LogPanel }; 