/**
 * Auto Preview and File Loading
 * Automatically loads the last file and updates preview when the page loads
 */

import { logMessage } from './log/index.js';
import { initPreview, updatePreview } from './preview/index.js';
import { createPublishButton, checkPublishStatus } from './components/publishButton.js';
import { createFloatingPublishButton } from './components/floatingPublishButton.js';

// Immediate page load handler for file loading and preview
(function immediatePageLoadHandler() {
  console.log('[AUTO-LOAD] Starting immediate file load handler');
  
  // Function to attempt loading the last active file
  const attemptFileLoad = async (attemptCount = 1) => {
    console.log(`[AUTO-LOAD] Attempt ${attemptCount} to load last file and update preview`);
    
    try {
      // Check if we have stored file information
      const currentDir = localStorage.getItem('currentDir');
      const currentFile = localStorage.getItem('currentFile');
      
      if (!currentDir || !currentFile) {
        console.log('[AUTO-LOAD] No stored file information found');
        return;
      }
      
      console.log(`[AUTO-LOAD] Found stored file: ${currentDir}/${currentFile}`);
      
      // Try to access the file manager and load buttons
      const dirSelect = document.getElementById('dir-select');
      const fileSelect = document.getElementById('file-select');
      const loadBtn = document.getElementById('load-btn');
      
      if (!dirSelect || !fileSelect || !loadBtn) {
        console.log('[AUTO-LOAD] UI elements not found yet, will retry');
        if (attemptCount < 5) {
          setTimeout(() => attemptFileLoad(attemptCount + 1), attemptCount * 300);
        }
        return;
      }
      
      // Check if the auth state is ready (we don't want to trigger loads before login)
      const authState = JSON.parse(localStorage.getItem('authState') || '{}');
      if (!authState || !authState.isLoggedIn) {
        console.log('[AUTO-LOAD] User not logged in, skipping auto-load');
        return;
      }
      
      // Set the directory and file in the selects
      console.log('[AUTO-LOAD] Setting directory and file selectors');
      
      // Check if the directory option exists
      let dirExists = false;
      for (let i = 0; i < dirSelect.options.length; i++) {
        if (dirSelect.options[i].value === currentDir) {
          dirExists = true;
          dirSelect.selectedIndex = i;
          break;
        }
      }
      
      if (!dirExists && dirSelect.options.length > 0) {
        // If not found but we have options, add it
        const option = document.createElement('option');
        option.value = currentDir;
        option.textContent = currentDir;
        dirSelect.appendChild(option);
        dirSelect.value = currentDir;
      }
      
      // Trigger change event on directory select to load files
      dirSelect.dispatchEvent(new Event('change'));
      
      // Wait for file list to populate
      console.log('[AUTO-LOAD] Waiting for file list to populate');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now set the file
      let fileExists = false;
      for (let i = 0; i < fileSelect.options.length; i++) {
        if (fileSelect.options[i].value === currentFile) {
          fileExists = true;
          fileSelect.selectedIndex = i;
          break;
        }
      }
      
      if (!fileExists && fileSelect.options.length > 0) {
        console.log(`[AUTO-LOAD] File ${currentFile} not found in options`);
        return;
      }
      
      // Trigger a click on the load button
      console.log('[AUTO-LOAD] Clicking load button');
      loadBtn.click();
      
      // Wait for file content to load
      console.log('[AUTO-LOAD] Waiting for file content to load');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now update the preview
      const editor = document.querySelector('#md-editor textarea');
      if (editor && editor.value) {
        console.log(`[AUTO-LOAD] Editor content loaded (${editor.value.length} chars), updating preview`);
        
        // Initialize preview if needed
        await initPreview({
          container: '#md-preview',
          plugins: ['highlight', 'mermaid', 'katex'],
          theme: 'light'
        });
        
        // Update preview
        await updatePreview(editor.value);
        console.log('[AUTO-LOAD] Preview updated with loaded file content');
      } else {
        console.log('[AUTO-LOAD] Editor still empty after load attempt');
      }
    } catch (error) {
      console.error('[AUTO-LOAD] Error during auto-load process:', error);
    }
  };
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[AUTO-LOAD] DOM ready, attempting file load');
      setTimeout(() => attemptFileLoad(), 800);
    });
  } else {
    // DOM already ready, start after a short delay
    setTimeout(() => attemptFileLoad(), 800);
  }
  
  // Additional attempt when window fully loads
  window.addEventListener('load', () => {
    console.log('[AUTO-LOAD] Window fully loaded, attempting file load');
    setTimeout(() => attemptFileLoad(), 1000);
  });
})();

// Main initialization for normal preview updates
document.addEventListener('DOMContentLoaded', () => {
  logMessage('[AUTO-PREVIEW] Initializing automatic preview system');
  
  // Try to find a suitable container for the publish button
  const possibleContainers = [
    '#toolbar-container',
    '.md-toolbar',
    '#editor-controls',
    '.editor-controls',
    '.file-controls',
    '#top-bar',
    '#md-editor'
  ];
  
  let foundContainer = null;
  for (const selector of possibleContainers) {
    const container = document.querySelector(selector);
    if (container) {
      foundContainer = selector;
      logMessage(`[AUTO-PREVIEW] Found container for publish button: ${selector}`);
      break;
    }
  }
  
  if (!foundContainer) {
    logMessage('[AUTO-PREVIEW] No suitable container found for publish button');
    foundContainer = 'body'; // Fallback to body
  }
  
  // Create the publish button
  if (!document.getElementById('publish-btn')) {
    const toolbarContainer = document.querySelector('#toolbar-container');
    if (toolbarContainer) {
      createPublishButton('#toolbar-container');
      logMessage('[AUTO-PREVIEW] Created publish button in toolbar');
    } else {
      createFloatingPublishButton();
      logMessage('[AUTO-PREVIEW] Created floating publish button as fallback');
    }
  } else {
    logMessage('[AUTO-PREVIEW] Publish button already exists, not creating another');
  }
  
  // Connect to file load button
  const loadBtn = document.getElementById('load-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      logMessage('[AUTO-PREVIEW] Load button clicked, updating preview');
      setTimeout(() => {
        updatePreviewFromEditor();
        checkPublishStatus();  // Check if loaded file is published
      }, 500);
    });
  }
  
  // Connect to file selection dropdown
  const fileSelect = document.getElementById('file-select');
  if (fileSelect) {
    fileSelect.addEventListener('change', () => {
      logMessage('[AUTO-PREVIEW] File selected, updating preview');
      setTimeout(() => {
        updatePreviewFromEditor();
        checkPublishStatus();  // Check if selected file is published
      }, 300);
    });
  }
  
  // Function to update preview from current editor content
  function updatePreviewFromEditor() {
    const editor = document.querySelector('#md-editor textarea');
    if (!editor) {
      logMessage('[AUTO-PREVIEW] Editor not found');
      return;
    }
    
    const content = editor.value || '';
    logMessage(`[AUTO-PREVIEW] Updating preview with content (${content.length} chars)`);
    
    try {
      // Use the existing update function
      updatePreview(content);
    } catch (error) {
      logMessage(`[AUTO-PREVIEW] Error updating preview: ${error.message}`);
      console.error('[AUTO-PREVIEW] Error:', error);
    }
  }
  
  // Setup a content observer to detect file loads
  const setupContentObserver = () => {
    const editor = document.querySelector('#md-editor textarea');
    if (!editor) {
      logMessage('[AUTO-PREVIEW] Editor not found for observer');
      setTimeout(setupContentObserver, 500);
      return;
    }
    
    let lastValue = editor.value;
    const checkInterval = setInterval(() => {
      const currentValue = editor.value;
      if (currentValue !== lastValue) {
        logMessage('[AUTO-PREVIEW] Content changed, updating preview');
        lastValue = currentValue;
        updatePreviewFromEditor();
      }
    }, 1000);
    
    // Cleanup
    window.addEventListener('beforeunload', () => {
      clearInterval(checkInterval);
    });
    
    logMessage('[AUTO-PREVIEW] Content observer initialized');
  };
  
  // Listen for view changes
  document.addEventListener('view:changed', (e) => {
    const mode = e.detail?.mode;
    if (mode === 'preview' || mode === 'split') {
      logMessage(`[AUTO-PREVIEW] View changed to ${mode}, updating preview`);
      updatePreviewFromEditor();
    }
  });
  
  // Start observer and do initial update
  setupContentObserver();
  setTimeout(() => {
    updatePreviewFromEditor();
    checkPublishStatus();  // Check initial file publish status
  }, 800);
  
  logMessage('[AUTO-PREVIEW] Automatic preview system initialized');
}); 