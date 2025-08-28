// DEPRECATED: This PDataPanel has been moved to packages/devpages-debug/panels/PDataPanel.js
// This file is kept for reference but should not be used.

/**
 * PDataPanel.js - Beautiful Redux-integrated PData Panel
 * Features: Collapsible sub-panels, flyout mode, position persistence
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { dispatch, thunks } from '/client/appState.js';

export class PDataPanel extends BasePanel {
    constructor(panelId, store, options = {}) {
        const baseOptions = {
            id: panelId,
            title: '🔍 PData Panel XXX',
            width: 400,
            minWidth: 300,
            maxWidth: 800,
            resizable: true,
            collapsible: true,
            order: 0,
            headless: false,
            showFlyoutToggle: true,
            ...options
        };

        super(baseOptions);
        
        this.store = store;
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
        
        this.log(`PDataPanel created: ${panelId}`);
    }
    
    
    
    /**
     * Render collapsible sub-panels
     */
    renderContent() {
        const authState = this.store.getState().auth;
        const isAdmin = authState.user?.role === 'admin';

        return `
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
    
    /**
     * Render individual sub-panel with collapse/expand
     */
    renderSubPanel(subPanelId, title, content) {
        const isCollapsed = this.subPanelStates[subPanelId]?.isCollapsed || false;
        const chevron = isCollapsed ? '▶' : '▼';
        
        return `
            <div class="pdata-subpanel" data-subpanel-id="${subPanelId}">
                <div class="subpanel-header" data-subpanel-id="${subPanelId}">
                    <span class="collapse-chevron">${chevron}</span>
                    <span class="subpanel-title">${title}</span>
                </div>
                <div class="subpanel-content ${isCollapsed ? 'collapsed' : ''}">
                    ${content}
                </div>
            </div>
        `;
    }
    
    /**
     * Render authentication sub-panel content
     */
    renderAuthContent() {
        const authState = this.store.getState().auth;
        const isAuth = authState.isAuthenticated;
        
        // Debug auth state
        console.log('[PDataPanel] Auth state check:', {
            isAuthenticated: isAuth,
            authChecked: authState.authChecked,
            user: authState.user,
            session: authState.session
        });
        
        if (isAuth) {
            const user = authState.user;
            return `
                <div class="auth-status">
                    <div class="status-indicator ${isAuth ? 'connected' : 'disconnected'}">
                        <span class="status-dot"></span>
                        <span class="status-text">${isAuth ? 'Connected & Authenticated' : 'Not Authenticated'}</span>
                    </div>
                </div>
                <div class="auth-details">
                    <div class="auth-field">
                        <label>User:</label>
                        <span class="auth-value">${user?.username || 'N/A'}</span>
                    </div>
                    <div class="auth-field">
                        <label>Organization:</label>
                        <span class="auth-value">${user?.org || 'N/A'}</span>
                    </div>
                    <div class="auth-field">
                        <label>Session:</label>
                        <span class="auth-value">${isAuth ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div class="auth-field">
                        <label>Session ID:</label>
                        <span class="auth-value">${authState.session?.id?.substring(0, 10) || 'N/A'}...</span>
                    </div>
                    <div class="auth-field">
                        <label>Expires:</label>
                        <span class="auth-value">${authState.session?.expires || 'N/A'}</span>
                    </div>

                </div>
            `;
        } else {
            // User is not authenticated - show login form
            console.log('[PDataPanel] User not authenticated, showing login form');
            return this.renderLoginForm();
        }
    }

    /**
     * Render login form when not authenticated
     */
    renderLoginForm() {
        return `
            <form id="pdata-login-form" class="login-form">
                <div class="login-field">
                    <input type="text" id="pdata-username" name="username" placeholder="Username" required>
                </div>
                <div class="login-field">
                    <input type="password" id="pdata-password" name="password" placeholder="Password" required autocomplete="current-password">
                </div>
                <div class="login-actions">
                    <button type="submit" class="btn btn-primary btn-login">Login</button>
                </div>
                <div id="pdata-login-error" class="login-error"></div>
            </form>
        `;
    }

    /**
     * Render session debug sub-panel content
     */
    renderSessionContent() {
        return `
            <div class="session-debug">
                <div class="session-info">
                    <div class="session-field">
                        <label>Environment:</label>
                        <span class="session-value" id="session-env">Loading...</span>
                    </div>
                    <div class="session-field">
                        <label>Cookies:</label>
                        <span class="session-value" id="session-cookies">Loading...</span>
                    </div>
                    <div class="session-field">
                        <label>Session Store:</label>
                        <span class="session-value" id="session-store">Loading...</span>
                    </div>
                    <div class="session-field">
                        <label>Last Request:</label>
                        <span class="session-value" id="session-last-request">Never</span>
                    </div>
                </div>
                <div class="session-actions">
                    <button class="btn btn-secondary" onclick="window.APP.pdataPanel.testSessionRequest()">Test Session</button>
                    <button class="btn btn-secondary" onclick="window.APP.pdataPanel.clearSessionData()">Clear Cookies</button>
                </div>
                <div class="session-raw">
                    <label>Raw Cookie Data:</label>
                    <pre id="session-raw-data">Loading...</pre>
                </div>
            </div>
        `;
    }

    
    /**
     * Render user verification sub-panel content
     */
    renderVerificationContent() {
        if (this.verifiedUser) {
            return `
                <div class="verification-result">
                    <div class="auth-details">
                        <div class="auth-field">
                            <label>Username:</label>
                            <span class="auth-value">${this.verifiedUser.username}</span>
                        </div>
                        <div class="auth-field">
                            <label>Role:</label>
                            <span class="auth-value">${this.verifiedUser.role}</span>
                        </div>
                    </div>
                    <div class="verification-actions">
                        <button class="btn btn-secondary btn-clear-verification">Clear</button>
                    </div>
                </div>
            `;
        }

        return `
            <form id="pdata-verify-form" class="login-form">
                <div class="login-field">
                    <input type="text" id="pdata-verify-username" name="username" placeholder="Username to verify" required autocomplete="username">
                </div>
                <div class="login-field">
                    <input type="password" id="pdata-verify-password" name="password" placeholder="Password" required autocomplete="current-password">
                </div>
                <div class="login-actions">
                    <button type="submit" class="btn btn-primary btn-verify">Verify</button>
                </div>
                <div id="pdata-verify-error" class="login-error"></div>
            </form>
        `;
    }
    
    /**
     * Render API explorer sub-panel content
     */
    renderApiContent() {
        return `
            <div class="api-controls">
                <div class="control-row">
                    <label>Endpoint:</label>
                    <select class="endpoint-select">
                        <option>/api/pdata/list</option>
                        <option>/api/pdata/read</option>
                        <option>/api/pdata/write</option>
                        <option>/api/auth/status</option>
                    </select>
                </div>
                <div class="control-row">
                    <button class="btn btn-primary btn-test-api">Test API</button>
                    <button class="btn btn-secondary btn-view-logs">View Logs</button>
                </div>
            </div>
            <div class="api-response">
                <div class="response-header">
                    <span class="response-status success">200 OK</span>
                    <span class="response-time">142ms</span>
                </div>
                <div class="response-body">
                    <pre class="json-response">{"status":"success","data":{"files":23}}</pre>
                </div>
            </div>
        `;
    }
    
    /**
     * Render timing sub-panel content
     */
    renderTimingContent() {
        return `
            <div class="timing-metrics">
                <div class="metric-row">
                    <span class="metric-label">Average Response:</span>
                    <span class="metric-value">156ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Total Requests:</span>
                    <span class="metric-value">1,247</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Error Rate:</span>
                    <span class="metric-value">0.2%</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Render introspection sub-panel content
     */
    renderIntrospectionContent() {
        return `
            <div class="introspection-data">
                <div class="data-row">
                    <span class="data-label">Last Query Time:</span>
                    <span class="data-value">12ms</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Cache Hit Rate:</span>
                    <span class="data-value">94.3%</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Response Size:</span>
                    <span class="data-value">2.4KB</span>
                </div>
            </div>
        `;
    }

    renderInfoContent() {
        return `
            <div id="pdata-info-content" class="auth-details">
                <div class="pdata-info-loading">Loading PData info...</div>
            </div>
        `;
    }

    renderUserDataContent() {
        return `
            <div id="pdata-userdata-content" class="auth-details">
                <div class="pdata-userdata-loading">Loading user data...</div>
            </div>
        `;
    }

    renderLclQueryContent() {
        return `
            <div class="lcl-query-container">
                <input type="text" id="lcl-query-input" class="pdata-input" placeholder="e.g., list users">
                <button id="lcl-query-submit" class="btn btn-primary">Run</button>
                <div id="lcl-query-results" class="pdata-results"></div>
            </div>
        `;
    }



    
    /**
     * Called after panel is mounted to DOM
     */
    onMount() {
        super.onMount();
        this.loadPanelStyles();
        this.setupEventListeners();
        
        // Initialize session debugging data
        setTimeout(() => this.refreshSessionData(), 100);
        
        // Make panel accessible for session debugging buttons
        if (!window.APP) window.APP = {};
        window.APP.pdataPanel = this;
        
        const authState = this.store.getState().auth;
        if (!authState.isAuthenticated) {
            return;
        }
        this.fetchPDataInfo();
        this.fetchUserData();
        this.log('PDataPanel mounted with sub-panels');
    }
    
    async fetchUserData() {
        const authState = this.store.getState().auth;
        if (!authState.isAuthenticated) {
            return;
        }
        try {
            // This endpoint needs to be created
            const response = await fetch('/api/pdata/users/list', { credentials: 'include' }); 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const container = this.element.querySelector('#pdata-userdata-content');

            if (container && data.success) {
                let html = '<div class="user-data-grid">';
                for (const username in data.users) {
                    const roles = data.users[username].join(', ');
                    html += `
                        <div class="auth-field">
                            <label>${username}:</label>
                            <span class="auth-value">${roles}</span>
                        </div>
                    `;
                }
                html += '</div>';
                container.innerHTML = html;
            } else if(container) {
                 container.innerHTML = `<div class="login-error">${data.error || 'Failed to load user data.'}</div>`;
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
            const container = this.element.querySelector('#pdata-userdata-content');
            if (container) {
                container.innerHTML = `<div class="login-error">Failed to load user data.</div>`;
            }
        }
    }

    
    async fetchPDataInfo() {
        const authState = this.store.getState().auth;
        if (!authState.isAuthenticated) {
            const container = this.element.querySelector('#pdata-info-content');
            if (container) {
                container.innerHTML = '<div class="auth-status">Please log in to view PData information</div>';
            }
            return;
        }
        try {
            const response = await fetch('/api/auth/system', { credentials: 'include' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const container = this.element.querySelector('#pdata-info-content');
            if(container) {
                container.innerHTML = `
                                <div class="auth-field" data-tooltip="The root directory for all PData operations, defined by the PD_DIR environment variable. This is the single source of truth for the data layer's location.">
                <label>PD_DIR:</label>
                <span class="auth-value">${data.pdataDataRoot}</span>
            </div>
            <div class="auth-field" data-tooltip="The primary database directory. If DB_ROOT is not set in the environment, it defaults to a 'db' subdirectory within PD_DIR.">
                <label>DB_ROOT:</label>
                <span class="auth-value">${data.pdataDbRoot}</span>
            </div>
            <div class="auth-field" data-tooltip="A dedicated directory for temporary file uploads. It is managed by PData and is separate from user-specific data directories to handle transient files.">
                <label>Uploads Dir:</label>
                <span class="auth-value">${data.pdataUploadsDir}</span>
            </div>

                `;
            }
        } catch (error) {
            console.error('Failed to fetch PData info:', error);
            const container = this.element.querySelector('#pdata-info-content');
            if(container) {
                container.innerHTML = `<div class="login-error">Failed to load PData info.</div>`;
            }
        }
    }

    
    /**
     * Setup event listeners for sub-panel collapse and flyout
     */
    setupEventListeners() {
        if (!this.element) return;

        this.element.addEventListener('click', (e) => {
            const subPanelHeader = e.target.closest('.subpanel-header');
            if (subPanelHeader) {
                const subPanelId = subPanelHeader.dataset.subpanelId;
                this.toggleSubPanel(subPanelId);
                e.stopPropagation();
            }

            const flyoutBtn = e.target.closest('.flyout-toggle');
            if (flyoutBtn) {
                this.toggleFlyout();
                e.stopPropagation();
            }

            const clearButton = e.target.closest('.btn-clear-verification');
            if (clearButton) {
                this.verifiedUser = null;
                this.rerenderSubPanel('verification-subpanel');
            }
        });

        this.element.addEventListener('submit', async (e) => {
            if (e.target.id === 'pdata-login-form') {
                e.preventDefault();
                const username = this.element.querySelector('#pdata-username').value;
                const password = this.element.querySelector('#pdata-password').value;
                const errorDiv = this.element.querySelector('#pdata-login-error');
                
                errorDiv.textContent = '';
                const result = await dispatch(
                    thunks.auth.login({ username, password })
                );
                if (!result.success) {
                    errorDiv.textContent = result.error || 'Login failed. Please try again.';
                } else {
                    this.log('Login successful, re-rendering auth panel.');
                }
            }

            if (e.target.id === 'pdata-verify-form') {
                e.preventDefault();
                const username = this.element.querySelector('#pdata-verify-username').value;
                const password = this.element.querySelector('#pdata-verify-password').value;
                const errorDiv = this.element.querySelector('#pdata-verify-error');
                
                errorDiv.textContent = '';
                try {
                    const response = await fetch('/api/auth/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password }),
                        credentials: 'include'
                    });
                    const result = await response.json();
                    if (response.ok && result.success) {
                        this.verifiedUser = result.user;
                        this.rerenderSubPanel('verification-subpanel');
                    } else {
                        errorDiv.textContent = result.error || 'Verification failed.';
                    }
                } catch (err) {
                    errorDiv.textContent = 'An error occurred.';
                }
            }
        });
    }

    rerenderSubPanel(subPanelId) {
        const subPanel = this.element.querySelector(`.pdata-subpanel[data-subpanel-id="${subPanelId}"] .subpanel-content`);
        if (subPanel) {
            let content = '';
            switch (subPanelId) {
                case 'auth-subpanel':
                    content = this.renderAuthContent();
                    break;
                case 'verification-subpanel':
                    content = this.renderVerificationContent();
                    break;
                case 'api-explorer-subpanel':
                    content = this.renderApiContent();
                    break;
                case 'timing-subpanel':
                    content = this.renderTimingContent();
                    break;
                case 'introspection-subpanel':
                    content = this.renderIntrospectionContent();
                    break;
                case 'info-subpanel':
                    content = this.renderInfoContent();
                    break;
                case 'userdata-subpanel':
                    content = this.renderUserDataContent();
                    break;
                case 'lcl-query-subpanel':
                    content = this.renderLclQueryContent();
                    break;



            }
            subPanel.innerHTML = content;
            this.setupEventListeners(); // Re-attach listeners after re-render
        }
    }
    
    /**
     * Toggle sub-panel collapse state
     */
    toggleSubPanel(subPanelId) {
        if (!this.subPanelStates[subPanelId]) return;
        
        this.subPanelStates[subPanelId].isCollapsed = !this.subPanelStates[subPanelId].isCollapsed;
        
        // Update Redux state
        this.store.dispatch({
            type: 'panels/updateSubPanelState',
            payload: {
                panelId: this.id,
                subPanelId,
                updates: { isCollapsed: this.subPanelStates[subPanelId].isCollapsed }
            }
        });
        
        // Update visual state
        this.updateSubPanelVisual(subPanelId);
        this.log(`Toggled sub-panel ${subPanelId}: ${this.subPanelStates[subPanelId].isCollapsed ? 'collapsed' : 'expanded'}`);
    }
    
    /**
     * Update sub-panel visual state
     */
    updateSubPanelVisual(subPanelId) {
        if (!this.element) return;
        const subPanel = this.element.querySelector(`[data-subpanel-id="${subPanelId}"]`);
        if (!subPanel) return;
        
        const isCollapsed = this.subPanelStates[subPanelId].isCollapsed;
        const chevron = subPanel.querySelector('.collapse-chevron');
        const content = subPanel.querySelector('.subpanel-content');
        
        if (chevron) chevron.textContent = isCollapsed ? '▶' : '▼';
        if (content) content.classList.toggle('collapsed', isCollapsed);
    }
    
    /**
     * Override collapse to work with sub-panels
     */
    toggleCollapse() {
        super.toggleCollapse();
        
        // When collapsed, ensure no blank spaces are showing
        if (this.state.isCollapsed && this.element) {
            const content = this.element.querySelector('.panel-content');
            if (content) {
                content.dataset.visible = 'false';
                content.style.height = '0';
                content.style.minHeight = '0';
            }
        } else if (this.element) {
            const content = this.element.querySelector('.panel-content');
            if (content) {
                content.dataset.visible = 'true';
                content.style.height = '';
                content.style.minHeight = '';
            }
        }
        
        // Dispatch to Redux for state management
        this.store.dispatch({
            type: 'panels/updatePanelConfig',
            payload: {
                panelId: this.id,
                config: { isCollapsed: this.state.isCollapsed }
            }
        });
        
        this.log(`Main panel ${this.state.isCollapsed ? 'collapsed' : 'expanded'} - sub-panels ${this.state.isCollapsed ? 'hidden' : 'restored'}`);
    }
    
    /**
     * Toggle flyout mode
     */
    toggleFlyout() {
        this.store.dispatch({
            type: 'panels/togglePanelFlyout',
            payload: { panelId: this.id }
        });
        this.log('Toggled flyout mode');
    }
    
    /**
     * Save current flyout position for persistence
     */
    saveFlyoutPosition() {
        if (this.element && this.element.parentNode === document.body) {
            const rect = this.element.getBoundingClientRect();
            const position = { x: rect.left, y: rect.top };
            const size = { width: rect.width, height: rect.height };
            
            this.log(`💾 Saving flyout position: (${position.x}, ${position.y}) size: ${size.width}x${size.height}`);
            
            // Save to localStorage for persistence across reloads
            const positionKey = `${this.id}-flyout-position`;
            const sizeKey = `${this.id}-flyout-size`;
            
            localStorage.setItem(positionKey, JSON.stringify(position));
            localStorage.setItem(sizeKey, JSON.stringify(size));
            
            // Also save a timestamp for debugging
            localStorage.setItem(`${this.id}-flyout-saved-at`, new Date().toISOString());
            
            this.log(`💾 Saved to localStorage: ${positionKey}, ${sizeKey}`);
            
            // Update Redux state
            this.store.dispatch({
                type: 'panels/updatePanelPosition',
                payload: {
                    panelId: this.id,
                    position,
                    size,
                    isFlyout: true
                }
            });
        } else {
            this.log(`⚠️ Cannot save position - element not in flyout mode`);
        }
    }
    
    /**
     * Load saved flyout position from localStorage
     */
    loadFlyoutPosition() {
        try {
            const positionKey = `${this.id}-flyout-position`;
            const sizeKey = `${this.id}-flyout-size`;
            
            const savedPosition = localStorage.getItem(positionKey);
            const savedSize = localStorage.getItem(sizeKey);
            
            if (savedPosition && savedSize) {
                const position = JSON.parse(savedPosition);
                const size = JSON.parse(savedSize);
                this.log(`📍 Loaded flyout position from localStorage: (${position.x}, ${position.y})`);
                return { position, size };
            }
        } catch (error) {
            this.log(`⚠️ Failed to load flyout position: ${error.message}`, 'warn');
        }
        return null;
    }

    /**
     * Load beautiful panel-specific styles
     */
    loadPanelStyles() {
        if (document.querySelector('style[data-pdata-panel-styles]')) return;
        
        const style = document.createElement('style');
        style.setAttribute('data-pdata-panel-styles', 'true');
        style.textContent = `
            /* PData Panel Specific Styles */
            .pdata-explorer {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                box-sizing: border-box;
                padding: 0;
                margin: 0;
            }

            .pdata-subpanel {
                width: 100%;
                margin-bottom: 2px;
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 6px;
                overflow: hidden;
                background: var(--color-bg-alt, #f8f9fa);
                box-sizing: border-box;
                border-bottom: 1px solid var(--color-border-subtle);
            }
            
            .subpanel-header {
                padding: 6px 8px;
                background: var(--color-bg-elevated, #fff);
                border-bottom: 1px solid var(--color-border, #e1e5e9);
                cursor: pointer;
                user-select: none;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
                font-weight: 500;
                color: var(--color-fg, #333);
                transition: background-color 0.15s;
            }
            
            .subpanel-header:hover {
                background: var(--color-bg-alt, #f8f9fa);
            }
            
            .collapse-chevron {
                font-size: 10px;
                color: var(--color-fg-muted, #666);
                transition: transform 0.15s;
                line-height: 1;
            }
            
            .subpanel-title {
                flex: 1;
            }
            
            .subpanel-content {
                width: 100%;
                padding: 8px;
                transition: all 0.2s ease-out;
                overflow: hidden;
                box-sizing: border-box;
            }
            
            .subpanel-content.collapsed {
                max-height: 0 !important;
                min-height: 0 !important;
                height: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                opacity: 0;
                display: none;
            }
            
            /* Auth Section Styles */
            .auth-status {
                width: 100%;
                margin-bottom: 8px;
                box-sizing: border-box;
            }
            
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                background: var(--color-bg, #fff);
                border-radius: 4px;
                border: 1px solid var(--color-border-light, #f0f0f0);
            }
            
            .status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: var(--color-fg-muted, #666);
            }
            
            .status-indicator.connected .status-dot {
                background: var(--color-success, #28a745);
                box-shadow: 0 0 6px rgba(40, 167, 69, 0.4);
            }
            
            .status-indicator.disconnected .status-dot {
                background: var(--color-danger, #dc3545);
            }
            
            .status-text {
                font-size: 12px;
                color: var(--color-fg-muted, #666);
                font-weight: 500;
            }
            
            .auth-details {
                width: 100%;
                display: grid;
                gap: 4px;
                box-sizing: border-box;
            }
            
            .auth-field {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px;
                background: var(--color-bg, #fff);
                border-radius: 4px;
                border: 1px solid var(--color-border-light, #f0f0f0);
                font-size: 12px;
                box-sizing: border-box;
            }
            
            .auth-field label {
                font-weight: 500;
                color: var(--color-fg-muted, #666);
            }
            
            .auth-value {
                font-weight: 600;
                color: var(--color-fg, #333);
                font-family: var(--font-family-mono, monospace);
            }
            
            /* API Section Styles */
            .api-controls {
                width: 100%;
                margin-bottom: 8px;
                box-sizing: border-box;
            }
            
            .control-row {
                width: 100%;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                box-sizing: border-box;
            }
            
            .control-row label {
                min-width: 50px;
                font-weight: 500;
                color: var(--color-fg-muted, #666);
            }
            
            .endpoint-select {
                flex: 1;
                padding: 4px 6px;
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 4px;
                background: var(--color-bg, #fff);
                font-family: var(--font-family-mono, monospace);
                font-size: 11px;
            }
            
            .btn {
                padding: 4px 8px;
                border-radius: 4px;
                border: 1px solid transparent;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s;
                margin-right: 4px;
            }
            
            .btn-primary {
                background: var(--color-primary, #007bff);
                color: white;
                border-color: var(--color-primary, #007bff);
            }
            
            .btn-primary:hover {
                background: var(--color-primary-dark, #0056b3);
            }
            
            .btn-secondary {
                background: var(--color-bg-alt, #f8f9fa);
                color: var(--color-fg, #333);
                border-color: var(--color-border, #e1e5e9);
            }
            
            .btn-secondary:hover {
                background: var(--color-bg-muted, #e9ecef);
            }
            
            .api-response {
                width: 100%;
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 4px;
                overflow: hidden;
                background: var(--color-bg, #fff);
                box-sizing: border-box;
            }
            
            .response-header {
                padding: 4px 8px;
                background: var(--color-bg-alt, #f8f9fa);
                border-bottom: 1px solid var(--color-border, #e1e5e9);
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
            }
            
            .response-status.success {
                color: var(--color-success, #28a745);
                font-weight: 600;
            }
            
            .response-time {
                color: var(--color-fg-muted, #666);
                font-family: var(--font-family-mono, monospace);
            }
            
            .response-body {
                padding: 6px;
            }
            
            .json-response {
                margin: 0;
                font-family: var(--font-family-mono, monospace);
                font-size: 10px;
                line-height: 1.4;
                color: var(--color-fg, #333);
                background: transparent;
                white-space: pre-wrap;
                word-break: break-word;
            }
            
            
            .auth-field[data-tooltip] {
                position: relative;
                cursor: help;
            }

            .auth-field[data-tooltip]::after {
                content: attr(data-tooltip);
                position: absolute;
                left: 100%;
                top: 50%;
                transform: translateY(-50%);
                margin-left: 10px;
                background-color: #333;
                color: #fff;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                white-space: pre-wrap; /* Use pre-wrap to respect newlines */
                width: 250px;
                z-index: 100;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s;
                pointer-events: none; /* Allows clicks to pass through */
                 box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }

            .auth-field[data-tooltip]:hover::after {
                opacity: 1;
                visibility: visible;
            }
            
            /* Login Form Styles */

            .login-form {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .login-field input {
                width: 100%;
                padding: 6px 8px;
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 4px;
                font-size: 12px;
                box-sizing: border-box;
            }

            .login-actions {
                display: flex;
                justify-content: flex-end;
            }

            .btn-login {
                width: 100%;
            }

            .login-error {
                color: var(--color-danger, #dc3545);
                font-size: 11px;
                margin-top: 4px;
                min-height: 14px;
            }

            /* Timing and Introspection Styles */
            .timing-metrics, .introspection-data {
                width: 100%;
                display: grid;
                gap: 4px;
                box-sizing: border-box;
            }
            
            .metric-row, .data-row {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px;
                background: var(--color-bg, #fff);
                border-radius: 4px;
                border: 1px solid var(--color-border-light, #f0f0f0);
                font-size: 12px;
                box-sizing: border-box;
            }
            
            .metric-label, .data-label {
                color: var(--color-fg-muted, #666);
                font-weight: 500;
            }
            
            .metric-value, .data-value {
                font-weight: 600;
                font-family: var(--font-family-mono, monospace);
                color: var(--color-fg, #333);
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Compatibility method for Redux system
     */
    syncFromRedux(state) {
        // Sync sub-panel states from Redux
        if (state.subPanels) {
            Object.keys(state.subPanels).forEach(subPanelId => {
                if (this.subPanelStates[subPanelId]) {
                    this.subPanelStates[subPanelId] = { ...this.subPanelStates[subPanelId], ...state.subPanels[subPanelId] };
                    this.updateSubPanelVisual(subPanelId);
                }
            });
        }
        
        // Handle flyout position changes and setup auto-save
        if (state.isFlyout && this.element && this.element.parentNode === document.body) {
            // Save position on window unload (page refresh/close)
            const saveOnUnload = () => this.saveFlyoutPosition();
            window.addEventListener('beforeunload', saveOnUnload);
            
            // Also save position every 5 seconds while in flyout mode
            if (!this._autoSaveInterval) {
                this._autoSaveInterval = setInterval(() => {
                    if (this.element && this.element.parentNode === document.body) {
                        this.saveFlyoutPosition();
                    } else {
                        // Clear interval if no longer in flyout mode
                        clearInterval(this._autoSaveInterval);
                        this._autoSaveInterval = null;
                    }
                }, 5000);
            }
            
            this.log(`🔄 Setup flyout auto-save (5s interval + beforeunload)`);
        }
        
        this.log('Synced from Redux state');
    }

    /**
     * Test session functionality
     */
    async testSessionRequest() {
        try {
            const response = await window.APP.services.globalFetch('/api/auth/user', {
                credentials: 'include'
            });
            const data = await response.json();
            
            document.getElementById('session-last-request').textContent = new Date().toLocaleTimeString();
            
            if (response.ok) {
                this.updateSessionInfo('✅ Session working', 'success');
            } else {
                this.updateSessionInfo('❌ Session failed', 'error');
            }
        } catch (error) {
            this.updateSessionInfo('❌ Request failed', 'error');
            document.getElementById('session-last-request').textContent = `Error: ${error.message}`;
        }
    }

    /**
     * Clear session cookies
     */
    clearSessionData() {
        // Clear all cookies
        document.cookie.split(";").forEach(cookie => {
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        });
        
        this.updateSessionInfo('🧹 Cookies cleared', 'warning');
        this.refreshSessionData();
    }

    /**
     * Update session information display
     */
    updateSessionInfo(message, type = 'info') {
        const statusElement = document.getElementById('session-cookies');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `session-value ${type}`;
        }
    }

    /**
     * Refresh session data display
     */
    refreshSessionData() {
        // Update environment info
        const envElement = document.getElementById('session-env');
        if (envElement) {
            envElement.textContent = window.location.protocol === 'https:' ? 'HTTPS (Secure)' : 'HTTP (Insecure)';
        }

        // Update cookie info
        const cookiesElement = document.getElementById('session-cookies');
        if (cookiesElement) {
            const sessionCookie = document.cookie
                .split(';')
                .find(cookie => cookie.trim().startsWith('devpages.sid='));
            
            if (sessionCookie) {
                cookiesElement.textContent = '✅ Session cookie found';
                cookiesElement.className = 'session-value success';
            } else {
                cookiesElement.textContent = '❌ No session cookie';
                cookiesElement.className = 'session-value error';
            }
        }

        // Update raw cookie data
        const rawElement = document.getElementById('session-raw-data');
        if (rawElement) {
            rawElement.textContent = document.cookie || '(no cookies)';
        }

        // Update session store info
        const storeElement = document.getElementById('session-store');
        if (storeElement) {
            storeElement.textContent = 'FileStore (Production)';
        }
    }
} 