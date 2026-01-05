// Caddy Panel - Configuration
const CONFIG = {
    refreshInterval: 10000
};

// Consolidated state
const state = {
    org: new URLSearchParams(window.location.search).get('org') || 'tetra',
    env: new URLSearchParams(window.location.search).get('env') || 'local'
};

// DOM elements
let els = {};

function apiUrl(endpoint) {
    return `/api/caddy/${endpoint}?org=${encodeURIComponent(state.org)}&env=${encodeURIComponent(state.env)}`;
}

function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-US', { hour12: false });
}

function formatDuration(d) {
    if (!d) return '-';
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

function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${name}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`tab-${name}`).style.display = 'block';

    if (name === 'logs') loadLogs();
    if (name === 'errors') loadErrors();
    if (name === 'info') loadInfo();
}

async function loadStatus() {
    try {
        const res = await fetch(apiUrl('status'));
        const data = await res.json();

        const dot = data.status === 'online' ? 'online' : 'offline';
        els.status.innerHTML = `
            <div class="status-item">
                <div class="status-dot ${dot}"></div>
                <span class="status-value ${dot}">${data.status}</span>
            </div>
            <div class="status-item"><span class="status-label">host:</span><span class="status-value">${data.host || 'localhost'}</span></div>
            ${data.listen ? `<div class="status-item"><span class="status-label">listen:</span><span class="status-value">${data.listen}</span></div>` : ''}
            ${data.version ? `<div class="status-item"><span class="status-label">version:</span><span class="status-value">${data.version}</span></div>` : ''}
            ${data.pid ? `<div class="status-item"><span class="status-label">pid:</span><span class="status-value">${data.pid}</span></div>` : ''}
        `;
    } catch (err) {
        els.status.innerHTML = `<span class="error">Failed to load status</span>`;
    }
}

async function loadRoutes() {
    try {
        const res = await fetch(apiUrl('routes'));
        const data = await res.json();

        if (!data.routes || data.routes.length === 0) {
            els.routes.innerHTML = '<div class="empty">(no routes found)</div>';
            return;
        }

        els.routes.innerHTML = data.routes.map(route => `
            <div class="route">
                <span class="route-path">${route.path}</span>
                <span class="route-arrow">→</span>
                <span class="route-upstream">${route.upstream}</span>
                <span class="route-type">${route.type || ''}</span>
            </div>
        `).join('');
    } catch (err) {
        els.routes.innerHTML = '<div class="error">Failed to load routes</div>';
    }
}

async function loadInfo() {
    try {
        const res = await fetch(apiUrl('info'));
        const data = await res.json();

        let html = `
            <div class="info-row">
                <span class="info-label">Caddyfile:</span>
                <span class="info-value ${data.exists ? 'exists' : 'missing'}">${data.caddyfile}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Modules:</span>
                <span class="info-value">${data.modulesDir || '(none)'}</span>
            </div>
        `;

        if (data.modules && data.modules.length > 0) {
            html += `
                <div class="info-row">
                    <span class="info-label"></span>
                    <div class="module-list">
                        ${data.modules.map(m => `<span class="module-tag">${m}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        html += `
            <div class="info-row">
                <span class="info-label">Log Dir:</span>
                <span class="info-value">${data.logDir || '(stdout)'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Environment:</span>
                <span class="info-value">${data.isLocal ? 'local' : 'remote'} (${data.org}/${data.env})</span>
            </div>
        `;

        els.info.innerHTML = html;
    } catch (err) {
        els.info.innerHTML = '<div class="error">Failed to load info</div>';
    }
}

async function loadLogs() {
    try {
        const res = await fetch(apiUrl('logs') + '&lines=100');
        const data = await res.json();

        if (data.message) {
            els.logs.innerHTML = `<div class="message">${data.message}</div>`;
            if (data.source) {
                els.logs.innerHTML += `<div class="info-row"><span class="info-label">Source:</span><span class="info-value">${data.source}</span></div>`;
            }
        }

        if (!data.logs || data.logs.length === 0) {
            if (!data.message) {
                els.logs.innerHTML = '<div class="empty">(no logs)</div>';
            }
            return;
        }

        const hasStructured = data.logs.some(l => l.status || l.method);

        if (hasStructured) {
            els.logs.innerHTML = data.logs.map(log => {
                if (log.raw) {
                    return `<div class="log-raw">${log.raw}</div>`;
                }
                return `
                    <div class="log-entry">
                        <span class="log-time">${formatTime(log.ts)}</span>
                        <span class="log-status ${statusClass(log.status)}">${log.status || '-'}</span>
                        <span class="log-method">${log.method || '-'}</span>
                        <span class="log-uri" title="${log.uri || ''}">${log.uri || '-'}</span>
                        <span class="log-duration">${formatDuration(log.duration)}</span>
                    </div>
                `;
            }).join('');
        } else {
            els.logs.innerHTML = data.logs.map(log =>
                `<div class="log-raw">${log.raw || JSON.stringify(log)}</div>`
            ).join('');
        }
    } catch (err) {
        els.logs.innerHTML = '<div class="error">Failed to load logs</div>';
    }
}

async function loadErrors() {
    try {
        const res = await fetch(apiUrl('errors') + '&lines=50');
        const data = await res.json();

        if (data.message) {
            els.errors.innerHTML = `<div class="message">${data.message}</div>`;
            return;
        }

        if (!data.errors || data.errors.length === 0) {
            els.errors.innerHTML = '<div class="empty">(no errors)</div>';
            return;
        }

        els.errors.innerHTML = data.errors.map(err => `
            <div class="error-entry">
                <span class="log-time">${formatTime(err.ts)}</span>
                <span class="log-status s5xx">${err.status || err.level || 'error'}</span>
                <span class="error-msg">${err.msg || err.uri || '-'}</span>
            </div>
        `).join('');
    } catch (err) {
        els.errors.innerHTML = '<div class="error">Failed to load errors</div>';
    }
}

function loadAll() {
    loadStatus();
    loadRoutes();
}

function handleMessage(msg) {
    if (msg.type === 'env-change') {
        state.org = msg.org || state.org;
        state.env = msg.env || state.env;
        loadAll();
    }
}

function init() {
    els = {
        status: document.getElementById('status'),
        routes: document.getElementById('routes'),
        logs: document.getElementById('logs'),
        errors: document.getElementById('errors'),
        info: document.getElementById('info')
    };

    // Register actions
    Terrain.Iframe.on('tab', (el, data) => showTab(data.tab));
    Terrain.Iframe.on('refresh', () => loadAll());

    // Initialize Terrain.Iframe for messaging
    Terrain.Iframe.init({
        name: 'caddy',
        onMessage: handleMessage
    });

    loadAll();
    setInterval(loadAll, CONFIG.refreshInterval);
}

// Start
init();
