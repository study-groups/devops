/**
 * Redux Settings Slice
 * Handles application settings and persistence
 */

// Action Types
const SETTINGS_SET = 'settings/set';
const SETTINGS_RESET = 'settings/reset';
const SETTINGS_LOAD = 'settings/load';

// Initial State
const initialState = {
    theme: 'dark',
    autoSave: true,
    showHiddenFiles: false,
    previewMode: 'split'
};

// Action Creators
export const settingsActions = {
    set: (key, value) => ({ type: SETTINGS_SET, payload: { key, value } }),
    reset: () => ({ type: SETTINGS_RESET }),
    load: (settings) => ({ type: SETTINGS_LOAD, payload: settings })
};

// Async Thunks
export const settingsThunks = {
    loadFromStorage: () => (dispatch) => {
        try {
            const stored = localStorage.getItem('devpages-settings');
            if (stored) {
                const settings = JSON.parse(stored);
                dispatch(settingsActions.load(settings));
            }
        } catch (error) {
            console.warn('Failed to load settings from localStorage:', error);
        }
    },

    saveToStorage: () => (dispatch, getState) => {
        try {
            const { settings } = getState();
            localStorage.setItem('devpages-settings', JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save settings to localStorage:', error);
        }
    }
};

// Reducer
const settingsReducer = (state = initialState, action) => {
    switch (action.type) {
        case SETTINGS_SET:
            return {
                ...state,
                [action.payload.key]: action.payload.value
            };
            
        case SETTINGS_RESET:
            return { ...initialState };
            
        case SETTINGS_LOAD:
            return {
                ...state,
                ...action.payload
            };
            
        default:
            return state;
    }
};

export default settingsReducer;