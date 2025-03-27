/**
 * Mermaid direct integration
 * 
 * DEPRECATED: This file is maintained for backward compatibility only.
 * The functionality has been integrated into core/preview.js
 * 
 * This hooks into the view change and preview update events to ensure Mermaid diagrams render
 */

// Import the core implementation
import { initializeMermaid, renderMermaidDiagrams } from '/client/core/preview.js';
import { logMessage } from '/client/log/index.js';

document.addEventListener('DOMContentLoaded', function() {
  logMessage('[MERMAID] mermaidFix.js is deprecated. Functionality has been integrated into core/preview.js', 'warning');
  
  // Initialize the core implementation
  initializeMermaid().then(initialized => {
    if (initialized) {
      // Set up listeners for backward compatibility
      
      // Hook into view changes
      document.addEventListener('view:changed', function(e) {
        logMessage(`[MERMAID] View changed to ${e.detail?.mode}, checking for diagrams`);
        // Give time for the view change to complete
        setTimeout(renderMermaidDiagrams, 200);
      });
      
      // Hook into existing preview update function
      const originalUpdatePreview = window.updateMarkdownPreview;
      if (typeof originalUpdatePreview === 'function') {
        window.updateMarkdownPreview = function(...args) {
          logMessage('[MERMAID] Preview update intercepted');
          // Call the original function
          const result = originalUpdatePreview.apply(this, args);
          
          // After the preview is updated, render mermaid diagrams
          if (result instanceof Promise) {
            result.then(() => {
              setTimeout(renderMermaidDiagrams, 100);
            });
          } else {
            setTimeout(renderMermaidDiagrams, 100);
          }
          
          return result;
        };
        logMessage('[MERMAID] Hooked into updateMarkdownPreview');
      }
      
      // Hook into the refresh button
      const refreshBtn = document.getElementById('refresh-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
          logMessage('[MERMAID] Refresh button clicked');
          setTimeout(renderMermaidDiagrams, 300);
        });
        logMessage('[MERMAID] Connected to refresh button');
      }
      
      // Initial render attempt
      setTimeout(renderMermaidDiagrams, 500);
    }
  });
}); 