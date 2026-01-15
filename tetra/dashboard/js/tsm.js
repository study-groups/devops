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
    watchedServices: new Set(JSON.parse(localStorage.getItem('tsm-watched-logs') || '[]'))
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

        els.services.innerHTML = data.services.map(svc => `
            <div class="service">
                <div class="status-dot ${svc.status}"></div>
                <span class="name">${svc.name}</span>
                <span class="port">${svc.port ? ':' + svc.port : '-'}</span>
                <span class="uptime">${svc.uptime || '-'}</span>
                <div class="actions">
                    <button class="btn log-btn${state.watchedServices.has(svc.name) ? ' active' : ''}"
                            data-action="toggle-logs"
                            data-service="${svc.name}"
                            title="Watch logs">L</button>
                    <button class="btn" data-action="toggle-service"
                            data-service="${svc.name}"
                            data-status="${svc.status}">${svc.status === 'online' ? 'stop' : 'start'}</button>
                </div>
            </div>
        `).join('');

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
        // Clear cache for this org:env so next load is fresh
        setTimeout(loadServices, 500);
    } catch (err) {
        console.error('Failed to ' + action + ' service:', err);
    }
}

function handleEnvChange(msg) {
    if (msg.env) state.env = msg.env;
    if (msg.org) state.org = msg.org;
    if (msg.user) state.user = msg.user;

    // Remove cached indicator since we're fetching fresh
    const indicator = document.querySelector('.cache-indicator');
    if (indicator) indicator.remove();

    loadServices();
}

function init() {
    els = {
        services: document.getElementById('services')
    };

    // Register actions
    Terrain.Iframe.on('toggle-logs', (el, data) => toggleLogs(data.service));
    Terrain.Iframe.on('toggle-service', (el, data) => toggleService(data.service, data.status));
    Terrain.Iframe.on('refresh', () => loadServices());

    // Listen for env-change messages from parent
    Terrain.Bus.subscribe('env-change', handleEnvChange);

    loadServices();
    setInterval(loadServices, CONFIG.refreshInterval);
}

// Start
init();
