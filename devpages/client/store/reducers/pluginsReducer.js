import { ActionTypes } from '/client/messaging/actionTypes.js';
import { createReducer, createPersister, loadFromStorage } from './reducerUtils.js';

const PLUGINS_STATE_KEY = 'devpages_plugins_state';

// Define the initial state for plugins. This might be populated dynamically
// during store initialization based on discovered plugins.
const initialState = {
    mermaid: { name: 'Mermaid', enabled: true },
    highlight: { name: 'Highlight', enabled: true },
    katex: { name: 'KaTeX', enabled: true },
    graphviz: { name: 'Graphviz', enabled: true },
};

// The reducer now works with the new state structure from appState.js
// State structure: { mermaid: { name: "...", enabled: true, settings: { theme: "default" }, settingsManifest: [...] }, ... }
export function pluginsReducer(state = initialState, action) {
    const { type, payload } = action;
    let nextState = state;

    switch (type) {
        case ActionTypes.PLUGIN_UPDATE_SETTING:
            // Silently ignore array payloads (likely CSS file updates dispatched to wrong reducer)
            if (Array.isArray(payload)) {
                break;
            }
            
            if (payload &&
                typeof payload.pluginId === 'string' &&
                state[payload.pluginId] &&
                typeof payload.settingKey === 'string'
            ) {
                // This part needs careful review - assuming settings are at a peer level to 'enabled'
                const currentPlugin = state[payload.pluginId];
                
                // Construct the new plugin state, updating the specific setting
                const newPluginState = {
                    ...currentPlugin,
                    settings: {
                        ...currentPlugin.settings,
                        [payload.settingKey]: payload.value
                    }
                };
                
                // If the setting being changed IS 'enabled', update the top-level flag too
                if (payload.settingKey === 'enabled') {
                    newPluginState.enabled = payload.value;
                }

                // Create the new top-level state
                nextState = {
                    ...state,
                    [payload.pluginId]: newPluginState
                };

            } else {
                console.warn(`[Reducer PLUGIN_UPDATE_SETTING] Invalid payload, pluginId/settingKey not found, or state malformed. Payload:`, payload, `Current State Keys:`, state ? Object.keys(state) : "state is undefined");
            }
            break;

        // Handle legacy PLUGIN_TOGGLE by converting it to the new structure
        case ActionTypes.PLUGIN_TOGGLE:
            if (payload && typeof payload.pluginId === 'string' && typeof payload.enabled === 'boolean' &&
                state[payload.pluginId]) {

                const currentEnabledValue = state[payload.pluginId].enabled;
                if (currentEnabledValue !== payload.enabled) {
                    nextState = {
                        ...state,
                        [payload.pluginId]: {
                            ...state[payload.pluginId],
                            enabled: payload.enabled, // Update top-level enabled
                            // Also update settings.enabled for consistency if it exists
                            settings: {
                                ...state[payload.pluginId].settings,
                                enabled: payload.enabled
                            }
                        }
                    };
                    console.debug(`[Reducer PLUGIN_TOGGLE] Updated '${payload.pluginId}' enabled state to: ${payload.enabled}`);
                } else {
                    console.debug(`[Reducer PLUGIN_TOGGLE] No change in enabled state for '${payload.pluginId}'. Skipping update.`);
                }
            } else {
                console.warn(`[Reducer PLUGIN_TOGGLE] Invalid payload or pluginId not found in state. Payload:`, payload, `Current State Keys:`, state ? Object.keys(state) : "state is undefined");
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

