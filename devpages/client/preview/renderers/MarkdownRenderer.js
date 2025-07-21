/**
 * Markdown Renderer - Specialized for .md files
 * Handles markdown-to-HTML conversion with plugin support
 */

import DOMPurify from '/client/vendor/scripts/dompurify.es.js';
import { appStore } from '/client/appState.js';
import { getIsPluginEnabled } from '/client/store/selectors.js';
import { getPlugin, processEnabledPlugins } from '/client/preview/plugins/PluginLoader.js';
import { parseFrontmatter } from '../utils/frontmatterParser.js';
import LinkManager from '/client/links/LinkManager.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('MarkdownRenderer');

export class MarkdownRenderer {
    constructor() {
        this.markdownItInstance = null;
    }

    /**
     * Load markdown-it library
     */
    async loadMarkdownIt() {
        return new Promise((resolve, reject) => {
            if (typeof window.markdownit !== 'undefined') {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = '/client/vendor/scripts/markdown-it.min.js';
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Preprocess KaTeX blocks
     */
    preprocessKatexBlocks(content) {
        const blockRegex = /\\\[([\s\S]*?)\\\]/g; 
        let processedContent = content.replace(blockRegex, (match, formula) => {
            return '$$' + formula + '$$'; 
        });
        
        const inlineRegex = /\\\(([\s\S]*?)\\\)/g;
        processedContent = processedContent.replace(inlineRegex, (match, formula) => {
            return '$' + formula.trim() + '$';
        });
        
        return processedContent;
    }

    /**
     * Simple path joining utility
     */
    simpleJoinPath(base, relative) {
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
     * Create configured markdown-it instance
     */
    async createMarkdownItInstance(filePath) {
        await this.loadMarkdownIt();
        const linkManager = new LinkManager('preview', filePath);

        // Pre-load highlight plugin if needed
        let highlightPlugin = null;
        if (getIsPluginEnabled(appStore.getState(), 'highlight')) {
            try {
                highlightPlugin = await getPlugin('highlight');
                log.info('MARKDOWN', 'HIGHLIGHT_PLUGIN_LOADED', 'Highlight plugin loaded successfully');
            } catch (error) {
                log.error('MARKDOWN', 'HIGHLIGHT_PLUGIN_LOAD_FAILED', `Failed to load highlight plugin: ${error.message}`, error);
            }
        }

        const md = new window.markdownit({
            html: true,
            xhtmlOut: false,
            breaks: true,
            langPrefix: 'language-', 
            linkify: true,
            typographer: true,
            highlight: (str, lang) => {
                // NO async/await here - must be synchronous
                if (!getIsPluginEnabled(appStore.getState(), 'highlight')) {
                    return md.utils.escapeHtml(str);
                }
                
                // Use pre-loaded plugin
                if (highlightPlugin && highlightPlugin.isReady && highlightPlugin.isReady()) {
                    try {
                        return highlightPlugin.highlight(str, lang);
                    } catch (error) {
                        log.error('MARKDOWN', 'HIGHLIGHTING_ERROR', `Highlighting error: ${error.message}`, error);
                    }
                }
                
                return md.utils.escapeHtml(str);
            }
        });

        // Apply KaTeX plugin if enabled
        if (getIsPluginEnabled(appStore.getState(), 'katex')) {
            md.use(window.mditKaTeX, { "throwOnError": false, "errorColor": " #cc0000" });
        }

        // Override the default image renderer
        const defaultImageRenderer = md.renderer.rules.image || function(tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.image = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const srcAttr = token.attrGet('src');
            if (srcAttr) {
                token.attrSet('src', linkManager.resolveResourcePath(srcAttr));
            }
            return defaultImageRenderer(tokens, idx, options, env, self);
        };

        // Override the default link renderer
        const defaultLinkRenderer = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const hrefAttr = token.attrGet('href');
            if (hrefAttr) {
                token.attrSet('href', linkManager.resolveLink(hrefAttr));
            }
            return defaultLinkRenderer(tokens, idx, options, env, self);
        };

        // Configure fence rules for special languages
        const originalFence = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.fence = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const langName = token.info ? token.info.trim().split(/\s+/g)[0].toLowerCase() : '';
            
            if (langName === 'mermaid' && getIsPluginEnabled(appStore.getState(), 'mermaid')) {
                return `<div class="mermaid">\n${token.content.trim()}\n</div>\n`;
            }
            
            return originalFence(tokens, idx, options, env, self);
        };

        return md;
    }

    /**
     * Main render method for markdown content
     * @param {string} markdownContent - Raw markdown content
     * @param {string} filePath - Source file path
     * @returns {Promise<Object>} Render result
     */
    async render(markdownContent, filePath) {
        log.info('MARKDOWN', 'RENDER_START', `Rendering markdown file: ${filePath}`);
        
        let contentToProcess = markdownContent || '';
        
        // Preprocess KaTeX if enabled
        if (getIsPluginEnabled(appStore.getState(), 'katex')) {
            contentToProcess = this.preprocessKatexBlocks(contentToProcess);
        }

        // Parse frontmatter using the new utility
        const { frontMatter, body } = parseFrontmatter(contentToProcess);
        
        // Process CSS includes
        let headContent = '';
        if (frontMatter.css_includes && Array.isArray(frontMatter.css_includes) && filePath) {
            const pdataFilePathDir = filePath.substring(0, filePath.lastIndexOf('/'));
            frontMatter.css_includes.forEach(cssPath => {
                if (typeof cssPath === 'string' && cssPath.trim() !== '') {
                    const trimmedCssPath = cssPath.trim();
                    let resolvedCssPDataPath = '';
                    if (trimmedCssPath.startsWith('./') || trimmedCssPath.startsWith('../')) {
                        resolvedCssPDataPath = this.simpleJoinPath(pdataFilePathDir, trimmedCssPath);
                    } else if (!trimmedCssPath.startsWith('/') && !trimmedCssPath.startsWith('http')) {
                        // Assume it's relative to the markdown file's directory if no other prefix
                        resolvedCssPDataPath = this.simpleJoinPath(pdataFilePathDir, trimmedCssPath);
                    } else {
                        // If it's an absolute path (starts with /) or a full URL, use as is for the href directly
                        log.warn('MARKDOWN', 'CSS_PATH_UNHANDLED', `CSS path '${trimmedCssPath}' is absolute or a full URL. It will be used as-is if it's a URL, or needs API prefix if it's an absolute server path.`);
                        if (trimmedCssPath.startsWith('http')) {
                             headContent += `<link rel="stylesheet" type="text/css" href="${DOMPurify.sanitize(trimmedCssPath, { USE_PROFILES: { html: true } })}">\n`;
                        } else {
                            log.warn('MARKDOWN', 'CSS_PATH_UNHANDLED', `Non-relative, non-HTTP CSS path '${trimmedCssPath}' in css_includes is not fully handled by this example logic.`);
                        }
                        return; // Skip further processing for this item
                    }
                    
                    const resolvedOrgPath = resolvedCssPDataPath;
                    const finalCssUrl = `/api/files/content?pathname=${encodeURIComponent(resolvedOrgPath)}`;
                    headContent += `<link rel="stylesheet" type="text/css" href="${DOMPurify.sanitize(finalCssUrl, { USE_PROFILES: { html: true } })}">\n`;
                    log.info('MARKDOWN', 'CSS_LINK_ADDED', `Added CSS link to headContent: ${finalCssUrl}`);
                }
            });
        }

        // Render markdown to HTML
        const md = await this.createMarkdownItInstance(filePath);
        const htmlBodyRaw = md.render(body);
        
        // Collect scripts
        let externalScriptUrls = [];
        if (frontMatter.js_includes && Array.isArray(frontMatter.js_includes)) {
            externalScriptUrls = [...frontMatter.js_includes];
        }
        
        let inlineScriptContents = [];
        if (frontMatter.script && typeof frontMatter.script === 'string') {
            inlineScriptContents.push(frontMatter.script);
        }

        // Process and remove inline scripts
        let processedHtmlBody = htmlBodyRaw;
        try {
            const tempDoc = new DOMParser().parseFromString(htmlBodyRaw, 'text/html');
            
            // Process and remove inline scripts for later execution
            const bodyScripts = tempDoc.body.querySelectorAll('script:not([src])');
            bodyScripts.forEach(scriptTag => {
                if (scriptTag.textContent) {
                    inlineScriptContents.push(scriptTag.textContent);
                }
                scriptTag.remove(); 
            });
            processedHtmlBody = tempDoc.body.innerHTML; 
        } catch (e) {
            log.error('MARKDOWN', 'INLINE_SCRIPT_PROCESSING_ERROR', `Error processing inline scripts: ${e}`, e);
        }
        
        // Sanitize with DOMPurify
        const sanitizedHtml = DOMPurify.sanitize(processedHtmlBody, {
            ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'track', 'style', 'link', 'meta', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'div', 'span', 'p', 'pre', 'code', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'a', 'br', 'hr', 'em', 'strong', 'del', 'ins', 'blockquote', 'figure', 'figcaption'],
            ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'srcdoc', 'target', 'rel', 'type', 'href', 'media', 'charset', 'name', 'content', 'property', 'http-equiv', 'open', 'id', 'class', 'style', 'width', 'height', 'alt', 'title', 'datetime', 'cite', 'lang', 'start', 'value', 'colspan', 'rowspan', 'scope', 'placeholder', 'required', 'disabled', 'checked', 'selected', 'autoplay', 'controls', 'loop', 'muted', 'poster', 'preload', 'reversed', 'for', 'accept', 'max', 'min', 'step', 'pattern', 'maxlength', 'minlength', 'readonly', 'spellcheck', 'draggable', 'contenteditable'],
            FORCE_BODY: false, 
            ALLOW_DATA_ATTR: true,
            ALLOW_UNKNOWN_PROTOCOLS: true, 
            WHOLE_DOCUMENT: false, 
            USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
            ALLOW_ARIA_ATTR: true, 
            ALLOW_COMMENTS: true,
        });
        
        return {
            html: sanitizedHtml,
            frontMatter,
            headContent,
            externalScriptUrls,
            inlineScriptContents
        };
    }

    /**
     * Post-process rendered markdown (handle scripts, plugins, etc.)
     * @param {HTMLElement} previewElement - Container element
     * @param {Object} renderResult - Result from render()
     * @param {string} filePath - Source file path
     */
    async postProcess(previewElement, renderResult, filePath) {
        log.info('MARKDOWN', 'POST_PROCESS_START', `Post-processing markdown: ${filePath}`);

        if (!previewElement) {
            log.warn('MARKDOWN', 'NO_PREVIEW_ELEMENT', 'No preview element for post-processing');
            return;
        }

        const { frontMatter = {}, externalScriptUrls = [], inlineScriptContents = [] } = renderResult;

        // Apply HTML content to the preview element first
        if (renderResult.html) {
            previewElement.innerHTML = renderResult.html;
        }

        const linkManager = new LinkManager('preview', filePath);
        
        // Now, rewrite paths for elements inside the preview container
        const images = previewElement.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                const newSrc = linkManager.resolveResourcePath(src);
                img.setAttribute('src', newSrc);
                log.debug('MARKDOWN', 'POST_PROCESS_IMG_SRC', `Post-processed HTML img src: ${src} -> ${newSrc}`);
            }
        });

        const links = previewElement.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href) {
                const newHref = linkManager.resolveLink(href);
                link.setAttribute('href', newHref);
                log.debug('MARKDOWN', 'POST_PROCESS_A_HREF', `Post-processed HTML a href: ${href} -> ${newHref}`);
            }
        });

        // CSS link injection
        const previewSpecificCssClass = `preview-css-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
        document.querySelectorAll(`link.${previewSpecificCssClass}`).forEach(link => {
            log.debug('MARKDOWN', 'REMOVE_OLD_CSS', `Removing old CSS link: ${link.href}`);
            link.remove();
        });

        if (frontMatter.css_includes && Array.isArray(frontMatter.css_includes) && filePath) {
            log.debug('MARKDOWN', 'PROCESS_CSS_INCLUDES', `Processing ${frontMatter.css_includes.length} CSS includes.`);
            const pdataFilePathDir = filePath.substring(0, filePath.lastIndexOf('/'));
            
            frontMatter.css_includes.forEach(cssPath => {
                if (typeof cssPath === 'string' && cssPath.trim() !== '') {
                    const trimmedCssPath = cssPath.trim();
                    let finalCssUrl = '';

                    if (trimmedCssPath.startsWith('http://') || trimmedCssPath.startsWith('https://')) {
                        finalCssUrl = trimmedCssPath; // Use full URL as is
                        log.debug('MARKDOWN', 'CSS_PATH_ABSOLUTE', `CSS Path is absolute URL: ${finalCssUrl}`);
                    } else if (trimmedCssPath.startsWith('/')) {
                        if (trimmedCssPath.startsWith('/api/pdata/read?file=')) { // Already correctly prefixed
                            finalCssUrl = trimmedCssPath;
                        } else { // Assume it's a path within pdata from the root of pdata
                             finalCssUrl = `/api/files/content?pathname=${encodeURIComponent(trimmedCssPath.startsWith('/') ? trimmedCssPath.substring(1) : trimmedCssPath)}`;
                        }
                        log.debug('MARKDOWN', 'CSS_PATH_ROOT_RELATIVE', `CSS Path is root-relative: '${trimmedCssPath}'. Resolved to: ${finalCssUrl}`);
                    } else if (trimmedCssPath.startsWith('./') || trimmedCssPath.startsWith('../')) {
                        const resolvedPDataPath = this.simpleJoinPath(pdataFilePathDir, trimmedCssPath);
                        finalCssUrl = `/api/files/content?pathname=${encodeURIComponent(resolvedPDataPath)}`;
                        log.debug('MARKDOWN', 'CSS_PATH_RELATIVE', `CSS Path is relative: '${trimmedCssPath}'. Resolved to: ${finalCssUrl}`);
                    } else {
                        // Assume relative to MD file if no other indicators
                        log.debug('MARKDOWN', 'CSS_PATH_AMBIGUOUS', `CSS Path is ambiguous (assuming relative to MD): '${trimmedCssPath}'.`);
                        const resolvedPDataPath = this.simpleJoinPath(pdataFilePathDir, trimmedCssPath);
                        finalCssUrl = `/api/files/content?pathname=${encodeURIComponent(resolvedPDataPath)}`;
                    }

                    if (finalCssUrl) {
                        // More robust check for existing link, especially if IDs aren't feasible
                        const existingLink = document.querySelector(`link[rel="stylesheet"][href="${finalCssUrl}"]`);
                        if (!existingLink) {
                            const linkEl = document.createElement('link');
                            linkEl.rel = 'stylesheet';
                            linkEl.type = 'text/css';
                            linkEl.href = finalCssUrl;
                            linkEl.classList.add(previewSpecificCssClass); // Add class for identification
                            document.head.appendChild(linkEl);
                            log.info('MARKDOWN', 'CSS_LINK_APPENDED', `Appended CSS link to document.head: ${finalCssUrl}`);
                        } else {
                            log.debug('MARKDOWN', 'CSS_LINK_EXISTS', `CSS link already exists in document.head: ${finalCssUrl}`);
                        }
                    }
                }
            });
        }

        // Script execution
        let fetchedExternalScripts = [];

        if (externalScriptUrls && externalScriptUrls.length > 0) {
            log.info('MARKDOWN', 'FETCH_EXTERNAL_SCRIPTS', `Fetching ${externalScriptUrls.length} external scripts...`);
            const scriptPromises = externalScriptUrls.map(scriptUrlOrPath => {
                const trimmedUrl = scriptUrlOrPath.trim();
                let finalFetchUrl = trimmedUrl;
                const scriptName = trimmedUrl.substring(trimmedUrl.lastIndexOf('/') + 1);

                // Improved path resolution logic
                if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
                    finalFetchUrl = trimmedUrl;
                } else if (trimmedUrl.startsWith('/')) {
                    // Handle absolute paths better
                    if (trimmedUrl.startsWith('/api/')) {
                        finalFetchUrl = trimmedUrl; // Already an API path
                    } else {
                        finalFetchUrl = `/api/files/content?pathname=${encodeURIComponent(trimmedUrl.startsWith('/') ? trimmedUrl.substring(1) : trimmedUrl)}`;
                    }
                } else if ((trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) && filePath) {
                    const pdataFilePathDir = filePath.substring(0, filePath.lastIndexOf('/'));
                    const resolvedPDataPath = this.simpleJoinPath(pdataFilePathDir, trimmedUrl);
                    finalFetchUrl = `/api/files/content?pathname=${encodeURIComponent(resolvedPDataPath)}`;
                } else if (filePath) {
                    // Assume relative to MD file directory
                    const pdataFilePathDir = filePath.substring(0, filePath.lastIndexOf('/'));
                    const resolvedPDataPath = this.simpleJoinPath(pdataFilePathDir, trimmedUrl);
                    finalFetchUrl = `/api/files/content?pathname=${encodeURIComponent(resolvedPDataPath)}`;
                } else {
                    log.warn('MARKDOWN', 'CANNOT_RESOLVE_SCRIPT_PATH', `Cannot resolve script path '${trimmedUrl}' without filePath context`);
                    finalFetchUrl = trimmedUrl; // Hope for the best
                }

                log.info('MARKDOWN', 'FETCHING_SCRIPT', `Fetching script: ${trimmedUrl} -> ${finalFetchUrl}`);
                
                return fetch(finalFetchUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        return response.text();
                    })
                    .then(text => {
                        log.info('MARKDOWN', 'FETCH_SCRIPT_SUCCESS', `Successfully fetched script: ${scriptName} (${text.length} chars)`);
                        return { name: scriptName, url: finalFetchUrl, content: text, error: false };
                    })
                    .catch(error => {
                        log.error('MARKDOWN', 'FETCH_SCRIPT_FAILED', `Failed to fetch script ${scriptName}: ${error.message}`, error);
                        return { 
                            name: scriptName, 
                            url: finalFetchUrl, 
                            content: `console.error("Failed to load script ${scriptName}: ${error.message}");`, 
                            error: true 
                        };
                    });
            });

            fetchedExternalScripts = await Promise.all(scriptPromises);
        }

        // Improved script bundling with better error handling
        let scriptParts = [];

        // Add external scripts
        fetchedExternalScripts.forEach(script => {
            if (script?.content && typeof script.content === 'string') {
                const trimmedContent = script.content.trim();
                if (trimmedContent) {
                    // Wrap each script in try-catch for better error isolation
                    const wrappedScript = `
// === External Script: ${script.name} ===
try {
${trimmedContent}
} catch (error) {
    console.error("Error in external script ${script.name}:", error);
}`;
                    scriptParts.push(wrappedScript);
                    log.info('MARKDOWN', 'ADD_EXTERNAL_SCRIPT', `Added external script: ${script.name} (${trimmedContent.length} chars)${script.error ? ' [ERROR FALLBACK]' : ''}`);
                }
            }
        });

        // Add inline scripts
        (inlineScriptContents || []).forEach((content, i) => {
            if (content && typeof content === 'string') {
                const trimmedContent = content.trim();
                if (trimmedContent) {
                    // Wrap inline scripts too
                    const wrappedScript = `
// === Inline Script #${i + 1} ===
try {
${trimmedContent}
} catch (error) {
    console.error("Error in inline script #${i + 1}:", error);
}`;
                    scriptParts.push(wrappedScript);
                    log.info('MARKDOWN', 'ADD_INLINE_SCRIPT', `Added inline script #${i + 1} (${trimmedContent.length} chars)`);
                }
            }
        });

        // Execute bundled scripts
        if (scriptParts.length > 0) {
            const bundledScriptContent = scriptParts.join('\n');
            log.info('MARKDOWN', 'EXECUTE_BUNDLED_SCRIPTS', `Executing ${scriptParts.length} bundled scripts (total: ${bundledScriptContent.length} chars)`);

            const scriptElement = document.createElement('script');
            scriptElement.type = 'text/javascript';
            
            try {
                scriptElement.textContent = bundledScriptContent;
                previewElement.appendChild(scriptElement);
                log.info('MARKDOWN', 'EXECUTE_BUNDLED_SCRIPTS_SUCCESS', 'Successfully executed bundled scripts');
            } catch (error) {
                log.error('MARKDOWN', 'EXECUTE_BUNDLED_SCRIPTS_FAILED', `Error executing scripts: ${error.message}`, error);
            }
        } else {
            log.info('MARKDOWN', 'NO_SCRIPTS_TO_EXECUTE', 'No scripts to execute');
        }

        // Process markdown plugins (Mermaid, etc.)
        await processEnabledPlugins(previewElement);

        // Dispatch ready event
        const event = new CustomEvent('preview:contentready', {
            bubbles: true,
            cancelable: false,
            detail: { filePath: filePath }
        });
        previewElement.dispatchEvent(event);
        
        log.info('MARKDOWN', 'POST_PROCESS_COMPLETE', `Post-processing complete for: ${filePath}`);
    }
}

// Backwards compatibility exports
export async function renderMarkdown(content, filePath) {
    const renderer = new MarkdownRenderer();
    return await renderer.render(content, filePath);
}

export async function postProcessRender(previewElement, externalScriptUrls = [], inlineScriptContents = [], filePath = '', frontMatter = {}) {
    const renderer = new MarkdownRenderer();
    const mockResult = { externalScriptUrls, inlineScriptContents, frontMatter };
    await renderer.postProcess(previewElement, mockResult, filePath);
}
