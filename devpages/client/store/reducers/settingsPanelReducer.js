import { ActionTypes } from '/client/messaging/actionTypes.js';
import { appStore } from '/client/appState.js'; // Needed for persisting state within toggle
import { createReducer } from './reducerUtils.js';

const SETTINGS_PANEL_STATE_KEY = 'devpages_settings_panel_state';

// Initial state for the settings panel
const initialState = {
    visible: false,
    position: { x: 100, y: 100 }, // Default position
    size: { width: 800, height: 600 }, // Increased default size to take advantage of new width allowance
    collapsedSections: {},
    // Add support for hierarchical section storage
    collapsedSubsections: {}
};

// --- Settings Panel Slice Reducer ---
export function settingsPanelReducer(state = initialState, action) {
    const { type, payload } = action;
    let nextState = state;
    let shouldPersist = false;

    switch(type) {
        case ActionTypes.SETTINGS_PANEL_TOGGLE:
            // Use payload.enabled if provided, otherwise toggle current state
            const newVisibility = payload && typeof payload.enabled === 'boolean' 
                ? payload.enabled 
                : !state.visible;
            nextState = { ...state, visible: newVisibility };
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
                const sectionId = payload.sectionId;
                
                // Check if this is a subsection (contains a separator like '/' or ':')
                if (sectionId.includes('/') || sectionId.includes(':')) {
                    // Handle as a subsection
                    const currentSubsections = state.collapsedSubsections || {};
                    const isCollapsed = !currentSubsections[sectionId]; // Toggle the state
                    
                    nextState = {
                        ...state,
                        collapsedSubsections: {
                            ...currentSubsections,
                            [sectionId]: isCollapsed
                        }
                    };
                } else {
                    // Handle as a top-level section
                    const currentSections = state.collapsedSections || {};
                    const isCollapsed = !currentSections[sectionId]; // Toggle the state
                    
                    nextState = {
                        ...state,
                        collapsedSections: {
                            ...currentSections,
                            [sectionId]: isCollapsed
                        }
                    };
                }
                shouldPersist = true;
            }
            break;

        case ActionTypes.SETTINGS_PANEL_SET_SECTION_STATE:
            if (payload && typeof payload.sectionId === 'string' && typeof payload.collapsed === 'boolean') {
                const sectionId = payload.sectionId;
                const isCollapsed = payload.collapsed;
                
                // Check if this is a subsection
                if (sectionId.includes('/') || sectionId.includes(':')) {
                    // Handle as a subsection
                    const currentSubsections = state.collapsedSubsections || {};
                    
                    // Only update if state actually changed
                    if (currentSubsections[sectionId] !== isCollapsed) {
                        nextState = {
                            ...state,
                            collapsedSubsections: {
                                ...currentSubsections,
                                [sectionId]: isCollapsed
                            }
                        };
                        shouldPersist = true;
                    }
                } else {
                    // Handle as a top-level section
                    const currentSections = state.collapsedSections || {};
                    
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

        case ActionTypes.SETTINGS_OPEN_PANEL:
            // Open the settings panel and optionally navigate to a specific section
            const currentSections = state.collapsedSections || {};
            let updatedSections = { ...currentSections };
            
            // If a specific panel ID is provided, expand that section
            if (payload && typeof payload === 'string') {
                updatedSections[payload] = false; // false means expanded
            }
            
            nextState = { 
                ...state, 
                visible: true,
                collapsedSections: updatedSections
            };
            shouldPersist = true;
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