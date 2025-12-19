/**
 * TUT Usage - Token usage tracking and analytics
 *
 * Scans DOM and stylesheets to build a map of where tokens are used,
 * tracks changes over time, and identifies orphaned/missing tokens.
 */

const TUT_Usage = {
    // Token usage registry
    _registry: {},

    // Scan configuration
    _config: {
        scanInterval: null,
        autoScan: false,
        trackHistory: true,
        maxHistory: 50
    },

    /**
     * Initialize usage tracking
     */
    init: function() {
        this._registry = {};
        this.scan();
        console.log('[TUT.Usage] Initialized');
    },

    /**
     * Full scan - analyze DOM and stylesheets for token usage
     */
    scan: function() {
        const startTime = performance.now();

        // Reset counts (keep history)
        Object.keys(this._registry).forEach(token => {
            this._registry[token].references = [];
            this._registry[token].elements = 0;
            this._registry[token].stylesheets = [];
        });

        // Scan all defined tokens
        this._scanDefinitions();

        // Scan DOM for computed style usage
        this._scanDOM();

        // Scan stylesheets for references
        this._scanStylesheets();

        // Calculate derived metrics
        this._calculateMetrics();

        const elapsed = (performance.now() - startTime).toFixed(2);
        console.log(`[TUT.Usage] Scan complete: ${Object.keys(this._registry).length} tokens in ${elapsed}ms`);

        // Emit event
        if (typeof TERRAIN !== 'undefined' && TERRAIN.Events) {
            TERRAIN.Events.emit('tut:usage:scan', {
                tokens: Object.keys(this._registry).length,
                elapsed
            });
        }

        return this._registry;
    },

    /**
     * Scan :root for token definitions
     */
    _scanDefinitions: function() {
        const root = document.documentElement;
        const rootStyles = getComputedStyle(root);

        // Get all custom properties from stylesheets
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules || []) {
                    if (rule.selectorText === ':root' && rule.style) {
                        for (let i = 0; i < rule.style.length; i++) {
                            const prop = rule.style[i];
                            if (prop.startsWith('--')) {
                                this._ensureToken(prop);
                                this._registry[prop].defined = true;
                                this._registry[prop].value = rootStyles.getPropertyValue(prop).trim();
                                this._registry[prop].source = sheet.href || 'inline';
                            }
                        }
                    }
                }
            } catch (e) {
                // Cross-origin stylesheet, skip
            }
        }
    },

    /**
     * Scan DOM elements for token usage in computed styles
     */
    _scanDOM: function() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            this._scanElement(node);
        }
    },

    /**
     * Scan a single element for token usage
     */
    _scanElement: function(el) {
        // Skip script, style, and hidden elements
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return;

        const computed = getComputedStyle(el);
        const inline = el.style;

        // Check inline styles for var() references
        for (let i = 0; i < inline.length; i++) {
            const prop = inline[i];
            const value = inline.getPropertyValue(prop);
            this._extractTokenRefs(value, el, prop, 'inline');
        }

        // Track which tokens this element's computed style resolves to
        // by checking known token values
        Object.keys(this._registry).forEach(token => {
            const tokenValue = this._registry[token].value;
            if (!tokenValue) return;

            // Check common properties that use tokens
            const propsToCheck = [
                'background-color', 'color', 'border-color',
                'border-top-color', 'border-right-color',
                'border-bottom-color', 'border-left-color',
                'fill', 'stroke', 'box-shadow'
            ];

            propsToCheck.forEach(prop => {
                const computedValue = computed.getPropertyValue(prop);
                if (computedValue && computedValue.includes(tokenValue)) {
                    this._addReference(token, el, prop, 'computed');
                }
            });
        });
    },

    /**
     * Extract var(--token) references from a CSS value
     */
    _extractTokenRefs: function(value, el, prop, type) {
        const varRegex = /var\(\s*(--[\w-]+)/g;
        let match;
        while ((match = varRegex.exec(value)) !== null) {
            const token = match[1];
            this._ensureToken(token);
            this._addReference(token, el, prop, type);
        }
    },

    /**
     * Scan stylesheets for var() references
     */
    _scanStylesheets: function() {
        for (const sheet of document.styleSheets) {
            try {
                const href = sheet.href || 'inline';
                this._scanRules(sheet.cssRules, href);
            } catch (e) {
                // Cross-origin stylesheet
            }
        }
    },

    /**
     * Recursively scan CSS rules
     */
    _scanRules: function(rules, source) {
        if (!rules) return;

        for (const rule of rules) {
            if (rule.cssRules) {
                // @media, @supports, etc.
                this._scanRules(rule.cssRules, source);
            } else if (rule.style) {
                for (let i = 0; i < rule.style.length; i++) {
                    const prop = rule.style[i];
                    const value = rule.style.getPropertyValue(prop);

                    const varRegex = /var\(\s*(--[\w-]+)/g;
                    let match;
                    while ((match = varRegex.exec(value)) !== null) {
                        const token = match[1];
                        this._ensureToken(token);

                        if (!this._registry[token].stylesheets.includes(source)) {
                            this._registry[token].stylesheets.push(source);
                        }

                        this._registry[token].cssRules = (this._registry[token].cssRules || 0) + 1;
                    }
                }
            }
        }
    },

    /**
     * Ensure token exists in registry
     */
    _ensureToken: function(token) {
        if (!this._registry[token]) {
            this._registry[token] = {
                name: token,
                defined: false,
                value: null,
                source: null,
                references: [],
                elements: 0,
                stylesheets: [],
                cssRules: 0,
                history: [],
                firstSeen: Date.now(),
                lastChanged: null
            };
        }
    },

    /**
     * Add a reference to a token
     */
    _addReference: function(token, el, prop, type) {
        this._ensureToken(token);

        this._registry[token].references.push({
            element: el.tagName.toLowerCase(),
            id: el.id || null,
            classes: Array.from(el.classList).slice(0, 3),
            property: prop,
            type: type
        });

        this._registry[token].elements++;
    },

    /**
     * Calculate derived metrics
     */
    _calculateMetrics: function() {
        Object.values(this._registry).forEach(token => {
            // Components (unique class combinations)
            const components = new Set();
            token.references.forEach(ref => {
                if (ref.classes.length > 0) {
                    components.add(ref.classes[0]);
                }
            });
            token.components = Array.from(components);

            // Orphan detection
            token.isOrphan = token.defined && token.elements === 0 && token.cssRules === 0;

            // Missing detection (referenced but not defined)
            token.isMissing = !token.defined && (token.elements > 0 || token.cssRules > 0);
        });
    },

    /**
     * Record a value change in history
     */
    recordChange: function(token, oldValue, newValue) {
        this._ensureToken(token);

        if (this._config.trackHistory) {
            this._registry[token].history.unshift({
                from: oldValue,
                to: newValue,
                timestamp: Date.now()
            });

            // Trim history
            if (this._registry[token].history.length > this._config.maxHistory) {
                this._registry[token].history.pop();
            }
        }

        this._registry[token].lastChanged = Date.now();
        this._registry[token].value = newValue;
    },

    // =========================================================================
    // Query API
    // =========================================================================

    /**
     * Get usage data for a specific token
     */
    get: function(token) {
        return this._registry[token] || null;
    },

    /**
     * Get all tokens
     */
    getAll: function() {
        return { ...this._registry };
    },

    /**
     * Get tokens sorted by usage count
     */
    getByUsage: function() {
        return Object.values(this._registry)
            .sort((a, b) => b.elements - a.elements);
    },

    /**
     * Get orphaned tokens (defined but never used)
     */
    getOrphans: function() {
        return Object.values(this._registry)
            .filter(t => t.isOrphan);
    },

    /**
     * Get missing tokens (used but not defined)
     */
    getMissing: function() {
        return Object.values(this._registry)
            .filter(t => t.isMissing);
    },

    /**
     * Get tokens by component/class usage
     */
    getByComponent: function(component) {
        return Object.values(this._registry)
            .filter(t => t.components.includes(component));
    },

    /**
     * Get recently changed tokens
     */
    getRecentlyChanged: function(since = Date.now() - 3600000) {
        return Object.values(this._registry)
            .filter(t => t.lastChanged && t.lastChanged > since)
            .sort((a, b) => b.lastChanged - a.lastChanged);
    },

    /**
     * Get usage summary statistics
     */
    getSummary: function() {
        const tokens = Object.values(this._registry);
        return {
            total: tokens.length,
            defined: tokens.filter(t => t.defined).length,
            used: tokens.filter(t => t.elements > 0 || t.cssRules > 0).length,
            orphans: tokens.filter(t => t.isOrphan).length,
            missing: tokens.filter(t => t.isMissing).length,
            totalReferences: tokens.reduce((sum, t) => sum + t.elements, 0),
            mostUsed: tokens.sort((a, b) => b.elements - a.elements)[0]?.name || null
        };
    },

    /**
     * Find all elements using a specific token
     */
    findElements: function(token) {
        const elements = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const inline = node.style.cssText;
            if (inline.includes(token)) {
                elements.push(node);
            }
        }

        return elements;
    },

    /**
     * Highlight elements using a token (visual debugging)
     */
    highlight: function(token, color = 'rgba(255, 0, 0, 0.3)') {
        this.clearHighlights();

        const elements = this.findElements(token);
        elements.forEach(el => {
            el.dataset.tutHighlight = 'true';
            el.style.outline = `2px solid ${color}`;
            el.style.outlineOffset = '2px';
        });

        return elements.length;
    },

    /**
     * Clear all highlights
     */
    clearHighlights: function() {
        document.querySelectorAll('[data-tut-highlight]').forEach(el => {
            delete el.dataset.tutHighlight;
            el.style.outline = '';
            el.style.outlineOffset = '';
        });
    }
};
