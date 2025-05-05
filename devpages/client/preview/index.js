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
import { processSvgContent } from './markdown-svg.js';
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

    previewInstance = this;
    return this;
  }

  async init() {
    console.log('[PreviewManager.init] Starting initialization...');
    try {
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

      // Log which plugins we're going to initialize
      logMessage(`Initializing plugins: ${this.config.plugins.join(', ')}`, "debug", "PREVIEW");
      console.log(`[PreviewManager.init] Calling initPlugins with:`, this.config.plugins);
      
      // Initialize components
      await initPlugins(this.config.plugins, {
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
    if (!this.initialized) {
      console.error('[PREVIEW] Preview not initialized. Call initPreview() first.');
      logMessage('Preview not initialized. Call initPreview() first.', "error", "PREVIEW");
      return false;
    }
    
    if (!this.previewElement) {
      console.error('[PREVIEW] Preview element not found');
      logMessage('Preview element not found', "error", "PREVIEW");
      return false;
    }
    
    try {
      logMessage(`[PREVIEW] update called. Path: ${markdownFilePath || 'N/A'}, Content length: ${content?.length}`, "debug", "PREVIEW");
      
      // Clear any pending updates
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }
      
      return new Promise((resolve) => {
        // Schedule the update to avoid too many updates in quick succession
        this.updateTimer = setTimeout(async () => {
          try {
            // Pass the path to renderMarkdown
            const fullHtml = await renderMarkdown(content, markdownFilePath); 
            logMessage(`renderMarkdown returned HTML length: ${fullHtml?.length}`, "debug", "PREVIEW");

            // --- Setting content via DOM manipulation (to execute scripts) --- 
            if (this.previewElement.tagName !== 'IFRAME') { // Ensure we are dealing with the DIV
                logMessage(`Updating preview DIV content via DOM manipulation.`, "debug", "PREVIEW");
                
                const parser = new DOMParser();
                const parsedDoc = parser.parseFromString(fullHtml, 'text/html');

                // --- Reconcile <link rel="stylesheet"> tags in main document <head> --- 
                const requiredCssHrefs = new Set();
                parsedDoc.head.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                    const href = link.getAttribute('href');
                    if (href) {
                        requiredCssHrefs.add(href);
                    }
                });
                logMessage(`Required CSS Hrefs: ${[...requiredCssHrefs].join(', ')}`, "debug", "PREVIEW");

                const injectedCssLinks = document.head.querySelectorAll('link[data-md-preview-css="true"]');
                const existingCssHrefs = new Set();
                injectedCssLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (!requiredCssHrefs.has(href)) {
                         logMessage(`Removing obsolete CSS link: ${href}`, "debug", "PREVIEW");
                        link.remove();
                    } else {
                        existingCssHrefs.add(href);
                    }
                });

                requiredCssHrefs.forEach(href => {
                    if (!existingCssHrefs.has(href)) {
                        logMessage(`Adding new CSS link: ${href}`, "debug", "PREVIEW");
                        const newLink = document.createElement('link');
                        newLink.setAttribute('rel', 'stylesheet');
                        newLink.setAttribute('href', href);
                        newLink.setAttribute('data-md-preview-css', 'true'); // Mark as injected
                        document.head.appendChild(newLink);
                    }
                });
                // --- End CSS Reconciliation ---

                // --- Reconcile <script> tags in main document <head> --- 
                const requiredScriptSrcs = new Map(); // Map src to { type, defer, async, etc. }
                parsedDoc.head.querySelectorAll('script[src]').forEach(scriptNode => {
                    const src = scriptNode.getAttribute('src');
                    if (src) {
                        const attributes = {};
                        for (const attr of scriptNode.attributes) {
                            if (attr.name !== 'src') { // Store other attributes
                                attributes[attr.name] = attr.value;
                            }
                        }
                        requiredScriptSrcs.set(src, attributes);
                    }
                });
                logMessage(`Required Script Srcs: ${[...requiredScriptSrcs.keys()].join(', ')}`, "debug", "PREVIEW");

                const injectedScripts = document.head.querySelectorAll('script[data-md-preview-js="true"]');
                const existingScriptSrcs = new Set();
                injectedScripts.forEach(script => {
                    const src = script.getAttribute('src');
                    if (!requiredScriptSrcs.has(src)) {
                        logMessage(`Removing obsolete script: ${src}`, "debug", "PREVIEW");
                        script.remove();
                    } else {
                        existingScriptSrcs.add(src);
                    }
                });

                requiredScriptSrcs.forEach((attributes, src) => {
                    if (!existingScriptSrcs.has(src)) {
                        logMessage(`Adding new script: ${src}`, "debug", "PREVIEW");
                        const newScript = document.createElement('script');
                        newScript.setAttribute('src', src);
                        // Apply other attributes (type, defer, etc.)
                        for (const attrName in attributes) {
                            newScript.setAttribute(attrName, attributes[attrName]);
                        }
                        newScript.setAttribute('data-md-preview-js', 'true'); // Mark as injected
                        document.head.appendChild(newScript);
                    }
                });
                // --- End Script Reconciliation ---

                // --- Process Body Content (only non-script nodes now) --- 
                this.previewElement.innerHTML = ''; // Clear existing content
                parsedDoc.body.childNodes.forEach(node => {
                    // Only append non-script nodes from the body
                    // Scripts from body (e.g., inline frontmatter script) might need different handling if required
                    if (node.nodeName !== 'SCRIPT') { 
                        this.previewElement.appendChild(node.cloneNode(true));
                    }
                });
            } else {
                 // This case should no longer happen with the ContentView reverted, but keep log for safety.
                 logMessage(`Preview element is unexpectedly an IFRAME. Cannot update content correctly.`, "error", "PREVIEW"); 
                 // Maybe set srcdoc as a fallback? Or throw error? 
                 // this.previewElement.srcdoc = fullHtml;
            }
            logMessage('Preview content updated successfully via DOM manipulation', "debug", "PREVIEW");
            
            // Post-processing for things like Mermaid/Katex might still be needed after content is added
            await postProcessRender(this.previewElement);

            resolve(true);
          } catch (error) {
            logMessage(`Error during delayed preview update: ${error.message}`, "error", "PREVIEW");
            console.error("[PREVIEW TIMEOUT ERROR]", error);
            resolve(false);
          }
        }, this.config.updateDelay);
      });
    } catch (error) {
      logMessage(`Error in updatePreview (scheduling phase): ${error.message}`, "error", "PREVIEW");
      console.error("[PREVIEW SCHEDULING ERROR]", error);
      return Promise.resolve(false); // Indicate failure
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
 * Export additional components
 */
export { renderMarkdown } from './renderer.js';
export { registerPlugin } from './plugins/index.js'; 