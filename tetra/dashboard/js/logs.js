// Logs Panel - Configuration
const CONFIG = {
    maxLogs: 200,
    tsmPollInterval: 3000,
    reconnectDelay: 5000
};

// Read initial params from URL
const params = new URLSearchParams(location.search);

// Consolidated state
const state = {
    org: params.get('org') || 'tetra',
    env: params.get('env') || 'local',
    user: params.get('user') || '',
    eventSource: null,
    logs: [],
    tsmLogs: {},
    watchedServices: new Set(JSON.parse(localStorage.getItem('tsm-watched-logs') || '[]')),
    currentFilter: 'all',
    searchQuery: '',
    sinceTimestamp: null,
    activeTimeFilter: null
};

// DOM elements (initialized in init)
let els = {};

// Time filter presets
function setTimeFilter(preset) {
    const pills = document.querySelectorAll('.time-filters .pill');

    if (state.activeTimeFilter === preset) {
        state.activeTimeFilter = null;
        state.sinceTimestamp = null;
        pills.forEach(b => b.classList.remove('active'));
        renderLogs();
        return;
    }

    state.activeTimeFilter = preset;
    pills.forEach(b => b.classList.remove('active'));

    const now = Date.now();
    switch (preset) {
        case 'now':
            state.sinceTimestamp = new Date();
            break;
        case '5m':
            state.sinceTimestamp = new Date(now - 5 * 60 * 1000);
            break;
        case '1h':
            state.sinceTimestamp = new Date(now - 60 * 60 * 1000);
            break;
    }

    document.querySelector(`.time-filters .pill[data-time="${preset}"]`)?.classList.add('active');
    renderLogs();
}

function formatTimestamp(ts, showDelta = false, delta = null) {
    if (!ts) return '';
    try {
        const d = new Date(ts);
        const time = d.toTimeString().slice(0, 8);

        // If delta is available and we want to show it, append it
        if (showDelta && delta) {
            return `${time} ${delta}`;
        }
        return time;
    } catch {
        return ts.slice(11, 19) || '';
    }
}

// Format compact ISO for display (strip date, keep time with ms)
function formatCompactTime(ts) {
    if (!ts) return '';
    // 20260113T143245.123Z -> 14:32:45.123
    if (ts.length === 22 && ts[8] === 'T') {
        return `${ts.slice(9,11)}:${ts.slice(11,13)}:${ts.slice(13,19)}`;
    }
    return formatTimestamp(ts);
}

function getAllLogs() {
    const allLogs = [...state.logs];

    for (const [service, serviceLogs] of Object.entries(state.tsmLogs)) {
        allLogs.push(...serviceLogs);
    }

    allLogs.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime() || 0;
        const tb = new Date(b.timestamp).getTime() || 0;
        return tb - ta;
    });

    return allLogs.slice(0, CONFIG.maxLogs);
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<span class="highlight">$1</span>');
}

function renderLogs() {
    const allLogs = getAllLogs();

    let filtered = state.currentFilter === 'all'
        ? allLogs
        : allLogs.filter(l => l.source === state.currentFilter);

    if (state.sinceTimestamp) {
        const sinceMs = state.sinceTimestamp.getTime();
        filtered = filtered.filter(l => {
            const logTime = new Date(l.timestamp).getTime();
            return logTime >= sinceMs;
        });
    }

    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(l =>
            (l.message || '').toLowerCase().includes(q) ||
            (l.source || '').toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        els.logs.innerHTML = '<div class="empty">(no logs)</div>';
        return;
    }

    els.logs.innerHTML = filtered.map((log, i) => `
        <div class="log-line${i === 0 && log.isNew ? ' new' : ''}">
            <span class="timestamp">${formatTimestamp(log.timestamp)}</span>
            <span class="level level-${log.level}">[${(log.level || 'info').toUpperCase()}]</span>
            <span class="source">${log.source || 'system'}</span>
            <span class="message">${highlightText(log.message || '', state.searchQuery)}</span>
        </div>
    `).join('');

    if (state.logs.length > 0) {
        state.logs[0].isNew = false;
    }
}

function addLog(entry) {
    entry.isNew = true;
    state.logs.unshift(entry);
    if (state.logs.length > CONFIG.maxLogs) {
        state.logs.pop();
    }
    renderLogs();
    els.logs.scrollTop = 0;
}

async function loadLogs() {
    try {
        const res = await fetch('/api/logs?limit=50');
        const data = await res.json();
        state.logs = data.logs || [];
        renderLogs();
    } catch (err) {
        els.logs.innerHTML = '<div class="error">Failed to load logs</div>';
    }
}

function connectSSE() {
    if (state.eventSource) {
        state.eventSource.close();
    }

    els.statusDot.className = 'status-dot';

    state.eventSource = new EventSource('/api/logs/stream');

    state.eventSource.onopen = () => {
        els.statusDot.className = 'status-dot connected';
    };

    state.eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
                loadLogs();
            } else {
                addLog(data);
            }
        } catch (e) {
            console.error('Failed to parse SSE data:', e);
        }
    };

    state.eventSource.onerror = () => {
        els.statusDot.className = 'status-dot disconnected';
        setTimeout(connectSSE, CONFIG.reconnectDelay);
    };
}

// TSM log integration
// Uses JSON format for structured timestamps and delta timing
async function fetchTsmLogs(serviceName) {
    try {
        const params = new URLSearchParams({
            lines: 30,
            format: 'json',
            org: state.org,
            env: state.env
        });
        if (state.user) params.set('user', state.user);
        const res = await fetch(`/api/tsm/logs/${serviceName}?${params}`);
        const data = await res.json();

        if (data.entries && data.entries.length > 0) {
            // Use structured entries with real timestamps
            state.tsmLogs[serviceName] = data.entries.map(entry => ({
                timestamp: parseCompactISO(entry.ts) || new Date().toISOString(),
                delta: entry.delta || '+0.000',
                level: inferLogLevel(entry.line),
                source: serviceName,
                stream: entry.stream, // 'out' or 'err'
                message: entry.line
            })).slice(-30);
        } else if (data.logs) {
            // Fallback to text format parsing
            const lines = data.logs.split('\n').filter(Boolean);
            state.tsmLogs[serviceName] = lines.map(line => ({
                timestamp: new Date().toISOString(),
                level: inferLogLevel(line),
                source: serviceName,
                message: line
            })).slice(-30);
        }
    } catch (e) {
        console.warn(`Failed to fetch logs for ${serviceName}:`, e);
    }
}

// Parse compact ISO timestamp (20260113T143245.123Z) to standard ISO
function parseCompactISO(ts) {
    if (!ts || ts.length !== 22) return null;
    try {
        // 20260113T143245.123Z -> 2026-01-13T14:32:45.123Z
        const year = ts.slice(0, 4);
        const month = ts.slice(4, 6);
        const day = ts.slice(6, 8);
        const hour = ts.slice(9, 11);
        const min = ts.slice(11, 13);
        const sec = ts.slice(13, 15);
        const ms = ts.slice(16, 19);
        return `${year}-${month}-${day}T${hour}:${min}:${sec}.${ms}Z`;
    } catch {
        return null;
    }
}

// Infer log level from message content
function inferLogLevel(line) {
    if (!line) return 'info';
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('err]') || lower.includes('fatal')) return 'error';
    if (lower.includes('warn') || lower.includes('wrn]')) return 'warn';
    if (lower.includes('debug') || lower.includes('dbg]')) return 'debug';
    return 'info';
}

function renderTsmSources() {
    if (state.watchedServices.size === 0) {
        els.tsmSources.innerHTML = '';
        return;
    }

    els.tsmSources.innerHTML = [...state.watchedServices].map(svc => `
        <span class="tsm-tag">
            ${svc}
            <span class="close" data-action="remove-tsm-source" data-service="${svc}">×</span>
        </span>
    `).join('');
}

function removeTsmSource(serviceName) {
    state.watchedServices.delete(serviceName);
    delete state.tsmLogs[serviceName];
    localStorage.setItem('tsm-watched-logs', JSON.stringify([...state.watchedServices]));
    renderTsmSources();
    renderLogs();

    Terrain.Iframe.send({
        source: 'logs',
        type: 'log-watch-change',
        services: [...state.watchedServices]
    });
}

async function pollTsmLogs() {
    for (const service of state.watchedServices) {
        await fetchTsmLogs(service);
    }
    if (state.watchedServices.size > 0) {
        renderLogs();
    }
}

function handleEnvChange(msg) {
    const envChanged = msg.env && msg.env !== state.env;
    const orgChanged = msg.org && msg.org !== state.org;

    if (msg.env) state.env = msg.env;
    if (msg.org) state.org = msg.org;
    if (msg.user !== undefined) state.user = msg.user || '';

    // Clear watched services when org/env changes (services are env-specific)
    if (envChanged || orgChanged) {
        state.watchedServices.clear();
        state.tsmLogs = {};
        localStorage.setItem('tsm-watched-logs', '[]');
        renderTsmSources();
        renderLogs();
    } else {
        // Re-fetch TSM logs with new context
        pollTsmLogs();
    }
}

function handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    // Handle env changes
    if (msg.type === 'env-change') {
        handleEnvChange(msg);
        return;
    }

    // Log postMessage traffic
    const from = msg.source || msg.from || '?';
    const to = msg._to || 'logs';
    const via = msg._via ? ` via ${msg._via}` : '';
    const payload = {...msg};
    delete payload.source;
    delete payload.from;
    delete payload.type;
    delete payload.timestamp;
    delete payload._via;
    delete payload._to;
    const payloadStr = Object.keys(payload).length > 0
        ? ' ' + JSON.stringify(payload).slice(0, 60)
        : '';

    addLog({
        timestamp: new Date().toISOString(),
        level: 'debug',
        source: 'msg',
        message: `[${from}→${to}${via}] ${msg.type || 'unknown'}${payloadStr}`
    });

    if (msg.type === 'log-watch-change' && msg.source === 'tsm') {
        // Update context from TSM panel
        if (msg.org) state.org = msg.org;
        if (msg.env) state.env = msg.env;
        if (msg.user !== undefined) state.user = msg.user || '';

        state.watchedServices = new Set(msg.services || []);
        localStorage.setItem('tsm-watched-logs', JSON.stringify([...state.watchedServices]));

        for (const svc of state.watchedServices) {
            if (!state.tsmLogs[svc]) {
                fetchTsmLogs(svc);
            }
        }

        for (const svc of Object.keys(state.tsmLogs)) {
            if (!state.watchedServices.has(svc)) {
                delete state.tsmLogs[svc];
            }
        }

        renderTsmSources();
        renderLogs();
    }
}

function init() {
    // Cache DOM elements
    els = {
        logs: document.getElementById('logs'),
        statusDot: document.getElementById('status-dot'),
        searchInput: document.getElementById('search-input'),
        tsmSources: document.getElementById('tsm-sources')
    };

    // Register actions
    Terrain.Iframe.on('filter', (el, data) => {
        document.querySelectorAll('.filters .pill').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        state.currentFilter = data.filter;
        renderLogs();
    });

    Terrain.Iframe.on('time-filter', (el, data) => {
        setTimeFilter(data.time);
    });

    Terrain.Iframe.on('remove-tsm-source', (el, data) => {
        removeTsmSource(data.service);
    });

    Terrain.Iframe.on('refresh', () => loadLogs());

    // Search handler
    els.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderLogs();
    });

    // Initialize Terrain.Iframe for messaging
    Terrain.Iframe.init({
        name: 'logs',
        onMessage: handleMessage
    });

    // Listen for env-change messages from parent
    Terrain.Bus.subscribe('env-change', handleEnvChange);

    // Clear stale watched services on fresh load (context may have changed)
    // Services will be re-added when user clicks [L] with correct context
    state.watchedServices.clear();
    state.tsmLogs = {};
    localStorage.removeItem('tsm-watched-logs');

    // Start SSE connection
    connectSSE();
    renderTsmSources();

    // Poll TSM logs periodically
    setInterval(pollTsmLogs, CONFIG.tsmPollInterval);
}

// Start
init();
