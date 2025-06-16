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

import { logMessage, logDebug } from '../log/index.js';
import { api } from '/client/api.js';
import { initPlugins, getEnabledPlugins, processPlugins, applyCssStyles } from './plugins/index.js';
import { renderMarkdown, postProcessRender } from './renderer.js';
import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';

const LOG_ORIGIN = 'client/preview/index.js';

// Singleton instance to prevent multiple initializations
let previewInstance = null;

export function getPreviewInstance() {
    return previewInstance;
}

export class PreviewManager {
  constructor(options = {}) {
    if (previewInstance) {
      // If a container is provided and differs from the existing one, re-initialize
      if (options.container && previewInstance.config.container !== options.container) {
        console.log('[PreviewManager.init] New container provided. Re-initializing.');
        previewInstance.destroy();
        previewInstance = null;
      } else {
        return previewInstance;
      }
    }

    this.config = {
      container: null, // Container is now mandatory
      plugins: ['mermaid', 'katex', 'highlight', 'graphviz', 'css'],
      theme: 'light',
      updateDelay: 100,
      autoRender: true,
      renderMode: 'inline', // 'inline' or 'iframe'
      ...options
    };

    this.previewElement = null;
    this.initialized = false;
    this.updateTimer = null;
    this.eventBusListeners = [];
    this.previewCssId = 'preview-specific-styles'; // Add ID as property
    this.popupWindow = null; // For popup iframe functionality

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

      // --- Listen for layout changes ---
      if (eventBus && typeof eventBus.on === 'function') {
        eventBus.on('layout:stateChanged', this.handleLayoutStateChange.bind(this));
        this.eventBusListeners.push(
          { event: 'layout:stateChanged', listener: this.handleLayoutStateChange.bind(this) }
        );
      }

      // The container is now passed directly, no need to search for it.
      if (this.config.container instanceof HTMLElement) {
          this.previewElement = this.config.container;
      }

      if (!this.previewElement) {
        const errorMsg = 'Preview container is not a valid HTMLElement. Initialization failed.';
        logMessage(errorMsg, "error", "PREVIEW");
        console.error(`[PreviewManager.init] ${errorMsg}`);
        return false;
      }
      console.log('[PreviewManager.init] Container assigned:', this.previewElement);

      // Add class for styling
      try {
        this.previewElement.classList.add('markdown-preview');
      } catch (e) {
        console.error('[PreviewManager.init] Error adding class markdown-preview:', e, 'this.previewElement was:', this.previewElement);
      }

      // --- START DIAGNOSTIC EVENT LISTENERS FOR PREVIEW CONTAINER ---
      console.log('[PreviewManager.init] Just before diagnostic listener block. this.previewElement is:', this.previewElement);
      if (this.previewElement) {
        // DISABLED: Wheel event logging was causing excessive log entries
        // this.previewElement.addEventListener('wheel', (event) => {
        //   logDebug('Wheel event on previewElement', {
        //     type: 'PREVIEW_DIAGNOSTIC',
        //     subtype: 'WHEEL_EVENT',
        //     message: `Target: ${event.target.id || 'unnamed'}, Ctrl/Meta: ${event.ctrlKey || event.metaKey}`
        //   });
        // }, { capture: true });

        // DISABLED: Mousedown event logging was causing excessive log entries
        // this.previewElement.addEventListener('mousedown', (event) => {
        //   logDebug('Mousedown event on previewElement', {
        //     type: 'PREVIEW_DIAGNOSTIC',
        //     subtype: 'MOUSE_DOWN_EVENT',
        //     message: `Target: ${event.target.id || 'unnamed'}, Button: ${event.button}`
        //   });
        // }, { capture: true });

        // DISABLED: Click event logging was causing excessive log entries
        // this.previewElement.addEventListener('click', (event) => {
        //   logDebug('Click event on previewElement', {
        //     type: 'PREVIEW_DIAGNOSTIC',
        //     subtype: 'CLICK_EVENT',
        //     message: `Target: ${event.target.id || 'unnamed'}`
        //   });
        // }, { capture: true });
      } else {
        console.error('[PreviewManager.init] DIAGNOSTIC LISTENERS SKIPPED because this.previewElement is falsy here:', this.previewElement);
      }
      // --- END DIAGNOSTIC EVENT LISTENERS FOR PREVIEW CONTAINER ---

      // --- FIX: Determine plugins to init based on appState ---
      const currentPluginSettings = appStore.getState().plugins || {};
      console.log('[DEBUG PLUGINS] Current plugin settings:', currentPluginSettings);
      const pluginIdsToInit = Object.entries(currentPluginSettings)
                                 .filter(([id, config]) => {
                                   const enabled = config?.settings?.enabled || config?.enabled;
                                   console.log(`[DEBUG PLUGINS] Plugin ${id}: enabled = ${enabled}`, config);
                                   return enabled;
                                 })
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
    if (!this.initialized) {
      console.warn('[PreviewManager.update] Preview not initialized');
      return;
    }

    // Handle popup preview update
    if (this.config.renderMode === 'iframe' && this.popupWindow && !this.popupWindow.closed) {
      await this.updatePopupPreview(content, markdownFilePath);
      return;
    }

    // Clear any existing timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    return new Promise((resolve) => {
      this.updateTimer = setTimeout(async () => {
        try {
          logMessage(`[PreviewManager.update] Processing content (length: ${content.length})`, "debug", "PREVIEW");
          
          const renderResult = await renderMarkdown(content, markdownFilePath);
          
          if (!renderResult) {
            logMessage('Render result is null or undefined', "error", "PREVIEW");
            resolve();
            return;
          }

          // Handle different rendering modes
          if (this.config.renderMode === 'iframe') {
            // Render as complete HTML document in iframe
            const fullHtml = this.createCompleteHtmlDocument(renderResult);
            
            if (this.previewElement.tagName === 'IFRAME') {
              this.previewElement.srcdoc = fullHtml;
            } else {
              // Convert container to iframe
              this.previewElement.innerHTML = '';
              const iframe = document.createElement('iframe');
              iframe.style.width = '100%';
              iframe.style.height = '100%';
              iframe.style.border = 'none';
              iframe.srcdoc = fullHtml;
              this.previewElement.appendChild(iframe);
            }
          } else {
            // Standard inline rendering
            if (this.previewElement.tagName !== 'IFRAME') {
                logMessage(`[PreviewManager.update] Updating DIV preview content.`, "debug", "PREVIEW");
                
                const parser = new DOMParser();
                logMessage(`[PreviewManager.update] Parsing renderResult.fullPage (length: ${renderResult.fullPage.length}) with DOMParser...`, "debug", "PREVIEW");
                const parsedDoc = parser.parseFromString(renderResult.fullPage, 'text/html');
                logMessage(`[PreviewManager.update] DOMParser finished. Parsed head: ${parsedDoc.head.children.length} children, Parsed body: ${parsedDoc.body.children.length} children.`, "debug", "PREVIEW");

                logMessage(`[PreviewManager.update] Setting previewElement.innerHTML with renderResult.html (length: ${renderResult.html.length})...`, "debug", "PREVIEW");
                
                try {
                    console.log('[DEBUG] About to set innerHTML...');
                    this.previewElement.innerHTML = renderResult.html;
                    console.log('[DEBUG] innerHTML set successfully');
                    logMessage(`[PreviewManager.update] previewElement.innerHTML updated.`, "debug", "PREVIEW");
                    console.log('[DEBUG] innerHTML updated successfully');
                } catch (error) {
                    console.error('[DEBUG] Error setting innerHTML:', error);
                    logMessage(`[PreviewManager.update] Error setting innerHTML: ${error.message}`, "error", "PREVIEW");
                }

            } else {
                 logMessage(`[PreviewManager.update] Preview element is IFRAME. Using srcdoc.`, "warn", "PREVIEW"); 
                 this.previewElement.srcdoc = renderResult.fullPage;
                 console.log('[DEBUG] srcdoc updated successfully');
            }
          }
            
          console.log('[DEBUG] About to proceed to postProcessRender section');
          
          logMessage(`[PreviewManager.update] Calling postProcessRender...`, "debug", "PREVIEW");

          // Call postProcessRender to handle plugin processing (Mermaid, etc.)
          if (this.config.renderMode === 'inline' && this.previewElement) {
            try {
              // Import and call postProcessRender from MarkdownRenderer
              const { postProcessRender } = await import('/client/preview/renderers/MarkdownRenderer.js');
              await postProcessRender(
                this.previewElement, 
                renderResult.externalScriptUrls || [], 
                renderResult.inlineScriptContents || [], 
                markdownFilePath, 
                renderResult.frontMatter || {}
              );
              logMessage(`[PreviewManager.update] postProcessRender completed successfully`, "debug", "PREVIEW");
            } catch (postProcessError) {
              logMessage(`[PreviewManager.update] Error during postProcessRender: ${postProcessError.message}`, "error", "PREVIEW");
              console.error('[PreviewManager.update] postProcessRender error:', postProcessError);
            }
          } else {
            logMessage(`[PreviewManager.update] Skipping postProcessRender for iframe mode or missing preview element`, "debug", "PREVIEW");
          }

          resolve({ html: renderResult.html, frontMatter: renderResult.frontMatter });

        } catch (error) {
          logMessage(`[PreviewManager.update] Error during update process: ${error.message}`, "error", "PREVIEW");
          console.error('[PREVIEW UPDATE ERROR]', error);
          resolve({ html: '<p>Error during update.</p>', frontMatter: {} }); 
        }
      }, this.config.updateDelay);
    });
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

  /**
   * Handle layout state changes
   */
  handleLayoutStateChange(data) {
    const { editorType, previewType, contentMode } = data;
    console.log(`[PreviewManager] Layout state changed: editor=${editorType}, preview=${previewType}, content=${contentMode}`);
    
    // Update render mode
    this.config.renderMode = previewType === 'popup-iframe' ? 'iframe' : 'inline';
    
    // Handle popup preview
    if (previewType === 'popup-iframe') {
      this.openPopupPreview();
    } else {
      this.closePopupPreview();
    }
    
    // Handle preview visibility
    if (previewType === 'hidden') {
      // Preview is disabled - no need to update
      return;
    }
  }

  /**
   * Open popup preview window with iframe
   */
  openPopupPreview() {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.focus();
      return;
    }

    const popupFeatures = 'width=800,height=600,scrollbars=yes,resizable=yes,location=no,menubar=no,toolbar=no';
    this.popupWindow = window.open('', 'preview-popup', popupFeatures);
    
    if (!this.popupWindow) {
      console.error('[PreviewManager] Failed to open popup window - popup blocker?');
      return;
    }

    // Initialize popup content
    this.popupWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preview</title>
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            line-height: 1.6; 
            margin: 0; 
            padding: 20px;
            background: #fff;
          }
          iframe {
            width: 100%;
            height: calc(100vh - 40px);
            border: none;
            background: #fff;
          }
        </style>
      </head>
      <body>
        <iframe id="preview-iframe" srcdoc=""></iframe>
      </body>
      </html>
    `);
    this.popupWindow.document.close();

    // Update the popup with current content
    const editor = document.querySelector('#editor-container textarea');
    if (editor && editor.value) {
      this.updatePopupPreview(editor.value);
    }
  }

  /**
   * Close popup preview window
   */
  closePopupPreview() {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
    }
    this.popupWindow = null;
  }

  /**
   * Update popup preview with rendered content
   */
  async updatePopupPreview(content, markdownFilePath = '') {
    if (!this.popupWindow || this.popupWindow.closed) {
      return;
    }

    try {
      const renderResult = await renderMarkdown(content, markdownFilePath);
      
      // Create complete HTML document
      const fullHtml = this.createCompleteHtmlDocument(renderResult);
      
      const iframe = this.popupWindow.document.getElementById('preview-iframe');
      if (iframe) {
        iframe.srcdoc = fullHtml;
      }
    } catch (error) {
      console.error('[PreviewManager] Error updating popup preview:', error);
    }
  }

  /**
   * Create a complete HTML document for iframe rendering
   */
  createCompleteHtmlDocument(renderResult) {
    const { html, head = '', frontMatter = {} } = renderResult;
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <link rel="stylesheet" href="/client/styles/design-system.css">
  <link rel="stylesheet" href="/client/preview/preview.css">
  ${head}
</head>
<body>
  <div class="markdown-content">
    ${html}
  </div>
</body>
</html>`;
  }
}

/**
 * Initializes the preview system with a given container and options.
 * This is the main entry point for creating and setting up the preview.
 * @param {object} options - Configuration options, including a mandatory `container` HTMLElement.
 * @returns {Promise<PreviewManager|null>} The initialized PreviewManager instance or null on failure.
 */
export async function initPreview(options = {}) {
    if (!options.container || !(options.container instanceof HTMLElement)) {
        console.error('[initPreview] A valid container HTMLElement must be provided.');
        return null;
    }

    try {
        const manager = new PreviewManager(options);
        const success = await manager.init();
        if (success) {
            logMessage(`Preview initialized for container #${options.container.id}`, 'info', 'PREVIEW');
            return manager;
        }
        return null;
    } catch (error) {
        console.error(`[initPreview] Error initializing PreviewManager: ${error.message}`);
        return null;
    }
}

export function updatePreview(content, markdownFilePath) {
  if (!previewInstance) {
    console.error('[updatePreview] Preview not initialized. Call initPreview() first.');
    return;
  }
  previewInstance.update(content, markdownFilePath);
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