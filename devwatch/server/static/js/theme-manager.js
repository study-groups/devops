/**
 * PJA Theme Manager - System-wide theme management
 * Handles theme switching, persistence, and iframe communication
 */

class DevWatchThemeManager {
    constructor() {
        this.themes = {
            'retro': { name: 'Retro', icon: '🔮', description: 'Classic understated look with subtle green accents' },
            'cyber': { name: 'Cyber', icon: '🟣', description: 'Neon pink and blue futuristic theme' },
            'phosphor': { name: 'Phosphor', icon: '⚡', description: 'Brutal glowing green phosphor - maximum intensity' },
            'matrix': { name: 'Matrix', icon: '🟢', description: 'Classic green terminal theme' },
            'bright': { name: 'Bright', icon: '⚪', description: 'Clean light theme for readability' },
            'terminal': { name: 'Terminal', icon: '⚫', description: 'Pure black and white terminal' }
        };
        
        // Create an ordered array of themes to preserve dropdown order
        this.themeOrder = [
            { id: 'retro', ...this.themes['retro'] },
            { id: 'cyber', ...this.themes['cyber'] },
            { id: 'phosphor', ...this.themes['phosphor'] },
            { id: 'matrix', ...this.themes['matrix'] },
            { id: 'bright', ...this.themes['bright'] },
            { id: 'terminal', ...this.themes['terminal'] }
        ];
        
        this.currentTheme = this.getStoredTheme() || 'retro';
        this.iframes = new Set();
        this.observers = new Set();
        
        this.init();
    }
    
    init() {
        // Ensure DOM is ready before applying theme
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.applyTheme(this.currentTheme);
                this.setupIframeObserver();
            });
        } else {
            this.applyTheme(this.currentTheme);
            this.setupIframeObserver();
        }
        
        // Listen for storage changes (theme changes in other tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'devwatch-theme') {
                this.setTheme(e.newValue, false); // Don't store again
            }
        });
        
        // Setup postMessage listener for iframe communication
        window.addEventListener('message', (e) => {
            if (e.data.type === 'devwatch-theme-request') {
                this.sendThemeToIframe(e.source);
            }
        });
        
        console.log(`[DevWatchThemeManager] Initialized with theme: ${this.currentTheme}`);
    }
    
    /**
     * Get list of available themes
     */
    getThemes() {
        // Return the ordered array instead of the object
        return this.themeOrder.reduce((acc, theme) => {
            acc[theme.id] = { 
                name: theme.name, 
                icon: theme.icon, 
                description: theme.description 
            };
            return acc;
        }, {});
    }
    
    /**
     * Get current active theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    /**
     * Set new theme
     */
    setTheme(themeId, store = true) {
        if (!this.themes[themeId]) {
            console.warn(`[DevWatchThemeManager] Unknown theme: ${themeId}`);
            return false;
        }
        
        this.currentTheme = themeId;
        this.applyTheme(themeId);
        
        if (store) {
            this.storeTheme(themeId);
        }
        
        // Notify all registered iframes
        this.notifyIframes(themeId);
        
        // Notify observers
        this.notifyObservers(themeId);
        
        console.log(`[DevWatchThemeManager] Theme changed to: ${themeId}`);
        return true;
    }
    
    /**
     * Apply theme to current document
     */
    applyTheme(themeId) {
        // Ensure document elements exist before modifying them
        if (!document.documentElement) {
            console.warn('[DevWatchThemeManager] Document not ready, deferring theme application');
            return;
        }
        
        document.documentElement.setAttribute('data-theme', themeId);
        
        // Check if body exists before modifying className
        if (document.body) {
            document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${themeId}`;
            // Remove the pre-load class after applying the theme for a smooth transition
            document.body.classList.remove('pja-pre-theme-load');
        } else {
            console.warn('[DevWatchThemeManager] Document body not ready, theme class will be applied when available');
            // Wait for body to be available
            const observer = new MutationObserver((mutations, obs) => {
                if (document.body) {
                    document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${themeId}`;
                    // Also remove the pre-load class here once the body is available
                    document.body.classList.remove('pja-pre-theme-load');
                    obs.disconnect();
                }
            });
            observer.observe(document.documentElement, { childList: true });
        }
    }
    
    /**
     * Store theme preference
     */
    storeTheme(themeId) {
        try {
            localStorage.setItem('devwatch-theme', themeId);
        } catch (e) {
            console.warn('[DevWatchThemeManager] Could not store theme preference:', e);
        }
    }
    
    /**
     * Get stored theme preference
     */
    getStoredTheme() {
        try {
            const storedTheme = localStorage.getItem('devwatch-theme');
            
            // If stored theme looks like matrix but feels like cyber, return cyber
            if (storedTheme === 'matrix') {
                const cyberpunkColors = ['#0f0f23', '#1a1a2e', '#16213e', '#0f3460'];
                const currentBgColor = getComputedStyle(document.documentElement).getPropertyValue('--devwatch-bg-primary').trim();
                
                if (cyberpunkColors.includes(currentBgColor)) {
                    console.log('[DevWatchThemeManager] Detected cyber theme, overriding matrix');
                    return 'cyber';
                }
            }
            
            return storedTheme;
        } catch (e) {
            console.warn('[DevWatchThemeManager] Could not read theme preference:', e);
            return null;
        }
    }
    
    /**
     * Register iframe for theme updates
     */
    registerIframe(iframe) {
        this.iframes.add(iframe);
        
        // Send current theme to iframe when it loads
        iframe.addEventListener('load', () => {
            setTimeout(() => this.sendThemeToIframe(iframe.contentWindow), 100);
        });
        
        // If already loaded, send theme immediately
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            setTimeout(() => this.sendThemeToIframe(iframe.contentWindow), 100);
        }
    }
    
    /**
     * Unregister iframe
     */
    unregisterIframe(iframe) {
        this.iframes.delete(iframe);
    }
    
    /**
     * Send theme to specific iframe
     */
    sendThemeToIframe(iframeWindow) {
        if (!iframeWindow) return;
        
        try {
            iframeWindow.postMessage({
                type: 'devwatch-theme-change',
                theme: this.currentTheme,
                themes: this.themes
            }, '*');
        } catch (e) {
            console.warn('[DevWatchThemeManager] Could not send theme to iframe:', e);
        }
    }
    
    /**
     * Notify all registered iframes of theme change
     */
    notifyIframes(themeId) {
        this.iframes.forEach(iframe => {
            if (iframe.contentWindow) {
                this.sendThemeToIframe(iframe.contentWindow);
            }
        });
    }
    
    /**
     * Setup automatic iframe discovery and registration
     */
    setupIframeObserver() {
        // Register existing iframes
        document.querySelectorAll('iframe').forEach(iframe => {
            this.registerIframe(iframe);
        });
        
        // Watch for new iframes - only if body exists
        if (document.body) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.tagName === 'IFRAME') {
                            this.registerIframe(node);
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll('iframe').forEach(iframe => {
                                this.registerIframe(iframe);
                            });
                        }
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            console.warn('[DevWatchThemeManager] Document body not ready for iframe observation');
        }
    }
    
    /**
     * Add observer for theme changes
     */
    addObserver(callback) {
        this.observers.add(callback);
        // Call immediately with current theme
        callback(this.currentTheme);
    }
    
    /**
     * Remove observer
     */
    removeObserver(callback) {
        this.observers.delete(callback);
    }
    
    /**
     * Notify all observers of theme change
     */
    notifyObservers(themeId) {
        this.observers.forEach(callback => {
            try {
                callback(themeId);
            } catch (e) {
                console.warn('[DevWatchThemeManager] Observer error:', e);
            }
        });
    }
    
    /**
     * Create theme selector UI
     */
    createThemeSelector(container) {
        const selector = document.createElement('div');
        selector.className = 'devwatch-theme-selector';
        selector.innerHTML = `
            <label for="theme-select" style="display: block; margin-bottom: var(--devwatch-space-sm); color: var(--devwatch-text-secondary); font-size: var(--devwatch-font-size-xs);">
                🎨 Theme
            </label>
            <select id="theme-select" class="devwatch-theme-select" style="width: 100%;">
                ${this.themeOrder.map(theme => 
                    `<option value="${theme.id}" ${theme.id === this.currentTheme ? 'selected' : ''}>
                        ${theme.icon} ${theme.name}
                    </option>`
                ).join('')}
            </select>
            <div class="theme-description" style="margin-top: var(--devwatch-space-xs); font-size: var(--devwatch-font-size-xs); color: var(--devwatch-text-muted);">
                ${this.themes[this.currentTheme].description}
            </div>
        `;
        
        const select = selector.querySelector('#theme-select');
        const description = selector.querySelector('.theme-description');
        
        select.addEventListener('change', (e) => {
            const themeId = e.target.value;
            this.setTheme(themeId);
            description.textContent = this.themes[themeId].description;
        });
        
        // Update description when theme changes
        this.addObserver((themeId) => {
            select.value = themeId;
            description.textContent = this.themes[themeId].description;
        });
        
        if (container) {
            container.appendChild(selector);
        }
        
        return selector;
    }
    
    /**
     * Initialize theme manager for iframe contexts
     */
    static initForIframe() {
        // Listen for theme messages from parent
        window.addEventListener('message', (e) => {
            if (e.data.type === 'devwatch-theme-change') {
                const themeId = e.data.theme;
                
                if (document.documentElement) {
                    document.documentElement.setAttribute('data-theme', themeId);
                }
                
                if (document.body) {
                    document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${themeId}`;
                } else {
                    // Wait for body to be available in iframe
                    const observer = new MutationObserver((mutations, obs) => {
                        if (document.body) {
                            document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${themeId}`;
                            obs.disconnect();
                        }
                    });
                    if (document.documentElement) {
                        observer.observe(document.documentElement, { childList: true });
                    }
                }
                
                // Store globally for components that need it
                window.DevWatchCurrentTheme = themeId;
                window.DevWatchThemes = e.data.themes;
            }
        });
        
        // Request current theme from parent
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'devwatch-theme-request' }, '*');
        }
        
        console.log('[DevWatchThemeManager] Iframe theme listener initialized');
    }
}

// Auto-initialize for iframes
if (window.self !== window.top) {
    // We're in an iframe
    document.addEventListener('DOMContentLoaded', () => {
        DevWatchThemeManager.initForIframe();
    });
} else {
    // We're in the main window - create global instance
    window.DevWatchThemeManager = window.DevWatchThemeManager || new DevWatchThemeManager();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevWatchThemeManager;
}
