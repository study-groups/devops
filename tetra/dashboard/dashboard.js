// ============================================================================
// TETRA Console - Dashboard Manager
// ============================================================================

const Dashboard = (() => {
    // ========================================================================
    // Configuration
    // ========================================================================

    const VIEWS = {
        console:   { src: 'console.iframe.html',   label: 'Console' },
        tsm:       { src: 'tsm.iframe.html',       label: 'TSM' },
        deploy:    { src: 'deploy.iframe.html',    label: 'Deploy' },
        logs:      { src: 'logs.iframe.html',      label: 'Logs' },
        caddy:     { src: 'caddy.iframe.html',     label: 'Caddy' },
        capture:   { src: 'capture.iframe.html',   label: 'Capture' },
        tests:     { src: 'tests.iframe.html',     label: 'Tests' },
        infra:     { src: 'infra.iframe.html',     label: 'Infra' },
        orgs:      { src: 'orgs.iframe.html',      label: 'Orgs' },
        developer: { src: 'developer.iframe.html', label: 'Developer' },
        admin:     { src: 'admin.iframe.html',     label: 'Admin' },
        tut:       { src: 'tut.iframe.html',       label: 'Tut' },
        director:  { src: 'director.iframe.html',  label: 'Director' },
        vox:       { src: 'vox.iframe.html',      label: 'Vox' },
        agents:    { src: 'agents.iframe.html',   label: 'Agents' }
    };

    const ENVS = [
        { id: 'local',   label: 'local',  user: null },
        { id: 'dev',     label: 'dev',    user: 'root' },
        { id: 'staging', label: 'stg',    user: 'root' },
        { id: 'prod',    label: 'prod',   user: 'root' }
    ];

    const PANELS = [
        { id: 'top-left',     view: 'console', row: 'top' },
        { id: 'top-right',    view: 'tsm',     row: 'top' },
        { id: 'bottom-left',  view: 'deploy',  row: 'bottom' },
        { id: 'bottom-right', view: 'logs',    row: 'bottom' }
    ];

    // Orgs managed by Terrain.Orgs (shared module)
    function getOrgsForRender() {
        return Terrain.Orgs.buttonData().map(o => ({
            ...o,
            default: o.id === 'tetra'
        }));
    }

    let ORGS = getOrgsForRender();

    const STORAGE_KEY = 'tetra-console-state';

    const PANEL_ABBREV = {
        'top-left': 'tl', 'top-right': 'tr',
        'bottom-left': 'bl', 'bottom-right': 'br'
    };
    const ABBREV_PANEL = Object.fromEntries(
        Object.entries(PANEL_ABBREV).map(([k, v]) => [v, k])
    );

    // ========================================================================
    // State
    // ========================================================================

    let environments = {};
    let takeoverPanel = null;
    const iframeTimings = new Map();

    // DOM references (set during init)
    let root, panes, panels;

    // ========================================================================
    // Rendering
    // ========================================================================

    function renderViewOptions(selectedView) {
        return Object.entries(VIEWS).map(([id, cfg]) =>
            `<option value="${id}"${id === selectedView ? ' selected' : ''}>${cfg.label}</option>`
        ).join('');
    }

    function renderEnvButtons(activeEnv = 'local') {
        return ENVS.map(env => {
            const active = env.id === activeEnv ? ' active' : '';
            const userData = env.user ? ` data-user="${env.user}"` : '';
            const prefix = env.user ? `<span class="user-prefix">${env.user[0]}:</span>` : '';
            return `<button class="env-btn${active}" data-env="${env.id}"${userData}>${prefix}${env.label}</button>`;
        }).join('');
    }

    function renderPanelHeader(view) {
        return `
            <div class="panel-header">
                <select class="view-select">${renderViewOptions(view)}</select>
                <div class="env-btns">${renderEnvButtons()}</div>
                <span class="panel-actions">
                    <button class="refresh-btn" title="Reload">↻</button>
                    <button class="font-btn font-down" title="Decrease font">−</button>
                    <button class="font-btn font-up" title="Increase font">+</button>
                    <button class="takeover-btn" title="Expand panel">⛶</button>
                </span>
            </div>`;
    }

    function renderPanel(config, org = 'tetra') {
        const src = `${VIEWS[config.view].src}?env=local&org=${org}`;
        return `
            <div class="panel" data-panel="${config.id}" data-view="${config.view}">
                ${renderPanelHeader(config.view)}
                <div class="panel-content">
                    <iframe src="${src}"></iframe>
                </div>
            </div>`;
    }

    function renderOrgButtons() {
        return ORGS.map(org => {
            const active = org.default ? ' active' : '';
            return `<button class="org-btn${active}" data-org="${org.id}">${org.label}</button>`;
        }).join('');
    }

    function renderPanes(org = 'tetra') {
        const topPanels = PANELS.filter(p => p.row === 'top');
        const botPanels = PANELS.filter(p => p.row === 'bottom');

        return `
            <div class="pane-row top">
                ${renderPanel(topPanels[0], org)}
                <div class="divider divider-v" id="divider-top-v"></div>
                ${renderPanel(topPanels[1], org)}
            </div>
            <div class="divider divider-h" id="divider-h"></div>
            <div class="pane-row bottom">
                ${renderPanel(botPanels[0], org)}
                <div class="divider divider-v" id="divider-bot-v"></div>
                ${renderPanel(botPanels[1], org)}
            </div>`;
    }

    // ========================================================================
    // API
    // ========================================================================

    async function fetchEnvironments(org) {
        try {
            const res = await fetch(`/api/environments?org=${encodeURIComponent(org)}`);
            if (res.ok) {
                const data = await res.json();
                environments[org] = Object.keys(data);
                return environments[org];
            }
        } catch (e) {
            console.warn(`[Console] Failed to fetch environments for ${org}:`, e);
        }
        return ['local'];
    }

    // ========================================================================
    // Panel Management
    // ========================================================================

    function getActiveOrg() {
        const activeBtn = document.querySelector('.org-btn.active');
        return activeBtn?.dataset.org || 'tetra';
    }

    function updatePanelIframe(panel, envChangeOnly = false) {
        const viewSelect = panel.querySelector('.view-select');
        const activeEnvBtn = panel.querySelector('.env-btn.active');
        const iframe = panel.querySelector('iframe');

        const view = viewSelect.value;
        const env = activeEnvBtn?.dataset.env || 'local';
        const user = activeEnvBtn?.dataset.user || '';
        const org = getActiveOrg();

        panel.dataset.view = view;

        const viewConfig = VIEWS[view];
        if (!viewConfig) return;

        const params = new URLSearchParams({ env, org });
        if (user) params.set('user', user);
        const newSrc = `${viewConfig.src}?${params}`;

        if (envChangeOnly && iframe.contentWindow) {
            sendToPanel(panel, { type: 'env-change', env, org, user });
        } else {
            const panelId = panel.dataset.panel;
            iframeTimings.set(panelId, { start: Date.now(), view, end: null });
            iframe.src = newSrc;
        }

        savePanelState();
    }

    function refreshPanel(panel) {
        const iframe = panel.querySelector('iframe');
        if (iframe) {
            const panelId = panel.dataset.panel;
            const view = panel.querySelector('.view-select')?.value || 'unknown';
            iframeTimings.set(panelId, { start: Date.now(), view, end: null });
            iframe.src = iframe.src;
        }
    }

    const panelFontSizes = JSON.parse(localStorage.getItem('tetra-console-fonts') || '{}');

    function adjustPanelFont(panel, delta) {
        const panelId = panel.dataset.panel;
        const current = panelFontSizes[panelId] || 11;
        const newSize = Math.max(8, Math.min(18, current + delta));
        panelFontSizes[panelId] = newSize;
        localStorage.setItem('tetra-console-fonts', JSON.stringify(panelFontSizes));

        // Send to iframe via message
        sendToPanel(panel, { type: 'set-font-size', size: newSize });
    }

    function sendFontSize(panel) {
        const panelId = panel.dataset.panel;
        const size = panelFontSizes[panelId];
        if (size) {
            sendToPanel(panel, { type: 'set-font-size', size });
        }
    }

    function updatePanelTiming(panel, durationMs) {
        let timingEl = panel.querySelector('.panel-timing');
        if (!timingEl) {
            timingEl = document.createElement('span');
            timingEl.className = 'panel-timing';
            panel.querySelector('.panel-header').appendChild(timingEl);
        }
        const color = durationMs > 2000 ? 'var(--one)' : durationMs > 500 ? 'var(--three)' : 'var(--two)';
        timingEl.style.color = color;
        timingEl.textContent = `${durationMs}ms`;
        timingEl.title = `Load time: ${durationMs}ms`;
    }

    function sendToPanel(panel, data) {
        const fullMsg = { ...data, source: 'terrain', timestamp: Date.now() };
        Terrain.Bus.route(panel, fullMsg);
    }

    // ========================================================================
    // Takeover Mode
    // ========================================================================

    function toggleTakeover(panel) {
        const btn = panel.querySelector('.takeover-btn');

        if (takeoverPanel === panel) {
            panes.classList.remove('takeover');
            panel.classList.remove('takeover-active');
            btn.classList.remove('active');
            btn.title = 'Expand panel';
            takeoverPanel = null;
            serializeToHash();
        } else {
            if (takeoverPanel) {
                takeoverPanel.classList.remove('takeover-active');
                takeoverPanel.querySelector('.takeover-btn')?.classList.remove('active');
            }
            panes.classList.add('takeover');
            panel.classList.add('takeover-active');
            btn.classList.add('active');
            btn.title = 'Restore panels';
            takeoverPanel = panel;
            serializeToHash();
        }
    }

    // ========================================================================
    // State Persistence
    // ========================================================================

    function savePanelState() {
        const activeOrgBtn = document.querySelector('.org-btn.active');
        const state = {
            globalOrg: activeOrgBtn?.dataset.org || 'tetra',
            panes: {
                topHeight: getComputedStyle(root).getPropertyValue('--top-height').trim(),
                leftTopWidth: getComputedStyle(root).getPropertyValue('--left-top-width').trim(),
                leftBotWidth: getComputedStyle(root).getPropertyValue('--left-bot-width').trim()
            },
            panels: {}
        };

        panels.forEach(panel => {
            const id = panel.dataset.panel;
            const activeEnvBtn = panel.querySelector('.env-btn.active');
            state.panels[id] = {
                view: panel.querySelector('.view-select')?.value,
                env: activeEnvBtn?.dataset.env || 'local',
                user: activeEnvBtn?.dataset.user || ''
            };
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        serializeToHash();
    }

    function serializeToHash() {
        const params = new URLSearchParams();
        params.set('org', getActiveOrg());

        if (takeoverPanel) {
            params.set('takeover', takeoverPanel.dataset.panel);
        }

        panels.forEach(panel => {
            const id = panel.dataset.panel;
            const abbrev = PANEL_ABBREV[id];
            if (!abbrev) return;

            const view = panel.querySelector('.view-select')?.value;
            const activeEnvBtn = panel.querySelector('.env-btn.active');
            const env = activeEnvBtn?.dataset.env || 'local';
            const user = activeEnvBtn?.dataset.user || '';

            if (view) params.set(`${abbrev}.view`, view);
            if (env) params.set(`${abbrev}.env`, env);
            if (user) params.set(`${abbrev}.user`, user);
        });

        history.replaceState(null, '', '#' + params.toString());
    }

    function restoreFromHash() {
        const hash = window.location.hash.slice(1);
        if (!hash) return false;

        const params = new URLSearchParams(hash);
        if (!params.has('org')) return false;

        // Restore org
        const org = params.get('org');
        document.querySelectorAll('.org-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.org === org);
        });

        // Restore each panel
        panels.forEach(panel => {
            const id = panel.dataset.panel;
            const abbrev = PANEL_ABBREV[id];
            if (!abbrev) return;

            const view = params.get(`${abbrev}.view`);
            const env = params.get(`${abbrev}.env`);
            const user = params.get(`${abbrev}.user`);

            if (view) {
                const viewSelect = panel.querySelector('.view-select');
                if (viewSelect) viewSelect.value = view;
            }

            if (env) {
                panel.querySelectorAll('.env-btn').forEach(btn => {
                    const isMatch = btn.dataset.env === env;
                    btn.classList.toggle('active', isMatch);
                    if (isMatch && user && btn.dataset.user !== undefined) {
                        btn.dataset.user = user;
                        const prefix = btn.querySelector('.user-prefix');
                        if (prefix) prefix.textContent = user[0] + ':';
                    }
                });
            }

            updatePanelIframe(panel);
        });

        // Restore takeover
        const takeoverId = params.get('takeover');
        if (takeoverId) {
            const panel = document.querySelector(`[data-panel="${takeoverId}"]`);
            if (panel) toggleTakeover(panel);
        }

        return true;
    }

    function loadPanelState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const state = JSON.parse(saved);

            // Restore global org
            if (state.globalOrg) {
                document.querySelectorAll('.org-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.org === state.globalOrg);
                });
            }

            // Restore pane sizes
            if (state.panes) {
                if (state.panes.topHeight) root.style.setProperty('--top-height', state.panes.topHeight);
                if (state.panes.leftTopWidth) root.style.setProperty('--left-top-width', state.panes.leftTopWidth);
                if (state.panes.leftBotWidth) root.style.setProperty('--left-bot-width', state.panes.leftBotWidth);
            }

            // Restore panel state
            if (state.panels) {
                panels.forEach(panel => {
                    const id = panel.dataset.panel;
                    const panelState = state.panels[id];
                    if (!panelState) return;

                    const viewSelect = panel.querySelector('.view-select');
                    const envBtns = panel.querySelectorAll('.env-btn');

                    if (viewSelect && panelState.view) viewSelect.value = panelState.view;

                    if (panelState.env) {
                        envBtns.forEach(btn => {
                            const isMatch = btn.dataset.env === panelState.env;
                            btn.classList.toggle('active', isMatch);
                            if (isMatch && panelState.user && btn.dataset.user !== undefined) {
                                btn.dataset.user = panelState.user;
                                const prefix = btn.querySelector('.user-prefix');
                                if (prefix) prefix.textContent = panelState.user[0] + ':';
                            }
                        });
                    }

                    updatePanelIframe(panel);
                });
            }
        } catch (e) {
            console.warn('[Console] Failed to load state:', e);
        }
    }

    // ========================================================================
    // Resizer
    // ========================================================================

    function initResizers() {
        const dividerH = document.getElementById('divider-h');
        const dividerTopV = document.getElementById('divider-top-v');
        const dividerBotV = document.getElementById('divider-bot-v');

        let dragging = null;
        let startX, startY, startLeftTop, startLeftBot, startTop;

        function onMouseDown(e, type) {
            dragging = type;
            startX = e.clientX;
            startY = e.clientY;
            startLeftTop = parseFloat(getComputedStyle(root).getPropertyValue('--left-top-width'));
            startLeftBot = parseFloat(getComputedStyle(root).getPropertyValue('--left-bot-width'));
            startTop = parseFloat(getComputedStyle(root).getPropertyValue('--top-height'));

            document.body.style.cursor = type === 'h' ? 'row-resize' : 'col-resize';
            e.target.classList.add('active');
            document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
        }

        dividerH?.addEventListener('mousedown', (e) => onMouseDown(e, 'h'));
        dividerTopV?.addEventListener('mousedown', (e) => onMouseDown(e, 'top-v'));
        dividerBotV?.addEventListener('mousedown', (e) => onMouseDown(e, 'bot-v'));

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;

            const panesRect = panes.getBoundingClientRect();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (dragging === 'h') {
                const newTop = Math.max(20, Math.min(80, startTop + (dy / panesRect.height) * 100));
                root.style.setProperty('--top-height', newTop + '%');
            }
            if (dragging === 'top-v') {
                const newLeftTop = Math.max(20, Math.min(80, startLeftTop + (dx / panesRect.width) * 100));
                root.style.setProperty('--left-top-width', newLeftTop + '%');
            }
            if (dragging === 'bot-v') {
                const newLeftBot = Math.max(20, Math.min(80, startLeftBot + (dx / panesRect.width) * 100));
                root.style.setProperty('--left-bot-width', newLeftBot + '%');
            }
        });

        document.addEventListener('mouseup', () => {
            if (dragging) {
                document.body.style.cursor = '';
                document.querySelectorAll('.divider').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
                savePanelState();
                dragging = null;
            }
        });
    }

    // ========================================================================
    // Event Binding
    // ========================================================================

    function bindPanelEvents(panel) {
        const viewSelect = panel.querySelector('.view-select');
        const envBtns = panel.querySelectorAll('.env-btn');
        const refreshBtn = panel.querySelector('.refresh-btn');
        const takeoverBtn = panel.querySelector('.takeover-btn');
        const fontUpBtn = panel.querySelector('.font-up');
        const fontDownBtn = panel.querySelector('.font-down');

        viewSelect?.addEventListener('change', () => updatePanelIframe(panel));

        // Font size adjustment
        fontUpBtn?.addEventListener('click', () => adjustPanelFont(panel, 1));
        fontDownBtn?.addEventListener('click', () => adjustPanelFont(panel, -1));

        envBtns.forEach(btn => {
            const prefix = btn.querySelector('.user-prefix');
            if (prefix) {
                prefix.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const env = btn.dataset.env;
                    const userMap = {
                        dev: ['root', 'dev'],
                        staging: ['root', 'stg'],
                        prod: ['root', 'prod']
                    };
                    const users = userMap[env] || ['root', 'dev'];
                    const current = btn.dataset.user || 'root';
                    const idx = users.indexOf(current);
                    const next = users[(idx + 1) % users.length];
                    btn.dataset.user = next;
                    prefix.textContent = next[0] + ':';

                    if (btn.classList.contains('active')) {
                        updatePanelIframe(panel, true);
                    }
                });
            }

            btn.addEventListener('click', () => {
                envBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updatePanelIframe(panel, true);
            });
        });

        refreshBtn?.addEventListener('click', () => refreshPanel(panel));
        takeoverBtn?.addEventListener('click', () => toggleTakeover(panel));
    }

    function bindOrgEvents() {
        const orgBtns = document.querySelectorAll('.org-btn');
        orgBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                orgBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                for (const panel of panels) {
                    updatePanelIframe(panel);
                }
            });
        });
    }

    // ========================================================================
    // Message Handling
    // ========================================================================

    function initMessageBus() {
        Terrain.Bus.configure({ panels });

        // Developer panels subscribe to ALL messages
        Terrain.Bus.subscribe('*', (msg) => {
            panels.forEach(panel => {
                if (panel.dataset.view === 'developer') {
                    const iframe = panel.querySelector('iframe');
                    iframe?.contentWindow?.postMessage(msg, '*');
                }
            });
        });

        window.addEventListener('message', (e) => {
            const msg = e.data;
            if (!msg || typeof msg !== 'object') return;

            const from = msg.source || msg.from || 'unknown';
            Terrain.Bus._notify({ ...msg, _from: from, _to: 'parent' });

            if (msg.type === 'log-watch-change') {
                Terrain.Bus.broadcast(msg, e.source);
                return;
            }

            if (msg.type === 'request-timings') {
                const timings = Array.from(iframeTimings.entries()).map(([panel, t]) => ({
                    panel,
                    view: t.view,
                    duration: t.duration || (t.end ? t.end - t.start : null),
                    start: t.start
                })).filter(t => t.duration);

                panels.forEach(panel => {
                    if (panel.dataset.view === 'admin') {
                        sendToPanel(panel, { type: 'timing-update', timings });
                    }
                });
                return;
            }

            if (msg.source !== 'terrain') return;

            console.log('[Console] Message:', msg);

            if (msg.type === 'ready') {
                const sourceWindow = e.source;
                panels.forEach(panel => {
                    const iframe = panel.querySelector('iframe');
                    if (iframe?.contentWindow === sourceWindow) {
                        const panelId = panel.dataset.panel;
                        const timing = iframeTimings.get(panelId);
                        if (timing && !timing.end) {
                            timing.end = Date.now();
                            timing.duration = timing.end - timing.start;
                            console.log(`[Timing] ${panelId} (${timing.view}): ${timing.duration}ms`);
                            updatePanelTiming(panel, timing.duration);
                        }
                        // Send saved font size to iframe
                        sendFontSize(panel);
                    }
                });
            }

            // Handle orgs-changed from iframe panels
            if (msg.type === 'orgs-changed') {
                refreshOrgButtons();
            }
        });
    }

    // Refresh org buttons from Terrain.Orgs state
    function refreshOrgButtons() {
        ORGS = getOrgsForRender();

        const currentOrg = getActiveOrg();
        const container = document.querySelector('.global-org');
        if (container) {
            container.innerHTML = renderOrgButtons();
            bindOrgEvents();

            const orgExists = ORGS.some(o => o.id === currentOrg);
            const activeOrg = orgExists ? currentOrg : 'tetra';
            document.querySelectorAll('.org-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.org === activeOrg);
            });

            if (!orgExists && currentOrg !== 'tetra') {
                panels.forEach(panel => updatePanelIframe(panel));
            }
        }
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    async function init() {
        root = document.documentElement;
        panes = document.querySelector('.panes');

        // Initialize shared org state
        Terrain.Orgs.init();
        ORGS = getOrgsForRender();

        // Org changes from iframes handled via postMessage in initEvents()

        // Render org buttons in header
        const orgContainer = document.getElementById('global-org');
        if (orgContainer) {
            orgContainer.innerHTML = renderOrgButtons();
        }

        // Render panes
        panes.innerHTML = renderPanes(getActiveOrg());

        // Get panel references
        panels = document.querySelectorAll('.panel');

        // Bind events
        panels.forEach(bindPanelEvents);
        bindOrgEvents();
        initResizers();
        initMessageBus();

        // Prefetch environments
        await Promise.all(ORGS.map(org => fetchEnvironments(org.id)));

        // Load from URL hash if present, otherwise from localStorage
        if (!restoreFromHash()) {
            loadPanelState();
        }
    }

    // ========================================================================
    // Public API
    // ========================================================================

    return {
        init,
        renderOrgButtons,
        refreshOrgButtons,
        VIEWS,
        ENVS,
        PANELS,
        get ORGS() { return ORGS; }
    };
})();

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', Dashboard.init);
