/**
 * @file pja-activity-bus.js
 * @description A UI-centric activity bus for PJA panels and components.
 */

window.APP = window.APP || {};

class DevWatchActivityBus {
    constructor(options = {}) {
        this.logToSystem = options.logToSystem || false;
        this.activities = APP.utils.storage.get('pja_activity_log', []);
        this.subscribers = new Set();
        this.maxEntries = options.maxEntries || 200;
    }

    /**
     * Subscribe a component to activity updates.
     * @param {Function} callback - The function to call with the full activity list on updates.
     * @returns {Function} An unsubscribe function.
     */
    subscribe(callback) {
        if (typeof callback !== 'function') return () => {};
        this.subscribers.add(callback);
        // Immediately provide the current list to the new subscriber
        callback(this.activities);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Add a new entry to the activity bus.
     * @param {Object} entry - The activity entry.
     * @param {string} entry.from - The source of the activity (e.g., 'command-runner').
     * @param {string} entry.message - The activity message.
     * @param {string} [entry.level='info'] - The log level ('info', 'warn', 'error', 'debug').
     * @param {Object} [entry.data={}] - Additional data associated with the activity.
     */
    addEntry({ from, message, level = 'info', data = {} }) {
        const newEntry = {
            id: APP.utils.generateId(),
            timestamp: new Date().toISOString(),
            from,
            message,
            level,
            data
        };

        // Add to the front of the array
        this.activities.unshift(newEntry);

        // Trim the log to maxEntries
        if (this.activities.length > this.maxEntries) {
            this.activities = this.activities.slice(0, this.maxEntries);
        }

        // Persist to localStorage
        APP.utils.storage.set('pja_activity_log', this.activities);

        // Notify subscribers
        this.notifySubscribers();

        // Optionally duplicate to the main system log
        if (this.logToSystem) {
            // Use the new, correct APP.log interface with a robust switch statement
            switch (level.toLowerCase()) {
                case 'warn':
                    APP.log.warn(`activity.${from}`, message, data);
                    break;
                case 'error':
                    APP.log.error(`activity.${from}`, message, data);
                    break;
                case 'debug':
                    APP.log.debug(`activity.${from}`, message, data);
                    break;
                case 'info':
                default:
                    APP.log.info(`activity.${from}`, message, data);
                    break;
            }
        }
    }
    
    /**
     * Clear all activities from the bus.
     */
    clear() {
        this.activities = [];
        APP.utils.storage.remove('pja_activity_log');
        this.notifySubscribers();
    }

    /**
     * Notify all subscribers of the current activity state.
     */
    notifySubscribers() {
        for (const callback of this.subscribers) {
            callback(this.activities);
        }
    }
}

// Instantiate the global activity bus
window.APP.activityBus = new DevWatchActivityBus({ logToSystem: true });
