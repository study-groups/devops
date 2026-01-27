// Organizations Panel Module

const OrgsPanel = (function() {
    'use strict';

    let selectedOrg = null;

    const dom = {
        orgList: () => document.getElementById('org-list'),
        workspace: () => document.getElementById('org-workspace')
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
            const repoName = org.repo ? org.repo.split('/').pop().replace('.git', '') : '';
            return `
                <div class="org-item${isSelected ? ' selected' : ''}" data-org="${esc(org.id)}">
                    <div class="org-toggle${isEnabled ? ' enabled' : ''}" data-org="${esc(org.id)}" title="Toggle visibility in top bar"></div>
                    <div class="org-info">
                        <div class="org-name">${esc(org.id)}${aliasInfo}</div>
                        <div class="org-meta">${esc(org.description || '')}</div>
                        <div class="org-repo">${repoName}${org.games ? ' + games' : ''}${org.nh_source ? ' (nh)' : ''}</div>
                    </div>
                    <span class="org-label${typeClass}">${esc(label)}</span>
                </div>`;
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

    // Select org and show workspace
    function selectOrg(orgId) {
        selectedOrg = orgId;
        renderOrgs();
        loadWorkspace(orgId);

        // Switch to workspace tab
        document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="workspace"]').classList.add('active');
        document.getElementById('tab-workspace').classList.add('active');
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

        // Fallback
        const fallbackFiles = [
            { name: 'setup-guide.html', path: 'workspace/content/setup-guide.html', type: 'html' }
        ];
        container.innerHTML = html.workspace(orgId, fallbackFiles);
    }

    // Open workspace file in new tab
    function openWorkspaceFile(orgId, filePath) {
        const url = `/api/orgs/${encodeURIComponent(orgId)}/file/${encodeURIComponent(filePath)}`;
        window.open(url, '_blank');
    }

    // Tab switching
    function initTabs() {
        document.querySelectorAll('.infra-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
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

    return { init, loadOrgs, renderOrgs };
})();

document.addEventListener('DOMContentLoaded', OrgsPanel.init);
