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

console.log("%%%%% NEW RENDERER.JS LOADED - VERSION X %%%%%"); 

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

// --- BEGIN: Functions adapted from markdown-svg.js for size parsing ---
function parseSizeParameters(text, title) {
    let width = null;
    let height = null;

    const parseFrom = (str) => {
        if (!str) return {};
        let w = null;
        let h = null;
        const widthMatch = str.match(/(?:^|\s)(width|w)=(\d+)(px|%|em|rem)?/i);
        const heightMatch = str.match(/(?:^|\s)(height|h)=(\d+)(px|%|em|rem)?/i);
        if (widthMatch) w = widthMatch[2] + (widthMatch[3] || 'px');
        if (heightMatch) h = heightMatch[2] + (heightMatch[3] || 'px');
        return { w, h };
    };

    const altSizes = parseFrom(text);
    const titleSizes = parseFrom(title);

    width = titleSizes.w || altSizes.w; // Title overrides alt
    height = titleSizes.h || altSizes.h; // Title overrides alt

    let style = 'max-width:100%;';
    if (width) style += `width:${width}; `;
    if (height) style += `height:${height}; `;
    
    return { width, height, style };
}
// --- END: Functions adapted from markdown-svg.js ---

// Keep the markdown-it initialization separate
// let mdInstance; // REMOVE this global mdInstance, as getMarkdownItInstance creates fresh ones.
async function getMarkdownItInstance(markdownFilePath) { // markdownFilePath might be optional
    logRenderer('[getMarkdownItInstance] Called - creating a new, dynamically configured instance.', 'debug');
    
    await ensureBaseInitialized(); 

    const currentMd = new window.markdownit({
        html: true,
        xhtmlOut: false,
        breaks: true,
        langPrefix: 'language-', 
        linkify: true,
        typographer: true,
        highlight: function (str, lang) {
            logRenderer(`[Highlight] lang: '${lang}', str length: ${str.length}`);
            if (!isPluginEnabled('highlight')) {
                logRenderer('[Highlight] Highlighting disabled by plugin state.', 'debug');
                return currentMd.utils.escapeHtml(str);
            }
            if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
                try {
                    const result = hljs.highlight(str, { language: lang, ignoreIllegals: true });
                    logRenderer(`[Highlight] Result for '${lang}': ${result.value.substring(0,100)}...`);
                    return result.value;
                } catch (error) {
                    logRenderer(`Error during syntax highlighting for lang '${lang}': ${error.message}`, 'error');
                    return currentMd.utils.escapeHtml(str);
                }
            }
            logRenderer(`[Highlight] No specific highlighting for lang '${lang}'. Returning escaped HTML.`);
            return currentMd.utils.escapeHtml(str);
        }
    });

    if (isPluginEnabled('katex')) {
        logRenderer('[getMarkdownItInstance] KaTeX plugin is enabled. Applying markdown-it-katex.', 'debug');
        currentMd.use(markdownitKatex);
    } else {
        logRenderer('[getMarkdownItInstance] KaTeX plugin is disabled. Not applying markdown-it-katex.', 'debug');
    }

    if (isPluginEnabled('mermaid')) {
        logRenderer('[getMarkdownItInstance] Mermaid plugin is enabled, applying custom fence rule for mermaid blocks.', 'debug');
        
        const existingFenceRule = currentMd.renderer.rules.fence || function(tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        currentMd.renderer.rules.fence = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const langName = token.info ? token.info.trim().split(/\s+/g)[0].toLowerCase() : '';
            logRenderer(`[Fence Rule] lang: '${langName}'`);

            if (langName === 'mermaid') {
                logRenderer(`[getMarkdownItInstance] Custom fence: Rendering "mermaid" block. Content length: ${token.content.length}`, 'debug');
                return `<div class="mermaid">\n${token.content.trim()}\n</div>\n`;
            }
            // For all other languages (including 'svg'), fallback to the original fence renderer,
            // which will use the `highlight` function provided to markdown-it.
            const fallbackResult = existingFenceRule(tokens, idx, options, env, self);
            logRenderer(`[Fence Rule] Fallback result for '${langName}': ${fallbackResult.substring(0,100)}...`);
            return fallbackResult;
        };
    } else {
        logRenderer('[getMarkdownItInstance] Mermaid plugin is disabled, custom fence rule for mermaid NOT applied.', 'debug');
    }

    // --- BEGIN: SVG Handling for markdown-it (IMAGE RULE ONLY) ---
    const defaultImageRenderer = currentMd.renderer.rules.image || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    currentMd.renderer.rules.image = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const src = token.attrGet('src');
        const title = token.attrGet('title') || ''; 
        const alt = token.children && token.children[0] ? token.children[0].content : ''; 
        logRenderer(`[Image Rule] src: '${src}', alt: '${alt}', title: '${title}'`);

        if (src && src.toLowerCase().endsWith('.svg')) {
            logRenderer(`[getMarkdownItInstance] Custom image rule: Rendering SVG image from src: ${src}`, 'debug');
            const { width, height, style } = parseSizeParameters(alt, title);
            
            const dataWidth = width ? `data-width="${currentMd.utils.escapeHtml(width)}"` : '';
            const dataHeight = height ? `data-height="${currentMd.utils.escapeHtml(height)}"` : '';

            const outputHtml = `<div class="svg-container" data-src="${currentMd.utils.escapeHtml(src)}" ${dataWidth} ${dataHeight} style="${currentMd.utils.escapeHtml(style)}"></div>`;
            logRenderer(`[Image Rule] SVG image output: ${outputHtml}`);
            return outputHtml;
        }
        const defaultHtml = defaultImageRenderer(tokens, idx, options, env, self);
        logRenderer(`[Image Rule] Default image output for non-SVG: ${defaultHtml.substring(0, 100)}...`);
        return defaultHtml;
    };
    // --- END: SVG Handling for markdown-it (IMAGE RULE ONLY) ---

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
    
    let headContent = ''; // Initialize headContent
    let fullPageHtml = ''; // Initialize fullPageHtml

    let contentToProcess = markdownContent || '';
    
    // Preprocessing for KaTeX (this should also respect the plugin state)
    if (isPluginEnabled('katex')) {
        logRenderer('[renderMarkdown] KaTeX plugin enabled, running preprocessKatexBlocks...', 'debug');
        contentToProcess = preprocessKatexBlocks(contentToProcess);
    } else {
        logRenderer('[renderMarkdown] KaTeX plugin disabled, skipping preprocessKatexBlocks.', 'debug');
    }

    const { frontMatter: rawFrontMatter, body: markdownBody } = parseBasicFrontmatter(contentToProcess);
    logRenderer(`[renderMarkdown] Frontmatter parsed. Body content length for md.render(): ${markdownBody?.length || 0}.`, 'debug');

    const localMd = await getMarkdownItInstance(markdownFilePath);
    const htmlBodyRaw = localMd.render(markdownBody);
    logRenderer(`[renderMarkdown] After localMd.render(). Raw HTML body length: ${htmlBodyRaw.length}.`, 'debug');

    // ----- SCRIPT COLLECTION -----
    let collectedExternalScriptUrls = []; // Use a different name to avoid any confusion
    if (rawFrontMatter.js_includes && Array.isArray(rawFrontMatter.js_includes)) {
        collectedExternalScriptUrls = [...rawFrontMatter.js_includes];
        logRenderer(`[renderMarkdown] SUCCESSFULLY populated collectedExternalScriptUrls from js_includes. Count: ${collectedExternalScriptUrls.length}, Content: ${JSON.stringify(collectedExternalScriptUrls)}`, 'info');
    } else {
        if (!rawFrontMatter.js_includes) {
            logRenderer(`[renderMarkdown] rawFrontMatter.js_includes is missing or undefined.`, 'warn');
        } else {
            logRenderer(`[renderMarkdown] rawFrontMatter.js_includes is NOT an array. Type: ${typeof rawFrontMatter.js_includes}. Value: ${JSON.stringify(rawFrontMatter.js_includes)}`, 'warn');
        }
        logRenderer(`[renderMarkdown] collectedExternalScriptUrls remains empty.`, 'info');
    }
    
    const collectedInlineScriptContents = []; // Different name
    if (rawFrontMatter.script && typeof rawFrontMatter.script === 'string') {
        collectedInlineScriptContents.push(rawFrontMatter.script);
        logRenderer(`[renderMarkdown] SUCCESSFULLY added script from frontmatter block to collectedInlineScriptContents. New count: ${collectedInlineScriptContents.length}`, 'info');
    }

    let processedHtmlBody = htmlBodyRaw;
    let foundInlineScriptsInBodyCount = 0;
    try {
        const tempDoc = new DOMParser().parseFromString(htmlBodyRaw, 'text/html');
        const bodyScripts = tempDoc.body.querySelectorAll('script:not([src])');
        
        if (bodyScripts.length > 0) {
            logRenderer(`[renderMarkdown] Found ${bodyScripts.length} inline <script> tags in Markdown body.`, 'debug');
            bodyScripts.forEach(scriptTag => {
                if (scriptTag.textContent) {
                    collectedInlineScriptContents.push(scriptTag.textContent);
                    foundInlineScriptsInBodyCount++;
                }
                scriptTag.remove(); 
            });
            processedHtmlBody = tempDoc.body.innerHTML; 
            logRenderer(`[renderMarkdown] Extracted and removed ${foundInlineScriptsInBodyCount} inline script(s) from HTML body. collectedInlineScriptContents count: ${collectedInlineScriptContents.length}`, 'debug');
        } else {
            logRenderer(`[renderMarkdown] No inline <script> tags found in Markdown body.`, 'debug');
        }
    } catch (e) {
        logRenderer(`[renderMarkdown] Error processing/removing inline scripts from HTML body: ${e}`, 'error');
        processedHtmlBody = htmlBodyRaw; 
    }
    
    // ----- DOMPURIFY -----
    // Ensure 'script' is NOT in ADD_TAGS
    const DYNAMIC_CONFIG = { /* your full config here, ensuring script is not in ADD_TAGS */ 
        ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'track', 'style', 'link', 'meta', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'div', 'span', 'p', 'pre', 'code', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'a', 'br', 'hr', 'em', 'strong', 'del', 'ins', 'blockquote', 'figure', 'figcaption'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'srcdoc', 'target', 'rel', 'type', 'href', 'media', 'charset', 'name', 'content', 'property', 'http-equiv', 'open', 'id', 'class', 'style', 'width', 'height', 'alt', 'title', 'datetime', 'cite', 'lang', 'start', 'value', 'colspan', 'rowspan', 'scope', 'placeholder', 'required', 'disabled', 'checked', 'selected', 'autoplay', 'controls', 'loop', 'muted', 'poster', 'preload', 'reversed', 'for', 'accept', 'max', 'min', 'step', 'pattern', 'maxlength', 'minlength', 'readonly', 'spellcheck', 'draggable', 'contenteditable'],
        FORCE_BODY: false, 
        ALLOW_DATA_ATTR: true,
        ALLOW_UNKNOWN_PROTOCOLS: true, 
        WHOLE_DOCUMENT: false, 
        SAFE_FOR_TEMPLATES: false, 
        USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
        ALLOW_ARIA_ATTR: true, 
        ALLOW_COMMENTS: true,
    };
    const finalHtmlBody = DOMPurify.sanitize(processedHtmlBody, DYNAMIC_CONFIG);
    logRenderer(`[renderMarkdown] Sanitized HTML length: ${finalHtmlBody.length}`, 'info');

    if (finalHtmlBody.includes('alert("hello")')) {
        logRenderer('[renderMarkdown] DEBUG ALERT CHECK: Script "alert(\\"hello\\")" IS STILL PRESENT in finalHtmlBody AFTER script removal and DOMPurify.', 'warn');
    } else {
        logRenderer('[renderMarkdown] DEBUG ALERT CHECK: Script "alert(\\"hello\\")" is NOT present in finalHtmlBody (as expected).', 'info');
    }
    
    // Potentially, if frontmatter contains CSS links or inline styles meant for the head,
    // they could be appended to `headContent` here.
    // For example:
    // if (rawFrontMatter && rawFrontMatter.css_includes) {
    //   rawFrontMatter.css_includes.forEach(cssPath => {
    //     const resolvedCssPath = joinUrlPath(basePath, cssPath.path || cssPath);
    //     headContent += `<link rel="stylesheet" href="${resolvedCssPath}">\\n`;
    //   });
    // }
    // if (rawFrontMatter && rawFrontMatter.inline_css) {
    //   headContent += `<style>${rawFrontMatter.inline_css}</style>\\n`;
    // }

    // ----- LOGGING BEFORE RETURN -----
    logRenderer(`[renderMarkdown] FINAL PRE-RETURN CHECK: collectedExternalScriptUrls = ${JSON.stringify(collectedExternalScriptUrls)}, Count: ${collectedExternalScriptUrls.length}`, 'info');
    logRenderer(`[renderMarkdown] FINAL PRE-RETURN CHECK: collectedInlineScriptContents (count) = ${collectedInlineScriptContents.length}`, 'info');
    collectedInlineScriptContents.forEach((content, idx) => {
        logRenderer(`[renderMarkdown] FINAL PRE-RETURN CHECK: collectedInlineScriptContents[${idx}] (length) = ${content.length}, Preview: ${content.substring(0,50).replace(/\\n/g,'')}`, 'info');
    });
    
    const result = {
        html: finalHtmlBody,
        head: headContent,
        fullPage: fullPageHtml,
        frontMatter: rawFrontMatter,
        externalScriptUrls: collectedExternalScriptUrls,
        inlineScriptContents: collectedInlineScriptContents
    };
    
    logRenderer(`[renderMarkdown] Returning result object. Keys: ${Object.keys(result).join(', ')}. External script URLs: ${result.externalScriptUrls?.length}, Inline script contents: ${result.inlineScriptContents?.length}.`, 'info');
    return result;
}

// Basic path joining utility
function simpleJoinPath(base, relative) {
    const baseParts = base.split('/').filter(p => p && p !== '.');
    // If base is a file path (e.g., 'foo/bar.md'), get its directory ('foo/')
    // Handles cases where base might already be a directory path (e.g., 'foo/bar/')
    if (baseParts.length > 0 && base.includes('.') && base.lastIndexOf('.') > base.lastIndexOf('/')) {
        baseParts.pop(); // Remove filename part
    }

    const relativeParts = relative.split('/');
    
    for (const part of relativeParts) {
        if (part === '..') {
            if (baseParts.length > 0) {
                baseParts.pop();
            }
        } else if (part && part !== '.') {
            baseParts.push(part);
        }
    }
    return baseParts.join('/');
}

/**
 * Run post-processing steps after HTML is in the DOM.
 * @param {HTMLElement} previewElement - The element containing the rendered HTML.
 * @param {Array<string|object>} externalScriptUrls - URLs or path objects for external scripts.
 * @param {Array<string>} inlineScriptContents - Strings of inline script code.
 * @param {string} [markdownFilePath=''] - The path of the markdown file being rendered.
 */
export async function postProcessRender(previewElement, externalScriptUrls = [], inlineScriptContents = [], markdownFilePath = '') {
    logRenderer(`[postProcessRender] Called for element: ${previewElement ? previewElement.id : 'null'}. External scripts: ${externalScriptUrls.length}, Inline scripts: ${inlineScriptContents.length}. Path: '${markdownFilePath}'`);

    if (!previewElement) {
        logRenderer('[postProcessRender] Preview element is null. Skipping post-processing.', 'warn');
        return;
    }

    const { appStore } = window; 
    if (!appStore || !appStore.getState) {
        logRenderer('[postProcessRender] appStore is not available. Cannot resolve relative script paths.', 'error');
    }

    let fetchedExternalScripts = [];

    if (externalScriptUrls && externalScriptUrls.length > 0) {
        logRenderer(`[postProcessRender] Fetching ${externalScriptUrls.length} external scripts... Base dir for relative paths derived from: '${markdownFilePath}'`);
        const scriptPromises = externalScriptUrls.map(scriptUrlOrPath => {
            const trimmedUrl = scriptUrlOrPath.trim();
            let finalFetchUrl = trimmedUrl;
            const scriptName = trimmedUrl.substring(trimmedUrl.lastIndexOf('/') + 1);
            logRenderer(`[postProcessRender] Processing scriptUrlOrPath: '${trimmedUrl}'`);


            if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
                // Branch A: Absolute URL
                logRenderer(`[postProcessRender] Branch A: Absolute URL: '${trimmedUrl}'`);
                // finalFetchUrl is already absolute
            } else if (trimmedUrl.startsWith('/')) {
                // Branch B: Root-relative path
                logRenderer(`[postProcessRender] Branch B: Root-relative path: '${trimmedUrl}'`);
                finalFetchUrl = new URL(trimmedUrl, window.location.origin).href;
            } else if ((trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) && markdownFilePath) {
                // Branch C: Relative path, resolve against markdownFilePath using pdata API
                logRenderer(`[postProcessRender] Branch C: Relative path. markdownFilePath: '${markdownFilePath}'`);
                const pdataFilePathDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/'));
                // Note: simpleJoinPath ensures no double slashes and correct joining.
                const resolvedPDataPath = simpleJoinPath(pdataFilePathDir, trimmedUrl);
                finalFetchUrl = `/api/pdata/read?file=${encodeURIComponent(resolvedPDataPath)}`;
                logRenderer(`[postProcessRender] Branch C: Resolved PData path: '${resolvedPDataPath}'. finalFetchUrl: ${finalFetchUrl}`);
            } else {
                // Branch D: Fallback or ambiguous path - try resolving against current page, then root.
                // This branch might need refinement based on actual use cases.
                logRenderer(`[postProcessRender] Branch D: Fallback/Ambiguous path: '${trimmedUrl}'. Attempting to resolve.`);
                try {
                    finalFetchUrl = new URL(trimmedUrl, window.location.href).href; // Try relative to current page
                    logRenderer(`[postProcessRender] Branch D: Resolved against current page: '${finalFetchUrl}'`);
                } catch (e) {
                    try {
                        finalFetchUrl = new URL(trimmedUrl, window.location.origin).href; // Try relative to root
                        logRenderer(`[postProcessRender] Branch D: Resolved against root: '${finalFetchUrl}'`);
                    } catch (e2) {
                         logRenderer(`[postProcessRender] Branch D: Could not resolve ambiguous path '${trimmedUrl}'. Using as is. Error: ${e2.message}`, 'warn');
                         // finalFetchUrl remains trimmedUrl, hoping it's a direct server path.
                    }
                }
            }
            logRenderer(`[postProcessRender] Attempting to fetch: ${finalFetchUrl}`);
            return fetch(finalFetchUrl)
                .then(response => {
                    if (!response.ok) {
                        logRenderer(`[postProcessRender] Failed to fetch external script: ${finalFetchUrl} - Status: ${response.status}`, 'error');
                        return { name: scriptName, url: finalFetchUrl, content: `console.error("Failed to load ${finalFetchUrl}: ${response.status}");`, error: true };
                    }
                    return response.text().then(text => {
                         logRenderer(`[postProcessRender] Fetched and added script from: ${finalFetchUrl} (length: ${text.length})`);
                        return { name: scriptName, url: finalFetchUrl, content: text, error: false };
                    });
                })
                .catch(error => {
                    logRenderer(`[postProcessRender] Network error fetching external script: ${finalFetchUrl} - ${error.message}`, 'error');
                    return { name: scriptName, url: finalFetchUrl, content: `console.error("Network error loading ${finalFetchUrl}: ${error.message}");`, error: true };
                });
        });

        fetchedExternalScripts = await Promise.all(scriptPromises);
    }

    // ** MODIFIED SCRIPT BUNDLING LOGIC **
    let scriptParts = [];

    fetchedExternalScripts.forEach(script => {
        if (script && typeof script.content === 'string') {
            const trimmedContent = script.content.trim();
            if (trimmedContent) {
                scriptParts.push(trimmedContent);
                logRenderer(`[postProcessRender] Added EXTERNAL script from "${script.url}" (trimmed length: ${trimmedContent.length}) to bundle parts. Preview (100 chars): ${trimmedContent.substring(0,100)}`);
            } else {
                 logRenderer(`[postProcessRender] Skipped empty external script from "${script.url}" after trimming.`, 'warn');
            }
        } else {
            logRenderer(`[postProcessRender] Skipped invalid external script object or content for URL: ${script ? script.url : 'unknown'}.`, 'warn');
        }
    });

    const currentInlineScriptContents = inlineScriptContents || [];
    currentInlineScriptContents.forEach((content, i) => {
        if (content && typeof content === 'string') {
            const trimmedContent = content.trim();
            if (trimmedContent) {
                scriptParts.push(trimmedContent);
                logRenderer(`[postProcessRender] Added INLINE script #${i+1} (trimmed length: ${trimmedContent.length}) to bundle parts. Preview (100 chars): ${trimmedContent.substring(0,100)}`);
            } else {
                logRenderer(`[postProcessRender] Skipped empty inline script #${i+1} after trimming.`, 'warn');
            }
        } else {
            logRenderer(`[postProcessRender] Skipped invalid inline script content at index ${i}. Content type: ${typeof content}`, 'warn');
        }
    });

    // Join script parts with a semicolon and a newline
    const bundledScriptContent = scriptParts.join(";\n");
    // ** END MODIFIED SCRIPT BUNDLING LOGIC **

    if (bundledScriptContent.trim() !== '') {
        // The detailed logging for bundledScriptContent you requested previously:
        logRenderer(`[postProcessRender] FINAL SCRIPT BUNDLE about to be appended (length: ${bundledScriptContent.length}):\n------------ START BUNDLE ------------\n${bundledScriptContent}\n------------- END BUNDLE -------------`);


        const scriptElement = document.createElement('script');
        scriptElement.type = 'text/javascript';
        try {
            scriptElement.textContent = bundledScriptContent;
            logRenderer(`[postProcessRender] Created script element. Text content preview (100chars): '${bundledScriptContent.substring(0,100)}'`);
        } catch (e) {
            logRenderer(`[postProcessRender] Error setting textContent for script: ${e.message}. Bundled content preview (first 200 chars): ${bundledScriptContent.substring(0,200)}`, 'error');
            return; 
        }

        if (previewElement && typeof previewElement.appendChild === 'function') {
            logRenderer(`[postProcessRender] previewElement is valid. About to appendChild.`);
            try {
                previewElement.appendChild(scriptElement); 
                logRenderer(`[postProcessRender] Successfully created and appended bundled script to previewElement.`);
            } catch (e) {
                logRenderer(`[postProcessRender] Error appending script to previewElement: ${e.message}. Node name: ${scriptElement.nodeName}, Type: ${scriptElement.type}, Content preview (first 200 chars): ${scriptElement.textContent.substring(0,200)}`, 'error');
            }
        } else {
            logRenderer(`[postProcessRender] previewElement is invalid or appendChild is not a function. Cannot append script.`, 'warn');
        }
    } else {
        logRenderer(`[postProcessRender] No scripts (external or inline) to bundle or execute after trimming.`);
    }

    // Mermaid processing
    if (isPluginEnabled('mermaid')) {
        logRenderer('[postProcessRender] Mermaid plugin is enabled. Attempting processing...');
        if (window.mermaid && typeof window.mermaid.run === 'function') {
            try {
                await window.mermaid.run({
                    nodes: Array.from(previewElement.querySelectorAll('.mermaid')),
                });
                logRenderer('[postProcessRender] Mermaid processing completed via mermaid.run().');
            } catch (error) {
                logRenderer(`[postProcessRender] Error during Mermaid processing: ${error.message}`, 'error');
            }
        } else if (MermaidPlugin && typeof MermaidPlugin.process === 'function') {
            MermaidPlugin.process(previewElement); 
            logRenderer('[postProcessRender] Mermaid processing called via MermaidPlugin.process().');
        }
         else {
            logRenderer('[postProcessRender] MermaidPlugin.process function not found or mermaid.run not available. Mermaid diagrams may not render.', 'warn');
        }
    } else {
        logRenderer('[postProcessRender] Mermaid plugin is NOT enabled.');
    }

    if (isPluginEnabled('highlight')) {
        logRenderer('[postProcessRender] Highlight plugin is enabled. Main highlighting via md.options.highlight. Optional post-processing if needed.');
    }

    logRenderer(`[postProcessRender] Finished.`);
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