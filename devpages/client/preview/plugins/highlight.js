/**
 * Syntax Highlighting Plugin
 * 
 * Adds code syntax highlighting to markdown code blocks
 * using highlight.js library.
 */

import { BasePlugin } from './BasePlugin.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('HighlightPlugin');

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
        log.info('HIGHLIGHT', 'INIT_SUCCESS', '[HighlightPlugin] Initialized successfully');
      } else {
        log.error('HIGHLIGHT', 'INIT_FAILED', '[HighlightPlugin] Failed to initialize - hljs not available');
      }
      
      return this.ready;
    } catch (error) {
      log.error('HIGHLIGHT', 'INIT_FAILED', `[HighlightPlugin] Initialization failed: ${error.message}`, error);
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
      log.warn('HIGHLIGHT', 'NOT_READY', 'Plugin not ready, returning escaped HTML');
      return this._escapeHtml(code);
    }

    try {
      let result;
      if (language && this.hljs.getLanguage(language)) {
        result = this.hljs.highlight(code, { 
          language, 
          ignoreIllegals: true 
        });
        log.info('HIGHLIGHT', 'HIGHLIGHT_SUCCESS', `Highlighted ${language} code successfully`);
      } else {
        result = this.hljs.highlightAuto(code);
        log.info('HIGHLIGHT', 'HIGHLIGHT_AUTO_SUCCESS', `Auto-detected and highlighted code`);
      }
      return result.value;
    } catch (error) {
      log.error('HIGHLIGHT', 'HIGHLIGHT_ERROR', `Highlight error for language '${language}': ${error.message}`, error);
      return this._escapeHtml(code);
    }
  }

  /**
   * Post-process any unhighlighted code blocks
   * @param {HTMLElement} element - Container element
   */
  async postProcess(element) {
    if (!this.isReady()) {
      log.warn('HIGHLIGHT', 'NOT_READY_POST_PROCESS', 'Plugin not ready for post-processing');
      return;
    }

    const codeBlocks = element.querySelectorAll('pre code:not(.hljs)');
    
    let processedCount = 0;
    for (const block of codeBlocks) {
      try {
        this.hljs.highlightElement(block);
        processedCount++;
      } catch (error) {
        log.error('HIGHLIGHT', 'POST_PROCESS_ERROR', `Post-process error on code block: ${error.message}`, error);
      }
    }

    if (processedCount > 0) {
      log.info('HIGHLIGHT', 'POST_PROCESS_SUCCESS', `Post-processed ${processedCount} code blocks`);
    }
  }

  /**
   * Load highlight.js library
   * @private
   */
  async _loadHighlightJS() {
    // Check if already loaded globally
    if (window.hljs) {
      log.info('HIGHLIGHT', 'HLJS_ALREADY_LOADED', 'Using existing window.hljs');
      this.hljs = window.hljs;
      return;
    }

    // Local path for highlight.js script
    const CDN_URL = '/client/vendor/scripts/highlight.min.js';

    let highlightJsLoaded = false;
    let highlightJsLoading = false;

    if (highlightJsLoaded) return;
    if (highlightJsLoading) {
        console.log('[Highlight.js] Waiting for existing load to complete...');
        await new Promise(resolve => document.addEventListener('highlightjs-loaded', resolve, { once: true }));
        return;
    }

    highlightJsLoading = true;

    try {
        console.log('[Highlight.js] Loading script...');
        await this._loadScript(CDN_URL);
        highlightJsLoaded = true;
        console.log('[Highlight.js] Script loaded successfully.');
        document.dispatchEvent(new CustomEvent('highlightjs-loaded'));
    } catch (error) {
        console.error('[Highlight.js] Failed to load script:', error);
    } finally {
        highlightJsLoading = false;
    }

    if (!window.hljs) {
      throw new Error('highlight.js script loaded but window.hljs not available');
    }

    this.hljs = window.hljs;
    log.info('HIGHLIGHT', 'HLJS_VERSION', `highlight.js version: ${this.hljs.versionString || 'unknown'}`);

    // Configure
    this.hljs.configure({
      ignoreUnescapedHTML: true,
      throwUnescapedHTML: false
    });
    log.info('HIGHLIGHT', 'HLJS_CONFIGURED', 'highlight.js configured');
  }

  /**
   * Load CSS file
   * @private
   */
  async _loadCSS(url) {
    if (document.querySelector(`link[href="${url}"]`)) {
      log.warn('HIGHLIGHT', 'CSS_ALREADY_LOADED', 'CSS already loaded, skipping');
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.id = 'highlight-theme-css';
    document.head.appendChild(link);
    log.info('HIGHLIGHT', 'CSS_LINK_ADDED', `CSS link added: ${url}`);
  }

  /**
   * Load script file
   * @private
   */
  async _loadScript(url) {
    if (document.querySelector(`script[src="${url}"]`)) {
      log.warn('HIGHLIGHT', 'SCRIPT_ALREADY_LOADED', 'Script already loaded, skipping');
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => {
        log.info('HIGHLIGHT', 'SCRIPT_LOADED', 'Script loaded successfully');
        resolve();
      };
      script.onerror = (error) => {
        log.error('HIGHLIGHT', 'SCRIPT_LOAD_FAILED', `Script load failed: ${error}`, error);
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