/**
 * Markdown Renderer (Using markdown-it)
 * 
 * Responsible for converting markdown to HTML with support for custom renderers
 * and extensions.
 */

import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify/dist/purify.es.js';
import { HighlightPlugin, init as initHighlight } from '/client/preview/plugins/highlight.js';
import { MermaidPlugin } from '/client/preview/plugins/mermaid.js';
import { GraphvizPlugin } from '/client/preview/plugins/graphviz.js';
import { getEnabledPlugins } from '/client/preview/plugins/index.js';
import markdownitKatex from 'https://esm.sh/markdown-it-katex@2.0.3';
// import matter from 'https://esm.sh/gray-matter@4.0.3'; // REMOVED - Not browser compatible

// Helper for logging within this module
function logRenderer(message, level = 'debug') {
    const prefix = '[PREVIEW RENDERER]';
    const type = 'PREVIEW_RENDERER'; // Keep specific type
    if (typeof window.logMessage === 'function') {
        // Pass message, level, and type
        window.logMessage(`${prefix} ${message}`, level, type); 
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

// Function to load KaTeX Auto-Render JS (UNCOMMENT/RESTORE)
async function loadKatexAutoRenderScript() {
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
}

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

// --- REVISED AGAIN: Enhanced Inline Frontmatter Parser with Declarations ---
function parseBasicFrontmatter(markdownContent) {
    logRenderer('[InlineParser] Attempting to parse frontmatter (v3)...', 'debug');
    const fmRegex = /^---\s*([\s\S]*?)\s*---\s*/;
    const match = markdownContent.match(fmRegex);

    let frontMatterData = {};
    let markdownBody = markdownContent;

    if (match && match[1]) {
        const yamlContent = match[1];
        markdownBody = markdownContent.substring(match[0].length);
        logRenderer(`[InlineParser] Found frontmatter block. Length: ${yamlContent.length}`, 'debug');

        try {
            const lines = yamlContent.split('\n');
            // --- CORRECT DECLARATIONS ---
            let currentKey = null;
            let currentValue = [];
            let baseIndent = -1;
            // --- END CORRECT DECLARATIONS ---

            // Helper function defined within the scope
            function processLine(line) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('#')) return; // Skip empty/comments

                const separatorIndex = line.indexOf(':');
                if (separatorIndex > 0) {
                    const key = line.substring(0, separatorIndex).trim();
                    let value = line.substring(separatorIndex + 1).trim();

                    if (value === '|' || value === '>') {
                        if (key === 'css' || key === 'script') {
                            currentKey = key; // Assign to declared variable
                            currentValue = []; // Assign to declared variable
                            baseIndent = line.search(/\S/); // Assign to declared variable
                            logRenderer(`[InlineParser] Starting block scalar for key: ${key} at indent ${baseIndent}`, 'debug');
                        } else {
                            logRenderer(`[InlineParser] Block scalar indicator found for unsupported key: ${key}. Treating as empty.`, 'warn');
                            frontMatterData[key] = '';
                        }
                    } else {
                        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.substring(1, value.length - 1);
                        } else if (value === 'true') { value = true; }
                        else if (value === 'false') { value = false; }
                        else if (!isNaN(value) && value.trim() !== '') {
                            const num = Number(value);
                            if (!isNaN(num)) { value = num; }
                        }
                        frontMatterData[key] = value; // Assign to declared variable
                    }
                } else {
                    logRenderer(`[InlineParser] Skipping invalid line (no colon): ${line}`, 'warn');
                }
            } // End of processLine helper

            // Main processing loop
            lines.forEach(line => {
                // Check if currently capturing a block scalar
                if (currentKey && (line.trim() === '' || line.search(/\S/) >= baseIndent)) { // Adjusted check slightly >=
                     if (baseIndent === -1 && line.trim() !== '') { // Set base indent on first non-empty line of block
                          baseIndent = line.search(/\S/);
                          logRenderer(`[InlineParser] Setting baseIndent for ${currentKey} to ${baseIndent}`, 'debug');
                     }

                     if (line.trim() === '') {
                         currentValue.push(''); // Keep empty lines
                     } else {
                         // Add the line, preserving relative indentation
                         currentValue.push(line.substring(baseIndent));
                     }
                } else {
                    // If we were capturing a block, finish it before processing the new line
                    if (currentKey) {
                        frontMatterData[currentKey] = currentValue.join('\n').trim(); // Assign to declared variable
                        logRenderer(`[InlineParser] Finished block scalar for key: ${currentKey}`, 'debug');
                        currentKey = null; // Assign to declared variable
                        currentValue = []; // Assign to declared variable
                        baseIndent = -1; // Assign to declared variable
                    }
                    // Process the current line normally now (which might start a *new* block)
                    processLine(line);
                }
            }); // End of forEach loop

            // If we finished parsing while still capturing a block scalar
            if (currentKey) {
                frontMatterData[currentKey] = currentValue.join('\n').trim(); // Assign to declared variable
                 logRenderer(`[InlineParser] Finished final block scalar for key: ${currentKey}`, 'debug');
            }

            logRenderer(`[InlineParser] Parsed data keys: ${Object.keys(frontMatterData).join(', ')}`, 'debug');

        } catch (parseError) {
            logRenderer(`[InlineParser] Error parsing frontmatter YAML: ${parseError.message}`, 'error');
            console.error("Frontmatter Parse Error:", parseError);
            frontMatterData = {};
        }
    } else {
         logRenderer('[InlineParser] No frontmatter block found.', 'debug');
    }

    console.log("[InlineParser] Final Parsed Frontmatter Data:", JSON.stringify(frontMatterData, null, 2));
    return { frontMatter: frontMatterData, content: markdownBody };
}
// --- END: Inline Parser with Declarations ---

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

        // <<< ADDED: Ensure KaTeX auto-render script is loaded during initialization >>>
        try {
            await loadKatexAutoRenderScript();
            logRenderer('KaTeX auto-render script confirmed loaded.');
        } catch (error) {
            logRenderer('Failed to load KaTeX auto-render script during init.', 'error');
            // Continue initialization even if auto-render fails?
        }
        // <<< END ADDED >>>

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
            const content = token.content;
            logRenderer(`[FENCE RULE] Processing fence. Info: '${info}'`);

            if (info === 'mermaid') {
                logRenderer('[FENCE RULE] Identified as Mermaid block.');
                const code = token.content.trim();
                const sanitizedCode = code
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                return `<div class="mermaid">${sanitizedCode}</div>`;
            }

            // Handle DOT/Graphviz blocks
            if (info === 'dot' || info === 'graphviz') {
                logRenderer('[FENCE RULE] Identified as Graphviz DOT block.');
                const code = token.content.trim();
                const sanitizedCode = code
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                return `<div class="graphviz">${sanitizedCode}</div>`;
            }

            // Handle LaTeX blocks - especially tables
            if (info === 'latex' || info === 'katex' || info === 'tex') {
                logRenderer('Identified as LaTeX block.', "KATEX, FENCEE");
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
                        logRenderer('KaTeX not available', "KATEX, FENCE", 'error');
                        return `<pre><code>${token.content}</code></pre>`;
                    }
                } catch (err) {
                    logRenderer(`Error: ${err.message}`, "KATEX, FENCE", 'error');
                    return `<pre><code class="error">${token.content}</code></pre>`;
                }
            }

            // --- SVG Handling (Reverted) ---
            if (info === 'svg') {
                logRenderer('Identified as SVG block. Returning raw content.', "FENCE");
                try {
                    if (!content || typeof content !== 'string') {
                        logRenderer(`Invalid or non-string SVG content in block.`, "FENCE", "error");
                        return `<div class="error">Invalid SVG code block content</div>`;
                    }
                    // Return the raw SVG content. DOMPurify will handle sanitization later.
                    return content;
                } catch (error) {
                    logRenderer(`Error processing SVG content: ${error.message}`, "FENCE", "error");
                    console.error("SVG Fence Rule Error:", error);
                    return `<div class="error">Failed to process SVG code block</div>`;
                }
            }
            // --- END SVG Handling ---

            // Fallback to default fence renderer if no match
            return defaultFence(tokens, idx, options, env, self);
        };
        logRenderer('markdown-it extensions applied (fence override for mermaid/svg/katex).'); // Log updated

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
    // Ensure the renderer is initialized
    if (!isInitialized) {
        logRenderer('Renderer not initialized. Attempting initialization...', 'warning');
        await initializeRenderer();
        if (!isInitialized) {
            logRenderer('Renderer initialization failed. Cannot render.', 'error');
            return { html: '<p>Error: Markdown renderer failed to initialize.</p>', frontMatter: {} };
        }
    }

    logRenderer('Starting markdown rendering...');
    const { content: markdownBody, frontMatter: frontMatterData } = parseBasicFrontmatter(markdownContent);
    logRenderer(`Parsed frontmatter. Keys: ${Object.keys(frontMatterData).join(', ') || 'None'}`, 'debug');
    logRenderer(`Markdown body length: ${markdownBody.length}`, 'debug');

    let html = '';
    try {
        html = md.render(markdownBody);
        logRenderer('Markdown-it rendering complete.', 'debug');
    } catch (renderError) {
        logRenderer(`Markdown-it render error: ${renderError.message}`, 'error');
        html = `<p>Error rendering markdown: ${renderError.message}</p>`;
    }

    // --- SANITIZATION STEP --- 
    logRenderer('Applying DOMPurify sanitization...', 'debug');
    // // Temporarily disable DOMPurify for SVG debugging - RE-ENABLING
    try {
        html = DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true, svg: true }, // Enable SVG profile
            ADD_TAGS: [
                'script', 'iframe', 
                // SVG specific tags (add more as needed)
                'svg', 'path', 'circle', 'rect', 'text', 'g', 'defs', 'style', 'use', 'line', 'polyline', 'polygon', 'ellipse', 'image', 'foreignObject'
            ],
            ADD_ATTR: [
                'src', 'defer', 'width', 'height', 'id', 'allowfullscreen', 'frameborder',
                // SVG specific attributes (add more as needed)
                'viewBox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
                'transform', 'style', 'class', 'preserveAspectRatio', 'points', 'href', 'xlink:href' // Include common SVG attributes
            ]
        });
        logRenderer('DOMPurify sanitization complete.', 'debug');
        console.log('[PREVIEW RENDERER] HTML content AFTER DOMPurify:', html);
    } catch (sanitizeError) {
        logRenderer(`DOMPurify sanitize error: ${sanitizeError.message}`, 'error');
        html = `<p>Error sanitizing content: ${sanitizeError.message}</p>`;
    }
    // */
    // logRenderer('DOMPurify sanitization temporarily disabled for SVG debugging.', 'warn'); // Removed disable message
    // --- END SANITIZATION ---

    logRenderer('Markdown rendering process finished.');
    return { html, frontMatter: frontMatterData };
}

/**
 * Run post-processing steps after HTML is in the DOM.
 * @param {HTMLElement} previewElement - The element containing the rendered HTML.
 */
export async function postProcessRender(previewElement) {
    logRenderer('Running post-render processing...');
    if (!previewElement) {
        logRenderer('postProcessRender called with no previewElement.', 'error');
        return;
    }

    const enabledPlugins = getEnabledPlugins();
    // Correctly get names from Map values for logging
    const pluginNames = Array.from(enabledPlugins.values()).map(p => p.name).join(', '); 
    logRenderer(`Enabled plugins for post-processing: ${pluginNames}`);

    // --- KaTeX Rendering --- 
    if (typeof window.renderMathInElement === 'function') {
        logRenderer('Applying KaTeX rendering...');
        try {
            window.renderMathInElement(previewElement, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "$", right: "$", display: false},
                    // Keep original LaTeX delimiters if needed for compatibility
                    // {left: "\\(", right: "\\)", display: false},
                    // {left: "\\[", right: "\\]", display: true}
                ],
                throwOnError : false // Don't halt rendering on KaTeX error
            });
            logRenderer('KaTeX rendering applied.');
        } catch (error) {
            logRenderer(`KaTeX rendering failed: ${error.message}`, 'error');
            console.error("[KATEX RENDER ERROR]", error);
        }
    } else {
        logRenderer('KaTeX renderMathInElement function not available.', 'warning');
    }
    // --- End KaTeX Rendering ---

    // --- Mermaid Rendering --- 
    if (enabledPlugins.has('mermaid')) { 
        try {
            const mermaidPlugin = enabledPlugins.get('mermaid');
            if (mermaidPlugin) {
                mermaidPlugin.process(previewElement);
                logRenderer('Mermaid diagrams processed by plugin.', 'text');
            } else {
                logRenderer('Mermaid plugin not found in enabled plugins.', 'warn');
            }
        } catch (error) {
            logRenderer(`Error processing Mermaid diagrams: ${error.message}`, 'error');
        }
    } else {
        logRenderer('Mermaid plugin not enabled, attempting to initialize it directly.', 'text');
        // Try to initialize and use Mermaid plugin directly
        try {
            const mermaid = new MermaidPlugin();
            await mermaid.init();
            mermaid.process(previewElement);
            logRenderer('Mermaid diagrams processed with direct plugin instance.', 'text');
        } catch (error) {
            logRenderer(`Failed to process Mermaid diagrams: ${error.message}`, 'error');
        }
    }
    // --- END Mermaid Rendering ---

    // --- Graphviz Rendering --- 
    if (enabledPlugins.has('graphviz')) { 
        try {
            const graphvizPlugin = enabledPlugins.get('graphviz');
            if (graphvizPlugin) {
                graphvizPlugin.process(previewElement);
                logRenderer('Graphviz diagrams processed by plugin.', 'text');
            } else {
                logRenderer('Graphviz plugin not found in enabled plugins.', 'warn');
            }
        } catch (error) {
            logRenderer(`Error processing Graphviz diagrams: ${error.message}`, 'error');
        }
    } else {
        logRenderer('Graphviz plugin not enabled, attempting to initialize it directly.', 'text');
        // Try to initialize and use Graphviz plugin directly
        try {
            const graphviz = new GraphvizPlugin();
            await graphviz.init();
            graphviz.process(previewElement);
            logRenderer('Graphviz diagrams processed with direct plugin instance.', 'text');
        } catch (error) {
            logRenderer(`Failed to process Graphviz diagrams: ${error.message}`, 'error');
        }
    }
    // --- END Graphviz Rendering ---

    // --- Syntax Highlighting --- 
    try {
        const highlightPlugin = enabledPlugins.get('highlight');
        if (highlightPlugin && typeof highlightPlugin.postProcess === 'function') {
            await highlightPlugin.postProcess(previewElement);
            logRenderer('Code highlighting applied via postProcess.', 'text');
        } else if (highlightPlugin) {
            logRenderer(`Highlight plugin instance found, but postProcess method is missing!`, 'error');
        } else {
            logRenderer('Highlight plugin not found in enabled plugins.', 'warn');
        }
    } catch (error) {
        logRenderer(`Error applying syntax highlighting: ${error.message}`, 'error');
        console.error('[HIGHLIGHT PLUGIN ERROR]', error);
    }
    // --- END Syntax Highlighting ---
}

export class Renderer {
  constructor() {
    this.plugins = [
      new MermaidPlugin(),
      new GraphvizPlugin()
    ];
  }

  async render(content, element) {
    logRenderer('[DEPRECATED?] Renderer class render method called.', 'warning');
    const html = await renderMarkdown(content);
    element.innerHTML = html.html;
    this.plugins.forEach(plugin => {
      try {
        if (plugin instanceof MermaidPlugin) {
            plugin.process(element);
        } else if (plugin instanceof GraphvizPlugin) {
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