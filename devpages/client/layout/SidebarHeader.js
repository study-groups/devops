/**
 * client/layout/SidebarHeader.js
 * Sidebar header with mini CLI interface and status line
 * Key technical branding element that appears when sidebar unfurls
 */

import { appStore, dispatch } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';

export class SidebarHeader {
    constructor() {
        this.container = null;
        this.cliInput = null;
        this.statusElements = new Map();
        this.dockButtons = new Map();
        
        // CLI command registry
        this.commands = new Map([
            ['help', { fn: this.showHelp.bind(this), desc: 'Show available commands' }],
            ['settings', { fn: this.toggleDock.bind(this, 'settings-dock'), desc: 'Toggle settings dock' }],
            ['controls', { fn: this.toggleDock.bind(this, 'controls-dock'), desc: 'Toggle controls dock' }],
            ['logs', { fn: this.toggleDock.bind(this, 'logs-dock'), desc: 'Toggle logs dock' }],
            ['debug', { fn: this.toggleDebugDock.bind(this), desc: 'Toggle debug dock' }],
            ['clear', { fn: this.clearCLI.bind(this), desc: 'Clear CLI input' }],
            ['status', { fn: this.showStatus.bind(this), desc: 'Show system status' }],
            ['docks', { fn: this.listDocks.bind(this), desc: 'List all docks' }]
        ]);
        
        this.initialize();
    }

    initialize() {
        // Subscribe to store changes for status updates (defensive)
        this.subscribeToStore();
    }
    
    subscribeToStore() {
        // Defensive store subscription - wait for store to be available
        if (appStore && typeof appStore.subscribe === 'function') {
            try {
                this.storeUnsubscribe = appStore.subscribe(() => {
                    this.updateStatus();
                });
                console.log('[SidebarHeader] Store subscription established');
            } catch (error) {
                console.warn('[SidebarHeader] Failed to subscribe to store:', error);
                // Retry after a short delay
                setTimeout(() => this.subscribeToStore(), 100);
            }
        } else {
            console.log('[SidebarHeader] Store not yet available, retrying...');
            // Retry after a short delay
            setTimeout(() => this.subscribeToStore(), 100);
        }
    }

    render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="sidebar-header">
                <div class="mini-cli">
                    <div class="cli-buttons">
                        <button class="cli-btn" data-dock="settings-dock" data-action="settings" title="Settings Dock">
                            <span class="cli-icon">⚙️</span>
                        </button>
                        <button class="cli-btn" data-dock="controls-dock" data-action="controls" title="Controls Dock">
                            <span class="cli-icon">🎛️</span>
                        </button>
                        <button class="cli-btn" data-dock="logs-dock" data-action="logs" title="Logs Dock">
                            <span class="cli-icon">📋</span>
                        </button>
                        <button class="cli-btn" data-dock="debug-dock" data-action="debug" title="Debug Dock">
                            <span class="cli-icon">🐛</span>
                        </button>
                    </div>
                    <div class="cli-input-container">
                        <span class="cli-prompt">devpages$</span>
                        <input type="text" class="cli-input" placeholder="quick command..." />
                    </div>
                </div>
                <div class="status-line">
                    <span class="status-item status-connection" data-status="connection">
                        <span class="status-icon">🔴</span>
                        <span class="status-text">Connecting...</span>
                    </span>
                    <span class="status-item status-docks" data-status="docks">
                        <span class="status-icon">📊</span>
                        <span class="status-text">0 docks</span>
                    </span>
                    <span class="status-item status-state" data-status="state">
                        <span class="status-icon">⚡</span>
                        <span class="status-text">Loading...</span>
                    </span>
                </div>
            </div>
        `;

        // Add styles
        this.addStyles();
        
        // Get element references
        this.cliInput = container.querySelector('.cli-input');
        
        // Cache status elements for updates
        this.statusElements.set('connection', container.querySelector('[data-status="connection"] .status-text'));
        this.statusElements.set('docks', container.querySelector('[data-status="docks"] .status-text'));
        this.statusElements.set('state', container.querySelector('[data-status="state"] .status-text'));
        
        // Cache dock buttons
        container.querySelectorAll('.cli-btn').forEach(btn => {
            const dockId = btn.dataset.dock;
            this.dockButtons.set(dockId, btn);
        });
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Initial status update
        this.updateStatus();
        
        logMessage('[SidebarHeader] Rendered sidebar header with mini CLI', 'debug');
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .sidebar-header {
                background: var(--color-bg-alt, #f8f9fa);
                border-bottom: 1px solid var(--color-border, #dee2e6);
                padding: 12px;
                font-family: var(--font-family-mono, 'Courier New', monospace);
            }
            
            .mini-cli {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .cli-buttons {
                display: flex;
                gap: 4px;
            }
            
            .cli-btn {
                width: 28px;
                height: 28px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 4px;
                background: var(--color-bg, white);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .cli-btn:hover {
                background: var(--color-bg-hover, #e9ecef);
                transform: translateY(-1px);
            }
            
            .cli-btn.active {
                background: var(--color-primary, #007bff);
                color: white;
                border-color: var(--color-primary, #007bff);
            }
            
            .cli-icon {
                font-size: 12px;
                line-height: 1;
            }
            
            .cli-input-container {
                flex: 1;
                display: flex;
                align-items: center;
                background: var(--color-bg, white);
                border: 1px solid var(--color-border, #ddd);
                border-radius: 4px;
                padding: 4px 8px;
            }
            
            .cli-prompt {
                color: var(--color-primary, #007bff);
                font-weight: 600;
                margin-right: 8px;
                font-size: 12px;
            }
            
            .cli-input {
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                font-family: inherit;
                font-size: 12px;
                color: var(--color-fg, #333);
            }
            
            .cli-input::placeholder {
                color: var(--color-fg-muted, #999);
                font-style: italic;
            }
            
            .status-line {
                display: flex;
                gap: 12px;
                font-size: 11px;
                color: var(--color-fg-muted, #666);
            }
            
            .status-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .status-icon {
                font-size: 10px;
                line-height: 1;
            }
            
            .status-text {
                font-weight: 500;
            }
            
            /* Status indicators */
            .status-connection.connected .status-icon::before { content: '🟢'; }
            .status-connection.connecting .status-icon::before { content: '🟡'; }
            .status-connection.disconnected .status-icon::before { content: '🔴'; }
        `;
        
        // Add to head if not already present
        if (!document.head.querySelector('style[data-sidebar-header]')) {
            style.setAttribute('data-sidebar-header', 'true');
            document.head.appendChild(style);
        }
    }

    attachEventListeners() {
        // CLI input handling
        this.cliInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleCLICommand(e.target.value.trim());
                e.target.value = '';
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.autoComplete(e.target.value);
            }
        });

        // Dock button handling
        this.container.querySelectorAll('.cli-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const dockId = btn.dataset.dock;
                
                if (action === 'debug') {
                    this.toggleDebugDock();
                } else {
                    this.toggleDock(dockId);
                }
            });
        });
    }

    handleCLICommand(input) {
        if (!input) return;
        
        const [command, ...args] = input.toLowerCase().split(' ');
        
        if (this.commands.has(command)) {
            try {
                const result = this.commands.get(command).fn(...args);
                if (result) {
                    logMessage(`[CLI] ${command}: ${result}`, 'info');
                }
            } catch (error) {
                logMessage(`[CLI] Error executing ${command}: ${error.message}`, 'error');
            }
        } else {
            logMessage(`[CLI] Unknown command: ${command}. Type 'help' for available commands.`, 'warn');
        }
    }

    autoComplete(partial) {
        const matches = Array.from(this.commands.keys()).filter(cmd => cmd.startsWith(partial));
        if (matches.length === 1) {
            this.cliInput.value = matches[0];
        } else if (matches.length > 1) {
            logMessage(`[CLI] Possible completions: ${matches.join(', ')}`, 'info');
        }
    }

    // =================================================================
    // CLI COMMANDS
    // =================================================================

    showHelp() {
        console.group('🔧 DevPages CLI Commands');
        this.commands.forEach((cmd, name) => {
            console.log(`  ${name.padEnd(10)} - ${cmd.desc}`);
        });
        console.groupEnd();
        return 'Commands listed in console';
    }

    toggleDock(dockId) {
        // This will be implemented when we have dock management
        logMessage(`[CLI] Toggle dock: ${dockId}`, 'info');
        
        // Update button state
        const button = this.dockButtons.get(dockId);
        if (button) {
            button.classList.toggle('active');
        }
        
        return `Toggled ${dockId}`;
    }

    toggleDebugDock() {
        if (window.debugDock) {
            window.debugDock.toggleVisibility();
            
            // Update button state
            const button = this.dockButtons.get('debug-dock');
            if (button) {
                button.classList.toggle('active', window.debugDock.isVisible);
            }
            
            return `Debug dock ${window.debugDock.isVisible ? 'shown' : 'hidden'}`;
        } else {
            return 'Debug dock not available';
        }
    }

    clearCLI() {
        this.cliInput.value = '';
        return 'CLI cleared';
    }

    showStatus() {
        const state = appStore.getState();
        console.group('📊 System Status');
        console.log('Store state keys:', Object.keys(state));
        console.log('Active docks:', this.getActiveDockCount());
        console.groupEnd();
        return 'Status displayed in console';
    }

    listDocks() {
        const docks = Array.from(this.dockButtons.keys());
        console.log('Available docks:', docks);
        return `Docks: ${docks.join(', ')}`;
    }

    // =================================================================
    // STATUS UPDATES
    // =================================================================

    updateStatus() {
        this.updateConnectionStatus();
        this.updateDocksStatus();
        this.updateStateStatus();
    }

    updateConnectionStatus() {
        const statusEl = this.statusElements.get('connection');
        if (statusEl) {
            // Simple connection check - could be enhanced
            const isConnected = window.appStore && window.appStore.getState;
            statusEl.textContent = isConnected ? 'Connected' : 'Disconnected';
            
            const statusItem = statusEl.closest('.status-item');
            statusItem.className = `status-item status-connection ${isConnected ? 'connected' : 'disconnected'}`;
        }
    }

    updateDocksStatus() {
        const statusEl = this.statusElements.get('docks');
        if (statusEl) {
            const activeDocks = this.getActiveDockCount();
            statusEl.textContent = `${activeDocks} docks`;
        }
    }

    updateStateStatus() {
        const statusEl = this.statusElements.get('state');
        if (statusEl) {
            try {
                const state = appStore.getState();
                const stateKeys = Object.keys(state).length;
                statusEl.textContent = `${stateKeys} slices`;
            } catch (error) {
                statusEl.textContent = 'Error';
            }
        }
    }

    getActiveDockCount() {
        // Count active dock buttons
        return Array.from(this.dockButtons.values())
            .filter(btn => btn.classList.contains('active')).length;
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    setDockActive(dockId, active) {
        const button = this.dockButtons.get(dockId);
        if (button) {
            button.classList.toggle('active', active);
            this.updateDocksStatus();
        }
    }

    executeCommand(command) {
        this.handleCLICommand(command);
    }

    destroy() {
        // Unsubscribe from store
        if (this.storeUnsubscribe && typeof this.storeUnsubscribe === 'function') {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
            console.log('[SidebarHeader] Store subscription cleaned up');
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Remove styles
        const style = document.head.querySelector('style[data-sidebar-header]');
        if (style) {
            style.remove();
        }
        
        // Clear references
        this.container = null;
        this.cliInput = null;
        this.statusElements.clear();
        this.dockButtons.clear();
        
        logMessage('[SidebarHeader] Destroyed', 'debug');
    }
}