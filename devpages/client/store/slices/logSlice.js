/**
 * Log Slice - Manages application log entries using StateKit createSlice
 * This replaces the legacy logFiltering state and provides better app log management
 */

import { createSlice } from '/packages/devpages-statekit/src/createSlice.js';

// Helper function to get initial log state from localStorage if available
function getInitialLogState() {
    // Check if there are persisted filter preferences
    let activeFilters = [];
    let searchTerm = '';
    
    try {
        const savedFilters = localStorage.getItem('devpages_log_filters');
        if (savedFilters) {
            activeFilters = JSON.parse(savedFilters);
        }
    } catch (e) {
        console.warn('[LogSlice] Error loading saved filters:', e);
    }

    try {
        const savedSearchTerm = localStorage.getItem('devpages_log_search');
        if (savedSearchTerm) {
            searchTerm = savedSearchTerm;
        }
    } catch (e) {
        console.warn('[LogSlice] Error loading saved search term:', e);
    }

    return {
        entries: [], // Array of log entries
        discoveredTypes: [], // Array of discovered log types
        activeFilters, // Array of active filter strings
        searchTerm, // Current search term
        isInitialized: false, // Whether the log system has been initialized
        lastEntryTime: null, // Timestamp of last entry for statistics
        entriesPerSecond: 0, // Calculated rate for performance monitoring
        isLoading: false, // For async operations
        error: null // Any errors in log operations
    };
}

// Persistence helpers
function persistFilters(filters) {
    try {
        localStorage.setItem('devpages_log_filters', JSON.stringify(filters));
    } catch (e) {
        console.warn('[LogSlice] Error persisting filters:', e);
    }
}

function persistSearchTerm(searchTerm) {
    try {
        localStorage.setItem('devpages_log_search', searchTerm);
    } catch (e) {
        console.warn('[LogSlice] Error persisting search term:', e);
    }
}

// Helper function to calculate discovered types
function calculateDiscoveredTypes(entries) {
    const types = new Set();
    entries.forEach(entry => {
        if (entry.type) {
            types.add(entry.type);
        }
    });
    return Array.from(types).sort();
}

// Helper function to apply filters and search
function applyFiltersAndSearch(entries, activeFilters, searchTerm) {
    let filtered = entries;

    // Apply filters
    if (activeFilters.length > 0) {
        filtered = filtered.filter(entry => {
            // Handle "Clear All" special filter
            if (activeFilters.includes('__CLEAR_ALL__')) {
                return false;
            }
            
            return activeFilters.some(filter => {
                if (filter.startsWith('level:')) {
                    const level = filter.replace('level:', '').toLowerCase();
                    return entry.level && entry.level.toLowerCase() === level;
                } else if (filter.startsWith('type:')) {
                    const type = filter.replace('type:', '').toLowerCase();
                    return entry.type && entry.type.toLowerCase() === type;
                } else if (filter.startsWith('source:')) {
                    const source = filter.replace('source:', '').toLowerCase();
                    return entry.source && entry.source.toLowerCase() === source;
                } else {
                    // Default: match against type
                    return entry.type && entry.type.toLowerCase().includes(filter.toLowerCase());
                }
            });
        });
    }

    // Apply search
    if (searchTerm && searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter(entry => {
            return (
                (entry.message && entry.message.toLowerCase().includes(searchLower)) ||
                (entry.type && entry.type.toLowerCase().includes(searchLower)) ||
                (entry.source && entry.source.toLowerCase().includes(searchLower)) ||
                (entry.component && entry.component.toLowerCase().includes(searchLower)) ||
                (entry.action && entry.action.toLowerCase().includes(searchLower)) ||
                (entry.caller && entry.caller.toLowerCase().includes(searchLower))
            );
        });
    }

    return filtered;
}

// Create the log slice
export const logSlice = createSlice({
    name: 'log',
    initialState: getInitialLogState(),
    reducers: {
        // Basic entry management
        addEntry: (state, action) => {
            const entry = {
                id: Date.now() + Math.random(),
                timestamp: Date.now(),
                formattedTime: new Date().toLocaleTimeString(),
                level: 'INFO',
                source: 'APP',
                type: 'GENERAL',
                ...action.payload
            };

            state.entries.push(entry);
            state.lastEntryTime = entry.timestamp;
            state.isInitialized = true;

            // Recalculate discovered types
            state.discoveredTypes = calculateDiscoveredTypes(state.entries);

            // Limit entries to prevent memory issues (keep last 1000)
            if (state.entries.length > 1000) {
                state.entries = state.entries.slice(-1000);
            }

            return state;
        },

        addMultipleEntries: (state, action) => {
            const entries = Array.isArray(action.payload) ? action.payload : [];
            const now = Date.now();
            
            const newEntries = entries.map((entry, index) => ({
                id: now + index + Math.random(),
                timestamp: now + index,
                formattedTime: new Date(now + index).toLocaleTimeString(),
                level: 'INFO',
                source: 'APP',
                type: 'GENERAL',
                ...entry
            }));

            state.entries.push(...newEntries);
            state.lastEntryTime = now + entries.length - 1;
            state.isInitialized = true;

            // Recalculate discovered types
            state.discoveredTypes = calculateDiscoveredTypes(state.entries);

            // Limit entries
            if (state.entries.length > 1000) {
                state.entries = state.entries.slice(-1000);
            }

            return state;
        },

        clearEntries: (state) => {
            state.entries = [];
            state.discoveredTypes = [];
            state.lastEntryTime = null;
            state.entriesPerSecond = 0;
            state.error = null;
            return state;
        },

        // Filter management
        setActiveFilters: (state, action) => {
            if (Array.isArray(action.payload)) {
                state.activeFilters = action.payload;
                persistFilters(state.activeFilters);
            }
            return state;
        },

        toggleFilter: (state, action) => {
            if (typeof action.payload === 'string') {
                const filterKey = action.payload;
                
                // Handle special case for Clear All mode
                if (state.activeFilters.includes('__CLEAR_ALL__')) {
                    // Exit Clear All mode and activate only this filter
                    state.activeFilters = [filterKey];
                } else {
                    // Normal toggle behavior
                    if (state.activeFilters.includes(filterKey)) {
                        state.activeFilters = state.activeFilters.filter(f => f !== filterKey);
                    } else {
                        state.activeFilters.push(filterKey);
                    }
                }
                
                persistFilters(state.activeFilters);
            }
            return state;
        },

        // Search management
        setSearchTerm: (state, action) => {
            state.searchTerm = action.payload || '';
            persistSearchTerm(state.searchTerm);
            return state;
        },

        // Type management
        initializeTypes: (state, action) => {
            if (Array.isArray(action.payload)) {
                const newTypes = action.payload;
                const currentTypes = state.discoveredTypes || [];
                
                // Only update if different
                if (JSON.stringify(newTypes.sort()) !== JSON.stringify(currentTypes.sort())) {
                    state.discoveredTypes = newTypes;
                    state.isInitialized = true;
                }
            }
            return state;
        },

        // Async operation states
        setLoading: (state, action) => {
            state.isLoading = !!action.payload;
            return state;
        },

        setError: (state, action) => {
            state.error = action.payload;
            state.isLoading = false;
            return state;
        },

        clearError: (state) => {
            state.error = null;
            return state;
        },

        // Performance monitoring
        updateEntriesPerSecond: (state) => {
            if (state.entries.length < 2) {
                state.entriesPerSecond = 0;
                return state;
            }

            const now = Date.now();
            const recentEntries = state.entries.filter(entry => 
                now - entry.timestamp < 1000 // Last second
            );
            
            state.entriesPerSecond = recentEntries.length;
            return state;
        },

        // Reset to initial state
        resetLog: (state) => {
            const freshState = getInitialLogState();
            try {
                localStorage.removeItem('devpages_log_filters');
                localStorage.removeItem('devpages_log_search');
            } catch (e) {
                console.warn('[LogSlice] Error clearing log state on reset:', e);
            }
            return freshState;
        }
    }
});

// Export actions
export const {
    addEntry,
    addMultipleEntries,
    clearEntries,
    setActiveFilters,
    toggleFilter,
    setSearchTerm,
    initializeTypes,
    setLoading,
    setError,
    clearError,
    updateEntriesPerSecond,
    resetLog
} = logSlice.actions;

export const logReducer = logSlice.reducer;

// Thunk Actions for async operations
export const logThunks = {
    // Async bulk logging with progress
    addBulkEntries: (entries, options = {}) => async (dispatch, getState) => {
        const { 
            batchSize = 50, 
            delay = 10,
            onProgress = null 
        } = options;

        dispatch(setLoading(true));
        dispatch(clearError());

        try {
            const totalEntries = entries.length;
            let processed = 0;

            // Process in batches to avoid blocking the UI
            for (let i = 0; i < totalEntries; i += batchSize) {
                const batch = entries.slice(i, i + batchSize);
                
                dispatch(addMultipleEntries(batch));
                processed += batch.length;

                if (onProgress) {
                    onProgress(processed, totalEntries);
                }

                // Small delay to allow UI updates
                if (delay > 0 && i + batchSize < totalEntries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            dispatch(setLoading(false));
            return { success: true, processed };
        } catch (error) {
            dispatch(setError(error.message));
            return { success: false, error: error.message };
        }
    },

    // Async log export
    exportLogs: (format = 'json') => async (dispatch, getState) => {
        dispatch(setLoading(true));
        dispatch(clearError());

        try {
            const state = getState();
            const entries = selectLogEntries(state);
            const stats = selectLogStats(state);

            const exportData = {
                metadata: {
                    exportTime: new Date().toISOString(),
                    format,
                    totalEntries: entries.length,
                    ...stats
                },
                entries
            };

            let content, mimeType, extension;

            switch (format) {
                case 'csv':
                    content = convertToCSV(entries);
                    mimeType = 'text/csv';
                    extension = 'csv';
                    break;
                case 'txt':
                    content = convertToText(entries);
                    mimeType = 'text/plain';
                    extension = 'txt';
                    break;
                default:
                    content = JSON.stringify(exportData, null, 2);
                    mimeType = 'application/json';
                    extension = 'json';
            }

            // Create download
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `app-logs-${Date.now()}.${extension}`;
            a.click();
            URL.revokeObjectURL(url);

            dispatch(setLoading(false));
            return { success: true, entries: entries.length };
        } catch (error) {
            dispatch(setError(error.message));
            return { success: false, error: error.message };
        }
    },

    // Async log import
    importLogs: (file) => async (dispatch, getState) => {
        dispatch(setLoading(true));
        dispatch(clearError());

        try {
            const text = await file.text();
            let importData;

            if (file.name.endsWith('.json')) {
                importData = JSON.parse(text);
                if (importData.entries && Array.isArray(importData.entries)) {
                    await dispatch(logThunks.addBulkEntries(importData.entries));
                } else {
                    throw new Error('Invalid JSON format: missing entries array');
                }
            } else {
                throw new Error('Unsupported file format. Please use JSON.');
            }

            dispatch(setLoading(false));
            return { success: true, imported: importData.entries.length };
        } catch (error) {
            dispatch(setError(error.message));
            return { success: false, error: error.message };
        }
    },

    // Async performance monitoring
    startPerformanceMonitoring: (interval = 1000) => (dispatch, getState) => {
        const monitoringId = setInterval(() => {
            dispatch(updateEntriesPerSecond());
        }, interval);

        // Return cleanup function
        return () => clearInterval(monitoringId);
    }
};

// Helper functions for export
function convertToCSV(entries) {
    const headers = ['timestamp', 'level', 'source', 'type', 'message', 'component', 'action', 'caller'];
    const csvRows = [headers.join(',')];
    
    entries.forEach(entry => {
        const row = headers.map(header => {
            const value = entry[header] || '';
            // Escape commas and quotes
            return `"${String(value).replace(/"/g, '""')}"`;
        });
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

function convertToText(entries) {
    return entries.map(entry => {
        const timestamp = entry.formattedTime || new Date(entry.timestamp).toLocaleTimeString();
        const component = entry.component ? `-${entry.component}` : '';
        const action = entry.action ? `[${entry.action}]` : '';
        return `[${timestamp}] [${entry.level}] [${entry.source}${component}] [${entry.type}] ${action} ${entry.message}`;
    }).join('\n');
}

// Selectors for easy state access
export const selectLogEntries = (state) => state.log?.entries || [];
export const selectDiscoveredTypes = (state) => state.log?.discoveredTypes || [];
export const selectActiveFilters = (state) => state.log?.activeFilters || [];
export const selectSearchTerm = (state) => state.log?.searchTerm || '';
export const selectIsLogInitialized = (state) => state.log?.isInitialized || false;
export const selectLogError = (state) => state.log?.error || null;
export const selectIsLogLoading = (state) => state.log?.isLoading || false;

// Computed selectors
export const selectFilteredEntries = (state) => {
    const entries = selectLogEntries(state);
    const activeFilters = selectActiveFilters(state);
    const searchTerm = selectSearchTerm(state);
    
    return applyFiltersAndSearch(entries, activeFilters, searchTerm);
};

export const selectLogStats = (state) => {
    const log = state.log || {};
    const entries = selectLogEntries(state);
    const filteredEntries = selectFilteredEntries(state);
    const discoveredTypes = selectDiscoveredTypes(state);
    
    return {
        totalEntries: entries.length,
        filteredEntries: filteredEntries.length,
        discoveredTypes: discoveredTypes.length,
        entriesPerSecond: log.entriesPerSecond || 0,
        lastEntryTime: log.lastEntryTime,
        isInitialized: log.isInitialized || false,
        hasActiveFilters: (log.activeFilters || []).length > 0,
        hasSearchTerm: !!(log.searchTerm || '').trim()
    };
};

export const selectLogMetrics = (state) => {
    const entries = selectLogEntries(state);
    const now = Date.now();
    
    const last5Minutes = entries.filter(e => now - e.timestamp < 5 * 60 * 1000);
    const last1Hour = entries.filter(e => now - e.timestamp < 60 * 60 * 1000);
    
    const levelCounts = entries.reduce((acc, entry) => {
        acc[entry.level] = (acc[entry.level] || 0) + 1;
        return acc;
    }, {});
    
    const typeCounts = entries.reduce((acc, entry) => {
        acc[entry.type] = (acc[entry.type] || 0) + 1;
        return acc;
    }, {});
    
    return {
        recent: {
            last5Minutes: last5Minutes.length,
            last1Hour: last1Hour.length
        },
        levels: levelCounts,
        types: typeCounts,
        averageEntriesPerMinute: last1Hour.length / 60
    };
};

console.log('[LogSlice] Log slice created with StateKit createSlice and thunk actions'); 