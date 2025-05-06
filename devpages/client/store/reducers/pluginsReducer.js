import { ActionTypes } from '/client/messaging/messageQueue.js';

const PLUGINS_STATE_KEY = 'pluginsEnabledState';

// Define the initial state for plugins. This might be populated dynamically
// during store initialization based on discovered plugins.
const initialState = {
    // Example structure - replace with actual initial plugin states if known
    // mermaid: { name: 'Mermaid', enabled: true },
    // highlight: { name: 'Highlight', enabled: true },
    // css: { name: 'CSS', enabled: true },
};

// --- Plugins Slice Reducer ---
// Assumes state structure like { mermaid: { name: 'Mermaid', enabled: true }, ... }
export function pluginsReducer(state = initialState, action) {
    const { type, payload } = action;
    let nextState = state;

    switch (type) {
        case ActionTypes.PLUGIN_TOGGLE:
            if (payload && typeof payload.pluginId === 'string' && typeof payload.enabled === 'boolean' && state[payload.pluginId]) {
                // Check if the enabled state is actually changing
                if (state[payload.pluginId].enabled !== payload.enabled) {
                    const updatedPluginState = {
                        ...state[payload.pluginId], // Keep existing properties like 'name'
                        enabled: payload.enabled // Update enabled status based on payload
                    };
                    nextState = {
                        ...state,
                        [payload.pluginId]: updatedPluginState
                    };
                    console.debug(`[Reducer PLUGINS_TOGGLE] Updated '${payload.pluginId}' enabled state to: ${payload.enabled}`);

                    // --- Persist only the enabled status ---
                    try {
                        // Create an object containing only { pluginId: enabledStatus } for all plugins
                        const enabledStateToSave = {};
                        for (const pluginId in nextState) {
                            // Ensure the plugin exists in the new state before accessing it
                            if (nextState[pluginId] && typeof nextState[pluginId].enabled === 'boolean') {
                                enabledStateToSave[pluginId] = nextState[pluginId].enabled;
                            }
                        }
                        localStorage.setItem(PLUGINS_STATE_KEY, JSON.stringify(enabledStateToSave));
                        console.debug(`[Reducer PLUGINS_TOGGLE] Saved plugin enabled states to localStorage.`);
                    } catch (e) {
                        console.error('[Reducer] Failed to save plugin enabled state to localStorage:', e);
                    }
                } else {
                    console.debug(`[Reducer PLUGINS_TOGGLE] No change in enabled state for '${payload.pluginId}'. Skipping update.`);
                }
            } else {
                console.warn(`[Reducer PLUGINS_TOGGLE] Invalid payload or pluginId not found in state. Payload:`, payload, `Current State Keys:`, Object.keys(state));
            }
            break;

        // Add cases here later for SET_PLUGIN_STATE, LOAD_PLUGINS_COMPLETE etc.
        // Example: Populating the initial state after discovery
        case ActionTypes.PLUGINS_SET_INITIAL_STATE: // Define this ActionType if needed
             if (payload && typeof payload === 'object') {
                 nextState = payload; // Replace the entire slice state
                 // Optionally persist the initial enabled state here too
             }
             break;
             
        // Reset all plugins to defaults (enabled)
        case ActionTypes.PLUGIN_RESET:
            // Create a new state with all plugins enabled
            nextState = {};
            for (const pluginId in state) {
                nextState[pluginId] = {
                    ...state[pluginId],
                    enabled: true // Force enabled
                };
            }
            console.log(`[Reducer PLUGIN_RESET] All plugins reset to enabled state`);
            
            // Clear localStorage to revert to defaults on next load
            try {
                localStorage.removeItem(PLUGINS_STATE_KEY);
                console.log(`[Reducer PLUGIN_RESET] Cleared plugin settings from localStorage`);
            } catch (e) {
                console.error('[Reducer] Failed to clear plugin settings from localStorage:', e);
            }
            break;
    }
    return nextState;
}
