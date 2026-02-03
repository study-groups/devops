// Orgs Panel - Init & Events
// Main entry point, tab switching, event delegation

function selectOrg(orgId) {
    state.selectedOrg = orgId;
    renderOrgs();

    const activeTab = document.querySelector('.infra-tab.active');
    const currentTab = activeTab ? activeTab.dataset.tab : 'list';

    if (currentTab === 'list') {
        document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="config"]').classList.add('active');
        document.getElementById('tab-config').classList.add('active');
        loadOrgConfig(orgId);
    } else if (currentTab === 'config') {
        loadOrgConfig(orgId);
    } else if (currentTab === 'infra') {
        loadOrgConfig(orgId).then(() => loadInfra(orgId));
    } else if (currentTab === 'workspace') {
        loadWorkspace(orgId);
    }
}

function initTabs() {
    document.querySelectorAll('.infra-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

            if (state.selectedOrg) {
                if (tab.dataset.tab === 'config') {
                    loadOrgConfig(state.selectedOrg);
                } else if (tab.dataset.tab === 'infra') {
                    loadOrgConfig(state.selectedOrg).then(() => loadInfra(state.selectedOrg));
                } else if (tab.dataset.tab === 'workspace') {
                    loadWorkspace(state.selectedOrg);
                }
            }
        });
    });
}

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
                if (fileEl && state.selectedOrg) {
                    openWorkspaceFile(state.selectedOrg, fileEl.dataset.file);
                }
            }
        });
    }

    document.addEventListener('click', e => {
        const copyBtn = e.target.closest('[data-action="copy-cmd"]');
        if (copyBtn && copyBtn.dataset.cmd) {
            copyCmd(copyBtn.dataset.cmd);
            return;
        }

        const workflowCmd = e.target.closest('.workflow-cmd');
        if (workflowCmd) {
            const cmd = workflowCmd.textContent.trim();
            navigator.clipboard.writeText(cmd);
            workflowCmd.style.borderColor = 'var(--three)';
            setTimeout(() => { workflowCmd.style.borderColor = ''; }, 500);
            return;
        }

        const sectionFile = e.target.closest('.config-section-file');
        if (sectionFile && state.selectedOrg) {
            loadSection(state.selectedOrg, sectionFile.dataset.section);
            return;
        }

        const saveBtn = e.target.closest('[data-action="save-section"]');
        if (saveBtn && state.selectedOrg) {
            saveSection(state.selectedOrg);
            return;
        }

        const closeBtn = e.target.closest('[data-action="close-editor"]');
        if (closeBtn) {
            closeEditor();
            return;
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

// Public API
const OrgsPanel = { init, loadOrgs, renderOrgs, selectOrg };

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
