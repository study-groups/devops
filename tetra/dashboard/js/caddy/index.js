// Caddy Panel - Init & Tab Management

function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === name);
    });

    document.querySelectorAll('.content').forEach(c => {
        c.classList.toggle('hidden', c.id !== `tab-${name}`);
    });

    state.activeTab = name;
    localStorage.setItem(CONFIG.storageKey, name);

    if (name === 'logs') loadLogs();
    if (name === 'stats') loadStats();
    if (name === 'ban') { loadBan(); renderOffenders(); }
    if (name === 'help') loadLogFileInfo();
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

    // Log toolbar
    document.getElementById('btn-copy')?.addEventListener('click', copyLogs);
    document.getElementById('btn-json')?.addEventListener('click', exportJSON);
    document.getElementById('btn-follow')?.addEventListener('click', toggleFollowMode);
    document.getElementById('btn-raw')?.addEventListener('click', toggleRaw);
    document.getElementById('btn-debug')?.addEventListener('click', toggleDebug);
    document.getElementById('log-filter')?.addEventListener('input', handleLogFilter);

    // Time filter buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.timeFilter = btn.dataset.time;
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLogs();
        });
    });

    // Filter preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            state.logFilter = preset;
            const filterInput = document.getElementById('log-filter');
            if (filterInput) filterInput.value = preset;

            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLogs();
        });
    });

    // Hide internal/NOP toggle
    document.getElementById('chk-hide-internal')?.addEventListener('change', (e) => {
        state.hideInternal = e.target.checked;
        renderLogs();
    });

    // Log detail popover
    document.getElementById('log-detail-close')?.addEventListener('click', hideLogDetail);
    document.getElementById('log-detail-copy')?.addEventListener('click', copyLogDetail);
    document.getElementById('log-detail')?.addEventListener('click', (e) => {
        if (e.target.id === 'log-detail') hideLogDetail();
    });

    // Refresh toggle
    document.getElementById('refresh-toggle')?.addEventListener('click', toggleAutoRefresh);

    // Stats
    document.getElementById('btn-group-paths')?.addEventListener('click', () => {
        state.groupPaths = !state.groupPaths;
        renderStats();
    });
    document.getElementById('btn-copy-stats')?.addEventListener('click', copyStats);

    // Ban actions
    document.getElementById('btn-ban-ip')?.addEventListener('click', () => showBanDialog(''));
    document.getElementById('ban-dialog-close')?.addEventListener('click', hideBanDialog);
    document.getElementById('ban-dialog-submit')?.addEventListener('click', submitBan);
    document.getElementById('ban-dialog')?.addEventListener('click', (e) => {
        if (e.target.id === 'ban-dialog') hideBanDialog();
    });

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
