/**
 * HTML Validator - Validates HTML structure for proper game display
 *
 * Checks:
 * - DOCTYPE declaration
 * - Charset meta tag
 * - Viewport meta tag (mobile display)
 * - CSS body resets (margin, padding, overflow)
 */

export const name = 'html';
export const description = 'Validates HTML structure for proper game display';
export const hooks = ['onSave', 'onSync', 'onPublish'];
export const categories = ['html', 'css'];

/**
 * Validate HTML structure
 * @param {ValidationContext} context
 * @param {object} gameType
 * @returns {Promise<{issues: Array, warnings: Array, passed: Array}>}
 */
export async function validate(context, gameType) {
    const issues = [];
    const warnings = [];
    const passed = [];

    // Get HTML content
    const entryFile = context.game?.entry || 'index.html';
    const html = await context.getFileContent(entryFile);

    if (!html) {
        issues.push({
            id: 'html-not-found',
            severity: 'error',
            category: 'html',
            message: `Entry file not found: ${entryFile}`,
        });
        return { issues, warnings, passed };
    }

    // 1. DOCTYPE check
    if (!/^\s*<!doctype\s+html>/i.test(html)) {
        issues.push({
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
        passed.push({ id: 'html-doctype', message: 'DOCTYPE declaration present' });
    }

    // 2. Charset meta
    if (!/<meta[^>]+charset\s*=\s*["']?utf-8["']?/i.test(html)) {
        warnings.push({
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
        passed.push({ id: 'html-charset', message: 'Charset meta tag present' });
    }

    // 3. Viewport meta (critical for mobile)
    if (!/<meta[^>]+name\s*=\s*["']?viewport["']?/i.test(html)) {
        issues.push({
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
        passed.push({ id: 'html-viewport', message: 'Viewport meta tag present' });
    }

    // 4. Body margin reset
    const hasBodyMargin = checkCssProperty(html, 'body', 'margin', '0');
    if (!hasBodyMargin) {
        issues.push({
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
        passed.push({ id: 'css-body-margin', message: 'Body margin:0 set' });
    }

    // 5. Body padding reset
    const hasBodyPadding = checkCssProperty(html, 'body', 'padding', '0');
    if (!hasBodyPadding) {
        warnings.push({
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
        passed.push({ id: 'css-body-padding', message: 'Body padding:0 set' });
    }

    // 6. Overflow hidden (recommended for games)
    const hasOverflow = checkCssProperty(html, 'body', 'overflow', 'hidden');
    if (!hasOverflow) {
        warnings.push({
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
        passed.push({ id: 'css-overflow', message: 'Body overflow:hidden set' });
    }

    return { issues, warnings, passed };
}

/**
 * Check if a CSS property is set for a selector
 * Searches both inline styles and <style> blocks
 */
function checkCssProperty(html, selector, property, value) {
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
        const selectorRegex = new RegExp(
            `(?:^|[,}\\s])${selector}\\s*\\{[^}]*${property}\\s*:\\s*${value}[^}]*\\}`,
            'i'
        );
        if (selectorRegex.test(block)) return true;

        // Also check combined selectors like "html,body" or "*"
        const combinedRegex = new RegExp(
            `(?:html\\s*,\\s*)?${selector}\\s*\\{[^}]*${property}\\s*:\\s*${value}`,
            'i'
        );
        if (combinedRegex.test(block)) return true;

        // Check universal selector
        if (/\*\s*\{[^}]*margin\s*:\s*0/.test(block) && property === 'margin') return true;
        if (/\*\s*\{[^}]*padding\s*:\s*0/.test(block) && property === 'padding') return true;
    }

    return false;
}

export default { name, description, hooks, categories, validate };
