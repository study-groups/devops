// Organizations Panel Module
// Focus: org management, NodeHolder integration, tetra.toml workflow

const OrgsPanel = (function() {
    'use strict';

    let selectedOrg = null;
    let orgDetailsCache = new Map();

    const dom = {
        orgList: () => document.getElementById('org-list'),
        workspace: () => document.getElementById('org-workspace'),
        config: () => document.getElementById('org-config')
    };

    // Escape HTML
    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Templates
    const html = {
        orgItem: (org, isEnabled, isSelected) => {
            const typeClass = org.type === 'system' ? ' system' : (org.type === 'admin' ? ' admin' : '');
            const label = Terrain.Orgs.label(org.id);
            const aliasInfo = org.alias ? ` (${esc(org.alias)})` : '';

            // Status badges
            const badges = [];
            if (org.hasInfra) badges.push('<span class="org-badge infra">infra</span>');
            if (org.hasSections) badges.push('<span class="org-badge sections">sections</span>');
            if (org.nhSource) badges.push('<span class="org-badge nh">nh</span>');

            return `
                <div class="org-item${isSelected ? ' selected' : ''}" data-org="${esc(org.id)}">
                    <div class="org-toggle${isEnabled ? ' enabled' : ''}" data-org="${esc(org.id)}" title="Toggle visibility in top bar"></div>
                    <div class="org-info">
                        <div class="org-name">${esc(org.id)}${aliasInfo}</div>
                        <div class="org-meta">${esc(org.description || org.type || '')}</div>
                        <div class="org-badges">${badges.join('')}</div>
                    </div>
                    <span class="org-label${typeClass}">${esc(label)}</span>
                </div>`;
        },

        config: (org, details) => {
            if (!details) {
                return '<div class="config-empty">Loading configuration...</div>';
            }

            const hasSections = details.hasSections;
            const hasTetraToml = details.hasTetraToml;
            const nhSource = details.nhSource;

            // Build status section
            let statusHtml = `
                <div class="config-section">
                    <div class="config-section-title">Configuration Status</div>
                    <div class="config-status-grid">
                        <div class="config-status-item ${hasTetraToml ? 'ok' : 'missing'}">
                            <span class="config-status-icon">${hasTetraToml ? '&#10003;' : '&#10007;'}</span>
                            <span>tetra.toml</span>
                        </div>
                        <div class="config-status-item ${hasSections ? 'ok' : 'missing'}">
                            <span class="config-status-icon">${hasSections ? '&#10003;' : '&#10007;'}</span>
                            <span>sections/</span>
                        </div>
                        <div class="config-status-item ${nhSource ? 'ok' : 'na'}">
                            <span class="config-status-icon">${nhSource ? '&#10003;' : '-'}</span>
                            <span>NodeHolder</span>
                        </div>
                    </div>
                </div>
            `;

            // Sections list if available
            let sectionsHtml = '';
            if (details.sections && details.sections.length > 0) {
                const sectionItems = details.sections.map(s =>
                    `<div class="config-section-file">${esc(s)}</div>`
                ).join('');
                sectionsHtml = `
                    <div class="config-section">
                        <div class="config-section-title">TOML Sections</div>
                        <div class="config-sections-list">${sectionItems}</div>
                        <div class="config-hint">Assembled into tetra.toml via <code>org build</code></div>
                    </div>
                `;
            }

            // NodeHolder integration
            let nhHtml = `
                <div class="config-section">
                    <div class="config-section-title">NodeHolder Integration</div>
                    <p class="config-desc">Import infrastructure from DigitalOcean via NodeHolder.</p>
                    <div class="config-workflow">
                        <div class="workflow-step">
                            <div class="workflow-num">1</div>
                            <div class="workflow-content">
                                <div class="workflow-title">Fetch Infrastructure</div>
                                <div class="workflow-cmd">nh fetch ${esc(org)}</div>
                                <div class="workflow-hint">Creates ~/nh/${esc(org)}/digocean.json</div>
                            </div>
                        </div>
                        <div class="workflow-step">
                            <div class="workflow-num">2</div>
                            <div class="workflow-content">
                                <div class="workflow-title">Import to Tetra</div>
                                <div class="workflow-cmd">org import nh ${esc(org)}</div>
                                <div class="workflow-hint">Creates sections/10-infrastructure.toml</div>
                            </div>
                        </div>
                        <div class="workflow-step">
                            <div class="workflow-num">3</div>
                            <div class="workflow-content">
                                <div class="workflow-title">Build Config</div>
                                <div class="workflow-cmd">org build ${esc(org)}</div>
                                <div class="workflow-hint">Assembles sections/*.toml into tetra.toml</div>
                            </div>
                        </div>
                    </div>
                    ${nhSource ? `<div class="config-nh-status ok">Last imported from: ${esc(nhSource)}</div>` : ''}
                </div>
            `;

            // Quick actions
            let actionsHtml = `
                <div class="config-section">
                    <div class="config-section-title">Quick Actions</div>
                    <div class="config-actions">
                        <button class="config-btn" data-action="run-cmd" data-cmd="org switch ${esc(org)}">
                            Switch to ${esc(org)}
                        </button>
                        <button class="config-btn" data-action="run-cmd" data-cmd="org status">
                            Show Status
                        </button>
                        <button class="config-btn secondary" data-action="run-cmd" data-cmd="org build ${esc(org)}">
                            Rebuild tetra.toml
                        </button>
                    </div>
                </div>
            `;

            // File paths
            let pathsHtml = `
                <div class="config-section">
                    <div class="config-section-title">Paths</div>
                    <div class="config-paths">
                        <div class="config-path-row">
                            <span class="config-path-label">Org Dir:</span>
                            <span class="config-path-value">$TETRA_DIR/orgs/${esc(org)}/</span>
                        </div>
                        <div class="config-path-row">
                            <span class="config-path-label">Config:</span>
                            <span class="config-path-value">tetra.toml</span>
                        </div>
                        <div class="config-path-row">
                            <span class="config-path-label">NH Source:</span>
                            <span class="config-path-value">~/nh/${esc(org)}/digocean.json</span>
                        </div>
                    </div>
                </div>
            `;

            return `
                <div class="config-header">
                    <span class="config-title">${esc(org)}</span>
                    <span class="config-type">${esc(details.type || 'unknown')}</span>
                </div>
                ${statusHtml}
                ${sectionsHtml}
                ${nhHtml}
                ${actionsHtml}
                ${pathsHtml}
            `;
        },

        workspace: (org, files) => {
            if (!files || files.length === 0) {
                return '<div class="workspace-empty">No workspace content for this org</div>';
            }

            const fileItems = files.map(f => `
                <div class="workspace-file" data-file="${esc(f.path)}">
                    <span class="workspace-file-icon">&#128196;</span>
                    <span class="workspace-file-name">${esc(f.name)}</span>
                    <span class="workspace-file-action" data-action="open">open</span>
                </div>
            `).join('');

            return `
                <div class="workspace-header">
                    <span class="workspace-title">${esc(org)} workspace</span>
                </div>
                <div class="workspace-files">${fileItems}</div>`;
        },

        loading: () => '<div class="loading">Loading organizations...</div>',
        workspaceLoading: () => '<div class="workspace-empty">Loading workspace...</div>'
    };

    // Load orgs from API or Terrain.Orgs defaults
    async function loadOrgs() {
        const container = dom.orgList();
        if (!container) return;

        container.innerHTML = html.loading();

        Terrain.Orgs.init();
        const loaded = await Terrain.Orgs.loadFromApi();

        if (!loaded) {
            console.warn('[Orgs] API unavailable, using defaults');
        }

        renderOrgs();
    }

    // Render org list
    function renderOrgs() {
        const container = dom.orgList();
        if (!container) return;

        const orgs = Terrain.Orgs.all();
        container.innerHTML = orgs.map(org => {
            const isEnabled = Terrain.Orgs.isEnabled(org.id);
            const isSelected = selectedOrg === org.id;
            return html.orgItem(org, isEnabled, isSelected);
        }).join('');
    }

    // Load org details/config
    async function loadOrgConfig(orgId) {
        const container = dom.config();
        if (!container) return;

        container.innerHTML = html.config(orgId, null);

        try {
            const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}`);
            if (resp.ok) {
                const data = await resp.json();

                // Enhance with sections info
                const details = {
                    ...data,
                    hasSections: data.subdirectories && data.subdirectories.includes('sections'),
                    hasTetraToml: true, // API returns 404 if org doesn't exist
                    nhSource: data.nh_source || null,
                    sections: []
                };

                // Try to get sections list
                if (details.hasSections) {
                    try {
                        const sectResp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/file/sections`);
                        if (sectResp.ok) {
                            const sectData = await sectResp.json();
                            details.sections = sectData.files
                                .filter(f => f.name.endsWith('.toml'))
                                .map(f => f.name)
                                .sort();
                        }
                    } catch (e) {
                        // Ignore
                    }
                }

                orgDetailsCache.set(orgId, details);
                container.innerHTML = html.config(orgId, details);
            } else {
                container.innerHTML = '<div class="config-empty">Failed to load org config</div>';
            }
        } catch (e) {
            console.warn('[Orgs] Failed to fetch config:', e.message);
            container.innerHTML = '<div class="config-empty">Failed to load org config</div>';
        }
    }

    // Select org and show config
    function selectOrg(orgId) {
        selectedOrg = orgId;
        renderOrgs();

        // Get currently active tab
        const activeTab = document.querySelector('.infra-tab.active');
        const currentTab = activeTab ? activeTab.dataset.tab : 'list';

        // If on list tab, switch to config tab
        if (currentTab === 'list') {
            document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('[data-tab="config"]').classList.add('active');
            document.getElementById('tab-config').classList.add('active');
            loadOrgConfig(orgId);
        } else if (currentTab === 'config') {
            loadOrgConfig(orgId);
        } else if (currentTab === 'workspace') {
            loadWorkspace(orgId);
        }
    }

    // Load workspace files
    async function loadWorkspace(orgId) {
        const container = dom.workspace();
        if (!container) return;

        container.innerHTML = html.workspaceLoading();

        try {
            const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/workspace`);
            if (resp.ok) {
                const data = await resp.json();
                container.innerHTML = html.workspace(orgId, data.files || []);
                return;
            }
        } catch (e) {
            console.warn('[Orgs] Failed to fetch workspace:', e.message);
        }

        container.innerHTML = html.workspace(orgId, []);
    }

    // Open workspace file in new tab
    function openWorkspaceFile(orgId, filePath) {
        const url = `/api/orgs/${encodeURIComponent(orgId)}/file/${encodeURIComponent(filePath)}`;
        window.open(url, '_blank');
    }

    // Copy command to clipboard
    function copyCmd(cmd) {
        navigator.clipboard.writeText(cmd).then(() => {
            // Brief visual feedback
            const btn = document.querySelector(`[data-cmd="${cmd}"]`);
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = orig, 1000);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    // Tab switching
    function initTabs() {
        document.querySelectorAll('.infra-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

                // Load content for tab if org is selected
                if (selectedOrg) {
                    if (tab.dataset.tab === 'config') {
                        loadOrgConfig(selectedOrg);
                    } else if (tab.dataset.tab === 'workspace') {
                        loadWorkspace(selectedOrg);
                    }
                }
            });
        });
    }

    // Event delegation
    function initEvents() {
        const orgListEl = dom.orgList();
        if (orgListEl) {
            orgListEl.addEventListener('click', e => {
                const toggle = e.target.closest('.org-toggle');
                if (toggle) {
                    e.stopPropagation();
                    Terrain.Orgs.toggle(toggle.dataset.org);
                    renderOrgs();
                    return;
                }

                const item = e.target.closest('.org-item');
                if (item) {
                    selectOrg(item.dataset.org);
                }
            });
        }

        const workspaceEl = dom.workspace();
        if (workspaceEl) {
            workspaceEl.addEventListener('click', e => {
                const action = e.target.closest('[data-action="open"]');
                if (action) {
                    const fileEl = e.target.closest('.workspace-file');
                    if (fileEl && selectedOrg) {
                        openWorkspaceFile(selectedOrg, fileEl.dataset.file);
                    }
                }
            });
        }

        // Config action buttons
        document.addEventListener('click', e => {
            const btn = e.target.closest('[data-action="run-cmd"]');
            if (btn && btn.dataset.cmd) {
                copyCmd(btn.dataset.cmd);
            }
        });

        const refreshBtn = document.querySelector('[data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadOrgs);
        }
    }

    function init() {
        initTabs();
        initEvents();
        loadOrgs();
    }

    return { init, loadOrgs, renderOrgs, selectOrg };
})();

document.addEventListener('DOMContentLoaded', OrgsPanel.init);
