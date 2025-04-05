/**
 * Syntax Highlighting Plugin
 * 
 * Adds code syntax highlighting to markdown code blocks
 * using highlight.js library.
 */

// Helper for logging within this module
function logHighlight(message, level = 'text') {
    const prefix = '[HIGHLIGHT]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

// Highlight.js CDN URLs
const HIGHLIGHT_JS_CDN = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/highlight.min.js';
const HIGHLIGHT_CSS_CDN = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/styles/github.min.css';
const HIGHLIGHT_DARK_CSS_CDN = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.7.0/build/styles/github-dark.min.css';

// Plugin state
let hljs = null;
let config = {
  theme: 'light',
  languages: [], // Auto-detect
  ignoreIllegals: true,
  throwIllegals: false,
  subLanguages: false
};

/**
 * Load highlight.js scripts and CSS
 * @returns {Promise<Boolean>} Whether loading was successful
 */
async function loadHighlight() {
  try {
    // If already loaded, return early
    if (window.hljs) {
      hljs = window.hljs;
      return true;
    }
    
    // Check if the script is already loading
    if (document.querySelector(`script[src="${HIGHLIGHT_JS_CDN}"]`)) {
      // Wait for it to load
      await new Promise(resolve => {
        const checkLoaded = () => {
          if (window.hljs) {
            resolve();
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
      
      hljs = window.hljs;
    } else {
      // Load highlight.js CSS based on theme
      const cssUrl = config.theme === 'dark' ? HIGHLIGHT_DARK_CSS_CDN : HIGHLIGHT_CSS_CDN;
      
      if (!document.querySelector(`link[href="${cssUrl}"]`)) {
        const link = document.createElement('link');
        link.id = 'highlight-theme-css';
        link.rel = 'stylesheet';
        link.href = cssUrl;
        document.head.appendChild(link);
      }
      
      // Load highlight.js JS
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HIGHLIGHT_JS_CDN;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      hljs = window.hljs;
    }
    
    if (!hljs) {
      throw new Error('Highlight.js not loaded');
    }
    
    // Configure hljs
    hljs.configure({
      ignoreUnescapedHTML: true,
      throwUnescapedHTML: false,
      languages: config.languages
    });
    
    logHighlight('[PREVIEW] Highlight.js loaded successfully');
    return true;
  } catch (error) {
    logHighlight(`[PREVIEW ERROR] Failed to load highlight.js: ${error.message}`);
    console.error('[PREVIEW ERROR] Highlight.js load:', error);
    return false;
  }
}

/**
 * Initialize the highlighting plugin
 * EXPORTED
 * @param {Object} options Plugin options
 * @returns {Promise<Boolean>} Whether initialization was successful
 */
export async function init(options = {}) {
  try {
    // Update configuration
    if (options.theme) {
      config.theme = options.theme;
    }
    
    // Load highlight.js
    const loaded = await loadHighlight();
    if (!loaded) {
      return false;
    }
    
    logHighlight('[PREVIEW] Syntax highlighting plugin initialized');
    return true;
  } catch (error) {
    logHighlight(`[PREVIEW ERROR] Failed to initialize highlighting plugin: ${error.message}`);
    console.error('[PREVIEW ERROR] Highlighting plugin:', error);
    return false;
  }
}

/**
 * Custom renderer for code blocks
 * @param {String} code Block content
 * @param {String} infostring Language info string
 * @param {Boolean} escaped Whether the code is already escaped
 * @returns {String|null} HTML string or null to use default renderer
 */
function codeRenderer(code, infostring, escaped) {
  // Skip if highlight.js is not loaded
  if (!hljs) return null;
  
  // Skip for special languages handled by other plugins
  if (infostring && 
      (infostring.match(/^mermaid$/i) || 
       infostring.match(/^(math|latex|tex)$/i) ||
       infostring.match(/^audio$/i))) {
    return null;
  }
  
  try {
    // Determine language
    const language = infostring || '';
    
    // If no language is specified, use autodetect
    let highlighted;
    if (!language) {
      highlighted = hljs.highlightAuto(code).value;
    } else {
      // Try to highlight with the specified language
      try {
        highlighted = hljs.highlight(code, { 
          language, 
          ignoreIllegals: config.ignoreIllegals 
        }).value;
      } catch (langError) {
        // If the language is not supported, fall back to autodetect
        console.warn(`Language '${language}' not supported by highlight.js, using autodetect`);
        highlighted = hljs.highlightAuto(code).value;
      }
    }
    
    // Return the highlighted code
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  } catch (error) {
    logHighlight(`[PREVIEW ERROR] Failed to highlight code: ${error.message}`);
    console.error('[PREVIEW ERROR] Highlight:', error);
    
    // Fall back to basic code rendering
    return null;
  }
}

/**
 * Set the theme for syntax highlighting
 * @param {String} theme Theme name ('light' or 'dark')
 */
function setTheme(theme) {
  try {
    config.theme = theme;
    
    // Update CSS link
    const cssUrl = theme === 'dark' ? HIGHLIGHT_DARK_CSS_CDN : HIGHLIGHT_CSS_CDN;
    let link = document.getElementById('highlight-theme-css');
    
    if (link) {
      link.href = cssUrl;
    } else {
      link = document.createElement('link');
      link.id = 'highlight-theme-css';
      link.rel = 'stylesheet';
      link.href = cssUrl;
      document.head.appendChild(link);
    }
    
    logHighlight(`[PREVIEW] Syntax highlighting theme set to ${theme}`);
  } catch (error) {
    logHighlight(`[PREVIEW ERROR] Failed to set highlighting theme: ${error.message}`);
    console.error('[PREVIEW ERROR] Highlight theme:', error);
  }
}

/**
 * Post-process the rendered HTML to highlight any unhighlighted code blocks
 * @param {HTMLElement} element The preview container element
 * @returns {Promise<void>}
 */
async function postProcess(element) {
  try {
    if (!hljs) {
      logHighlight('[PREVIEW WARNING] Highlight.js not loaded, skipping code highlighting');
      return;
    }
    
    // Find all unhighlighted code blocks
    const codeBlocks = element.querySelectorAll('pre code:not(.hljs)');
    if (codeBlocks.length === 0) return;
    
    // Highlight each code block
    codeBlocks.forEach(block => {
      try {
        hljs.highlightElement(block);
      } catch (error) {
        console.error('[PREVIEW ERROR] Failed to highlight code block:', error);
      }
    });
    
    logHighlight(`[PREVIEW] Highlighted ${codeBlocks.length} code blocks`);
  } catch (error) {
    logHighlight(`[PREVIEW ERROR] Failed during code highlighting post-processing: ${error.message}`);
    console.error('[PREVIEW ERROR] Highlight post-process:', error);
  }
}

// Export the plugin class AND the init function
export class HighlightPlugin {
  constructor() {
    this.name = 'highlight';
    this.initialized = false;
  }

  async init(options = {}) {
    // Delegate to the exported init function
    this.initialized = await init(options);
    return this.initialized;
  }

  async preProcess(content) {
    return content;
  }

  async postProcess(html, element) {
    // ... implementation ...
    return html;
  }
}

// Export the plugin interface
export default {
  init,
  postProcess,
  setTheme,
  renderers: {
    code: codeRenderer
  }
}; 