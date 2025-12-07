/**
 * @file logSlice.js
 * @description Log state management slice - MODERNIZED
 * ✅ MODERNIZED: Converted from legacy manual pattern to RTK createSlice
 */

import { createSlice } from '@reduxjs/toolkit';
import { storageService } from '/client/services/storageService.js';

// Load persisted state from localStorage
const persistedState = storageService.getItem('log') || {};

const initialState = {
    entries: [],
    discoveredTypes: [],
    activeFilters: persistedState.activeFilters || [],
    searchTerm: persistedState.searchTerm || '',
    isInitialized: false,
};

// ✅ MODERNIZED: RTK createSlice pattern
const logSlice = createSlice({
    name: 'log',
    initialState,
    reducers: {
        addEntry: (state, action) => {
            const newEntry = { ...action.payload, id: Date.now() + Math.random() };
            
            // Serialize Error objects to prevent Redux non-serializable warnings
            if (newEntry.details && newEntry.details instanceof Error) {
                newEntry.details = {
                    name: newEntry.details.name,
                    message: newEntry.details.message,
                    stack: newEntry.details.stack,
                    isError: true
                };
            }
            
            state.entries.push(newEntry);
            // Keep only last 1000 entries for performance
            if (state.entries.length > 1000) {
                state.entries = state.entries.slice(-1000);
            }
            // Update discovered types
            const newTypes = Array.from(new Set(state.entries.map(e => e.type)));
            state.discoveredTypes = newTypes;
            state.isInitialized = true;
        },
        clearEntries: (state) => {
            state.entries = [];
            state.discoveredTypes = [];
        },
        setActiveFilters: (state, action) => {
            state.activeFilters = action.payload;
        },
        toggleFilter: (state, action) => {
            const filterKey = action.payload;
            const currentFilters = state.activeFilters;
            if (currentFilters.includes(filterKey)) {
                state.activeFilters = currentFilters.filter(f => f !== filterKey);
            } else {
                state.activeFilters = [...currentFilters, filterKey];
            }
        },
        setSearchTerm: (state, action) => {
            state.searchTerm = action.payload;
        }
    }
});

// ✅ MODERNIZED: Export RTK slice actions and reducer
export const { addEntry, clearEntries, setActiveFilters, toggleFilter, setSearchTerm } = logSlice.actions;
export const logReducer = logSlice.reducer;
export default logReducer;

// Legacy exports for backward compatibility
export const clearLogs = clearEntries;
export const logActions = logSlice.actions;

// ✅ MODERNIZED: Selectors for computed state
export const selectFilteredEntries = (state) => {
    const logState = state.log || {};
    const { entries = [], activeFilters = [], searchTerm = '' } = logState;
    
    let filteredEntries = entries;
    
    // Apply type filters
    if (activeFilters.length > 0) {
        filteredEntries = filteredEntries.filter(entry => 
            activeFilters.includes(entry.type)
        );
    }
    
    // Apply search term
    if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        filteredEntries = filteredEntries.filter(entry => {
            const message = (entry.message || '').toLowerCase();
            const details = (entry.details || '').toLowerCase();
            const type = (entry.type || '').toLowerCase();
            return message.includes(searchLower) || 
                   details.includes(searchLower) || 
                   type.includes(searchLower);
        });
    }
    
    return filteredEntries;
};

// ✅ MODERNIZED: Thunks for async operations and complex logic
export const logThunks = {
    addEntry: (entry) => (dispatch) => {
        dispatch(addEntry(entry));
    },
    addBulkEntries: (entries, options = {}) => (dispatch) => {
        entries.forEach(entry => {
            dispatch(addEntry(entry));
        });
    },
    clearLog: () => (dispatch) => {
        dispatch(clearEntries());
    }
};