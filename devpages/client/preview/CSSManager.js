/**
 * CSSManager - Manages scoped CSS loading and cleanup
 * Handles CSS isolation between user content, plugins, and editor UI
 */

import DOMPurify from '/client/vendor/scripts/dompurify.es.js';

const log = window.APP?.services?.log?.createLogger('CSSManager') || console;

/**
 * CSSManager - Manages CSS lifecycle for scoped contexts
 */
export class CSSManager {
  constructor(scope = 'preview') {
    this.scope = scope;
    this.loadedFiles = new Set();
    this.scopeClass = `css-scope-${scope}`;
  }

  /**
   * Simple path joining utility
   */
  joinPath(base, relative) {
    const baseParts = base.split('/').filter(p => p && p !== '.');

    // If base is a file path, get its directory
    if (baseParts.length > 0 && base.includes('.') && base.lastIndexOf('.') > base.lastIndexOf('/')) {
      baseParts.pop();
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
   * Resolve CSS path relative to markdown file
   * @param {string} cssPath - CSS path from frontmatter
   * @param {string} markdownFilePath - Source markdown file path
   * @returns {string} Resolved URL
   */
  resolveCSSPath(cssPath, markdownFilePath) {
    const trimmedPath = cssPath.trim();

    // Absolute URLs
    if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
      return trimmedPath;
    }

    // Already an API path
    if (trimmedPath.startsWith('/api/')) {
      return trimmedPath;
    }

    // Root-relative path
    if (trimmedPath.startsWith('/')) {
      return `/api/files/content?pathname=${encodeURIComponent(trimmedPath.substring(1))}`;
    }

    // Relative paths
    if (trimmedPath.startsWith('./') || trimmedPath.startsWith('../')) {
      const fileDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/'));
      const resolvedPath = this.joinPath(fileDir, trimmedPath);
      return `/api/files/content?pathname=${encodeURIComponent(resolvedPath)}`;
    }

    // Default: treat as relative to markdown file directory
    const fileDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/'));
    const resolvedPath = this.joinPath(fileDir, trimmedPath);
    return `/api/files/content?pathname=${encodeURIComponent(resolvedPath)}`;
  }

  /**
   * Load CSS files from frontmatter css_includes
   * @param {Array<string>} cssIncludes - CSS paths from frontmatter
   * @param {string} markdownFilePath - Source file path
   * @returns {Promise<Array>} Array of loaded link elements
   */
  async loadFrontmatterCSS(cssIncludes, markdownFilePath) {
    if (!Array.isArray(cssIncludes) || cssIncludes.length === 0) {
      return [];
    }

    const links = [];

    for (const cssPath of cssIncludes) {
      if (typeof cssPath !== 'string' || cssPath.trim() === '') {
        continue;
      }

      try {
        const resolvedUrl = this.resolveCSSPath(cssPath, markdownFilePath);
        const linkId = `${this.scope}-css-${this.hashString(resolvedUrl)}`;

        // Skip if already loaded
        if (this.loadedFiles.has(linkId)) {
          log.debug?.('CSS', 'ALREADY_LOADED', `CSS already loaded: ${cssPath}`);
          continue;
        }

        // Create and append link element
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = resolvedUrl;
        link.dataset.scope = this.scope;
        link.dataset.source = 'frontmatter';
        link.classList.add(this.scopeClass);

        // Wait for CSS to load
        await new Promise((resolve, reject) => {
          link.onload = resolve;
          link.onerror = () => {
            log.error?.('CSS', 'LOAD_FAILED', `Failed to load CSS: ${cssPath}`);
            reject(new Error(`Failed to load CSS: ${cssPath}`));
          };
          document.head.appendChild(link);
        });

        this.loadedFiles.add(linkId);
        links.push(link);

        log.info?.('CSS', 'LOADED', `Loaded CSS: ${cssPath} -> ${resolvedUrl}`);
      } catch (error) {
        log.error?.('CSS', 'LOAD_ERROR', `Error loading CSS ${cssPath}: ${error.message}`, error);
      }
    }

    return links;
  }

  /**
   * Load plugin CSS files
   * @param {Array} plugins - Array of plugin instances
   * @returns {Promise<Array>} Array of loaded link elements
   */
  async loadPluginCSS(plugins) {
    const links = [];

    for (const plugin of plugins) {
      if (!plugin.cssUrls || !Array.isArray(plugin.cssUrls)) {
        continue;
      }

      for (const cssUrl of plugin.cssUrls) {
        const linkId = `${this.scope}-plugin-${plugin.id}-${this.hashString(cssUrl)}`;

        if (this.loadedFiles.has(linkId)) {
          continue;
        }

        try {
          const link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          link.type = 'text/css';
          link.href = cssUrl;
          link.dataset.scope = this.scope;
          link.dataset.source = 'plugin';
          link.dataset.plugin = plugin.id;
          link.classList.add(this.scopeClass);

          await new Promise((resolve, reject) => {
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
          });

          this.loadedFiles.add(linkId);
          links.push(link);

          log.info?.('CSS', 'PLUGIN_LOADED', `Loaded plugin CSS: ${plugin.id} -> ${cssUrl}`);
        } catch (error) {
          log.error?.('CSS', 'PLUGIN_ERROR', `Error loading plugin CSS ${cssUrl}: ${error.message}`, error);
        }
      }
    }

    return links;
  }

  /**
   * Fetch and bundle CSS content for publishing
   * @param {Array<string>} cssIncludes - CSS paths
   * @param {string} markdownFilePath - Source file path
   * @returns {Promise<string>} Bundled CSS content
   */
  async fetchAndBundleCSS(cssIncludes, markdownFilePath) {
    if (!Array.isArray(cssIncludes) || cssIncludes.length === 0) {
      return '';
    }

    let bundledCSS = '';

    for (const cssPath of cssIncludes) {
      if (typeof cssPath !== 'string' || cssPath.trim() === '') {
        continue;
      }

      try {
        const resolvedUrl = this.resolveCSSPath(cssPath, markdownFilePath);
        const response = await fetch(resolvedUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const css = await response.text();
        bundledCSS += `\n/* Source: ${cssPath} */\n${css}\n`;

        log.info?.('CSS', 'BUNDLED', `Bundled CSS: ${cssPath}`);
      } catch (error) {
        log.error?.('CSS', 'BUNDLE_ERROR', `Error bundling CSS ${cssPath}: ${error.message}`, error);
      }
    }

    return bundledCSS;
  }

  /**
   * Extract inline styles from HTML content
   * @param {string} html - HTML content
   * @returns {Object} { html, styles } - HTML without styles and extracted CSS
   */
  extractInlineStyles(html) {
    try {
      const tempDoc = new DOMParser().parseFromString(html, 'text/html');
      const styleTags = tempDoc.querySelectorAll('style');

      let extractedStyles = '';
      styleTags.forEach(style => {
        extractedStyles += style.textContent + '\n';
      });

      return {
        html: tempDoc.body.innerHTML,
        styles: extractedStyles
      };
    } catch (error) {
      log.error?.('CSS', 'EXTRACT_ERROR', `Error extracting styles: ${error.message}`, error);
      return { html, styles: '' };
    }
  }

  /**
   * Cleanup scoped CSS
   * Removes all CSS loaded by this manager instance
   */
  cleanup() {
    const selector = `link.${this.scopeClass}[data-scope="${this.scope}"]`;
    const links = document.querySelectorAll(selector);

    links.forEach(link => {
      link.remove();
      this.loadedFiles.delete(link.id);
    });

    log.info?.('CSS', 'CLEANUP', `Cleaned up ${links.length} CSS files for scope: ${this.scope}`);
  }

  /**
   * Cleanup specific source type (frontmatter, plugin)
   * @param {string} source - 'frontmatter' or 'plugin'
   */
  cleanupSource(source) {
    const selector = `link.${this.scopeClass}[data-scope="${this.scope}"][data-source="${source}"]`;
    const links = document.querySelectorAll(selector);

    links.forEach(link => {
      link.remove();
      this.loadedFiles.delete(link.id);
    });

    log.info?.('CSS', 'CLEANUP_SOURCE', `Cleaned up ${links.length} ${source} CSS files`);
  }

  /**
   * Simple string hash for generating IDs
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get loaded CSS files info
   * @returns {Array} Array of loaded file info
   */
  getLoadedFiles() {
    return Array.from(document.querySelectorAll(`link.${this.scopeClass}[data-scope="${this.scope}"]`))
      .map(link => ({
        id: link.id,
        href: link.href,
        source: link.dataset.source,
        plugin: link.dataset.plugin
      }));
  }
}

export default CSSManager;
