/**
 * views.js
 * Handles view management functionality (code, split, preview)
 */
import { logMessage } from '/client/log/index.js';
import { eventBus } from '/client/eventBus.js';

// View modes enum
export const VIEW_MODES = {
  CODE: 'code',
  SPLIT: 'split',
  PREVIEW: 'preview'
};

// Keep track of current view and initialization state
let currentView = null;
let initialized = false;
const viewChangeListeners = [];

/**
 * Set the current view mode
 * @param {string} mode - The view mode: 'code', 'split', or 'preview'
 */
export function setView(mode) {
  // Validate mode
  if (!Object.values(VIEW_MODES).includes(mode)) {
    logMessage(`[VIEWS ERROR] Invalid view mode: ${mode}`, 'error');
    return;
  }
  
  // Get required elements
  const container = document.getElementById('content');
  const editor = document.getElementById('md-editor');
  const preview = document.getElementById('md-preview');
  
  if (!container || !editor || !preview) {
    logMessage('[VIEWS ERROR] Required view elements not found', 'error');
    return;
  }
  
  // Set view classes
  container.classList.remove('code-view', 'split-view', 'preview-view');
  container.classList.add(`${mode}-view`);
  
  // Clear any inline styles that might interfere
  // container.style = ''; // Removing this - might break intended styles
  // editor.style = '';
  // preview.style = '';
  
  // Add specific styles for split view to ensure it works if CSS isn't enough
  // This might be better handled purely in CSS if possible
  // if (mode === VIEW_MODES.SPLIT) {
  //   container.style.display = 'flex';
  //   container.style.flexDirection = 'row';
  //   editor.style.width = '50%';
  //   editor.style.display = 'block';
  //   preview.style.width = '50%';
  //   preview.style.display = 'block';
  // }
  
  // Set active button state
  document.querySelectorAll('.view-controls button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeButton = document.getElementById(`${mode}-view`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
  
  // Update current view
  const previousView = currentView;
  currentView = mode;
  
  // Save view mode to localStorage
  localStorage.setItem('viewMode', mode);
  
  // Notify via event bus
  eventBus.emit('view:changed', { mode, previousMode: previousView });
  
  // Notify via DOM event for backward compatibility
  document.dispatchEvent(new CustomEvent('view:changed', {
    detail: { mode, previousMode: previousView }
  }));
  
  // Notify listeners
  viewChangeListeners.forEach(listener => {
    try {
      listener(mode, previousView);
    } catch (error) {
      logMessage(`[VIEWS ERROR] Error in view change listener: ${error.message}`, 'error');
    }
  });
  
  logMessage(`[VIEWS] View changed to ${mode}`);
}

/**
 * Get the current view mode
 * @returns {string} The current view mode
 */
export function getView() {
  return currentView || localStorage.getItem('viewMode') || VIEW_MODES.SPLIT;
}

/**
 * Register a callback for view changes
 * @param {Function} callback - Function to call on view change
 * @returns {Function} Function to call to unregister the listener
 */
export function onViewChange(callback) {
  if (typeof callback !== 'function') {
    logMessage('[VIEWS ERROR] onViewChange requires a function callback', 'error');
    return () => {}; // No-op unsubscribe
  }
  
  viewChangeListeners.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = viewChangeListeners.indexOf(callback);
    if (index !== -1) {
      viewChangeListeners.splice(index, 1);
    }
  };
}

/**
 * Replace a button with a clone to remove all event listeners
 * @private
 */
function replaceButton(button) {
  if (!button) return null;
  const clone = button.cloneNode(true);
  button.parentNode.replaceChild(clone, button);
  return clone;
}

/**
 * Initialize view controls
 */
export function initViewControls() {
  // Prevent multiple initializations
  if (initialized) {
    logMessage('[VIEWS] View controls already initialized, skipping');
    return;
  }
  
  logMessage('[VIEWS] Initializing view controls');
  
  // Set up event delegation on the parent container
  const viewControls = document.querySelector('.view-controls');
  if (viewControls) {
     // Clone node technique to ensure old listeners are removed
    const newViewControls = viewControls.cloneNode(true);
    viewControls.parentNode.replaceChild(newViewControls, viewControls);
    
    newViewControls.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      
      const viewMode = button.id.replace('-view', ''); // Extract mode from ID
      if (Object.values(VIEW_MODES).includes(viewMode)) {
          setView(viewMode);
      }
      
      // Prevent default and stop propagation
      e.preventDefault();
      e.stopPropagation();
    });
    
    logMessage('[VIEWS] View controls event delegation set up');
  } else {
      logMessage('[VIEWS ERROR] View controls container not found!', 'error');
      // Attempt direct binding as fallback (less ideal)
      const codeBtn = document.getElementById('code-view');
      const splitBtn = document.getElementById('split-view');
      const previewBtn = document.getElementById('preview-view');
      if(codeBtn) codeBtn.addEventListener('click', () => setView(VIEW_MODES.CODE));
      if(splitBtn) splitBtn.addEventListener('click', () => setView(VIEW_MODES.SPLIT));
      if(previewBtn) previewBtn.addEventListener('click', () => setView(VIEW_MODES.PREVIEW));
      logMessage('[VIEWS WARNING] Using direct event listeners as fallback.', 'warning');
  }
  
  // Apply saved view mode
  const savedMode = localStorage.getItem('viewMode') || VIEW_MODES.SPLIT;
  setView(savedMode);
  
  // Add keyboard shortcuts (Consider moving to a dedicated keyboard shortcut module)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) { // Alt + Number only
      if (e.key === '1') {
        setView(VIEW_MODES.CODE);
        e.preventDefault();
      } else if (e.key === '2') {
        setView(VIEW_MODES.SPLIT);
        e.preventDefault();
      } else if (e.key === '3') {
        setView(VIEW_MODES.PREVIEW);
        e.preventDefault();
      }
    }
  });
  
  // Make function available globally for backward compatibility (REMOVE if possible)
  window.setView = setView;
  
  initialized = true;
  logMessage('[VIEWS] View controls initialization complete');
  
  // Return current view for convenience
  return getView();
}

// Export the module for use with default imports
const views = {
  VIEW_MODES,
  setView,
  getView,
  onViewChange,
  initViewControls
};

export default views; 