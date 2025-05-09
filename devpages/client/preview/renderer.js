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

let isInitialized = false;
let md;

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
    if (isInitialized) return;
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
async function getMarkdownItInstance() {
    if (mdInstance) return mdInstance;
    
    await loadMarkdownItScript(); // Ensure markdown-it is loaded
    mdInstance = window.markdownit({ html: true, linkify: true, typographer: true });

    // Add plugins conditionally based on enabled status
    if (isPluginEnabled('katex')) {
        try {
            mdInstance.use(markdownitKatex);
            logRenderer('markdown-it-katex plugin enabled.');
        } catch (error) {
            logRenderer('Failed to load or enable KaTeX plugin', 'error');
        }
    }
    if (isPluginEnabled('highlight')) {
        try {
            await initHighlight(); // Ensure highlightjs is initialized
            HighlightPlugin.use(mdInstance); // Apply highlight plugin
            logRenderer('Highlight plugin enabled for markdown-it.');
        } catch (error) {
            logRenderer('Failed to initialize or apply Highlight plugin', 'error');
        }
    }
    if (isPluginEnabled('mermaid')) {
        logRenderer('Mermaid plugin enabled (processes post-render).');
    }
    if (isPluginEnabled('graphviz')) {
        GraphvizPlugin.use(mdInstance); // Apply graphviz plugin
        logRenderer('Graphviz plugin enabled for markdown-it.');
    }

    // <<< CRITICAL FIX: Apply custom fence rule for Mermaid/SVG/LaTeX to this instance >>>
    // Fixed bug: Previously, the custom fence rule was only applied to the markdown-it instance created in initializeRenderer(),
    // but that instance was never actually used for rendering. Instead, renderMarkdown() used the instance from getMarkdownItInstance()
    // which didn't have the fence rule. This caused Mermaid, KaTeX and SVG code blocks to render as plain code instead of specialized content.
    logRenderer('Adding CRITICAL fence rule override to markdown-it instance!', 'warning');
    const defaultFence = mdInstance.renderer.rules.fence;
    mdInstance.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const info = token.info ? token.info.trim().toLowerCase() : '';
        const content = token.content;
        logRenderer(`[FENCE RULE 2] Processing fence. Info: '${info}'`);

        if (info === 'mermaid') {
            logRenderer('[FENCE RULE 2] Identified as Mermaid block.');
            const code = token.content.trim();
            const sanitizedCode = code
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const outputHtml = `<div class="mermaid">${sanitizedCode}</div>`;
            logRenderer(`[FENCE RULE 2] Creating Mermaid block HTML wrapper`, 'debug');
            return outputHtml;
        }

        // Handle DOT/Graphviz blocks
        if (info === 'dot' || info === 'graphviz') {
            logRenderer('[FENCE RULE 2] Identified as Graphviz DOT block.');
            const code = token.content.trim();
            const sanitizedCode = code
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return `<div class="graphviz">${sanitizedCode}</div>`;
        }

        // Handle LaTeX blocks - especially tables
        if (info === 'latex' || info === 'katex' || info === 'tex') {
            logRenderer('[FENCE RULE 2] Identified as LaTeX block.', 'debug');
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
                    logRenderer('[FENCE RULE 2] KaTeX not available', 'error');
                    return `<pre><code>${token.content}</code></pre>`;
                }
            } catch (err) {
                logRenderer(`[FENCE RULE 2] Error: ${err.message}`, 'error');
                return `<pre><code class="error">${token.content}</code></pre>`;
            }
        }

        // --- SVG Handling ---
        if (info === 'svg') {
            logRenderer('[FENCE RULE 2] Identified as SVG block. Returning raw content.');
            try {
                if (!content || typeof content !== 'string') {
                    logRenderer(`[FENCE RULE 2] Invalid or non-string SVG content in block.`, 'error');
                    return `<div class="error">Invalid SVG code block content</div>`;
                }
                // Return the raw SVG content. DOMPurify will handle sanitization later.
                return content;
            } catch (error) {
                logRenderer(`[FENCE RULE 2] Error processing SVG content: ${error.message}`, 'error');
                console.error("[SVG FENCE RULE Error]", error);
                return `<div class="error">Failed to process SVG code block</div>`;
            }
        }
        // --- END SVG Handling ---

        // Fallback to default fence renderer if no match
        return defaultFence(tokens, idx, options, env, self);
    };
    logRenderer('CRITICAL fence rule override for mermaid/svg/katex applied to markdown-it instance', 'warning');
    // <<< END CRITICAL FIX >>>

    return mdInstance;
}

/**
 * Renders the markdown content to HTML.
 * @param {string} markdownContent The raw markdown content including frontmatter.
 * @param {string} markdownFilePath The path of the source markdown file within pdata (e.g., 'my/folder/page.md').
 * @returns {Promise<string>} The full HTML document string.
 */
export async function renderMarkdown(markdownContent, markdownFilePath) {
    logRenderer(`Rendering markdown for path: ${markdownFilePath || 'unknown path'}`, 'debug');

    // 1. Parse Frontmatter and preprocess body once
    const { frontMatter, body: markdownBodyWithoutFrontmatter } = parseBasicFrontmatter(markdownContent);
    // Preprocess for KaTeX if enabled, using the body from frontmatter parsing
    const preprocessedBody = isPluginEnabled('katex') 
        ? preprocessKatexBlocks(markdownBodyWithoutFrontmatter) 
        : markdownBodyWithoutFrontmatter;

    // 2. Get Markdown-it instance and render the preprocessed body to HTML
    md = await getMarkdownItInstance(); // Assign the returned instance to the module-scoped md
    if (!md) { // Add a guard clause in case getMarkdownItInstance fails to return an instance
        logRenderer('Failed to get markdown-it instance. Aborting render.', 'error');
        // Return a basic error HTML or throw, depending on desired error handling
        return '<!DOCTYPE html><html><head><title>Error</title></head><body><p>Error rendering Markdown: Could not initialize renderer.</p></body></html>';
    }
    const htmlBody = md.render(preprocessedBody);

    // 3. Initialize headContent for CSS/JS includes
    let headContent = '';

    // 4. Path adjustment logic for assets
    let markdownDirForAssets = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/') + 1);
    const baseDirToRemove = 'md/'; // Assuming 'md' is the base directory known by the server's dataRoot

    if (markdownDirForAssets.startsWith(baseDirToRemove)) {
        markdownDirForAssets = markdownDirForAssets.substring(baseDirToRemove.length);
    }
    // Ensure it ends with a slash if it's not empty
    if (markdownDirForAssets && !markdownDirForAssets.endsWith('/')) {
        markdownDirForAssets += '/';
    }
    logRenderer(`[Asset Path] markdownFilePath: ${markdownFilePath}, Original markdownDir: ${markdownFilePath ? markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/') + 1) : 'N/A'}, Adjusted markdownDirForAssets: '${markdownDirForAssets}'`, 'debug');

    // 5. Inject CSS includes from frontmatter
    if (markdownFilePath && frontMatter.css_includes && Array.isArray(frontMatter.css_includes)) {
        frontMatter.css_includes.forEach(relPath => {
            if (typeof relPath === 'string' && relPath.trim()) {
                const trimmedRelPath = relPath.trim();
                const resolvedPath = trimmedRelPath.startsWith('./') ? trimmedRelPath.substring(2) : trimmedRelPath;
                const serverPath = joinUrlPath('/pdata-files', markdownDirForAssets, resolvedPath);
                headContent += `<link rel="stylesheet" href="${serverPath}">\n`;
                logRenderer(`Injecting CSS: ${serverPath} (from original relPath: ${relPath}, markdownDirForAssets: ${markdownDirForAssets})`, 'debug');
            }
        });
    }

    // 6. Inject JS includes from frontmatter
    if (markdownFilePath && frontMatter.js_includes && Array.isArray(frontMatter.js_includes)) {
        logRenderer(`[Inject JS] Found js_includes: ${JSON.stringify(frontMatter.js_includes)} for path: ${markdownFilePath}`, 'debug');
        frontMatter.js_includes.forEach(relPath => {
            logRenderer(`[Inject JS] Processing relPath: ${relPath}`, 'debug');
            if (typeof relPath === 'string' && relPath.trim()) {
                const trimmedRelPath = relPath.trim();
                const resolvedPath = trimmedRelPath.startsWith('./') ? trimmedRelPath.substring(2) : trimmedRelPath;
                const serverPath = joinUrlPath('/pdata-files', markdownDirForAssets, resolvedPath);
                const scriptTag = `<script type="module" src="${serverPath}" defer></script>\n`;
                headContent += scriptTag;
                logRenderer(`[Inject JS] Added script tag: ${scriptTag.trim()} (from original relPath: ${relPath}, markdownDirForAssets: ${markdownDirForAssets})`, 'debug');
            } else {
                 logRenderer(`[Inject JS] Skipping invalid relPath: ${relPath}`, 'warning');
            }
        });
    }

    // 7. Inject inline CSS from frontmatter (if using 'css' key with block scalar)
    if (frontMatter.css) {
        headContent += `<style>\n${frontMatter.css}\n</style>\n`;
        logRenderer('Injecting inline CSS from frontmatter.', 'debug');
    }

    // 8. Render Markdown Body
    const renderedBody = md.render(preprocessedBody);

    // 9. Sanitize Rendered Body HTML (Important!)
    const sanitizedBody = DOMPurify.sanitize(renderedBody, {
        USE_PROFILES: { html: true }, // Allow standard HTML tags
        // ADD_TAGS: ['iframe'], // Example: Allow iframes if needed
        // ADD_ATTR: ['allowfullscreen'], // Example: Allow specific attributes
    });

    // 10. Construct Full HTML
    let finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${headContent}
</head>
<body>
${sanitizedBody}
`;

    // Inject inline Script from frontmatter (if using 'script' key with block scalar)
    // Inject script at the end of the body
    if (frontMatter.script) {
        // If you want it to be a module, add type="module"
        finalHtml += `<script>\n// Injected from frontmatter\n(function() {\n${frontMatter.script}\n})();\n</script>\n`;
        logRenderer('Injecting inline JS from frontmatter at end of body.', 'debug');
    }

    finalHtml += `</body>
</html>`;

    return finalHtml;
}

/**
 * Run post-processing steps after HTML is in the DOM.
 * @param {HTMLElement} previewElement - The element containing the rendered HTML.
 */
export async function postProcessRender(previewElement) {
    logRenderer('Starting post-processing...');
    if (!previewElement) {
        logRenderer('No preview element provided to postProcessRender.', 'warn');
        return;
    }

    // --- 1. Mermaid Rendering --- 
    if (isPluginEnabled('mermaid')) {
        try {
            // Ensure Mermaid plugin's process method exists and call it
            const mermaidInstance = getEnabledPlugins().get('mermaid');
            if (mermaidInstance && typeof mermaidInstance.process === 'function') {
                logRenderer('Running Mermaid processing...');
                await mermaidInstance.process(previewElement); // Pass the element
                logRenderer('Mermaid processing complete.');
            } else {
                logRenderer('Mermaid plugin enabled but no process method found or instance missing.', 'warn');
            }
        } catch (e) {
            logRenderer(`Error during Mermaid processing: ${e.message}`, 'error');
        }
    } else {
        logRenderer('Mermaid plugin disabled, skipping processing.');
    }

    // --- 2. Highlight.js Rendering --- 
    if (isPluginEnabled('highlight')) {
        try {
            const highlightInstance = getEnabledPlugins().get('highlight');
            if (highlightInstance && typeof highlightInstance.process === 'function') {
                 logRenderer('Running Highlight.js processing...');
                 await highlightInstance.process(previewElement); // Pass the element
                 logRenderer('Highlight.js processing complete.');
             } else {
                 logRenderer('Highlight plugin enabled but no process method found or instance missing.', 'warn');
             }
        } catch (e) {
            logRenderer(`Error during Highlight.js processing: ${e.message}`, 'error');
        }
    } else {
        logRenderer('Highlight.js plugin disabled, skipping processing.');
    }

    // --- Add other post-processing steps here as needed ---

    logRenderer('Post-processing finished.');
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