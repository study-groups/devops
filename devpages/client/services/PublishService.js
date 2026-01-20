/**
 * PublishService - Centralized HTML generation and publishing
 *
 * Refactored to use focused service classes for CSS, scripts, HTML assembly, and images.
 *
 * Semantic naming:
 * - renderTarget: 'preview' | 'publish' (what we're generating for)
 * - cssStrategy: 'embedded' | 'linked' | 'hybrid' (how CSS is delivered)
 * - publishTarget: the S3/Spaces configuration for publishing
 */

import { appStore } from '/client/appState.js';
import { markdownRenderingService } from '/client/preview/MarkdownRenderingService.js';
import { selectActiveConfigurationDecrypted } from '/client/store/slices/publishConfigSlice.js';
import { themeService } from './ThemeService.js';
import { cssBuilder } from './publish/CSSBuilder.js';
import { scriptInjector } from './publish/ScriptInjector.js';
import { htmlAssembler } from './publish/HTMLAssembler.js';
import { imageEmbedder } from './publish/ImageEmbedder.js';

const log = window.APP?.services?.log?.createLogger('PublishService') || console;

class PublishService {
  /**
   * Generate complete HTML document for preview or publishing
   * @param {string} markdownContent - Markdown source
   * @param {string} filePath - Source file path
   * @param {Object} options - Generation options
   * @param {string} options.renderTarget - 'preview' | 'publish'
   * @param {string} options.cssStrategy - 'embedded' | 'linked' | 'hybrid' (publish only)
   * @param {Object} options.theme - Theme object (required for preview)
   * @param {Object} options.publishTarget - Publish config (optional)
   * @returns {Promise<string>} Complete HTML document
   */
  async generateDocumentHtml(markdownContent, filePath, options = {}) {
    const renderTarget = options.renderTarget || 'publish';
    const isPreview = renderTarget === 'preview';
    const title = filePath?.replace(/\.md$/, '') || 'Document';

    log.info?.('GENERATE', 'START', `Generating ${renderTarget} HTML for ${filePath}`);

    // Get state
    const state = appStore.getState();
    const pluginsState = state.plugins?.plugins || {};
    const theme = options.theme || themeService.currentTheme;
    const publishTarget = options.publishTarget || selectActiveConfigurationDecrypted(state);

    // Get enabled plugins for rendering
    const enabledPlugins = Object.entries(pluginsState)
      .filter(([_, plugin]) => plugin.enabled)
      .map(([id, plugin]) => ({ id, ...plugin }));

    // Render markdown
    const renderResult = await markdownRenderingService.render(markdownContent, filePath, {
      mode: renderTarget, // MarkdownRenderingService still uses 'mode'
      enabledPlugins
    });
    log.info?.('RENDER', 'SUCCESS', `Rendered ${renderResult.html?.length || 0} chars of HTML`);

    // Build CSS bundle
    const css = await cssBuilder.bundleCSS(renderResult, {
      renderTarget,
      cssStrategy: options.cssStrategy,
      theme,
      publishTarget,
      filePath
    });

    // Embed images (publish only)
    const htmlContent = renderResult.html || '';
    const finalContent = isPreview
      ? htmlContent
      : await imageEmbedder.embedImagesAsBase64(htmlContent);

    // Build plugin scripts
    const scripts = scriptInjector.buildPluginScripts({
      pluginsState,
      isPreview,
      theme
    });

    // Generate runtime metadata and JS (publish only)
    const metadata = isPreview ? '' : this.generateRuntimeMetadata(filePath, publishTarget, renderResult.frontMatter || {});
    const runtimeJS = isPreview ? '' : await this.loadRuntimeJS();

    // Assemble final document
    const finalHtml = htmlAssembler.assembleDocument(
      { content: finalContent, css, scripts, metadata, runtimeJS },
      { renderTarget, title, theme, pluginsState }
    );

    log.info?.('GENERATE', 'COMPLETE', `Generated ${finalHtml.length} chars of HTML`);
    return finalHtml;
  }

  /**
   * Generate clean HTML for publishing (wrapper for generateDocumentHtml)
   * @param {string} markdownContent - Markdown source
   * @param {string} filePath - Source file path
   * @param {Object} options - Generation options
   * @param {string} options.cssStrategy - 'embedded' | 'linked' | 'hybrid' (default: from config or 'embedded')
   * @returns {Promise<string>} Complete HTML document
   */
  async generatePublishHtml(markdownContent, filePath, options = {}) {
    return this.generateDocumentHtml(markdownContent, filePath, {
      ...options,
      renderTarget: 'publish'
    });
  }

  /**
   * Generate HTML for preview iframe
   * @param {string} markdownContent - Markdown source
   * @param {string} filePath - Source file path
   * @param {Object} theme - Current theme object
   * @returns {Promise<string>} Complete HTML for iframe srcdoc
   */
  async generatePreviewHtml(markdownContent, filePath, theme = null) {
    return this.generateDocumentHtml(markdownContent, filePath, {
      renderTarget: 'preview',
      theme: theme || themeService.currentTheme
    });
  }

  /**
   * Generate runtime metadata for smart published pages
   */
  generateRuntimeMetadata(filePath, publishTarget, frontMatter) {
    const metadata = {
      publishedAt: new Date().toISOString(),
      version: '1.0.0',
      sourceFile: filePath,
      sourceUrl: `devpages://edit?file=${encodeURIComponent(filePath)}`,
      collection: null,
      publishTarget: publishTarget ? {
        bucket: publishTarget.bucket,
        prefix: publishTarget.prefix,
        endpoint: publishTarget.endpoint
      } : null,
      frontMatter: {
        title: frontMatter.title || null,
        css_includes: frontMatter.css_includes || []
      }
    };

    return `window.DevPages = ${JSON.stringify(metadata, null, 2)};`;
  }

  /**
   * Load DevPages runtime JavaScript
   */
  async loadRuntimeJS() {
    try {
      const response = await fetch('/client/runtime/devpages-runtime.js');
      if (!response.ok) {
        log.warn?.('RUNTIME', 'JS_LOAD_FAIL', 'Failed to load runtime JS');
        return '';
      }
      return await response.text();
    } catch (error) {
      log.error?.('RUNTIME', 'JS_ERROR', `Error loading runtime JS: ${error.message}`, error);
      return '';
    }
  }

  /**
   * Publish content (dispatch to different targets)
   */
  async publish(markdownContent, filePath, options = {}) {
    const html = await this.generatePublishHtml(markdownContent, filePath, options);

    const state = appStore.getState();
    const publishTarget = selectActiveConfigurationDecrypted(state);

    if (!publishTarget) {
      throw new Error('No publish configuration selected. Please configure publishing in the Publish panel.');
    }

    return this.publishToSpaces(html, filePath, publishTarget);
  }

  /**
   * Publish to Digital Ocean Spaces
   */
  async publishToSpaces(htmlContent, filePath, publishTarget) {
    const response = await window.APP.services.globalFetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pathname: filePath,
        htmlContent: htmlContent,
        config: {
          endpoint: publishTarget.endpoint,
          region: publishTarget.region,
          bucket: publishTarget.bucket,
          accessKey: publishTarget.accessKey,
          secretKey: publishTarget.secretKey,
          prefix: publishTarget.prefix,
          baseUrl: publishTarget.baseUrl
        }
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Server error: ${response.status}`);
    }

    return { success: true, url: result.url, type: 'spaces' };
  }

  /**
   * Download as local file
   */
  downloadFile(htmlContent, filePath) {
    const filename = filePath ? filePath.replace(/\.md$/, '.html').replace(/\//g, '-') : 'published.html';

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, type: 'download', filename };
  }
}

export const publishService = new PublishService();
