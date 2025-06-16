/**
 * Syntax Highlighting Plugin
 * 
 * Adds code syntax highlighting to markdown code blocks
 * using highlight.js library.
 */

import { BasePlugin } from './BasePlugin.js';

// Helper for logging within this module
function logMessage(message, type = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, type, 'HIGHLIGHT');
    } else {
        console.log(`[HIGHLIGHT] ${message}`);
    }
}

export class HighlightPlugin extends BasePlugin {
  constructor(config = {}) {
    super('highlight', config);
    this.hljs = null;
    this.defaultTheme = config.theme || 'light';
  }

  async init() {
    if (this.initialized) {
      return this.ready;
    }

    try {
      await this._loadHighlightJS();
      this.initialized = true;
      this.ready = !!this.hljs;
      
      if (this.ready) {
        logMessage('[HighlightPlugin] Initialized successfully');
      } else {
        logMessage('[HighlightPlugin] Failed to initialize - hljs not available', 'error');
      }
      
      return this.ready;
    } catch (error) {
      logMessage(`[HighlightPlugin] Initialization failed: ${error.message}`, 'error');
      console.error('[HighlightPlugin] Error:', error);
      this.initialized = false;
      this.ready = false;
      return false;
    }
  }

  /**
   * Highlight code
   * @param {string} code - Code to highlight
   * @param {string} language - Programming language
   * @returns {string} Highlighted HTML
   */
  highlight(code, language) {
    if (!this.isReady()) {
      logMessage('Plugin not ready, returning escaped HTML', 'warn');
      return this._escapeHtml(code);
    }

    try {
      let result;
      if (language && this.hljs.getLanguage(language)) {
        result = this.hljs.highlight(code, { 
          language, 
          ignoreIllegals: true 
        });
        logMessage(`Highlighted ${language} code successfully`);
      } else {
        result = this.hljs.highlightAuto(code);
        logMessage(`Auto-detected and highlighted code`);
      }
      return result.value;
    } catch (error) {
      logMessage(`Highlight error for language '${language}': ${error.message}`, 'error');
      return this._escapeHtml(code);
    }
  }

  /**
   * Post-process any unhighlighted code blocks
   * @param {HTMLElement} element - Container element
   */
  async postProcess(element) {
    if (!this.isReady()) {
      logMessage('Plugin not ready for post-processing', 'warn');
      return;
    }

    const codeBlocks = element.querySelectorAll('pre code:not(.hljs)');
    
    let processedCount = 0;
    for (const block of codeBlocks) {
      try {
        this.hljs.highlightElement(block);
        processedCount++;
      } catch (error) {
        logMessage(`Post-process error on code block: ${error.message}`, 'error');
      }
    }

    if (processedCount > 0) {
      logMessage(`Post-processed ${processedCount} code blocks`);
    }
  }

  /**
   * Load highlight.js library
   * @private
   */
  async _loadHighlightJS() {
    // Check if already loaded globally
    if (window.hljs) {
      logMessage('Using existing window.hljs');
      this.hljs = window.hljs;
      return;
    }

    const CDN_URL = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@latest/build/highlight.min.js';
    const CSS_URL = this.defaultTheme === 'dark' 
      ? 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@latest/build/styles/github-dark.min.css'
      : 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@latest/build/styles/github.min.css';

    logMessage(`Loading highlight.js from CDN: ${CDN_URL}`);

    // Load CSS first
    await this._loadCSS(CSS_URL);
    logMessage('CSS loaded');

    // Load JS
    await this._loadScript(CDN_URL);
    logMessage('JavaScript loaded');

    if (!window.hljs) {
      throw new Error('highlight.js script loaded but window.hljs not available');
    }

    this.hljs = window.hljs;
    logMessage(`highlight.js version: ${this.hljs.versionString || 'unknown'}`);

    // Configure
    this.hljs.configure({
      ignoreUnescapedHTML: true,
      throwUnescapedHTML: false
    });
    logMessage('highlight.js configured');
  }

  /**
   * Load CSS file
   * @private
   */
  async _loadCSS(url) {
    if (document.querySelector(`link[href="${url}"]`)) {
      logMessage('CSS already loaded, skipping');
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.id = 'highlight-theme-css';
    document.head.appendChild(link);
    logMessage(`CSS link added: ${url}`);
  }

  /**
   * Load script file
   * @private
   */
  async _loadScript(url) {
    if (document.querySelector(`script[src="${url}"]`)) {
      logMessage('Script already loaded, skipping');
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => {
        logMessage('Script loaded successfully');
        resolve();
      };
      script.onerror = (error) => {
        logMessage(`Script load failed: ${error}`, 'error');
        reject(error);
      };
      document.head.appendChild(script);
    });
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

  getManifest() {
    return {
      name: 'Syntax Highlighting',
      version: '1.0.0',
      settings: [
        {
          key: 'enabled',
          label: 'Enable Syntax Highlighting',
          type: 'toggle'
        },
        {
          key: 'theme',
          label: 'Theme',
          type: 'select',
          options: ['light', 'dark']
        }
      ]
    };
  }
}

// Backward compatibility exports
export async function init(options = {}) {
  const plugin = new HighlightPlugin(options);
  return await plugin.init();
} 