/**
 * Enhanced Redux Connect Pattern for DevPages
 * 
 * This file provides optimized connection utilities that replace manual
 * store subscriptions with performance-optimized, memoized patterns.
 */

import { appStore } from '/client/appState.js';
import { shallowEqual } from './connect.js';

/**
 * Enhanced connect pattern with selective subscriptions and memoization
 * Only re-renders when specified state slices actually change
 */
export function createOptimizedConnect(options = {}) {
    const { 
        subscribeToKeys = [], // Only subscribe to specific state keys
        debounceMs = 0,       // Optional debouncing for high-frequency updates
        name = 'Component'    // For debugging
    } = options;

    return function(mapStateToProps, mapDispatchToProps = () => ({})) {
        return function(ComponentClass) {
            return class ConnectedComponent extends ComponentClass {
                constructor(...args) {
                    super(...args);
                    this.lastMappedState = null;
                    this.storeUnsubscribe = null;
                    this.updateTimeout = null;
                    
                    // Bind methods
                    this.handleStoreChange = this.handleStoreChange.bind(this);
                    this.scheduleUpdate = this.scheduleUpdate.bind(this);
                    
                    // Start subscription
                    this.setupStoreSubscription();
                }

                setupStoreSubscription() {
                    if (this.storeUnsubscribe) {
                        this.storeUnsubscribe();
                    }

                    this.storeUnsubscribe = appStore.subscribe(this.handleStoreChange);
                    
                    // Initial update
                    this.handleStoreChange();
                }

                handleStoreChange() {
                    const state = appStore.getState();
                    
                    // If we have specific keys to watch, check if they changed
                    if (subscribeToKeys.length > 0) {
                        const hasRelevantChanges = subscribeToKeys.some(key => {
                            const currentValue = state[key];
                            const lastValue = this.lastFullState?.[key];
                            return currentValue !== lastValue;
                        });
                        
                        if (!hasRelevantChanges) {
                            return; // No relevant changes, skip update
                        }
                    }
                    
                    this.lastFullState = state;
                    
                    if (debounceMs > 0) {
                        this.scheduleUpdate();
                    } else {
                        this.performUpdate();
                    }
                }

                scheduleUpdate() {
                    if (this.updateTimeout) {
                        clearTimeout(this.updateTimeout);
                    }
                    
                    this.updateTimeout = setTimeout(() => {
                        this.performUpdate();
                        this.updateTimeout = null;
                    }, debounceMs);
                }

                performUpdate() {
                    const state = appStore.getState();
                    const mappedState = mapStateToProps(state);
                    
                    // Only update if mapped state actually changed
                    if (this.lastMappedState && shallowEqual(this.lastMappedState, mappedState)) {
                        return;
                    }
                    
                    this.lastMappedState = mappedState;
                    const mappedDispatch = mapDispatchToProps(appStore.dispatch);
                    
                    // Call the component's update method if it exists
                    if (typeof this.onReduxUpdate === 'function') {
                        this.onReduxUpdate(mappedState, mappedDispatch);
                    }
                    
                    // Call render if it exists
                    if (typeof this.render === 'function') {
                        this.render();
                    }
                }

                destroy() {
                    if (this.updateTimeout) {
                        clearTimeout(this.updateTimeout);
                    }
                    
                    if (this.storeUnsubscribe) {
                        this.storeUnsubscribe();
                        this.storeUnsubscribe = null;
                    }
                    
                    // Call parent destroy if it exists
                    if (super.destroy) {
                        super.destroy();
                    }
                }
            };
        };
    };
}

/**
 * Specialized connect patterns for common use cases
 */

// For auth-dependent components
export const connectToAuth = createOptimizedConnect({
    subscribeToKeys: ['auth'],
    name: 'AuthConnected'
});

// For file-dependent components  
export const connectToFile = createOptimizedConnect({
    subscribeToKeys: ['file', 'editor'],
    name: 'FileConnected'
});

// For UI-dependent components
export const connectToUI = createOptimizedConnect({
    subscribeToKeys: ['ui'],
    name: 'UIConnected'
});

// For high-frequency components (like logs)
export const connectToLogs = createOptimizedConnect({
    subscribeToKeys: ['log'],
    debounceMs: 100,
    name: 'LogConnected'
});

// For layout components that need multiple state slices
export const connectToLayout = createOptimizedConnect({
    subscribeToKeys: ['auth', 'ui', 'file'],
    name: 'LayoutConnected'
});

/**
 * Simple hook-like pattern for vanilla JS components
 * Use this for components that just need to read state occasionally
 */
export function useSelector(selector) {
    return selector(appStore.getState());
}

/**
 * Simple dispatch access
 */
export function useDispatch() {
    return appStore.dispatch;
}

/**
 * Create a memoized state reader that only updates when specific selectors change
 * Useful for components that need to read state but don't need full subscriptions
 */
export function createStateReader(selectors) {
    let lastResults = {};
    let lastState = null;
    
    return function readState() {
        const currentState = appStore.getState();
        
        // Only recompute if state changed
        if (currentState === lastState) {
            return lastResults;
        }
        
        lastState = currentState;
        const newResults = {};
        
        for (const [key, selector] of Object.entries(selectors)) {
            newResults[key] = selector(currentState);
        }
        
        lastResults = newResults;
        return newResults;
    };
}

/**
 * Performance monitoring utility
 * Helps identify components that re-render too frequently
 */
export function createPerformanceMonitor(componentName) {
    let renderCount = 0;
    let lastRenderTime = Date.now();
    
    return {
        onRender() {
            renderCount++;
            const now = Date.now();
            const timeSinceLastRender = now - lastRenderTime;
            
            if (timeSinceLastRender < 16) { // Less than one frame
                console.warn(`[Redux Performance] ${componentName} rendering too frequently:`, {
                    renderCount,
                    timeSinceLastRender,
                    timestamp: now
                });
            }
            
            lastRenderTime = now;
        },
        
        getStats() {
            return {
                componentName,
                renderCount,
                lastRenderTime
            };
        }
    };
}
