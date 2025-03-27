/**
 * Image Upload Fix
 * 
 * DEPRECATED: This file is maintained for backward compatibility only.
 * The functionality has been integrated into core/editor.js
 * 
 * Restores paste image upload functionality
 */

import { logMessage } from '/client/log/index.js';
import { editor } from '/client/core/editor.js';

// Run on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  logMessage('[IMAGE] imageUploadFix.js is deprecated. Functionality has been integrated into core/editor.js', 'warning');
  
  // The image paste handler is now included in the core editor initialization
  // This file is maintained only for backward compatibility
  
  // If core editor hasn't been initialized yet, try to initialize it
  if (typeof editor.initializeEditor === 'function' && !editor.isInitialized) {
    logMessage('[IMAGE] Initializing editor through compatibility layer');
    editor.initializeEditor().catch(error => {
      logMessage(`[IMAGE ERROR] Failed to initialize editor: ${error.message}`, 'error');
    });
  }
}); 