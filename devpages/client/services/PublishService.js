/**
 * Centralized publish service - single source of truth for HTML generation and publishing
 */

import { appStore } from '/client/appState.js';
import { renderMarkdown } from '/client/preview/renderer.js';
import { parseFrontmatter } from '/client/preview/utils/frontmatterParser.js';

class PublishService {
  /**
   * Generate clean HTML for publishing (THE SINGLE SOURCE OF TRUTH)
   */
  async generatePublishHtml(markdownContent, filePath, options = {}) {
    const { frontMatter, body } = parseFrontmatter(markdownContent);
    
    // Render markdown using existing renderer
    const renderResult = await renderMarkdown(body, filePath);
    
    const title = frontMatter.title || filePath?.replace(/\.md$/, '') || 'Document';
    
    // Clean, minimal CSS - NO DOM SCRAPING
    const baseCSS = await this.getBaseCss();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="generator" content="DevPages Publisher">
    ${frontMatter.description ? `<meta name="description" content="${frontMatter.description}">` : ''}
    
    <style>
${baseCSS}
    </style>
</head>
<body>
    <div class="markdown-content">
${renderResult.html}
    </div>
    <footer style="margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 0.9em;">
        Published with DevPages
    </footer>
</body>
</html>`;
  }

  /**
   * Get base CSS (just md.css content inline)
   */
  async getBaseCss() {
    try {
      const response = await fetch('/client/preview/md.css');
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.warn('Could not load md.css:', error);
    }
    
    // Fallback CSS
    return `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 20px; max-width: 800px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
      h1, h2, h3, h4, h5, h6 { margin-top: 2em; margin-bottom: 1em; font-weight: 600; }
      h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
      pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
      code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; }
      img { max-width: 100%; height: auto; }
    `;
  }

  /**
   * Publish content (dispatch to different targets)
   */
  async publish(markdownContent, filePath, options = {}) {
    const html = await this.generatePublishHtml(markdownContent, filePath, options);
    
    const state = appStore.getState();
    const publishMode = state.settings?.publish?.mode || 'local';
    
    if (publishMode === 'spaces') {
      return this.publishToSpaces(html, filePath);
    } else {
      return this.downloadFile(html, filePath);
    }
  }

  /**
   * Publish to Digital Ocean Spaces
   */
  async publishToSpaces(htmlContent, filePath) {
    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pathname: filePath,
        htmlContent: htmlContent
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