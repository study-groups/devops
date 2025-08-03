// Use the globally available globalFetch service
const globalFetch = window.APP.services.globalFetch;

declare global {
    interface Window {
        APP: any;
    }
}

const log = window.APP.services.log.createLogger('CssManager');

export class CssManager {

    constructor() {
        // Constructor can be used for configuration if needed later
    }

    /**
     * Adds a scope to all selectors in a given CSS string.
     * This method avoids scoping @-rules and their content.
     * @param css The CSS string to scope.
     * @param scope The CSS selector to use as a scope (e.g., '#preview-container').
     * @returns The scoped CSS string.
     */
    public addScope(css: string, scope: string): string {
        if (!css || !scope) {
            return css;
        }

        const scopedCss = css.replace(
            /([^\r\n,{}]+)(,(?=[^}]*{)|\s*\{)/g,
            (match, selector, separator) => {
                const trimmedSelector = selector.trim();

                // Skip @-rules and keyframe selectors (from, to, percentages).
                if (trimmedSelector.startsWith('@') || /^\d*(\.\d+)?%$/.test(trimmedSelector) || ['from', 'to'].includes(trimmedSelector)) {
                    return match;
                }

                const scopedSelectors = trimmedSelector
                    .split(',')
                    .map(part => {
                        const trimmedPart = part.trim();
                        if (!trimmedPart) return '';
                        
                        // Avoid double-scoping
                        if (trimmedPart.startsWith(scope)) {
                           return trimmedPart;
                        }

                        // Replace body/:root with the scope selector
                        if (['body', ':root', 'html'].includes(trimmedPart.toLowerCase())) {
                            return scope;
                        }

                        return `${scope} ${trimmedPart}`;
                    })
                    .join(', ');

                return scopedSelectors + separator;
            }
        );

        return scopedCss;
    }

    /**
     * Applies a scoped CSS string to a style element in the document head.
     * @param css The CSS string to apply.
     * @param styleId The ID of the style element to use or create.
     */
    public applyScopedCss(css: string, styleId: string): void {
        let styleEl = document.getElementById(styleId) as HTMLStyleElement;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = css;
        log.info('CSS', 'APPLY_SCOPED_CSS', `Applied CSS to <style id="${styleId}">`);
    }

    /**
     * Fetches a theme file from the server, scopes it, and applies it.
     * @param themePath The path to the theme CSS file (e.g., 'md/themes/classic/styles.css').
     * @param scope The CSS selector to use as a scope (e.g., '#preview-container').
     * @param styleId The ID for the style tag (e.g., 'custom-theme-styles').
     */
    public async applyTheme(themePath: string, scope: string, styleId: string): Promise<void> {
        log.info('CSS', 'APPLY_THEME', `Applying theme from ${themePath} with scope ${scope}`);
        try {
            const response = await globalFetch(`/api/files/content?pathname=${encodeURIComponent(themePath)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const fileContent = await response.text();
            
            const scopedCss = this.addScope(fileContent, scope);
            this.applyScopedCss(scopedCss, styleId);
            
            log.info('CSS', 'APPLY_THEME_SUCCESS', `Theme applied successfully from ${themePath}`);

        } catch (error) {
            console.error(`Error applying theme from ${themePath}:`, error);
            log.error('CSS', 'APPLY_THEME_FAILED', `Failed to apply theme from ${themePath}. Check console for details.`, error);
        }
    }
    
    /**
     * Saves a CSS string to a file on the server.
     * @param cssContent The CSS content to save.
     * @param themePath The path to save the theme file to.
     */
    public async saveTheme(cssContent: string, themePath: string): Promise<boolean> {
        log.info('CSS', 'SAVE_THEME', `Saving theme to ${themePath}`);
        try {
            const response = await globalFetch('/api/files/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pathname: themePath,
                    content: cssContent,
                }),
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: await response.text() };
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            log.info('CSS', 'SAVE_THEME_SUCCESS', `Theme saved successfully: ${result.message}`);
            return true;

        } catch (error) {
            console.error(`Error saving theme to ${themePath}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            log.error('CSS', 'SAVE_THEME_FAILED', `Failed to save theme to ${themePath}: ${errorMessage}`, error);
            return false;
        }
    }
} 