import { pluginManager } from './PluginManager.js';
import { appStore } from '/client/appState.js';
import { getIsPluginEnabled } from '/client/store/selectors.js';

export class Renderer {
  constructor() {
    this.pluginManager = pluginManager;
    this.markdownIt = null;
  }

  /**
   * Initialize renderer with plugins based on current state
   */
  async initialize() {
    const state = appStore.getState();
    const enabledPlugins = this._getEnabledPlugins(state);
    
    // Load enabled plugins
    for (const pluginName of enabledPlugins) {
      await this.pluginManager.loadPlugin(pluginName, state.plugins[pluginName]?.settings || {});
    }

    // Initialize markdown-it
    await this._initializeMarkdownIt();
  }

  /**
   * Get list of enabled plugins from state
   * @private
   */
  _getEnabledPlugins(state) {
    return Object.entries(state.plugins || {})
      .filter(([name, config]) => config.settings?.enabled)
      .map(([name]) => name);
  }

  /**
   * Initialize markdown-it with plugin-aware configuration
   * @private
   */
  async _initializeMarkdownIt() {
    if (!window.markdownit) {
      await this._loadMarkdownIt();
    }

    this.markdownIt = new window.markdownit({
      html: true,
      xhtmlOut: false,
      breaks: true,
      langPrefix: 'language-',
      linkify: true,
      typographer: true,
      highlight: (str, lang) => this._highlightCode(str, lang)
    });

    // Configure fence rule for special languages
    this._configureFenceRules();
  }

  /**
   * Highlight code using the highlight plugin
   * @private
   */
  _highlightCode(str, lang) {
    const highlightPlugin = this.pluginManager.getPlugin('highlight');
    
    if (!highlightPlugin || !highlightPlugin.isReady()) {
      return this._escapeHtml(str);
    }

    try {
      return highlightPlugin.highlight(str, lang);
    } catch (error) {
      console.error('[Renderer] Highlight error:', error);
      return this._escapeHtml(str);
    }
  }

  /**
   * Configure fence rules for special languages
   * @private
   */
  _configureFenceRules() {
    const originalFence = this.markdownIt.renderer.rules.fence || this.markdownIt.renderer.renderToken;

    this.markdownIt.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const lang = token.info ? token.info.trim().split(/\s+/g)[0].toLowerCase() : '';

      // Handle mermaid diagrams
      if (lang === 'mermaid') {
        const mermaidPlugin = this.pluginManager.getPlugin('mermaid');
        if (mermaidPlugin && mermaidPlugin.isReady()) {
          return `<div class="mermaid">\n${token.content.trim()}\n</div>\n`;
        }
      }

      // Default handling
      return originalFence.call(this, tokens, idx, options, env, self);
    };
  }

  /**
   * Render markdown content
   * @param {string} content - Markdown content
   * @returns {string} Rendered HTML
   */
  async render(content) {
    if (!this.markdownIt) {
      await this.initialize();
    }

    return this.markdownIt.render(content);
  }

  /**
   * Post-process rendered content
   * @param {HTMLElement} element - Container element
   */
  async postProcess(element) {
    const plugins = this.pluginManager.getAllPlugins();
    
    for (const [name, plugin] of plugins) {
      if (plugin.isReady() && typeof plugin.postProcess === 'function') {
        try {
          await plugin.postProcess(element);
        } catch (error) {
          console.error(`[Renderer] Post-process error in ${name}:`, error);
        }
      }
    }
  }

  /**
   * Escape HTML
   * @private
   */
  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Load markdown-it library
   * @private
   */
  async _loadMarkdownIt() {
    if (window.markdownit) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/markdown-it@latest/dist/markdown-it.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

// Export singleton
export const renderer = new Renderer(); 