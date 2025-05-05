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
            await loadKatexCss();
            await loadKatexScript(); // Ensure base KaTeX is loaded
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
    if (markdownFilePath === undefined) {
         logRenderer('markdownFilePath is undefined, cannot resolve local includes!', 'error');
         // Fallback or throw error? For now, proceed without includes.
    }

    const md = await getMarkdownItInstance(); // Get initialized markdown-it instance

    // 1. Parse Frontmatter
    const { frontMatter, body: markdownBody } = parseBasicFrontmatter(markdownContent);
    logRenderer('Parsed frontmatter:', 'debug'); console.log(frontMatter);

    // <<< ADD DEBUG LOGS HERE >>>
    logRenderer(`[Inject JS Check] markdownFilePath type: ${typeof markdownFilePath}, value: ${markdownFilePath}`, 'debug');
    logRenderer(`[Inject JS Check] frontMatter.js_includes exists: ${frontMatter && frontMatter.hasOwnProperty('js_includes')}`, 'debug');
    if (frontMatter && frontMatter.hasOwnProperty('js_includes')) {
         logRenderer(`[Inject JS Check] frontMatter.js_includes type: ${typeof frontMatter.js_includes}`, 'debug');
         logRenderer(`[Inject JS Check] Array.isArray(frontMatter.js_includes): ${Array.isArray(frontMatter.js_includes)}`, 'debug');
         try {
             logRenderer(`[Inject JS Check] frontMatter.js_includes value (JSON): ${JSON.stringify(frontMatter.js_includes)}`, 'debug');
         } catch (e) {
              logRenderer(`[Inject JS Check] Error stringifying frontMatter.js_includes: ${e}`, 'warn');
              logRenderer(`[Inject JS Check] frontMatter.js_includes value (raw):`, 'debug');
              console.log(frontMatter.js_includes); // Log raw object if JSON fails
         }
    } else {
         logRenderer(`[Inject JS Check] frontMatter does not have js_includes property.`, 'debug');
    }
    // <<< END ADD DEBUG LOGS >>>

    // 2. Generate <head> content
    let headContent = '<meta charset="UTF-8">';
    headContent += '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
    headContent += `<title>${frontMatter.title || 'Preview'}</title>`;

    // Inject CSS includes from frontmatter
    if (markdownFilePath && frontMatter.css_includes && Array.isArray(frontMatter.css_includes)) {
        const markdownDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/') + 1); // Get dir part (e.g., 'my/folder/') or '' if root
        frontMatter.css_includes.forEach(relPath => {
            if (typeof relPath === 'string' && relPath.trim()) {
                const trimmedRelPath = relPath.trim();
                // Construct path without unnecessary "./" (like we do for JS)
                const resolvedPath = trimmedRelPath.startsWith('./') ? trimmedRelPath.substring(2) : trimmedRelPath;
                const serverPath = joinUrlPath('/pdata-files', markdownDir, resolvedPath);
                headContent += `<link rel="stylesheet" href="${serverPath}">\n`;
                logRenderer(`Injecting CSS: ${serverPath}`, 'debug');
            }
        });
    }

    // Inject JS includes from frontmatter
    if (markdownFilePath && frontMatter.js_includes && Array.isArray(frontMatter.js_includes)) {
        logRenderer(`[Inject JS] Found js_includes: ${JSON.stringify(frontMatter.js_includes)} for path: ${markdownFilePath}`, 'debug');
        const markdownDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/') + 1); 
        logRenderer(`[Inject JS] Calculated markdownDir: ${markdownDir}`, 'debug');
        frontMatter.js_includes.forEach(relPath => {
            logRenderer(`[Inject JS] Processing relPath: ${relPath}`, 'debug');
            if (typeof relPath === 'string' && relPath.trim()) {
                const trimmedRelPath = relPath.trim();
                // Construct path without unnecessary "./"
                const resolvedPath = trimmedRelPath.startsWith('./') ? trimmedRelPath.substring(2) : trimmedRelPath;
                const serverPath = joinUrlPath('/pdata-files', markdownDir, resolvedPath);
                const scriptTag = `<script type="module" src="${serverPath}" defer></script>\n`;
                headContent += scriptTag;
                logRenderer(`[Inject JS] Added script tag: ${scriptTag.trim()}`, 'debug');
            } else {
                 logRenderer(`[Inject JS] Skipping invalid relPath: ${relPath}`, 'warning');
            }
        });
    } else {
         let reason = 'Unknown';
         if (!markdownFilePath) reason = 'markdownFilePath missing';
         else if (!frontMatter.js_includes) reason = 'frontMatter.js_includes missing';
         else if (!Array.isArray(frontMatter.js_includes)) reason = 'frontMatter.js_includes is not an array';
         logRenderer(`[Inject JS] Skipped JS injection. Reason: ${reason}. Path: ${markdownFilePath}, FrontMatter Keys: ${Object.keys(frontMatter)}`, 'debug');
    }

    // Inject inline CSS from frontmatter (if using 'css' key with block scalar)
    if (frontMatter.css) {
        headContent += `<style>\n${frontMatter.css}\n</style>\n`;
        logRenderer('Injecting inline CSS from frontmatter.', 'debug');
    }

    // 3. Render Markdown Body
    const preprocessedBody = isPluginEnabled('katex') ? preprocessKatexBlocks(markdownBody) : markdownBody;
    const renderedBody = md.render(preprocessedBody);

    // 4. Sanitize Rendered Body HTML (Important!)
    const sanitizedBody = DOMPurify.sanitize(renderedBody, {
        USE_PROFILES: { html: true }, // Allow standard HTML tags
        // ADD_TAGS: ['iframe'], // Example: Allow iframes if needed
        // ADD_ATTR: ['allowfullscreen'], // Example: Allow specific attributes
    });

    // 5. Construct Full HTML
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

    // Get the map of currently enabled plugins (might be useful for instances)
    // const enabledPluginInstances = getEnabledPlugins(); 

    // --- 1. Syntax Highlighting ---
    if (isPluginEnabled('highlight')) {
        try {
            logRenderer('Applying syntax highlighting...');
            // Assuming HighlightPlugin has a static process method or similar helper
            // If it relies on an instance, get it from enabledPluginInstances
            const highlightModule = await import('/client/preview/plugins/highlight.js');
            if (highlightModule && typeof highlightModule.process === 'function') {
                await highlightModule.process(previewElement);
            }
            logRenderer('Syntax highlighting applied.');
        } catch (e) {
            logRenderer(`Error applying syntax highlighting: ${e.message}`, 'error');
        }
    } else {
        logRenderer('Syntax highlighting plugin disabled, skipping.');
    }

    // --- 2. Mermaid Diagrams ---
    if (isPluginEnabled('mermaid')) {
        try {
            logRenderer('Processing Mermaid diagrams...');
            // Check if mermaid global is available and run it
            if (typeof window.mermaid?.run === 'function') {
                // Find all potential mermaid blocks
                const mermaidElements = previewElement.querySelectorAll('pre.mermaid > code, div.mermaid'); 
                if (mermaidElements.length > 0) {
                    logRenderer(`Found ${mermaidElements.length} potential Mermaid elements. Calling mermaid.run()...`);
                    // Use mermaid.run() for dynamic rendering after initial load
                    await window.mermaid.run({ nodes: mermaidElements });
                } else {
                    logRenderer('No Mermaid elements found to process.');
                }
            } else {
                logRenderer('Mermaid library or mermaid.run not available.', 'warn');
            }
            logRenderer('Mermaid diagrams processing attempted.');
        } catch (e) {
            logRenderer(`Error processing Mermaid: ${e.message}`, 'error');
            console.error('[MERMAID POST-PROCESS ERROR]', e);
        }
    } else {
        logRenderer('Mermaid plugin disabled, skipping.');
    }

    // --- 3. KaTeX Math Rendering --- 
    if (isPluginEnabled('katex')) {
        try {
            if (typeof window.renderMathInElement === 'function') {
                logRenderer('Running KaTeX auto-render...');
                // Default options for auto-render - adjust if needed
                const katexOptions = {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "$", right: "$", display: false},
                        // Keep \[, \] and \(, \) if markdown-it-katex isn't handling them
                        // {left: "\\[", right: "\\]", display: true},
                        // {left: "\\(", right: "\\)", display: false}
                    ],
                    throwOnError : false
                };
                window.renderMathInElement(previewElement, katexOptions);
                logRenderer('KaTeX auto-render complete.');
            } else {
                logRenderer('KaTeX auto-render function not available.', 'warn');
                // Attempt to load it dynamically if missing? Or rely on initial load.
            }
        } catch (e) {
            logRenderer(`Error during KaTeX auto-render: ${e.message}`, 'error');
        }
    } else {
        logRenderer('KaTeX plugin disabled, skipping auto-render.');
    }

    // --- 4. Graphviz Diagrams ---
    if (isPluginEnabled('graphviz')) {
        try {
            logRenderer('Processing Graphviz diagrams...');
            // Assuming GraphvizPlugin exposes a static method or needs instantiation
            const graphvizModule = await import('/client/preview/plugins/graphviz.js');
            if (graphvizModule && typeof graphvizModule.process === 'function') {
                await graphvizModule.process(previewElement);
            } else if (graphvizModule.GraphvizPlugin) {
                // Maybe get instance or call static method?
                console.warn('[Renderer] Graphviz processing needs specific implementation call.');
            }
            logRenderer('Graphviz diagrams processing attempted.');
        } catch (e) {
            logRenderer(`Error processing Graphviz: ${e.message}`, 'error');
        }
    } else {
        logRenderer('Graphviz plugin disabled, skipping.');
    }

    // --- 5. Audio Markdown ---
    if (isPluginEnabled('audio-md')) {
        try {
            logRenderer('Processing Audio Markdown...');
            const audioMdModule = await import('/client/preview/plugins/audio-md.js');
            if (audioMdModule && typeof audioMdModule.process === 'function') {
                await audioMdModule.process(previewElement);
            }
            logRenderer('Audio Markdown processing attempted.');
        } catch (e) {
            logRenderer(`Error processing Audio Markdown: ${e.message}`, 'error');
        }
    } else {
        logRenderer('Audio Markdown plugin disabled, skipping.');
    }

    // --- 6. GitHub Markdown Specifics (e.g., task lists) ---
    if (isPluginEnabled('github-md')) {
        try {
            // Find and potentially make task list items interactive
            const taskItems = previewElement.querySelectorAll('.task-list-item input[type="checkbox"]');
            if (taskItems.length > 0) {
                logRenderer(`Processing ${taskItems.length} GitHub task list items...`);
                taskItems.forEach(checkbox => {
                    checkbox.disabled = false; // Ensure they are not disabled by default
                    // Add event listeners if needed for interaction
                });
            }
        } catch (e) {
            logRenderer(`Error processing GitHub Markdown specifics: ${e.message}`, 'error');
        }
    } else {
        logRenderer('GitHub Markdown plugin disabled, skipping specifics.');
    }

    logRenderer('Post-processing complete.');
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