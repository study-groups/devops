/**
 * GameValidator - Validates game HTML and manifest for display issues
 *
 * Checks:
 *   1. HTML structure (DOCTYPE, charset, lang)
 *   2. Viewport meta tag
 *   3. CSS body resets (margin:0, padding:0)
 *   4. Manifest field completeness
 */

export class GameValidator {
  constructor(s3Provider) {
    this.s3 = s3Provider;
  }

  /**
   * Validate a game
   * @param {object} game - Game object from manifest
   * @param {object} options
   * @param {boolean} options.checkHtml - Fetch and validate HTML
   * @param {boolean} options.checkManifest - Validate manifest fields
   * @returns {Promise<ValidationResult>}
   */
  async validate(game, options = { checkHtml: true, checkManifest: true }) {
    const result = {
      slug: game.slug,
      passed: [],
      issues: [],
      warnings: [],
    };

    if (options.checkManifest) {
      this.validateManifest(game, result);
      // Check thumbnail exists on S3 (async)
      await this.validateThumbnail(game, result);
    }

    if (options.checkHtml && game.url_path) {
      await this.validateHtml(game, result);
    }

    result.ok = result.issues.length === 0;
    return result;
  }

  /**
   * Validate manifest fields
   */
  validateManifest(game, result) {
    // Required fields
    const required = ['slug', 'name', 'url_path'];
    for (const field of required) {
      if (!game[field]) {
        result.issues.push({
          id: `missing-${field}`,
          severity: 'error',
          category: 'manifest',
          message: `Missing required field: ${field}`,
          fix: null,
        });
      } else {
        result.passed.push(`manifest-${field}`);
      }
    }

    // Access control
    if (!game.access_control) {
      result.warnings.push({
        id: 'missing-access-control',
        severity: 'warning',
        category: 'manifest',
        message: 'No access_control defined (defaults to public)',
        fix: null,
      });
    } else {
      const ac = game.access_control;
      if (!ac.min_role) {
        result.warnings.push({
          id: 'missing-min-role',
          severity: 'warning',
          category: 'manifest',
          message: 'access_control.min_role not set',
          fix: null,
        });
      } else {
        result.passed.push('manifest-access-control');
      }
    }

    // Thumbnail check (warning only)
    if (!game.thumbnail) {
      result.warnings.push({
        id: 'missing-thumbnail',
        severity: 'warning',
        category: 'manifest',
        message: 'No thumbnail defined',
        fix: null,
      });
    } else {
      result.passed.push('manifest-thumbnail');
      // Queue S3 check for thumbnail existence (done async in validateThumbnail)
      result._checkThumbnail = game.thumbnail;
    }
  }

  /**
   * Check if thumbnail file exists on S3
   */
  async validateThumbnail(game, result) {
    if (!game.thumbnail) return;

    // Extract S3 path from thumbnail (remove leading /images/ if present)
    let thumbnailPath = game.thumbnail;
    if (thumbnailPath.startsWith('/images/')) {
      thumbnailPath = thumbnailPath.substring(1); // Remove leading /
    }

    // Common extensions to check
    const extensions = ['', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
    let found = false;

    for (const ext of extensions) {
      const key = thumbnailPath + ext;
      try {
        const head = await this.s3.headObject(key);
        if (head.exists) {
          found = true;
          break;
        }
      } catch (err) {
        // Continue checking other extensions
      }
    }

    if (!found) {
      result.warnings.push({
        id: 'thumbnail-not-found',
        severity: 'warning',
        category: 'manifest',
        message: `Thumbnail file not found on S3: ${game.thumbnail}`,
        fix: null,
      });
    } else {
      result.passed.push('manifest-thumbnail-exists');
    }
  }

  /**
   * Validate HTML content from S3
   */
  async validateHtml(game, result) {
    let html;
    try {
      html = await this.s3.getObjectString(game.url_path);
    } catch (err) {
      result.issues.push({
        id: 'html-fetch-failed',
        severity: 'error',
        category: 'html',
        message: `Failed to fetch HTML: ${err.message}`,
        fix: null,
      });
      return;
    }

    // Store raw HTML for potential fixes
    result._html = html;
    result._htmlPath = game.url_path;

    // 1. DOCTYPE check
    if (!/^\s*<!doctype\s+html>/i.test(html)) {
      result.issues.push({
        id: 'missing-doctype',
        severity: 'error',
        category: 'html',
        message: 'Missing <!DOCTYPE html> declaration',
        fix: {
          type: 'prepend',
          content: '<!DOCTYPE html>\n',
        },
      });
    } else {
      result.passed.push('html-doctype');
    }

    // 2. Charset meta
    if (!/<meta[^>]+charset\s*=\s*["']?utf-8["']?/i.test(html)) {
      result.warnings.push({
        id: 'missing-charset',
        severity: 'warning',
        category: 'html',
        message: 'Missing <meta charset="UTF-8">',
        fix: {
          type: 'inject-head',
          content: '<meta charset="UTF-8">',
        },
      });
    } else {
      result.passed.push('html-charset');
    }

    // 3. Viewport meta
    if (!/<meta[^>]+name\s*=\s*["']?viewport["']?/i.test(html)) {
      result.issues.push({
        id: 'missing-viewport',
        severity: 'error',
        category: 'html',
        message: 'Missing viewport meta tag (affects mobile display)',
        fix: {
          type: 'inject-head',
          content: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        },
      });
    } else {
      result.passed.push('html-viewport');
    }

    // 4. Body margin reset - check for margin:0 or margin: 0
    const hasBodyMargin = this.checkCssProperty(html, 'body', 'margin', '0');
    if (!hasBodyMargin) {
      result.issues.push({
        id: 'missing-body-margin',
        severity: 'error',
        category: 'css',
        message: 'Body missing margin:0 (causes iframe offset)',
        fix: {
          type: 'inject-style',
          content: 'body{margin:0}',
        },
      });
    } else {
      result.passed.push('css-body-margin');
    }

    // 5. Body padding reset
    const hasBodyPadding = this.checkCssProperty(html, 'body', 'padding', '0');
    if (!hasBodyPadding) {
      result.warnings.push({
        id: 'missing-body-padding',
        severity: 'warning',
        category: 'css',
        message: 'Body missing padding:0',
        fix: {
          type: 'inject-style',
          content: 'body{padding:0}',
        },
      });
    } else {
      result.passed.push('css-body-padding');
    }

    // 6. Overflow hidden (recommended for games)
    const hasOverflow = this.checkCssProperty(html, 'body', 'overflow', 'hidden');
    if (!hasOverflow) {
      result.warnings.push({
        id: 'missing-overflow-hidden',
        severity: 'info',
        category: 'css',
        message: 'Body missing overflow:hidden (recommended for games)',
        fix: {
          type: 'inject-style',
          content: 'body{overflow:hidden}',
        },
      });
    } else {
      result.passed.push('css-overflow');
    }
  }

  /**
   * Check if a CSS property is set for a selector
   * Searches both inline styles and <style> blocks
   */
  checkCssProperty(html, selector, property, value) {
    // Check inline style on body element
    const bodyMatch = html.match(/<body[^>]*style\s*=\s*["']([^"']*)["']/i);
    if (bodyMatch) {
      const style = bodyMatch[1];
      const propRegex = new RegExp(`${property}\\s*:\\s*${value}`, 'i');
      if (propRegex.test(style)) return true;
    }

    // Check <style> blocks
    const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    for (const block of styleBlocks) {
      // Look for selector { ... property: value ... }
      // This is simplified - doesn't handle all CSS syntax
      const selectorRegex = new RegExp(
        `(?:^|[,}\\s])${selector}\\s*\\{[^}]*${property}\\s*:\\s*${value}[^}]*\\}`,
        'i'
      );
      if (selectorRegex.test(block)) return true;

      // Also check combined selectors like "html,body"
      const combinedRegex = new RegExp(
        `(?:html\\s*,\\s*)?${selector}\\s*\\{[^}]*${property}\\s*:\\s*${value}`,
        'i'
      );
      if (combinedRegex.test(block)) return true;
    }

    return false;
  }

  /**
   * Generate fixed HTML with all applicable fixes
   * @param {ValidationResult} result - Validation result with _html
   * @returns {string} Fixed HTML
   */
  generateFix(result) {
    if (!result._html) {
      throw new Error('No HTML content to fix');
    }

    let html = result._html;
    const allIssues = [...result.issues, ...result.warnings];
    const fixes = allIssues.filter(i => i.fix).map(i => i.fix);

    // Collect style injections
    const styleInjections = fixes
      .filter(f => f.type === 'inject-style')
      .map(f => f.content);

    // Collect head injections
    const headInjections = fixes
      .filter(f => f.type === 'inject-head')
      .map(f => f.content);

    // Apply prepends (like DOCTYPE)
    for (const fix of fixes.filter(f => f.type === 'prepend')) {
      html = fix.content + html;
    }

    // Inject styles into head (or create head if missing)
    if (styleInjections.length > 0) {
      const styleTag = `<style data-pja-fix="true">${styleInjections.join('')}</style>`;

      if (/<\/head>/i.test(html)) {
        html = html.replace(/<\/head>/i, `${styleTag}</head>`);
      } else if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>${styleTag}`);
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(/<html([^>]*)>/i, `<html$1><head>${styleTag}</head>`);
      }
    }

    // Inject head elements
    if (headInjections.length > 0) {
      const headContent = headInjections.join('\n');

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>\n${headContent}`);
      }
    }

    return html;
  }

  /**
   * Apply fixes to S3
   * @param {ValidationResult} result - Validation result
   * @param {object} options
   * @param {boolean} options.backup - Create backup first
   * @returns {Promise<{success: boolean, backupKey?: string}>}
   */
  async applyFix(result, options = { backup: true }) {
    if (!result._html || !result._htmlPath) {
      throw new Error('No HTML content to fix');
    }

    const fixedHtml = this.generateFix(result);

    // Create backup
    let backupKey = null;
    if (options.backup) {
      backupKey = `${result._htmlPath}.backup.${Date.now()}`;
      await this.s3.putObject(backupKey, result._html, { contentType: 'text/html' });
    }

    // Upload fixed HTML
    await this.s3.putObject(result._htmlPath, fixedHtml, { contentType: 'text/html' });

    return { success: true, backupKey };
  }

  /**
   * Format validation result for terminal output
   */
  formatText(result) {
    const lines = [];
    lines.push(`Validate: ${result.slug}`);
    lines.push('═'.repeat(50));
    lines.push('');

    // Group by category
    const categories = [
      { name: 'HTML Structure', prefix: 'html', items: [] },
      { name: 'CSS Resets', prefix: 'css', items: [] },
      { name: 'Manifest Fields', prefix: 'manifest', items: [] },
    ];

    // Add passed items
    for (const check of result.passed) {
      for (const cat of categories) {
        if (check.startsWith(cat.prefix + '-')) {
          cat.items.push({ status: '✓', name: check.replace(cat.prefix + '-', ''), severity: 'ok' });
        }
      }
    }

    // Add issues
    for (const issue of result.issues) {
      for (const cat of categories) {
        if (issue.category === cat.prefix) {
          cat.items.push({ status: '✗', name: issue.message, severity: 'error', fixable: !!issue.fix });
        }
      }
    }

    // Add warnings
    for (const warn of result.warnings) {
      for (const cat of categories) {
        if (warn.category === cat.prefix) {
          cat.items.push({ status: '⚠', name: warn.message, severity: 'warning', fixable: !!warn.fix });
        }
      }
    }

    // Print categories
    let checkNum = 1;
    for (const cat of categories) {
      if (cat.items.length === 0) continue;

      lines.push(`[${checkNum}] ${cat.name}`);
      for (const item of cat.items) {
        const fixTag = item.fixable ? ' [fixable]' : '';
        lines.push(`    ${item.status} ${item.name}${fixTag}`);
      }
      lines.push('');
      checkNum++;
    }

    // Summary
    lines.push('───');
    const errorCount = result.issues.length;
    const warnCount = result.warnings.length;
    const fixableCount = [...result.issues, ...result.warnings].filter(i => i.fix).length;

    if (errorCount === 0 && warnCount === 0) {
      lines.push('✓ All checks passed');
    } else {
      lines.push(`${errorCount} error(s), ${warnCount} warning(s)`);
      if (fixableCount > 0) {
        lines.push(`${fixableCount} issue(s) can be auto-fixed with --fix`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format as JSON
   */
  formatJson(result) {
    // Remove internal fields
    const { _html, _htmlPath, ...output } = result;
    return JSON.stringify(output, null, 2);
  }
}
