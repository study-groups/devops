import { ActionTypes } from '/client/messaging/messageQueue.js';
import { appStore } from '/client/appState.js'; // Needed for persisting state within toggle

const SETTINGS_PANEL_STATE_KEY = 'devpages_settings_panel_state';

// Initial state for the settings panel
const initialState = {
    visible: false,
    position: { x: 100, y: 100 }, // Default position
    size: { width: 800, height: 600 }, // Increased default size to take advantage of new width allowance
    collapsedSections: {},
};

// --- Settings Panel Slice Reducer ---
export function settingsPanelReducer(state = initialState, action) {
    const { type, payload } = action;
    let nextState = state;
    let shouldPersist = false;

    switch(type) {
        case ActionTypes.SETTINGS_PANEL_TOGGLE:
            // Directly modify visibility
            nextState = { ...state, visible: !state.visible };
            // Persist the new state immediately
            shouldPersist = true;
            break;

        case ActionTypes.SETTINGS_PANEL_SET_POSITION:
            if (payload && typeof payload.x === 'number' && typeof payload.y === 'number') {
                // Check if position actually changed
                if (state.position?.x !== payload.x || state.position?.y !== payload.y) {
                    nextState = { ...state, position: payload };
                    shouldPersist = true;
                }
            }
            break;

        case ActionTypes.SETTINGS_PANEL_SET_SIZE:
            if (payload && typeof payload.width === 'number' && typeof payload.height === 'number') {
                 // Check if size actually changed
                 if (state.size?.width !== payload.width || state.size?.height !== payload.height) {
                    nextState = { ...state, size: payload };
                    shouldPersist = true;
                }
            }
            break;

        case ActionTypes.SETTINGS_PANEL_TOGGLE_SECTION:
            if (payload && typeof payload.sectionId === 'string') {
                const currentSections = state.collapsedSections || {};
                const sectionId = payload.sectionId;
                const isCollapsed = !currentSections[sectionId]; // Toggle the state

                nextState = {
                    ...state,
                    collapsedSections: {
                        ...currentSections,
                        [sectionId]: isCollapsed
                    }
                };
                shouldPersist = true;
            }
            break;

        case ActionTypes.SETTINGS_PANEL_SET_SECTION_STATE:
            if (payload && typeof payload.sectionId === 'string' && typeof payload.collapsed === 'boolean') {
                const currentSections = state.collapsedSections || {};
                const sectionId = payload.sectionId;
                const isCollapsed = payload.collapsed;

                // Only update if state actually changed
                if (currentSections[sectionId] !== isCollapsed) {
                    nextState = {
                        ...state,
                        collapsedSections: {
                            ...currentSections,
                            [sectionId]: isCollapsed
                        }
                    };
                    shouldPersist = true;
                }
            }
            break;

        case ActionTypes.SETTINGS_PANEL_SET_STATE:
            // Used for loading saved state initially
            if (payload && typeof payload === 'object') {
                // Merge saved state, potentially overwriting defaults
                nextState = { ...state, ...payload };
                // No need to persist here, as this action loads persisted state
            }
            break;
    }

    // Persist settings panel state if changed
    if (shouldPersist) {
        try {
            // Only persist the relevant slice, not the entire app state
            localStorage.setItem(SETTINGS_PANEL_STATE_KEY, JSON.stringify(nextState));
        } catch (e) {
            console.error('[Reducer] Failed to save settings panel state:', e);
        }
    }

    return nextState;
} 