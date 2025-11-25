/**
 * MarkdownRenderingService v2 - Unified markdown rendering service
 * Consolidates all markdown rendering with Redux integration
 * Replaces: renderer.js, MarkdownRenderer.js, MarkdownRenderingService.js
 */

import DOMPurify from '/client/vendor/scripts/dompurify.es.js';
import { parseFrontmatter } from './utils/frontmatterParser.js';
import { getConfig } from './utils/dompurifyConfig.js';
import {
    preprocessKatexBlocks,
    joinPath,
    resolveResourcePath,
    extractInlineScripts,
    bundleScripts
} from './utils/markdownUtils.js';

const log = window.APP?.services?.log?.createLogger('MarkdownRenderingService') || console;

/**
 * MarkdownRenderingService - Single source of truth for markdown rendering
 */
export class MarkdownRenderingService {
    constructor() {
        this.mdInstance = null;
        this.initialized = false;
    }

    /**
     * Ensure markdown-it is loaded and configured
     * @private
     */
    async ensureMarkdownIt() {
        if (this.initialized && this.mdInstance) {
            return this.mdInstance;
        }

        // Load markdown-it if needed
        if (typeof window.markdownit === 'undefined') {
            await this.loadMarkdownItScript();
        }

        return window.markdownit;
    }

    /**
     * Load markdown-it library dynamically
     * @private
     */
    async loadMarkdownItScript() {
        return new Promise((resolve, reject) => {
            if (typeof window.markdownit !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = '/client/vendor/scripts/markdown-it.min.js';
            script.async = true;
            script.onload = () => {
                log.info?.('MARKDOWN', 'LOADED', 'markdown-it loaded successfully');
                resolve();
            };
            script.onerror = () => {
                log.error?.('MARKDOWN', 'LOAD_FAILED', 'Failed to load markdown-it');
                reject(new Error('Failed to load markdown-it'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Create configured markdown-it instance
     * @param {Object} options - Configuration options
     * @param {Array} options.enabledPlugins - Array of enabled plugin configs
     * @param {Function} options.highlightFn - Optional highlight function
     * @returns {Object} Configured markdown-it instance
     * @private
     */
    async createMarkdownItInstance(options = {}) {
        await this.ensureMarkdownIt();

        const { enabledPlugins = [], highlightFn = null } = options;

        const md = new window.markdownit({
            html: true,
            xhtmlOut: false,
            breaks: true,
            langPrefix: 'language-',
            linkify: true,
            typographer: true,
            highlight: highlightFn
        });

        // Apply KaTeX plugin if enabled
        const katexEnabled = enabledPlugins.some(p => p.id === 'katex' && p.enabled);
        if (katexEnabled && window.mditKaTeX) {
            md.use(window.mditKaTeX, {
                throwOnError: false,
                errorColor: '#cc0000'
            });
        }

        // Configure fence renderer for special code blocks
        this.configureFenceRenderer(md, enabledPlugins);

        return md;
    }

    /**
     * Configure custom fence renderer for Mermaid, Graphviz, etc.
     * @private
     */
    configureFenceRenderer(md, enabledPlugins) {
        const defaultFence = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.fence = (tokens, idx, options, env, self) => {
            const token = tokens[idx];
            const langName = token.info ? token.info.trim().toLowerCase() : '';
            const content = token.content;

            // Mermaid diagrams
            if (langName === 'mermaid' && enabledPlugins.some(p => p.id === 'mermaid' && p.enabled)) {
                return `<div class="mermaid">\n${content.trim()}\n</div>\n`;
            }

            // Graphviz/DOT diagrams
            if ((langName === 'dot' || langName === 'graphviz') && enabledPlugins.some(p => p.id === 'graphviz' && p.enabled)) {
                const sanitizedCode = content
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                return `<div class="graphviz">${sanitizedCode}</div>`;
            }

            // KaTeX/LaTeX blocks
            if ((langName === 'latex' || langName === 'katex' || langName === 'tex') && enabledPlugins.some(p => p.id === 'katex' && p.enabled)) {
                if (window.katex) {
                    try {
                        const html = window.katex.renderToString(content, {
                            displayMode: true,
                            throwOnError: false,
                            trust: true,
                            strict: false
                        });
                        return `<div class="katex-block">${html}</div>`;
                    } catch (err) {
                        log.error?.('MARKDOWN', 'KATEX_RENDER_ERROR', `KaTeX render error: ${err.message}`, err);
                        return `<pre><code class="error">${content}</code></pre>`;
                    }
                }
            }

            // SVG blocks
            if (langName === 'svg' && enabledPlugins.some(p => p.id === 'svg' && p.enabled)) {
                return content; // DOMPurify will sanitize
            }

            // Default fence rendering
            return defaultFence(tokens, idx, options, env, self);
        };
    }

    /**
     * Main render method - converts markdown to HTML with full processing
     * @param {string} content - Raw markdown content
     * @param {string} filePath - Source file path
     * @param {Object} options - Rendering options
     * @param {string} options.mode - 'preview' or 'publish'
     * @param {Array} options.enabledPlugins - Array of enabled plugin configs
     * @param {Function} options.highlightFn - Optional syntax highlighter
     * @returns {Promise<Object>} Render result
     */
    async render(content, filePath, options = {}) {
        const {
            mode = 'preview',
            enabledPlugins = [],
            highlightFn = null
        } = options;

        log.info?.('RENDER', 'START', `Rendering markdown (${mode}): ${filePath}`);

        try {
            // Parse frontmatter
            const { frontMatter, body } = parseFrontmatter(content || '');

            // Preprocess KaTeX blocks if plugin enabled
            let processedBody = body;
            if (enabledPlugins.some(p => p.id === 'katex' && p.enabled)) {
                processedBody = preprocessKatexBlocks(body);
            }

            // Create markdown-it instance with plugin configuration
            const md = await this.createMarkdownItInstance({
                enabledPlugins,
                highlightFn
            });

            // Render to HTML
            const htmlRaw = md.render(processedBody);

            // Extract inline scripts from HTML (security measure)
            const { html: htmlNoScripts, scripts: inlineScripts } = extractInlineScripts(htmlRaw);

            // Collect external scripts from frontmatter
            const externalScriptUrls = frontMatter.js_includes && Array.isArray(frontMatter.js_includes)
                ? frontMatter.js_includes
                : [];

            // Add frontmatter inline script
            if (frontMatter.script && typeof frontMatter.script === 'string') {
                inlineScripts.push(frontMatter.script);
            }

            // Collect CSS includes from frontmatter
            const cssIncludes = frontMatter.css_includes && Array.isArray(frontMatter.css_includes)
                ? frontMatter.css_includes
                : [];

            // Sanitize HTML
            const dompurifyConfig = getConfig(mode);
            const htmlClean = DOMPurify.sanitize(htmlNoScripts, dompurifyConfig);

            log.info?.('RENDER', 'SUCCESS', `Rendered ${htmlClean.length} chars of HTML`);

            return {
                html: htmlClean,
                frontMatter,
                scripts: {
                    external: externalScriptUrls,
                    inline: inlineScripts
                },
                styles: {
                    includes: cssIncludes
                },
                mode,
                filePath
            };

        } catch (error) {
            log.error?.('RENDER', 'ERROR', `Rendering failed: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Post-process rendered content (inject scripts, apply plugins, etc.)
     * @param {HTMLElement} container - Container element
     * @param {Object} renderResult - Result from render()
     * @param {Object} options - Post-processing options
     * @param {Function} options.processPlugins - Plugin processing function
     * @returns {Promise<void>}
     */
    async postProcess(container, renderResult, options = {}) {
        const { processPlugins = null } = options;

        log.info?.('POST_PROCESS', 'START', `Post-processing: ${renderResult.filePath}`);

        if (!container) {
            log.warn?.('POST_PROCESS', 'NO_CONTAINER', 'No container element provided');
            return;
        }

        try {
            // Set HTML content
            container.innerHTML = renderResult.html;

            // Inject CSS includes
            if (renderResult.styles?.includes && renderResult.styles.includes.length > 0) {
                await this.injectCSSIncludes(renderResult.styles.includes, renderResult.filePath);
            }

            // Execute scripts (preview mode only)
            if (renderResult.mode === 'preview' && renderResult.scripts) {
                await this.executeScripts(container, renderResult.scripts, renderResult.filePath);
            }

            // Process plugins if handler provided
            if (processPlugins && typeof processPlugins === 'function') {
                await processPlugins(container);
            }

            // Dispatch ready event
            const event = new CustomEvent('preview:contentready', {
                bubbles: true,
                cancelable: false,
                detail: {
                    filePath: renderResult.filePath,
                    mode: renderResult.mode,
                    frontMatter: renderResult.frontMatter
                }
            });
            container.dispatchEvent(event);

            log.info?.('POST_PROCESS', 'COMPLETE', `Post-processing complete: ${renderResult.filePath}`);

        } catch (error) {
            log.error?.('POST_PROCESS', 'ERROR', `Post-processing failed: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Inject CSS includes into document head
     * @private
     */
    async injectCSSIncludes(cssIncludes, contextFilePath) {
        const uniqueClass = `preview-css-${contextFilePath.replace(/[^a-zA-Z0-9]/g, '-')}`;

        // Remove old CSS links for this file
        document.querySelectorAll(`link.${uniqueClass}`).forEach(link => link.remove());

        // Add new CSS links
        for (const cssPath of cssIncludes) {
            if (!cssPath || typeof cssPath !== 'string') continue;

            const resolvedUrl = resolveResourcePath(cssPath.trim(), contextFilePath);
            const existingLink = document.querySelector(`link[rel="stylesheet"][href="${resolvedUrl}"]`);

            if (!existingLink) {
                const linkEl = document.createElement('link');
                linkEl.rel = 'stylesheet';
                linkEl.type = 'text/css';
                linkEl.href = resolvedUrl;
                linkEl.classList.add(uniqueClass);
                document.head.appendChild(linkEl);
                log.info?.('CSS', 'INJECTED', `CSS link added: ${resolvedUrl}`);
            }
        }
    }

    /**
     * Execute scripts from render result
     * @private
     */
    async executeScripts(container, scripts, filePath) {
        const externalScripts = [];

        // Fetch external scripts
        if (scripts.external && scripts.external.length > 0) {
            log.info?.('SCRIPTS', 'FETCH', `Fetching ${scripts.external.length} external scripts`);

            for (const scriptUrl of scripts.external) {
                try {
                    const resolvedUrl = resolveResourcePath(scriptUrl, filePath);
                    const response = await fetch(resolvedUrl);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const content = await response.text();
                    externalScripts.push({
                        name: scriptUrl.split('/').pop(),
                        content
                    });

                    log.info?.('SCRIPTS', 'LOADED', `Loaded: ${scriptUrl}`);
                } catch (error) {
                    log.error?.('SCRIPTS', 'LOAD_ERROR', `Failed to load ${scriptUrl}: ${error.message}`, error);
                    externalScripts.push({
                        name: scriptUrl.split('/').pop(),
                        content: `console.error("Failed to load script ${scriptUrl}: ${error.message}");`
                    });
                }
            }
        }

        // Bundle and execute
        const bundled = bundleScripts(externalScripts, scripts.inline || []);

        if (bundled.trim()) {
            log.info?.('SCRIPTS', 'EXECUTE', `Executing ${bundled.length} chars of script`);

            try {
                const scriptElement = document.createElement('script');
                scriptElement.type = 'text/javascript';
                scriptElement.textContent = bundled;
                container.appendChild(scriptElement);

                log.info?.('SCRIPTS', 'SUCCESS', 'Scripts executed successfully');
            } catch (error) {
                log.error?.('SCRIPTS', 'EXECUTE_ERROR', `Script execution failed: ${error.message}`, error);
            }
        }
    }

    /**
     * Render to standalone HTML (for publishing)
     * @deprecated Use PublishService.generateDocumentHtml() instead
     * @param {string} content - Markdown content
     * @param {string} filePath - Source file path
     * @param {Object} options - Publishing options
     * @returns {Promise<string>} Complete HTML document
     */
    async renderToStandaloneHTML(content, filePath, options = {}) {
        const {
            title = 'Published Page',
            includeScripts = false,
            baseCSS = this.getDefaultBaseCSS(),
            enabledPlugins = []
        } = options;

        // Render markdown in publish mode
        const result = await this.render(content, filePath, {
            mode: 'publish',
            enabledPlugins
        });

        // Build complete HTML document
        const pageTitle = result.frontMatter.title || title;

        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(pageTitle)}</title>
    <meta name="generator" content="DevPages">
    <style>
${baseCSS}
    </style>
</head>
<body>
    <div class="markdown-content">
${result.html}
    </div>`;

        // Include scripts if requested
        if (includeScripts && result.scripts?.inline?.length > 0) {
            const scriptContent = result.scripts.inline.join('\n\n');
            html += `\n    <script>\n${scriptContent}\n    </script>`;
        }

        html += `\n</body>\n</html>`;

        return html;
    }

    /**
     * Get default base CSS for published pages
     * @deprecated Base CSS is now loaded from external files via PublishService.loadMarkdownCSS()
     * @private
     */
    getDefaultBaseCSS() {
        // CSS has been moved to external files:
        // - client/styles/8-content/markdown-base.css
        // - client/styles/8-content/markdown-interactive.css
        // Returning empty string - callers should use PublishService instead
        return '';
    }

    /**
     * Escape HTML entities
     * @private
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create and export singleton instance
export const markdownRenderingService = new MarkdownRenderingService();

export default markdownRenderingService;
