/**
 * Preview System Entry Point
 * 
 * Provides a unified API for rendering Markdown with enhanced features:
 * - Markdown rendering
 * - Mermaid diagrams
 * - Math expressions using KaTeX
 * - Audio/video timestamp plugin support
 * - Code syntax highlighting
 * 
 * Usage:
 *   import { initPreview, updatePreview } from './preview/index.js';
 * 
 *   // Initialize once
 *   initPreview({
 *     container: '#md-preview',
 *     plugins: ['mermaid', 'katex', 'audioMD', 'highlight'],
 *     theme: 'light'
 *   });
 * 
 *   // Update the preview
 *   updatePreview(markdownContent);
 */

import { logMessage } from '../log/index.js';
import { api } from '/client/api.js';
import { initPlugins, getEnabledPlugins, processPlugins, applyCssStyles } from './plugins/index.js';
import { renderMarkdown, postProcessRender } from './renderer.js';
import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';

// Singleton instance to prevent multiple initializations
let previewInstance = null;

export function getPreviewInstance() {
    return previewInstance;
}

export class PreviewManager {
  constructor(options = {}) {
    if (previewInstance) {
      return previewInstance;
    }

    this.config = {
      container: '#md-preview',
      plugins: ['mermaid', 'katex', 'highlight', 'graphviz', 'css'],
      theme: 'light',
      updateDelay: 100,
      autoRender: true,
      ...options
    };

    this.previewElement = null;
    this.initialized = false;
    this.updateTimer = null;
    this.eventBusListeners = [];
    this.previewCssId = 'preview-specific-styles'; // Add ID as property

    previewInstance = this;
    return this;
  }

  async init() {
    console.log('[PreviewManager.init] Starting initialization...');
    try {
      // --- Add dynamic CSS link loading here --- 
      if (!document.getElementById(this.previewCssId)) {
          const link = document.createElement('link');
          link.id = this.previewCssId;
          link.rel = 'stylesheet';
          link.type = 'text/css';
          link.href = '/client/preview/preview.css'; // Path to the preview CSS
          document.head.appendChild(link);
          logMessage('Dynamically added preview.css link tag.', 'debug', 'PREVIEW');
      } else {
          logMessage('Preview CSS link tag already exists.', 'debug', 'PREVIEW');
      }
      // --- End dynamic CSS link loading ---
      // --- MODIFIED: Retry finding container --- 
      const containerSelector = (typeof this.config.container === 'string') ? this.config.container : null;
      let attempt = 0;
      const maxAttempts = 10; // Retry 10 times (1 second total)
      const retryDelay = 100; // 100ms delay

      while (!this.previewElement && attempt < maxAttempts) {
        attempt++;
        console.log(`[PreviewManager.init] Attempt ${attempt}/${maxAttempts} to find container: ${containerSelector || 'HTMLElement'}`);
        if (containerSelector) {
          this.previewElement = document.querySelector(containerSelector);
        } else if (this.config.container instanceof HTMLElement) {
          // If passed directly, check if it's still in the DOM (simple check)
          this.previewElement = document.body.contains(this.config.container) ? this.config.container : null;
        }

        if (!this.previewElement && attempt < maxAttempts) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      // --- END MODIFIED --- 

      if (!this.previewElement) {
        logMessage('Preview container not found after multiple attempts', "error", "PREVIEW"); // Updated log
        console.error('[PreviewManager.init] Container element not found after multiple attempts. Initialization failed.');
        return false;
      }
      console.log('[PreviewManager.init] Container found:', this.previewElement);

      // Add class for styling
      this.previewElement.classList.add('markdown-preview');

      // --- START DIAGNOSTIC EVENT LISTENERS FOR PREVIEW CONTAINER ---
      if (this.previewElement) {
        this.previewElement.addEventListener('wheel', (event) => {
          console.log('[PREVIEW CONTAINER DIAG] Wheel event on previewElement. Target:', event.target, 'Ctrl/Meta:', event.ctrlKey || event.metaKey);
        }, { capture: true }); // Use capture to see it early

        this.previewElement.addEventListener('mousedown', (event) => {
          console.log('[PREVIEW CONTAINER DIAG] Mousedown event on previewElement. Target:', event.target, 'Button:', event.button);
        }, { capture: true }); // Use capture to see it early

        this.previewElement.addEventListener('click', (event) => {
          console.log('[PREVIEW CONTAINER DIAG] Click event on previewElement. Target:', event.target);
        }, { capture: true }); // Use capture to see it early
        console.log('[PreviewManager.init] ADDED DIAGNOSTIC event listeners to previewElement.');
      }
      // --- END DIAGNOSTIC EVENT LISTENERS FOR PREVIEW CONTAINER ---

      // --- FIX: Determine plugins to init based on appState ---
      const currentPluginSettings = appStore.getState().plugins || {};
      const pluginIdsToInit = Object.entries(currentPluginSettings)
                                 .filter(([id, config]) => config.enabled) // Only where enabled: true
                                 .map(([id, config]) => id);
      
      logMessage(`Initializing ENABLED plugins based on state: ${pluginIdsToInit.join(', ') || 'None'}`, "info", "PREVIEW");
      console.log(`[PreviewManager.init] Calling initPlugins with state-derived list:`, pluginIdsToInit);
      // --- END FIX ---

      // Initialize components using the filtered list
      // Pass pluginIdsToInit instead of this.config.plugins
      await initPlugins(pluginIdsToInit, { 
        theme: this.config.theme,
        container: this.previewElement
      });
      console.log('[PreviewManager.init] initPlugins call completed.');

      // --- Subscribe to CSS Settings Changes ---
      const cssSettingsListener = async () => {
          if (!this.initialized) return; // Don't run if not ready
          logMessage('Received preview:cssSettingsChanged event, re-applying styles.', 'debug', 'PREVIEW');
          try { await applyCssStyles(); } // Directly call applyStyles
          catch(error) { logMessage(`Error applying styles after settings change: ${error.message}`, 'error', 'PREVIEW'); }
      };
      // Ensure eventBus exists before subscribing
      if (eventBus && typeof eventBus.on === 'function') {
          eventBus.on('preview:cssSettingsChanged', cssSettingsListener);
          this.eventBusListeners.push({ event: 'preview:cssSettingsChanged', listener: cssSettingsListener });
          logMessage('Subscribed PreviewManager to preview:cssSettingsChanged event.', 'debug', 'PREVIEW');
          console.log('[PreviewManager.init] CSS Settings listener setup complete.');
      } else {
          console.error('[PreviewManager] eventBus not available for subscribing to preview:cssSettingsChanged');
      }
      // ------------------------------------------

      console.log(`[PreviewManager.init] Applying theme: ${this.config.theme}`);
      this.applyTheme(this.config.theme);
      this.initialized = true;

      // --- Apply initial styles after init ---
      try {
        logMessage('Applying initial CSS styles...', 'debug', 'PREVIEW');
        console.log('[PreviewManager.init] Applying initial CSS styles...');
        await applyCssStyles(); // Apply styles once on initialization
        console.log('[PreviewManager.init] Initial CSS styles applied.');
      } catch (styleError) {
          logMessage(`Error applying initial styles: ${styleError.message}`, 'error', 'PREVIEW');
          console.error('[PreviewManager.init] Error applying initial CSS styles:', styleError);
          // Decide if this error should cause init to fail
          // return false; 
      }
      // ---------------------------------------

      logMessage('Preview system initialized successfully', "debug", "PREVIEW");
      console.log('[PreviewManager.init] Initialization successful, returning true.');
      return true;
    } catch (error) {
      logMessage(`Failed to initialize preview: ${error.message}`, "error", "PREVIEW");
      console.error('[PREVIEW INIT ERROR] Error during PreviewManager.init:', error);
      console.log('[PreviewManager.init] Initialization failed due to error, returning false.');
      return false;
    }
  }

  async update(content, markdownFilePath) {
    logMessage(`[PreviewManager.update] Called. Path: '${markdownFilePath || 'N/A'}'. Content length: ${content?.length || 0}. Initialized: ${this.initialized}`, "info", "PREVIEW");

    if (!this.initialized || !this.previewElement) {
      logMessage(`[PreviewManager.update] Not initialized or no previewElement. Aborting. Initialized: ${this.initialized}, PreviewElement: ${!!this.previewElement}`, "error", "PREVIEW");
      return Promise.resolve(this.initialized ? { html: '<p>Error: Preview element not found.</p>', frontMatter: {} } : false);
    }
    
    try {
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
        logMessage(`[PreviewManager.update] Cleared pending update timer.`, "debug", "PREVIEW");
      }
      
      return new Promise((resolve) => {
        this.updateTimer = setTimeout(async () => {
          logMessage(`[PreviewManager.update] setTimeout callback executing.`, "debug", "PREVIEW");
          try {
            logMessage(`[PreviewManager.update] Calling renderMarkdown...`, "debug", "PREVIEW");
            const renderResult = await renderMarkdown(content, markdownFilePath);
            
            logMessage(`[PreviewManager.update] renderMarkdown returned. Result keys: ${Object.keys(renderResult || {}).join(', ')}. External Scripts: ${renderResult?.externalScriptUrls?.length || 0}. Inline Scripts: ${renderResult?.inlineScriptContents?.length || 0}.`, "debug", "PREVIEW");

            if (!renderResult || typeof renderResult.fullPage !== 'string' || typeof renderResult.html !== 'string' || typeof renderResult.frontMatter === 'undefined' || !Array.isArray(renderResult.externalScriptUrls) || !Array.isArray(renderResult.inlineScriptContents) ) {
                logMessage('[PreviewManager.update] renderMarkdown returned invalid result structure. Aborting update.', 'error', 'PREVIEW');
                resolve({ html: '<p>Error rendering content.</p>', frontMatter: renderResult?.frontMatter || {} });
                return;
            }

            if (this.previewElement.tagName !== 'IFRAME') {
                logMessage(`[PreviewManager.update] Updating DIV preview content.`, "debug", "PREVIEW");
                
                const parser = new DOMParser();
                logMessage(`[PreviewManager.update] Parsing renderResult.fullPage (length: ${renderResult.fullPage.length}) with DOMParser...`, "debug", "PREVIEW");
                const parsedDoc = parser.parseFromString(renderResult.fullPage, 'text/html');
                logMessage(`[PreviewManager.update] DOMParser finished. Parsed head: ${parsedDoc.head.children.length} children, Parsed body: ${parsedDoc.body.children.length} children.`, "debug", "PREVIEW");

                // TODO: Reconcile head content (styles, meta) from parsedDoc.head if needed.
                // For now, we focus on body and scripts.
                // The 'headContent' from renderResult can be used for dynamic CSS links if not handled by CssPlugin

                logMessage(`[PreviewManager.update] Setting previewElement.innerHTML with renderResult.html (length: ${renderResult.html.length})...`, "debug", "PREVIEW");
                this.previewElement.innerHTML = renderResult.html; // Set the sanitized body HTML
                logMessage(`[PreviewManager.update] previewElement.innerHTML updated.`, "debug", "PREVIEW");

            } else {
                 logMessage(`[PreviewManager.update] Preview element is IFRAME. This path should ideally not be taken. Using srcdoc.`, "warn", "PREVIEW"); 
                 // If using srcdoc, the script bundling needs to happen *within* the iframe,
                 // or the bundled script needs to be part of the srcdoc string.
                 // For simplicity, the current bundling approach assumes direct DOM manipulation.
                 // If iframe is essential, postProcessRender would need to target iframe.contentDocument.
                 this.previewElement.srcdoc = renderResult.fullPage; // This will execute scripts within the fullPage
            }
            
            logMessage(`[PreviewManager.update] Calling postProcessRender...`, "debug", "PREVIEW");
            // MODIFIED: Pass script arrays AND markdownFilePath to postProcessRender
            await postProcessRender(this.previewElement, renderResult.externalScriptUrls, renderResult.inlineScriptContents, markdownFilePath);
            logMessage(`[PreviewManager.update] postProcessRender finished.`, "debug", "PREVIEW");
            
            resolve({ html: renderResult.html, frontMatter: renderResult.frontMatter });

          } catch (error) {
            logMessage(`[PreviewManager.update] Error during update process: ${error.message}`, "error", "PREVIEW");
            console.error('[PREVIEW UPDATE ERROR]', error);
            resolve({ html: '<p>Error during update.</p>', frontMatter: {} }); 
          }
        }, this.config.updateDelay);
      });
    } catch (e) {
      // This catch is for synchronous errors before the Promise/setTimeout
      logMessage(`[PreviewManager.update] Synchronous error setting up update: ${e.message}`, "error", "PREVIEW");
      console.error('[PREVIEW SETUP UPDATE ERROR]', e);
      return Promise.resolve({ html: '<p>Error setting up update.</p>', frontMatter: {} });
    }
  }

  applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.style.setProperty('--md-preview-bg', '#1e1e1e');
      root.style.setProperty('--md-preview-color', '#e0e0e0');
      root.style.setProperty('--md-preview-code-bg', '#2d2d2d');
      root.style.setProperty('--md-preview-border', '#444');
      root.style.setProperty('--md-preview-blockquote', '#444');
      root.style.setProperty('--md-preview-link', '#6bf');
    } else {
      root.style.setProperty('--md-preview-bg', '#ffffff');
      root.style.setProperty('--md-preview-color', '#333333');
      root.style.setProperty('--md-preview-code-bg', '#f5f5f5');
      root.style.setProperty('--md-preview-border', '#ddd');
      root.style.setProperty('--md-preview-blockquote', '#eee');
      root.style.setProperty('--md-preview-link', '#07c');
    }
  }

  setTheme(theme) {
    this.config.theme = theme;
    this.applyTheme(theme);
    
    // Update plugins with new theme
    const enabledPlugins = getEnabledPlugins();
    for (const plugin of enabledPlugins) {
      if (plugin.setTheme) {
        plugin.setTheme(theme);
      }
    }
    
    logMessage(`Theme set to ${theme}`, "info", "PREVIEW");
    return true;
  }

  getConfig() {
    return { ...this.config };
  }

  handleFrontMatter(data = {}) {
    logMessage(`Handling front matter data: ${Object.keys(data).join(', ')}`, "debug", "PREVIEW");

    // Define IDs within method scope or make them class properties if needed elsewhere
    const FRONT_MATTER_STYLE_ID = 'front-matter-styles';
    const FRONT_MATTER_SCRIPT_ID = 'front-matter-script';

    // Remove previous elements first
    document.getElementById(FRONT_MATTER_STYLE_ID)?.remove();
    document.getElementById(FRONT_MATTER_SCRIPT_ID)?.remove();

    // 1. Handle CSS
    if (data.css) {
        try {
            const styleEl = document.createElement('style');
            styleEl.id = FRONT_MATTER_STYLE_ID;
            styleEl.textContent = data.css; 
            document.head.appendChild(styleEl);
            logMessage('Applied front matter CSS.', "debug", "PREVIEW");
        } catch (e) {
            logMessage(`Error applying front matter CSS: ${e.message}`, 'error', "PREVIEW");
        }
    }

    // 2. Handle Head (Ignored)
    if (data.head) {
        logMessage("Front matter 'head' key found, but currently ignored.", 'warning', "PREVIEW");
    }

    // 3. Handle Script
    if (data.script) {
        logMessage('Attempting to handle front matter script...', "debug", "PREVIEW");
        try {
            logMessage('Creating script element...', "debug", "PREVIEW");
            const scriptEl = document.createElement('script');
            scriptEl.id = FRONT_MATTER_SCRIPT_ID;
            logMessage('Setting script text content...', "debug", "PREVIEW");
            scriptEl.textContent = data.script;
            logMessage('Appending script element to body...', "debug", "PREVIEW");
            document.body.appendChild(scriptEl);
            logMessage('Successfully applied front matter script.', "debug", "PREVIEW");
        } catch (e) {
            logMessage(`Error applying front matter script: ${e.message}`, 'error', "PREVIEW");
            console.error("Error details during front matter script handling:", e);
        }
    } else {
        logMessage('No script found in front matter data.', "debug", "PREVIEW");
    }

    logMessage('Front matter handling complete.', "debug", "PREVIEW");
  }

  destroy() {
      logMessage('Destroying PreviewManager instance...', 'debug', 'PREVIEW');
      // --- Unsubscribe from Event Bus ---
      if (eventBus && typeof eventBus.off === 'function') {
        this.eventBusListeners.forEach(({ event, listener }) => {
            eventBus.off(event, listener);
            logMessage(`Unsubscribed from event: ${event}`, 'debug', 'PREVIEW');
        });
      }
      this.eventBusListeners = [];
      // ---------------------------------
      if (this.updateTimer) { clearTimeout(this.updateTimer); }
      this.previewElement = null; this.initialized = false; previewInstance = null;
  }
}

// Export these functions for external use
export function initPreview(options = {}) {
  // Ensure 'css' is included in default plugins if desired
  const defaultOptions = {
    plugins: ['mermaid', 'katex', 'highlight', 'graphviz', 'css'], // Added 'css'
    container: '#md-preview',
    theme: 'light',
    updateDelay: 100,
    autoRender: true,
  };
  const finalOptions = { ...defaultOptions, ...options };
  const manager = new PreviewManager(finalOptions);
  return manager.init();
}

export function updatePreview(content, markdownFilePath) {
  if (!previewInstance || !previewInstance.initialized) {
    console.error('[PREVIEW] Preview not initialized. Call initPreview() first.');
    logMessage('Attempted to update non-initialized preview', 'error', 'PREVIEW');
    return Promise.reject('Preview not initialized');
  }
  // Pass the path to the instance method
  return previewInstance.update(content, markdownFilePath);
}

export function setPreviewTheme(theme) {
  const manager = new PreviewManager();
  return manager.setTheme(theme);
}

/**
 * Reset all plugin settings to defaults (all enabled)
 * Use this for troubleshooting or if settings get corrupted
 */
export function resetPluginSettings() {
  try {
    // Clear the plugin state from localStorage
    localStorage.removeItem('pluginsEnabledState');
    console.log('[PREVIEW] Plugin settings reset to defaults (all enabled)');
    
    // Force reload of the page to apply changes
    window.location.reload();
    return true;
  } catch (error) {
    console.error('[PREVIEW] Failed to reset plugin settings:', error);
    return false;
  }
}

/**
 * Export additional components
 */
export { renderMarkdown } from './renderer.js';
export { registerPlugin } from './plugins/index.js'; 