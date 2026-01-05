// Logs Panel - Configuration
const CONFIG = {
    maxLogs: 200,
    tsmPollInterval: 3000,
    reconnectDelay: 5000
};

// Consolidated state
const state = {
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
    const btns = document.querySelectorAll('.time-btn');

    if (state.activeTimeFilter === preset) {
        state.activeTimeFilter = null;
        state.sinceTimestamp = null;
        btns.forEach(b => b.classList.remove('active'));
        renderLogs();
        return;
    }

    state.activeTimeFilter = preset;
    btns.forEach(b => b.classList.remove('active'));

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

    document.querySelector(`.time-btn[data-time="${preset}"]`)?.classList.add('active');
    renderLogs();
}

function formatTimestamp(ts) {
    if (!ts) return '';
    try {
        const d = new Date(ts);
        return d.toTimeString().slice(0, 8);
    } catch {
        return ts.slice(11, 19) || '';
    }
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
async function fetchTsmLogs(serviceName) {
    try {
        const res = await fetch(`/api/tsm/logs/${serviceName}?lines=30`);
        const data = await res.json();

        if (data.logs) {
            const lines = data.logs.split('\n').filter(Boolean);
            state.tsmLogs[serviceName] = lines.map(line => ({
                timestamp: new Date().toISOString(),
                level: line.includes('error') || line.includes('Error') ? 'error' :
                       line.includes('warn') || line.includes('Warn') ? 'warn' : 'info',
                source: serviceName,
                message: line
            })).slice(-30);
        }
    } catch (e) {
        console.warn(`Failed to fetch logs for ${serviceName}:`, e);
    }
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

function handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

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
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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

    // Start SSE connection
    connectSSE();
    renderTsmSources();
    pollTsmLogs();

    // Poll TSM logs periodically
    setInterval(pollTsmLogs, CONFIG.tsmPollInterval);
}

// Start
init();
