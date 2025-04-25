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
import { initPlugins, getEnabledPlugins, processPlugins } from './plugins/index.js';
import { renderMarkdown, postProcessRender } from './renderer.js';
import { processSvgContent } from './markdown-svg.js';
import { eventBus } from '/client/eventBus.js';

// Singleton instance to prevent multiple initializations
let previewInstance = null;

export class PreviewManager {
  constructor(options = {}) {
    if (previewInstance) {
      return previewInstance;
    }

    this.config = {
      container: '#md-preview',
      plugins: ['mermaid', 'katex', 'highlight', 'graphviz'],
      theme: 'light',
      updateDelay: 100,
      autoRender: true,
      ...options
    };

    this.previewElement = null;
    this.initialized = false;
    this.updateTimer = null;

    previewInstance = this;
    return this;
  }

  async init() {
    try {
      // Get container element
      if (typeof this.config.container === 'string') {
        this.previewElement = document.querySelector(this.config.container);
      } else if (this.config.container instanceof HTMLElement) {
        this.previewElement = this.config.container;
      }

      if (!this.previewElement) {
        logMessage('Preview container not found', "error", "PREVIEW");
        return false;
      }

      // Add class for styling
      this.previewElement.classList.add('markdown-preview');

      // Log which plugins we're going to initialize
      logMessage(`Initializing plugins: ${this.config.plugins.join(', ')}`, "debug", "PREVIEW");
      
      // Initialize components
      await initPlugins(this.config.plugins, {
        theme: this.config.theme,
        container: this.previewElement
      });

      // --- Assign previewEventBus early ---
      if (typeof window.previewEventBus === 'undefined') {
         if (eventBus) {
             window.previewEventBus = eventBus;
             logMessage('Assigned window.previewEventBus during PreviewManager init.', "debug", "PREVIEW");
         } else {
             logMessage('Main eventBus instance not available during PreviewManager init.', 'error', "PREVIEW");
         }
       }
      // --- End Assignment ---

      this.applyTheme(this.config.theme);
      this.initialized = true;
      logMessage('Preview system initialized successfully', "debug", "PREVIEW");
      return true;
    } catch (error) {
      logMessage(`Failed to initialize preview: ${error.message}`, "error", "PREVIEW");
      console.error('[PREVIEW ERROR]', error);
      return false;
    }
  }

  async update(content) {
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
      // logMessage('[PREVIEW] updatePreview called with content length:', "debug", "PREVIEW", { length: content?.length });
      logMessage(`[PREVIEW] updatePreview called with content length: ${content?.length}`, "debug", "PREVIEW");
      
      // Clear any pending updates
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }
      
      return new Promise((resolve) => {
        // Schedule the update to avoid too many updates in quick succession
        this.updateTimer = setTimeout(async () => {
          try {
            // logMessage('Calling renderMarkdown'); // Commented out temporarily
            const renderResult = await renderMarkdown(content);
            logMessage(`renderMarkdown returned. HTML length: ${renderResult.html?.length}, FrontMatter keys: ${Object.keys(renderResult.frontMatter).join(', ')}`, "debug", "PREVIEW");

            // --- Revised Script Handling --- 
            let processedHtml = renderResult.html;
            const scriptsToExecute = [];

            try {
                 logMessage('Parsing rendered HTML for script tags before insertion...', "debug", "PREVIEW");
                 // Use a temporary div to parse the HTML string
                 const tempDiv = document.createElement('div');
                 tempDiv.innerHTML = renderResult.html;
                 const scriptsInHtml = tempDiv.querySelectorAll('script');
                 
                 logMessage(`Found ${scriptsInHtml.length} script tag(s) in parsed HTML.`, "debug", "PREVIEW");

                 scriptsInHtml.forEach(scriptTag => {
                     const src = scriptTag.getAttribute('src');
                     const defer = scriptTag.hasAttribute('defer');
                     const async = scriptTag.hasAttribute('async');
                     const type = scriptTag.getAttribute('type');
                     const content = scriptTag.textContent;
                     
                     if (src || content) { // Only process scripts with src or inline content
                         scriptsToExecute.push({ src, defer, async, type, content });
                         logMessage(`Extracted script: src=${src}, defer=${defer}, async=${async}, type=${type}, hasContent=${!!content}`, "debug", "PREVIEW");
                         // Remove the script tag from the temporary div
                         scriptTag.remove();
                     }
                 });
                 
                 // Get the HTML string *without* the script tags
                 processedHtml = tempDiv.innerHTML;
                 logMessage('Removed script tags from HTML string for innerHTML insertion.', "debug", "PREVIEW");
            } catch (parseError) {
                 logMessage(`Error parsing HTML for scripts: ${parseError.message}. Using original HTML.`, 'error', "PREVIEW");
                 console.error('[PREVIEW SCRIPT PARSE ERROR]', parseError);
                 processedHtml = renderResult.html; // Fallback to original HTML
            }
            // --- End Revised Script Handling ---
            
            logMessage(`Setting innerHTML on previewElement (scripts removed).`, "debug", "PREVIEW");
            if (this.previewElement) {
                this.previewElement.innerHTML = processedHtml; // Use the processed HTML
                logMessage('innerHTML set successfully', "debug", "PREVIEW");
                
                // --- Execute Extracted Scripts Manually --- 
                try {
                    logMessage(`Manually creating and appending ${scriptsToExecute.length} extracted script(s)...`, "debug", "PREVIEW");
                    scriptsToExecute.forEach(scriptInfo => {
                        const newScript = document.createElement('script');
                        if (scriptInfo.src) {
                            newScript.src = scriptInfo.src;
                        }
                        if (scriptInfo.type) {
                            newScript.type = scriptInfo.type;
                        }
                        if (scriptInfo.defer) {
                            newScript.defer = true;
                        }
                        if (scriptInfo.async) {
                            newScript.async = true;
                        }
                        if (scriptInfo.content) {
                            newScript.textContent = scriptInfo.content;
                        }
                        logMessage(`Appending script: src=${newScript.src}, defer=${newScript.defer}, async=${newScript.async}, type=${newScript.type}, hasContent=${!!newScript.textContent}`, "debug", "PREVIEW");
                        // Append to body to ensure execution context
                        document.body.appendChild(newScript);
                        // Optionally remove it after execution if it's a one-time setup script?
                        // document.body.removeChild(newScript); 
                    });
                     logMessage('Finished appending extracted scripts.', "debug", "PREVIEW");
                } catch (appendError) {
                     logMessage(`Error appending extracted scripts: ${appendError.message}`, 'error', "PREVIEW");
                     console.error('[PREVIEW SCRIPT APPEND ERROR]', appendError);
                }
                 // --- End Execute Extracted Scripts ---

                // --- Re-ensure previewEventBus before handleFrontMatter ---
                // (In case init failed or was skipped somehow)
                if (typeof window.previewEventBus === 'undefined') {
                    if (eventBus) {
                       window.previewEventBus = eventBus;
                       logMessage('Re-assigned window.previewEventBus just before handleFrontMatter.', "debug", "PREVIEW");
                   } else {
                       logMessage('Main eventBus instance not available before handleFrontMatter.', 'error', "PREVIEW");
                   }
                 }
                // --- End Re-ensure ---

                // Handle front matter if present, using the 'frontMatter' property
                if (renderResult.frontMatter && Object.keys(renderResult.frontMatter).length > 0) {
                    this.handleFrontMatter(renderResult.frontMatter);
                } else {
                    logMessage('No front matter data found to handle.', "debug", "PREVIEW");
                }

                logMessage('[PREVIEW] Calling postProcessRender...', "debug", "PREVIEW");
                await postProcessRender(this.previewElement);
                logMessage('postProcessRender finished.', "debug", "PREVIEW");
                
                // Ensure SVG processing call is still commented out
                // logMessage('[PREVIEW] Processing SVG content...');
                // await processSvgContent();
                // logMessage('SVG processing finished.',"DEBUG","PREVIEW");
            
                logMessage('Preview updated successfully', "debug", "PREVIEW");
                resolve(renderResult); // Returnf the actual result object
            } else {
                logMessage('Preview element became null during update.', 'error', "PREVIEW");
                resolve(false); // Keep returning false on specific failure cases
            }
          } catch (error) {
            console.error('[PREVIEW] Render error:', error);
            logMessage(`Failed to render markdown: ${error.message}`, 'error', "PREVIEW");
            console.error('[PREVIEW ERROR]', error);
            resolve(false); // Indicate failure
          }
        }, this.config.updateDelay);
      });
    } catch (error) {
      console.error('[PREVIEW] Update error:', error);
      logMessage(`Failed to update preview: ${error.message}`, 'error', "PREVIEW");
      console.error('[PREVIEW ERROR]', error);
      return false; // Indicate failure
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
}

// Export these functions for external use
export function initPreview(options = {}) {
  const manager = new PreviewManager(options);
  return manager.init();
}

export function updatePreview(content) {
  const manager = new PreviewManager();
  return manager.update(content);
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