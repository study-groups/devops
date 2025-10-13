/**
 * PublishRenderer - Simple, clean markdown publishing
 * Creates standalone HTML pages without editor dependencies
 *
 * REFACTORED: Now uses MarkdownRenderingService architecture
 */

import { appStore } from '/client/appState.js';
import { eventBus } from '/client/eventBus.js';
import { getFilePublishSettings } from '/client/config/publishSettings.js';

const log = window.APP?.services?.log?.createLogger('PublishRenderer') || console;

class PublishRenderer {
  constructor(publishManager) {
    this.publishManager = publishManager;
  }

  /**
   * Get rendering service (lazy load)
   */
  getRenderingService() {
    if (!window.APP?.services?.markdownRenderingService) {
      throw new Error('MarkdownRenderingService not available. Ensure services are initialized.');
    }
    return window.APP.services.markdownRenderingService;
  }

  /**
   * Render markdown to clean, standalone HTML
   * Uses the new MarkdownRenderingService
   */
  async renderToHtml(markdownContent, title = 'Published Page', options = {}) {
    const renderingService = this.getRenderingService();

    // Get file path from options or current file
    const filePath = options.filePath || this.getCurrentFilePath();

    // Get publish settings
    const state = appStore.getState();
    const publishSettings = getFilePublishSettings(state, options.frontMatter);

    // Render using the new service
    const html = await renderingService.renderToStandaloneHTML(
      markdownContent,
      filePath,
      {
        title,
        includeScripts: publishSettings.bundleScripts,
        bundleCSS: publishSettings.bundleCSS,
        ...options
      }
    );

    // Extract title and frontmatter from result
    const { parseFrontmatter } = await import('/client/preview/utils/frontmatterParser.js');
    const { frontMatter } = parseFrontmatter(markdownContent || '');

    return {
      html,
      title: frontMatter.title || title,
      frontMatter
    };
  }

  /**
   * Get current file path from Redux
   */
  getCurrentFilePath() {
    const state = appStore.getState();
    return state.file?.currentFile?.pathname || 'untitled.md';
  }

  /**
   * Handle publishing based on settings (download vs S3)
   */
  async publish(markdownContent, filename, title) {
    const state = appStore.getState();
    const publishSettings = state.settings?.publish || {};
    
    const result = await this.renderToHtml(markdownContent, title);
    
    if (publishSettings.mode === 's3') {
      // S3 publishing
      return this.publishToS3(result.html, filename, publishSettings);
    } else {
      // Local download (default)
      return this.downloadFile(result.html, filename);
    }
  }

  /**
   * Download HTML file locally
   */
  downloadFile(htmlContent, filename) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true, type: 'download', filename: a.download };
  }

  /**
   * Publish to S3 (placeholder - implement based on your S3 setup)
   */
  async publishToS3(htmlContent, filename, publishSettings) {
    // Implementation depends on your S3 publishing API
    console.log('S3 publishing not yet implemented');
    return { success: false, error: 'S3 publishing not implemented' };
  }
}

export const publishRenderer = new PublishRenderer(); 