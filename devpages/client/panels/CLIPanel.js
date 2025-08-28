/**
 * CLIPanel.js - Command Line Interface Panel
 * Replaces the CLI functionality from SidebarHeader
 */

import { BasePanel } from './BasePanel.js';
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';

export class CLIPanel extends BasePanel {
    constructor(options = {}) {
        super({
            id: 'cli-panel',
            title: 'Command Line',
            ...options
        });
        
        this.cliInput = null;
        
        // CLI command registry
        this.commands = new Map([
            ['help', { fn: this.showHelp.bind(this), desc: 'Show available commands' }],
            ['settings', { fn: this.togglePanel.bind(this, 'settings-panel'), desc: 'Toggle settings panel' }],
            ['debug', { fn: this.togglePanel.bind(this, 'debug-panel'), desc: 'Toggle debug panel' }],
            ['clear', { fn: this.clearCLI.bind(this), desc: 'Clear CLI input' }],
            ['status', { fn: this.showStatus.bind(this), desc: 'Show system status' }],
            ['panels', { fn: this.listPanels.bind(this), desc: 'List all panels' }]
        ]);
    }

    renderContent() {
        return `
            <div class="cli-panel-content">
                <div class="cli-input-container">
                    <span class="cli-prompt">devpages$</span>
                    <input type="text" class="cli-input" placeholder="Type 'help' for commands..." />
                </div>
                <div class="cli-output" style="display: none;">
                    <div class="cli-output-content"></div>
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);
        
        this.cliInput = this.element.querySelector('.cli-input');
        this.cliOutput = this.element.querySelector('.cli-output');
        this.cliOutputContent = this.element.querySelector('.cli-output-content');
        
        this.attachEventListeners();
        this.addStyles();
    }

    attachEventListeners() {
        if (!this.cliInput) return;

        this.cliInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = this.cliInput.value.trim();
                if (command) {
                    this.executeCommand(command);
                    this.cliInput.value = '';
                }
            }
        });
    }

    executeCommand(commandStr) {
        const [cmd, ...args] = commandStr.split(' ');
        const command = this.commands.get(cmd);
        
        if (command) {
            try {
                command.fn(...args);
                this.showOutput(`✅ Executed: ${cmd}`);
            } catch (error) {
                this.showOutput(`❌ Error: ${error.message}`);
            }
        } else {
            this.showOutput(`❌ Unknown command: ${cmd}. Type 'help' for available commands.`);
        }
    }

    showOutput(message) {
        if (!this.cliOutputContent) return;
        
        this.cliOutputContent.innerHTML = message;
        this.cliOutput.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.cliOutput.style.display = 'none';
        }, 3000);
    }

    showHelp() {
        const helpText = Array.from(this.commands.entries())
            .map(([cmd, { desc }]) => `• ${cmd}: ${desc}`)
            .join('<br>');
        
        this.showOutput(`Available commands:<br>${helpText}`);
    }

    togglePanel(panelId) {
        // Dispatch panel toggle action
        if (window.APP?.sidebar?.togglePanel) {
            window.APP.sidebar.togglePanel(panelId);
            this.showOutput(`Toggled panel: ${panelId}`);
        } else {
            this.showOutput(`Panel system not available`);
        }
    }

    clearCLI() {
        if (this.cliInput) {
            this.cliInput.value = '';
        }
        this.showOutput('CLI cleared');
    }

    showStatus() {
        const state = appStore.getState();
        const panelCount = Object.keys(state.panels?.panels || {}).length;
        const dockCount = Object.keys(state.panels?.docks || {}).length;
        
        this.showOutput(`Status: ${panelCount} panels, ${dockCount} docks`);
    }

    listPanels() {
        if (window.APP?.sidebar?.listPanels) {
            const panels = window.APP.sidebar.listPanels();
            const panelList = panels.map(p => `• ${p.id}: ${p.visible ? 'visible' : 'hidden'}`).join('<br>');
            this.showOutput(`Panels:<br>${panelList}`);
        } else {
            this.showOutput('Panel listing not available');
        }
    }

    addStyles() {
        if (document.querySelector('style[data-cli-panel-styles]')) return;
        
        const style = document.createElement('style');
        style.setAttribute('data-cli-panel-styles', 'true');
        style.textContent = `
            .cli-panel-content {
                font-family: var(--font-family-mono, 'Courier New', monospace);
                font-size: 12px;
            }
            
            .cli-input-container {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background: var(--color-bg-alt, #f8f9fa);
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 4px;
                margin-bottom: 8px;
            }
            
            .cli-prompt {
                color: var(--color-success, #28a745);
                font-weight: 600;
                white-space: nowrap;
            }
            
            .cli-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                font-family: inherit;
                font-size: inherit;
                color: var(--color-text, #212529);
            }
            
            .cli-output {
                background: var(--color-bg-alt, #f8f9fa);
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 4px;
                padding: 8px;
                margin-top: 8px;
            }
            
            .cli-output-content {
                font-size: 11px;
                line-height: 1.4;
                color: var(--color-text-secondary, #6c757d);
            }
        `;
        document.head.appendChild(style);
    }
}
