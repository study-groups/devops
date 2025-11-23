/**
 * Centralized publish service - single source of truth for HTML generation and publishing
 * ✅ MODERNIZED: Enhanced Redux patterns with optimized selectors
 */

import { workspaceManager } from '../components/WorkspaceManager.js';
import { appStore } from '/client/appState.js';
import { markdownRenderingService } from '/client/preview/MarkdownRenderingService.js';
import { getPanelLayoutState } from '/client/store/enhancedSelectors.js';
import { selectActiveConfigurationDecrypted } from '/client/store/slices/publishConfigSlice.js';
import { CSSManager } from '/client/preview/CSSManager.js';
import { themeService } from './ThemeService.js';

class PublishService {
  /**
   * Generate complete HTML document for preview or publishing
   * @param {string} markdownContent - Markdown source
   * @param {string} filePath - Source file path
   * @param {Object} options - Generation options
   * @param {string} options.mode - 'preview' | 'publish'
   * @param {Object} options.theme - Theme object (required for preview)
   * @param {Object} options.config - Publish config (optional)
   * @returns {Promise<string>} Complete HTML document
   */
  async generateDocumentHtml(markdownContent, filePath, options = {}) {
    const mode = options.mode || 'publish';
    const isPreview = mode === 'preview';
    const title = filePath?.replace(/\.md$/, '') || 'Document';

    console.log('[PublishService] generateDocumentHtml called:', { mode, filePath, hasOptions: !!options });

    // Get enabled plugins from state
    const state = appStore.getState();
    const enabledPlugins = Object.entries(state.plugins?.plugins || {})
        .filter(([_, plugin]) => plugin.enabled)
        .map(([id, plugin]) => ({ id, ...plugin }));

    // Render markdown and extract frontmatter
    const renderResult = await markdownRenderingService.render(markdownContent, filePath, {
        mode,
        enabledPlugins
    });
    console.log('[PublishService] renderMarkdown result:', {
      hasHtml: !!renderResult.html,
      htmlLength: renderResult.html?.length,
      hasFrontMatter: !!renderResult.frontMatter
    });

    // renderMarkdown returns an object with { html, frontMatter, scripts, styles, ... }
    const htmlContent = renderResult.html || '';
    const frontMatter = renderResult.frontMatter || {};
    console.log('[PublishService] Extracted htmlContent length:', htmlContent.length);

    // Get publish configuration (optional for preview)
    const activeConfig = options.config || selectActiveConfigurationDecrypted(state);

    // Collect CSS sources in order of precedence
    const cssSources = [];

    // 1. Config theme URL (site-wide theme)
    if (activeConfig?.themeUrl) {
      cssSources.push(activeConfig.themeUrl);
    }

    // 2. Frontmatter CSS includes (page-specific)
    if (frontMatter.css_includes && Array.isArray(frontMatter.css_includes)) {
      cssSources.push(...frontMatter.css_includes);
    }

    // Bundle CSS using CSSManager
    const cssManager = new CSSManager(mode);
    const bundledCSS = await cssManager.fetchAndBundleCSS(cssSources, filePath);
    console.log('[PublishService] Bundled CSS length:', bundledCSS?.length || 0);

    // Generate theme CSS inline (for preview mode or publish)
    const theme = options.theme || themeService.currentTheme;
    console.log('[PublishService] Using theme for preview:', theme?.id, theme?.mode);
    const themeCSS = isPreview ? this.generateThemeCSS(theme) : '';
    console.log('[PublishService] Theme CSS length:', themeCSS?.length || 0, 'isPreview:', isPreview);

    // Base CSS for markdown content using DevPages theme variables
    const baseCSS = `
      /* Themed scrollbar styles */
      ::-webkit-scrollbar {
        width: 12px;
        height: 12px;
      }
      ::-webkit-scrollbar-track {
        background: var(--color-bg-alt, #f9fafb);
        border-radius: 6px;
      }
      ::-webkit-scrollbar-thumb {
        background: var(--color-border, #d0d7de);
        border-radius: 6px;
        border: 2px solid var(--color-bg-alt, #f9fafb);
      }
      ::-webkit-scrollbar-thumb:hover {
        background: var(--color-neutral-default, #999);
      }
      ::-webkit-scrollbar-thumb:active {
        background: var(--color-primary-default, #0969da);
      }
      /* Firefox scrollbar */
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--color-border, #d0d7de) var(--color-bg-alt, #f9fafb);
      }

      body {
        font-family: var(--font-family-base, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif);
        line-height: var(--font-line-height-normal, 1.6);
        color: var(--color-text, #333);
        background: var(--color-bg, #ffffff);
        max-width: 900px;
        margin: 0 auto;
        padding: var(--spacing-xl, 2rem);
      }
      .markdown-content h1 {
        font-size: var(--font-size-4xl, 2.25rem);
        font-weight: var(--font-weight-bold, 700);
        color: var(--color-text, #000);
        margin-top: var(--spacing-2xl, 2rem);
        margin-bottom: var(--spacing-lg, 1rem);
        line-height: 1.2;
      }
      .markdown-content h2 {
        font-size: var(--font-size-3xl, 1.875rem);
        font-weight: var(--font-weight-semibold, 600);
        color: var(--color-text, #000);
        margin-top: var(--spacing-xl, 1.5rem);
        margin-bottom: var(--spacing-md, 0.75rem);
        line-height: 1.3;
      }
      .markdown-content h3 {
        font-size: var(--font-size-2xl, 1.5rem);
        font-weight: var(--font-weight-semibold, 600);
        color: var(--color-text, #333);
        margin-top: var(--spacing-lg, 1.25rem);
        margin-bottom: var(--spacing-sm, 0.5rem);
      }
      .markdown-content h4 {
        font-size: var(--font-size-xl, 1.25rem);
        font-weight: var(--font-weight-medium, 500);
        margin-top: var(--spacing-md, 1rem);
        margin-bottom: var(--spacing-sm, 0.5rem);
      }
      .markdown-content p {
        margin-top: var(--spacing-md, 1rem);
        margin-bottom: var(--spacing-md, 1rem);
      }
      .markdown-content code {
        background: var(--color-code-bg, #f6f8fa);
        color: var(--color-code-fg, #24292f);
        padding: 0.2em 0.4em;
        border-radius: var(--radius-sm, 3px);
        font-family: var(--font-family-mono, 'Monaco', 'Courier New', monospace);
        font-size: 0.9em;
      }
      .markdown-content pre {
        background: var(--color-code-background, #f6f8fa);
        padding: var(--spacing-lg, 1rem);
        border-radius: var(--radius-md, 6px);
        overflow-x: auto;
        border: 1px solid var(--color-border-subtle, #d0d7de);
      }
      .markdown-content pre code {
        background: none;
        padding: 0;
        border: none;
      }
      .markdown-content a {
        color: var(--color-primary-default, #0969da);
        text-decoration: none;
      }
      .markdown-content a:hover {
        text-decoration: underline;
        color: var(--color-primary-emphasis, #0550ae);
      }
      .markdown-content blockquote {
        border-left: 4px solid var(--color-border-default, #d0d7de);
        margin: var(--spacing-lg, 1rem) 0;
        padding-left: var(--spacing-lg, 1rem);
        color: var(--color-text-subtle, #656d76);
      }
      .markdown-content ul, .markdown-content ol {
        padding-left: var(--spacing-2xl, 2em);
        margin: var(--spacing-md, 1rem) 0;
      }
      .markdown-content li {
        margin: var(--spacing-xs, 0.25rem) 0;
      }
      .markdown-content img {
        max-width: 100%;
        height: auto;
        border-radius: var(--radius-md, 6px);
      }
      .markdown-content hr {
        border: none;
        border-top: 1px solid var(--color-border-default, #d0d7de);
        margin: var(--spacing-2xl, 2rem) 0;
      }
      .markdown-content table {
        border-collapse: collapse;
        width: 100%;
        margin: var(--spacing-lg, 1rem) 0;
      }
      .markdown-content th, .markdown-content td {
        border: 1px solid var(--color-border-default, #d0d7de);
        padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 1rem);
        text-align: left;
      }
      .markdown-content th {
        background: var(--color-bg-alt, #f6f8fa);
        font-weight: var(--font-weight-semibold, 600);
      }
      /* Form elements and sliders */
      .markdown-content input[type="range"] {
        width: 100%;
        height: 8px;
        background: var(--color-border, #d0d7de);
        border-radius: 4px;
        outline: none;
        margin: var(--spacing-md, 1rem) 0;
        -webkit-appearance: none;
        appearance: none;
      }
      .markdown-content input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        background: var(--color-primary-default, #0969da);
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid var(--color-bg, #ffffff);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .markdown-content input[type="range"]::-moz-range-thumb {
        width: 18px;
        height: 18px;
        background: var(--color-primary-default, #0969da);
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid var(--color-bg, #ffffff);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .markdown-content input[type="range"]::-webkit-slider-runnable-track {
        height: 8px;
        background: var(--color-border, #d0d7de);
        border-radius: 4px;
      }
      .markdown-content input[type="range"]::-moz-range-track {
        height: 8px;
        background: var(--color-border, #d0d7de);
        border-radius: 4px;
      }
      .markdown-content input[type="text"],
      .markdown-content input[type="number"],
      .markdown-content input[type="email"],
      .markdown-content textarea,
      .markdown-content select {
        padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 1rem);
        border: 1px solid var(--color-border, #d0d7de);
        border-radius: var(--radius-sm, 3px);
        background: var(--color-bg, #ffffff);
        color: var(--color-text, #333);
        font-family: inherit;
        font-size: var(--font-size-base, 1rem);
      }
      .markdown-content input:focus,
      .markdown-content textarea:focus,
      .markdown-content select:focus {
        outline: none;
        border-color: var(--color-primary-default, #0969da);
        box-shadow: 0 0 0 3px var(--color-primary-subtle, rgba(9, 105, 218, 0.1));
      }
    `;

    // Load runtime CSS and JS (publish only)
    const runtimeCSS = isPreview ? '' : await this.loadRuntimeCSS();
    const runtimeJS = isPreview ? '' : await this.loadRuntimeJS();

    // Embed images as base64 (publish only, preview uses URLs for speed)
    const finalHtmlContent = isPreview ? htmlContent : await this.embedImagesAsBase64(htmlContent);

    // Generate runtime metadata (publish only)
    const metadata = isPreview ? '' : this.generateRuntimeMetadata(filePath, activeConfig, frontMatter);

    // Check which plugins are enabled for preview
    const pluginsState = state.plugins?.plugins || {};
    const katexEnabled = pluginsState.katex?.enabled;
    const mermaidEnabled = pluginsState.mermaid?.enabled;

    // Generate complete HTML document
    const finalHtml = `<!DOCTYPE html>
<html lang="en" ${isPreview ? '' : `data-theme="${(options.theme || themeService.currentTheme)?.mode || 'light'}"`}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${isPreview ? '' : '<meta name="generator" content="DevPages Publisher">'}
    <style>
/* Base CSS for Markdown Content */
${baseCSS}
    </style>
    ${themeCSS ? `<style>\n/* Theme CSS Variables */\n${themeCSS}\n    </style>` : ''}
    ${bundledCSS ? `<style>\n/* Content CSS */\n${bundledCSS}\n    </style>` : ''}
    ${runtimeCSS ? `<style>\n/* DevPages Runtime CSS */\n${runtimeCSS}\n    </style>` : ''}
    ${katexEnabled && isPreview ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">' : ''}
</head>
<body${isPreview ? ` class="theme-${(options.theme || themeService.currentTheme)?.mode || 'light'}"` : ''}>
    <div class="markdown-content">
${finalHtmlContent}
    </div>
${metadata ? `
    <!-- DevPages Runtime Metadata -->
    <script>
${metadata}
    </script>` : ''}
${runtimeJS ? `
    <!-- DevPages Runtime Script -->
    <script>
${runtimeJS}
    </script>` : ''}
${katexEnabled && isPreview ? `
    <!-- KaTeX Scripts -->
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" crossorigin="anonymous"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" crossorigin="anonymous" onload="renderMath()"></script>
    <script>
      function renderMath() {
        renderMathInElement(document.body, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\\\[', right: '\\\\]', display: true},
            {left: '\\\\(', right: '\\\\)', display: false}
          ],
          throwOnError: false
        });
      }
    </script>` : ''}
${mermaidEnabled && isPreview ? `
    <!-- Mermaid Script -->
    <script src="/client/vendor/scripts/mermaid.min.js"></script>
    <script>
      // Initialize and render mermaid diagrams
      (function() {
        if (typeof mermaid === 'undefined') {
          console.error('Mermaid library not loaded');
          return;
        }

        mermaid.initialize({
          startOnLoad: true,
          theme: '${(options.theme || themeService.currentTheme)?.mode === 'dark' ? 'dark' : 'default'}',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true
          }
        });

        // Force init after load
        window.addEventListener('load', function() {
          try {
            if (mermaid.run) {
              mermaid.run();
            } else if (mermaid.init) {
              mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            }
          } catch(e) {
            console.error('Mermaid rendering error:', e);
          }
        });
      })();
    </script>
    <style>
      /* Mermaid diagram styling */
      .mermaid {
        background: transparent !important;
        text-align: center;
        margin: 1em 0;
        color: var(--color-fg, #e5e5e5);
      }
      pre.mermaid {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
      }
      /* Fix dark theme text visibility */
      .mermaid svg {
        max-width: 100%;
      }
      /* Better text visibility */
      .mermaid .nodeLabel,
      .mermaid .edgeLabel,
      .mermaid .label {
        color: inherit !important;
      }
    </style>` : ''}
${isPreview ? '' : `
    <footer style="margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 0.9em;">
        Published with DevPages
    </footer>`}
${isPreview ? `
    <script>
      // Wait for all async plugins (Mermaid, KaTeX, Graphviz, etc.) to finish rendering
      // then notify parent that preview is ready
      (function() {
        function notifyReady() {
          window.parent.postMessage('preview-ready', '*');
        }

        // Track which plugins need to finish
        const pluginChecks = [];

        // Check for Mermaid diagrams
        const mermaidElements = document.querySelectorAll('.mermaid');
        if (mermaidElements.length > 0) {
          pluginChecks.push(() => {
            // Wait for Mermaid library to load AND render
            if (!window.mermaid) return false;

            // Check if all mermaid elements have SVG children with content
            return Array.from(mermaidElements).every(el => {
              const svg = el.querySelector('svg');
              if (!svg) return false;

              // Ensure SVG has actual content (not empty)
              const hasElements = svg.children.length > 0;

              // Check if SVG has rendered dimensions
              try {
                const bbox = svg.getBBox();
                return hasElements && bbox.width > 0 && bbox.height > 0;
              } catch (e) {
                // getBBox can fail if SVG isn't ready
                return false;
              }
            });
          });
        }

        // Check for KaTeX math (waits for fonts/layout)
        const katexElements = document.querySelectorAll('.katex');
        if (katexElements.length > 0) {
          pluginChecks.push(() => {
            // KaTeX is sync but fonts may load async
            // Check if any katex elements have zero dimensions (not rendered yet)
            return Array.from(katexElements).every(el => el.offsetHeight > 0);
          });
        }

        // Check for Graphviz diagrams
        const graphvizElements = document.querySelectorAll('.graphviz, [data-graphviz]');
        if (graphvizElements.length > 0) {
          pluginChecks.push(() => {
            // Check if SVG has been inserted
            return Array.from(graphvizElements).every(el => el.querySelector('svg'));
          });
        }

        // Generic check: wait for all images to load
        const images = document.querySelectorAll('img');
        if (images.length > 0) {
          let imagesLoaded = 0;
          const totalImages = images.length;

          pluginChecks.push(() => imagesLoaded >= totalImages);

          images.forEach(img => {
            if (img.complete) {
              imagesLoaded++;
            } else {
              img.addEventListener('load', () => imagesLoaded++);
              img.addEventListener('error', () => imagesLoaded++);
            }
          });
        }

        // If no async content detected, still wait a bit for DOM to settle
        if (pluginChecks.length === 0) {
          setTimeout(notifyReady, 100);
          return;
        }

        // Poll all checks until complete
        let pollCount = 0;
        const maxPolls = 40; // 40 * 50ms = 2 seconds max

        const checkAll = setInterval(() => {
          pollCount++;

          const allReady = pluginChecks.every(check => check());

          if (allReady || pollCount >= maxPolls) {
            clearInterval(checkAll);
            // Extra delay to ensure layout is completely stable after plugins render
            setTimeout(notifyReady, 150);
          }
        }, 50);
      })();
    </script>` : ''}
</body>
</html>`;

    console.log('[PublishService] Generated HTML length:', finalHtml.length);
    console.log('[PublishService] HTML preview (first 1000 chars):', finalHtml.substring(0, 1000));
    return finalHtml;
  }

  /**
   * Generate inline CSS for theme variables
   * @param {Object} theme - Theme object with colors, typography, etc.
   * @returns {string} CSS variable declarations
   */
  generateThemeCSS(theme) {
    if (!theme) {
      console.warn('[PublishService] No theme provided to generateThemeCSS');
      // Return minimal light theme fallback CSS
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

    console.log('[PublishService] Generating theme CSS for:', theme.id || 'unknown', 'mode:', theme.mode);
    console.log('[PublishService] Theme colors:', theme.colors ? Object.keys(theme.colors).length + ' keys' : 'none');
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
    console.log('[PublishService] Generated theme CSS (first 500 chars):', result.substring(0, 500));
    return result;
  }

  /**
   * Generate clean HTML for publishing (wrapper for generateDocumentHtml)
   * ✅ MODERNIZED: Uses unified document generator
   */
  async generatePublishHtml(markdownContent, filePath, options = {}) {
    return this.generateDocumentHtml(markdownContent, filePath, {
      ...options,
      mode: 'publish'
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
      mode: 'preview',
      theme: theme || themeService.currentTheme
    });
  }

  /**
   * Generate runtime metadata for smart published pages
   */
  generateRuntimeMetadata(filePath, config, frontMatter) {
    const metadata = {
      publishedAt: new Date().toISOString(),
      version: '1.0.0',
      sourceFile: filePath,
      sourceUrl: `devpages://edit?file=${encodeURIComponent(filePath)}`,
      collection: null, // Will be populated by runtime if collection.json found
      config: config ? {
        bucket: config.bucket,
        prefix: config.prefix,
        endpoint: config.endpoint
      } : null,
      frontMatter: {
        title: frontMatter.title || null,
        css_includes: frontMatter.css_includes || []
      }
    };

    return `window.DevPages = ${JSON.stringify(metadata, null, 2)};`;
  }

  /**
   * Load DevPages runtime CSS
   */
  async loadRuntimeCSS() {
    try {
      const response = await fetch('/client/runtime/devpages-runtime.css');
      if (!response.ok) {
        console.warn('[PublishService] Failed to load runtime CSS');
        return '';
      }
      return await response.text();
    } catch (error) {
      console.error('[PublishService] Error loading runtime CSS:', error);
      return '';
    }
  }

  /**
   * Load DevPages runtime JavaScript
   */
  async loadRuntimeJS() {
    try {
      const response = await fetch('/client/runtime/devpages-runtime.js');
      if (!response.ok) {
        console.warn('[PublishService] Failed to load runtime JS');
        return '';
      }
      return await response.text();
    } catch (error) {
      console.error('[PublishService] Error loading runtime JS:', error);
      return '';
    }
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
   * @deprecated Use CSSManager.fetchAndBundleCSS() instead
   * This method captured ALL stylesheets including editor UI, causing CSS pollution
   */
  async getBaseCss() {
    console.warn('[PublishService] getBaseCss() is deprecated. Use CSSManager.fetchAndBundleCSS() instead.');
    return '';
  }

  /**
   * Publish content (dispatch to different targets)
   */
  async publish(markdownContent, filePath, options = {}) {
    const html = await this.generatePublishHtml(markdownContent, filePath, options);

    const state = appStore.getState();
    const activeConfig = selectActiveConfigurationDecrypted(state);

    if (!activeConfig) {
      throw new Error('No publish configuration selected. Please configure publishing in the Publish panel.');
    }

    // Use activeConfig instead of checking publish mode from settings
    return this.publishToSpaces(html, filePath, activeConfig);
  }

  /**
   * Publish to Digital Ocean Spaces
   */
  async publishToSpaces(htmlContent, filePath, config) {
    const response = await window.APP.services.globalFetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pathname: filePath,
        htmlContent: htmlContent,
        config: {
          endpoint: config.endpoint,
          region: config.region,
          bucket: config.bucket,
          accessKey: config.accessKey,
          secretKey: config.secretKey,
          prefix: config.prefix,
          baseUrl: config.baseUrl
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