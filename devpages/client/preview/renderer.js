/**
 * Markdown Renderer
 * 
 * Responsible for converting markdown to HTML with support for custom renderers
 * and extensions.
 */

import { logMessage } from '../log/index.js';
import { getEnabledPlugins } from './plugins/index.js';
import { MermaidPlugin, createMermaidRenderer } from './plugins/mermaid.js';

// Import marked from CDN
const markedUrl = 'https://cdn.jsdelivr.net/npm/marked@4.3.0/lib/marked.esm.js';
let marked = null;

/**
 * Initialize the markdown parser
 * @returns {Promise<Boolean>} Whether initialization was successful
 */
export async function initMarkdownParser() {
  try {
    if (marked) return true;
    
    try {
      // Try to use existing marked
      if (window.marked) {
        marked = window.marked;
        logMessage('[PREVIEW] Using global marked instance');
      } else {
        // Dynamically import marked
        const module = await import(markedUrl);
        marked = module.marked;
        logMessage('[PREVIEW] Loaded marked from CDN');
      }
    } catch (error) {
      logMessage(`[PREVIEW ERROR] Failed to load marked: ${error.message}`);
      return false;
    }
    
    // Configure marked with safe options
    marked.setOptions({
      gfm: true,          // Enable GitHub flavored markdown
      breaks: true,       // Convert line breaks to <br>
      headerIds: true,    // Add IDs to headers
      sanitize: false,    // We'll handle sanitization separately
      mangle: false,      // Don't mess with email addresses
      pedantic: false,    // Don't be too strict with original markdown spec
      smartLists: true,   // Use smarter list behavior
      smartypants: true,  // Use "smart" typographic punctuation
    });
    
    // Create a custom renderer
    const renderer = createCustomRenderer();
    marked.use({ renderer });
    
    return true;
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to initialize markdown parser: ${error.message}`);
    console.error('[PREVIEW ERROR]', error);
    return false;
  }
}

/**
 * Create a custom renderer for marked
 * @returns {Object} Custom renderer instance
 */
function createCustomRenderer() {
  const renderer = new marked.Renderer();
  const mermaidRenderer = createMermaidRenderer();
  
  // Override code renderer to handle mermaid
  renderer.code = function(code, infostring, escaped) {
    const mermaidResult = mermaidRenderer.code(code, infostring);
    if (mermaidResult) return mermaidResult;
    
    // Default code rendering
    return false;
  };
  
  // Original renderer methods for fallback
  const originalRenderers = {
    code: renderer.code.bind(renderer),
    codespan: renderer.codespan.bind(renderer),
    link: renderer.link.bind(renderer),
    image: renderer.image.bind(renderer),
  };
  
  // Override code spans
  renderer.codespan = function(code) {
    // Check if any plugin handles this code span
    const plugins = getEnabledPlugins();
    for (const plugin of plugins) {
      if (plugin.renderers && plugin.renderers.codespan) {
        const result = plugin.renderers.codespan(code);
        if (result !== null && result !== undefined) {
          return result;
        }
      }
    }
    
    // Fall back to default renderer
    return originalRenderers.codespan(code);
  };
  
  // Override links for enhanced functionality
  renderer.link = function(href, title, text) {
    // Check if any plugin handles this link
    const plugins = getEnabledPlugins();
    for (const plugin of plugins) {
      if (plugin.renderers && plugin.renderers.link) {
        const result = plugin.renderers.link(href, title, text);
        if (result !== null && result !== undefined) {
          return result;
        }
      }
    }
    
    // Add target="_blank" and rel="noopener noreferrer" for security
    const safeHref = href.startsWith('javascript:') ? '' : href;
    return `<a href="${safeHref}" title="${title || ''}" 
      ${href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
  };
  
  // Override images
  renderer.image = function(href, title, text) {
    // Check if any plugin handles this image
    const plugins = getEnabledPlugins();
    for (const plugin of plugins) {
      if (plugin.renderers && plugin.renderers.image) {
        const result = plugin.renderers.image(href, title, text);
        if (result !== null && result !== undefined) {
          return result;
        }
      }
    }
    
    // Advanced image handling with lazy loading and error handling
    return `<img src="${href}" alt="${text || ''}" title="${title || ''}" 
      loading="lazy" onerror="this.onerror=null;this.style.opacity=0.2;this.parentNode.classList.add('img-error');">`;
  };
  
  return renderer;
}

/**
 * Render markdown content to HTML
 * @param {String} content Markdown content
 * @param {HTMLElement} element Target element
 * @returns {String} Rendered HTML
 */
export async function renderMarkdown(content, element) {
  try {
    logMessage('[PREVIEW RENDERER] renderMarkdown called with content length:', content?.length);
    
    // Get enabled plugins
    const plugins = getEnabledPlugins();
    logMessage('[PREVIEW RENDERER] Enabled plugins:', plugins.size);

    // Pre-process content through plugins
    for (const [name, plugin] of plugins) {
      if (plugin.preProcess) {
        try {
          content = await plugin.preProcess(content);
        } catch (error) {
          logMessage(`[PREVIEW ERROR] Plugin "${name}" preProcess error: ${error.message}`);
        }
      }
    }

    // Render markdown
    const html = marked(content);

    // Post-process HTML through plugins
    let processedHtml = html;
    for (const [name, plugin] of plugins) {
      if (plugin.postProcess) {
        try {
          processedHtml = await plugin.postProcess(processedHtml, element);
        } catch (error) {
          logMessage(`[PREVIEW ERROR] Plugin "${name}" postProcess error: ${error.message}`);
        }
      }
    }

    return processedHtml;
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to render markdown: ${error.message}`);
    console.error('[PREVIEW ERROR]', error);
    throw error;
  }
}

/**
 * Simple HTML escape function for fallback
 * @param {String} text Text to escape
 * @returns {String} Escaped HTML
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

export class Renderer {
  constructor() {
    // ... existing initialization ...
    
    // Add Mermaid plugin
    this.plugins = [
      new MermaidPlugin()
      // ... other plugins ...
    ];
  }

  async render(content, element) {
    // ... existing render logic ...

    // After markdown is rendered, run plugins
    this.plugins.forEach(plugin => {
      try {
        plugin.render(element);
      } catch (error) {
        console.error(`Plugin ${plugin.name} error:`, error);
      }
    });
  }
} 