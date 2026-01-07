/**
 * PJA Style SDK - For use in *.iframe.html files
 * Provides communication bridge between iframe content and host page
 */

class DevWatchStyleSDK {
    constructor() {
        this.isIframe = window.self !== window.top;
        this.initialized = false;
        this.config = {
            hideTitle: true,
            autoSendTitle: true,
            autoSendScrollbarStyles: true
        };
        
        this.init();
    }

    init() {
        if (!this.isIframe) {
            console.warn('PJA Style SDK: Not running in iframe context');
            return;
        }

        // Send ready signal to parent
        this.sendMessage({
            type: 'devwatch-iframe-ready',
            timestamp: Date.now()
        });

        // Auto-send title if configured
        if (this.config.autoSendTitle) {
            this.sendTitle();
        }

        // Auto-hide title if configured
        if (this.config.hideTitle) {
            this.hideTitle();
        }

        // Auto-send scrollbar styles if configured
        if (this.config.autoSendScrollbarStyles) {
            this.sendScrollbarStyles();
        }

        // Listen for DOM changes to update title
        this.observeTitleChanges();

        this.initialized = true;
        console.log('PJA Style SDK: Initialized');
    }

    sendMessage(data) {
        if (!this.isIframe) return;
        
        window.parent.postMessage({
            source: 'devwatch-iframe',
            ...data
        }, '*');
    }

    sendTitle() {
        const title = this.getTitle();
        this.sendMessage({
            type: 'devwatch-title-update',
            title: title
        });
    }

    getTitle() {
        // Try multiple ways to get the title according to PJA conventions
        const titleElement = document.querySelector('h1, .devwatch-title, [data-pja-title]');
        if (titleElement) {
            return titleElement.textContent.trim();
        }
        return document.title || 'Untitled';
    }

    hideTitle() {
        // Hide title elements according to PJA conventions
        const titleSelectors = [
            'h1:first-of-type',
            '.devwatch-title',
            '[data-pja-title]',
            '.iframe-title'
        ];

        titleSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.display = 'none';
                el.setAttribute('data-pja-hidden', 'true');
            });
        });
    }

    showTitle() {
        const hiddenElements = document.querySelectorAll('[data-pja-hidden="true"]');
        hiddenElements.forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-pja-hidden');
        });
    }

    sendScrollbarStyles() {
        const styles = this.extractScrollbarStyles();
        this.sendMessage({
            type: 'devwatch-scrollbar-styles',
            styles: styles
        });
    }

    extractScrollbarStyles() {
        // Extract scrollbar styles from the current document
        const styles = {};
        const computedStyle = getComputedStyle(document.documentElement);

        // Common scrollbar properties
        const scrollbarProps = [
            'scrollbar-width',
            'scrollbar-color',
            'scrollbar-track-color',
            'scrollbar-thumb-color'
        ];

        scrollbarProps.forEach(prop => {
            const value = computedStyle.getPropertyValue(prop);
            if (value) {
                styles[prop] = value;
            }
        });

        // Also check for webkit scrollbar styles
        const webkitProps = [
            '::-webkit-scrollbar',
            '::-webkit-scrollbar-track',
            '::-webkit-scrollbar-thumb',
            '::-webkit-scrollbar-corner'
        ];

        // Get stylesheet rules for webkit scrollbar
        try {
            for (let sheet of document.styleSheets) {
                for (let rule of sheet.cssRules || sheet.rules || []) {
                    if (rule.selectorText && webkitProps.some(prop => rule.selectorText.includes(prop))) {
                        styles[rule.selectorText] = rule.style.cssText;
                    }
                }
            }
        } catch (e) {
            // Cross-origin stylesheets may throw errors
            console.debug('PJA Style SDK: Could not access some stylesheets');
        }

        return styles;
    }

    observeTitleChanges() {
        // Watch for title changes
        const titleObserver = new MutationObserver(() => {
            if (this.config.autoSendTitle) {
                this.sendTitle();
            }
        });

        // Observe title element changes
        const titleElement = document.querySelector('title');
        if (titleElement) {
            titleObserver.observe(titleElement, { childList: true, characterData: true });
        }

        // Observe h1 changes
        const h1Elements = document.querySelectorAll('h1');
        h1Elements.forEach(h1 => {
            titleObserver.observe(h1, { childList: true, characterData: true, subtree: true });
        });
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (newConfig.hideTitle !== undefined) {
            if (newConfig.hideTitle) {
                this.hideTitle();
            } else {
                this.showTitle();
            }
        }

        if (newConfig.autoSendTitle && this.initialized) {
            this.sendTitle();
        }
    }

    // Public API methods
    setTitle(title) {
        document.title = title;
        const h1 = document.querySelector('h1');
        if (h1) {
            h1.textContent = title;
        }
        this.sendTitle();
    }

    sendCustomMessage(type, data) {
        this.sendMessage({
            type: `pja-custom-${type}`,
            data: data
        });
    }

    requestParentAction(action, params = {}) {
        this.sendMessage({
            type: 'devwatch-parent-action',
            action: action,
            params: params
        });
    }
}

// Auto-initialize if we're in an iframe and the filename matches *.iframe.html
if (window.self !== window.top && window.location.pathname.includes('.iframe.html')) {
    window.DevWatch = new DevWatchStyleSDK();
} else {
    // Export for manual initialization
    window.DevWatchStyleSDK = DevWatchStyleSDK;
}