/**
 * KaTeX Math Expression Plugin
 * 
 * Adds support for rendering mathematical expressions in markdown
 * using KaTeX for both inline and block math.
 */

const log = window.APP.services.log.createLogger('KaTeXPlugin');

// CDN URLs for KaTeX assets
const KATEX_JS_CDN = '/client/vendor/scripts/katex.min.js';
const KATEX_CSS_CDN = '/client/vendor/styles/katex.min.css';
const KATEX_AUTO_CDN = '/client/vendor/scripts/auto-render.min.js';

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
  log.debug('KATEX', 'LOAD_START', 'loadKaTeX started.');
  try {
    // If already loaded, return early
    if (window.katex && window.renderMathInElement) {
      log.debug('KATEX', 'ALREADY_LOADED', 'KaTeX and renderMathInElement already loaded.');
      katex = window.katex;
      renderMathInElement = window.renderMathInElement;
      return true;
    }
    
    // Check if the script is already loading
    if (document.querySelector(`script[src="${KATEX_JS_CDN}"]`)) {
      log.debug('KATEX', 'SCRIPT_EXISTS', 'KaTeX JS script already exists in DOM. Waiting...');
      // Wait for it to load
      await new Promise(resolve => {
        const checkLoaded = () => {
          if (window.katex) {
            log.debug('KATEX', 'WINDOW_KATEX_AVAILABLE', 'window.katex became available.');
            resolve();
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
      
      katex = window.katex;
      log.debug('KATEX', 'KATEX_ASSIGNED_AFTER_WAIT', 'katex variable assigned after wait.');

    } else {
      log.debug('KATEX', 'LOADING_SCRIPT', 'KaTeX JS script not in DOM. Loading CSS and JS...');
      // Load KaTeX CSS
      if (!document.querySelector(`link[href="${KATEX_CSS_CDN}"]`)) {
        log.debug('KATEX', 'LOADING_CSS', 'Loading KaTeX CSS.');
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = KATEX_CSS_CDN;
        document.head.appendChild(link);
      }
      
      // Load KaTeX JS
      log.debug('KATEX', 'ATTEMPT_LOAD_JS', 'Attempting to load KaTeX JS script.');
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = KATEX_JS_CDN;
        script.async = true;
        script.onload = () => { log.debug('KATEX', 'JS_ONLOAD', 'KaTeX JS onload triggered.'); resolve(); };
        script.onerror = (err) => { log.error('KATEX', 'JS_ONERROR', `KaTeX JS onerror triggered: ${err}`); reject(err); };
        document.head.appendChild(script);
      });
      
      log.debug('KATEX', 'JS_LOADED', 'KaTeX JS script finished loading (promise resolved).');
      katex = window.katex;
      if (!katex) { log.warn('KATEX', 'KATEX_NULL_AFTER_LOAD', 'WARNING: window.katex is null/undefined after load!'); }
      
      // Load auto-render extension
      log.debug('KATEX', 'ATTEMPT_LOAD_AUTORENDER', 'Attempting to load auto-render script.');
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = KATEX_AUTO_CDN;
        script.async = true;
        script.onload = () => { log.debug('KATEX', 'AUTORENDER_ONLOAD', 'Auto-render JS onload triggered.'); resolve(); };
        script.onerror = (err) => { log.error('KATEX', 'AUTORENDER_ONERROR', `Auto-render JS onerror triggered: ${err}`); reject(err); };
        document.head.appendChild(script);
      });
      
      log.debug('KATEX', 'AUTORENDER_LOADED', 'Auto-render script finished loading (promise resolved).');
      renderMathInElement = window.renderMathInElement;
      if (!renderMathInElement) { log.warn('KATEX', 'AUTORENDER_NULL_AFTER_LOAD', 'WARNING: window.renderMathInElement is null/undefined after load!'); }
    }
    
    log.debug('KATEX', 'FINAL_CHECK', 'Checking final katex and renderMathInElement variables.');
    if (!katex || !renderMathInElement) {
      log.error('KATEX', 'FINAL_CHECK_FAILED', 'Final check FAILED.');
      throw new Error('KaTeX or auto-render extension not loaded');
    }
    
    log.debug('KATEX', 'FINAL_CHECK_PASSED', 'Final check PASSED. KaTeX loaded successfully');
    log.info('KATEX', 'LOAD_SUCCESS', 'KaTeX loaded successfully');
    return true;
  } catch (error) {
    log.error('KATEX', 'LOAD_ERROR', `Failed to load KaTeX: ${error.message}`, error);
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
    
    log.info('KATEX', 'INIT_SUCCESS', 'KaTeX plugin initialized');
    return true;
  } catch (error) {
    log.error('KATEX', 'INIT_ERROR', `Failed to initialize KaTeX plugin: ${error.message}`, error);
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
        log.error('KATEX', 'INLINE_MATH_ERROR', 'KaTeX inline math:', error);
        return `<span class="katex-error" title="${error.message}">${match}</span>`;
      }
    });
  } catch (error) {
    log.error('KATEX', 'PROCESS_INLINE_MATH_ERROR', `Failed to process inline math: ${error.message}`, error);
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
    log.error('KATEX', 'RENDER_MATH_BLOCK_ERROR', `Failed to render math block: ${error.message}`, error);
    
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
      log.warn('KATEX', 'KATEX_NOT_LOADED_SKIP_RENDER', 'KaTeX not fully loaded, skipping math rendering');
      return;
    }
    
    // Auto-render all math in the element
    renderMathInElement(element, {
      ...config,
      output: 'html'
    });
    
    log.info('KATEX', 'MATH_EXPRESSIONS_RENDERED', 'Math expressions rendered');
  } catch (error) {
    log.error('KATEX', 'POST_PROCESS_ERROR', `Failed during KaTeX post-processing: ${error.message}`, error);
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
    try {
      this.initialized = await init(options);
      log.info('KATEX', 'INIT_STATUS', 'Initialization ' + (this.initialized ? 'successful' : 'failed'));
      return this.initialized;
    } catch (error) {
      log.error('KATEX', 'PLUGIN_INIT_ERROR', `Initialization failed: ${error.message}`, error);
      this.initialized = false;
      return false;
    }
  }

  async process(previewElement) {
    if (!this.initialized) {
      await this.init(); // Try to initialize if not already done
      if (!this.initialized) {
        log.warn('KATEX', 'PROCESS_NOT_INITIALIZED', 'Cannot process content - plugin not initialized');
        return;
      }
    }

    // --- DISABLED: The markdown-it-katex plugin handles rendering during markdown parsing. --- 
    // --- Running renderMathInElement here would try to re-process already rendered HTML, causing errors. --- 
    /*
    try {
      log.info('KATEX', 'PROCESSING_MATH_EXPRESSIONS', 'Processing math expressions...');
      await postProcess(previewElement);
      log.info('KATEX', 'MATH_EXPRESSIONS_PROCESSED_SUCCESSFULLY', 'Math expressions processed successfully');
    } catch (error) {
      log.error('KATEX', 'ERROR_PROCESSING_MATH', `Error processing math: ${error.message}`, error);
    }
    */
   log.debug('KATEX', 'SKIPPING_PROCESS_STEP', 'Skipping process step as markdown-it handles rendering.');
  }
  
  // Used by markdown-it system
  renderers() {
    return {
      code: codeRenderer,
      paragraph: paragraphRenderer
    };
  }
}

// Export the KaTeX plugin and its initialization function
export { init }; 