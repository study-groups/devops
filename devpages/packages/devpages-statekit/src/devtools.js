/**
 * DevTools middleware for StateKit
 * Provides Redux DevTools-like functionality including:
 * - Action history tracking
 * - Time travel debugging
 * - State inspection
 * - Action replay
 * - Performance monitoring
 */

// Maximum number of actions to keep in history
const MAX_HISTORY_LENGTH = 100;

/**
 * Creates a DevTools middleware
 * @param {object} options - DevTools options
 * @returns {Function} DevTools middleware
 */
export function createDevTools(options = {}) {
    const {
        name = 'StateKit DevTools',
        maxAge = MAX_HISTORY_LENGTH,
        shouldIncludeAction = () => true,
        shouldIncludeState = () => true,
        shouldIncludeError = () => true,
        serialize = {
            immutable: false,
            replacer: null,
            reviver: null
        }
    } = options;

    // Action history
    let actionHistory = [];
    let currentStateIndex = -1;
    let isTimeTraveling = false;
    let originalDispatch = null;
    let originalGetState = null;

    // Performance monitoring
    let performanceMetrics = {
        totalActions: 0,
        totalTime: 0,
        averageTime: 0,
        slowestAction: null,
        fastestAction: null
    };

    // Create the DevTools instance
    const devTools = {
        // Public API
        getActionHistory: () => [...actionHistory],
        getCurrentStateIndex: () => currentStateIndex,
        getPerformanceMetrics: () => ({ ...performanceMetrics }),
        timeTravel: (index) => {
            if (index >= 0 && index < actionHistory.length) {
                isTimeTraveling = true;
                currentStateIndex = index;
                const targetState = actionHistory[index].state;
                
                // Temporarily replace getState to return the target state
                const originalGetStateRef = originalGetState;
                originalGetState = () => targetState;
                
                // Notify listeners of time travel
                devTools.emit('timeTravel', { index, state: targetState });
                
                // Restore getState after a brief delay
                setTimeout(() => {
                    originalGetState = originalGetStateRef;
                    isTimeTraveling = false;
                }, 100);
            }
        },
        replayAction: (actionIndex) => {
            if (actionIndex >= 0 && actionIndex < actionHistory.length) {
                const action = actionHistory[actionIndex].action;
                originalDispatch(action);
            }
        },
        clearHistory: () => {
            actionHistory = [];
            currentStateIndex = -1;
            performanceMetrics = {
                totalActions: 0,
                totalTime: 0,
                averageTime: 0,
                slowestAction: null,
                fastestAction: null
            };
            devTools.emit('historyCleared');
        },
        
        // Event system
        listeners: new Set(),
        emit: (event, data) => {
            devTools.listeners.forEach(listener => {
                try {
                    listener(event, data);
                } catch (error) {
                    console.error('[DevTools] Listener error:', error);
                }
            });
        },
        subscribe: (listener) => {
            devTools.listeners.add(listener);
            return () => devTools.listeners.delete(listener);
        }
    };

    // Expose DevTools on window for browser console access
    if (typeof window !== 'undefined') {
        window.__STATEKIT_DEVTOOLS__ = devTools;
    }

    return ({ getState, dispatch }) => {
        // Store original functions
        originalDispatch = dispatch;
        originalGetState = getState;

        return next => action => {
            const startTime = Date.now();
            const prevState = getState();
            
            // Call the next middleware/reducer
            const result = next(action);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            const nextState = getState();

            // Update performance metrics
            performanceMetrics.totalActions++;
            performanceMetrics.totalTime += duration;
            performanceMetrics.averageTime = performanceMetrics.totalTime / performanceMetrics.totalActions;

            if (!performanceMetrics.slowestAction || duration > performanceMetrics.slowestAction.duration) {
                performanceMetrics.slowestAction = { action: action.type, duration };
            }

            if (!performanceMetrics.fastestAction || duration < performanceMetrics.fastestAction.duration) {
                performanceMetrics.fastestAction = { action: action.type, duration };
            }

            // Add to action history
            const historyEntry = {
                timestamp: startTime,
                action: action,
                state: nextState,
                prevState: prevState,
                duration: duration,
                error: null
            };

            actionHistory.push(historyEntry);
            currentStateIndex = actionHistory.length - 1;

            // Limit history size
            if (actionHistory.length > maxAge) {
                actionHistory.shift();
                currentStateIndex--;
            }

            // Emit events
            devTools.emit('actionDispatched', {
                action: action,
                state: nextState,
                prevState: prevState,
                duration: duration,
                index: currentStateIndex
            });

            return result;
        };
    };
}

/**
 * Creates a DevTools panel for browser console
 * @param {object} devTools - DevTools instance
 * @returns {object} Console panel API
 */
export function createConsolePanel(devTools) {
    const panel = {
        showHistory: () => {
            console.group('📋 StateKit Action History');
            devTools.getActionHistory().forEach((entry, index) => {
                console.group(`#${index + 1} ${entry.action.type} (${entry.duration}ms)`);
                console.log('Action:', entry.action);
                console.log('State:', entry.state);
                console.log('Prev State:', entry.prevState);
                console.groupEnd();
            });
            console.groupEnd();
        },
        
        showPerformance: () => {
            const metrics = devTools.getPerformanceMetrics();
            console.group('⚡ StateKit Performance Metrics');
            console.log('Total Actions:', metrics.totalActions);
            console.log('Average Time:', metrics.averageTime.toFixed(2) + 'ms');
            console.log('Slowest Action:', metrics.slowestAction);
            console.log('Fastest Action:', metrics.fastestAction);
            console.groupEnd();
        },
        
        timeTravel: (index) => {
            console.log(`🕒 Time traveling to action #${index + 1}`);
            devTools.timeTravel(index);
        },
        
        replayAction: (index) => {
            console.log(`🔄 Replaying action #${index + 1}`);
            devTools.replayAction(index);
        },
        
        clearHistory: () => {
            console.log('🗑️ Clearing action history');
            devTools.clearHistory();
        }
    };

    // Expose to window for easy access
    if (typeof window !== 'undefined') {
        window.__STATEKIT_PANEL__ = panel;
    }

    return panel;
}

/**
 * Creates a simple DevTools UI component
 * @param {object} devTools - DevTools instance
 * @param {HTMLElement} container - Container element
 * @returns {object} UI component
 */
export function createDevToolsUI(devTools, container) {
    const ui = {
        container,
        devTools,
        isVisible: false,
        
        render: () => {
            if (!container) return;
            
            const history = devTools.getActionHistory();
            const metrics = devTools.getPerformanceMetrics();
            
            container.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 400px;
                    max-height: 600px;
                    background: #1e1e1e;
                    color: #fff;
                    border: 1px solid #333;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 10000;
                    overflow: hidden;
                ">
                    <div style="
                        background: #2d2d2d;
                        padding: 10px;
                        border-bottom: 1px solid #333;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <strong>StateKit DevTools</strong>
                        <button onclick="window.__DEVTOOLS_UI__.toggle()" style="
                            background: #555;
                            border: none;
                            color: #fff;
                            padding: 4px 8px;
                            border-radius: 4px;
                            cursor: pointer;
                        ">${ui.isVisible ? 'Hide' : 'Show'}</button>
                    </div>
                    
                    <div style="
                        padding: 10px;
                        max-height: 400px;
                        overflow-y: auto;
                    ">
                        <div style="margin-bottom: 10px;">
                            <strong>Performance:</strong><br>
                            Actions: ${metrics.totalActions} | 
                            Avg: ${metrics.averageTime.toFixed(2)}ms
                        </div>
                        
                        <div style="margin-bottom: 10px;">
                            <strong>Recent Actions:</strong>
                        </div>
                        
                        ${history.slice(-10).map((entry, index) => `
                            <div style="
                                padding: 5px;
                                margin: 2px 0;
                                background: ${index === devTools.getCurrentStateIndex() ? '#444' : '#333'};
                                border-radius: 4px;
                                cursor: pointer;
                            " onclick="window.__DEVTOOLS_UI__.selectAction(${history.length - 10 + index})">
                                ${entry.action.type} (${entry.duration}ms)
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        },
        
        toggle: () => {
            ui.isVisible = !ui.isVisible;
            container.style.display = ui.isVisible ? 'block' : 'none';
            ui.render();
        },
        
        selectAction: (index) => {
            devTools.timeTravel(index);
            ui.render();
        }
    };

    // Expose to window for button access
    if (typeof window !== 'undefined') {
        window.__DEVTOOLS_UI__ = ui;
    }

    return ui;
} 