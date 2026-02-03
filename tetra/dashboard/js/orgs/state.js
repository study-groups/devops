// Orgs Panel - State & Configuration
// Centralized state using TetraUI.Store

const CONFIG = {
    storageKey: 'orgs-selected'
};

// Use TetraUI.Store if available, otherwise simple object
const state = (function() {
    if (window.TetraUI && TetraUI.Store) {
        return TetraUI.Store.create({
            selectedOrg: null,
            editingSection: null,
            activeTab: 'list',
            loading: false
        }, {
            selectOrg: (s, id) => ({ ...s, selectedOrg: id, editingSection: null }),
            setTab: (s, tab) => ({ ...s, activeTab: tab }),
            editSection: (s, name) => ({ ...s, editingSection: name }),
            closeEditor: (s) => ({ ...s, editingSection: null }),
            setLoading: (s, v) => ({ ...s, loading: v })
        });
    }
    // Fallback for non-TetraUI usage
    return {
        _state: { selectedOrg: null, editingSection: null, activeTab: 'list', loading: false },
        getState() { return { ...this._state }; },
        dispatch(action, payload) {
            if (action === 'selectOrg') this._state.selectedOrg = payload;
            else if (action === 'setTab') this._state.activeTab = payload;
            else if (action === 'editSection') this._state.editingSection = payload;
            else if (action === 'closeEditor') this._state.editingSection = null;
        },
        subscribe() { return () => {}; }
    };
})();

// Convenience getters
const getSelectedOrg = () => state.getState().selectedOrg;
const getActiveTab = () => state.getState().activeTab;
const getEditingSection = () => state.getState().editingSection;

// Org details cache (separate from reactive state)
const orgDetailsCache = new Map();

// DOM element cache
const dom = {
    orgList: () => document.getElementById('org-list'),
    orgsCount: () => document.getElementById('orgs-count'),
    workspace: () => document.getElementById('org-workspace'),
    config: () => document.getElementById('org-config'),
    infra: () => document.getElementById('org-infra')
};

// Use TetraUI.dom.esc if available, otherwise local
const esc = (window.TetraUI && TetraUI.dom) ? TetraUI.dom.esc : function(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};
