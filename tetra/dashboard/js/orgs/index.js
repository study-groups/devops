// Orgs Panel - Init & Events
// Main entry point, tab switching, event delegation

function selectOrg(orgId) {
    state.dispatch('selectOrg', orgId);
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

            if (getSelectedOrg()) {
                if (tab.dataset.tab === 'config') {
                    loadOrgConfig(getSelectedOrg());
                } else if (tab.dataset.tab === 'infra') {
                    loadOrgConfig(getSelectedOrg()).then(() => loadInfra(getSelectedOrg()));
                } else if (tab.dataset.tab === 'workspace') {
                    loadWorkspace(getSelectedOrg());
                }
            }
        });
    });
}

function initEvents() {
    const orgListEl = dom.orgList();
    if (orgListEl) {
        orgListEl.addEventListener('click', e => {
            // Add org button
            const addBtn = e.target.closest('[data-action="add-org"]');
            if (addBtn) {
                e.stopPropagation();
                showAddOrgForm();
                return;
            }

            // Edit registry button (gear)
            const editRegistryBtn = e.target.closest('[data-action="edit-registry"]');
            if (editRegistryBtn) {
                e.stopPropagation();
                // For now, just open the first org's edit form as a placeholder
                // Could later show a full registry editor
                return;
            }

            // Clone org button
            const cloneBtn = e.target.closest('[data-action="clone-org"]');
            if (cloneBtn) {
                e.stopPropagation();
                cloneOrg(cloneBtn.dataset.org);
                return;
            }

            // Edit org button
            const editBtn = e.target.closest('[data-action="edit-org"]');
            if (editBtn) {
                e.stopPropagation();
                showEditOrgForm(editBtn.dataset.org);
                return;
            }

            // Toggle (only for cloned orgs)
            const toggle = e.target.closest('.org-toggle');
            if (toggle && !toggle.classList.contains('disabled')) {
                e.stopPropagation();
                Terrain.Orgs.toggle(toggle.dataset.org);
                renderOrgs();
                return;
            }

            // Select org (only for cloned orgs)
            const item = e.target.closest('.org-item');
            if (item && item.dataset.cloned === 'true') {
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
                if (fileEl && getSelectedOrg()) {
                    openWorkspaceFile(getSelectedOrg(), fileEl.dataset.file);
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
        if (sectionFile && getSelectedOrg()) {
            loadSection(getSelectedOrg(), sectionFile.dataset.section);
            return;
        }

        const saveBtn = e.target.closest('[data-action="save-section"]');
        if (saveBtn && getSelectedOrg()) {
            saveSection(getSelectedOrg());
            return;
        }

        const closeBtn = e.target.closest('[data-action="close-editor"]');
        if (closeBtn) {
            closeEditor();
            return;
        }

        const nhImportBtn = e.target.closest('[data-action="nh-import"]');
        if (nhImportBtn) {
            const org = nhImportBtn.dataset.org;
            if (org) importNhInfra(org);
            return;
        }

        const cmdRow = e.target.closest('.cmd-row');
        if (cmdRow && cmdRow.dataset.cmd) {
            navigator.clipboard.writeText(cmdRow.dataset.cmd);
            const copied = cmdRow.querySelector('.cmd-copied');
            if (copied) {
                copied.textContent = 'Copied!';
                setTimeout(() => { copied.textContent = ''; }, 1500);
            }
            return;
        }
    });

    const refreshBtn = document.querySelector('[data-action="refresh"]');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadOrgs);
    }
}

function handleMessage(msg) {
    if (msg.type === 'env-change' || msg.type === 'org-change') {
        // Reload orgs to update active indicator
        loadOrgs();
    }
}

function init() {
    initTabs();
    initEvents();
    loadOrgs();

    // Listen for org changes from parent
    if (window.Terrain?.Iframe) {
        Terrain.Iframe.init({
            name: 'orgs',
            onMessage: handleMessage
        });
    }
}

// Public API
const OrgsPanel = { init, loadOrgs, renderOrgs, selectOrg };

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
