/**
 * Main Preview Renderer - Routes different file types to appropriate renderers
 * Extensible system for supporting .md, .js, .json, images, etc.
 */

// Helper for logging
function logPreviewRenderer(message, level = 'info') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(`[PreviewRenderer] ${message}`, level, 'PREVIEW_RENDERER');
    } else {
        console.log(`[PreviewRenderer] ${message}`);
    }
}

export class PreviewRenderer {
    constructor() {
        this.renderers = new Map();
        this.rendererCache = new Map();
        this.registerDefaultRenderers();
    }

    /**
     * Register default file type renderers
     */
    registerDefaultRenderers() {
        // Markdown files
        this.registerRenderer('md', () => import('./renderers/MarkdownRenderer.js'));
        this.registerRenderer('markdown', () => import('./renderers/MarkdownRenderer.js'));
        
        // HTML files
        this.registerRenderer('html', () => import('/client/panels/renderers/HtmlRenderer.js'));
        this.registerRenderer('htm', () => import('/client/panels/renderers/HtmlRenderer.js'));
        
        // Future renderers (commented out until implemented)
        // this.registerRenderer('js', () => import('./renderers/JavaScriptRenderer.js'));
        // this.registerRenderer('ts', () => import('./renderers/TypeScriptRenderer.js'));
        // this.registerRenderer('json', () => import('./renderers/JsonRenderer.js'));
        // this.registerRenderer('css', () => import('./renderers/CssRenderer.js'));
        
        logPreviewRenderer('Default renderers registered');
    }

    /**
     * Register a renderer for a file extension
     * @param {string} extension - File extension (without dot)
     * @param {Function} importFn - Function that returns import promise
     */
    registerRenderer(extension, importFn) {
        this.renderers.set(extension.toLowerCase(), importFn);
        logPreviewRenderer(`Registered renderer for .${extension} files`);
    }

    /**
     * Get file extension from path
     * @param {string} filePath - File path
     * @returns {string} Extension without dot
     */
    getFileExtension(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            return 'txt'; // Default fallback
        }
        const lastDot = filePath.lastIndexOf('.');
        if (lastDot === -1) {
            return 'txt'; // No extension
        }
        return filePath.substring(lastDot + 1).toLowerCase();
    }

    /**
     * Get renderer for file extension (with caching)
     * @param {string} extension - File extension
     * @returns {Promise<Object>} Renderer instance
     */
    async getRenderer(extension) {
        const ext = extension.toLowerCase();
        
        // Return cached renderer
        if (this.rendererCache.has(ext)) {
            return this.rendererCache.get(ext);
        }

        // Get renderer import function
        const importFn = this.renderers.get(ext);
        if (!importFn) {
            // Fallback to plain text renderer
            logPreviewRenderer(`No renderer found for .${ext}, using plain text fallback`);
            return this.getPlainTextRenderer();
        }

        try {
            // Import and instantiate renderer
            const module = await importFn();
            const RendererClass = module.MarkdownRenderer || module.HtmlRenderer || module.JavaScriptRenderer || module.default;
            const renderer = new RendererClass();
            
            // Cache the renderer
            this.rendererCache.set(ext, renderer);
            logPreviewRenderer(`Loaded renderer for .${ext} files`);
            
            return renderer;
        } catch (error) {
            logPreviewRenderer(`Failed to load renderer for .${ext}: ${error.message}`, 'error');
            return this.getPlainTextRenderer();
        }
    }

    /**
     * Get plain text fallback renderer
     * @returns {Object} Plain text renderer
     */
    getPlainTextRenderer() {
        return {
            async render(content, filePath, previewElement) {
                logPreviewRenderer(`Rendering as plain text: ${filePath}`);
                
                // Simple HTML-escaped content in <pre> tag
                const escapedContent = content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
                
                return {
                    html: `<pre><code>${escapedContent}</code></pre>`,
                    head: '',
                    frontMatter: {},
                    externalScriptUrls: [],
                    inlineScriptContents: []
                };
            },
            
            async postProcess(previewElement, result, filePath) {
                // No post-processing needed for plain text
                logPreviewRenderer(`Plain text post-processing complete for: ${filePath}`);
            }
        };
    }

    /**
     * Main render method - routes to appropriate renderer
     * @param {string} content - File content
     * @param {string} filePath - File path  
     * @param {HTMLElement} previewElement - Preview container element
     * @returns {Promise<Object>} Render result
     */
    async render(content, filePath, previewElement) {
        logPreviewRenderer(`Rendering file: ${filePath}`);
        
        const extension = this.getFileExtension(filePath);
        const renderer = await this.getRenderer(extension);
        
        try {
            // Render content
            const result = await renderer.render(content, filePath, previewElement);
            
            // Post-process if method exists
            if (typeof renderer.postProcess === 'function') {
                await renderer.postProcess(previewElement, result, filePath);
            }
            
            logPreviewRenderer(`Successfully rendered ${filePath} (${extension})`);
            return result;
            
        } catch (error) {
            logPreviewRenderer(`Error rendering ${filePath}: ${error.message}`, 'error');
            
            // Fallback to plain text on error
            const fallbackRenderer = this.getPlainTextRenderer();
            return await fallbackRenderer.render(content, filePath, previewElement);
        }
    }

    /**
     * Get supported file extensions
     * @returns {Array<string>} List of supported extensions
     */
    getSupportedExtensions() {
        return Array.from(this.renderers.keys());
    }
}

// Export singleton instance
export const previewRenderer = new PreviewRenderer();

// Export convenience functions for backwards compatibility
export async function renderContent(content, filePath, previewElement) {
    return await previewRenderer.render(content, filePath, previewElement);
}
