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
    document.querySelectorAll('.btn[data-tab]').forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${name}"]`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    const tab = document.getElementById(`tab-${name}`);
    if (tab) tab.style.display = 'block';

    if (name === 'logs') loadLogs();
    if (name === 'errors') loadErrors();
    if (name === 'metadata') loadMetadata();
    if (name === 'fail2ban') loadFail2Ban();
    if (name === 'stats') loadStats();
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

async function loadMetadata() {
    try {
        const res = await fetch(apiUrl('metadata'));
        const data = await res.json();

        // Analysis settings
        const analysisToggle = document.getElementById('log-analysis-toggle');
        if (analysisToggle) {
            analysisToggle.checked = data.analysis?.enabled !== false;
        }

        els.metadataAnalysis.innerHTML = `
            <div class="stat-box">
                <div class="stat-value">${data.analysis?.filterLevel || 'standard'}</div>
                <div class="stat-label">Filter Level</div>
            </div>
            <div class="stat-box">
                <div class="stat-value ${data.analysis?.jsonParsing ? 'good' : ''}">${data.analysis?.jsonParsing ? 'Yes' : 'No'}</div>
                <div class="stat-label">JSON Parsing</div>
            </div>
        `;

        // Resource usage
        const cpuClass = data.resources?.cpuPercent > 50 ? 'warn' : data.resources?.cpuPercent > 80 ? 'bad' : 'good';
        const memClass = data.resources?.memoryMB > 512 ? 'warn' : data.resources?.memoryMB > 1024 ? 'bad' : 'good';

        els.metadataResources.innerHTML = `
            <div class="stat-box">
                <div class="stat-value ${cpuClass}">${data.resources?.cpuPercent?.toFixed(1) || 0}%</div>
                <div class="stat-label">CPU</div>
            </div>
            <div class="stat-box">
                <div class="stat-value ${memClass}">${data.resources?.memoryMB || 0} MB</div>
                <div class="stat-label">Memory</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${data.resources?.diskUsageMB || 0} MB</div>
                <div class="stat-label">Log Disk</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${data.resources?.openFiles || 0}</div>
                <div class="stat-label">Open Files</div>
            </div>
        `;

        // Log files
        if (data.files && data.files.length > 0) {
            els.metadataFiles.innerHTML = data.files.map(f => `
                <div class="file-entry">
                    <span class="file-name">${f.name}</span>
                    <span class="file-size">${f.size}</span>
                    <span class="file-age">${f.age}</span>
                </div>
            `).join('');
        } else {
            els.metadataFiles.innerHTML = '<div class="empty">(no log files)</div>';
        }
    } catch (err) {
        els.metadataAnalysis.innerHTML = '<div class="error">Failed to load metadata</div>';
    }
}

async function loadFail2Ban() {
    try {
        const res = await fetch(apiUrl('fail2ban'));
        const data = await res.json();

        // Status
        const statusClass = data.active ? 'online' : 'offline';
        els.f2bStatus.innerHTML = `
            <div class="status-item">
                <div class="status-dot ${statusClass}"></div>
                <span class="status-value ${statusClass}">${data.status}</span>
            </div>
            ${data.jails?.length ? `<div class="status-item"><span class="status-label">jails:</span><span class="status-value">${data.jails.join(', ')}</span></div>` : ''}
            ${data.message ? `<div class="status-item"><span class="status-value">${data.message}</span></div>` : ''}
        `;

        // Banned count badge
        const badge = document.getElementById('f2b-count');
        if (badge) {
            badge.textContent = data.totalBanned || 0;
            badge.className = data.totalBanned > 0 ? 'badge' : 'badge zero';
        }

        // Banned IPs
        if (data.banned && data.banned.length > 0) {
            els.f2bBanned.innerHTML = data.banned.map(b => `
                <div class="ban-entry">
                    <span class="ban-ip">${b.ip}</span>
                    <span class="ban-jail">${b.jail}</span>
                </div>
            `).join('');
        } else {
            els.f2bBanned.innerHTML = '<div class="empty">(no banned IPs)</div>';
        }

        // Recent activity
        if (data.recent && data.recent.length > 0) {
            els.f2bRecent.innerHTML = data.recent.map(r => {
                if (r.raw) return `<div class="activity-entry"><span>${r.raw}</span></div>`;
                return `
                    <div class="activity-entry">
                        <span class="log-time">${r.time}</span>
                        <span class="activity-action ${r.action}">${r.action}</span>
                        <span class="ban-ip">${r.ip}</span>
                    </div>
                `;
            }).join('');
        } else {
            els.f2bRecent.innerHTML = '<div class="empty">(no recent activity)</div>';
        }
    } catch (err) {
        els.f2bStatus.innerHTML = '<div class="error">Failed to load fail2ban</div>';
    }
}

async function loadStats() {
    try {
        const res = await fetch(apiUrl('stats'));
        const data = await res.json();

        if (data.message) {
            els.statsSummary.innerHTML = `<div class="message">${data.message}</div>`;
            return;
        }

        // Summary stats
        const errorRate = data.summary.totalRequests > 0
            ? ((data.summary.errorCount / data.summary.totalRequests) * 100).toFixed(1)
            : 0;
        const errorClass = errorRate > 5 ? 'bad' : errorRate > 1 ? 'warn' : 'good';

        els.statsSummary.innerHTML = `
            <div class="stat-box">
                <div class="stat-value">${formatNumber(data.summary.totalRequests)}</div>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="stat-box">
                <div class="stat-value ${errorClass}">${data.summary.errorCount}</div>
                <div class="stat-label">Errors (${errorRate}%)</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${data.summary.avgDuration}s</div>
                <div class="stat-label">Avg Duration</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${data.summary.uniqueIPs}</div>
                <div class="stat-label">Unique IPs</div>
            </div>
        `;

        // Top IPs
        if (data.topIPs && data.topIPs.length > 0) {
            els.statsIPs.innerHTML = data.topIPs.map(item => `
                <div class="top-item">
                    <span class="top-count">${item.count}</span>
                    <span class="top-value">${item.ip}</span>
                    <div class="top-bar"><div class="top-bar-fill" style="width: ${item.percent}%"></div></div>
                </div>
            `).join('');
        } else {
            els.statsIPs.innerHTML = '<div class="empty">(no data)</div>';
        }

        // Top paths
        if (data.topPaths && data.topPaths.length > 0) {
            els.statsPaths.innerHTML = data.topPaths.map(item => `
                <div class="top-item">
                    <span class="top-count">${item.count}</span>
                    <span class="top-value" title="${item.path}">${item.path}</span>
                    <div class="top-bar"><div class="top-bar-fill" style="width: ${item.percent}%"></div></div>
                </div>
            `).join('');
        } else {
            els.statsPaths.innerHTML = '<div class="empty">(no data)</div>';
        }

        // Status codes
        if (data.statusCodes && data.statusCodes.length > 0) {
            els.statsCodes.innerHTML = data.statusCodes.map(item => `
                <div class="top-item">
                    <span class="top-count">${item.count}</span>
                    <span class="log-status ${statusClass(parseInt(item.code))}">${item.code}</span>
                    <span class="top-value">${item.percent}%</span>
                    <div class="top-bar"><div class="top-bar-fill" style="width: ${item.percent}%"></div></div>
                </div>
            `).join('');
        } else {
            els.statsCodes.innerHTML = '<div class="empty">(no data)</div>';
        }
    } catch (err) {
        els.statsSummary.innerHTML = '<div class="error">Failed to load stats</div>';
    }
}

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
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
        // Metadata tab
        metadataAnalysis: document.getElementById('metadata-analysis'),
        metadataResources: document.getElementById('metadata-resources'),
        metadataFiles: document.getElementById('metadata-files'),
        // Fail2ban tab
        f2bStatus: document.getElementById('f2b-status'),
        f2bBanned: document.getElementById('f2b-banned'),
        f2bRecent: document.getElementById('f2b-recent'),
        // Stats tab
        statsSummary: document.getElementById('stats-summary'),
        statsIPs: document.getElementById('stats-ips'),
        statsPaths: document.getElementById('stats-paths'),
        statsCodes: document.getElementById('stats-codes')
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
