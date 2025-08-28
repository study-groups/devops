/**
 * Centralized publish service - single source of truth for HTML generation and publishing
 * ✅ MODERNIZED: Enhanced Redux patterns with optimized selectors
 */

import { workspaceManager } from '../layout/WorkspaceManager.js';
import { appStore } from '/client/appState.js';
import { renderMarkdown } from '/client/preview/renderer.js';
import { getPanelLayoutState } from '/client/store/enhancedSelectors.js';

class PublishService {
  /**
   * Generate clean HTML for publishing (THE SINGLE SOURCE OF TRUTH)
   */
  async generatePublishHtml(markdownContent, filePath, options = {}) {
    const title = filePath?.replace(/\.md$/, '') || 'Document';
    const fullHtmlDocument = await renderMarkdown(markdownContent, filePath);
    
    // Extract body content from the full HTML document
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullHtmlDocument, 'text/html');
    const htmlContent = doc.body.innerHTML;
    
    const finalHtmlContent = await this.embedImagesAsBase64(htmlContent);
    const baseCSS = await this.getBaseCss();

    // ✅ MODERNIZED: Use enhanced selector instead of hardcoded values
    const panelLayoutState = getPanelLayoutState(appStore.getState());
    const panels = []; // Panel state extraction can be added later if needed
    const layout = panelLayoutState.showSidebar ? 'sidebar-visible' : 'sidebar-hidden';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="generator" content="DevPages Publisher">
    <style>
${baseCSS}
    </style>
</head>
<body class="${layout}">
    <div class="markdown-content">
${finalHtmlContent}
    </div>
    <div class="panels-info" style="display:none;">
        ${JSON.stringify(panels.map(p => ({id: p.id, visible: p.uiState.visible})))}
    </div>
    <footer style="margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 0.9em;">
        Published with DevPages
    </footer>
</body>
</html>`;
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // result contains the data as a data URL. We only want the base64 part.
            resolve(reader.result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
  }

  async embedImagesAsBase64(htmlString) {
      if (!htmlString) return '';
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const images = Array.from(doc.querySelectorAll('img'));

      const imagePromises = images.map(async (img) => {
          const src = img.getAttribute('src');
          if (!src || src.startsWith('data:')) {
              return; // Skip data URIs or empty src
          }

          try {
              const response = await window.APP.services.globalFetch(src, { credentials: 'omit' });
              if (!response.ok) {
                  console.warn(`[PublishService] Failed to fetch image for embedding: ${src} (Status: ${response.status})`);
                  return;
              }

              const blob = await response.blob();
              const mimeType = blob.type;
              const base64String = await this.blobToBase64(blob);
              
              img.src = `data:${mimeType};base64,${base64String}`;
          } catch (error) {
              console.error(`[PublishService] Error embedding image ${src}:`, error);
          }
      });

      await Promise.all(imagePromises);
      return doc.body.innerHTML;
  }

  /**
   * Get base CSS (theme-aware styles for publishing)
   */
  async getBaseCss() {
    // Dynamically collect all CSS rules from loaded stylesheets
    const styles = [];
    
    // Convert StyleSheetList to an array to use for...of loop
    const styleSheets = Array.from(document.styleSheets);

    for (const sheet of styleSheets) {
        // Only process same-origin stylesheets to avoid security errors
        if (sheet.href && !sheet.href.startsWith(window.location.origin) && !sheet.href.startsWith('blob:')) {
            // Allow blob URLs which can be used for dynamic styles
            if (!sheet.href.startsWith('blob:')) {
                console.log(`[PublishService] Skipping cross-origin stylesheet: ${sheet.href}`);
                continue;
            }
        }

        try {
            const rules = sheet.cssRules || sheet.rules;
            const rulesArray = Array.from(rules);
            for (const rule of rulesArray) {
                styles.push(rule.cssText);
            }
        } catch (e) {
            // This can happen with cross-origin stylesheets even with the check above
            console.warn(`[PublishService] Could not read rules from stylesheet: ${sheet.href}`, e);
        }
    }
    
    return styles.join('\n');
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
    const response = await window.APP.services.globalFetch('/api/publish', {
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