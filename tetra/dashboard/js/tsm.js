// TSM Panel - Configuration
const CONFIG = {
    refreshInterval: 5000
};

// Read initial params from URL
const params = new URLSearchParams(location.search);

// Consolidated state
const state = {
    org: params.get('org') || 'tetra',
    env: params.get('env') || 'local',
    user: params.get('user') || '',
    watchedServices: new Set(JSON.parse(localStorage.getItem('tsm-watched-logs') || '[]')),
    expandedService: null,
    serviceInfoCache: new Map(),
    // Log filtering state
    logFilter: {
        search: '',
        level: 'all',
        timeRange: 'all'  // all, 1m, 5m, 1h
    },
    s3Configured: false
};

// DOM elements
let els = {};

function saveWatched() {
    localStorage.setItem('tsm-watched-logs', JSON.stringify([...state.watchedServices]));
}

function toggleLogs(serviceName) {
    if (state.watchedServices.has(serviceName)) {
        state.watchedServices.delete(serviceName);
    } else {
        state.watchedServices.add(serviceName);
    }
    saveWatched();

    Terrain.Iframe.send({
        source: 'tsm',
        type: 'log-watch-change',
        services: [...state.watchedServices],
        org: state.org,
        env: state.env,
        user: state.user
    });

    loadServices();
}

function getApiUrl(endpoint) {
    const params = new URLSearchParams({ org: state.org, env: state.env });
    if (state.user) params.set('user', state.user);
    return `${endpoint}?${params}`;
}

function updateHeader(data = {}) {
    const header = document.querySelector('.iframe-header span:first-child');
    if (!header) return;

    if (state.env === 'local') {
        header.textContent = 'Services';
    } else if (data.host) {
        header.innerHTML = `Services <span class="env-indicator ${state.env}">${data.host}</span>`;
    } else {
        header.innerHTML = `Services <span class="env-indicator ${state.env}">${state.env}</span>`;
    }
}

async function loadServices() {
    try {
        const res = await fetch(getApiUrl('/api/tsm/ls'));
        const data = await res.json();

        updateHeader(data);

        if (!data.services || data.services.length === 0) {
            const msg = state.env === 'local' ? '(no processes)' : `(no services on ${state.env})`;
            els.services.innerHTML = `<div class="empty">${msg}</div>`;
            return;
        }

        // Show remote indicator if not local
        const remoteTag = data.remote ? '<span class="remote-tag">SSH</span>' : '';

        const expanded = state.expandedService;
        els.services.innerHTML = data.services.map(svc => `
            <div class="service service-row${expanded === svc.name ? ' expanded' : ''}"
                 data-service="${svc.name}"
                 data-action="expand-service">
                <span class="expand-icon">\u25B6</span>
                <div class="status-dot ${svc.status}"></div>
                <span class="name">${svc.name}</span>
                <span class="port">${svc.port ? ':' + svc.port : '-'}</span>
                <span class="uptime">${svc.uptime || '-'}</span>
                <div class="actions" onclick="event.stopPropagation()">
                    <button class="btn log-btn${state.watchedServices.has(svc.name) ? ' active' : ''}"
                            data-action="toggle-logs"
                            data-service="${svc.name}"
                            title="Watch logs">L</button>
                    <button class="btn" data-action="toggle-service"
                            data-service="${svc.name}"
                            data-status="${svc.status}">${svc.status === 'online' ? 'stop' : 'start'}</button>
                </div>
            </div>
            <div class="service-details${expanded === svc.name ? ' visible' : ''}"
                 data-service="${svc.name}">
                ${expanded === svc.name && state.serviceInfoCache.has(svc.name) ? '' : '<span class="loading">Loading...</span>'}
            </div>
        `).join('');

        // Re-render info for expanded service if cached
        if (expanded && state.serviceInfoCache.has(expanded)) {
            renderServiceInfo(expanded, state.serviceInfoCache.get(expanded));
        }

        // Show cached indicator if data is from cache
        if (data.cached) {
            const header = document.querySelector('.iframe-header');
            if (header && !header.querySelector('.cache-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'cache-indicator';
                indicator.style.cssText = 'font-size:9px;color:var(--ink-muted);margin-left:4px;';
                indicator.textContent = '(cached)';
                header.insertBefore(indicator, header.querySelector('.refresh'));
            }
        }
    } catch (err) {
        els.services.innerHTML = `<div class="error">Failed to load services: ${err.message}</div>`;
    }
}

async function toggleService(name, status) {
    const action = status === 'online' ? 'stop' : 'start';
    try {
        await fetch(getApiUrl(`/api/tsm/${action}/${name}`), { method: 'POST' });
        // Clear info cache for this service
        state.serviceInfoCache.delete(name);
        // Clear cache for this org:env so next load is fresh
        setTimeout(loadServices, 500);
    } catch (err) {
        console.error('Failed to ' + action + ' service:', err);
    }
}

async function toggleExpand(serviceName) {
    if (state.expandedService === serviceName) {
        state.expandedService = null;
        renderExpanded();
        return;
    }

    state.expandedService = serviceName;
    renderExpanded();

    // Fetch info if not cached
    if (!state.serviceInfoCache.has(serviceName)) {
        await fetchServiceInfo(serviceName);
    } else {
        renderServiceInfo(serviceName, state.serviceInfoCache.get(serviceName));
    }
}

async function fetchServiceInfo(serviceName, forceRefresh = false) {
    const detailsEl = document.querySelector(`.service-details[data-service="${serviceName}"]`);
    if (!detailsEl) return;

    detailsEl.innerHTML = '<span class="loading">Loading...</span>';

    try {
        // Build logs URL with filter params
        let logsUrl = getApiUrl(`/api/tsm/logs/${serviceName}`) + '&lines=50';

        // Add time range filter
        if (state.logFilter.timeRange !== 'all') {
            logsUrl += `&since=${state.logFilter.timeRange}`;
        }

        // Add server-side search filter
        if (state.logFilter.search) {
            logsUrl += `&search=${encodeURIComponent(state.logFilter.search)}`;
        }

        // Fetch info and recent logs in parallel
        const [infoRes, logsRes] = await Promise.all([
            fetch(getApiUrl(`/api/tsm/info/${serviceName}`)),
            fetch(logsUrl)
        ]);
        const data = await infoRes.json();
        const logsData = await logsRes.json();
        data.recentLogs = logsData.logs || '';
        state.serviceInfoCache.set(serviceName, data);
        renderServiceInfo(serviceName, data);
    } catch (err) {
        detailsEl.innerHTML = `<span class="error">Failed to load info: ${err.message}</span>`;
    }
}

// Filter logs by level (client-side)
function filterLogsByLevel(logs, level) {
    if (level === 'all') return logs;

    const lines = logs.split('\n');
    const filtered = lines.filter(line => {
        const lowerLine = line.toLowerCase();
        switch (level) {
            case 'error':
                return lowerLine.includes('error') || lowerLine.includes('err]') || lowerLine.includes('[e]');
            case 'warn':
                return lowerLine.includes('warn') || lowerLine.includes('[w]');
            case 'info':
                return lowerLine.includes('info') || lowerLine.includes('[i]') ||
                       (!lowerLine.includes('error') && !lowerLine.includes('warn'));
            default:
                return true;
        }
    });
    return filtered.join('\n');
}

// Highlight search matches in logs
function highlightSearchMatches(logs, search) {
    if (!search) return logs;

    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return logs.replace(regex, '<span class="log-highlight">$1</span>');
}

// Check S3 configuration status
async function checkS3Status() {
    try {
        const res = await fetch(getApiUrl('/api/tsm/logs/s3-status'));
        const data = await res.json();
        state.s3Configured = data.configured || false;
    } catch (err) {
        state.s3Configured = false;
    }
}

// Export logs to S3
async function exportLogsToS3(serviceName) {
    try {
        const res = await fetch(getApiUrl(`/api/tsm/logs/export/${serviceName}`), { method: 'POST' });
        const data = await res.json();

        if (data.error) {
            showToast(`Export failed: ${data.error}`, 'error');
        } else {
            showToast(`Logs exported successfully`, 'success');
        }
    } catch (err) {
        showToast(`Export failed: ${err.message}`, 'error');
    }
}

// Simple toast notification
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 10px;
        z-index: 1000;
        background: ${type === 'error' ? 'var(--one)' : 'var(--three)'};
        color: var(--paper-dark);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function renderServiceInfo(serviceName, data) {
    const detailsEl = document.querySelector(`.service-details[data-service="${serviceName}"]`);
    if (!detailsEl) return;

    const info = data.info || {};

    // Build info display
    let html = '<div class="info-grid">';

    // Core fields
    const coreFields = [
        ['PID', info.pid],
        ['Port', info.port],
        ['Status', info.status],
        ['Uptime', info.uptime],
        ['CPU', info.cpu],
        ['Memory', info.memory || info.mem],
        ['Restarts', info.restarts]
    ];

    for (const [label, value] of coreFields) {
        if (value !== undefined && value !== null && value !== '') {
            html += `<span class="info-label">${label}:</span><span class="info-value">${value}</span>`;
        }
    }
    html += '</div>';

    // Paths section
    const pathFields = [
        ['TSM File', info.tsm_file || info.tsmFile],
        ['Script', info.script],
        ['Log File', info.log_file || info.logFile],
        ['Working Dir', info.cwd || info.workDir]
    ];

    const hasPath = pathFields.some(([_, v]) => v);
    if (hasPath) {
        html += '<div class="info-section"><div class="info-section-title">Paths</div><div class="info-grid">';
        for (const [label, value] of pathFields) {
            if (value) {
                html += `<span class="info-label">${label}:</span><span class="info-value path">${value}</span>`;
            }
        }
        html += '</div></div>';
    }

    // Environment section
    if (info.env && typeof info.env === 'object' && Object.keys(info.env).length > 0) {
        html += '<div class="info-section"><div class="info-section-title">Environment</div><div class="info-grid">';
        for (const [key, value] of Object.entries(info.env)) {
            html += `<span class="info-label">${key}:</span><span class="info-value">${value}</span>`;
        }
        html += '</div></div>';
    }

    // Raw output fallback
    if (info.raw && !info.pid) {
        html += `<div class="info-section"><pre style="margin:0;white-space:pre-wrap;color:var(--ink);font-size:9px;">${info.raw}</pre></div>`;
    }

    // Recent logs section with toolbar
    if (data.recentLogs || state.expandedService === serviceName) {
        // Apply level filter
        let filteredLogs = data.recentLogs || '';
        filteredLogs = filterLogsByLevel(filteredLogs, state.logFilter.level);

        // Escape HTML
        let escapedLogs = filteredLogs
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Apply search highlighting (after escaping)
        if (state.logFilter.search) {
            escapedLogs = highlightSearchMatches(escapedLogs, state.logFilter.search);
        }

        const exportBtnClass = state.s3Configured ? 'export-btn' : 'export-btn hidden';

        html += `
            <div class="info-section">
                <div class="info-section-title">Recent Logs</div>
                <div class="log-toolbar">
                    <input type="text" class="search-input" placeholder="Search logs..."
                           value="${state.logFilter.search}"
                           data-action="log-search" data-service="${serviceName}">
                    <select data-action="log-level" data-service="${serviceName}">
                        <option value="all"${state.logFilter.level === 'all' ? ' selected' : ''}>All</option>
                        <option value="error"${state.logFilter.level === 'error' ? ' selected' : ''}>Error</option>
                        <option value="warn"${state.logFilter.level === 'warn' ? ' selected' : ''}>Warn</option>
                        <option value="info"${state.logFilter.level === 'info' ? ' selected' : ''}>Info</option>
                    </select>
                    <div class="pill-group">
                        <button class="pill${state.logFilter.timeRange === '1m' ? ' active' : ''}"
                                data-action="log-time" data-time="1m" data-service="${serviceName}">1m</button>
                        <button class="pill${state.logFilter.timeRange === '5m' ? ' active' : ''}"
                                data-action="log-time" data-time="5m" data-service="${serviceName}">5m</button>
                        <button class="pill${state.logFilter.timeRange === '1h' ? ' active' : ''}"
                                data-action="log-time" data-time="1h" data-service="${serviceName}">1h</button>
                        <button class="pill${state.logFilter.timeRange === 'all' ? ' active' : ''}"
                                data-action="log-time" data-time="all" data-service="${serviceName}">All</button>
                    </div>
                    <button class="${exportBtnClass}"
                            data-action="export-logs" data-service="${serviceName}">Export</button>
                </div>
                <pre class="recent-logs">${escapedLogs || '(no logs)'}</pre>
            </div>
        `;
    }

    // Quick actions
    html += `
        <div class="quick-actions">
            <button class="btn" data-action="restart-service" data-service="${serviceName}">restart</button>
            <button class="btn" data-action="view-logs" data-service="${serviceName}">logs</button>
        </div>
    `;

    detailsEl.innerHTML = html;
}

function renderExpanded() {
    // Update row states
    document.querySelectorAll('.service-row').forEach(row => {
        const name = row.dataset.service;
        row.classList.toggle('expanded', name === state.expandedService);
    });

    // Update details visibility
    document.querySelectorAll('.service-details').forEach(details => {
        const name = details.dataset.service;
        details.classList.toggle('visible', name === state.expandedService);
    });
}

async function restartService(name) {
    try {
        await fetch(getApiUrl(`/api/tsm/restart/${name}`), { method: 'POST' });
        state.serviceInfoCache.delete(name);
        setTimeout(loadServices, 500);
    } catch (err) {
        console.error('Failed to restart service:', err);
    }
}

function viewLogs(name) {
    // Add to watched and notify parent
    if (!state.watchedServices.has(name)) {
        state.watchedServices.add(name);
        saveWatched();
    }
    Terrain.Iframe.send({
        source: 'tsm',
        type: 'view-logs',
        service: name,
        org: state.org,
        env: state.env,
        user: state.user
    });
    loadServices();
}

function handleEnvChange(msg) {
    if (msg.env) state.env = msg.env;
    if (msg.org) state.org = msg.org;
    if (msg.user !== undefined) state.user = msg.user || '';

    // Clear expanded state and info cache for new env
    state.expandedService = null;
    state.serviceInfoCache.clear();

    // Remove cached indicator since we're fetching fresh
    const indicator = document.querySelector('.cache-indicator');
    if (indicator) indicator.remove();

    loadServices();
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tsm-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Show/hide refresh button (only for services tab)
    const refreshBtn = document.querySelector('.refresh');
    if (refreshBtn) {
        refreshBtn.style.display = tabName === 'services' ? '' : 'none';
    }
}

function init() {
    els = {
        services: document.getElementById('services')
    };

    // Register actions
    Terrain.Iframe.on('toggle-logs', (el, data) => toggleLogs(data.service));
    Terrain.Iframe.on('toggle-service', (el, data) => toggleService(data.service, data.status));
    Terrain.Iframe.on('expand-service', (el, data) => toggleExpand(data.service));
    Terrain.Iframe.on('restart-service', (el, data) => restartService(data.service));
    Terrain.Iframe.on('view-logs', (el, data) => viewLogs(data.service));
    Terrain.Iframe.on('switch-tab', (el, data) => switchTab(data.tab));
    Terrain.Iframe.on('refresh', () => loadServices());

    // Log toolbar actions
    Terrain.Iframe.on('log-time', (el, data) => {
        state.logFilter.timeRange = data.time;
        state.serviceInfoCache.delete(data.service);
        fetchServiceInfo(data.service, true);
    });

    Terrain.Iframe.on('export-logs', (el, data) => {
        exportLogsToS3(data.service);
    });

    // Handle log search input (with debounce)
    let searchTimeout = null;
    document.addEventListener('input', (e) => {
        if (e.target.matches('[data-action="log-search"]')) {
            const service = e.target.dataset.service;
            state.logFilter.search = e.target.value;

            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.serviceInfoCache.delete(service);
                fetchServiceInfo(service, true);
            }, 300);
        }
    });

    // Handle log level select
    document.addEventListener('change', (e) => {
        if (e.target.matches('[data-action="log-level"]')) {
            const service = e.target.dataset.service;
            state.logFilter.level = e.target.value;
            // Level filter is client-side, just re-render
            if (state.serviceInfoCache.has(service)) {
                renderServiceInfo(service, state.serviceInfoCache.get(service));
            }
        }
    });

    // Listen for env-change messages from parent
    Terrain.Bus.subscribe('env-change', handleEnvChange);

    // Check S3 configuration on load
    checkS3Status();

    loadServices();
    setInterval(loadServices, CONFIG.refreshInterval);
}

// Start
init();
