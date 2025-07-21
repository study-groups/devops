/**
 * Markdown Renderer (Using markdown-it)
 * 
 * Responsible for converting markdown to HTML with support for custom renderers
 * and extensions.
 */

import DOMPurify from '/client/vendor/scripts/dompurify.es.js';
import { HighlightPlugin, init as initHighlight } from '/client/preview/plugins/highlight.js';
import { MermaidPlugin } from '/client/preview/plugins/mermaid/index.js';
import { GraphvizPlugin } from '/client/preview/plugins/graphviz.js';
import { getEnabledPlugins } from '/client/preview/plugins/index.js';
import { appStore } from '/client/appState.js';
import { getIsPluginEnabled } from '/client/store/selectors.js';
import { pluginManager } from '/client/preview/PluginManager.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('PreviewRenderer');

let spacesConfig = null;

async function fetchSpacesConfig() {
    if (spacesConfig) return spacesConfig;
    try {
        const response = await window.APP.services.globalFetch('/api/spaces/config');
        if (response.ok) {
            const data = await response.json();
            spacesConfig = data.config;
            log.info('PREVIEW', 'SPACES_CONFIG_LOADED', `[Spaces Config] Loaded: ${spacesConfig.publishBaseUrlValue}`);
            return spacesConfig;
        }
    } catch (error) {
        log.error('PREVIEW', 'SPACES_CONFIG_FAILED', `[Spaces Config] Failed to load: ${error.message}`, error);
    }
    return null;
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
            log.error('PREVIEW', 'MARKDOWNIT_LOAD_FAILED', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
    // Auto-load highlight.js if highlighting is enabled
    if (!window.hljs && isPluginEnabled('highlight')) {
        log.info('PREVIEW', 'HIGHLIGHTJS_LOAD_START', 'Loading highlight.js for syntax highlighting...');
        try {
            await loadHighlightJS();
            log.info('PREVIEW', 'HIGHLIGHTJS_LOAD_SUCCESS', 'highlight.js loaded successfully');
        } catch (error) {
            log.error('PREVIEW', 'HIGHLIGHTJS_LOAD_FAILED', `Failed to load highlight.js: ${error.message}`, error);
        }
    }
}

// Function to dynamically load markdown-it script (keep this)
async function loadMarkdownItScript() {
    return new Promise((resolve, reject) => {
        if (typeof window.markdownit !== 'undefined') {
            log.info('PREVIEW', 'MARKDOWNIT_ALREADY_LOADED', 'markdown-it already loaded.');
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = '/client/vendor/scripts/markdown-it.min.js';
        script.async = true;
        script.onload = () => {
            log.info('PREVIEW', 'MARKDOWNIT_LOADED', 'markdown-it script loaded successfully from CDN.');
            resolve();
        };
        script.onerror = (err) => {
            log.error('PREVIEW', 'MARKDOWNIT_LOAD_FAILED', 'Failed to load markdown-it script from CDN.', err);
            reject(err);
        };
        document.head.appendChild(script);
    });
}

// Function to preprocess content for KaTeX blocks
function preprocessKatexBlocks(content) {
    let changed = false;
    log.debug('PREVIEW', 'KATEX_PREPROCESS_START', '[DEBUG] Running preprocessKatexBlocks...');
    
    // Match and process block math: \[ ... \]
    const blockRegex = /\\\[([\s\S]*?)\\\]/g; 
    let processedContent = content.replace(blockRegex, (match, formula) => {
        log.debug('PREVIEW', 'KATEX_BLOCK_MATCH', `[DEBUG] BLOCK MATH MATCH FOUND! Content length: ${formula.length}`);
        changed = true;
        return '$$' + formula + '$$'; 
    });
    
    // Match and process inline math: \( ... \)
    const inlineRegex = /\\\(([\s\S]*?)\\\)/g;
    processedContent = processedContent.replace(inlineRegex, (match, formula) => {
        log.debug('PREVIEW', 'KATEX_INLINE_MATCH', `[DEBUG] INLINE MATH MATCH FOUND! Content length: ${formula.length}`);
        changed = true;
        return '$' + formula.trim() + '$';
    });
    
    if (changed) {
         log.info('PREVIEW', 'KATEX_PREPROCESS_COMPLETE', 'Pre-processed markdown: Replaced math delimiters with KaTeX format');
    }
    return processedContent;
}

// --- REVISED AGAIN: Enhanced Inline Frontmatter Parser with Declarations ---
function parseBasicFrontmatter(markdownContent) {
    log.debug('PREVIEW', 'FRONTMATTER_PARSE_START', '[InlineParser] Attempting to parse frontmatter (v5 - array focus)...');
    const fmRegex = /^---\s*([\s\S]*?)\s*---\s*/;
    const match = markdownContent.match(fmRegex);

    let frontMatterData = {};
    let markdownBody = markdownContent;

    if (match && match[1]) {
        const yamlContent = match[1];
        markdownBody = markdownContent.substring(match[0].length);
        log.debug('PREVIEW', 'FRONTMATTER_FOUND', `[InlineParser] Found frontmatter block. Length: ${yamlContent.length}`);

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
                        log.debug('PREVIEW', 'FRONTMATTER_ARRAY_PARSED', `[InlineParser] Finished array for key: ${arrayKey}: ${JSON.stringify(arrayValues)}`);
                    } else if (currentKey) { // Finish block scalar
                        frontMatterData[currentKey] = currentValue.join('\n').trim();
                        log.debug('PREVIEW', 'FRONTMATTER_BLOCK_SCALAR_PARSED', `[InlineParser] Finished block scalar for key: ${currentKey}`);
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
                        log.debug('PREVIEW', 'FRONTMATTER_ARRAY_START', `[InlineParser] Starting array for key: ${key}`);
                    } else if ((key === 'css' || key === 'script') && (valueStr === '|' || valueStr === '>')) {
                        currentKey = key;
                        currentValue = [];
                        baseIndent = -1; // Determine indent on next line
                        log.debug('PREVIEW', 'FRONTMATTER_BLOCK_SCALAR_START', `[InlineParser] Starting block scalar for key: ${key}`);
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
                    log.warn('PREVIEW', 'FRONTMATTER_PARSE_SKIP_LINE', `[InlineParser] Skipping line (no colon or mid-array/block): ${line}`);
                }
            }); // End of forEach loop

            // Finalize any open entry after the loop finishes
            if (isParsingArray && arrayKey) {
                frontMatterData[arrayKey] = arrayValues; // <<< Assign from dedicated array
                log.debug('PREVIEW', 'FRONTMATTER_ARRAY_PARSED_FINAL', `[InlineParser] Finished array for key (end of block): ${arrayKey}: ${JSON.stringify(arrayValues)}`);
            } else if (currentKey) {
                frontMatterData[currentKey] = currentValue.join('\n').trim();
                log.debug('PREVIEW', 'FRONTMATTER_BLOCK_SCALAR_PARSED_FINAL', `[InlineParser] Finished block scalar for key (end of block): ${currentKey}`);
            }

        } catch (error) {
            log.error('PREVIEW', 'FRONTMATTER_PARSE_FAILED', `[InlineParser] Error parsing frontmatter: ${error}`, error);
            frontMatterData = {}; // Reset on error
            markdownBody = markdownContent; // Use original content on error
        }
    } else {
         log.debug('PREVIEW', 'FRONTMATTER_NOT_FOUND', '[InlineParser] No frontmatter block found.');
    }

    log.debug('PREVIEW', 'FRONTMATTER_PARSE_COMPLETE', `[InlineParser] FINAL Parsed Data: ${JSON.stringify(frontMatterData)}`);
    return { frontMatter: frontMatterData, body: markdownBody };
}
// --- END: Inline Parser with Declarations ---

// Note: Mermaid initialization is now handled by PluginLoader system
// No need for global plugin instances or legacy init functions

/**
 * Initialize the Markdown renderer with necessary extensions and options.
 */
async function initializeRenderer() {
    if (typeof window.markdownit === 'undefined') {
        await loadMarkdownItScript();
        if (typeof window.markdownit === 'undefined') {
            const errorMsg = 'markdown-it library failed to load.';
            log.error('PREVIEW', 'MARKDOWNIT_LOAD_FAILED', errorMsg);
            throw new Error(errorMsg);
        }
    }
    log.info('PREVIEW', 'MARKDOWNIT_INIT_START', 'Initializing Markdown renderer (markdown-it)...');
    
    try {
        // Load base libraries first (excluding AudioPlugin init)
        await Promise.all([
            initHighlight(),          
            loadMarkdownItScript(),   
        ]);
        log.info('PREVIEW', 'MARKDOWNIT_LIBS_LOADED', 'Highlight.js, markdown-it loaded.');

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
            log.debug('PREVIEW', 'FENCE_RULE_PROCESSING', `[FENCE RULE] Processing fence. Info: '${info}'`);

            if (info === 'mermaid') {
                log.debug('PREVIEW', 'FENCE_RULE_MERMAID', '[FENCE RULE] Identified as Mermaid block.');
                const code = token.content.trim();
                const sanitizedCode = code
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const outputHtml = `<div class="mermaid">${sanitizedCode}</div>`;
                log.debug('PREVIEW', 'FENCE_RULE_MERMAID_HTML', `[FENCE RULE] Returning Mermaid HTML: ${outputHtml.substring(0, 100)}...`);
                return outputHtml;
            }

            // Handle DOT/Graphviz blocks
            if (info === 'dot' || info === 'graphviz') {
                log.debug('PREVIEW', 'FENCE_RULE_GRAPHVIZ', '[FENCE RULE] Identified as Graphviz DOT block.');
                const code = token.content.trim();
                const sanitizedCode = code
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                return `<div class="graphviz">${sanitizedCode}</div>`;
            }

            // Handle LaTeX blocks - especially tables
            if (info === 'latex' || info === 'katex' || info === 'tex') {
                log.info('PREVIEW', 'FENCE_RULE_LATEX', 'Identified as LaTeX block.');
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
                        log.error('PREVIEW', 'FENCE_RULE_LATEX_KATEX_MISSING', 'KaTeX not available');
                        return `<pre><code>${token.content}</code></pre>`;
                    }
                } catch (err) {
                    log.error('PREVIEW', 'FENCE_RULE_LATEX_ERROR', `Error: ${err.message}`, err);
                    return `<pre><code class="error">${token.content}</code></pre>`;
                }
            }

            // --- SVG Handling (Reverted) ---
            if (info === 'svg') {
                log.info('PREVIEW', 'FENCE_RULE_SVG', 'Identified as SVG block. Returning raw content.');
                try {
                    if (!content || typeof content !== 'string') {
                        log.error('PREVIEW', 'FENCE_RULE_SVG_INVALID_CONTENT', 'Invalid or non-string SVG content in block.');
                        return `<div class="error">Invalid SVG code block content</div>`;
                    }
                    // Return the raw SVG content. DOMPurify will handle sanitization later.
                    return content;
                } catch (error) {
                    log.error('PREVIEW', 'FENCE_RULE_SVG_ERROR', `Error processing SVG content: ${error.message}`, error);
                    console.error("SVG Fence Rule Error:", error);
                    return `<div class="error">Failed to process SVG code block</div>`;
                }
            }
            // --- END SVG Handling ---

            // Fallback to default fence renderer if no match
            return defaultFence(tokens, idx, options, env, self);
        };
        log.info('PREVIEW', 'MARKDOWNIT_EXTENSIONS_APPLIED', 'markdown-it extensions applied (fence override for mermaid/svg/katex).');

        isInitialized = true;
        log.info('PREVIEW', 'MARKDOWNIT_INIT_SUCCESS', 'Markdown renderer (markdown-it) initialized (v1 instance).');
    } catch (error) {
        log.error('PREVIEW', 'MARKDOWNIT_INIT_FAILED', `Error initializing markdown-it: ${error.message}`, error);
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
async function getMarkdownItInstance(markdownFilePath) {
    await ensureBaseInitialized(); // Ensures window.markdownit is available

    const md = window.markdownit({
        html: true,
        linkify: true,
        typographer: true,
        breaks: true,
    });

    // --- STATE-AWARE PLUGIN LOADING ---
    const activePlugins = await getEnabledPlugins(); // Get plugins based on current state
    log.info('PREVIEW', 'PLUGINS_LOADING', `Loading ${activePlugins.length} active plugins into markdown-it...`);
    activePlugins.forEach(plugin => {
        md.use(plugin.plugin, plugin.options || {});
        log.debug('PREVIEW', 'PLUGIN_LOADED', `  -> Loaded plugin: ${plugin.id}`);
    });

    // Setup highlighter if the plugin is active AND the library is loaded
    if (isPluginEnabled('highlight') && window.hljs) {
        log.info('PREVIEW', 'HIGHLIGHTJS_SETUP', '[getMarkdownItInstance] Highlight plugin enabled, setting up highlight function.');
        md.options.highlight = function (str, lang) {
            if (lang && window.hljs.getLanguage(lang)) {
                try {
                    return ('<pre class="hljs"><code>' +
                        window.hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                        '</code></pre>');
                } catch (__) {}
            }
            return ('<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>');
        };
    }

    log.debug('PREVIEW', 'MARKDOWNIT_INSTANCE_CREATED', '[getMarkdownItInstance] Returning newly configured instance.');
    return md;
}

/**
 * Renders the markdown content to HTML.
 * @param {string} markdownContent The raw markdown content including frontmatter.
 * @param {string} markdownFilePath The path of the source markdown file within pdata (e.g., 'my/folder/page.md').
 * @returns {Promise<string>} The full HTML document string.
 */
export async function renderMarkdown(markdownContent, markdownFilePath) {
    log.debug('PREVIEW', 'RENDER_MARKDOWN_START', `[renderMarkdown] Called. Path: '${markdownFilePath || 'N/A'}'. MD content length: ${markdownContent?.length || 0}.`);
    
    let headContent = ''; // Initialize headContent
    let fullPageHtml = ''; // Initialize fullPageHtml
    let collectedExternalScriptUrls = []; // Initialize script URLs
    let collectedInlineScriptContents = []; // Initialize inline scripts

    let contentToProcess = markdownContent || '';
    
    // Preprocessing for KaTeX (this should also respect the plugin state)
    if (isPluginEnabled('katex')) {
        log.debug('PREVIEW', 'KATEX_PREPROCESS_START', '[renderMarkdown] KaTeX plugin enabled, running preprocessKatexBlocks...');
        contentToProcess = preprocessKatexBlocks(contentToProcess);
    } else {
        log.debug('PREVIEW', 'KATEX_PREPROCESS_SKIPPED', '[renderMarkdown] KaTeX plugin disabled, skipping preprocessKatexBlocks.');
    }

    const { frontMatter: rawFrontMatter, body: markdownBody } = parseBasicFrontmatter(contentToProcess);
    log.debug('PREVIEW', 'FRONTMATTER_PARSED', `[renderMarkdown] Frontmatter parsed. Body content length for md.render(): ${markdownBody?.length || 0}.`);

    // --- NEW: Collect scripts/styles from ACTIVE PLUGINS ---
    const activePlugins = await getEnabledPlugins();
    activePlugins.forEach(plugin => {
        if (plugin.js_includes && Array.isArray(plugin.js_includes)) {
            collectedExternalScriptUrls.push(...plugin.js_includes);
            log.info('PREVIEW', 'PLUGIN_SCRIPTS_COLLECTED', `[renderMarkdown] Added ${plugin.js_includes.length} script(s) from active plugin: ${plugin.id}`);
        }
    });
    // --- END: Collect scripts/styles from active plugins ---

    // --- START: CSS Includes Processing ---
    if (rawFrontMatter.css_includes && Array.isArray(rawFrontMatter.css_includes) && markdownFilePath) {
        const pdataFilePathDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/'));
        rawFrontMatter.css_includes.forEach(cssPath => {
            if (typeof cssPath === 'string' && cssPath.trim() !== '') {
                const trimmedCssPath = cssPath.trim();
                let resolvedCssPDataPath = '';
                if (trimmedCssPath.startsWith('./') || trimmedCssPath.startsWith('../')) {
                    resolvedCssPDataPath = simpleJoinPath(pdataFilePathDir, trimmedCssPath);
                } else if (!trimmedCssPath.startsWith('/') && !trimmedCssPath.startsWith('http')) {
                    // Assume it's relative to the markdown file's directory if no other prefix
                    resolvedCssPDataPath = simpleJoinPath(pdataFilePathDir, trimmedCssPath);
                } else {
                    // If it's an absolute path (starts with /) or a full URL, use as is for the href directly
                    // For /api/pdata/read, we still need to construct it.
                    // This part might need refinement if you expect absolute /pdata paths.
                    // For now, we primarily support relative paths for css_includes.
                    log.warn('PREVIEW', 'CSS_INCLUDE_UNHANDLED', `[renderMarkdown] CSS path '${trimmedCssPath}' is absolute or a full URL. It will be used as-is if it's a URL, or needs API prefix if it's an absolute server path. This example handles relative paths for /api/pdata/read.`);
                    // If it's a full URL, href will be cssPath. If /path, it needs prefix.
                    // For simplicity, this example focuses on relative paths being served via pdata.
                    // If you intend to support full URLs directly in css_includes, that's fine.
                    // If you intend to support absolute server paths that AREN'T /api/pdata, this needs more logic.
                    if (trimmedCssPath.startsWith('http')) {
                         headContent += `<link rel="stylesheet" type="text/css" href="${DOMPurify.sanitize(trimmedCssPath, { USE_PROFILES: { html: true } })}">\n`;
                    } else {
                        log.warn('PREVIEW', 'CSS_INCLUDE_UNHANDLED', `[renderMarkdown] Non-relative, non-HTTP CSS path '${trimmedCssPath}' in css_includes is not fully handled by this example logic for /api/pdata/read.`);
                    }
                    return; // Skip further processing for this item
                }
                
                const resolvedOrgPath = resolvedCssPDataPath;
                const finalCssUrl = `/api/files/content?pathname=${encodeURIComponent(resolvedOrgPath)}`;
                headContent += `<link rel="stylesheet" type="text/css" href="${DOMPurify.sanitize(finalCssUrl, { USE_PROFILES: { html: true } })}">\n`;
                log.info('PREVIEW', 'CSS_INCLUDE_ADDED', `[renderMarkdown] Added CSS link to headContent: ${finalCssUrl}`);
            }
        });
    }
    // --- END: CSS Includes Processing ---

    const localMd = await getMarkdownItInstance(markdownFilePath);
    const htmlBodyRaw = localMd.render(markdownBody);
    log.debug('PREVIEW', 'MARKDOWN_RENDERED', `[renderMarkdown] After localMd.render(). Raw HTML body length: ${htmlBodyRaw.length}.`);

    // ----- SCRIPT COLLECTION -----
    // Append scripts from frontmatter to those collected from plugins
    if (rawFrontMatter.js_includes && Array.isArray(rawFrontMatter.js_includes)) {
        collectedExternalScriptUrls.push(...rawFrontMatter.js_includes);
        log.info('PREVIEW', 'JS_INCLUDES_COLLECTED', `[renderMarkdown] SUCCESSFULLY populated collectedExternalScriptUrls from js_includes. Count: ${collectedExternalScriptUrls.length}, Content: ${JSON.stringify(collectedExternalScriptUrls)}`);
    } else {
        if (!rawFrontMatter.js_includes) {
            log.debug('PREVIEW', 'JS_INCLUDES_MISSING', '[renderMarkdown] rawFrontMatter.js_includes is missing or undefined (normal).');
        } else {
            log.warn('PREVIEW', 'JS_INCLUDES_INVALID', `[renderMarkdown] rawFrontMatter.js_includes is NOT an array. Type: ${typeof rawFrontMatter.js_includes}. Value: ${JSON.stringify(rawFrontMatter.js_includes)}`);
        }
        log.info('PREVIEW', 'JS_INCLUDES_EMPTY', '[renderMarkdown] collectedExternalScriptUrls remains empty.');
    }
    
    if (rawFrontMatter.script && typeof rawFrontMatter.script === 'string') {
        collectedInlineScriptContents.push(rawFrontMatter.script);
        log.info('PREVIEW', 'INLINE_SCRIPT_COLLECTED', `[renderMarkdown] SUCCESSFULLY added script from frontmatter block to collectedInlineScriptContents. New count: ${collectedInlineScriptContents.length}`);
    }

    let processedHtmlBody = htmlBodyRaw;
    let foundInlineScriptsInBodyCount = 0;
    try {
        const tempDoc = new DOMParser().parseFromString(htmlBodyRaw, 'text/html');
        const bodyScripts = tempDoc.body.querySelectorAll('script:not([src])');
        
        if (bodyScripts.length > 0) {
            log.debug('PREVIEW', 'INLINE_SCRIPTS_FOUND_IN_BODY', `[renderMarkdown] Found ${bodyScripts.length} inline <script> tags in Markdown body.`);
            bodyScripts.forEach(scriptTag => {
                if (scriptTag.textContent) {
                    collectedInlineScriptContents.push(scriptTag.textContent);
                    foundInlineScriptsInBodyCount++;
                }
                scriptTag.remove(); 
            });
            processedHtmlBody = tempDoc.body.innerHTML; 
            log.debug('PREVIEW', 'INLINE_SCRIPTS_EXTRACTED', `[renderMarkdown] Extracted and removed ${foundInlineScriptsInBodyCount} inline script(s) from HTML body. collectedInlineScriptContents count: ${collectedInlineScriptContents.length}`);
        } else {
            log.debug('PREVIEW', 'NO_INLINE_SCRIPTS_IN_BODY', '[renderMarkdown] No inline <script> tags found in Markdown body.');
        }
    } catch (e) {
        log.error('PREVIEW', 'INLINE_SCRIPT_EXTRACTION_FAILED', `[renderMarkdown] Error processing/removing inline scripts from HTML body: ${e}`, e);
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
    log.info('PREVIEW', 'HTML_SANITIZED', `[renderMarkdown] Sanitized HTML length: ${finalHtmlBody.length}`);

    if (finalHtmlBody.includes('alert("hello")')) {
        log.warn('PREVIEW', 'XSS_CHECK_FAILED', '[renderMarkdown] DEBUG ALERT CHECK: Script "alert(\\"hello\\")" IS STILL PRESENT in finalHtmlBody AFTER script removal and DOMPurify.');
    } else {
        log.info('PREVIEW', 'XSS_CHECK_PASSED', '[renderMarkdown] DEBUG ALERT CHECK: Script "alert(\\"hello\\")" is NOT present in finalHtmlBody (as expected).');
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
    log.info('PREVIEW', 'PRE_RETURN_CHECK_EXTERNAL_SCRIPTS', `[renderMarkdown] FINAL PRE-RETURN CHECK: collectedExternalScriptUrls = ${JSON.stringify(collectedExternalScriptUrls)}, Count: ${collectedExternalScriptUrls.length}`);
    log.info('PREVIEW', 'PRE_RETURN_CHECK_INLINE_SCRIPTS_COUNT', `[renderMarkdown] FINAL PRE-RETURN CHECK: collectedInlineScriptContents (count) = ${collectedInlineScriptContents.length}`);
    collectedInlineScriptContents.forEach((content, idx) => {
        log.info('PREVIEW', 'PRE_RETURN_CHECK_INLINE_SCRIPT_CONTENT', `[renderMarkdown] FINAL PRE-RETURN CHECK: collectedInlineScriptContents[${idx}] (length) = ${content.length}, Preview: ${content.substring(0,50).replace(/\\n/g,'')}`);
    });
    
    const result = {
        html: finalHtmlBody,
        head: headContent,
        fullPage: fullPageHtml,
        frontMatter: rawFrontMatter,
        externalScriptUrls: collectedExternalScriptUrls,
        inlineScriptContents: collectedInlineScriptContents
    };
    
    log.info('PREVIEW', 'RENDER_MARKDOWN_COMPLETE', `[renderMarkdown] Returning result object. Keys: ${Object.keys(result).join(', ')}. External script URLs: ${result.externalScriptUrls?.length}, Inline script contents: ${result.inlineScriptContents?.length}.`);
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
 * @param {object} [frontMatter={}] - The parsed frontmatter object.
 */
export async function postProcessRender(previewElement, externalScriptUrls = [], inlineScriptContents = [], markdownFilePath = '', frontMatter = {}) {
    if (!previewElement) {
        log.error('PREVIEW', 'POST_PROCESS_NO_ELEMENT', 'postProcessRender called with no previewElement. Aborting.');
        return;
    }

    // --- NEW: Add the 'loaded' class after a short delay ---
    // This ensures content is rendered before fade-in
    setTimeout(() => {
        if (previewElement.tagName === 'IFRAME') {
            previewElement.classList.add('loaded');
            log.info('PREVIEW', 'IFRAME_FADE_IN', 'Added "loaded" class to iframe for fade-in effect.');
        }
    }, 50); // 50ms delay, can be adjusted
    // ---------------------------------------------------------

    log.info('PREVIEW', 'POST_PROCESS_START', `Post-processing render for path: ${markdownFilePath}`);

    // --- 1. Handle Scripts (JS Includes) ---
    let fetchedExternalScripts = [];

    if (externalScriptUrls && externalScriptUrls.length > 0) {
        log.info('PREVIEW', 'FETCH_EXTERNAL_SCRIPTS_START', `[postProcessRender] Fetching ${externalScriptUrls.length} external scripts... Base dir for relative paths derived from: '${markdownFilePath}'`);
        const scriptPromises = externalScriptUrls.map(scriptUrlOrPath => {
            const trimmedUrl = scriptUrlOrPath.trim();
            let finalFetchUrl = trimmedUrl;
            const scriptName = trimmedUrl.substring(trimmedUrl.lastIndexOf('/') + 1);
            log.debug('PREVIEW', 'PROCESS_SCRIPT_URL', `[postProcessRender] Processing scriptUrlOrPath: '${trimmedUrl}'`);


            if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
                // Branch A: Absolute URL
                log.debug('PREVIEW', 'SCRIPT_URL_ABSOLUTE', `[postProcessRender] Branch A: Absolute URL: '${trimmedUrl}'`);
                // finalFetchUrl is already absolute
            } else if (trimmedUrl.startsWith('/')) {
                // Branch B: Root-relative path
                log.debug('PREVIEW', 'SCRIPT_URL_ROOT_RELATIVE', `[postProcessRender] Branch B: Root-relative path: '${trimmedUrl}'`);
                finalFetchUrl = new URL(trimmedUrl, window.location.origin).href;
            } else if ((trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) && markdownFilePath) {
                // Branch C: Relative path, resolve against markdownFilePath using pdata API
                log.debug('PREVIEW', 'SCRIPT_URL_RELATIVE', `[postProcessRender] Branch C: Relative path. markdownFilePath: '${markdownFilePath}'`);
                const pdataFilePathDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/'));
                // Note: simpleJoinPath ensures no double slashes and correct joining.
                const resolvedPDataPath = simpleJoinPath(pdataFilePathDir, trimmedUrl);
                finalFetchUrl = `/api/files/content?pathname=${encodeURIComponent(resolvedPDataPath)}`;
                log.debug('PREVIEW', 'SCRIPT_URL_RESOLVED', `[postProcessRender] Branch C: Resolved PData path: '${resolvedPDataPath}'. finalFetchUrl: ${finalFetchUrl}`);
            } else {
                // Branch D: Fallback or ambiguous path - try resolving against current page, then root.
                // This branch might need refinement based on actual use cases.
                log.debug('PREVIEW', 'SCRIPT_URL_AMBIGUOUS', `[postProcessRender] Branch D: Fallback/Ambiguous path: '${trimmedUrl}'. Attempting to resolve.`);
                try {
                    finalFetchUrl = new URL(trimmedUrl, window.location.href).href; // Try relative to current page
                    log.debug('PREVIEW', 'SCRIPT_URL_RESOLVED_PAGE', `[postProcessRender] Branch D: Resolved against current page: '${finalFetchUrl}'`);
                } catch (e) {
                    try {
                        finalFetchUrl = new URL(trimmedUrl, window.location.origin).href; // Try relative to root
                        log.debug('PREVIEW', 'SCRIPT_URL_RESOLVED_ROOT', `[postProcessRender] Branch D: Resolved against root: '${finalFetchUrl}'`);
                    } catch (e2) {
                         log.warn('PREVIEW', 'SCRIPT_URL_RESOLVE_FAILED', `[postProcessRender] Branch D: Could not resolve ambiguous path '${trimmedUrl}'. Using as is. Error: ${e2.message}`);
                         // finalFetchUrl remains trimmedUrl, hoping it's a direct server path.
                    }
                }
            }
            log.info('PREVIEW', 'FETCH_SCRIPT', `[postProcessRender] Attempting to fetch: ${finalFetchUrl}`);
            return fetch(finalFetchUrl)
                .then(response => {
                    if (!response.ok) {
                        log.error('PREVIEW', 'FETCH_SCRIPT_FAILED', `[postProcessRender] Failed to fetch external script: ${finalFetchUrl} - Status: ${response.status}`);
                        return { name: scriptName, url: finalFetchUrl, content: `console.error("Failed to load ${finalFetchUrl}: ${response.status}");`, error: true };
                    }
                    return response.text().then(text => {
                         log.info('PREVIEW', 'FETCH_SCRIPT_SUCCESS', `[postProcessRender] Fetched and added script from: ${finalFetchUrl} (length: ${text.length})`);
                        return { name: scriptName, url: finalFetchUrl, content: text, error: false };
                    });
                })
                .catch(error => {
                    log.error('PREVIEW', 'FETCH_SCRIPT_NETWORK_ERROR', `[postProcessRender] Network error fetching external script: ${finalFetchUrl} - ${error.message}`, error);
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
                log.debug('PREVIEW', 'ADD_EXTERNAL_SCRIPT_TO_BUNDLE', `[postProcessRender] Added EXTERNAL script from "${script.url}" (trimmed length: ${trimmedContent.length}) to bundle parts. Preview (100 chars): ${trimmedContent.substring(0,100)}`);
            } else {
                 log.warn('PREVIEW', 'SKIP_EMPTY_EXTERNAL_SCRIPT', `[postProcessRender] Skipped empty external script from "${script.url}" after trimming.`);
            }
        } else {
            log.warn('PREVIEW', 'SKIP_INVALID_EXTERNAL_SCRIPT', `[postProcessRender] Skipped invalid external script object or content for URL: ${script ? script.url : 'unknown'}.`);
        }
    });

    const currentInlineScriptContents = inlineScriptContents || [];
    currentInlineScriptContents.forEach((content, i) => {
        if (content && typeof content === 'string') {
            const trimmedContent = content.trim();
            if (trimmedContent) {
                scriptParts.push(trimmedContent);
                log.debug('PREVIEW', 'ADD_INLINE_SCRIPT_TO_BUNDLE', `[postProcessRender] Added INLINE script #${i+1} (trimmed length: ${trimmedContent.length}) to bundle parts. Preview (100 chars): ${trimmedContent.substring(0,100)}`);
            } else {
                log.warn('PREVIEW', 'SKIP_EMPTY_INLINE_SCRIPT', `[postProcessRender] Skipped empty inline script #${i+1} after trimming.`);
            }
        } else {
            log.warn('PREVIEW', 'SKIP_INVALID_INLINE_SCRIPT', `[postProcessRender] Skipped invalid inline script content at index ${i}. Content type: ${typeof content}`);
        }
    });

    // Join script parts with a semicolon and a newline
    const bundledScriptContent = scriptParts.join(";\n");
    // ** END MODIFIED SCRIPT BUNDLING LOGIC **

    // <<< ADD THIS LOG BLOCK HERE >>>
    if (previewElement) {
        log.debug('PREVIEW', 'PRE_APPEND_SCRIPT_CHECK', `[postProcessRender] HTML of previewElement (id: ${previewElement.id}, first 1000 chars) JUST BEFORE SCRIPT ELEMENT CREATION/APPEND:\n${previewElement.innerHTML.substring(0, 1000)}`);
        if (previewElement.innerHTML.includes('id="host-log"')) {
            log.info('PREVIEW', 'HOST_LOG_PRESENT', "[postProcessRender] >>> #host-log IS PRESENT in previewElement.innerHTML before script append.");
        } else {
            log.warn('PREVIEW', 'HOST_LOG_MISSING', "[postProcessRender] >>> #host-log IS ***NOT*** PRESENT in previewElement.innerHTML before script append.");
        }
        if (previewElement.innerHTML.includes('id="game-iframe"')) {
            log.info('PREVIEW', 'GAME_IFRAME_PRESENT', "[postProcessRender] >>> #game-iframe IS PRESENT in previewElement.innerHTML before script append.");
        } else {
            log.warn('PREVIEW', 'GAME_IFRAME_MISSING', "[postProcessRender] >>> #game-iframe IS ***NOT*** PRESENT in previewElement.innerHTML before script append.");
        }
    }
    // <<< END OF ADDED LOG BLOCK >>>

    if (bundledScriptContent.trim() !== '') {
        log.info('PREVIEW', 'FINAL_SCRIPT_BUNDLE', `[postProcessRender] FINAL SCRIPT BUNDLE about to be appended (length: ${bundledScriptContent.length}):\n------------ START BUNDLE ------------\n${bundledScriptContent.substring(0,500)}...\n------------- END BUNDLE -------------`); // Log only first 500 chars


        const scriptElement = document.createElement('script');
        scriptElement.type = 'text/javascript';
        try {
            scriptElement.textContent = bundledScriptContent;
            log.debug('PREVIEW', 'SCRIPT_ELEMENT_CREATED', `[postProcessRender] Created script element. Text content preview (100chars): '${bundledScriptContent.substring(0,100)}'`);
        } catch (e) {
            log.error('PREVIEW', 'SCRIPT_ELEMENT_CREATE_FAILED', `[postProcessRender] Error setting textContent for script: ${e.message}. Bundled content preview (first 200 chars): ${bundledScriptContent.substring(0,200)}`, e);
            return; 
        }

        if (previewElement && typeof previewElement.appendChild === 'function') {
            log.info('PREVIEW', 'APPEND_SCRIPT_START', `[postProcessRender] previewElement is valid. About to appendChild.`);
            try {
                previewElement.appendChild(scriptElement); 
                log.info('PREVIEW', 'APPEND_SCRIPT_SUCCESS', `[postProcessRender] Successfully created and appended bundled script to previewElement.`);
            } catch (e) {
                log.error('PREVIEW', 'APPEND_SCRIPT_FAILED', `[postProcessRender] Error appending script to previewElement: ${e.message}. Node name: ${scriptElement.nodeName}, Type: ${scriptElement.type}, Content preview (first 200 chars): ${scriptElement.textContent.substring(0,200)}`, e);
            }
        } else {
            log.warn('PREVIEW', 'APPEND_SCRIPT_INVALID_ELEMENT', `[postProcessRender] previewElement is invalid or appendChild is not a function. Cannot append script.`);
        }
    } else {
        log.info('PREVIEW', 'NO_SCRIPTS_TO_BUNDLE', `[postProcessRender] No scripts (external or inline) to bundle or execute after trimming.`);
    }

    // Mermaid processing is now handled by MarkdownRenderer.js via processEnabledPlugins
    // This function is kept for legacy compatibility but doesn't duplicate Mermaid processing

    if (isPluginEnabled('highlight')) {
        log.info('PREVIEW', 'HIGHLIGHTJS_POST_PROCESS', '[postProcessRender] Highlight plugin is enabled. Main highlighting via md.options.highlight. Optional post-processing if needed.');
    }

    log.info('PREVIEW', 'POST_PROCESS_COMPLETE', `[postProcessRender] Finished.`);

    // NEW: Dispatch custom event to signal content is fully processed
    if (previewElement) {
        const event = new CustomEvent('preview:contentready', {
            bubbles: true,
            cancelable: false,
            detail: { filePath: markdownFilePath }
        });
        previewElement.dispatchEvent(event);
        log.info('PREVIEW', 'CONTENT_READY_EVENT_DISPATCHED', `[postProcessRender] Dispatched 'preview:contentready' event for ${markdownFilePath}`);
    }
}

export class Renderer {
  constructor() {
    this.plugins = [
      new MermaidPlugin(),
      new GraphvizPlugin()
    ];
  }

  /*
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
    */
} 

// Helper function to check if plugin is enabled via application state
function isPluginEnabled(pluginName) {
    const state = appStore.getState();
    // Use the selector to check the plugin's 'enabled' status from the state
    return getIsPluginEnabled(state, pluginName);
} 

// ADD THIS: Helper function to load highlight.js
async function loadHighlightJS() {
    try {
        // Load CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@latest/build/styles/github.min.css';
        cssLink.id = 'highlight-theme-css';
        document.head.appendChild(cssLink);
        
        // Load JS
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@latest/build/highlight.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        if (window.hljs) {
            // Configure hljs
            window.hljs.configure({
                ignoreUnescapedHTML: true,
                throwUnescapedHTML: false
            });
            log.info('PREVIEW', 'HIGHLIGHTJS_CONFIGURED', 'highlight.js loaded and configured successfully');
        }
    } catch (error) {
        log.error('PREVIEW', 'HIGHLIGHTJS_LOAD_FAILED', `Failed to load highlight.js: ${error.message}`, error);
    }
} 