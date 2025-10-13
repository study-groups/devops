/**
 * MarkdownRenderingService - Unified markdown rendering service
 * Consolidates preview, publish, and general markdown rendering
 */

import DOMPurify from '/client/vendor/scripts/dompurify.es.js';
import { parseFrontmatter } from './utils/frontmatterParser.js';
import { MarkdownFactory } from './MarkdownFactory.js';
import { CSSManager } from './CSSManager.js';
import { pluginRegistry } from './PluginRegistry.js';

const log = window.APP?.services?.log?.createLogger('MarkdownRenderingService') || console;

/**
 * DOMPurify configurations for different modes
 */
const DOMPURIFY_CONFIGS = {
  preview: {
    ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'track', 'style', 'link', 'meta',
               'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary',
               'div', 'span', 'p', 'pre', 'code', 'ul', 'ol', 'li',
               'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'a', 'br', 'hr',
               'em', 'strong', 'del', 'ins', 'blockquote', 'figure', 'figcaption'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'srcdoc',
               'target', 'rel', 'type', 'href', 'media', 'charset', 'name', 'content',
               'property', 'http-equiv', 'open', 'id', 'class', 'style', 'width', 'height',
               'alt', 'title', 'datetime', 'cite', 'lang', 'start', 'value', 'colspan',
               'rowspan', 'scope', 'placeholder', 'required', 'disabled', 'checked',
               'selected', 'autoplay', 'controls', 'loop', 'muted', 'poster', 'preload',
               'reversed', 'for', 'accept', 'max', 'min', 'step', 'pattern', 'maxlength',
               'minlength', 'readonly', 'spellcheck', 'draggable', 'contenteditable'],
    FORCE_BODY: false,
    ALLOW_DATA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: true,
    WHOLE_DOCUMENT: false,
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
    ALLOW_ARIA_ATTR: true,
    ALLOW_COMMENTS: true
  },
  publish: {
    // Stricter for published content
    ADD_TAGS: ['div', 'span', 'p', 'pre', 'code', 'ul', 'ol', 'li',
               'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'a', 'br', 'hr',
               'em', 'strong', 'del', 'ins', 'blockquote', 'figure', 'figcaption',
               'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary'],
    ADD_ATTR: ['id', 'class', 'style', 'href', 'src', 'alt', 'title', 'width', 'height',
               'colspan', 'rowspan', 'scope', 'target', 'rel'],
    FORCE_BODY: false,
    ALLOW_DATA_ATTR: false,
    WHOLE_DOCUMENT: false,
    USE_PROFILES: { html: true, svg: false, mathMl: true }
  }
};

/**
 * MarkdownRenderingService - Main rendering service
 */
export class MarkdownRenderingService {
  constructor() {
    this.cssManager = null;
  }

  /**
   * Main render method - converts markdown to HTML with full processing
   * @param {string} content - Raw markdown content
   * @param {string} filePath - Source file path
   * @param {string} mode - 'preview' or 'publish'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Render result
   */
  async render(content, filePath, mode = 'preview', options = {}) {
    log.info?.('RENDER', 'START', `Rendering markdown (${mode}): ${filePath}`);

    try {
      // Parse frontmatter
      const { frontMatter, body } = parseFrontmatter(content || '');

      // Get enabled plugins
      const plugins = pluginRegistry.getEnabledPlugins();

      // Preprocess content (e.g., KaTeX blocks)
      let processedBody = MarkdownFactory.preprocessContent(body, plugins);

      // Create markdown-it instance
      const md = await MarkdownFactory.createInstance(filePath, { mode, plugins });

      // Render to HTML
      const htmlRaw = md.render(processedBody);

      // Extract and process scripts
      const { html: htmlNoScripts, scripts } = this.extractScripts(htmlRaw, frontMatter);

      // Process CSS
      const styles = await this.processCSS(frontMatter, filePath, mode, plugins);

      // Sanitize HTML
      const htmlClean = this.sanitize(htmlNoScripts, mode);

      // Extract metadata
      const metadata = this.extractMetadata(frontMatter, body);

      return {
        html: htmlClean,
        frontMatter,
        scripts,
        styles,
        metadata,
        mode,
        filePath
      };

    } catch (error) {
      log.error?.('RENDER', 'ERROR', `Rendering failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Extract scripts from HTML and frontmatter
   * @param {string} html - HTML content
   * @param {Object} frontMatter - Frontmatter object
   * @returns {Object} { html, scripts }
   */
  extractScripts(html, frontMatter) {
    const scripts = {
      external: [],
      inline: []
    };

    // Extract from frontmatter
    if (frontMatter.js_includes && Array.isArray(frontMatter.js_includes)) {
      scripts.external = [...frontMatter.js_includes];
    }

    if (frontMatter.script && typeof frontMatter.script === 'string') {
      scripts.inline.push(frontMatter.script);
    }

    // Extract inline scripts from HTML
    try {
      const tempDoc = new DOMParser().parseFromString(html, 'text/html');
      const scriptTags = tempDoc.body.querySelectorAll('script:not([src])');

      scriptTags.forEach(scriptTag => {
        if (scriptTag.textContent) {
          scripts.inline.push(scriptTag.textContent);
        }
        scriptTag.remove();
      });

      return {
        html: tempDoc.body.innerHTML,
        scripts
      };
    } catch (error) {
      log.error?.('RENDER', 'SCRIPT_EXTRACT_ERROR', `Error extracting scripts: ${error.message}`, error);
      return { html, scripts };
    }
  }

  /**
   * Process CSS includes
   * @param {Object} frontMatter - Frontmatter object
   * @param {string} filePath - Source file path
   * @param {string} mode - 'preview' or 'publish'
   * @param {Array} plugins - Plugin instances
   * @returns {Promise<Object>} CSS information
   */
  async processCSS(frontMatter, filePath, mode, plugins) {
    const cssManager = new CSSManager(mode);

    const styles = {
      frontmatter: [],
      plugin: [],
      bundled: ''
    };

    // Load frontmatter CSS
    if (frontMatter.css_includes && Array.isArray(frontMatter.css_includes)) {
      if (mode === 'preview') {
        // For preview, inject link tags
        const links = await cssManager.loadFrontmatterCSS(frontMatter.css_includes, filePath);
        styles.frontmatter = links.map(l => l.href);
      } else {
        // For publish, bundle CSS content
        styles.bundled = await cssManager.fetchAndBundleCSS(frontMatter.css_includes, filePath);
      }
    }

    // Load plugin CSS
    if (mode === 'preview') {
      const links = await cssManager.loadPluginCSS(plugins);
      styles.plugin = links.map(l => l.href);
    }

    return styles;
  }

  /**
   * Sanitize HTML based on mode
   * @param {string} html - HTML content
   * @param {string} mode - 'preview' or 'publish'
   * @returns {string} Sanitized HTML
   */
  sanitize(html, mode) {
    const config = DOMPURIFY_CONFIGS[mode] || DOMPURIFY_CONFIGS.preview;
    return DOMPurify.sanitize(html, config);
  }

  /**
   * Extract metadata from frontmatter and content
   * @param {Object} frontMatter - Frontmatter object
   * @param {string} body - Markdown body
   * @returns {Object} Metadata
   */
  extractMetadata(frontMatter, body) {
    return {
      title: frontMatter.title || 'Untitled',
      description: frontMatter.description || '',
      author: frontMatter.author || '',
      date: frontMatter.date || '',
      tags: frontMatter.tags || [],
      wordCount: body.split(/\s+/).length,
      charCount: body.length
    };
  }

  /**
   * Post-process rendered content (handle scripts, plugins, etc.)
   * @param {HTMLElement} container - Container element
   * @param {Object} renderResult - Result from render()
   * @returns {Promise<void>}
   */
  async postProcess(container, renderResult) {
    log.info?.('POST_PROCESS', 'START', `Post-processing: ${renderResult.filePath}`);

    if (!container) {
      log.warn?.('POST_PROCESS', 'NO_CONTAINER', 'No container element provided');
      return;
    }

    try {
      // Set HTML content
      container.innerHTML = renderResult.html;

      // Execute scripts (preview mode only)
      if (renderResult.mode === 'preview' && renderResult.scripts) {
        await this.executeScripts(container, renderResult.scripts, renderResult.filePath);
      }

      // Process plugins
      await pluginRegistry.processEnabledPlugins(container);

      // Dispatch ready event
      const event = new CustomEvent('preview:contentready', {
        bubbles: true,
        cancelable: false,
        detail: {
          filePath: renderResult.filePath,
          mode: renderResult.mode,
          metadata: renderResult.metadata
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
   * Execute scripts from render result
   * @param {HTMLElement} container - Container element
   * @param {Object} scripts - Scripts object
   * @param {string} filePath - Source file path
   * @returns {Promise<void>}
   */
  async executeScripts(container, scripts, filePath) {
    const scriptParts = [];

    // Fetch and add external scripts
    if (scripts.external && scripts.external.length > 0) {
      log.info?.('SCRIPTS', 'FETCH', `Fetching ${scripts.external.length} external scripts`);

      for (const scriptUrl of scripts.external) {
        try {
          const resolvedUrl = this.resolveScriptPath(scriptUrl, filePath);
          const response = await fetch(resolvedUrl);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const content = await response.text();
          scriptParts.push(`\n// External: ${scriptUrl}\ntry {\n${content}\n} catch (error) {\n  console.error("Error in ${scriptUrl}:", error);\n}\n`);

          log.info?.('SCRIPTS', 'LOADED', `Loaded external script: ${scriptUrl}`);
        } catch (error) {
          log.error?.('SCRIPTS', 'LOAD_ERROR', `Failed to load script ${scriptUrl}: ${error.message}`, error);
          scriptParts.push(`console.error("Failed to load script ${scriptUrl}: ${error.message}");`);
        }
      }
    }

    // Add inline scripts
    if (scripts.inline && scripts.inline.length > 0) {
      scripts.inline.forEach((content, i) => {
        if (content && content.trim()) {
          scriptParts.push(`\n// Inline Script #${i + 1}\ntry {\n${content}\n} catch (error) {\n  console.error("Error in inline script #${i + 1}:", error);\n}\n`);
        }
      });
    }

    // Execute bundled scripts
    if (scriptParts.length > 0) {
      const bundledScript = scriptParts.join('\n');
      log.info?.('SCRIPTS', 'EXECUTE', `Executing ${scriptParts.length} scripts (${bundledScript.length} chars)`);

      try {
        const scriptElement = document.createElement('script');
        scriptElement.type = 'text/javascript';
        scriptElement.textContent = bundledScript;
        container.appendChild(scriptElement);

        log.info?.('SCRIPTS', 'SUCCESS', 'Scripts executed successfully');
      } catch (error) {
        log.error?.('SCRIPTS', 'EXECUTE_ERROR', `Script execution failed: ${error.message}`, error);
      }
    }
  }

  /**
   * Resolve script path (similar to CSS path resolution)
   * @param {string} scriptPath - Script path
   * @param {string} filePath - Source file path
   * @returns {string} Resolved URL
   */
  resolveScriptPath(scriptPath, filePath) {
    const trimmed = scriptPath.trim();

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    if (trimmed.startsWith('/api/')) {
      return trimmed;
    }

    if (trimmed.startsWith('/')) {
      return `/api/files/content?pathname=${encodeURIComponent(trimmed.substring(1))}`;
    }

    // Relative paths
    const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
    const cssManager = new CSSManager('preview');
    const resolved = cssManager.joinPath(fileDir, trimmed);
    return `/api/files/content?pathname=${encodeURIComponent(resolved)}`;
  }

  /**
   * Render to standalone HTML (for publishing)
   * @param {string} content - Markdown content
   * @param {string} filePath - Source file path
   * @param {Object} options - Publishing options
   * @returns {Promise<string>} Complete HTML document
   */
  async renderToStandaloneHTML(content, filePath, options = {}) {
    const {
      title = 'Published Page',
      includeScripts = false,
      bundleCSS = true,
      baseCSS = this.getDefaultBaseCSS()
    } = options;

    // Render markdown
    const result = await this.render(content, filePath, 'publish');

    // Build HTML document
    const pageTitle = result.frontMatter.title || title;
    const metaTags = this.generateMetaTags(result.metadata);
    const cssContent = bundleCSS ? (baseCSS + '\n' + result.styles.bundled) : baseCSS;

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(pageTitle)}</title>
    <meta name="generator" content="DevPages Publisher">
    ${metaTags}

    <style>
${cssContent}
    </style>
</head>
<body>
    <div class="markdown-content">
${result.html}
    </div>`;

    // Include scripts if requested
    if (includeScripts && result.scripts) {
      const scriptContent = this.bundleScriptsForPublish(result.scripts);
      if (scriptContent) {
        html += `\n    <script>\n${scriptContent}\n    </script>`;
      }
    }

    html += `\n</body>\n</html>`;

    return html;
  }

  /**
   * Generate meta tags for HTML head
   * @param {Object} metadata - Metadata object
   * @returns {string} Meta tags HTML
   */
  generateMetaTags(metadata) {
    let tags = '';

    if (metadata.description) {
      tags += `    <meta name="description" content="${this.escapeHtml(metadata.description)}">\n`;
    }

    if (metadata.author) {
      tags += `    <meta name="author" content="${this.escapeHtml(metadata.author)}">\n`;
    }

    if (metadata.tags && metadata.tags.length > 0) {
      tags += `    <meta name="keywords" content="${this.escapeHtml(metadata.tags.join(', '))}">\n`;
    }

    return tags;
  }

  /**
   * Bundle scripts for publishing
   * @param {Object} scripts - Scripts object
   * @returns {string} Bundled script content
   */
  bundleScriptsForPublish(scripts) {
    const parts = [];

    if (scripts.inline && scripts.inline.length > 0) {
      scripts.inline.forEach((content, i) => {
        if (content && content.trim()) {
          parts.push(`// Inline Script #${i + 1}\n${content}`);
        }
      });
    }

    return parts.join('\n\n');
  }

  /**
   * Get default base CSS for published pages
   * @returns {string} CSS content
   */
  getDefaultBaseCSS() {
    return `
* { box-sizing: border-box; }
body {
  margin: 0; padding: 20px; max-width: 800px; margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6; color: #333; background: #fff;
}
h1, h2, h3, h4, h5, h6 {
  margin-top: 2em; margin-bottom: 1em; font-weight: 600; line-height: 1.25;
}
h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
p { margin-bottom: 1em; }
pre {
  background: #f6f8fa; padding: 16px; border-radius: 6px;
  overflow-x: auto; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}
code {
  background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 85%;
}
pre code { background: none; padding: 0; }
img { max-width: 100%; height: auto; }
a { color: #0366d6; text-decoration: none; }
a:hover { text-decoration: underline; }
table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
blockquote {
  margin: 0; padding: 0 1em; color: #666; border-left: 0.25em solid #ddd;
}
    `.trim();
  }

  /**
   * Escape HTML entities
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create singleton instance
export const markdownRenderingService = new MarkdownRenderingService();

export default markdownRenderingService;
