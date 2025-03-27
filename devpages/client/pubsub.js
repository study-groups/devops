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
    window.pubsub = { publish, subscribe };
} 