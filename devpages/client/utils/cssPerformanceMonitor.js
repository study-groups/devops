/**
 * CSS Performance Monitor
 * Tracks CSS loading performance and identifies bottlenecks
 */

export class CssPerformanceMonitor {
    constructor() {
        this.metrics = {
            startTime: performance.now(),
            cssFiles: new Map(),
            totalLoadTime: 0,
            criticalLoadTime: 0,
            nonCriticalLoadTime: 0
        };
        
        this.observeCssLoading();
    }

    /**
     * Observe CSS loading performance
     */
    observeCssLoading() {
        // Monitor existing CSS links
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => this.trackCssFile(link.href, link.media === 'all'));

        // Monitor new CSS links
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'LINK') {
                        const link = node;
                        if (link.rel === 'stylesheet') {
                            this.trackCssFile(link.href, link.media === 'all');
                        }
                    }
                });
            });
        });

        observer.observe(document.head, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Track individual CSS file loading
     */
    trackCssFile(href, isCritical = false) {
        const startTime = performance.now();
        
        this.metrics.cssFiles.set(href, {
            startTime,
            isCritical,
            loadTime: 0,
            loaded: false
        });

        // Monitor load completion
        const checkLoaded = () => {
            const link = document.querySelector(`link[href="${href}"]`);
            if (link && link.sheet) {
                const endTime = performance.now();
                const loadTime = endTime - startTime;
                
                const fileMetrics = this.metrics.cssFiles.get(href);
                fileMetrics.loadTime = loadTime;
                fileMetrics.loaded = true;
                
                if (isCritical) {
                    this.metrics.criticalLoadTime += loadTime;
                } else {
                    this.metrics.nonCriticalLoadTime += loadTime;
                }
                
                this.metrics.totalLoadTime += loadTime;
                
                console.log(`[CSS Performance] ${href}: ${loadTime.toFixed(2)}ms (${isCritical ? 'critical' : 'non-critical'})`);
            } else {
                setTimeout(checkLoaded, 10);
            }
        };
        
        setTimeout(checkLoaded, 10);
    }

    /**
     * Get performance report
     */
    getPerformanceReport() {
        const totalTime = performance.now() - this.metrics.startTime;
        const criticalFiles = Array.from(this.metrics.cssFiles.values()).filter(f => f.isCritical);
        const nonCriticalFiles = Array.from(this.metrics.cssFiles.values()).filter(f => !f.isCritical);
        
        return {
            totalTime: totalTime.toFixed(2),
            criticalLoadTime: this.metrics.criticalLoadTime.toFixed(2),
            nonCriticalLoadTime: this.metrics.nonCriticalLoadTime.toFixed(2),
            totalCssLoadTime: this.metrics.totalLoadTime.toFixed(2),
            criticalFiles: criticalFiles.length,
            nonCriticalFiles: nonCriticalFiles.length,
            averageCriticalLoadTime: criticalFiles.length > 0 ? 
                (this.metrics.criticalLoadTime / criticalFiles.length).toFixed(2) : 0,
            averageNonCriticalLoadTime: nonCriticalFiles.length > 0 ? 
                (this.metrics.nonCriticalLoadTime / nonCriticalFiles.length).toFixed(2) : 0
        };
    }

    /**
     * Log performance report
     */
    logPerformanceReport() {
        const report = this.getPerformanceReport();
        console.log('[CSS Performance Report]', report);
        
        // Log slow files
        const slowFiles = Array.from(this.metrics.cssFiles.entries())
            .filter(([href, metrics]) => metrics.loaded && metrics.loadTime > 200)
            .sort((a, b) => b[1].loadTime - a[1].loadTime);
            
        if (slowFiles.length > 0) {
            console.warn('[CSS Performance] Slow loading files:');
            slowFiles.forEach(([href, metrics]) => {
                console.warn(`  ${href}: ${metrics.loadTime.toFixed(2)}ms`);
            });
        }
    }
}

// Create global instance
export const cssPerformanceMonitor = new CssPerformanceMonitor();

// Auto-log report after 5 seconds
setTimeout(() => {
    cssPerformanceMonitor.logPerformanceReport();
}, 5000); 