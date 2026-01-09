/**
 * ConsoleToolsPanel.js - Console Tools Discovery Panel
 *
 * Auto-discovers IIFE-based console utilities registered with window.consoleTools
 * and presents them as expandable cards with on/off toggles and clickable commands.
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class ConsoleToolsPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'console-tools',
            title: 'Console Tools',
            defaultWidth: 350,
            defaultHeight: 400,
            ...config
        });

        this.expandedTools = new Set();
        this.unsubscribe = null;
    }

    renderContent() {
        return `
            <div class="console-tools-panel">
                <div class="console-tools-header">
                    <span class="console-tools-subtitle">IIFE utilities for debugging</span>
                </div>
                <div class="console-tools-list" id="console-tools-list">
                    ${this.renderToolsList()}
                </div>
            </div>
        `;
    }

    renderToolsList() {
        if (!window.consoleTools) {
            return '<div class="console-tools-empty">Registry not loaded</div>';
        }

        const tools = window.consoleTools.list();

        if (tools.length === 0) {
            return '<div class="console-tools-empty">No tools registered</div>';
        }

        return tools.map(tool => this.renderToolCard(tool)).join('');
    }

    renderToolCard(tool) {
        const isEnabled = tool.isEnabled ? tool.isEnabled() : false;
        const isExpanded = this.expandedTools.has(tool.name);
        const hasToggle = typeof tool.toggle === 'function';

        return `
            <div class="console-tool-card ${isExpanded ? 'expanded' : ''}" data-tool="${tool.name}">
                <div class="console-tool-header" data-action="expand-tool" data-tool="${tool.name}">
                    <span class="console-tool-icon">${tool.icon || 'C'}</span>
                    <div class="console-tool-info">
                        <span class="console-tool-name">${tool.name}</span>
                        <span class="console-tool-desc">${tool.description}</span>
                    </div>
                    <div class="console-tool-controls">
                        ${hasToggle ? `
                            <button class="console-tool-toggle ${isEnabled ? 'on' : 'off'}"
                                    data-action="toggle-tool"
                                    data-tool="${tool.name}"
                                    title="${isEnabled ? 'Disable' : 'Enable'}">
                                ${isEnabled ? 'ON' : 'OFF'}
                            </button>
                        ` : ''}
                        <span class="console-tool-expand-icon">${isExpanded ? 'v' : '>'}</span>
                    </div>
                </div>
                <div class="console-tool-commands ${isExpanded ? '' : 'collapsed'}">
                    ${this.renderCommands(tool)}
                </div>
            </div>
        `;
    }

    renderCommands(tool) {
        if (!tool.commands || tool.commands.length === 0) {
            return '<div class="console-tool-no-commands">No commands</div>';
        }

        return `
            <div class="console-tool-commands-grid">
                ${tool.commands.map(cmd => `
                    <button class="console-tool-cmd"
                            data-action="run-command"
                            data-tool="${tool.name}"
                            data-command="${cmd.name}"
                            title="${cmd.description || cmd.name}">
                        ${cmd.name}
                    </button>
                `).join('')}
            </div>
        `;
    }

    onMount(container = null) {
        if (container) {
            this.mountedContainer = container;
        }

        super.onMount(container);
        this.addStyles();
        this.attachToolListeners();

        // Subscribe to registry changes
        if (window.consoleTools?.onChange) {
            this.unsubscribe = window.consoleTools.onChange(() => {
                this.refreshList();
            });
        }
    }

    attachToolListeners() {
        const container = this.getContainer();
        if (!container) return;

        container.addEventListener('click', (e) => {
            const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
            const toolName = e.target.dataset.tool || e.target.closest('[data-tool]')?.dataset.tool;

            if (!action || !toolName) return;

            switch (action) {
                case 'expand-tool':
                    this.toggleExpand(toolName);
                    break;
                case 'toggle-tool':
                    e.stopPropagation();
                    this.toggleTool(toolName);
                    break;
                case 'run-command':
                    e.stopPropagation();
                    const cmdName = e.target.dataset.command;
                    this.runCommand(toolName, cmdName);
                    break;
            }
        });
    }

    toggleExpand(toolName) {
        if (this.expandedTools.has(toolName)) {
            this.expandedTools.delete(toolName);
        } else {
            this.expandedTools.add(toolName);
        }
        this.refreshList();
    }

    toggleTool(toolName) {
        const tool = window.consoleTools?.get(toolName);
        if (tool?.toggle) {
            tool.toggle();
            // Small delay to let the tool update its state
            setTimeout(() => this.refreshList(), 50);
        }
    }

    runCommand(toolName, cmdName) {
        const tool = window.consoleTools?.get(toolName);
        if (!tool) return;

        const cmd = tool.commands?.find(c => c.name === cmdName);
        if (cmd?.fn) {
            console.log(`%c[ConsoleTools] Running ${toolName}.${cmdName}()`, 'color: #2196F3');
            try {
                cmd.fn();
            } catch (err) {
                console.error(`[ConsoleTools] Error running ${toolName}.${cmdName}:`, err);
            }
        }
    }

    refreshList() {
        const container = this.getContainer();
        if (!container) return;

        const listEl = container.querySelector('#console-tools-list');
        if (listEl) {
            listEl.innerHTML = this.renderToolsList();
        }
    }

    getContainer() {
        return this.mountedContainer || this.element?.querySelector('.panel-body') || this.element;
    }

    addStyles() {
        if (document.getElementById('console-tools-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'console-tools-panel-styles';
        style.textContent = `
            .console-tools-panel {
                height: 100%;
                display: flex;
                flex-direction: column;
                font-family: var(--font-family-mono, monospace);
                font-size: var(--font-size-sm, 12px);
                background: var(--color-bg, #1e1e1e);
            }

            .console-tools-header {
                padding: var(--space-2, 8px) var(--space-3, 12px);
                border-bottom: 1px solid var(--color-border, #333);
            }

            .console-tools-subtitle {
                color: var(--color-text-secondary, #888);
                font-size: var(--font-size-xs, 11px);
            }

            .console-tools-list {
                flex: 1;
                overflow-y: auto;
                padding: var(--space-2, 8px);
            }

            .console-tools-empty {
                color: var(--color-text-secondary, #888);
                text-align: center;
                padding: var(--space-4, 16px);
                font-style: italic;
            }

            /* Tool Card */
            .console-tool-card {
                margin-bottom: var(--space-2, 8px);
                border: 1px solid var(--color-border, #333);
                border-radius: var(--radius-base, 4px);
                background: var(--color-bg-alt, #252525);
                overflow: hidden;
            }

            .console-tool-card.expanded {
                border-color: var(--color-primary, #4CAF50);
            }

            .console-tool-header {
                display: flex;
                align-items: center;
                gap: var(--space-2, 8px);
                padding: var(--space-2, 8px) var(--space-3, 12px);
                cursor: pointer;
                transition: background-color 0.15s;
            }

            .console-tool-header:hover {
                background: var(--color-bg-hover, #2a2a2a);
            }

            .console-tool-icon {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--color-bg, #1e1e1e);
                border-radius: var(--radius-sm, 2px);
                font-size: 14px;
            }

            .console-tool-info {
                flex: 1;
                min-width: 0;
            }

            .console-tool-name {
                display: block;
                font-weight: var(--font-weight-bold, 600);
                color: var(--color-text, #fff);
            }

            .console-tool-desc {
                display: block;
                font-size: var(--font-size-xs, 11px);
                color: var(--color-text-secondary, #888);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .console-tool-controls {
                display: flex;
                align-items: center;
                gap: var(--space-2, 8px);
            }

            .console-tool-toggle {
                padding: 2px 8px;
                border: none;
                border-radius: var(--radius-sm, 2px);
                font-size: var(--font-size-xs, 11px);
                font-weight: var(--font-weight-bold, 600);
                cursor: pointer;
                transition: all 0.15s;
            }

            .console-tool-toggle.off {
                background: var(--color-bg, #1e1e1e);
                color: var(--color-text-secondary, #888);
            }

            .console-tool-toggle.on {
                background: var(--color-success, #4CAF50);
                color: white;
            }

            .console-tool-toggle:hover {
                opacity: 0.8;
            }

            .console-tool-expand-icon {
                color: var(--color-text-secondary, #888);
                font-size: 10px;
                width: 12px;
                text-align: center;
            }

            /* Commands */
            .console-tool-commands {
                border-top: 1px solid var(--color-border, #333);
                padding: var(--space-2, 8px);
                background: var(--color-bg, #1e1e1e);
            }

            .console-tool-commands.collapsed {
                display: none;
            }

            .console-tool-commands-grid {
                display: flex;
                flex-wrap: wrap;
                gap: var(--space-1, 4px);
            }

            .console-tool-cmd {
                padding: var(--space-1, 4px) var(--space-2, 8px);
                border: 1px solid var(--color-border, #333);
                border-radius: var(--radius-sm, 2px);
                background: var(--color-bg-alt, #252525);
                color: var(--color-text, #fff);
                font-family: inherit;
                font-size: var(--font-size-xs, 11px);
                cursor: pointer;
                transition: all 0.15s;
            }

            .console-tool-cmd:hover {
                background: var(--color-primary, #4CAF50);
                border-color: var(--color-primary, #4CAF50);
                color: white;
            }

            .console-tool-no-commands {
                color: var(--color-text-secondary, #888);
                font-style: italic;
                font-size: var(--font-size-xs, 11px);
            }

            /* Scrollbar */
            .console-tools-list::-webkit-scrollbar {
                width: 4px;
            }

            .console-tools-list::-webkit-scrollbar-track {
                background: transparent;
            }

            .console-tools-list::-webkit-scrollbar-thumb {
                background: var(--color-border, #333);
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    onDestroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        super.onDestroy();
    }
}

panelRegistry.registerType('console-tools', ConsoleToolsPanel);

export function createConsoleToolsPanel(config = {}) {
    return new ConsoleToolsPanel(config);
}
