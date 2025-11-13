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

// Make globally available via window.APP.services
// (Will be registered by ServiceInitializer)
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.services = window.APP.services || {};
    window.APP.services.pubsub = { publish, subscribe };
} 