/**
 * CSS Optimization Utility
 * Helps optimize CSS loading performance by consolidating files and managing loading
 */

export class CssOptimizer {
    constructor() {
        this.loadedFiles = new Set();
        this.loadingPromises = new Map();
    }

    /**
     * Load CSS file asynchronously with performance optimization
     */
    async loadCssFile(href, options = {}) {
        const {
            critical = false,
            preload = false,
            media = 'all'
        } = options;

        // Check if already loaded
        if (this.loadedFiles.has(href)) {
            return Promise.resolve();
        }

        // Check if already loading
        if (this.loadingPromises.has(href)) {
            return this.loadingPromises.get(href);
        }

        const loadPromise = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.media = 'all';
            
            link.onload = () => {
                this.loadedFiles.add(href);
                this.loadingPromises.delete(href);
                resolve();
            };
            link.onerror = () => {
                this.loadingPromises.delete(href);
                reject(new Error(`Failed to load CSS: ${href}`));
            };

            document.head.appendChild(link);
        });

        this.loadingPromises.set(href, loadPromise);
        return loadPromise;
    }

    /**
     * Load multiple CSS files in parallel
     */
    async loadCssFiles(files, options = {}) {
        const promises = files.map(file => this.loadCssFile(file, options));
        return Promise.all(promises);
    }

    /**
     * Preload critical CSS files
     */
    preloadCriticalCss(files) {
        files.forEach(href => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = href;
            document.head.appendChild(link);
        });
    }

    /**
     * Get CSS loading performance metrics
     */
    getPerformanceMetrics() {
        return {
            loadedFiles: this.loadedFiles.size,
            loadingFiles: this.loadingPromises.size,
            totalFiles: this.loadedFiles.size + this.loadingPromises.size
        };
    }
}

// Create global instance
export const cssOptimizer = new CssOptimizer(); 