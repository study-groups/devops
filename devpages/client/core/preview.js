/**
 * core/preview.js
 * Single source of truth for preview functionality
 */
import { logMessage } from '../log/index.js';
import { eventBus } from '../eventBus.js';

// Import from preview module
import { initPreview as initPreviewModule, updatePreview as updatePreviewModule } from '../preview/index.js';

// Track initialization state
let previewInitialized = false;
let updateTimer = null;
let mermaidInitialized = false;

/**
 * Initialize Mermaid diagram rendering
 * @returns {Promise<boolean>} Success status
 */
export async function initializeMermaid() {
  if (mermaidInitialized) {
    logMessage('[MERMAID] Already initialized');
    return true;
  }

  logMessage('[MERMAID] Initializing Mermaid diagrams support');

  try {
    // Check if mermaid is already loaded
    if (typeof window.mermaid === 'undefined') {
      logMessage('[MERMAID] Loading Mermaid library from CDN');
      // Dynamic import for mermaid
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js';
      
      // Wait for the script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      logMessage('[MERMAID] Library loaded successfully');
    } else {
      logMessage('[MERMAID] Library already available');
    }

    // Initialize mermaid with appropriate settings
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        htmlLabels: true,
        useMaxWidth: true
      }
    });

    mermaidInitialized = true;
    logMessage('[MERMAID] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[MERMAID ERROR]', error);
    logMessage(`[MERMAID ERROR] Initialization failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Render all Mermaid diagrams in the document
 * @returns {Promise<boolean>} Success status
 */
export async function renderMermaidDiagrams() {
  if (!mermaidInitialized) {
    const initialized = await initializeMermaid();
    if (!initialized) {
      logMessage('[MERMAID ERROR] Could not initialize Mermaid', 'error');
      return false;
    }
  }

  logMessage('[MERMAID] Looking for diagrams to render');
  const diagrams = document.querySelectorAll('.mermaid:not([data-processed="true"])');
  
  if (diagrams.length > 0) {
    logMessage(`[MERMAID] Found ${diagrams.length} unprocessed diagrams`);
    
    try {
      window.mermaid.init(undefined, diagrams);
      logMessage('[MERMAID] Diagrams rendered successfully');
      return true;
    } catch (error) {
      console.error('[MERMAID ERROR]', error);
      logMessage(`[MERMAID ERROR] Error rendering diagrams: ${error.message}`, 'error');
      return false;
    }
  } else {
    logMessage('[MERMAID] No unprocessed diagrams found');
    return true;
  }
}

/**
 * Initialize the preview system with all required plugins
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} Success status
 */
export async function initializePreview(options = {}) {
  if (previewInitialized) {
    logMessage('[PREVIEW] Preview already initialized, skipping');
    return true;
  }
  
  logMessage('[PREVIEW] Initializing preview system');
  
  try {
    // Initialize mermaid support
    await initializeMermaid();
    
    // Default options
    const defaultOptions = {
      container: '#md-preview',
      plugins: ['highlight', 'mermaid', 'katex', 'audio-md', 'github-md'],
      theme: 'light',
      updateDelay: 300
    };
    
    // Merge with user options
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Initialize with all available plugins
    const result = await initPreviewModule(mergedOptions);
    
    if (result) {
      previewInitialized = true;
      logMessage('[PREVIEW] Preview system initialized successfully');
      
      // Connect to editor input events via the event bus
      subscribeToEditorEvents();
      
      // Connect to view changes
      subscribeToViewChanges();
      
      // Make global function available for backward compatibility
      window.updateMarkdownPreview = refreshPreview;
      
      // Emit initialization event
      eventBus.emit('preview:initialized');
      
      return true;
    } else {
      logMessage('[PREVIEW ERROR] Failed to initialize preview system', 'error');
      return false;
    }
  } catch (error) {
    console.error('[PREVIEW ERROR]', error);
    logMessage(`[PREVIEW ERROR] Initialization failed: ${error.message}`, 'error');
    
    // Try fallback initialization
    return initializeFallbackPreview();
  }
}

/**
 * Fallback initialization for when the main preview system fails
 * @returns {Promise<boolean>} Success status
 */
async function initializeFallbackPreview() {
  logMessage('[PREVIEW] Attempting fallback initialization');
  
  try {
    // Find required elements
    const previewContainer = document.getElementById('md-preview');
    if (!previewContainer) {
      logMessage('[PREVIEW ERROR] Preview container not found', 'error');
      return false;
    }
    
    // Try to load renderer directly
    const { renderMarkdown } = await import('../preview/renderer.js');
    
    if (typeof renderMarkdown !== 'function') {
      logMessage('[PREVIEW ERROR] Markdown renderer not found', 'error');
      return false;
    }
    
    // Create a custom update function
    window.updateMarkdownPreview = async function() {
      const editor = document.querySelector('#md-editor textarea');
      const content = editor?.value || '';
      
      logMessage('[PREVIEW] Updating preview with direct renderer');
      
      try {
        const html = await renderMarkdown(content);
        previewContainer.innerHTML = html;
        
        // Initialize mermaid if available
        if (window.mermaid) {
          try {
            window.mermaid.init(undefined, previewContainer.querySelectorAll('.mermaid'));
            logMessage('[PREVIEW] Mermaid diagrams processed');
          } catch (mermaidError) {
            logMessage(`[PREVIEW] Mermaid error: ${mermaidError.message}`);
          }
        }
        
        logMessage('[PREVIEW] Preview updated via fallback method');
        return true;
      } catch (error) {
        logMessage(`[PREVIEW ERROR] Fallback update failed: ${error.message}`, 'error');
        return false;
      }
    };
    
    // Override the normal refresh function to use our fallback
    refreshPreview = window.updateMarkdownPreview;
    
    // Connect to editor input events
    subscribeToEditorEvents();
    
    // Connect to view changes
    subscribeToViewChanges();
    
    previewInitialized = true;
    logMessage('[PREVIEW] Fallback preview system initialized');
    
    // Emit initialization event
    eventBus.emit('preview:initialized');
    
    return true;
  } catch (error) {
    console.error('[PREVIEW ERROR]', error);
    logMessage(`[PREVIEW ERROR] Fallback initialization failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Update the preview with current editor content
 * @returns {Promise<boolean>} Success status
 */
export async function refreshPreview() {
  if (!previewInitialized) {
    const initialized = await initializePreview();
    if (!initialized) {
      logMessage('[PREVIEW ERROR] Could not initialize preview system', 'error');
      return false;
    }
  }
  
  const editor = document.querySelector('#md-editor textarea');
  if (!editor) {
    logMessage('[PREVIEW WARNING] Editor element not found', 'warning');
    return false;
  }
  
  const content = editor.value || '';
  
  try {
    const result = await updatePreviewModule(content);
    if (result) {
      logMessage('[PREVIEW] Preview updated successfully');
      
      // Process mermaid diagrams after update
      setTimeout(() => renderMermaidDiagrams(), 100);
      
      // Emit update event
      eventBus.emit('preview:updated', { content });
      
      return true;
    } else {
      logMessage('[PREVIEW WARNING] Preview update returned false', 'warning');
      return false;
    }
  } catch (error) {
    console.error('[PREVIEW ERROR]', error);
    logMessage(`[PREVIEW ERROR] Update failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Debounced preview update
 * @returns {void}
 */
export function schedulePreviewUpdate() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(refreshPreview, 300);
}

/**
 * Subscribe to editor events via the event bus
 * @returns {void}
 */
function subscribeToEditorEvents() {
  // Subscribe to content changes
  eventBus.on('editor:contentChanged', () => {
    schedulePreviewUpdate();
  });
  
  // Also connect directly to the textarea for backward compatibility
  const editor = document.querySelector('#md-editor textarea');
  if (editor) {
    editor.addEventListener('input', schedulePreviewUpdate);
    logMessage('[PREVIEW] Connected to editor input events');
  }
  
  // Connect refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshPreview);
    logMessage('[PREVIEW] Connected refresh button');
  }
}

/**
 * Subscribe to view change events
 * @returns {void}
 */
function subscribeToViewChanges() {
  // Subscribe to view changes via event bus
  eventBus.on('view:changed', (data) => {
    const mode = data?.mode;
    if (mode === 'preview' || mode === 'split') {
      logMessage(`[PREVIEW] View changed to ${mode}, updating preview`);
      refreshPreview();
    }
  });
  
  // Also connect to DOM events for backward compatibility
  document.addEventListener('view:changed', (e) => {
    const mode = e.detail?.mode;
    if (mode === 'preview' || mode === 'split') {
      logMessage(`[PREVIEW] View changed event detected, updating preview`);
      refreshPreview();
      
      // Process mermaid diagrams after view change
      setTimeout(() => renderMermaidDiagrams(), 200);
    }
  });
  
  logMessage('[PREVIEW] Connected to view change events');
}

/**
 * Set up content viewer for direct view URLs
 * @returns {Promise<boolean>} Success status
 */
export async function setupContentViewer() {
  const params = new URLSearchParams(window.location.search);
  const viewSlug = params.get('view');
  
  if (viewSlug) {
    logMessage(`[PREVIEW] Content viewer mode detected for: ${viewSlug}`);
    
    try {
      // Find or create preview container
      let previewContainer = document.getElementById('md-preview');
      if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.id = 'md-preview';
        previewContainer.className = 'markdown-preview viewer-mode';
        document.body.appendChild(previewContainer);
      }
      
      // Apply viewer mode styles
      previewContainer.classList.add('viewer-mode');
      document.body.classList.add('viewer-mode');
      
      // Initialize preview system
      await initializePreview({
        container: previewContainer,
        theme: params.get('theme') || 'light'
      });
      
      // Load the content from the API
      const response = await fetch(`/api/view/${viewSlug}`);
      if (!response.ok) {
        throw new Error(`Failed to load content: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      
      // Update the preview with the content
      await updatePreviewModule(content);
      
      logMessage('[PREVIEW] Content viewer initialized successfully');
      return true;
    } catch (error) {
      console.error('[PREVIEW ERROR]', error);
      logMessage(`[PREVIEW ERROR] Content viewer failed: ${error.message}`, 'error');
      return false;
    }
  }
  
  return false;
}

// Export the preview manager object for module use
export default {
  initializePreview,
  refreshPreview,
  schedulePreviewUpdate,
  setupContentViewer
}; 