/**
 * PDataPanel.js - PData debugging panel for the debug package
 * Features: Authentication, session debug, API explorer, and more
 */

import { BasePanel } from '/panels/BasePanel.js';
import { apiSlice } from '/store/apiSlice.js';

// Extend the apiSlice to include our new endpoint
const extendedApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getPDataDebugInfo: builder.query({
            query: () => '/pdata/debug-info',
        }),
    }),
    overrideExisting: false,
});

const { useGetPDataDebugInfoQuery } = extendedApi;

export class PDataPanel extends BasePanel {
    constructor(options) {
        super(options);
        this.title = 'PData Inspector';
        this.id = 'pdata-panel';
        // Don't render immediately - wait for proper mounting
    }

    render() {
        // Create element if it doesn't exist
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'pdata-panel';
            this.element.innerHTML = '<div class="panel-content">Loading PData debug info...</div>';
        }
        return this.element;
    }

    onMount(container) {
        super.onMount(container);
        this.render();
        container.appendChild(this.element);
    }

    render() {
        super.render(); // Creates this.element
        this.element.innerHTML = `
            <div class="panel-header">
                <h3>PData Inspector</h3>
            </div>
            <div class="panel-content">
                <div class="pdata-loading">Loading debug info...</div>
            </div>
        `;
        this.fetchAndRenderData();
        return this.element;
    }

    async fetchAndRenderData() {
        const contentEl = this.element.querySelector('.panel-content');
        try {
            // Use the RTK Query hook via the store
            const { data, error, isLoading } = await this.store.dispatch(extendedApi.endpoints.getPDataDebugInfo.initiate());

            if (isLoading) {
                contentEl.innerHTML = `<div class="pdata-loading">Loading...</div>`;
                return;
            }

            if (error) {
                throw new Error(error.data?.error || 'Failed to fetch PData debug info');
            }

            if (data) {
                this.renderContent(data);
            }
        } catch (err) {
            // Ensure element exists for error display
            if (!this.element) {
                this.element = document.createElement('div');
                this.element.className = 'pdata-panel';
                this.element.innerHTML = '<div class="panel-content"></div>';
            }
            
            let contentEl = this.element.querySelector('.panel-content');
            if (!contentEl) {
                contentEl = document.createElement('div');
                contentEl.className = 'panel-content';
                this.element.appendChild(contentEl);
            }
            
            contentEl.innerHTML = `<div class="pdata-error">Error: ${err.message}</div>`;
        }
    }

    renderContent(data) {
        // Ensure element exists
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'pdata-panel';
            this.element.innerHTML = '<div class="panel-content"></div>';
        }
        
        let contentEl = this.element.querySelector('.panel-content');
        if (!contentEl) {
            contentEl = document.createElement('div');
            contentEl.className = 'panel-content';
            this.element.appendChild(contentEl);
        }
        
        // Handle case where data is null/undefined
        if (!data) {
            contentEl.innerHTML = `<div class="pdata-error">No data available</div>`;
            return;
        }
        
        contentEl.innerHTML = `
            <div class="pdata-section">
                <h4>User</h4>
                <pre>${JSON.stringify(data.user || 'No user data', null, 2)}</pre>
            </div>
            <div class="pdata-section">
                <h4>Capabilities</h4>
                <pre>${JSON.stringify(data.capabilities || 'No capabilities data', null, 2)}</pre>
            </div>
            <div class="pdata-section">
                <h4>Mounts</h4>
                <pre>${JSON.stringify(data.mounts || 'No mounts data', null, 2)}</pre>
            </div>
        `;
    }
}