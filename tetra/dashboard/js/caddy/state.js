// Caddy Panel - Centralized State
// All panel state in one place

const CONFIG = {
    refreshInterval: 10000,
    storageKey: 'caddy-active-tab',
    logGridCols: '70px 36px 45px 90px 1fr 80px 45px'
};

// Parse URL params for initial state
const urlParams = new URLSearchParams(window.location.search);

const state = {
    // Environment
    org: urlParams.get('org') || 'tetra',
    env: urlParams.get('env') || 'local',

    // UI
    activeTab: urlParams.get('tab') || localStorage.getItem(CONFIG.storageKey) || 'overview',

    // Logs
    showRaw: urlParams.get('raw') === 'true',
    showDebug: urlParams.get('debug') === 'true',
    logFilter: urlParams.get('filter') || '',
    timeFilter: urlParams.get('time') || 'all',
    hideInternal: true,
    lastLogData: null,
    logDetailsMap: new Map(),
    selectedLogDetail: null,

    // Sorting & Aggregation
    sort: {
        column: 'time',
        direction: 'desc',
        aggregateBy: null  // null, 'ip', or 'path'
    },

    // Auto-refresh
    autoRefresh: urlParams.get('refresh') !== 'false',
    refreshIntervalId: null,

    // Follow mode
    followMode: urlParams.get('follow') === 'true',
    followIntervalId: null,

    // Stats
    groupPaths: urlParams.get('group') === 'true',
    lastStatsData: null
};

// DOM element cache (populated by init)
let els = {};

/**
 * Cache DOM elements by ID
 */
function cacheElements(ids) {
    for (const id of ids) {
        els[id] = document.getElementById(id);
    }
}

/**
 * Build API URL with org/env params
 */
function apiUrl(endpoint) {
    return `/api/caddy/${endpoint}?org=${encodeURIComponent(state.org)}&env=${encodeURIComponent(state.env)}`;
}
