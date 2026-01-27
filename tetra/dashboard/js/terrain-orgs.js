/**
 * Terrain.Orgs - Shared org state management
 *
 * Opt-in module for org-aware panels. Load after terrain-iframe.js.
 *
 *   Terrain.Orgs.init()              // Load from localStorage
 *   Terrain.Orgs.all()               // All known orgs
 *   Terrain.Orgs.enabled()           // Orgs visible in top bar
 *   Terrain.Orgs.toggle(id)          // Toggle visibility
 *   Terrain.Orgs.label(id)           // Get display label
 *   Terrain.Orgs.loadFromApi()       // Fetch from server
 *   Terrain.Orgs.onChange(cb)        // Listen for changes
 *   Terrain.Orgs.buttonData()        // Data for rendering org buttons
 */

window.Terrain = window.Terrain || {};

Terrain.Orgs = {
    _STORAGE_KEY: 'tetra-console-orgs',
    _list: [],
    _enabled: [],
    _labels: {},
    _callbacks: [],
    _loaded: false,

    /**
     * Default orgs (fallback if nothing loaded)
     */
    DEFAULTS: [
        { id: 'nodeholder', label: 'NH', type: 'client', hasWorkspace: true },
        { id: 'pixeljam-arcade', label: 'PJ', type: 'client', hasWorkspace: true },
        { id: 'tetra', label: 'TETRA', type: 'system', hasWorkspace: true }
    ],

    /**
     * Initialize from localStorage
     */
    init: function() {
        if (this._loaded) return this;

        try {
            const saved = localStorage.getItem(this._STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                this._list = data.list || this.DEFAULTS;
                this._enabled = data.enabled || this._list.map(o => o.id);
                this._labels = data.labels || {};
            } else {
                this._list = this.DEFAULTS;
                this._enabled = this._list.map(o => o.id);
            }
        } catch (e) {
            console.warn('[Terrain.Orgs] Failed to load from storage:', e);
            this._list = this.DEFAULTS;
            this._enabled = this._list.map(o => o.id);
        }

        this._loaded = true;
        return this;
    },

    /**
     * Save current state to localStorage
     */
    _save: function() {
        const data = {
            list: this._list,
            enabled: this._enabled,
            labels: this._labels
        };
        localStorage.setItem(this._STORAGE_KEY, JSON.stringify(data));
    },

    /**
     * Get all orgs
     */
    all: function() {
        this.init();
        return this._list;
    },

    /**
     * Get enabled orgs (visible in top bar)
     */
    enabled: function() {
        this.init();
        return this._list.filter(o => this._enabled.includes(o.id));
    },

    /**
     * Get enabled org IDs
     */
    enabledIds: function() {
        this.init();
        return [...this._enabled];
    },

    /**
     * Check if org is enabled
     */
    isEnabled: function(orgId) {
        this.init();
        return this._enabled.includes(orgId);
    },

    /**
     * Toggle org enabled state
     */
    toggle: function(orgId) {
        this.init();
        const idx = this._enabled.indexOf(orgId);
        if (idx >= 0) {
            this._enabled.splice(idx, 1);
        } else {
            this._enabled.push(orgId);
        }
        this._save();
        this._notifyChange();
        return this.isEnabled(orgId);
    },

    /**
     * Set enabled state for an org
     */
    setEnabled: function(orgId, enabled) {
        this.init();
        const idx = this._enabled.indexOf(orgId);
        if (enabled && idx < 0) {
            this._enabled.push(orgId);
            this._save();
            this._notifyChange();
        } else if (!enabled && idx >= 0) {
            this._enabled.splice(idx, 1);
            this._save();
            this._notifyChange();
        }
    },

    /**
     * Get label for an org
     */
    label: function(orgId) {
        this.init();
        if (this._labels[orgId]) return this._labels[orgId];
        const org = this._list.find(o => o.id === orgId);
        return org?.label || orgId.substring(0, 2).toUpperCase();
    },

    /**
     * Set custom label for an org
     */
    setLabel: function(orgId, label) {
        this.init();
        this._labels[orgId] = label;
        this._save();
    },

    /**
     * Update org list from API or fallback data
     */
    setList: function(orgs) {
        this.init();
        // Skip notify if list hasn't changed
        const oldIds = this._list.map(o => o.id).sort().join(',');
        const newIds = orgs.map(o => o.id).sort().join(',');
        const changed = oldIds !== newIds;

        this._list = orgs;
        // Update labels from org data
        orgs.forEach(o => {
            if (o.label && !this._labels[o.id]) {
                this._labels[o.id] = o.label;
            }
        });
        this._save();
        if (changed) this._notifyChange();
    },

    /**
     * Load orgs from API endpoint
     */
    loadFromApi: async function(url = '/api/orgs/list') {
        try {
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                if (data.orgs) {
                    this.setList(data.orgs);
                    return true;
                }
            }
        } catch (e) {
            console.warn('[Terrain.Orgs] API fetch failed:', e.message);
        }
        return false;
    },

    /**
     * Register callback for org changes
     */
    onChange: function(callback) {
        this._callbacks.push(callback);
        return () => {
            this._callbacks = this._callbacks.filter(c => c !== callback);
        };
    },

    /**
     * Notify all callbacks of change
     */
    _notifyChange: function() {
        const enabled = this.enabled();
        this._callbacks.forEach(cb => cb(enabled));

        // Also publish to message bus if available
        if (Terrain.Bus) {
            Terrain.Bus.publish({
                type: 'orgs-changed',
                source: 'terrain',
                orgs: enabled
            });
        }
    },

    /**
     * Get org data for rendering buttons
     */
    buttonData: function() {
        return this.enabled().map(o => ({
            id: o.id,
            label: this.label(o.id),
            type: o.type || 'client'
        }));
    }
};
