/**
 * Tetra.js - Advanced Metrics & Analytics System
 * The substrate upon which the mycelium grows
 *
 * Provides structured logging with tetra tokens for user analytics,
 * performance monitoring, and developer diagnostics.
 */

class TetraMetrics {
    constructor(config = {}) {
        this.config = {
            enableConsoleLogging: config.enableConsoleLogging !== false,
            enableAnalytics: config.enableAnalytics !== false,
            enablePerformanceTracking: config.enablePerformanceTracking !== false,
            enableMouseTracking: config.enableMouseTracking !== false,
            sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30 minutes
            bufferSize: config.bufferSize || 100,
            flushInterval: config.flushInterval || 10000, // 10 seconds
            environment: config.environment || 'development',
            userId: config.userId || null,
            ...config
        };

        this.sessionId = this.generateSessionId();
        this.buffer = [];
        this.sessionStart = Date.now();
        this.lastActivity = Date.now();
        this.userFingerprint = this.generateFingerprint();

        // Start flush interval
        if (this.config.flushInterval > 0) {
            this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
        }

        // Initialize session tracking
        this.track('SESSION_START', {
            sessionId: this.sessionId,
            userId: this.config.userId,
            fingerprint: this.userFingerprint,
            timestamp: this.sessionStart,
            environment: this.config.environment
        });
    }

    generateSessionId() {
        return `tetra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateFingerprint() {
        // Simple browser fingerprinting
        if (typeof window !== 'undefined') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Tetra fingerprint', 2, 2);

            return btoa([
                navigator.userAgent,
                navigator.language,
                screen.width + 'x' + screen.height,
                new Date().getTimezoneOffset(),
                canvas.toDataURL()
            ].join('|')).substr(0, 16);
        }
        return 'server_' + Math.random().toString(36).substr(2, 12);
    }

    /**
     * Core tracking method - emits structured tetra tokens
     */
    track(event, data = {}, category = 'USER') {
        this.lastActivity = Date.now();

        const token = {
            token: `TETRA:${category}:${event}`,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            userId: this.config.userId,
            environment: this.config.environment,
            data: data
        };

        // Add to buffer
        this.buffer.push(token);

        // Console logging for TSM monitoring
        if (this.config.enableConsoleLogging) {
            const logLine = `${token.token} ${JSON.stringify({
                sessionId: token.sessionId,
                userId: token.userId,
                timestamp: token.timestamp,
                ...token.data
            })}`;
            console.log(logLine);
        }

        // Auto-flush if buffer is full
        if (this.buffer.length >= this.config.bufferSize) {
            this.flush();
        }

        return token;
    }

    // === USER INTERACTION TRACKING ===

    trackClick(element, coords = {}, metadata = {}) {
        return this.track('CLICK', {
            element: this.getElementSelector(element),
            coords,
            doubleClick: metadata.doubleClick || false,
            ctrlKey: metadata.ctrlKey || false,
            shiftKey: metadata.shiftKey || false,
            ...metadata
        }, 'INTERACTION');
    }

    trackScroll(direction, position, element = null) {
        return this.track('SCROLL', {
            direction,
            position: typeof position === 'object' ? position : { y: position },
            element: element ? this.getElementSelector(element) : 'window',
            viewport: typeof window !== 'undefined' ? {
                width: window.innerWidth,
                height: window.innerHeight
            } : null
        }, 'INTERACTION');
    }

    trackMouseMove(x, y, element = null) {
        // Throttle mouse movements to avoid spam
        if (!this.lastMouseMove || Date.now() - this.lastMouseMove > 100) {
            this.lastMouseMove = Date.now();
            return this.track('MOUSE_MOVE', {
                x, y,
                element: element ? this.getElementSelector(element) : null,
                viewport: typeof window !== 'undefined' ? {
                    width: window.innerWidth,
                    height: window.innerHeight
                } : null
            }, 'INTERACTION');
        }
    }

    trackPageView(url, referrer = null, loadTime = null) {
        const pageData = {
            url: url || (typeof window !== 'undefined' ? window.location.href : 'unknown'),
            referrer: referrer || (typeof document !== 'undefined' ? document.referrer : null),
            title: typeof document !== 'undefined' ? document.title : null,
            loadTime
        };

        if (typeof window !== 'undefined') {
            pageData.viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
        }

        return this.track('PAGE_VIEW', pageData, 'NAVIGATION');
    }

    // === SESSION MANAGEMENT ===

    trackLogin(userId, method = 'unknown', success = true) {
        this.config.userId = success ? userId : null;
        return this.track('LOGIN', {
            userId,
            method,
            success,
            sessionId: this.sessionId
        }, 'AUTH');
    }

    trackLogout() {
        const sessionDuration = Date.now() - this.sessionStart;
        this.track('LOGOUT', {
            userId: this.config.userId,
            sessionDuration,
            sessionId: this.sessionId
        }, 'AUTH');

        this.config.userId = null;
    }

    // === PERFORMANCE TRACKING ===

    trackPerformance(metric, value, metadata = {}) {
        return this.track(metric.toUpperCase(), {
            value,
            unit: metadata.unit || 'ms',
            ...metadata
        }, 'PERFORMANCE');
    }

    trackAPICall(endpoint, method, responseTime, status) {
        return this.track('API_CALL', {
            endpoint,
            method: method.toUpperCase(),
            responseTime,
            status,
            success: status >= 200 && status < 400
        }, 'PERFORMANCE');
    }

    trackError(error, context = {}) {
        return this.track('ERROR', {
            message: error.message || error,
            stack: error.stack,
            type: error.name || 'Error',
            context,
            url: typeof window !== 'undefined' ? window.location.href : null
        }, 'ERROR');
    }

    // === BEHAVIORAL ANALYTICS ===

    trackFeatureUse(feature, metadata = {}) {
        return this.track('FEATURE_USE', {
            feature,
            frequency: this.getFeatureFrequency(feature),
            ...metadata
        }, 'BEHAVIOR');
    }

    trackFormInteraction(field, action, metadata = {}) {
        return this.track('FORM_INTERACTION', {
            field,
            action, // focus, blur, change, submit
            valueLength: metadata.valueLength || 0,
            formId: metadata.formId,
            ...metadata
        }, 'INTERACTION');
    }

    trackSearch(query, results = 0, clicked = false) {
        return this.track('SEARCH', {
            query: this.config.logSearchQueries ? query : '[query]',
            queryLength: query.length,
            results,
            clicked
        }, 'BEHAVIOR');
    }

    // === UTILITY METHODS ===

    getElementSelector(element) {
        if (!element || typeof element === 'string') return element;

        let selector = element.tagName.toLowerCase();
        if (element.id) selector += `#${element.id}`;
        if (element.className) selector += `.${element.className.split(' ').join('.')}`;

        return selector;
    }

    getFeatureFrequency(feature) {
        // Simple in-memory frequency tracking
        if (!this.featureUsage) this.featureUsage = {};
        this.featureUsage[feature] = (this.featureUsage[feature] || 0) + 1;
        return this.featureUsage[feature];
    }

    // === DATA MANAGEMENT ===

    flush(force = false) {
        if (this.buffer.length === 0 && !force) return;

        const events = [...this.buffer];
        this.buffer = [];

        // In a real implementation, you'd send this to your analytics endpoint
        // For now, we'll emit a batch event that TSM can monitor
        if (this.config.enableConsoleLogging && events.length > 0) {
            console.log(`TETRA:BATCH_FLUSH ${JSON.stringify({
                eventCount: events.length,
                sessionId: this.sessionId,
                timestamp: Date.now(),
                events: this.config.includeEventsInFlush ? events : undefined
            })}`);
        }

        return events;
    }

    getSession() {
        return {
            sessionId: this.sessionId,
            userId: this.config.userId,
            fingerprint: this.userFingerprint,
            startTime: this.sessionStart,
            lastActivity: this.lastActivity,
            duration: Date.now() - this.sessionStart,
            environment: this.config.environment
        };
    }

    destroy() {
        // Clean shutdown
        this.track('SESSION_END', {
            sessionId: this.sessionId,
            userId: this.config.userId,
            duration: Date.now() - this.sessionStart,
            totalEvents: this.buffer.length
        });

        this.flush(true);

        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
    }
}

// === CLIENT-SIDE AUTO-TRACKING ===

class TetraClientTracker extends TetraMetrics {
    constructor(config = {}) {
        super(config);

        if (typeof window !== 'undefined') {
            this.initializeClientTracking();
        }
    }

    initializeClientTracking() {
        // Auto-track page loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.trackPageView(window.location.href, document.referrer,
                    performance.timing ? performance.timing.loadEventEnd - performance.timing.navigationStart : null);
            });
        } else {
            this.trackPageView(window.location.href, document.referrer);
        }

        // Track clicks
        document.addEventListener('click', (e) => {
            this.trackClick(e.target, { x: e.clientX, y: e.clientY }, {
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                doubleClick: e.detail === 2
            });
        });

        // Track scrolling (throttled)
        let scrollTimer;
        window.addEventListener('scroll', () => {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                this.trackScroll('unknown', {
                    x: window.pageXOffset,
                    y: window.pageYOffset
                });
            }, 150);
        });

        // Track mouse movements (heavily throttled) - only if enabled
        if (this.config.enableMouseTracking) {
            let mouseTimer;
            document.addEventListener('mousemove', (e) => {
                if (mouseTimer) clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    this.trackMouseMove(e.clientX, e.clientY);
                }, 200);
            });
        }

        // Track form interactions
        document.addEventListener('focus', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                this.trackFormInteraction(this.getElementSelector(e.target), 'focus', {
                    formId: e.target.form ? e.target.form.id : null
                });
            }
        }, true);

        // Track errors
        window.addEventListener('error', (e) => {
            this.trackError({
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                stack: e.error ? e.error.stack : null
            });
        });

        // Track unload
        window.addEventListener('beforeunload', () => {
            this.destroy();
        });
    }
}

// === EXPRESS MIDDLEWARE ===

const createTetraMiddleware = (config = {}) => {
    const tetra = new TetraMetrics(config);

    return (req, res, next) => {
        req.tetra = tetra;

        // Track API calls
        const start = Date.now();
        const originalSend = res.send;

        res.send = function(data) {
            const responseTime = Date.now() - start;
            tetra.trackAPICall(req.path, req.method, responseTime, res.statusCode);
            return originalSend.call(this, data);
        };

        next();
    };
};

// === EXPORTS ===

// Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TetraMetrics,
        TetraClientTracker,
        createTetraMiddleware
    };
}

// Browser environment
if (typeof window !== 'undefined') {
    window.TetraMetrics = TetraMetrics;
    window.TetraClientTracker = TetraClientTracker;

    // Auto-initialize if not disabled
    if (!window.TETRA_DISABLE_AUTO_INIT) {
        window.tetra = new TetraClientTracker(window.TETRA_CONFIG || {});
    }
}