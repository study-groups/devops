/**
 * PanelEventBus.js - Global event bus for inter-panel communication
 *
 * @deprecated This module is deprecated. Use the unified eventBus from '../eventBus.js' instead.
 * The unified eventBus now includes:
 * - subscribeAs(sourceId, event, handler) - Subscribe with source tracking
 * - cleanupSource(sourceId) - Cleanup all subscriptions for a source
 * - getActiveSources() - Get all active source IDs
 *
 * Migration:
 *   Before: panelEventBus.subscribe(panelId, event, callback)
 *   After:  eventBus.subscribeAs(panelId, event, callback)
 *
 *   Before: panelEventBus.publish(panelId, event, data)
 *   After:  eventBus.emit(event, { source: panelId, timestamp: Date.now(), data })
 *
 *   Before: panelEventBus.cleanup(panelId)
 *   After:  eventBus.cleanupSource(panelId)
 */

/**
 * Global event bus for panel communication
 */
export class PanelEventBus {
    constructor() {
        // Use existing pubsub system (will be set on initialization)
        this.pubsub = null;

        // Track subscriptions per panel for cleanup
        // Map<panelId, Array<{event, unsubscribe}>>
        this.panelSubscriptions = new Map();

        // Track event statistics for debugging
        this.stats = {
            totalPublished: 0,
            totalSubscriptions: 0,
            eventCounts: new Map()
        };

        this._deprecationWarned = false;
        console.log('[PanelEventBus] Initialized (DEPRECATED - use eventBus from eventBus.js)');
    }

    _warnDeprecation(method) {
        if (!this._deprecationWarned) {
            console.warn(`[PanelEventBus] DEPRECATED: ${method}() called. Migrate to unified eventBus from eventBus.js`);
            this._deprecationWarned = true;
        }
    }

    /**
     * Initialize with pubsub system
     * @param {Object} pubsubSystem - The pubsub system from window.APP.services.pubsub
     */
    initialize(pubsubSystem) {
        if (!pubsubSystem) {
            console.error('[PanelEventBus] pubsub system is required');
            return;
        }

        this.pubsub = pubsubSystem;
        console.log('[PanelEventBus] Connected to pubsub system');
    }

    /**
     * Panel subscribes to an event
     * @param {string} panelId - ID of subscribing panel
     * @param {string} event - Event name (e.g., 'element-selected')
     * @param {Function} callback - Callback function (receives payload)
     * @returns {Function} Unsubscribe function
     */
    subscribe(panelId, event, callback) {
        this._warnDeprecation('subscribe');
        if (!this.pubsub) {
            console.error('[PanelEventBus] Not initialized. Call initialize() first.');
            return () => {};
        }

        if (!panelId || !event || typeof callback !== 'function') {
            console.error('[PanelEventBus] Invalid subscribe parameters', { panelId, event, callback });
            return () => {};
        }

        // Track subscription for cleanup
        if (!this.panelSubscriptions.has(panelId)) {
            this.panelSubscriptions.set(panelId, []);
        }

        // Wrap callback to provide consistent payload format
        const wrappedCallback = (payload) => {
            try {
                callback(payload);
            } catch (error) {
                console.error(`[PanelEventBus] Error in callback for ${event} (panel: ${panelId}):`, error);
            }
        };

        // Subscribe via pubsub
        const unsubscribe = this.pubsub.subscribe(event, wrappedCallback);

        // Store for panel cleanup
        this.panelSubscriptions.get(panelId).push({ event, unsubscribe });

        // Update stats
        this.stats.totalSubscriptions++;

        console.log(`[PanelEventBus] Panel "${panelId}" subscribed to "${event}"`);

        // Return unsubscribe function
        return () => {
            unsubscribe();
            this._removeSubscription(panelId, unsubscribe);
        };
    }

    /**
     * Panel publishes an event
     * @param {string} panelId - ID of publishing panel
     * @param {string} event - Event name (e.g., 'element-selected')
     * @param {*} data - Event data
     */
    publish(panelId, event, data) {
        this._warnDeprecation('publish');
        if (!this.pubsub) {
            console.error('[PanelEventBus] Not initialized. Call initialize() first.');
            return;
        }

        if (!panelId || !event) {
            console.error('[PanelEventBus] Invalid publish parameters', { panelId, event });
            return;
        }

        // Create standardized payload
        const payload = {
            source: panelId,
            timestamp: Date.now(),
            data: data
        };

        // Publish to exact event name
        this.pubsub.publish(event, payload);

        // Also publish to namespaced event for filtering
        this.pubsub.publish(`panel:${event}`, payload);

        // Update stats
        this.stats.totalPublished++;
        const count = this.stats.eventCounts.get(event) || 0;
        this.stats.eventCounts.set(event, count + 1);

        console.log(`[PanelEventBus] Panel "${panelId}" published "${event}"`, data);
    }

    /**
     * Cleanup all subscriptions for a panel
     * Call this when a panel is destroyed
     * @param {string} panelId - Panel ID
     */
    cleanup(panelId) {
        const subscriptions = this.panelSubscriptions.get(panelId);
        if (!subscriptions) {
            return;
        }

        // Unsubscribe from all events
        subscriptions.forEach(({ event, unsubscribe }) => {
            unsubscribe();
            console.log(`[PanelEventBus] Cleaned up subscription for panel "${panelId}" event "${event}"`);
        });

        // Remove from tracking
        this.panelSubscriptions.delete(panelId);

        console.log(`[PanelEventBus] Cleaned up ${subscriptions.length} subscriptions for panel "${panelId}"`);
    }

    /**
     * Remove a specific subscription from tracking
     * @private
     */
    _removeSubscription(panelId, unsubscribe) {
        const subscriptions = this.panelSubscriptions.get(panelId);
        if (!subscriptions) return;

        const index = subscriptions.findIndex(s => s.unsubscribe === unsubscribe);
        if (index !== -1) {
            subscriptions.splice(index, 1);
        }

        // Clean up empty arrays
        if (subscriptions.length === 0) {
            this.panelSubscriptions.delete(panelId);
        }
    }

    /**
     * Get all panels subscribed to an event
     * @param {string} event - Event name
     * @returns {string[]} Array of panel IDs
     */
    getSubscribers(event) {
        const panels = [];
        this.panelSubscriptions.forEach((subs, panelId) => {
            if (subs.some(s => s.event === event)) {
                panels.push(panelId);
            }
        });
        return panels;
    }

    /**
     * Get subscription count for a panel
     * @param {string} panelId - Panel ID
     * @returns {number} Number of active subscriptions
     */
    getSubscriptionCount(panelId) {
        const subscriptions = this.panelSubscriptions.get(panelId);
        return subscriptions ? subscriptions.length : 0;
    }

    /**
     * Get all active panel IDs with subscriptions
     * @returns {string[]} Array of panel IDs
     */
    getActivePanels() {
        return Array.from(this.panelSubscriptions.keys());
    }

    /**
     * Get statistics for debugging
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            activePanels: this.panelSubscriptions.size,
            eventCounts: Object.fromEntries(this.stats.eventCounts)
        };
    }

    /**
     * Reset statistics (for testing)
     */
    resetStats() {
        this.stats = {
            totalPublished: 0,
            totalSubscriptions: 0,
            eventCounts: new Map()
        };
    }

    /**
     * Check if event bus is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.pubsub !== null;
    }
}

// Create singleton instance
export const panelEventBus = new PanelEventBus();

// Register in window.APP when available
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.panels = window.APP.panels || {};
    window.APP.panels.eventBus = panelEventBus;

    console.log('[PanelEventBus] Registered at window.APP.panels.eventBus');
}
