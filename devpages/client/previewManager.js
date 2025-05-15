/**
 * Preview Manager
 * Direct implementation of markdown preview functionality
 */

import { initPreview, updatePreview, getPreviewInstance } from './preview/index.js';
import { appStore } from '/client/appState.js'; // Import appStore to access state

// Keep track of initialization and subscription
let isPreviewInitialized = false;
let appStateUnsubscribe = null;

// Define a default set of plugins known to work for initial load
const DEFAULT_INITIAL_PLUGINS = ['highlight', 'mermaid', 'katex', 'audio-md', 'github-md', 'css', 'markdown-svg']; // Adjust if needed

// Initialize or Update Preview Logic
async function initializeOrUpdatePreview(isUpdate = false) {
  console.log(`[previewManager] initializeOrUpdatePreview called. isUpdate=${isUpdate}`);

  let pluginsToUse;
  let configSource;

  if (!isUpdate && !isPreviewInitialized) {
    // --- Initial Load --- 
    console.log('[previewManager] Performing initial load. Using DEFAULT_INITIAL_PLUGINS.');
    pluginsToUse = DEFAULT_INITIAL_PLUGINS;
    configSource = 'Defaults';
  } else {
    // --- Subsequent Update (from store change) ---
    console.log('[previewManager] Performing update. Getting plugins from appStore.');
    const state = appStore.getState();
    const currentPluginsState = state.plugins || {};
    pluginsToUse = Object.entries(currentPluginsState)
      .filter(([id, config]) => config.enabled)
      .map(([id]) => id);
    configSource = 'appStore';
    console.log('[previewManager] Enabled plugins based on current state:', pluginsToUse);
  }

  console.log(`[previewManager] Plugins to initialize (from ${configSource}):`, pluginsToUse);

  try {
    let previewNeedsRefresh = false;

    // --- Initialization (only once) ---
    if (!isPreviewInitialized) {
      console.log('[previewManager] Performing initial preview system initialization...');
      const result = await initPreview({
        container: '#preview-container',
        plugins: pluginsToUse,
        theme: 'light',
        autoInit: true
      });

      if (result) {
        console.log('[previewManager] Initial preview system initialized successfully');
        isPreviewInitialized = true;
        setupEventHandlers();
        previewNeedsRefresh = true;
      } else {
        console.error('[previewManager] Failed to initialize preview system initially (initPreview returned false)');
        return;
      }
    } else if (isUpdate) {
      // --- Re-initialization of Plugins (if already initialized and called for update) ---
      console.log('[previewManager] Re-initializing plugins for update...');
      const previewInstance = getPreviewInstance();
      if (previewInstance) {
        const { initPlugins } = await import('./preview/plugins/index.js');
        await initPlugins(pluginsToUse, { /* config if needed */ });
        console.log('[previewManager] Plugins re-initialized with:', pluginsToUse);
        previewNeedsRefresh = true;
      } else {
        console.warn('[previewManager] Preview instance not found for plugin re-initialization.');
      }
    }

    // Refresh the preview content if needed (after initial init or plugin change)
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
  const refreshBtn = document.getElementById('preview-reload-btn');
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
  if (!isPreviewInitialized) {
    console.warn('[previewManager] refreshPreview called before initialization.');
    return;
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
      if (!currentPathname) {
          console.warn('[previewManager] Could not get currentPathname from appStore state for preview includes.');
      }
  } catch (e) {
       console.error('[previewManager] Error accessing file state from appStore:', e);
  }
  // --- End Get Path ---
  
  try {
    // --- Pass pathname to updatePreview ---
    console.log(`[previewManager] Calling updatePreview for path: ${currentPathname || 'unknown'}`);
    await updatePreview(content, currentPathname); 
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
    const pluginsChanged = newState.plugins !== prevState.plugins;

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
  if (!document.querySelector('#preview-container')) {
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