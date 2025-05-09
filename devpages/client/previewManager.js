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
const DEFAULT_INITIAL_PLUGINS = ['highlight', 'mermaid', 'katex', 'audio-md', 'github-md', 'css']; // Adjust if needed

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
    if (isPreviewInitialized && newState.plugins !== prevState.plugins) {
      console.log('[previewManager] Detected change in appStore plugins state. Re-initializing plugins...');
      initializeOrUpdatePreview(true);
    }
  });
}

// --- Initial Setup --- 
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