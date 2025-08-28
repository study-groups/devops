// Simple pub/sub system

const subscribers = {};

export function publish(event, data) {
    if (!subscribers[event]) return;
    
    subscribers[event].forEach(callback => {
        try {
            callback(data);
        } catch (error) {
            console.error(`Error in subscriber for ${event}:`, error);
        }
    });
}

export function subscribe(event, callback) {
    if (!subscribers[event]) {
        subscribers[event] = [];
    }
    
    subscribers[event].push(callback);
    
    // Return unsubscribe function
    return () => {
        subscribers[event] = subscribers[event].filter(cb => cb !== callback);
    };
}

// Make globally available
if (typeof window !== 'undefined') {
    const pubsub = { publish, subscribe };

// Register with consolidation system
if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
    window.devpages._internal.consolidator.migrate('pubsub', pubsub);
} else {
    // Fallback for legacy support
    // Expose via APP.services instead of global window
    window.APP = window.APP || {};
    window.APP.services = window.APP.services || {};
    window.APP.services.pubsub = pubsub;
}
} 