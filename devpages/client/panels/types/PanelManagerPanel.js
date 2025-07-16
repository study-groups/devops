import { panelRegistry } from '/client/panels/core/panelRegistry.js';
import { BasePanel } from '/client/panels/core/BasePanel.js';

export class PanelManagerPanel extends BasePanel {
    constructor() {
        super('panel-manager', {
            width: 280,
            minWidth: 250,
            maxWidth: 400,
            resizable: false,
            collapsible: true,
            order: 0
        });
        
        this.mode = 'all'; // 'all' or 'individual'
        this.isSticky = true;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'panel-manager-container';
        
        // Create the sticky header
        const header = this.createHeader();
        container.appendChild(header);
        
        // Create the content area
        const content = this.createContent();
        container.appendChild(content);
        
        return container;
    }

    createHeader() {
        const header = document.createElement('div');
        header.className = 'panel-manager-header';
        
        const titleElement = document.createElement('span');
        titleElement.className = 'panel-manager-header__title';
        titleElement.textContent = 'Panel Manager';
        
        const actionsElement = document.createElement('div');
        actionsElement.className = 'panel-manager-header__actions';

        // Mode toggle button
        const modeToggleBtn = document.createElement('button');
        modeToggleBtn.className = 'panel-manager-header__button';
        modeToggleBtn.title = 'Toggle Mode';
        modeToggleBtn.addEventListener('click', () => this.toggleMode());
        modeToggleBtn.innerHTML = this.mode === 'all' ? '⌄' : '☰';

        // Collapse All Panels button (only in 'all' mode)
        const collapseAllBtn = document.createElement('button');
        collapseAllBtn.className = 'panel-manager-header__button';
        collapseAllBtn.title = 'Collapse All Panels';
        collapseAllBtn.addEventListener('click', () => this.collapseAllPanels());
        collapseAllBtn.innerHTML = '⌄';
        collapseAllBtn.style.display = this.mode === 'all' ? 'block' : 'none';

        // Expand All Panels button (only in 'all' mode)
        const expandAllBtn = document.createElement('button');
        expandAllBtn.className = 'panel-manager-header__button';
        expandAllBtn.title = 'Expand All Panels';
        expandAllBtn.addEventListener('click', () => this.expandAllPanels());
        expandAllBtn.innerHTML = '⌃';
        expandAllBtn.style.display = this.mode === 'all' ? 'block' : 'none';

        actionsElement.appendChild(modeToggleBtn);
        actionsElement.appendChild(collapseAllBtn);
        actionsElement.appendChild(expandAllBtn);

        header.appendChild(titleElement);
        header.appendChild(actionsElement);

        return header;
    }

    createContent() {
        const content = document.createElement('div');
        content.className = 'panel-manager-content';
        
        if (this.mode === 'all') {
            // Show individual panel toggles
            const togglesContainer = document.createElement('div');
            togglesContainer.className = 'panel-manager-toggles';
            
            const panels = panelRegistry.getAllPanels().filter(p => p.group === 'sidebar');
            const sortedPanels = panels.sort((a, b) => (a.priority || 50) - (b.priority || 50));

            sortedPanels.forEach(panel => {
                if (panel.id === 'panel-manager') return;
                
                const toggle = this.createToggle(panel);
                togglesContainer.appendChild(toggle);
            });
            
            content.appendChild(togglesContainer);
        } else {
            // Show mode-specific content
            const modeContent = document.createElement('div');
            modeContent.className = 'panel-manager-mode-content';
            modeContent.innerHTML = '<p>Individual panel management mode</p>';
            content.appendChild(modeContent);
        }

        return content;
    }

    createToggle(panel) {
        const toggle = document.createElement('div');
        toggle.className = 'panel-toggle';
        toggle.dataset.panelId = panel.id;
        toggle.title = `Toggle ${panel.title}`;

        const iconClass = `icon-${panel.icon || 'default'}`;
        toggle.innerHTML = `<span class="icon ${iconClass}"></span>`;

        return toggle;
    }

    toggleMode() {
        this.mode = this.mode === 'all' ? 'individual' : 'all';
        this.updateHeader();
        this.updateContent();
    }

    updateHeader() {
        const header = document.querySelector('.panel-manager-header');
        if (!header) return;

        const modeToggleBtn = header.querySelector('.panel-manager-header__button');
        const collapseAllBtn = header.querySelectorAll('.panel-manager-header__button')[1];
        const expandAllBtn = header.querySelectorAll('.panel-manager-header__button')[2];

        if (modeToggleBtn) {
            modeToggleBtn.innerHTML = this.mode === 'all' ? '⌄' : '☰';
        }

        if (collapseAllBtn) {
            collapseAllBtn.style.display = this.mode === 'all' ? 'block' : 'none';
        }

        if (expandAllBtn) {
            expandAllBtn.style.display = this.mode === 'all' ? 'block' : 'none';
        }
    }

    updateContent() {
        const content = document.querySelector('.panel-manager-content');
        if (!content) return;

        content.innerHTML = '';
        const newContent = this.createContent();
        content.appendChild(newContent.firstChild);
    }

    collapseAllPanels() {
        if (!window.panelManager) return;
        
        window.panelManager.panelConfigs.forEach(p => {
            if (p.id !== 'panel-manager') {
                p.isCollapsed = true;
            }
        });
        window.panelManager.renderPanels();
        window.panelManager.savePanelState();
    }

    expandAllPanels() {
        if (!window.panelManager) return;
        
        window.panelManager.panelConfigs.forEach(p => {
            p.isCollapsed = false;
        });
        window.panelManager.renderPanels();
        window.panelManager.savePanelState();
    }

    onActivate(panelContentElement) {
        panelContentElement.addEventListener('click', e => {
            const toggle = e.target.closest('.panel-toggle');
            if (toggle) {
                const panelId = toggle.dataset.panelId;
                if (panelId && window.panelManager) {
                    const panelConfig = window.panelManager.panelConfigs.find(p => p.id === panelId);
                    if (panelConfig) {
                        window.panelManager.togglePanelCollapse(panelId);
                    }
                }
            }
        });
    }
} 