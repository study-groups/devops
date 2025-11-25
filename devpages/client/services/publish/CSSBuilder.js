/**
 * CSSBuilder - Handles CSS collection, bundling, and generation for publishing
 */

import { CSSManager } from '/client/preview/CSSManager.js';

const log = window.APP?.services?.log?.createLogger('CSSBuilder') || console;

export class CSSBuilder {
  /**
   * Bundle all CSS for document generation
   * @param {Object} renderResult - Result from markdown rendering
   * @param {Object} options - Bundling options
   * @param {string} options.mode - 'preview' or 'publish'
   * @param {Object} options.theme - Theme object
   * @param {Object} options.activeConfig - Publish configuration
   * @param {string} options.filePath - Source file path
   * @returns {Promise<Object>} CSS bundle with different sections
   */
  async bundleCSS(renderResult, options) {
    const { mode, theme, activeConfig, filePath } = options;
    const isPreview = mode === 'preview';
    const frontMatter = renderResult.frontMatter || {};

    log.info?.('CSS', 'BUNDLE_START', `Bundling CSS for ${mode} mode`);

    // Collect CSS sources in order of precedence
    const cssSources = this.collectCSSSources(frontMatter, activeConfig);

    // Bundle external CSS using CSSManager
    const cssManager = new CSSManager(mode);
    const bundledCSS = await cssManager.fetchAndBundleCSS(cssSources, filePath);
    log.info?.('CSS', 'EXTERNAL_BUNDLED', `Bundled ${bundledCSS?.length || 0} chars of external CSS`);

    // Load base markdown CSS from external files
    const baseCSS = await this.loadMarkdownCSS();

    // Generate theme CSS (preview only)
    const themeCSS = isPreview ? this.generateThemeCSS(theme) : '';

    // Load runtime CSS (publish only)
    const runtimeCSS = isPreview ? '' : await this.loadRuntimeCSS();

    log.info?.('CSS', 'BUNDLE_COMPLETE', `Total CSS: base=${baseCSS.length}, theme=${themeCSS.length}, bundled=${bundledCSS?.length || 0}, runtime=${runtimeCSS.length}`);

    return {
      base: baseCSS,
      theme: themeCSS,
      bundled: bundledCSS || '',
      runtime: runtimeCSS
    };
  }

  /**
   * Collect CSS sources from frontmatter and config
   * @param {Object} frontMatter - Parsed frontmatter
   * @param {Object} activeConfig - Publish configuration
   * @returns {Array<string>} Array of CSS URLs
   */
  collectCSSSources(frontMatter, activeConfig) {
    const cssSources = [];

    // 1. Config theme URL (site-wide theme)
    if (activeConfig?.themeUrl) {
      cssSources.push(activeConfig.themeUrl);
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
   * Generate inline CSS for theme variables
   * @param {Object} theme - Theme object with colors, typography, etc.
   * @returns {string} CSS variable declarations
   */
  generateThemeCSS(theme) {
    if (!theme) {
      log.warn?.('CSS', 'NO_THEME', 'No theme provided to generateThemeCSS');
      return `:root {
  --color-bg: #ffffff;
  --color-fg: #111827;
  --color-primary: #3b82f6;
  --color-border: #e5e7eb;
  --color-text-default: #333333;
  --color-text-emphasis: #000000;
  --color-background-default: #ffffff;
  --color-background-subtle: #f9fafb;
}`;
    }

    log.info?.('CSS', 'THEME_GENERATE', `Generating CSS for theme: ${theme.id || 'unknown'} (${theme.mode})`);
    const cssLines = [':root {'];

    // Apply color tokens
    if (theme.colors) {
      Object.entries(theme.colors).forEach(([name, value]) => {
        cssLines.push(`  --color-${name}: ${value};`);
      });
    }

    // Apply typography tokens
    if (theme.typography) {
      Object.entries(theme.typography).forEach(([name, value]) => {
        cssLines.push(`  --font-${name}: ${value};`);
      });
    }

    // Apply spacing tokens
    if (theme.spacing) {
      Object.entries(theme.spacing).forEach(([name, value]) => {
        cssLines.push(`  --spacing-${name}: ${value};`);
      });
    }

    // Apply effect tokens
    if (theme.effects) {
      Object.entries(theme.effects).forEach(([name, value]) => {
        const prefix = name.startsWith('shadow') ? 'shadow' :
                       name.startsWith('radius') ? 'radius' :
                       name.startsWith('transition') ? 'transition' :
                       name.startsWith('animation') ? 'animation' : 'effect';
        cssLines.push(`  --${prefix}-${name.replace(prefix + '-', '')}: ${value};`);
      });
    }

    cssLines.push('}');
    const result = cssLines.join('\n');
    log.info?.('CSS', 'THEME_COMPLETE', `Generated ${result.length} chars of theme CSS`);
    return result;
  }
}

export const cssBuilder = new CSSBuilder();
