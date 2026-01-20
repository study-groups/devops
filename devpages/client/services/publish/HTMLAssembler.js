/**
 * HTMLAssembler - Assembles final HTML document from parts
 *
 * Supports embedded, linked, and hybrid CSS strategies.
 *
 * Semantic naming:
 * - renderTarget: 'preview' | 'publish'
 * - cssStrategy: 'embedded' | 'linked' | 'hybrid' (from css.strategy)
 * - colorScheme: 'dark' | 'light'
 */

const log = window.APP?.services?.log?.createLogger('HTMLAssembler') || console;

export class HTMLAssembler {
  /**
   * Assemble complete HTML document
   * @param {Object} parts - Document parts
   * @param {string} parts.content - Main HTML content
   * @param {Object} parts.css - CSS bundle from CSSBuilder (with strategy and urls)
   * @param {string} parts.scripts - Script content from ScriptInjector
   * @param {string} parts.metadata - Runtime metadata (publish only)
   * @param {string} parts.runtimeJS - Runtime JavaScript (publish only)
   * @param {Object} options - Assembly options
   * @param {string} options.renderTarget - 'preview' or 'publish'
   * @param {string} options.title - Document title
   * @param {Object} options.theme - Theme object (contains colorScheme as .mode)
   * @param {Object} options.pluginsState - Plugin enabled states
   * @returns {string} Complete HTML document
   */
  assembleDocument(parts, options) {
    const { content, css, scripts, metadata, runtimeJS } = parts;
    const { renderTarget, title, theme, pluginsState } = options;
    const isPreview = renderTarget === 'preview';
    const colorScheme = theme?.mode || 'light';
    const cssStrategy = css.strategy || 'embedded';

    log.info?.('ASSEMBLE', 'START', `Assembling ${renderTarget} document (strategy: ${cssStrategy}): ${title}`);

    const head = this.buildHead({
      title,
      css,
      isPreview,
      colorScheme,
      katexEnabled: pluginsState?.katex?.enabled
    });

    const body = this.buildBody({
      content,
      scripts,
      metadata,
      runtimeJS,
      isPreview,
      colorScheme
    });

    const html = `<!DOCTYPE html>
<html lang="en" data-color-scheme="${colorScheme}">
${head}
${body}
</html>`;

    log.info?.('ASSEMBLE', 'COMPLETE', `Assembled ${html.length} chars of HTML`);
    return html;
  }

  /**
   * Build document head - routes to appropriate CSS builder
   * @private
   */
  buildHead({ title, css, isPreview, colorScheme, katexEnabled }) {
    const cssOutput = this.buildCSSOutput(css);
    const katexLink = katexEnabled && isPreview
      ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">'
      : '';

    return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)}</title>
    ${isPreview ? '' : '<meta name="generator" content="DevPages Publisher">'}
${cssOutput}
    ${katexLink}
</head>`;
  }

  /**
   * Build CSS output based on strategy (embedded, linked, or hybrid)
   * @private
   */
  buildCSSOutput(css) {
    const cssStrategy = css.strategy || 'embedded';

    if (cssStrategy === 'linked') {
      return this.buildLinkedCSS(css);
    }

    if (cssStrategy === 'hybrid') {
      return this.buildHybridCSS(css);
    }

    // Default: embedded
    return this.buildEmbeddedCSS(css);
  }

  /**
   * Build embedded <style> tags (all CSS inlined)
   * @private
   */
  buildEmbeddedCSS(css) {
    const tags = [];

    if (css.markdown) {
      tags.push(`    <style>
/* Markdown CSS - Embedded for durability */
${css.markdown}
    </style>`);
    }

    if (css.colorScheme) {
      tags.push(`    <style>
/* Color Scheme CSS Variables */
${css.colorScheme}
    </style>`);
    }

    if (css.custom) {
      tags.push(`    <style>
/* Custom CSS */
${css.custom}
    </style>`);
    }

    if (css.runtime) {
      tags.push(`    <style>
/* DevPages Runtime CSS */
${css.runtime}
    </style>`);
    }

    return tags.join('\n');
  }

  /**
   * Build linked <link> tags (all CSS external)
   * @private
   */
  buildLinkedCSS(css) {
    const links = [];
    const urls = css.urls || {};

    if (urls.markdown) {
      links.push(`    <link rel="stylesheet" href="${urls.markdown}">`);
    }

    if (urls.colorSchemeBase) {
      links.push(`    <link rel="stylesheet" href="${urls.colorSchemeBase}">`);
    }

    if (urls.colorScheme) {
      links.push(`    <link rel="stylesheet" href="${urls.colorScheme}" data-color-scheme-css>`);
    }

    if (urls.runtime) {
      links.push(`    <link rel="stylesheet" href="${urls.runtime}">`);
    }

    // Custom CSS includes
    if (urls.custom && urls.custom.length > 0) {
      urls.custom.forEach(url => {
        links.push(`    <link rel="stylesheet" href="${url}">`);
      });
    }

    return links.join('\n');
  }

  /**
   * Build hybrid output - markdown embedded, color scheme linked
   * Best for durability + flexibility
   * @private
   */
  buildHybridCSS(css) {
    const parts = [];

    // Embedded: markdown CSS (structural, durable)
    if (css.markdown) {
      parts.push(`    <style>
/* Markdown CSS - Embedded for durability */
${css.markdown}
    </style>`);
    }

    // Embedded: custom CSS
    if (css.custom) {
      parts.push(`    <style>
/* Custom CSS */
${css.custom}
    </style>`);
    }

    // Linked: color scheme CSS (flexible, updatable)
    const urls = css.urls || {};
    if (urls.colorSchemeBase || urls.colorScheme) {
      parts.push(`    <!-- Color Scheme CSS - Linked for flexibility -->`);
    }

    if (urls.colorSchemeBase) {
      parts.push(`    <link rel="stylesheet" href="${urls.colorSchemeBase}">`);
    }

    if (urls.colorScheme) {
      parts.push(`    <link rel="stylesheet" href="${urls.colorScheme}" data-color-scheme-css>`);
    }

    return parts.join('\n');
  }

  /**
   * Build document body
   * @private
   */
  buildBody({ content, scripts, metadata, runtimeJS, isPreview, colorScheme }) {
    const bodyClass = isPreview ? ` class="color-scheme-${colorScheme}"` : '';
    const metadataScript = metadata ? `
    <!-- DevPages Runtime Metadata -->
    <script>
${metadata}
    </script>` : '';

    const runtimeScript = runtimeJS ? `
    <!-- DevPages Runtime Script -->
    <script>
${runtimeJS}
    </script>` : '';

    const footer = isPreview ? '' : `
    <footer style="margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 0.9em;">
        Published with DevPages
    </footer>`;

    return `<body${bodyClass}>
    <div class="markdown-content">
${content}
    </div>
${metadataScript}
${runtimeScript}
${scripts}
${footer}
</body>`;
  }

  /**
   * Escape HTML entities
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const htmlAssembler = new HTMLAssembler();
