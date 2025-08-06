// client/settings/panels/context/ContextManagerPanel.js
import { BasePanel } from '/client/panels/BasePanel.js';

export class MountInfoPanel extends BasePanel {
    constructor(panelId, store, options = {}) {
        super({
            id: panelId,
            title: 'Context Inspector',
            width: 400,
            ...options
        });
        this.store = store;
        this.mountInfo = null;
    }

    async onMount() {
        super.onMount();
        console.log('[MountInfoPanel] onMount called, contentElement:', this.contentElement);
        await this.fetchMountInfo();
        const content = this.renderContent();
        console.log('[MountInfoPanel] Setting content:', content);
        this.contentElement.innerHTML = content;
        this.attachEventListeners();
    }

    isAdmin() {
        const state = this.store.getState();
        return state.auth?.user?.role === 'admin';
    }

    async fetchMountInfo() {
        try {
            const response = await window.APP.services.globalFetch('/api/pdata/mount-info', {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }
            this.mountInfo = await response.json();
        } catch (error) {
            console.error('[MountInfoPanel] Failed to fetch mount info:', error);
            this.mountInfo = { error: error.message };
        }
    }

    renderContent() {
        if (!this.mountInfo) {
            return `<div class="pdata-info-loading">Loading context info...</div>`;
        }
        if (this.mountInfo.error) {
            return `<div class="error-message"><h3>Error</h3><p>${this.mountInfo.error}</p></div>`;
        }

        const state = this.store.getState();
        const user = state.auth?.user;

        const userContent = this.renderUserContext(user, this.mountInfo);
        const adminContent = this.isAdmin() ? this.renderAdminContent(this.mountInfo) : '';

        return `
            <div class="settings-section-container">
                ${userContent}
                ${adminContent}
            </div>`;
    }

    renderUserContext(user, mountInfo) {
        const role = user?.role || 'guest';
        const roleMounts = mountInfo?.mountPolicies?.[role] || [];
        
        return `
            <div class="settings-section">
                <h4>User Context</h4>
                <p>Hello, <strong>${user?.username || 'Guest'}</strong>. Your role is <strong>${role}</strong>.</p>
                <p>The following mount points are available to you at the root level:</p>
                <div class="policy-mounts">
                    ${roleMounts.length > 0 ? roleMounts.map(mount => `<span class="mount-tag">${mount}</span>`).join('') : '<em>No mounts assigned to your role.</em>'}
                </div>
            </div>
        `;
    }
    
    renderAdminContent(mountInfo) {
         return `
            <hr>
            <div class="settings-section">
                <h4>System Mounts (${mountInfo?.totalMounts || 0})</h4>
                <p>Select a mount point to navigate. This is the admin's root view.</p>
                <div class="mount-points-table">
                    <div class="mount-points-header">
                        <div class="mount-point-name">Mount Name</div>
                        <div class="mount-point-path">Filesystem Path</div>
                    </div>
                    ${this.renderMounts(mountInfo?.systemMounts)}
                </div>
            </div>
            <div class="settings-section">
                <h4>Mount Policies</h4>
                <p>Defines which roles see which mounts at the root level.</p>
                ${this.renderPolicies(mountInfo?.mountPolicies)}
            </div>`;
    }

    renderMounts(systemMounts) {
        if (!systemMounts || Object.keys(systemMounts).length === 0) return '<p>No system mounts.</p>';
        return Object.entries(systemMounts).map(([name, path]) => `
            <div class="mount-point-row clickable" data-mount-name="${name}">
                <div class="mount-point-name"><strong>${name}</strong></div>
                <div class="mount-point-path"><code>${path}</code></div>
            </div>
        `).join('');
    }

    renderPolicies(policies) {
        if (!policies || Object.keys(policies).length === 0) return '<p>No policies defined.</p>';
        return Object.entries(policies).map(([role, mounts]) => `
            <div class="policy-item">
                <h5>Role: <strong>${role}</strong></h5>
                <div class="policy-mounts">
                    ${mounts.length > 0 ? mounts.map(mount => `<span class="mount-tag">${mount}</span>`).join('') : '<em>No mounts.</em>'}
                </div>
            </div>
        `).join('');
    }

    attachEventListeners() {
        this.contentElement.querySelectorAll('.mount-point-row.clickable').forEach(row => {
            row.addEventListener('click', (e) => {
                const mountName = e.currentTarget.dataset.mountName;
                if (mountName) {
                    window.APP.eventBus.emit('navigate:pathname', { pathname: mountName, isDirectory: true });
                }
            });
        });
    }
}