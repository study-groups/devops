/**
 * MarkdownFactory - Creates configured markdown-it instances
 * Centralizes markdown-it setup with plugin integration
 */

import { appStore } from '/client/appState.js';
import { getIsPluginEnabled } from '/client/store/selectors.js';
import LinkManager from '/client/links/LinkManager.js';

const log = window.APP?.services?.log?.createLogger('MarkdownFactory') || console;

/**
 * Ensure markdown-it library is loaded
 */
async function ensureMarkdownItLoaded() {
  if (typeof window.markdownit !== 'undefined') {
    return true;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/client/vendor/scripts/markdown-it.min.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load markdown-it'));
    document.head.appendChild(script);
  });
}

/**
 * MarkdownFactory - Creates configured markdown-it instances
 */
export class MarkdownFactory {
  /**
   * Create a markdown-it instance with plugins and configuration
   * @param {string} filePath - Source file path for link resolution
   * @param {Object} options - Configuration options
   * @param {string} options.mode - 'preview' or 'publish'
   * @param {Array} options.plugins - Plugin instances to apply
   * @returns {Promise<Object>} Configured markdown-it instance
   */
  static async createInstance(filePath, options = {}) {
    const { mode = 'preview', plugins = null } = options;

    await ensureMarkdownItLoaded();

    // Get plugin instances from registry or use provided plugins
    const activePlugins = plugins || this.getActivePlugins();

    // Pre-load highlight plugin if enabled (must be synchronous for markdown-it)
    let highlightPlugin = null;
    const highlightEnabled = activePlugins.some(p => p.id === 'highlight' && p.isEnabled());

    if (highlightEnabled) {
      const plugin = activePlugins.find(p => p.id === 'highlight');
      if (plugin && plugin.isReady && plugin.isReady()) {
        highlightPlugin = plugin;
      }
    }

    // Create markdown-it instance with base configuration
    const md = new window.markdownit({
      html: true,
      xhtmlOut: false,
      breaks: true,
      langPrefix: 'language-',
      linkify: true,
      typographer: true,
      highlight: (str, lang) => {
        // Synchronous highlighting function
        if (highlightPlugin && highlightPlugin.highlight) {
          try {
            return highlightPlugin.highlight(str, lang);
          } catch (error) {
            log.error?.('MARKDOWN', 'HIGHLIGHT_ERROR', `Highlighting error: ${error.message}`, error);
          }
        }
        return md.utils.escapeHtml(str);
      }
    });

    // Apply markdown-it plugins from plugin instances
    for (const plugin of activePlugins) {
      if (!plugin.isEnabled || !plugin.isEnabled()) continue;

      // Apply markdown-it plugin if available
      if (plugin.markdownItPlugin && typeof plugin.markdownItPlugin === 'function') {
        try {
          const pluginOptions = plugin.getMarkdownItOptions ? plugin.getMarkdownItOptions() : {};
          md.use(plugin.markdownItPlugin, pluginOptions);
          log.info?.('MARKDOWN', 'PLUGIN_APPLIED', `Applied markdown-it plugin: ${plugin.id}`);
        } catch (error) {
          log.error?.('MARKDOWN', 'PLUGIN_ERROR', `Error applying plugin ${plugin.id}: ${error.message}`, error);
        }
      }

      // Apply custom fence renderers
      if (plugin.fenceRenderer && typeof plugin.fenceRenderer === 'function') {
        const originalFence = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
          return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.fence = plugin.fenceRenderer(originalFence, md);
        log.info?.('MARKDOWN', 'FENCE_RENDERER_APPLIED', `Applied fence renderer: ${plugin.id}`);
      }
    }

    // Apply link and image resolution
    if (filePath) {
      const linkManager = new LinkManager(mode, filePath);

      // Image renderer
      const defaultImageRenderer = md.renderer.rules.image || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const srcAttr = token.attrGet('src');
        if (srcAttr) {
          token.attrSet('src', linkManager.resolveResourcePath(srcAttr));
        }
        return defaultImageRenderer(tokens, idx, options, env, self);
      };

      // Link renderer
      const defaultLinkRenderer = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const hrefAttr = token.attrGet('href');
        if (hrefAttr) {
          token.attrSet('href', linkManager.resolveLink(hrefAttr));
        }
        return defaultLinkRenderer(tokens, idx, options, env, self);
      };
    }

    return md;
  }

  /**
   * Get active plugins from the global plugin registry
   * @returns {Array} Array of enabled plugin instances
   */
  static getActivePlugins() {
    if (!window.APP?.services?.pluginRegistry) {
      return [];
    }

    return window.APP.services.pluginRegistry.getEnabledPlugins();
  }

  /**
   * Preprocess content before rendering (e.g., KaTeX blocks)
   * @param {string} content - Markdown content
   * @param {Array} plugins - Plugin instances
   * @returns {string} Preprocessed content
   */
  static preprocessContent(content, plugins = null) {
    const activePlugins = plugins || this.getActivePlugins();
    let processedContent = content;

    for (const plugin of activePlugins) {
      if (plugin.preprocessContent && typeof plugin.preprocessContent === 'function') {
        try {
          processedContent = plugin.preprocessContent(processedContent);
        } catch (error) {
          log.error?.('MARKDOWN', 'PREPROCESS_ERROR', `Error in ${plugin.id} preprocessing: ${error.message}`, error);
        }
      }
    }

    return processedContent;
  }
}

export default MarkdownFactory;
