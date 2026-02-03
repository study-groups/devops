// api-cache.js - Client-side API response caching layer
// Reduces redundant requests, deduplicates in-flight requests, configurable TTL

const ApiCache = {
    // Cache storage: { url: { data, timestamp, promise } }
    cache: new Map(),

    // Default TTL in milliseconds (5 seconds)
    defaultTTL: 5000,

    // In-flight request deduplication
    pending: new Map(),

    /**
     * Fetch with caching
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options plus cache config
     * @param {number} options.ttl - Cache TTL in ms (default: 5000)
     * @param {boolean} options.bypassCache - Skip cache, fetch fresh
     * @param {boolean} options.updateCache - Update cache with fresh data
     * @returns {Promise<any>} JSON response
     */
    async fetch(url, options = {}) {
        const { ttl = this.defaultTTL, bypassCache = false, updateCache = true, ...fetchOpts } = options;

        // Only cache GET requests
        const isGet = !fetchOpts.method || fetchOpts.method === 'GET';

        // Check cache first (for GET requests)
        if (isGet && !bypassCache) {
            const cached = this.get(url, ttl);
            if (cached !== null) {
                return cached;
            }
        }

        // Deduplicate in-flight requests for same URL
        if (isGet && this.pending.has(url)) {
            return this.pending.get(url);
        }

        // Create fetch promise
        const fetchPromise = fetch(url, fetchOpts)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Store in cache
                if (isGet && updateCache) {
                    this.set(url, data);
                }
                // Clear pending
                this.pending.delete(url);
                return data;
            })
            .catch(error => {
                this.pending.delete(url);
                throw error;
            });

        // Track in-flight request
        if (isGet) {
            this.pending.set(url, fetchPromise);
        }

        return fetchPromise;
    },

    /**
     * Get cached value if valid
     */
    get(url, ttl = this.defaultTTL) {
        const entry = this.cache.get(url);
        if (!entry) return null;

        const age = Date.now() - entry.timestamp;
        if (age > ttl) {
            this.cache.delete(url);
            return null;
        }

        return entry.data;
    },

    /**
     * Set cache value
     */
    set(url, data) {
        this.cache.set(url, {
            data,
            timestamp: Date.now()
        });
    },

    /**
     * Invalidate cache for URL or pattern
     * @param {string|RegExp} pattern - URL string or regex pattern
     */
    invalidate(pattern) {
        if (typeof pattern === 'string') {
            this.cache.delete(pattern);
        } else if (pattern instanceof RegExp) {
            for (const url of this.cache.keys()) {
                if (pattern.test(url)) {
                    this.cache.delete(url);
                }
            }
        }
    },

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    },

    /**
     * Get cache stats
     */
    stats() {
        const entries = [];
        const now = Date.now();

        for (const [url, entry] of this.cache) {
            entries.push({
                url: url.length > 50 ? url.slice(0, 50) + '...' : url,
                age: Math.round((now - entry.timestamp) / 1000) + 's',
                size: JSON.stringify(entry.data).length
            });
        }

        return {
            count: this.cache.size,
            pending: this.pending.size,
            entries
        };
    },

    /**
     * Prefetch URLs into cache
     * @param {string[]} urls - URLs to prefetch
     */
    async prefetch(urls) {
        return Promise.allSettled(
            urls.map(url => this.fetch(url, { updateCache: true }))
        );
    },

    /**
     * Batch fetch with cache
     * Fetches multiple URLs, using cache where available
     * @param {string[]} urls - URLs to fetch
     * @param {Object} options - Cache options
     * @returns {Promise<Map<string, any>>} Map of url -> data
     */
    async batchFetch(urls, options = {}) {
        const results = new Map();

        await Promise.allSettled(
            urls.map(async url => {
                try {
                    const data = await this.fetch(url, options);
                    results.set(url, { success: true, data });
                } catch (error) {
                    results.set(url, { success: false, error: error.message });
                }
            })
        );

        return results;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiCache;
}
