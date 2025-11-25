/**
 * HTMLAssembler - Assembles final HTML document from parts
 */

const log = window.APP?.services?.log?.createLogger('HTMLAssembler') || console;

export class HTMLAssembler {
  /**
   * Assemble complete HTML document
   * @param {Object} parts - Document parts
   * @param {string} parts.content - Main HTML content
   * @param {Object} parts.css - CSS bundle from CSSBuilder
   * @param {string} parts.scripts - Script content from ScriptInjector
   * @param {string} parts.metadata - Runtime metadata (publish only)
   * @param {string} parts.runtimeJS - Runtime JavaScript (publish only)
   * @param {Object} options - Assembly options
   * @param {string} options.mode - 'preview' or 'publish'
   * @param {string} options.title - Document title
   * @param {Object} options.theme - Theme object
   * @param {Object} options.pluginsState - Plugin enabled states
   * @returns {string} Complete HTML document
   */
  assembleDocument(parts, options) {
    const { content, css, scripts, metadata, runtimeJS } = parts;
    const { mode, title, theme, pluginsState } = options;
    const isPreview = mode === 'preview';
    const themeMode = theme?.mode || 'light';

    log.info?.('ASSEMBLE', 'START', `Assembling ${mode} document: ${title}`);

    const head = this.buildHead({
      title,
      css,
      isPreview,
      themeMode,
      katexEnabled: pluginsState?.katex?.enabled
    });

    const body = this.buildBody({
      content,
      scripts,
      metadata,
      runtimeJS,
      isPreview,
      themeMode
    });

    const html = `<!DOCTYPE html>
<html lang="en" ${isPreview ? '' : `data-theme="${themeMode}"`}>
${head}
${body}
</html>`;

    log.info?.('ASSEMBLE', 'COMPLETE', `Assembled ${html.length} chars of HTML`);
    return html;
  }

  /**
   * Build document head
   * @private
   */
  buildHead({ title, css, isPreview, themeMode, katexEnabled }) {
    const styleTags = this.buildStyleTags(css);
    const katexLink = katexEnabled && isPreview
      ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">'
      : '';

    return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)}</title>
    ${isPreview ? '' : '<meta name="generator" content="DevPages Publisher">'}
${styleTags}
    ${katexLink}
</head>`;
  }

  /**
   * Build style tags from CSS bundle
   * @private
   */
  buildStyleTags(css) {
    const tags = [];

    if (css.base) {
      tags.push(`    <style>
/* Base CSS for Markdown Content */
${css.base}
    </style>`);
    }

    if (css.theme) {
      tags.push(`    <style>
/* Theme CSS Variables */
${css.theme}
    </style>`);
    }

    if (css.bundled) {
      tags.push(`    <style>
/* Content CSS */
${css.bundled}
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
   * Build document body
   * @private
   */
  buildBody({ content, scripts, metadata, runtimeJS, isPreview, themeMode }) {
    const bodyClass = isPreview ? ` class="theme-${themeMode}"` : '';
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
