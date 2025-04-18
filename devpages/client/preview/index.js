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
import { processSvgContent } from '../markdown-svg.js';

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
        logMessage('Preview container not found',"ERROR","PREVIEW");
        return false;
      }

      // Add class for styling
      this.previewElement.classList.add('markdown-preview');

      // Log which plugins we're going to initialize
      logMessage(`Initializing plugins: ${this.config.plugins.join(', ')}`, "DEBUG", "PREVIEW");
      
      // Initialize components
      await initPlugins(this.config.plugins, {
        theme: this.config.theme,
        container: this.previewElement
      });

      // Apply theme
      this.applyTheme(this.config.theme);

      this.initialized = true;
      logMessage('Preview system initialized successfully',"DEBUG","PREVIEW");
      return true;
    } catch (error) {
      logMessage(`Failed to initialize preview: ${error.message}`,"ERROR", "PREVIEW");
      console.error('[PREVIEW ERROR]', error);
      return false;
    }
  }

  async update(content) {
    if (!this.initialized) {
      console.error('[PREVIEW] Preview not initialized. Call initPreview() first.');
      logMessage('Preview not initialized. Call initPreview() first.',"ERROR","PREVIEW");
      return false;
    }
    
    if (!this.previewElement) {
      console.error('[PREVIEW] Preview element not found');
      logMessage('[Preview element not found',"ERROR","PREVIEW");
      return false;
    }
    
    try {
      console.log('[PREVIEW] updatePreview called with content length:', content?.length);
      
      // Clear any pending updates
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }
      
      return new Promise((resolve) => {
        // Schedule the update to avoid too many updates in quick succession
        this.updateTimer = setTimeout(async () => {
          try {
            logMessage('Calling renderMarkdown');
            const renderResult = await renderMarkdown(content);
            logMessage(`renderMarkdown returned. HTML length: ${renderResult.html?.length}, FrontMatter keys: ${Object.keys(renderResult.frontMatter).join(', ')}`, "DEBUG", "PREVIEW");
            
            logMessage(`Setting innerHTML on previewElement.`, "DEBUG", "PREVIEW");
            if (this.previewElement) {
                this.previewElement.innerHTML = renderResult.html;
                logMessage('innerHTML set successfully', "DEBUG", "PREVIEW");
                
                // >>>>> ADD SCRIPT EXECUTION LOGIC START <<<<<
                try {
                    logMessage('Searching for and executing scripts in preview content...', "DEBUG", "PREVIEW");
                    const scripts = this.previewElement.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        if (!oldScript.src && !oldScript.textContent) return; // Skip empty scripts

                        const newScript = document.createElement('script');
                        
                        // Copy attributes (important: src, type, defer, async)
                        oldScript.getAttributeNames().forEach(attrName => {
                            newScript.setAttribute(attrName, oldScript.getAttribute(attrName));
                        });

                        // Copy inline script content if present
                        if (oldScript.textContent) {
                            newScript.textContent = oldScript.textContent;
                        }

                        logMessage(`Replacing script (src: ${newScript.src || 'inline'}) to trigger execution.`, "DEBUG", "PREVIEW");
                        // Replace the old script element with the new one to trigger execution
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });
                    logMessage(`Processed ${scripts.length} script tag(s).`, "DEBUG", "PREVIEW");
                } catch (scriptError) {
                    logMessage(`Error processing scripts in preview: ${scriptError.message}`, 'error', "PREVIEW");
                    console.error('[PREVIEW SCRIPT EXEC ERROR]', scriptError);
                }
                // >>>>> ADD SCRIPT EXECUTION LOGIC END <<<<<

                // Handle front matter if present, using the 'frontMatter' property
                if (renderResult.frontMatter && Object.keys(renderResult.frontMatter).length > 0) {
                    this.handleFrontMatter(renderResult.frontMatter);
                } else {
                    logMessage('No front matter data found to handle.', "DEBUG", "PREVIEW");
                }

                logMessage('[PREVIEW] Calling postProcessRender...', "DEBUG", "PREVIEW");
                await postProcessRender(this.previewElement);
                logMessage('postProcessRender finished.', "DEBUG", "PREVIEW");
                
                // Ensure SVG processing call is still commented out
                // logMessage('[PREVIEW] Processing SVG content...');
                // await processSvgContent();
                // logMessage('SVG processing finished.',"DEBUG","PREVIEW");
            
                logMessage('Preview updated successfully', "DEBUG", "PREVIEW");
                resolve(true);
            } else {
                logMessage('Preview element became null during update.', 'error', "PREVIEW");
                resolve(false);
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
    logMessage(`Handling front matter data: ${Object.keys(data).join(', ')}`, "DEBUG", "PREVIEW");

    // Ensure eventBus is available for scripts
    // Note: Assumes eventBus is imported at the top of the module
    if (typeof window.previewEventBus === 'undefined') {
        window.previewEventBus = eventBus; 
        logMessage('Made eventBus available as window.previewEventBus', "DEBUG", "PREVIEW");
    }

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
            logMessage('Applied front matter CSS.', "DEBUG", "PREVIEW");
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
        logMessage('Attempting to handle front matter script...', "DEBUG", "PREVIEW");
        try {
            logMessage('Creating script element...', "DEBUG", "PREVIEW");
            const scriptEl = document.createElement('script');
            scriptEl.id = FRONT_MATTER_SCRIPT_ID;
            logMessage('Setting script text content...', "DEBUG", "PREVIEW");
            scriptEl.textContent = data.script;
            logMessage('Appending script element to body...', "DEBUG", "PREVIEW");
            document.body.appendChild(scriptEl);
            logMessage('Successfully applied front matter script.', "DEBUG", "PREVIEW");
        } catch (e) {
            logMessage(`Error applying front matter script: ${e.message}`, 'error', "PREVIEW");
            console.error("Error details during front matter script handling:", e);
        }
    } else {
        logMessage('No script found in front matter data.', "DEBUG", "PREVIEW");
    }

    logMessage('Front matter handling complete.', "DEBUG", "PREVIEW");
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