/**
 * PublishRenderer - Simple, clean markdown publishing
 * Creates standalone HTML pages without editor dependencies
 */

import { appStore } from '/client/appState.js';
import { parseFrontmatter } from '/client/preview/utils/frontmatterParser.js';
import { eventBus } from '/client/eventBus.js';

class PublishRenderer {
  constructor(publishManager) {
    this.publishManager = publishManager;
    this.markdownItLoaded = false;
    this.markdownIt = null;
    this.initializeMarkdownIt();
  }

  async initializeMarkdownIt() {
    if (window.markdownit) {
      this.markdownIt = window.markdownit();
    } else {
      const script = document.createElement('script');
      script.src = '/client/vendor/scripts/markdown-it.min.js';
      script.onload = () => {
        this.markdownIt = window.markdownit();
      };
      document.head.appendChild(script);
    }
  }

  /**
   * Load markdown-it library (same as preview uses)
   */
  async loadMarkdownIt() {
    if (this.markdownItLoaded && this.markdownIt) {
      return this.markdownIt;
    }

    // Load markdown-it from CDN (same as preview)
    if (typeof window.markdownit === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/client/vendor/scripts/markdown-it.min.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // Configure markdown-it for publishing (simpler than editor)
    this.markdownIt = new window.markdownit({
      html: true,
      xhtmlOut: false,
      breaks: true,
      langPrefix: 'language-',
      linkify: true,
      typographer: true
    });

    this.markdownItLoaded = true;
    return this.markdownIt;
  }

  /**
   * Get base CSS content for published pages (theme-aware)
   */
  async getBaseCss() {
    // Use theme-aware CSS instead of hardcoded md.css
    // Fallback minimal CSS for publishing
    return `
      * { box-sizing: border-box; }
      body { 
        margin: 0; padding: 20px; max-width: 800px; margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6; color: #333; background: #fff;
      }
      h1, h2, h3, h4, h5, h6 { margin-top: 2em; margin-bottom: 1em; font-weight: 600; }
      h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
      pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
      code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; }
      img { max-width: 100%; height: auto; }
    `;
  }

  /**
   * Get additional CSS from settings (only content-relevant CSS)
   */
  async getSettingsCss() {
    const state = appStore.getState();
    const { activeCssFiles = [], bundleCss = true } = state.settings?.preview || {};
    
    if (!bundleCss || activeCssFiles.length === 0) {
      return '';
    }

    let settingsCss = '';
    for (const cssPath of activeCssFiles) {
      // Skip editor CSS files - only include content CSS
      if (cssPath.includes('/client/') && (
        cssPath.includes('/panels/') ||
        cssPath.includes('/settings/') ||
        cssPath.includes('/components/') ||
        cssPath.includes('/layout/') ||
        cssPath.includes('/code/') ||
        cssPath.includes('/log/') ||
        cssPath.includes('/styles/')
      )) {
        console.log(`Skipping editor CSS: ${cssPath}`);
        continue;
      }

      try {
        const response = await fetch(cssPath, { credentials: 'include' });
        if (response.ok) {
          const css = await response.text();
          settingsCss += `\n/* From: ${cssPath} */\n${css}\n`;
        }
      } catch (error) {
        console.warn(`Could not load CSS file: ${cssPath}`, error);
      }
    }
    
    return settingsCss;
  }

  /**
   * Render markdown to clean, standalone HTML
   */
  async renderToHtml(markdownContent, title = 'Published Page', options = {}) {
    const md = await this.loadMarkdownIt();
    
    // Parse frontmatter
    const { frontMatter, body } = parseFrontmatter(markdownContent || '');
    
    // Use frontmatter title if available
    const pageTitle = frontMatter.title || title;
    
    // Render markdown body
    const htmlContent = md.render(body);
    
    // Get CSS content
    const baseCss = await this.getBaseCss();
    const settingsCss = await this.getSettingsCss();
    const combinedCss = baseCss + settingsCss;

    // Build complete HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <meta name="generator" content="DevPages Publisher">
    
    <style>
${combinedCss}
    </style>
</head>
<body>
    <div class="markdown-content">
${htmlContent}
    </div>
</body>
</html>`;

    return {
      html,
      title: pageTitle,
      frontMatter
    };
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