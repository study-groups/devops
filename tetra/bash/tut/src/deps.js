/**
 * TUT Deps - Token dependency graph
 *
 * Builds a graph of how tokens reference each other via var() fallbacks
 * and inheritance patterns. Enables impact analysis for token changes.
 */

const TUT_Deps = {
    // Dependency graph: token -> { dependsOn: [], dependents: [] }
    _graph: {},

    /**
     * Initialize dependency tracking
     */
    init: function() {
        this._graph = {};
        this.build();
        console.log('[TUT.Deps] Initialized');
    },

    /**
     * Build dependency graph from stylesheets
     */
    build: function() {
        this._graph = {};

        // Scan all stylesheets for var() with fallbacks
        for (const sheet of document.styleSheets) {
            try {
                this._scanRules(sheet.cssRules);
            } catch (e) {
                // Cross-origin stylesheet
            }
        }

        // Also scan inline styles
        document.querySelectorAll('[style]').forEach(el => {
            this._parseValue(el.style.cssText);
        });

        console.log(`[TUT.Deps] Built graph: ${Object.keys(this._graph).length} tokens`);
        return this._graph;
    },

    /**
     * Recursively scan CSS rules
     */
    _scanRules: function(rules) {
        if (!rules) return;

        for (const rule of rules) {
            if (rule.cssRules) {
                this._scanRules(rule.cssRules);
            } else if (rule.style) {
                for (let i = 0; i < rule.style.length; i++) {
                    const prop = rule.style[i];
                    const value = rule.style.getPropertyValue(prop);

                    // Check if this is a token definition
                    if (prop.startsWith('--')) {
                        this._ensureToken(prop);
                        // Check if the value references other tokens
                        this._parseValue(value, prop);
                    } else {
                        // Regular property using tokens
                        this._parseValue(value);
                    }
                }
            }
        }
    },

    /**
     * Parse a CSS value for var() references and build dependencies
     */
    _parseValue: function(value, definingToken = null) {
        // Match var(--token) and var(--token, fallback)
        // Handles nested: var(--a, var(--b, var(--c, default)))
        const tokens = this._extractTokens(value);

        if (definingToken && tokens.length > 0) {
            // This token depends on others
            this._ensureToken(definingToken);
            tokens.forEach(dep => {
                this._ensureToken(dep);
                this._addDependency(definingToken, dep);
            });
        }
    },

    /**
     * Extract all token names from a CSS value
     */
    _extractTokens: function(value) {
        const tokens = [];
        const regex = /var\(\s*(--[\w-]+)/g;
        let match;
        while ((match = regex.exec(value)) !== null) {
            tokens.push(match[1]);
        }
        return tokens;
    },

    /**
     * Ensure token exists in graph
     */
    _ensureToken: function(token) {
        if (!this._graph[token]) {
            this._graph[token] = {
                name: token,
                dependsOn: [],    // Tokens this one uses
                dependents: [],   // Tokens that use this one
                depth: 0          // Distance from root (no dependencies)
            };
        }
    },

    /**
     * Add a dependency relationship
     */
    _addDependency: function(token, dependsOn) {
        if (!this._graph[token].dependsOn.includes(dependsOn)) {
            this._graph[token].dependsOn.push(dependsOn);
        }
        if (!this._graph[dependsOn].dependents.includes(token)) {
            this._graph[dependsOn].dependents.push(token);
        }
    },

    // =========================================================================
    // Query API
    // =========================================================================

    /**
     * Get dependency info for a token
     */
    get: function(token) {
        return this._graph[token] || null;
    },

    /**
     * Get all tokens this one depends on (direct)
     */
    getDependencies: function(token) {
        return this._graph[token]?.dependsOn || [];
    },

    /**
     * Get all tokens that depend on this one (direct)
     */
    getDependents: function(token) {
        return this._graph[token]?.dependents || [];
    },

    /**
     * Get full dependency chain (recursive, all ancestors)
     */
    getFullDependencies: function(token, visited = new Set()) {
        if (visited.has(token)) return []; // Cycle detection
        visited.add(token);

        const direct = this.getDependencies(token);
        const all = [...direct];

        direct.forEach(dep => {
            all.push(...this.getFullDependencies(dep, visited));
        });

        return [...new Set(all)];
    },

    /**
     * Get full dependent chain (recursive, all descendants)
     */
    getFullDependents: function(token, visited = new Set()) {
        if (visited.has(token)) return [];
        visited.add(token);

        const direct = this.getDependents(token);
        const all = [...direct];

        direct.forEach(dep => {
            all.push(...this.getFullDependents(dep, visited));
        });

        return [...new Set(all)];
    },

    /**
     * Get impact analysis for changing a token
     * Returns all tokens and approximate element count affected
     */
    getImpact: function(token) {
        const affected = this.getFullDependents(token);
        affected.unshift(token); // Include self

        let totalElements = 0;
        if (typeof TUT_Usage !== 'undefined') {
            affected.forEach(t => {
                const usage = TUT_Usage.get(t);
                if (usage) totalElements += usage.elements;
            });
        }

        return {
            token,
            affectedTokens: affected,
            affectedCount: affected.length,
            estimatedElements: totalElements,
            risk: affected.length > 10 ? 'high' : affected.length > 3 ? 'medium' : 'low'
        };
    },

    /**
     * Get root tokens (no dependencies, foundation of design system)
     */
    getRoots: function() {
        return Object.values(this._graph)
            .filter(t => t.dependsOn.length === 0)
            .map(t => t.name);
    },

    /**
     * Get leaf tokens (nothing depends on them)
     */
    getLeaves: function() {
        return Object.values(this._graph)
            .filter(t => t.dependents.length === 0)
            .map(t => t.name);
    },

    /**
     * Detect circular dependencies
     */
    findCycles: function() {
        const cycles = [];
        const visited = new Set();
        const stack = new Set();

        const dfs = (token, path) => {
            if (stack.has(token)) {
                const cycleStart = path.indexOf(token);
                cycles.push(path.slice(cycleStart));
                return;
            }
            if (visited.has(token)) return;

            visited.add(token);
            stack.add(token);
            path.push(token);

            (this._graph[token]?.dependsOn || []).forEach(dep => {
                dfs(dep, [...path]);
            });

            stack.delete(token);
        };

        Object.keys(this._graph).forEach(token => {
            dfs(token, []);
        });

        return cycles;
    },

    /**
     * Get tokens grouped by depth (layers of abstraction)
     */
    getLayers: function() {
        const layers = {};

        // Calculate depth for each token
        const calculateDepth = (token, visited = new Set()) => {
            if (visited.has(token)) return 0;
            visited.add(token);

            const deps = this._graph[token]?.dependsOn || [];
            if (deps.length === 0) return 0;

            return 1 + Math.max(...deps.map(d => calculateDepth(d, visited)));
        };

        Object.keys(this._graph).forEach(token => {
            const depth = calculateDepth(token);
            this._graph[token].depth = depth;

            if (!layers[depth]) layers[depth] = [];
            layers[depth].push(token);
        });

        return layers;
    },

    /**
     * Export graph as DOT format (for visualization)
     */
    toDOT: function() {
        let dot = 'digraph TokenDeps {\n';
        dot += '  rankdir=TB;\n';
        dot += '  node [shape=box, style=rounded];\n\n';

        Object.entries(this._graph).forEach(([token, data]) => {
            const label = token.replace('--', '');
            dot += `  "${label}";\n`;

            data.dependsOn.forEach(dep => {
                const depLabel = dep.replace('--', '');
                dot += `  "${depLabel}" -> "${label}";\n`;
            });
        });

        dot += '}\n';
        return dot;
    },

    /**
     * Export as JSON for external tools
     */
    toJSON: function() {
        return JSON.stringify(this._graph, null, 2);
    }
};
