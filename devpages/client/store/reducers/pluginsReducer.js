import { ActionTypes } from '/client/messaging/actionTypes.js';
import { createReducer, createPersister, loadFromStorage } from './reducerUtils.js';

const PLUGINS_STATE_KEY = 'devpages_plugins_state';

// Define the initial state for plugins. This might be populated dynamically
// during store initialization based on discovered plugins.
const initialState = {
    // Example structure - replace with actual initial plugin states if known
    // mermaid: { name: 'Mermaid', enabled: true },
    // highlight: { name: 'Highlight', enabled: true },
    // css: { name: 'CSS', enabled: true },
};

// The reducer now works with the new state structure from appState.js
// State structure: { mermaid: { name: "...", settings: { enabled: true, theme: "default" }, settingsManifest: [...] }, ... }
export function pluginsReducer(state, action) {
    const { type, payload } = action;
    let nextState = state;

    switch (type) {
        case ActionTypes.PLUGIN_UPDATE_SETTING:
            if (payload &&
                typeof payload.pluginId === 'string' &&
                state && state[payload.pluginId] && state[payload.pluginId].settings &&
                typeof payload.settingKey === 'string' &&
                Object.prototype.hasOwnProperty.call(state[payload.pluginId].settings, payload.settingKey)
            ) {
                const currentPlugin = state[payload.pluginId];
                const currentSettingValue = currentPlugin.settings[payload.settingKey];
                const newSettingValue = payload.value;

                if (currentSettingValue !== newSettingValue) {
                    nextState = {
                        ...state,
                        [payload.pluginId]: {
                            ...currentPlugin,
                            settings: {
                                ...currentPlugin.settings,
                                [payload.settingKey]: newSettingValue
                            }
                        }
                    };
                }
            } else {
                console.warn(`[Reducer PLUGIN_UPDATE_SETTING] Invalid payload, pluginId/settingKey not found, or state malformed. Payload:`, payload, `Current State Keys:`, state ? Object.keys(state) : "state is undefined");
            }
            break;

        // Handle legacy PLUGIN_TOGGLE by converting it to the new structure
        case ActionTypes.PLUGIN_TOGGLE:
            if (payload && typeof payload.pluginId === 'string' && typeof payload.enabled === 'boolean' && 
                state && state[payload.pluginId] && state[payload.pluginId].settings) {
                
                const currentEnabledValue = state[payload.pluginId].settings.enabled;
                if (currentEnabledValue !== payload.enabled) {
                    nextState = {
                        ...state,
                        [payload.pluginId]: {
                            ...state[payload.pluginId],
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

