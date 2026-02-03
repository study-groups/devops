// Orgs Panel - State & Configuration
// Centralized state, config, and DOM cache

const CONFIG = {
    storageKey: 'orgs-selected'
};

const state = {
    selectedOrg: null,
    editingSection: null,
    orgDetailsCache: new Map()
};

// DOM element cache
const dom = {
    orgList: () => document.getElementById('org-list'),
    orgsCount: () => document.getElementById('orgs-count'),
    workspace: () => document.getElementById('org-workspace'),
    config: () => document.getElementById('org-config'),
    infra: () => document.getElementById('org-infra')
};

// Escape HTML helper
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
