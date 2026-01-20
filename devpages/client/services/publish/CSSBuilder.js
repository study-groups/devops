/**
 * CSSBuilder - Handles CSS collection, bundling, and generation for publishing
 *
 * Supports three CSS strategies:
 * - 'embedded': All CSS inlined in <style> tags (default, archival)
 * - 'linked': CSS referenced via <link> tags (themeable)
 * - 'hybrid': Markdown CSS embedded, color scheme CSS linked (recommended)
 *
 * Semantic naming:
 * - renderTarget: 'preview' | 'publish' (what we're generating for)
 * - cssStrategy: 'embedded' | 'linked' | 'hybrid' (how CSS is delivered)
 * - colorScheme: 'dark' | 'light' (visual theme)
 */

import { CSSManager } from '/client/preview/CSSManager.js';

const log = window.APP?.services?.log?.createLogger('CSSBuilder') || console;

// Default paths for linked CSS (relative to published doc location)
const DEFAULT_CSS_PATHS = {
  markdown: '../shared/markdown.css',
  colorSchemeBase: '../shared/themes/base.css',
  colorSchemeDark: '../shared/themes/dark.css',
  colorSchemeLight: '../shared/themes/light.css',
  runtime: '../shared/runtime.css'
};

export class CSSBuilder {
  /**
   * Bundle all CSS for document generation
   * @param {Object} renderResult - Result from markdown rendering
   * @param {Object} options - Bundling options
   * @param {string} options.renderTarget - 'preview' or 'publish'
   * @param {string} options.cssStrategy - 'embedded' | 'linked' | 'hybrid' (publish only)
   * @param {Object} options.theme - Theme object (contains colorScheme as .mode)
   * @param {Object} options.publishTarget - Publish configuration
   * @param {string} options.filePath - Source file path
   * @returns {Promise<Object>} CSS bundle with content and/or URLs
   */
  async bundleCSS(renderResult, options) {
    const { renderTarget, theme, publishTarget, filePath } = options;
    const isPreview = renderTarget === 'preview';
    const frontMatter = renderResult.frontMatter || {};

    // CSS strategy only applies to publish; preview always embeds
    const cssStrategy = isPreview
      ? 'embedded'
      : (options.cssStrategy || publishTarget?.cssStrategy || 'embedded');

    const cssPaths = { ...DEFAULT_CSS_PATHS, ...(publishTarget?.cssPaths || {}) };
    const colorScheme = theme?.mode || 'dark';

    log.info?.('CSS', 'BUNDLE_START', `Bundling CSS for ${renderTarget} (strategy: ${cssStrategy}, scheme: ${colorScheme})`);

    // Route to appropriate bundle builder
    if (cssStrategy === 'linked') {
      return this.buildLinkedBundle(colorScheme, cssPaths, frontMatter, publishTarget);
    }

    if (cssStrategy === 'hybrid') {
      return this.buildHybridBundle(colorScheme, cssPaths, frontMatter, publishTarget, filePath);
    }

    // Default: embedded strategy
    return this.buildEmbeddedBundle(renderResult, options);
  }

  /**
   * Build fully embedded CSS bundle (all CSS inlined)
   * @private
   */
  async buildEmbeddedBundle(renderResult, options) {
    const { renderTarget, theme, publishTarget, filePath } = options;
    const isPreview = renderTarget === 'preview';
    const frontMatter = renderResult.frontMatter || {};
    const colorScheme = theme?.mode || 'dark';

    // Collect CSS sources in order of precedence
    const cssSources = this.collectCSSSources(frontMatter, publishTarget);

    // Bundle external CSS using CSSManager
    const cssManager = new CSSManager(renderTarget);
    const customCSS = await cssManager.fetchAndBundleCSS(cssSources, filePath);
    log.info?.('CSS', 'EXTERNAL_BUNDLED', `Bundled ${customCSS?.length || 0} chars of external CSS`);

    // Load markdown structural CSS
    const markdownCSS = await this.loadMarkdownCSS();

    // Load color scheme CSS (for both preview AND publish in embedded mode)
    const colorSchemeCSS = await this.loadColorSchemeCSS(colorScheme);

    // Load runtime CSS (publish only)
    const runtimeCSS = isPreview ? '' : await this.loadRuntimeCSS();

    log.info?.('CSS', 'BUNDLE_COMPLETE', `Total CSS: markdown=${markdownCSS.length}, colorScheme=${colorSchemeCSS.length}, custom=${customCSS?.length || 0}, runtime=${runtimeCSS.length}`);

    return {
      strategy: 'embedded',
      markdown: markdownCSS,
      colorScheme: colorSchemeCSS,
      custom: customCSS || '',
      runtime: runtimeCSS,
      urls: null
    };
  }

  /**
   * Build fully linked CSS bundle - all CSS via <link> tags
   * @private
   */
  buildLinkedBundle(colorScheme, cssPaths, frontMatter, publishTarget) {
    const urls = {
      markdown: cssPaths.markdown,
      colorSchemeBase: cssPaths.colorSchemeBase,
      colorScheme: colorScheme === 'dark' ? cssPaths.colorSchemeDark : cssPaths.colorSchemeLight,
      runtime: cssPaths.runtime,
      custom: frontMatter.css_includes || []
    };

    // Add config theme URL if specified
    if (publishTarget?.themeUrl) {
      urls.custom.unshift(publishTarget.themeUrl);
    }

    log.info?.('CSS', 'LINKED_BUNDLE', `Built linked bundle with colorScheme: ${urls.colorScheme}`);

    return {
      strategy: 'linked',
      markdown: '',
      colorScheme: '',
      custom: '',
      runtime: '',
      urls
    };
  }

  /**
   * Build hybrid CSS bundle - markdown embedded, color scheme linked
   * Best for durability + flexibility
   * @private
   */
  async buildHybridBundle(colorScheme, cssPaths, frontMatter, publishTarget, filePath) {
    // Embed structural CSS for durability
    const markdownCSS = await this.loadMarkdownCSS();

    // Bundle any custom CSS includes (embed these too)
    const cssSources = this.collectCSSSources(frontMatter, publishTarget);
    const cssManager = new CSSManager('publish');
    const customCSS = await cssManager.fetchAndBundleCSS(cssSources, filePath);

    // Link color scheme CSS for flexibility
    const urls = {
      colorSchemeBase: cssPaths.colorSchemeBase,
      colorScheme: colorScheme === 'dark' ? cssPaths.colorSchemeDark : cssPaths.colorSchemeLight
    };

    log.info?.('CSS', 'HYBRID_BUNDLE', `Built hybrid bundle: ${markdownCSS.length} chars embedded, colorScheme linked`);

    return {
      strategy: 'hybrid',
      markdown: markdownCSS,
      colorScheme: '',
      custom: customCSS || '',
      runtime: '',
      urls
    };
  }

  /**
   * Collect CSS sources from frontmatter and config
   * @param {Object} frontMatter - Parsed frontmatter
   * @param {Object} publishTarget - Publish configuration
   * @returns {Array<string>} Array of CSS URLs
   */
  collectCSSSources(frontMatter, publishTarget) {
    const cssSources = [];

    // 1. Config theme URL (site-wide theme)
    if (publishTarget?.themeUrl) {
      cssSources.push(publishTarget.themeUrl);
    }

    // 2. Frontmatter CSS includes (page-specific)
    if (frontMatter.css_includes && Array.isArray(frontMatter.css_includes)) {
      cssSources.push(...frontMatter.css_includes);
    }

    return cssSources;
  }

  /**
   * Load markdown content CSS (base + interactive)
   * @returns {Promise<string>} Combined markdown CSS
   */
  async loadMarkdownCSS() {
    try {
      const [baseResponse, interactiveResponse] = await Promise.all([
        fetch('/client/styles/8-content/markdown-base.css'),
        fetch('/client/styles/8-content/markdown-interactive.css')
      ]);

      if (!baseResponse.ok || !interactiveResponse.ok) {
        log.warn?.('CSS', 'MARKDOWN_LOAD_FAIL', 'Failed to load markdown CSS files');
        return '';
      }

      const [baseCss, interactiveCss] = await Promise.all([
        baseResponse.text(),
        interactiveResponse.text()
      ]);

      log.info?.('CSS', 'MARKDOWN_LOADED', `Loaded ${baseCss.length + interactiveCss.length} chars of markdown CSS`);
      return baseCss + '\n' + interactiveCss;
    } catch (error) {
      log.error?.('CSS', 'MARKDOWN_ERROR', `Error loading markdown CSS: ${error.message}`, error);
      return '';
    }
  }

  /**
   * Load DevPages runtime CSS
   * @returns {Promise<string>} Runtime CSS content
   */
  async loadRuntimeCSS() {
    try {
      const response = await fetch('/client/runtime/devpages-runtime.css');
      if (!response.ok) {
        log.warn?.('CSS', 'RUNTIME_LOAD_FAIL', 'Failed to load runtime CSS');
        return '';
      }
      return await response.text();
    } catch (error) {
      log.error?.('CSS', 'RUNTIME_ERROR', `Error loading runtime CSS: ${error.message}`, error);
      return '';
    }
  }

  /**
   * Load color scheme CSS from external files
   * @param {string} scheme - 'light' or 'dark'
   * @returns {Promise<string>} Color scheme CSS content
   */
  async loadColorSchemeCSS(scheme = 'dark') {
    try {
      // Load both base and scheme-specific CSS
      const [baseResponse, schemeResponse] = await Promise.all([
        fetch('/client/styles/themes/base.css'),
        fetch(`/client/styles/themes/${scheme}.css`)
      ]);

      let css = '';

      if (baseResponse.ok) {
        css += await baseResponse.text();
        log.info?.('CSS', 'COLORSCHEME_BASE_LOADED', 'Loaded base color scheme CSS');
      } else {
        log.warn?.('CSS', 'COLORSCHEME_BASE_FAIL', 'Failed to load base color scheme CSS');
      }

      if (schemeResponse.ok) {
        css += '\n' + await schemeResponse.text();
        log.info?.('CSS', 'COLORSCHEME_LOADED', `Loaded ${scheme} color scheme CSS`);
      } else {
        log.warn?.('CSS', 'COLORSCHEME_FAIL', `Failed to load ${scheme} color scheme CSS`);
      }

      return css;
    } catch (error) {
      log.error?.('CSS', 'COLORSCHEME_ERROR', `Error loading color scheme CSS: ${error.message}`, error);
      return '';
    }
  }
}

export const cssBuilder = new CSSBuilder();
