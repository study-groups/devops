/**
 * Markdown Processing Utilities
 * Shared utilities for markdown preprocessing and manipulation
 */

/**
 * Preprocess KaTeX blocks - convert LaTeX delimiters to KaTeX format
 * Converts \[ ... \] to $$ ... $$ (block)
 * Converts \( ... \) to $ ... $ (inline)
 *
 * @param {string} content - Markdown content
 * @returns {string} Preprocessed content
 */
export function preprocessKatexBlocks(content) {
    if (!content || typeof content !== 'string') {
        return content;
    }

    // Convert block math: \[ ... \] to $$ ... $$
    const blockRegex = /\\\[([\s\S]*?)\\\]/g;
    let processedContent = content.replace(blockRegex, (match, formula) => {
        return '$$' + formula + '$$';
    });

    // Convert inline math: \( ... \) to $ ... $
    const inlineRegex = /\\\(([\s\S]*?)\\\)/g;
    processedContent = processedContent.replace(inlineRegex, (match, formula) => {
        return '$' + formula.trim() + '$';
    });

    return processedContent;
}

/**
 * Simple path joining utility for resolving relative paths
 * Handles . and .. navigation
 *
 * @param {string} base - Base path (can be file or directory)
 * @param {string} relative - Relative path to join
 * @returns {string} Joined path
 */
export function joinPath(base, relative) {
    if (!base || !relative) {
        return base || relative || '';
    }

    const baseParts = base.split('/').filter(p => p && p !== '.');

    // If base is a file path (has extension), remove the filename
    if (baseParts.length > 0 && base.includes('.') && base.lastIndexOf('.') > base.lastIndexOf('/')) {
        baseParts.pop();
    }

    const relativeParts = relative.split('/');

    for (const part of relativeParts) {
        if (part === '..') {
            if (baseParts.length > 0) {
                baseParts.pop();
            }
        } else if (part && part !== '.') {
            baseParts.push(part);
        }
    }

    return baseParts.join('/');
}

/**
 * Resolve resource path (CSS, JS, images) based on context
 * Handles absolute URLs, root-relative, and file-relative paths
 *
 * @param {string} resourcePath - The path to resolve
 * @param {string} contextFilePath - The markdown file path providing context
 * @returns {string} Resolved URL
 */
export function resolveResourcePath(resourcePath, contextFilePath = '') {
    if (!resourcePath) return '';

    const trimmed = resourcePath.trim();

    // Absolute URLs - return as-is
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    // Already an API path - return as-is
    if (trimmed.startsWith('/api/')) {
        return trimmed;
    }

    // Root-relative path (starts with /)
    if (trimmed.startsWith('/')) {
        return `/api/files/content?pathname=${encodeURIComponent(trimmed.substring(1))}`;
    }

    // File-relative path - resolve against context file
    if (contextFilePath) {
        const resolved = joinPath(contextFilePath, trimmed);
        return `/api/files/content?pathname=${encodeURIComponent(resolved)}`;
    }

    // Fallback - treat as root-relative
    return `/api/files/content?pathname=${encodeURIComponent(trimmed)}`;
}

/**
 * Extract inline scripts from HTML content
 * Removes script tags and returns both cleaned HTML and scripts
 *
 * @param {string} html - HTML content
 * @returns {Object} { html: cleanedHtml, scripts: Array<string> }
 */
export function extractInlineScripts(html) {
    const scripts = [];

    try {
        const tempDoc = new DOMParser().parseFromString(html, 'text/html');
        const scriptTags = tempDoc.body.querySelectorAll('script:not([src])');

        scriptTags.forEach(scriptTag => {
            if (scriptTag.textContent) {
                scripts.push(scriptTag.textContent);
            }
            scriptTag.remove();
        });

        return {
            html: tempDoc.body.innerHTML,
            scripts
        };
    } catch (error) {
        console.error('[markdownUtils] Error extracting inline scripts:', error);
        return { html, scripts };
    }
}

/**
 * Bundle scripts for execution with error isolation
 * Wraps each script in try-catch for better error handling
 *
 * @param {Array<Object>} externalScripts - Array of { name, content } objects
 * @param {Array<string>} inlineScripts - Array of inline script content
 * @returns {string} Bundled script content
 */
export function bundleScripts(externalScripts = [], inlineScripts = []) {
    const scriptParts = [];

    // Add external scripts with error isolation
    externalScripts.forEach(script => {
        if (script?.content && typeof script.content === 'string') {
            const trimmed = script.content.trim();
            if (trimmed) {
                scriptParts.push(`
// === External Script: ${script.name || 'unknown'} ===
try {
${trimmed}
} catch (error) {
    console.error("Error in external script ${script.name || 'unknown'}:", error);
}`);
            }
        }
    });

    // Add inline scripts with error isolation
    inlineScripts.forEach((content, i) => {
        if (content && typeof content === 'string') {
            const trimmed = content.trim();
            if (trimmed) {
                scriptParts.push(`
// === Inline Script #${i + 1} ===
try {
${trimmed}
} catch (error) {
    console.error("Error in inline script #${i + 1}:", error);
}`);
            }
        }
    });

    return scriptParts.join('\n');
}

/**
 * Generate hash of content for cache invalidation
 * Simple hash function for detecting content changes
 *
 * @param {string} content - Content to hash
 * @returns {string} Hash string
 */
export function simpleHash(content) {
    if (!content) return '';

    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
}
