/**
 * Lifecycle Manager
 * 
 * Coordinates application lifecycle events and ensures proper sequencing
 */

import { LifecycleEvents, EventMetadata } from './events.js';

export class LifecycleManager {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.currentPhase = null;
    this.completedPhases = new Set();
    this.eventHistory = [];
    this.subscribers = new Map();
  }

  /**
   * Initialize with the main application eventBus
   * @param {Object} eventBus - The main application event bus
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Emit a lifecycle event
   * @param {string} event - Lifecycle event name
   * @param {Object} data - Optional event data
   */
  emit(event, data = {}) {
    const metadata = EventMetadata[event];
    
    // Validate dependencies
    if (metadata?.dependencies) {
      for (const dependency of metadata.dependencies) {
        if (!this.hasEventOccurred(dependency)) {
          console.warn(`[LifecycleManager] Event ${event} emitted before dependency ${dependency}`);
        }
      }
    }

    // Record event
    this.eventHistory.push({
      event,
      timestamp: Date.now(),
      data: { ...data }
    });

    // Update current phase
    this.currentPhase = event;
    this.completedPhases.add(event);

    // Log the event
    console.log(`[LifecycleManager] ${event}: ${metadata?.description || 'No description'}`);

    // Emit via main application eventBus
    if (this.eventBus) {
      this.eventBus.emit(event, data);
    } else {
      console.warn('[LifecycleManager] No eventBus available for emitting events');
    }
  }

  /**
   * Subscribe to a lifecycle event
   * @param {string} event - Event to subscribe to
   * @param {Function} callback - Callback function
   * @param {Object} options - Subscription options
   */
  on(event, callback, options = {}) {
    const { 
      immediate = true, // Call immediately if event already occurred
      once = false 
    } = options;

    // If event already occurred and immediate is true, call callback now
    if (immediate && this.hasEventOccurred(event)) {
      const eventData = this.getEventData(event);
      callback(eventData);
      return () => {}; // Return empty unsubscribe function
    }

    // Subscribe to future events via main eventBus
    if (!this.eventBus) {
      console.warn('[LifecycleManager] No eventBus available for subscriptions');
      return () => {};
    }
    
    const unsubscribe = this.eventBus.on(event, callback);
    
    // Track subscription for debugging
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event).push({
      callback,
      options,
      subscribedAt: Date.now()
    });

    return unsubscribe;
  }

  /**
   * Check if an event has occurred
   * @param {string} event - Event name
   * @returns {boolean}
   */
  hasEventOccurred(event) {
    return this.completedPhases.has(event);
  }

  /**
   * Get data from a completed event
   * @param {string} event - Event name
   * @returns {Object|null}
   */
  getEventData(event) {
    const eventRecord = this.eventHistory.find(record => record.event === event);
    return eventRecord?.data || null;
  }

  /**
   * Check if it's safe to make API calls
   * @returns {boolean}
   */
  isSafeForApiCalls() {
    return this.hasEventOccurred(LifecycleEvents.UI_SAFE_TO_API_CALL) ||
           this.hasEventOccurred(LifecycleEvents.APP_READY);
  }

  /**
   * Wait for a specific event (returns a Promise)
   * @param {string} event - Event to wait for
   * @returns {Promise}
   */
  waitFor(event) {
    if (this.hasEventOccurred(event)) {
      return Promise.resolve(this.getEventData(event));
    }

    return new Promise((resolve) => {
      const unsubscribe = this.on(event, (data) => {
        unsubscribe();
        resolve(data);
      }, { immediate: false });
    });
  }

  /**
   * Get debug information about the current lifecycle state
   * @returns {Object}
   */
  getDebugInfo() {
    return {
      currentPhase: this.currentPhase,
      completedPhases: Array.from(this.completedPhases),
      eventHistory: this.eventHistory,
      subscriberCounts: Object.fromEntries(
        Array.from(this.subscribers.entries()).map(([event, subs]) => [event, subs.length])
      ),
      safeForApiCalls: this.isSafeForApiCalls()
    };
  }

  /**
   * Reset the lifecycle manager (for testing)
   */
  reset() {
    this.currentPhase = null;
    this.completedPhases.clear();
    this.eventHistory = [];
    this.subscribers.clear();
  }
}

// Export singleton instance
export const lifecycleManager = new LifecycleManager(); 