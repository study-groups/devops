/**
 * Preview Manager
 * Direct implementation of markdown preview functionality
 */

import { initPreview, updatePreview, getPreviewInstance } from './preview/index.js';
import { appStore } from '/client/appState.js';

// Keep track of initialization and subscription
let isPreviewInitialized = false;
let appStateUnsubscribe = null;

// Define a default set of plugins known to work for initial load
const DEFAULT_INITIAL_PLUGINS = ['highlight', 'mermaid', 'katex', 'audio-md']; // Simplified list

// Initialize or Update Preview Logic
async function initializeOrUpdatePreview(isUpdate = false) {
  console.log(`[previewManager] initializeOrUpdatePreview called. isUpdate=${isUpdate}`);

  try {
    let previewNeedsRefresh = false;

    // --- Initialization (only once) ---
    if (!isUpdate && !isPreviewInitialized) {
      console.log('[previewManager] Performing initial preview system initialization...');
      
      // Get the actual DOM element for the container
      const containerElement = document.getElementById('preview-container');
      if (!containerElement) {
        console.error('[previewManager] Preview container element not found');
        return;
      }
      
      const result = await initPreview({
        container: containerElement, // Pass the actual DOM element
        plugins: DEFAULT_INITIAL_PLUGINS,
        theme: 'light',
        autoInit: true
      });

      if (result) {
        console.log('[previewManager] Initial preview system initialized successfully');
        isPreviewInitialized = true;
        setupEventHandlers();
        previewNeedsRefresh = true;
      } else {
        console.error('[previewManager] Failed to initialize preview system initially');
        return;
      }
    } else if (isUpdate) {
      // --- Re-initialization of Plugins (if already initialized and called for update) ---
      console.log('[previewManager] Re-initializing plugins for update...');
      previewNeedsRefresh = true;
    }

    // Refresh the preview content if needed
    if (previewNeedsRefresh) {
      console.log('[previewManager] Triggering preview refresh...');
      setTimeout(refreshPreview, 0);
    }

  } catch (error) {
    console.error('[previewManager] Error during preview initialization/update:', error);
  }
}

// Setup event handlers (call once after initial successful init)
function setupEventHandlers() {
  console.log('[previewManager] Setting up event handlers...');
  // Set up editor input handler
  const editor = document.querySelector('#editor-container textarea');
  if (editor && !editor.dataset.previewHandlerAttached) {
    editor.addEventListener('input', debouncePreviewUpdate);
    editor.dataset.previewHandlerAttached = 'true';
    console.log('[previewManager] Editor input handler connected');
  }

  // Set up refresh button handler
  const refreshBtn = document.querySelector(".preview-container");
  if (refreshBtn && !refreshBtn.dataset.previewHandlerAttached) {
    refreshBtn.addEventListener('click', refreshPreview);
    refreshBtn.dataset.previewHandlerAttached = 'true';
    console.log('[previewManager] Refresh button connected');
  }

  // Handle view changes
  document.removeEventListener('view:changed', handleViewChange);
  document.addEventListener('view:changed', handleViewChange);

  // Make function available globally (optional)
  window.updateMarkdownPreview = refreshPreview;
}

// Refresh the preview with current editor content
export async function refreshPreview() {
  console.log('[previewManager] refreshPreview called, isPreviewInitialized:', isPreviewInitialized);
  
  if (!isPreviewInitialized) {
    console.warn('[previewManager] refreshPreview called before initialization. Attempting to initialize...');
    try {
      await initializeOrUpdatePreview(false);
      if (!isPreviewInitialized) {
        console.error('[previewManager] Failed to initialize preview system during refresh');
        return;
      }
    } catch (error) {
      console.error('[previewManager] Error initializing preview during refresh:', error);
      return;
    }
  }
  
  const editor = document.querySelector('#editor-container textarea');
  if (!editor) {
    console.error('[previewManager] Editor element not found for refresh');
    return;
  }
  const content = editor.value || '';
  
  // --- Get current file path from appStore ---
  let currentPathname = null;
  try {
      const fileState = appStore.getState().file;
      currentPathname = fileState?.currentPathname;
      // Silent fallback - not having a currentPathname is normal for unsaved content
  } catch (e) {
       console.error('[previewManager] Error accessing file state from appStore:', e);
  }
  // --- End Get Path ---
  
  try {
    // --- Pass pathname to updatePreview ---
    console.log(`[previewManager] Calling updatePreview for path: ${currentPathname || 'unknown'}`);
    await updatePreview(content, currentPathname || '');
  } catch (error) {
    console.error('[previewManager] Error updating preview:', error);
  }
}

// Debounced version of preview update
let updateTimer;
function debouncePreviewUpdate() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(refreshPreview, 750);
}

// Handle view changes
function handleViewChange(e) {
  const mode = e.detail?.mode;
  if (mode === 'preview' || mode === 'split') {
    console.log(`[previewManager] View changed to ${mode}, refreshing preview`);
    setTimeout(refreshPreview, 100);
  }
}

// Function to set up the store subscription
function subscribeToStoreChanges() {
  if (appStateUnsubscribe) {
    appStateUnsubscribe();
  }
  console.log('[previewManager] Subscribing to appStore changes...');
  appStateUnsubscribe = appStore.subscribe((newState, prevState) => {
    console.log('[previewManager] Store subscription callback triggered');
    
    // Use deep comparison for plugins to detect changes in plugin settings
    const newPluginsString = JSON.stringify(newState.plugins);
    const oldPluginsString = JSON.stringify(prevState.plugins);
    const pluginsChanged = newPluginsString !== oldPluginsString;
    
    console.log('[previewManager] Plugin comparison:', {
      pluginsChanged,
      newPluginsLength: newPluginsString?.length || 0,
      oldPluginsLength: oldPluginsString?.length || 0,
      isPreviewInitialized
    });

    // Check if preview CSS settings have changed.
    // A proper deep comparison would be more robust than JSON.stringify for arrays of objects.
    const newCssFilesString = JSON.stringify(newState.settings?.preview?.cssFiles);
    const oldCssFilesString = JSON.stringify(prevState.settings?.preview?.cssFiles);
    const cssFilesChanged = newCssFilesString !== oldCssFilesString;

    // Consider activeCssFiles as well if its changes should also trigger re-evaluation
    const newActiveCssFilesString = JSON.stringify(newState.settings?.preview?.activeCssFiles);
    const oldActiveCssFilesString = JSON.stringify(prevState.settings?.preview?.activeCssFiles);
    const activeCssFilesChanged = newActiveCssFilesString !== oldActiveCssFilesString;

    const cssSettingsChanged = cssFilesChanged || activeCssFilesChanged;

    if (isPreviewInitialized && (pluginsChanged || cssSettingsChanged)) {
      if (pluginsChanged) {
        console.log('[previewManager] Detected change in appStore plugins state. Re-initializing plugins...');
      }
      if (cssSettingsChanged && !pluginsChanged) { // Log only if it's the primary reason
        console.log('[previewManager] Detected change in preview CSS files state. Re-evaluating plugins.');
      }
      // Trigger re-initialization of plugins. The 'css' plugin, if enabled,
      // should then pick up the latest cssFiles from the store during its re-initialization.
      initializeOrUpdatePreview(true);
    }
  });
}

// --- NEW EXPORTED INITIALIZATION FUNCTION ---
export async function initializePreviewManager() {
  if (isPreviewInitialized) {
    console.log('[previewManager] Preview system already initialized. Skipping initializePreviewManager call.');
    return;
  }
  console.log('[previewManager] initializePreviewManager called to begin setup...');

  // Ensure the container exists before proceeding (Bootstrap.js should ensure this by calling us at the right time)
  // However, a defensive check here is good practice.
  if (!document.getElementById('preview-container')) {
    console.error('[previewManager] CRITICAL: #preview-container not found in DOM. Preview cannot initialize.');
    // Optionally, dispatch an error state to the appStore or throw an error
    return; // Halt initialization if container is missing
  }

  try {
    await initializeOrUpdatePreview(false); // Perform the actual initialization
    
    // Only subscribe to store changes if the initial setup was successful
    if (isPreviewInitialized) {
      subscribeToStoreChanges();
      console.log('[previewManager] Preview system setup complete and subscriptions active.');
    } else {
      // This case implies initializeOrUpdatePreview returned early due to an error (e.g., initPreview failed)
      console.warn('[previewManager] Preview system main setup (initializeOrUpdatePreview) did not complete successfully. Store subscriptions skipped.');
    }
  } catch (error) {
    console.error('[previewManager] CRITICAL ERROR during initializePreviewManager execution:', error);
    // Optionally, dispatch an error or update UI to reflect this critical failure
  }
}

// --- Initial Setup --- 
/* --- Auto-start removed, initialization now controlled by bootstrap.js --- 
document.addEventListener('DOMContentLoaded', () => {
  console.log('[previewManager DEBUG] DOMContentLoaded event fired. Running setup...'); 
  try {
    initializeOrUpdatePreview(false);
    subscribeToStoreChanges();
    console.log('[previewManager DEBUG] Setup functions called successfully.');
  } catch (error) {
    console.error('[previewManager DEBUG] CRITICAL ERROR inside DOMContentLoaded handler:', error);
  }
}); 
*/ 