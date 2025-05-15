/**
 * Markdown Renderer (Using markdown-it)
 * 
 * Responsible for converting markdown to HTML with support for custom renderers
 * and extensions.
 */

import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify/dist/purify.es.js';
import { HighlightPlugin, init as initHighlight, customHighlightJsRenderer } from '/client/preview/plugins/highlight.js';
import { MermaidPlugin } from '/client/preview/plugins/mermaid.js';
import { GraphvizPlugin } from '/client/preview/plugins/graphviz.js';
import { getEnabledPlugins, isPluginEnabled } from '/client/preview/plugins/index.js';
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

// 'isInitialized' should track if loadMarkdownItScript and other one-time setups are done.
// let isBaseInitialized = false; // More descriptive name
// The global 'md' instance that was cached should likely be removed.

async function ensureBaseInitialized() {
    // This function replaces the old initializeRenderer's role of one-time setup
    if (typeof window.markdownit === 'undefined') {
        await loadMarkdownItScript();
        if (typeof window.markdownit === 'undefined') {
            const errorMsg = 'markdown-it library failed to load.';
            logRenderer(errorMsg, 'error');
            throw new Error(errorMsg);
        }
    }
    // Call other one-time initializations if needed, e.g., initHighlight()
    // if (!highlightJsInitialized) { await initHighlight(); highlightJsInitialized = true; }
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
    logRenderer('[InlineParser] Attempting to parse frontmatter (v5 - array focus)...', 'debug');
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
            let currentKey = null;
            let currentValue = []; // Used for block scalars
            let baseIndent = -1;
            let isParsingArray = false;
            let arrayKey = null;
            let arrayValues = []; // <<< Dedicated variable for array items

            lines.forEach(line => {
                const trimmedLine = line.trim();
                const currentIndent = line.search(/\S/);

                // Skip empty/comment lines
                if (!trimmedLine || trimmedLine.startsWith('#')) return;

                // --- Array Item Handling ---
                // If we are parsing an array AND the line starts with '-'
                if (isParsingArray && trimmedLine.startsWith('-')) {
                    const itemValue = trimmedLine.substring(1).trim();
                    const finalItem = (itemValue.startsWith('"') && itemValue.endsWith('"')) || (itemValue.startsWith("'") && itemValue.endsWith("'")) 
                                        ? itemValue.substring(1, itemValue.length - 1) 
                                        : itemValue;
                    arrayValues.push(finalItem); // <<< Add to dedicated array
                    return; // Handled as array item
                }

                // --- Block Scalar Handling ---
                // If we are parsing a block scalar AND indentation is sufficient
                if (currentKey && !isParsingArray && currentIndent >= baseIndent) { // Ensure not parsing array
                    if (baseIndent === -1) { baseIndent = currentIndent; }
                    currentValue.push(line.substring(baseIndent)); // Add to block scalar buffer
                    return; // Handled as block scalar content
                }

                // --- New Key-Value or Start of Array/Block or End of Array/Block --- 
                
                // Finalize previous entry IF this line signals a new entry (is not an array item or block scalar continuation)
                // Determine if previous entry needs finalizing
                let finalizePrevious = false;
                if (isParsingArray && (!trimmedLine.startsWith('-') || currentIndent < baseIndent)) { // End of array
                   finalizePrevious = true;
                } else if (currentKey && currentIndent < baseIndent) { // End of block scalar
                   finalizePrevious = true;
                } else if (!isParsingArray && !currentKey && line.includes(':')) { // New simple key-value potentially starts
                   finalizePrevious = true; // Finalize anything before starting new simple key
                }
                
                if(finalizePrevious){
                    if (isParsingArray && arrayKey) {
                        frontMatterData[arrayKey] = arrayValues; // <<< Assign from dedicated array
                        logRenderer(`[InlineParser] Finished array for key: ${arrayKey}: ${JSON.stringify(arrayValues)}`, 'debug');
                    } else if (currentKey) { // Finish block scalar
                        frontMatterData[currentKey] = currentValue.join('\n').trim();
                        logRenderer(`[InlineParser] Finished block scalar for key: ${currentKey}`, 'debug');
                    }
                    // Reset parsing state
                    isParsingArray = false;
                    arrayKey = null;
                    arrayValues = [];
                    currentKey = null;
                    currentValue = [];
                    baseIndent = -1;
                }

                // Now, process the current line to see if it STARTS a new entry
                const separatorIndex = line.indexOf(':');
                if (separatorIndex > 0 && !isParsingArray && !currentKey) { // Avoid processing if already mid-array/block
                    const key = line.substring(0, separatorIndex).trim();
                    let valueStr = line.substring(separatorIndex + 1).trim();

                    if ((key === 'js_includes' || key === 'css_includes') && valueStr === '') {
                        isParsingArray = true;
                        arrayKey = key;
                        arrayValues = []; // <<< Reset dedicated array
                        baseIndent = currentIndent + 1; // Expect items indented further
                        logRenderer(`[InlineParser] Starting array for key: ${key}`, 'debug');
                    } else if ((key === 'css' || key === 'script') && (valueStr === '|' || valueStr === '>')) {
                        currentKey = key;
                        currentValue = [];
                        baseIndent = -1; // Determine indent on next line
                        logRenderer(`[InlineParser] Starting block scalar for key: ${key}`, 'debug');
                    } else {
                        // Simple Key-Value
                        let parsedValue = valueStr;
                        // (Keep existing value parsing logic: quotes, boolean, number)
                        if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
                             parsedValue = valueStr.substring(1, valueStr.length - 1);
                        } else if (valueStr === 'true') { parsedValue = true; }
                        else if (valueStr === 'false') { parsedValue = false; }
                        else if (!isNaN(valueStr) && valueStr.trim() !== '') {
                             const num = Number(valueStr);
                             if (!isNaN(num)) { parsedValue = num; }
                        }
                        frontMatterData[key] = parsedValue;
                    }
                } else if (!isParsingArray && !currentKey) {
                    logRenderer(`[InlineParser] Skipping line (no colon or mid-array/block): ${line}`, 'warn');
                }
            }); // End of forEach loop

            // Finalize any open entry after the loop finishes
            if (isParsingArray && arrayKey) {
                frontMatterData[arrayKey] = arrayValues; // <<< Assign from dedicated array
                logRenderer(`[InlineParser] Finished array for key (end of block): ${arrayKey}: ${JSON.stringify(arrayValues)}`, 'debug');
            } else if (currentKey) {
                frontMatterData[currentKey] = currentValue.join('\n').trim();
                logRenderer(`[InlineParser] Finished block scalar for key (end of block): ${currentKey}`, 'debug');
            }

        } catch (error) {
            logRenderer(`[InlineParser] Error parsing frontmatter: ${error}`, 'error');
            frontMatterData = {}; // Reset on error
            markdownBody = markdownContent; // Use original content on error
        }
    } else {
         logRenderer('[InlineParser] No frontmatter block found.', 'debug');
    }

    logRenderer(`[InlineParser] FINAL Parsed Data: ${JSON.stringify(frontMatterData)}`, 'debug');
    return { frontMatter: frontMatterData, body: markdownBody };
}
// --- END: Inline Parser with Declarations ---

/**
 * Initialize the Markdown renderer with necessary extensions and options.
 */
async function initializeRenderer() {
    if (typeof window.markdownit === 'undefined') {
        await loadMarkdownItScript();
        if (typeof window.markdownit === 'undefined') {
            const errorMsg = 'markdown-it library failed to load.';
            logRenderer(errorMsg, 'error');
            throw new Error(errorMsg);
        }
    }
    logRenderer('Initializing Markdown renderer (markdown-it)...');
    
    try {
        // Load base libraries first (excluding AudioPlugin init)
        await Promise.all([
            initHighlight(),          
            loadMarkdownItScript(),   
        ]);
        logRenderer('Highlight.js, markdown-it loaded.');

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

        // Apply custom fence rule to the 'md' instance (used by initializeRenderer)
        // Note: This instance might not be the one used for actual rendering if getMarkdownItInstance() is called later.
        // It's kept here for potential direct use cases or historical reasons, but the primary fence rule 
        // application happens in getMarkdownItInstance() now.
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
                const outputHtml = `<div class="mermaid">${sanitizedCode}</div>`;
                logRenderer(`[FENCE RULE] Returning Mermaid HTML: ${outputHtml.substring(0, 100)}...`, 'debug');
                return outputHtml;
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
        logRenderer('Markdown renderer (markdown-it) initialized (v1 instance).');
    } catch (error) {
        logRenderer(`Error initializing markdown-it: ${error.message}`, 'error');
        console.error('[RENDERER INIT ERROR]', error);
        isInitialized = false; // Ensure it's marked as not initialized on error
    }
}

// Helper to safely join URL paths
function joinUrlPath(...parts) {
    // Simple join, assumes parts are already URI encoded if necessary
    // Removes extra slashes
    return parts.map(part => part.replace(/^\/+|\/+$/g, '')).filter(part => part).join('/');
}

// Keep the markdown-it initialization separate
let mdInstance;
async function getMarkdownItInstance(markdownFilePath) { // markdownFilePath might be optional
    logRenderer('[getMarkdownItInstance] Called - creating a new, dynamically configured instance.', 'debug');
    
    await ensureBaseInitialized(); // This should ensure window.markdownit and hljs (from initHighlight) are ready

    const currentMd = new window.markdownit({
        html: true,
        xhtmlOut: false,
        breaks: true,
        langPrefix: 'language-', // Crucial for CSS to pick up the language
        linkify: true,
        typographer: true,
        highlight: function (str, lang) {
            // Check if the 'highlight' plugin itself is enabled in your app's settings
            if (!isPluginEnabled('highlight')) {
                // If disabled, return the string unhighlighted but HTML-escaped
                return currentMd.utils.escapeHtml(str);
            }

            // Proceed with highlighting if the plugin is enabled
            if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
                try {
                    // If you have a custom wrapper like customHighlightJsRenderer, use it:
                    // return customHighlightJsRenderer(str, lang); 
                    
                    // Otherwise, the direct way:
                    const result = hljs.highlight(str, { language: lang, ignoreIllegals: true });
                    return result.value;
                } catch (error) {
                    logRenderer(`Error during syntax highlighting for lang '${lang}': ${error.message}`, 'error');
                    // Fallback to escaped HTML on error
                    return currentMd.utils.escapeHtml(str);
                }
            }
            // If no lang, or lang not supported by hljs, or hljs not loaded, return escaped.
            return currentMd.utils.escapeHtml(str);
        }
    });

    // Conditionally apply KaTeX
    if (isPluginEnabled('katex')) {
        logRenderer('[getMarkdownItInstance] KaTeX plugin is enabled. Applying markdown-it-katex.', 'debug');
        // Ensure markdownitKatex is imported and available
        currentMd.use(markdownitKatex);
    } else {
        logRenderer('[getMarkdownItInstance] KaTeX plugin is disabled. Not applying markdown-it-katex.', 'debug');
    }

    // ... (apply other markdown-it plugins like GFM, custom rules for ::: messages etc.)

    // --- BEGIN: Custom Mermaid Fence Renderer ---
    if (isPluginEnabled('mermaid')) {
        logRenderer('[getMarkdownItInstance] Mermaid plugin is enabled, applying custom fence rule for mermaid blocks.', 'debug');
        
        const defaultFenceRenderer = currentMd.renderer.rules.fence || function(tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        currentMd.renderer.rules.fence = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const langName = token.info ? token.info.trim().split(/\s+/g)[0] : '';

            if (langName === 'mermaid') {
                logRenderer(`[getMarkdownItInstance] Custom fence: Rendering "mermaid" block. Content length: ${token.content.length}`, 'debug');
                return `<div class="mermaid">\n${token.content.trim()}\n</div>\n`;
            }
            return defaultFenceRenderer(tokens, idx, options, env, self);
        };
    } else {
        logRenderer('[getMarkdownItInstance] Mermaid plugin is disabled, custom fence rule for mermaid NOT applied.', 'debug');
    }
    // --- END: Custom Mermaid Fence Renderer ---

    logRenderer('[getMarkdownItInstance] Returning newly configured instance.', 'debug');
    return currentMd;
}

/**
 * Renders the markdown content to HTML.
 * @param {string} markdownContent The raw markdown content including frontmatter.
 * @param {string} markdownFilePath The path of the source markdown file within pdata (e.g., 'my/folder/page.md').
 * @returns {Promise<string>} The full HTML document string.
 */
export async function renderMarkdown(markdownContent, markdownFilePath) {
    logRenderer(`[renderMarkdown] Called. Path: '${markdownFilePath || 'N/A'}'. MD content length: ${markdownContent?.length || 0}.`, 'debug');
    
    let contentToProcess = markdownContent || '';
    
    // Preprocessing for KaTeX (this should also respect the plugin state)
    if (isPluginEnabled('katex')) {
        logRenderer('[renderMarkdown] KaTeX plugin enabled, running preprocessKatexBlocks...', 'debug');
        contentToProcess = preprocessKatexBlocks(contentToProcess);
    } else {
        logRenderer('[renderMarkdown] KaTeX plugin disabled, skipping preprocessKatexBlocks.', 'debug');
    }

    const { frontMatter, body } = parseBasicFrontmatter(contentToProcess);
    logRenderer(`[renderMarkdown] Frontmatter parsed. Body content length for md.render(): ${body?.length || 0}.`, 'debug');

    const localMd = await getMarkdownItInstance(markdownFilePath); // Gets a fresh instance
    
    let htmlBody = '';
    try {
        htmlBody = localMd.render(body);
        logRenderer(`[renderMarkdown] After localMd.render(). Raw HTML body length: ${htmlBody.length}. Preview (50chars): '${htmlBody.substring(0, 50).replace(/\n/g, '')}'`, 'debug');
    } catch (renderError) {
        logRenderer(`[renderMarkdown] Error during localMd.render(): ${renderError}`, 'error');
        htmlBody = '<p>Error rendering Markdown content.</p>';
    }

    // ... (rest of your existing renderMarkdown logic for DOMPurify, asset injection, full page HTML construction)
    // For example:
    // const sanitizedHtmlBody = DOMPurify.sanitize(htmlBody, { /* ... DOMPurify options ... */ });
    // ... build headContent, fullPageHTML ...
    // return { html: sanitizedHtmlBody, head: headContent, fullPage: fullPageHTML, frontMatter };

    // This is a simplified return for now, ensure your actual return includes all necessary parts
    // The key is that 'localMd.render(body)' used a correctly configured instance.
    // Your existing logic for DOMPurify, asset path handling, and full HTML page assembly should follow.
    
    // Placeholder for the actual comprehensive return object structure:
    const sanitizedHtml = DOMPurify.sanitize(htmlBody, { USE_PROFILES: { html: true } });
    let headContent = ''; // Populate this based on frontMatter.css_includes or other needs
    
    // Example: Reconstruct head based on front matter or global settings
    if (frontMatter.css_includes && Array.isArray(frontMatter.css_includes)) {
        frontMatter.css_includes.forEach(cssPath => {
            // You'll need to resolve cssPath relative to markdownFilePath or a base assets path
            // and ensure it's a safe, valid path.
            // headContent += `<link rel="stylesheet" href="${resolvedCssPath}">\\n`;
        });
    }
    // Add KaTeX CSS if plugin is enabled (markdown-it-katex might not add it automatically)
    if (isPluginEnabled('katex')) {
        headContent += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css" integrity="sha384-Xi8rHCmBmhbuyyhbI88391ZKP2dmfnOl4rT9ZfRI7zTUXhFlZ_ZODrFoDRReqG3" crossorigin="anonymous">\n';
    }

    const fullPageHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-F-8">
    <title>Preview</title>
    ${headContent}
</head>
<body>
    ${sanitizedHtml}
    ${frontMatter.js_includes && Array.isArray(frontMatter.js_includes) ? 
        frontMatter.js_includes.map(jsPath => {
            // Resolve jsPath similarly to CSS
            // return `<script src="${resolvedJsPath}" type="module" defer></script>`;
            return ''; // Placeholder
        }).join('\\n') : ''
    }
</body>
</html>`;

    logRenderer(`[renderMarkdown] Returning result object. Keys: html, head, fullPage, frontMatter.`, 'debug');
    return {
        html: sanitizedHtml, // The sanitized body HTML
        head: headContent,   // Any dynamically added head content
        fullPage: fullPageHTML, // The full HTML document string
        frontMatter: frontMatter
    };
}

/**
 * Run post-processing steps after HTML is in the DOM.
 * @param {HTMLElement} previewElement - The element containing the rendered HTML.
 */
export async function postProcessRender(previewElement) {
    logRenderer(`[postProcessRender] Called for element: ${previewElement?.id || 'Unnamed element'}.`, 'info');
    if (!previewElement) {
        logRenderer('[postProcessRender] No preview element provided.', 'warn');
        return;
    }

    if (isPluginEnabled('mermaid')) {
        logRenderer('[postProcessRender] Mermaid plugin is enabled. Attempting processing...', 'debug');
        try {
            const mermaidInstance = getEnabledPlugins().get('mermaid');
            if (mermaidInstance && typeof mermaidInstance.process === 'function') {
                logRenderer('[postProcessRender] Calling MermaidPlugin.process()...', 'debug');
                await mermaidInstance.process(previewElement);
                logRenderer('[postProcessRender] MermaidPlugin.process() finished.', 'debug');
            } else {
                logRenderer('[postProcessRender] Mermaid plugin instance or process method not found.', 'warn');
            }
        } catch (e) {
            logRenderer(`[postProcessRender] Error during Mermaid processing: ${e.message}`, 'error');
        }
    } else {
        logRenderer('[postProcessRender] Mermaid plugin disabled.', 'debug');
    }

    if (isPluginEnabled('highlight')) {
        logRenderer('[postProcessRender] Highlight plugin is enabled. Main highlighting via md.options.highlight. Optional post-processing if needed.', 'debug');
        // const highlightInstance = getEnabledPlugins().get('highlight');
        // if (highlightInstance && typeof highlightInstance.postProcess === 'function') { // This signature was the issue
        //    await highlightInstance.postProcess(previewElement.innerHTML, previewElement);
        // }
        // OR use the module-level one if necessary:
        // await moduleLevelPostProcessFunctionFromHighlightJs(previewElement);
        // For now, let's comment out the specific highlight post-process here,
        // assuming md.options.highlight handles most cases.
    } else {
        logRenderer('[postProcessRender] Highlight.js plugin disabled.', 'debug');
    }

    logRenderer('[postProcessRender] Finished.', 'info');
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