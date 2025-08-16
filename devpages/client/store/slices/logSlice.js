/**
 * Log Slice - Manages application log entries for Redux
 */

// --- Action Types ---
const ADD_ENTRY = 'log/addEntry';
const CLEAR_ENTRIES = 'log/clearEntries';
const SET_ACTIVE_FILTERS = 'log/setActiveFilters';
const TOGGLE_FILTER = 'log/toggleFilter';
const SET_SEARCH_TERM = 'log/setSearchTerm';

// --- Initial State ---
const initialState = {
    entries: [],
    discoveredTypes: [],
    activeFilters: [],
    searchTerm: '',
    isInitialized: false,
};

// --- Reducer ---
export function logReducer(state = initialState, action) {
    switch (action.type) {
        case ADD_ENTRY:
            const newEntry = { ...action.payload, id: Date.now() + Math.random() };
            const newEntries = [...state.entries, newEntry].slice(-1000);
            const newDiscoveredTypes = Array.from(new Set(newEntries.map(e => e.type)));
            return { ...state, entries: newEntries, discoveredTypes: newDiscoveredTypes, isInitialized: true };
        case CLEAR_ENTRIES:
            return { ...state, entries: [], discoveredTypes: [] };
        case SET_ACTIVE_FILTERS:
            return { ...state, activeFilters: action.payload };
        case TOGGLE_FILTER:
            const filterKey = action.payload;
            const currentFilters = state.activeFilters;
            const newFilters = currentFilters.includes(filterKey)
                ? currentFilters.filter(f => f !== filterKey)
                : [...currentFilters, filterKey];
            return { ...state, activeFilters: newFilters };
        case SET_SEARCH_TERM:
            return { ...state, searchTerm: action.payload };
        default:
            return state;
    }
}

// --- Action Creators ---
export const addEntry = (payload) => ({ type: ADD_ENTRY, payload });
export const clearEntries = () => ({ type: CLEAR_ENTRIES });
export const setActiveFilters = (payload) => ({ type: SET_ACTIVE_FILTERS, payload });
export const toggleFilter = (payload) => ({ type: TOGGLE_FILTER, payload });
export const setSearchTerm = (payload) => ({ type: SET_SEARCH_TERM, payload });

// --- Thunks ---
export const logThunks = {
    addEntry: (entry) => (dispatch) => {
        dispatch(addEntry(entry));
    },
    clearLog: () => (dispatch) => {
        dispatch(clearEntries());
    }
};

// --- Selectors ---
export const selectLogEntries = (state) => state.log.entries;
export const selectActiveFilters = (state) => state.log.activeFilters;
export const selectSearchTerm = (state) => state.log.searchTerm;
export const selectDiscoveredTypes = (state) => state.log.discoveredTypes;
export const selectFilteredEntries = (state) => {
    const { entries, activeFilters, searchTerm } = state.log;
    // Filtering logic here...
    return entries;
};
export const selectLogStats = (state) => {
    const { entries } = state.log;
    return {
        totalEntries: entries.length,
    };
};


console.log('[logSlice] Migrated to standard Redux pattern.'); 