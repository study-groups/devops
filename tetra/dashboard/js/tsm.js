// TSM Panel - Configuration
const CONFIG = {
    refreshInterval: 5000
};

// Consolidated state
const state = {
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
        services: [...state.watchedServices]
    });

    loadServices();
}

async function loadServices() {
    try {
        const res = await fetch('/api/tsm/ls');
        const data = await res.json();

        if (!data.services || data.services.length === 0) {
            els.services.innerHTML = '<div class="empty">(no processes)</div>';
            return;
        }

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
    } catch (err) {
        els.services.innerHTML = '<div class="error">Failed to load services</div>';
    }
}

async function toggleService(name, status) {
    const action = status === 'online' ? 'stop' : 'start';
    try {
        await fetch(`/api/tsm/${action}/${name}`, { method: 'POST' });
        setTimeout(loadServices, 500);
    } catch (err) {
        console.error('Failed to ' + action + ' service:', err);
    }
}

function init() {
    els = {
        services: document.getElementById('services')
    };

    // Register actions
    Terrain.Iframe.on('toggle-logs', (el, data) => toggleLogs(data.service));
    Terrain.Iframe.on('toggle-service', (el, data) => toggleService(data.service, data.status));
    Terrain.Iframe.on('refresh', () => loadServices());

    loadServices();
    setInterval(loadServices, CONFIG.refreshInterval);
}

// Start
init();
