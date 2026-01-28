// Caddy Panel - Helpers & Utilities

const CONFIG = {
    refreshInterval: 10000,
    storageKey: 'caddy-active-tab'
};

// Parse all URL params generically (for standalone usage)
const urlParams = new URLSearchParams(window.location.search);

const state = {
    org: urlParams.get('org') || 'tetra',
    env: urlParams.get('env') || 'local',
    activeTab: urlParams.get('tab') || localStorage.getItem(CONFIG.storageKey) || 'overview',
    showRaw: urlParams.get('raw') === 'true' || false,
    showDebug: urlParams.get('debug') === 'true' || false,
    logFilter: urlParams.get('filter') || '',
    timeFilter: urlParams.get('time') || 'all',
    lastLogData: null,
    autoRefresh: urlParams.get('refresh') !== 'false',
    refreshIntervalId: null,
    followMode: urlParams.get('follow') === 'true' || false,
    followIntervalId: null,
    logDetailsMap: new Map(),
    selectedLogDetail: null,
    groupPaths: urlParams.get('group') === 'true' || false,
    lastStatsData: null,
    hideInternal: true
};

// DOM elements cache
let els = {};

function apiUrl(endpoint) {
    return `/api/caddy/${endpoint}?org=${encodeURIComponent(state.org)}&env=${encodeURIComponent(state.env)}`;
}

function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
        return d.toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } else {
        return d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        }) + ' ' + d.toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit'
        });
    }
}

function formatFullTime(ts) {
    if (!ts) return '-';
    return new Date(ts * 1000).toISOString();
}

function formatDuration(d) {
    if (!d && d !== 0) return '-';
    if (d < 0.001) return '<1ms';
    if (d < 1) return Math.round(d * 1000) + 'ms';
    return d.toFixed(2) + 's';
}

function statusClass(code) {
    if (!code) return '';
    if (code >= 500) return 's5xx';
    if (code >= 400) return 's4xx';
    if (code >= 300) return 's3xx';
    if (code >= 200) return 's2xx';
    return '';
}

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

function setStatus(status) {
    const dot = document.getElementById('status-dot');
    if (dot) dot.className = 'status-dot ' + status;
}

function setEnvBadge() {
    const badge = document.getElementById('env-badge');
    if (badge) {
        badge.textContent = state.env;
        badge.className = 'env-badge ' + (state.env === 'local' ? 'local' : state.env === 'prod' ? 'prod' : '');
    }
}

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }
}

function parseLogEntry(log) {
    // HTTP request entry (fields may be top-level or nested in .request)
    if (log.method || log.uri || log.request?.method || log.request?.uri || (log.status && log.request)) {
        return {
            type: 'request',
            ts: log.ts,
            status: log.status,
            method: log.method || log.request?.method,
            uri: log.uri || log.request?.uri,
            duration: log.duration,
            isError: log.status >= 500
        };
    }

    if (log.level === 'error') {
        return {
            type: 'error', ts: log.ts, level: 'error',
            msg: log.msg || log.error || 'Unknown error',
            logger: log.logger
        };
    }

    if (log.level || log.msg) {
        return {
            type: 'info', ts: log.ts,
            level: log.level || 'info',
            msg: log.msg || JSON.stringify(log),
            logger: log.logger
        };
    }

    return { type: 'raw', raw: log.raw || JSON.stringify(log) };
}
