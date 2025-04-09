/**
 * preview.js
 * Handles Markdown preview rendering and updates
 */
import { eventBus } from '/client/eventBus.js';

// Import from the underlying preview module in client/preview/
import { initPreview as initPreviewModule, updatePreview as updatePreviewModule } from '/client/preview/index.js';
import { MermaidPlugin } from '/client/preview/plugins/mermaid.js';

// Helper for logging within this module
function logPreview(message, level = 'text') {
    const prefix = '[PREVIEW]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

// Track initialization state
let previewInitialized = false;
let updateTimer = null;
const mermaidPlugin = new MermaidPlugin();
const PREVIEW_CSS_ID = 'preview-specific-styles'; // ID to prevent multiple additions

/**
 * Initialize the preview system with all required plugins
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} Success status
 */
export async function initializePreview(options = {}) {
  if (previewInitialized) {
    logPreview('Preview already initialized, skipping');
    return true;
  }
  
  logPreview('Initializing preview system');
  
  // --- Dynamically add preview-specific CSS --- 
  if (!document.getElementById(PREVIEW_CSS_ID)) {
      const link = document.createElement('link');
      link.id = PREVIEW_CSS_ID;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = '/client/preview/preview.css'; // Path to the preview CSS
      document.head.appendChild(link);
      logPreview('Dynamically added preview.css link tag.');
  } else {
      logPreview('Preview CSS link tag already exists.');
  }
  // --- End CSS addition ---
  
  try {
    // Default options
    const defaultOptions = {
      container: '#preview-container',
      plugins: ['highlight', 'mermaid', 'katex', 'audio-md', 'github-md'], // Add other plugins as needed
      theme: 'light',
      updateDelay: 300
    };
    
    // Merge with user options
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Initialize with all available plugins
    const result = await initPreviewModule(mergedOptions);
    
    if (result) {
      previewInitialized = true;
      logPreview('Preview system initialized successfully');
      
      // Initialize Mermaid Plugin
      await mermaidPlugin.init();
      logPreview('Mermaid plugin initialized.');
      
      // Connect to editor input events via the event bus
      subscribeToEditorEvents();
      
      // Connect to view changes
      subscribeToViewChanges();
      
      // Make global function available for backward compatibility (Consider removing)
      window.updateMarkdownPreview = refreshPreview;
      
      // Emit initialization event
      eventBus.emit('preview:initialized');
      
      return true;
    } else {
      logPreview('Failed to initialize preview system', 'error');
      return false;
    }
  } catch (error) {
    console.error('[PREVIEW ERROR]', error);
    logPreview(`Initialization failed: ${error.message}`, 'error');
    
    // Try fallback initialization
    return initializeFallbackPreview();
  }
}

/**
 * Fallback initialization for when the main preview system fails
 * @returns {Promise<boolean>} Success status
 */
async function initializeFallbackPreview() {
  logPreview('Attempting fallback initialization');
  
  try {
    // Find required elements
    const previewContainer = document.getElementById('preview-container');
    if (!previewContainer) {
      logPreview('Preview container not found', 'error');
      return false;
    }
    
    // Try to load renderer directly
    const { renderMarkdown } = await import('/client/preview/renderer.js'); // Corrected: ./preview/
    
    if (typeof renderMarkdown !== 'function') {
      logPreview('Markdown renderer not found', 'error');
      return false;
    }
    
    // Initialize Mermaid Plugin for Fallback
    await mermaidPlugin.init();
    logPreview('Mermaid plugin initialized for fallback.');
    
    // Create a custom update function
    window.updateMarkdownPreview = async function() {
      const editor = document.querySelector('#editor-container textarea');
      const content = editor?.value || '';
      
      logPreview('Updating preview with direct renderer');
      
      try {
        const html = await renderMarkdown(content);
        previewContainer.innerHTML = html;
        
        // Process Mermaid for Fallback
        mermaidPlugin.process(previewContainer);
        
        logPreview('Preview updated via fallback method');
        return true;
      } catch (error) {
        logPreview(`Fallback update failed: ${error.message}`, 'error');
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
    logPreview('Fallback preview system initialized');
    
    // Emit initialization event
    eventBus.emit('preview:initialized');
    
    return true;
  } catch (error) {
    console.error('[PREVIEW ERROR]', error);
    logPreview(`Fallback initialization failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Update the preview with current editor content
 * @returns {Promise<boolean>} Success status
 */
export async function refreshPreview() {
  console.log('[DEBUG preview.js] refreshPreview called');
  if (!previewInitialized) {
    const initialized = await initializePreview();
    if (!initialized) {
      logPreview('Could not initialize preview system for refresh', 'error');
      return false;
    }
  }
  
  const editor = document.querySelector('#editor-container textarea');
  if (!editor) {
    logPreview('[PREVIEW WARNING] Editor element not found', 'warning');
    console.warn('[DEBUG preview.js] Editor textarea not found in refreshPreview.');
    return false;
  }
  
  const content = editor.value || '';
  console.log(`[DEBUG preview.js] Content length for refresh: ${content.length}`);
  
  logPreview(`Refreshing preview (content length: ${content.length})`);
  
  try {
    console.log('[DEBUG preview.js] Calling updatePreviewModule...');
    // Use the imported update function from the preview module
    const result = await updatePreviewModule(content);
    console.log(`[DEBUG preview.js] updatePreviewModule returned: ${result}`);
    if (result) {
      logPreview('Preview refreshed successfully');
      
      // Process Mermaid diagrams using the plugin
      setTimeout(() => {
        const previewElement = document.querySelector('#preview-container');
        if (previewElement) {
          mermaidPlugin.process(previewElement);
          logPreview('Mermaid diagrams processed by plugin (deferred).');
        } else {
          logPreview('Preview container not found for deferred Mermaid processing.', 'warning');
        }
      }, 0); // Use setTimeout with 0 delay to yield to the event loop
      
      // Emit update event
      eventBus.emit('preview:updated', { content });
      
      return true;
    } else {
      logPreview('[PREVIEW WARNING] Preview update returned false', 'warning');
      return false;
    }
  } catch (error) {
    logPreview(`Preview refresh failed: ${error.message}`, 'error');
    console.error('Preview refresh error:', error);
    return false;
  }
}

/**
 * Debounced preview update
 * @returns {void}
 */
export function schedulePreviewUpdate() {
  console.log('[DEBUG preview.js] schedulePreviewUpdate called');
  if (updateTimer) {
    clearTimeout(updateTimer);
  }
  updateTimer = setTimeout(() => {
    console.log('[DEBUG preview.js] Debounced timeout executing refreshPreview');
    refreshPreview();
    updateTimer = null;
  }, 300); // 300ms debounce
}

/**
 * Subscribe to editor events via the event bus
 * @returns {void}
 */
function subscribeToEditorEvents() {
  if (!eventBus) {
    logPreview('EventBus not available for editor subscription', 'error');
    return;
  }
  eventBus.on('editor:contentChanged', (eventData) => {
    const contentLength = eventData?.content?.length ?? 'unknown';
    console.log(`[DEBUG preview.js] Received editor:contentChanged event. Content length: ${contentLength}. Scheduling update.`);
    schedulePreviewUpdate();
  });
  
  // Direct connection for backward compatibility (Consider removing)
  const editor = document.querySelector('#editor-container textarea');
  if (editor) {
    editor.addEventListener('input', schedulePreviewUpdate);
    logPreview('Subscribed to editor input events');
  }
  
  // Connect refresh button (Consider moving to button module)
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshPreview);
    logPreview('Subscribed to refresh button');
  }
}

/**
 * Subscribe to view change events
 * @returns {void}
 */
function subscribeToViewChanges() {
  if (!eventBus) {
    logPreview('EventBus not available for view change subscription', 'error');
    return;
  }
  // Listen to the event emitted by ContentViewComponent / actions.js
  eventBus.on('ui:viewModeChanged', (newMode) => {
    console.log(`[DEBUG preview.js] Received ui:viewModeChanged event. New mode: ${newMode}`);
    logPreview(`View changed to ${newMode}, triggering preview update if needed.`);
    if (newMode === 'preview' || newMode === 'split') {
      console.log(`[DEBUG preview.js] View is preview or split. Calling refreshPreview.`);
      // Use setTimeout to ensure layout changes are potentially flushed before render
      setTimeout(refreshPreview, 0);
    }
  });
  
  logPreview('Subscribed to ui:viewModeChanged events for preview refresh.');
}

/**
 * Set up content viewer for direct view URLs
 * @returns {Promise<boolean>} Success status
 */
export async function setupContentViewer() {
  logPreview('Setting up content viewer...');

  if (window.location.pathname.startsWith('/view/')) {
    logPreview('Detected /view/ path, initializing read-only preview.');
    const contentPath = window.location.pathname.substring(6); // Remove '/view/'
    if (!contentPath) {
      logPreview('No content path specified after /view/', 'error');
      document.body.innerHTML = '<p style="color:red;">Error: No file path specified.</p>';
      return;
    }

    try {
      const response = await fetch(`/api/view/${contentPath}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
      }
      const markdownContent = await response.text();
      logPreview(`Fetched content for ${contentPath}, length: ${markdownContent.length}`);

      // Prepare the DOM - hide editor, show only preview
      document.body.innerHTML = '<div id="preview-container">Loading preview...</div>'; // Simple container
      const previewElement = document.getElementById('preview-container');
      if (!previewElement) throw new Error('Preview container creation failed');

      // Render the content
      const { renderMarkdown } = await import('/client/preview/renderer.js');
      const html = await renderMarkdown(markdownContent);
      previewElement.innerHTML = html;
      logPreview('Content rendered in read-only mode.');

      // Initialize and Process Mermaid for read-only view
      await mermaidPlugin.init();
      mermaidPlugin.process(previewElement);
      logPreview('Mermaid initialized and processed for read-only view.');

    } catch (error) {
      logPreview(`Error setting up content viewer: ${error.message}`, 'error');
      console.error(error);
      document.body.innerHTML = `<p style="color:red;">Error loading content: ${error.message}</p>`;
    }
  }
}

// Export the preview manager object for module use
export default {
  initializePreview,
  refreshPreview,
  schedulePreviewUpdate,
  setupContentViewer,
  initializeFallbackPreview
}; 