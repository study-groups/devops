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
        logMessage('[PREVIEW ERROR] Preview container not found');
        return false;
      }

      // Add class for styling
      this.previewElement.classList.add('markdown-preview');

      // Log which plugins we're going to initialize
      logMessage(`[PREVIEW DEBUG] Initializing plugins: ${this.config.plugins.join(', ')}`);
      
      // Initialize components
      await initPlugins(this.config.plugins, {
        theme: this.config.theme,
        container: this.previewElement
      });

      // Apply theme
      this.applyTheme(this.config.theme);

      this.initialized = true;
      logMessage('[PREVIEW] Preview system initialized successfully');
      return true;
    } catch (error) {
      logMessage(`[PREVIEW ERROR] Failed to initialize preview: ${error.message}`);
      console.error('[PREVIEW ERROR]', error);
      return false;
    }
  }

  async update(content) {
    if (!this.initialized) {
      console.error('[PREVIEW] Preview not initialized. Call initPreview() first.');
      logMessage('[PREVIEW ERROR] Preview not initialized. Call initPreview() first.');
      return false;
    }
    
    if (!this.previewElement) {
      console.error('[PREVIEW] Preview element not found');
      logMessage('[PREVIEW ERROR] Preview element not found');
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
            logMessage('[PREVIEW] Calling renderMarkdown');
            const html = await renderMarkdown(content);
            logMessage(`[PREVIEW] renderMarkdown returned HTML length: ${html?.length}`);
            
            logMessage(`[PREVIEW] Setting innerHTML on previewElement.`);
            if (this.previewElement) {
                this.previewElement.innerHTML = html;
                logMessage('[PREVIEW] innerHTML set successfully');
                
                logMessage('[PREVIEW] Calling postProcessRender...');
                await postProcessRender(this.previewElement);
                logMessage('[PREVIEW] postProcessRender finished.');
            
                logMessage('[PREVIEW] Preview updated successfully');
                resolve(true);
            } else {
                logMessage('[PREVIEW ERROR] Preview element became null during update.', 'error');
                resolve(false);
            }
          } catch (error) {
            console.error('[PREVIEW] Render error:', error);
            logMessage(`[PREVIEW ERROR] Failed to render markdown: ${error.message}`);
            console.error('[PREVIEW ERROR]', error);
            resolve(false);
          }
        }, this.config.updateDelay);
      });
    } catch (error) {
      console.error('[PREVIEW] Update error:', error);
      logMessage(`[PREVIEW ERROR] Failed to update preview: ${error.message}`);
      console.error('[PREVIEW ERROR]', error);
      return false;
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
    
    logMessage(`[PREVIEW] Theme set to ${theme}`);
    return true;
  }

  getConfig() {
    return { ...this.config };
  }
}

// Export these functions for external use
export function initPreview(options = {}) {
  const manager = new PreviewManager(options);
  return manager.init();
}

export function updatePreview(content) {
  if (!previewInstance) {
    logMessage('[PREVIEW ERROR] Preview not initialized');
    return false;
  }
  return previewInstance.update(content);
}

export function setPreviewTheme(theme) {
  if (!previewInstance) {
    logMessage('[PREVIEW ERROR] Preview not initialized');
    return false;
  }
  return previewInstance.setTheme(theme);
}

/**
 * Export additional components
 */
export { renderMarkdown } from './renderer.js';
export { registerPlugin } from './plugins/index.js'; 