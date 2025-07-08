/**
 * client/settings/panels/css-files/utils/CssScanner.js
 * CSS scanning and analysis utilities
 */

export class CssScanner {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the scanner
     */
    async initialize() {
        this.initialized = true;
        console.log('[CssScanner] Initialized');
    }

    /**
     * Scan all loaded CSS files
     */
    scanLoadedCssFiles() {
        const cssFiles = new Map();
        
        // Scan external stylesheets
        document.querySelectorAll('link[rel="stylesheet"]').forEach((link, index) => {
            const href = link.href;
            cssFiles.set(href, {
                href,
                type: 'external',
                element: link,
                disabled: link.disabled,
                media: link.media || 'all',
                id: `external-${index}`,
                title: link.title || this.getFileNameFromHref(href)
            });
        });

        // Scan inline styles
        document.querySelectorAll('style').forEach((style, index) => {
            const content = style.textContent || style.innerHTML;
            const id = `<style> block ${index + 1}`;
            cssFiles.set(id, {
                href: id,
                type: 'inline',
                element: style,
                disabled: style.disabled,
                media: style.media || 'all',
                id: `inline-${index}`,
                title: id,
                content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
            });
        });

        console.log('[CssScanner] Found', cssFiles.size, 'CSS files');
        return cssFiles;
    }

    /**
     * Categorize CSS files
     */
    categorizeCssFiles(cssFiles) {
        const categories = {
            theme: new Map(),
            system: new Map(),
            other: new Map()
        };

        cssFiles.forEach((cssFile, href) => {
            if (this.isThemeCss(href)) {
                categories.theme.set(href, cssFile);
            } else if (this.isSystemCss(href)) {
                categories.system.set(href, cssFile);
            } else {
                categories.other.set(href, cssFile);
            }
        });

        return categories;
    }

    /**
     * Generate statistics about CSS files
     */
    generateStats(cssFiles) {
        const stats = {
            total: cssFiles.size,
            external: 0,
            inline: 0,
            enabled: 0,
            disabled: 0,
            theme: 0,
            system: 0,
            other: 0
        };

        cssFiles.forEach(cssFile => {
            if (cssFile.type === 'external') stats.external++;
            if (cssFile.type === 'inline') stats.inline++;
            if (cssFile.disabled) stats.disabled++;
            else stats.enabled++;

            if (this.isThemeCss(cssFile.href)) stats.theme++;
            else if (this.isSystemCss(cssFile.href)) stats.system++;
            else stats.other++;
        });

        return stats;
    }

    /**
     * Check if CSS file is theme-related
     */
    isThemeCss(href) {
        const themePatterns = [
            /theme/i,
            /color/i,
            /dark/i,
            /light/i,
            /style/i
        ];
        
        return themePatterns.some(pattern => pattern.test(href));
    }

    /**
     * Check if CSS file is system-related
     */
    isSystemCss(href) {
        const systemPatterns = [
            /bootstrap/i,
            /foundation/i,
            /bulma/i,
            /tailwind/i,
            /normalize/i,
            /reset/i,
            /framework/i,
            /vendor/i,
            /lib/i,
            /node_modules/i
        ];
        
        return systemPatterns.some(pattern => pattern.test(href));
    }

    /**
     * Get filename from href
     */
    getFileNameFromHref(href) {
        if (href.startsWith('<style')) {
            return href;
        }
        try {
            const url = new URL(href);
            return url.pathname.split('/').pop() || 'unknown.css';
        } catch (e) {
            return href.split('/').pop() || 'unknown.css';
        }
    }

    /**
     * Destroy the scanner
     */
    destroy() {
        this.initialized = false;
        console.log('[CssScanner] Destroyed');
    }
} 