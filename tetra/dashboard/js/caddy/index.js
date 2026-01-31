// Caddy Panel - Init & Tab Management
// Exports: showTab, handleMessage, init

function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === name);
    });

    document.querySelectorAll('.content').forEach(c => {
        c.classList.toggle('hidden', c.id !== `tab-${name}`);
    });

    state.activeTab = name;
    localStorage.setItem(CONFIG.storageKey, name);

    tabs[name]?.onActivate?.();
}

function handleMessage(msg) {
    if (msg.type === 'env-change') {
        state.org = msg.org || state.org;
        state.env = msg.env || state.env;
        setEnvBadge();
        loadAll();
        showTab(state.activeTab);
    }
}

function init() {
    // Cache DOM elements
    els = {
        svcStatus: document.getElementById('svc-status'),
        svcListen: document.getElementById('svc-listen'),
        svcVersion: document.getElementById('svc-version'),
        svcApi: document.getElementById('svc-api'),
        routes: document.getElementById('routes'),
        cfgFile: document.getElementById('cfg-file'),
        cfgLog: document.getElementById('cfg-log'),

        logs: document.getElementById('logs'),
        logFilter: document.getElementById('log-filter'),
        debugBox: document.getElementById('debug-box'),
        debugData: document.getElementById('debug-data'),

        statTotal: document.getElementById('stat-total'),
        statErrors: document.getElementById('stat-errors'),
        statLatency: document.getElementById('stat-latency'),
        statIps: document.getElementById('stat-ips'),
        topPaths: document.getElementById('top-paths'),
        topCodes: document.getElementById('top-codes'),
        topIps: document.getElementById('top-ips'),

        f2bStatus: document.getElementById('f2b-status'),
        f2bJails: document.getElementById('f2b-jails'),
        f2bTotal: document.getElementById('f2b-total'),
        banList: document.getElementById('ban-list'),
        banRecent: document.getElementById('ban-recent')
    };

    // Tab clicks
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });

    // Refresh button
    document.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
        loadAll();
        showTab(state.activeTab);
    });

    // Refresh toggle
    document.getElementById('refresh-toggle')?.addEventListener('click', toggleAutoRefresh);

    // Let each module bind its own events
    for (const tab of Object.values(tabs)) {
        tab.onInit?.();
    }

    setEnvBadge();

    if (window.Terrain?.Iframe) {
        Terrain.Iframe.init({
            name: 'caddy',
            onMessage: handleMessage
        });
    }

    loadAll();
    showTab(state.activeTab);
    startAutoRefresh();
}

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
