/**
 * ApiTokenPanel.js - API Token Management Panel
 * Allows users to generate, view, and manage API tokens for authenticated access
 */

import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { e } from '/client/components/elements.js';
import { api } from '/client/api/api.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';
import { ApiTokenService } from '/client/services/ApiTokenService.js';

const log = window.APP.services.log.createLogger('ApiTokenPanel');

export class ApiTokenPanel {
    constructor(parentElement) {
        this.containerElement = parentElement;
        this.stateUnsubscribe = null;
        this.tokens = [];
        
        this.createPanelContent(parentElement);
        this.subscribeToState();
        this.loadTokens();
        
        log.info('PANEL_INIT', 'INITIALIZED', 'ApiTokenPanel initialized');
    }

    createPanelContent(parentElement) {
        parentElement.innerHTML = `
            <div class="api-token-panel-content">
                <div class="token-info-section">
                    <h5>API Token Management</h5>
                    <p class="token-description">
                        Generate temporary API tokens for authenticated access to the DevPages API.
                        Use these tokens with curl, scripts, or other tools that need to access your files.
                    </p>
                </div>

                <div class="token-generation-section">
                    <h6>Generate New Token</h6>
                    <div class="token-form">
                        <div class="form-group">
                            <label for="token-expiry">Expiry (hours):</label>
                            <select id="token-expiry" class="form-input">
                                <option value="1">1 hour</option>
                                <option value="6">6 hours</option>
                                <option value="24" selected>24 hours</option>
                                <option value="168">7 days</option>
                                <option value="720">30 days</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="token-description">Description:</label>
                            <input type="text" id="token-description" class="form-input" 
                                   placeholder="e.g., Theme development, Testing, etc." 
                                   value="API Access Token">
                        </div>
                        <button id="generate-token-btn" class="action-btn primary">Generate Token</button>
                    </div>
                </div>

                <div class="token-display-section" id="token-display-section" style="display: none;">
                    <h6>New Token Generated</h6>
                    <div class="token-display">
                        <div class="token-value-container">
                            <label>Token:</label>
                            <div class="token-value">
                                <input type="text" id="generated-token" class="token-input" readonly>
                                <button id="copy-token-btn" class="copy-btn" title="Copy to clipboard">📋</button>
                            </div>
                        </div>
                        <div class="token-usage-examples">
                            <h6>Usage Examples:</h6>
                            <div class="usage-example">
                                <label>cURL:</label>
                                <code id="curl-example" class="usage-code"></code>
                                <button class="copy-btn" onclick="this.previousElementSibling.select(); document.execCommand('copy')">📋</button>
                            </div>
                            <div class="usage-example">
                                <label>JavaScript:</label>
                                <code id="js-example" class="usage-code"></code>
                                <button class="copy-btn" onclick="this.previousElementSibling.select(); document.execCommand('copy')">📋</button>
                            </div>
                        </div>
                        <div class="token-warning">
                            ⚠️ <strong>Important:</strong> Copy this token now. You won't be able to see it again for security reasons.
                        </div>
                    </div>
                </div>

                <div class="active-tokens-section">
                    <h6>Active Tokens</h6>
                    <div class="tokens-list" id="tokens-list">
                        <div class="loading-tokens">Loading tokens...</div>
                    </div>
                    <button id="refresh-tokens-btn" class="action-btn secondary">Refresh</button>
                </div>

                <div class="token-testing-section">
                    <h6>Test Token</h6>
                    <div class="test-form">
                        <div class="form-group">
                            <label for="test-endpoint">Test Endpoint:</label>
                            <select id="test-endpoint" class="form-input">
                                <option value="/api/files/content?pathname=themes/classic/core.css">Theme File (core.css)</option>
                                <option value="/api/files/list?pathname=themes">Themes Directory</option>
                                <option value="/api/auth/user">User Info</option>
                            </select>
                        </div>
                        <button id="test-token-btn" class="action-btn">Test Current Token</button>
                    </div>
                    <div class="test-results" id="test-results"></div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Token generation
        this.containerElement.querySelector('#generate-token-btn')?.addEventListener('click', () => {
            this.generateToken();
        });

        // Copy token
        this.containerElement.querySelector('#copy-token-btn')?.addEventListener('click', () => {
            this.copyToken();
        });

        // Refresh tokens
        this.containerElement.querySelector('#refresh-tokens-btn')?.addEventListener('click', () => {
            this.loadTokens();
        });

        // Test token
        this.containerElement.querySelector('#test-token-btn')?.addEventListener('click', () => {
            this.testToken();
        });
    }

    async generateToken() {
        const expiryHours = parseInt(this.containerElement.querySelector('#token-expiry').value);
        const description = this.containerElement.querySelector('#token-description').value.trim() || 'API Access Token';

        log.info('TOKEN', 'GENERATING', `Generating token with ${expiryHours}h expiry: ${description}`);

        try {
            const tokenData = await api.generateToken(expiryHours, description);
            
            // Display the new token
            this.displayNewToken(tokenData);
            
            // Refresh the tokens list
            await this.loadTokens();
            
            this.showTemporaryMessage('Token generated successfully!', 'success');
        } catch (error) {
            log.error('TOKEN', 'GENERATION_ERROR', `Error generating token: ${error.message}`, error);
            this.showTemporaryMessage(`Error generating token: ${error.message}`, 'error');
        }
    }

    displayNewToken(tokenData) {
        const displaySection = this.containerElement.querySelector('#token-display-section');
        const tokenInput = this.containerElement.querySelector('#generated-token');
        const curlExample = this.containerElement.querySelector('#curl-example');
        const jsExample = this.containerElement.querySelector('#js-example');

        tokenInput.value = tokenData.token;
        
        // Update usage examples
        if (tokenData.usage) {
            curlExample.textContent = tokenData.usage.curl;
            jsExample.textContent = tokenData.usage.javascript;
        }

        displaySection.style.display = 'block';
        displaySection.scrollIntoView({ behavior: 'smooth' });
    }

    async copyToken() {
        const tokenInput = this.containerElement.querySelector('#generated-token');
        try {
            await navigator.clipboard.writeText(tokenInput.value);
            this.showTemporaryMessage('Token copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for older browsers
            tokenInput.select();
            document.execCommand('copy');
            this.showTemporaryMessage('Token copied to clipboard!', 'success');
        }
    }

    async loadTokens() {
        const tokensList = this.containerElement.querySelector('#tokens-list');
        tokensList.innerHTML = '<div class="loading-tokens">Loading tokens...</div>';

        try {
            const response = await api.getTokens();
            this.tokens = response.tokens || [];
            this.displayTokens();
        } catch (error) {
            log.error('TOKEN', 'LOAD_ERROR', `Error loading tokens: ${error.message}`, error);
            tokensList.innerHTML = `<div class="error-tokens">Error loading tokens: ${error.message}</div>`;
        }
    }

    displayTokens() {
        const tokensList = this.containerElement.querySelector('#tokens-list');
        
        if (this.tokens.length === 0) {
            tokensList.innerHTML = '<div class="no-tokens">No active tokens found.</div>';
            return;
        }

        const tokensHtml = this.tokens.map((token, index) => {
            const createdDate = new Date(token.createdAt).toLocaleString();
            const expiresDate = new Date(token.expiresAt).toLocaleString();
            const isExpiringSoon = (token.expiresAt - Date.now()) < (24 * 60 * 60 * 1000); // Less than 24 hours

            return `
                <div class="token-item ${isExpiringSoon ? 'expiring-soon' : ''}">
                    <div class="token-info">
                        <div class="token-preview">${token.tokenPreview}</div>
                        <div class="token-dates">
                            <span class="created">Created: ${createdDate}</span>
                            <span class="expires">Expires: ${expiresDate}</span>
                        </div>
                    </div>
                    <div class="token-actions">
                        <button class="revoke-btn" data-token-preview="${token.tokenPreview}" title="Revoke this token">Revoke</button>
                    </div>
                </div>
            `;
        }).join('');

        tokensList.innerHTML = tokensHtml;
        // Attach revoke event listeners
        tokensList.querySelectorAll('.revoke-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preview = btn.getAttribute('data-token-preview');
                this.revokeToken(preview);
            });
        });
    }

    async revokeToken(tokenPreview) {
        if (!confirm(`Are you sure you want to revoke token ${tokenPreview}?`)) {
            return;
        }

        try {
            // Note: This is a simplified approach. In a real implementation,
            // you'd need a way to map token previews to full tokens for revocation.
            this.showTemporaryMessage('Token revocation requires the full token for security. Use the API directly.', 'info');
            
            // Refresh the tokens list
            await this.loadTokens();
        } catch (error) {
            log.error('TOKEN', 'REVOKE_ERROR', `Error revoking token: ${error.message}`, error);
            this.showTemporaryMessage(`Error revoking token: ${error.message}`, 'error');
        }
    }

    async testToken() {
        const endpoint = this.containerElement.querySelector('#test-endpoint').value;
        const resultsDiv = this.containerElement.querySelector('#test-results');
        
        resultsDiv.innerHTML = '<div class="testing">Testing token...</div>';

        try {
            const currentToken = api.getToken();
            if (!currentToken) {
                throw new Error('No token set. Generate a token first.');
            }

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            const isJson = response.headers.get('content-type')?.includes('application/json');
            const content = isJson ? await response.json() : await response.text();

            const resultHtml = `
                <div class="test-result ${response.ok ? 'success' : 'error'}">
                    <div class="test-status">
                        <strong>Status:</strong> ${response.status} ${response.statusText}
                    </div>
                    <div class="test-endpoint">
                        <strong>Endpoint:</strong> ${endpoint}
                    </div>
                    <div class="test-content">
                        <strong>Response:</strong>
                        <pre>${typeof content === 'string' ? content.substring(0, 500) : JSON.stringify(content, null, 2).substring(0, 500)}${(typeof content === 'string' ? content.length : JSON.stringify(content).length) > 500 ? '...' : ''}</pre>
                    </div>
                </div>
            `;

            resultsDiv.innerHTML = resultHtml;
        } catch (error) {
            resultsDiv.innerHTML = `
                <div class="test-result error">
                    <div class="test-status">
                        <strong>Error:</strong> ${error.message}
                    </div>
                </div>
            `;
        }
    }

    showTemporaryMessage(message, type = 'info') {
        // Remove any existing message
        const existingMessage = this.containerElement.querySelector('.temp-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `temp-message temp-message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}-background, #f0f9ff);
            color: var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}, #0369a1);
            padding: 12px 16px;
            border-radius: 6px;
            border: 1px solid var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}, #0369a1);
            z-index: 10001;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;

        this.containerElement.appendChild(messageEl);

        // Remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (messageEl.parentNode) {
                        messageEl.remove();
                    }
                }, 300);
            }
        }, 3000);
    }

    subscribeToState() {
        let prevState = appStore.getState(); // Initialize previous state
        this.stateUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            this.handleStateChange(newState, prevState);
            prevState = newState; // Update previous state
        });
    }

    handleStateChange(newState, prevState) {
        if (newState.settings.apiTokens !== prevState.settings.apiTokens) {
            this.loadTokens(); // Re-render or update specific parts if needed
        }
    }

    destroy() {
        log.info('PANEL_DESTROY', 'DESTROYING', 'Destroying ApiTokenPanel...');
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        this.containerElement = null;
        
        // Remove global reference
        if (window.apiTokenPanel === this) {
            delete window.apiTokenPanel;
        }
        
        log.info('PANEL_DESTROY', 'DESTROYED', 'ApiTokenPanel destroyed.');
    }
}

// Register this panel with the registry
panelRegistry.register({
    id: 'api-tokens',
    title: 'API Tokens',
    component: ApiTokenPanel,
    defaultCollapsed: true,
}); 