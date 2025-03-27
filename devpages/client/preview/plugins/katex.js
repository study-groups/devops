/**
 * KaTeX Math Expression Plugin
 * 
 * Adds support for rendering mathematical expressions in markdown
 * using KaTeX for both inline and block math.
 */

import { logMessage } from '../../log/index.js';

// KaTeX CDN URLs
const KATEX_JS_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
const KATEX_CSS_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
const KATEX_AUTO_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js';

// Plugin state
let katex = null;
let renderMathInElement = null;
let config = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ],
  throwOnError: false,
  errorColor: '#cc0000',
  macros: {},
  trust: true,
  strict: 'warn'
};

/**
 * Load KaTeX scripts and CSS
 * @returns {Promise<Boolean>} Whether loading was successful
 */
async function loadKaTeX() {
  try {
    // If already loaded, return early
    if (window.katex && window.renderMathInElement) {
      katex = window.katex;
      renderMathInElement = window.renderMathInElement;
      return true;
    }
    
    // Check if the script is already loading
    if (document.querySelector(`script[src="${KATEX_JS_CDN}"]`)) {
      // Wait for it to load
      await new Promise(resolve => {
        const checkLoaded = () => {
          if (window.katex) {
            resolve();
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
      
      katex = window.katex;
    } else {
      // Load KaTeX CSS
      if (!document.querySelector(`link[href="${KATEX_CSS_CDN}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = KATEX_CSS_CDN;
        document.head.appendChild(link);
      }
      
      // Load KaTeX JS
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = KATEX_JS_CDN;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      katex = window.katex;
      
      // Load auto-render extension
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = KATEX_AUTO_CDN;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      renderMathInElement = window.renderMathInElement;
    }
    
    if (!katex || !renderMathInElement) {
      throw new Error('KaTeX or auto-render extension not loaded');
    }
    
    logMessage('[PREVIEW] KaTeX loaded successfully');
    return true;
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to load KaTeX: ${error.message}`);
    console.error('[PREVIEW ERROR] KaTeX load:', error);
    return false;
  }
}

/**
 * Initialize the KaTeX plugin
 * @param {Object} options Plugin options
 * @returns {Promise<Boolean>} Whether initialization was successful
 */
async function init(options = {}) {
  try {
    // Load KaTeX
    const loaded = await loadKaTeX();
    if (!loaded) {
      return false;
    }
    
    // Apply configuration options
    if (options.katexOptions) {
      config = { ...config, ...options.katexOptions };
    }
    
    logMessage('[PREVIEW] KaTeX plugin initialized');
    return true;
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to initialize KaTeX plugin: ${error.message}`);
    console.error('[PREVIEW ERROR] KaTeX plugin:', error);
    return false;
  }
}

/**
 * Process inline math in text
 * @param {String} text The text to process
 * @returns {String} Processed text with rendered math
 */
function processInlineMath(text) {
  // Skip if KaTeX is not loaded
  if (!katex) return text;
  
  try {
    // Process $...$ inline math
    return text.replace(/\$([^\$]+)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula, { 
          displayMode: false,
          throwOnError: false
        });
      } catch (error) {
        console.error('[PREVIEW ERROR] KaTeX inline math:', error);
        return `<span class="katex-error" title="${error.message}">${match}</span>`;
      }
    });
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to process inline math: ${error.message}`);
    return text;
  }
}

/**
 * Custom renderer for code blocks
 * @param {String} code Block content
 * @param {String} infostring Language info string
 * @returns {String|null} HTML string or null to use default renderer
 */
function codeRenderer(code, infostring) {
  // Only handle math code blocks
  if (!infostring || !infostring.match(/^(math|latex|tex)$/i)) {
    return null;
  }
  
  // Skip if KaTeX is not loaded
  if (!katex) return null;
  
  try {
    // Render the math expression
    return katex.renderToString(code, {
      displayMode: true,
      throwOnError: false,
      errorColor: config.errorColor,
      strict: config.strict
    });
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to render math block: ${error.message}`);
    
    // Return error message
    return `
      <div class="katex-error">
        <div class="katex-error-header">⚠️ Math Syntax Error</div>
        <pre class="katex-error-message">${error.message}</pre>
        <pre class="katex-error-code">${code}</pre>
      </div>
    `;
  }
}

/**
 * Post-process the rendered HTML to initialize math expressions
 * @param {HTMLElement} element The preview container element
 * @returns {Promise<void>}
 */
async function postProcess(element) {
  try {
    if (!katex || !renderMathInElement) {
      logMessage('[PREVIEW WARNING] KaTeX not fully loaded, skipping math rendering');
      return;
    }
    
    // Auto-render all math in the element
    renderMathInElement(element, {
      ...config,
      output: 'html'
    });
    
    logMessage('[PREVIEW] Math expressions rendered');
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed during KaTeX post-processing: ${error.message}`);
    console.error('[PREVIEW ERROR] KaTeX post-process:', error);
  }
}

// Override paragraph renderer to handle inline math
function paragraphRenderer(text) {
  return `<p>${processInlineMath(text)}</p>`;
}

// Export the plugin interface
export class KaTeXPlugin {
  constructor() {
    this.name = 'katex';
    this.initialized = false;
  }

  async init(options = {}) {
    // ... implementation ...
  }

  async preProcess(content) {
    return content;
  }

  async postProcess(html, element) {
    // ... implementation ...
    return html;
  }

  renderers() {
    return {
      code: codeRenderer,
      paragraph: paragraphRenderer
    };
  }
} 