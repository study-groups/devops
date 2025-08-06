/**
 * PDataPanel.js - PData debugging panel for the debug package
 * Features: Authentication, session debug, API explorer, and more
 */

export class PDataPanel {
    constructor(options = {}) {
        this.id = 'pdata-panel';
        this.title = '🔍 PData Panel';
        this.container = null;
        this.subPanelStates = {
            'auth-subpanel': { isCollapsed: false },
            'session-subpanel': { isCollapsed: false },
            'api-explorer-subpanel': { isCollapsed: false },
            'timing-subpanel': { isCollapsed: true },
            'introspection-subpanel': { isCollapsed: true },
            'verification-subpanel': { isCollapsed: true },
            'info-subpanel': { isCollapsed: false },
            'userdata-subpanel': { isCollapsed: true },
            'lcl-query-subpanel': { isCollapsed: false }
        };
        this.verifiedUser = null;
    }

    mount(container) {
        this.container = container;
        this.render();
        this.attachEventListeners();
    }

    render() {
        if (!this.container) return;

        const authState = window.APP?.store?.getState()?.auth || {};
        const isAdmin = authState.user?.role === 'admin';

        this.container.innerHTML = `
            <div class="pdata-explorer">
                ${this.renderSubPanel('auth-subpanel', '📁 Authentication', this.renderAuthContent())}
                ${this.renderSubPanel('session-subpanel', '🍪 Session Debug', this.renderSessionContent())}
                ${this.renderSubPanel('verification-subpanel', '👤 User Verification', this.renderVerificationContent())}
                ${isAdmin ? this.renderSubPanel('api-explorer-subpanel', '🌐 API Explorer', this.renderApiContent()) : ''}
                ${this.renderSubPanel('timing-subpanel', '⏱️ Request Timing', this.renderTimingContent())}
                ${this.renderSubPanel('introspection-subpanel', '🔍 Response Introspection', this.renderIntrospectionContent())}
                ${this.renderSubPanel('info-subpanel', 'ℹ️ PData Info', this.renderInfoContent())}
                ${isAdmin ? this.renderSubPanel('userdata-subpanel', '👥 User Data', this.renderUserDataContent()) : ''}
                ${this.renderSubPanel('lcl-query-subpanel', '🔎 LCL Query', this.renderLclQueryContent())}
            </div>
        `;
    }

    renderSubPanel(subPanelId, title, content) {
        const isCollapsed = this.subPanelStates[subPanelId]?.isCollapsed || false;
        const toggleIcon = isCollapsed ? '▶' : '▼';
        const contentDisplay = isCollapsed ? 'none' : 'block';
        
        return `
            <div class="pdata-sub-panel" data-sub-panel-id="${subPanelId}">
                <div class="pdata-sub-panel-header" data-toggle="${subPanelId}">
                    <span class="toggle-icon">${toggleIcon}</span>
                    <span class="title">${title}</span>
                </div>
                <div class="pdata-sub-panel-content" style="display: ${contentDisplay};">
                    ${content}
                </div>
            </div>
        `;
    }

    renderAuthContent() {
        const authState = window.APP?.store?.getState()?.auth || {};
        return `
            <div class="auth-info">
                <p><strong>Status:</strong> ${authState.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</p>
                <p><strong>User:</strong> ${authState.user?.username || 'N/A'}</p>
                <p><strong>Role:</strong> ${authState.user?.role || 'N/A'}</p>
                <p><strong>User ID:</strong> ${authState.user?.userId || 'N/A'}</p>
            </div>
        `;
    }

    renderSessionContent() {
        return `
            <div class="session-debug">
                <button id="test-session-btn" class="debug-btn">Test Session</button>
                <div id="session-results" class="debug-results"></div>
            </div>
        `;
    }

    renderVerificationContent() {
        return `
            <div class="verification-panel">
                <input type="text" id="verify-user-input" placeholder="Enter username to verify" />
                <button id="verify-user-btn" class="debug-btn">Verify User</button>
                <div id="verification-results" class="debug-results"></div>
            </div>
        `;
    }

    renderApiContent() {
        return `
            <div class="api-explorer">
                <select id="api-endpoint-select" class="debug-select">
                    <option value="/api/test">GET /api/test</option>
                    <option value="/api/user/profile">GET /api/user/profile</option>
                    <option value="/api/files">GET /api/files</option>
                    <option value="/api/auth/check">GET /api/auth/check</option>
                </select>
                <button id="test-api-btn" class="debug-btn">Test API</button>
                <div id="api-results" class="debug-results"></div>
            </div>
        `;
    }

    renderTimingContent() {
        return `
            <div class="timing-panel">
                <button id="clear-timing-btn" class="debug-btn">Clear Timing Data</button>
                <div id="timing-results" class="debug-results">No timing data available</div>
            </div>
        `;
    }

    renderIntrospectionContent() {
        return `
            <div class="introspection-panel">
                <button id="introspect-state-btn" class="debug-btn">Introspect Current State</button>
                <div id="introspection-results" class="debug-results"></div>
            </div>
        `;
    }

    renderInfoContent() {
        return `
            <div class="info-panel">
                <p><strong>PData Version:</strong> 1.0.0</p>
                <p><strong>API Base:</strong> ${window.location.origin}/api</p>
                <p><strong>Environment:</strong> ${window.APP?.environment || 'development'}</p>
            </div>
        `;
    }

    renderUserDataContent() {
        return `
            <div class="userdata-panel">
                <button id="fetch-all-users-btn" class="debug-btn">Fetch All Users</button>
                <div id="userdata-results" class="debug-results"></div>
            </div>
        `;
    }

    renderLclQueryContent() {
        return `
            <div class="lcl-query-panel">
                <textarea id="lcl-query-input" placeholder="Enter LCL query..." rows="3"></textarea>
                <button id="execute-lcl-btn" class="debug-btn">Execute Query</button>
                <div id="lcl-results" class="debug-results"></div>
            </div>
        `;
    }

    attachEventListeners() {
        if (!this.container) return;

        // Sub-panel toggle listeners
        this.container.addEventListener('click', (e) => {
            if (e.target.closest('.pdata-sub-panel-header[data-toggle]')) {
                const subPanelId = e.target.closest('.pdata-sub-panel-header').dataset.toggle;
                this.toggleSubPanel(subPanelId);
            }
        });

        // Button listeners
        this.setupButtonListeners();
    }

    setupButtonListeners() {
        const buttons = [
            { id: 'test-session-btn', handler: () => this.testSession() },
            { id: 'verify-user-btn', handler: () => this.verifyUser() },
            { id: 'test-api-btn', handler: () => this.testApi() },
            { id: 'clear-timing-btn', handler: () => this.clearTiming() },
            { id: 'introspect-state-btn', handler: () => this.introspectState() },
            { id: 'fetch-all-users-btn', handler: () => this.fetchAllUsers() },
            { id: 'execute-lcl-btn', handler: () => this.executeLclQuery() }
        ];

        buttons.forEach(({ id, handler }) => {
            const btn = this.container.querySelector(`#${id}`);
            if (btn) {
                btn.addEventListener('click', handler);
            }
        });
    }

    toggleSubPanel(subPanelId) {
        if (!this.subPanelStates[subPanelId]) return;

        this.subPanelStates[subPanelId].isCollapsed = !this.subPanelStates[subPanelId].isCollapsed;
        this.render();
        this.attachEventListeners();
    }

    // Event handlers for various debug functions
    async testSession() {
        const resultsEl = this.container.querySelector('#session-results');
        resultsEl.innerHTML = 'Testing session...';
        
        try {
            const response = await fetch('/api/auth/check', { credentials: 'include' });
            const data = await response.json();
            resultsEl.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        } catch (error) {
            resultsEl.innerHTML = `Error: ${error.message}`;
        }
    }

    async verifyUser() {
        const input = this.container.querySelector('#verify-user-input');
        const resultsEl = this.container.querySelector('#verification-results');
        const username = input.value.trim();
        
        if (!username) {
            resultsEl.innerHTML = 'Please enter a username';
            return;
        }

        resultsEl.innerHTML = 'Verifying user...';
        
        try {
            const response = await fetch(`/api/user/verify/${username}`, { credentials: 'include' });
            const data = await response.json();
            resultsEl.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        } catch (error) {
            resultsEl.innerHTML = `Error: ${error.message}`;
        }
    }

    async testApi() {
        const select = this.container.querySelector('#api-endpoint-select');
        const resultsEl = this.container.querySelector('#api-results');
        const endpoint = select.value;
        
        resultsEl.innerHTML = `Testing ${endpoint}...`;
        
        try {
            const response = await fetch(endpoint, { credentials: 'include' });
            const data = await response.json();
            resultsEl.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        } catch (error) {
            resultsEl.innerHTML = `Error: ${error.message}`;
        }
    }

    clearTiming() {
        const resultsEl = this.container.querySelector('#timing-results');
        resultsEl.innerHTML = 'Timing data cleared';
    }

    introspectState() {
        const resultsEl = this.container.querySelector('#introspection-results');
        const state = window.APP?.store?.getState() || {};
        resultsEl.innerHTML = `<pre>${JSON.stringify(state, null, 2)}</pre>`;
    }

    async fetchAllUsers() {
        const resultsEl = this.container.querySelector('#userdata-results');
        resultsEl.innerHTML = 'Fetching users...';
        
        try {
            const response = await fetch('/api/users', { credentials: 'include' });
            const data = await response.json();
            resultsEl.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        } catch (error) {
            resultsEl.innerHTML = `Error: ${error.message}`;
        }
    }

    executeLclQuery() {
        const textarea = this.container.querySelector('#lcl-query-input');
        const resultsEl = this.container.querySelector('#lcl-results');
        const query = textarea.value.trim();
        
        if (!query) {
            resultsEl.innerHTML = 'Please enter a query';
            return;
        }

        resultsEl.innerHTML = `Executing: ${query}`;
        // LCL query execution would go here
    }

    destroy() {
        this.container = null;
    }
}