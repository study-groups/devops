/**
 * Markdown Renderer (Using markdown-it)
 * 
 * Responsible for converting markdown to HTML with support for custom renderers
 * and extensions.
 */

import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify/dist/purify.es.js';
import { HighlightPlugin, init as initHighlight } from '/client/preview/plugins/highlight.js';
import { MermaidPlugin } from '/client/preview/plugins/mermaid.js';
import { getEnabledPlugins } from '/client/preview/plugins/index.js';
import markdownitKatex from 'https://esm.sh/markdown-it-katex@2.0.3';

// Helper for logging within this module
function logRenderer(message, level = 'text') {
    const prefix = '[PREVIEW RENDERER]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

let isInitialized = false;
let md;

// Function to load KaTeX CSS (keep)
async function loadKatexCss() {
    return new Promise((resolve, reject) => {
        if (document.querySelector('link[href*="katex.min.css"]')) {
            logRenderer('KaTeX CSS already loaded.');
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
        link.onload = () => {
            logRenderer('KaTeX CSS loaded successfully from CDN.');
            resolve();
        };
        link.onerror = (err) => {
            logRenderer('Failed to load KaTeX CSS from CDN.', 'error');
            reject(err);
        };
        document.head.appendChild(link);
    });
}

// Function to load KaTeX JS (keep)
async function loadKatexScript() {
    return new Promise((resolve, reject) => {
        if (typeof window.katex !== 'undefined') {
            logRenderer('KaTeX JS already loaded.');
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js';
        script.async = true;
        script.onload = () => {
            logRenderer('KaTeX JS loaded successfully from CDN.');
            resolve();
        };
        script.onerror = (err) => {
            logRenderer('Failed to load KaTeX JS from CDN.', 'error');
            reject(err);
        };
        document.head.appendChild(script);
    });
}

// Function to dynamically load markdown-it script (keep this)
async function loadMarkdownItScript() {
    return new Promise((resolve, reject) => {
        if (typeof window.markdownit !== 'undefined') {
            logRenderer('markdown-it already loaded.');
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/markdown-it/dist/markdown-it.min.js';
        script.async = true;
        script.onload = () => {
            logRenderer('markdown-it script loaded successfully from CDN.');
            resolve();
        };
        script.onerror = (err) => {
            logRenderer('Failed to load markdown-it script from CDN.', 'error');
            reject(err);
        };
        document.head.appendChild(script);
    });
}

// Function to load KaTeX Auto-Render JS (COMMENT OUT/REMOVE)
/* async function loadKatexAutoRenderScript() {
    return new Promise((resolve, reject) => {
        if (typeof window.renderMathInElement !== 'undefined') {
            logRenderer('KaTeX Auto-Render JS already loaded.');
            resolve();
            return;
        }
        // Ensure KaTeX base is loaded first
        if (typeof window.katex === 'undefined') {
            logRenderer('KaTeX base not loaded before auto-render attempt.', 'error');
            return reject(new Error('KaTeX base missing for auto-render'));
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js';
        script.async = true;
        script.onload = () => {
            logRenderer('KaTeX Auto-Render JS loaded successfully from CDN.');
            if (typeof window.renderMathInElement === 'undefined') {
                logRenderer('window.renderMathInElement is STILL undefined after load!', 'error');
                reject(new Error('renderMathInElement not defined after script load'));
            } else {
                 resolve();
            }
        };
        script.onerror = (err) => {
            logRenderer('Failed to load KaTeX Auto-Render JS from CDN.', 'error');
            reject(err);
        };
        document.head.appendChild(script);
    });
} */

// Function to preprocess content for KaTeX blocks
function preprocessKatexBlocks(content) {
    let changed = false;
    logRenderer('[DEBUG] Running preprocessKatexBlocks...');
    
    // Match and process block math: \[ ... \]
    const blockRegex = /\\\[([\s\S]*?)\\\]/g; 
    let processedContent = content.replace(blockRegex, (match, formula) => {
        logRenderer('[DEBUG] BLOCK MATH MATCH FOUND! Content length: ' + formula.length);
        changed = true;
        return '$$' + formula + '$$'; 
    });
    
    // Match and process inline math: \( ... \)
    const inlineRegex = /\\\(([\s\S]*?)\\\)/g;
    processedContent = processedContent.replace(inlineRegex, (match, formula) => {
        logRenderer('[DEBUG] INLINE MATH MATCH FOUND! Content length: ' + formula.length);
        changed = true;
        return '$' + formula.trim() + '$';
    });
    
    if (changed) {
         logRenderer('Pre-processed markdown: Replaced math delimiters with KaTeX format');
    }
    return processedContent;
}

/**
 * Initialize the Markdown renderer with necessary extensions and options.
 */
async function initializeRenderer() {
    if (isInitialized) return;
    logRenderer('Initializing Markdown renderer (markdown-it)...');
    
    try {
        // Load base libraries first (excluding AudioPlugin init)
        await Promise.all([
            initHighlight(),          
            loadMarkdownItScript(),   
            loadKatexCss(),           
            loadKatexScript(),
        ]);
        logRenderer('Highlight.js, markdown-it, KaTeX base loaded.');

        // ALSO LOAD AUTO-RENDER - COMMENT OUT
        // await loadKatexAutoRenderScript();
        // logRenderer('KaTeX auto-render loaded.');

        // Check if markdown-it loaded successfully
        if (typeof window.markdownit === 'undefined') {
            throw new Error('markdown-it library failed to load or define window.markdownit.');
        }

        md = new window.markdownit({
            html: true,
            xhtmlOut: false,
            breaks: false,
            langPrefix: 'language-',
            linkify: true,
            typographer: false,
            highlight: null // Let highlight plugin handle this later if needed, or configure hljs here
        });

        // Apply KaTeX plugin - RE-ENABLE
        md.use(markdownitKatex, {
            throwOnError: false,
            errorColor: '#cc0000',
            trust: true,
            displayMode: false,
            strict: "ignore"
        });
        logRenderer('Applied KaTeX plugin with permissive error handling.');
        // logRenderer('Skipping markdown-it-katex plugin.'); // REMOVE/COMMENT OUT THIS LOG

        // Keep existing fence rule override for Mermaid/SVG/LaTeX
        const defaultFence = md.renderer.rules.fence;
        md.renderer.rules.fence = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const info = token.info ? token.info.trim().toLowerCase() : '';
            
            logRenderer(`[FENCE RULE] Processing fence. Info: '${info}'`);

            if (info === 'mermaid') {
                logRenderer('[FENCE RULE] Identified as Mermaid block.');
                const code = token.content.trim();
                const sanitizedCode = code
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                return `<div class="mermaid">${sanitizedCode}</div>`;
            }
            
            // Handle LaTeX blocks - especially tables
            if (info === 'latex') {
                logRenderer('[FENCE RULE] Identified as LaTeX block.');
                try {
                    if (window.katex) {
                        const html = window.katex.renderToString(token.content, {
                            displayMode: true,
                            throwOnError: false,
                            trust: true,
                            strict: false
                        });
                        return `<div class="katex-block">${html}</div>`;
                    } else {
                        logRenderer('[FENCE RULE] KaTeX not available', 'error');
                        return `<pre><code>${token.content}</code></pre>`;
                    }
                } catch (err) {
                    logRenderer(`[FENCE RULE] Error: ${err.message}`, 'error');
                    return `<pre><code class="error">${token.content}</code></pre>`;
                }
            }
            
            if (info === 'svg') {
                logRenderer('[FENCE RULE] Identified as SVG block.');
                return token.content;
            }

            return defaultFence(tokens, idx, options, env, self);
        };
        logRenderer('markdown-it extensions applied (fence override for mermaid/svg, katex).');

        isInitialized = true;
        logRenderer('Markdown renderer (markdown-it) initialized successfully.');
    } catch (error) {
        logRenderer(`Renderer initialization failed: ${error.message}`, 'error');
        console.error('[RENDERER INIT ERROR]', error);
    }
}

/**
 * Render Markdown content to safe HTML.
 * @param {string} markdownContent - The raw Markdown content.
 * @returns {Promise<string>} The rendered and sanitized HTML.
 */
export async function renderMarkdown(markdownContent) {
    // Log the raw input string
    console.log('--- KaTeX RAW INPUT DEBUG START ---');
    console.log(markdownContent);
    console.log('--- KaTeX RAW INPUT DEBUG END ---');

    if (!isInitialized) {
        await initializeRenderer();
        if (!isInitialized) {
            return '<p style="color:red;">Error: Markdown renderer failed to initialize.</p>';
        }
    }
    
    logRenderer(`Rendering markdown (length: ${markdownContent?.length || 0})`);
    
    try {
        // Preprocess LaTeX content for KaTeX compatibility
        const processedContent = preprocessKatexBlocks(markdownContent); 
        console.log('--- KaTeX AFTER PREPROCESS ---');
        console.log(processedContent);
        console.log('--- END KaTeX AFTER PREPROCESS ---');

        // Render markdown with the processed content
        const rawHtml = md.render(processedContent);
        logRenderer('Markdown parsed by markdown-it with KaTeX preprocessing.');
        
        // TEMPORARILY SKIP SANITIZATION FOR DEBUGGING
        // const cleanHtml = DOMPurify.sanitize(rawHtml, {
        //      USE_PROFILES: { 
        //          html: true, 
        //          svg: true,
        //          svgFilters: true
        //      },
        //      ADD_TAGS: ['iframe'], 
        // });
        // logRenderer('HTML sanitized.');
        const cleanHtml = rawHtml; // USE RAW HTML - UNSAFE FOR PRODUCTION
        logRenderer('[DEBUG] HTML sanitization SKIPPED.'); 
        
        return cleanHtml;
    } catch (error) {
        logRenderer(`Markdown rendering error: ${error.message}`, 'error');
        console.error('[MARKDOWN RENDER ERROR]', error);
        return `<p style="color:red; font-weight:bold;">Markdown Rendering Error:</p><pre style="color:red;">${error.message}</pre>`;
    }
}

/**
 * Run post-processing steps after HTML is in the DOM.
 * @param {HTMLElement} previewElement - The element containing the rendered HTML.
 */
export async function postProcessRender(previewElement) {
     if (!isInitialized) {
        logRenderer('Renderer not initialized, cannot post-process.', 'warn');
        return;
    }
    logRenderer('Running post-render processing...');
    try {
        // Log the HTML content BEFORE attempting to render math - REMOVE DEBUG LOGS
        // console.log('--- KaTeX PRE-RENDER DEBUG START ---');
        // console.log(previewElement.innerHTML);
        // console.log('--- KaTeX PRE-RENDER DEBUG END ---');

        // Call KaTeX auto-render AFTER HTML is in the DOM - COMMENT OUT
        /* if (typeof window.renderMathInElement === 'function') {
            renderMathInElement(previewElement, {
                 // ... delimiters ...
            });
            logRenderer('KaTeX renderMathInElement called.');
        } else {
            logRenderer('renderMathInElement function not found for post-processing.', 'warning');
        } */

        // Add other post-processing steps here if needed (e.g., for Mermaid, Highlight.js)
        // Example: If highlight.js needs explicit call after render:
        // if (window.hljs) {
        //     previewElement.querySelectorAll('pre code').forEach((block) => {
        //         window.hljs.highlightElement(block);
        //     });
        // }
        
    } catch (error) {
        logRenderer(`Post-processing error: ${error.message}`, 'error');
        console.error('[POST-PROCESS ERROR]', error);
    }
}

export class Renderer {
  constructor() {
    this.plugins = [
      new MermaidPlugin()
    ];
  }

  async render(content, element) {
    logRenderer('[DEPRECATED?] Renderer class render method called.', 'warning');
    const html = await renderMarkdown(content);
    element.innerHTML = html;
    this.plugins.forEach(plugin => {
      try {
        if (plugin instanceof MermaidPlugin) {
            plugin.process(element);
        } else {
            plugin.render?.(element); 
        }
      } catch (error) {
        console.error(`Plugin error:`, error);
      }
    });
  }
} 