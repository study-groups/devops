/**
 * PDataPanel.js - PData debugging panel for the debug package
 * Features: Authentication, session debug, API explorer, and more
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { apiSlice } from '/client/store/apiSlice.js';

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
        this.render();
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
            contentEl.innerHTML = `<div class="pdata-error">Error: ${err.message}</div>`;
        }
    }

    renderContent(data) {
        const contentEl = this.element.querySelector('.panel-content');
        contentEl.innerHTML = `
            <div class="pdata-section">
                <h4>User</h4>
                <pre>${JSON.stringify(data.user, null, 2)}</pre>
            </div>
            <div class="pdata-section">
                <h4>Capabilities</h4>
                <pre>${JSON.stringify(data.capabilities, null, 2)}</pre>
            </div>
            <div class="pdata-section">
                <h4>Mounts</h4>
                <pre>${JSON.stringify(data.mounts, null, 2)}</pre>
            </div>
        `;
    }
}