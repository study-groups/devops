/**
 * @file client/panels/SidebarManagerPanel.js
 * @description Manages the registration and lifecycle of sidebar panels.
 * This panel is a specialized container that holds other panels,
 */

import { panelRegistry } from '/client/panels/panelRegistry.js';
import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
import { collapseAllPanels } from '/client/store/slices/panelSlice.js';

export class SidebarManagerPanel extends BasePanel {
    constructor() {
        super({
            id: 'panel-manager', // Keep ID for stability
            title: 'Sidebar Manager'
        });

        this.mode = 'tabbed'; // 'tabbed' or 'focus'
        this.container = null;
        this.header = null;
        this.content = null;

        // Explicitly bind 'this' to ensure correct context in event handlers
        this.setMode = this.setMode.bind(this);
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'panel-manager-container';
        this.container.dataset.mode = this.mode;
        
        this.header = this.createHeader();
        this.container.appendChild(this.header);
        
        this.content = this.createContent();
        this.container.appendChild(this.content);
        
        return this.container;
    }

    createHeader() {
        const header = document.createElement('div');
        header.className = 'panel-manager-header';

        const actions = document.createElement('div');
        actions.className = 'panel-manager-header__actions';

        const focusButton = this.createHeaderButton('Focus Mode', 'focus-mode', this.mode === 'focus');
        actions.appendChild(focusButton);

        const tabbedButton = this.createHeaderButton('Tabbed Mode', 'tabbed-mode', this.mode === 'tabbed');
        actions.appendChild(tabbedButton);

        const collapseAllButton = this.createHeaderButton('Collapse All', 'collapse-all', false, 'collapse-all');
        actions.appendChild(collapseAllButton);

        header.appendChild(actions);

        // Event Listeners
        focusButton.addEventListener('click', () => this.setMode('focus'));
        tabbedButton.addEventListener('click', () => this.setMode('tabbed'));

        collapseAllButton.addEventListener('click', () => {
            appStore.dispatch(collapseAllPanels({ group: 'sidebar' }));
        });

        return header;
    }

    createHeaderButton(title, mode, isActive, iconClass = null) {
        const button = document.createElement('button');
        button.className = 'panel-manager-header__button';
        if (isActive) {
            button.classList.add('panel-manager-header__button--active');
        }
        button.title = title;
        button.dataset.mode = mode;

        const icon = document.createElement('span');
        icon.className = `icon icon-${iconClass || mode}`;
        button.appendChild(icon);

        return button;
    }

    createContent() {
        const content = document.createElement('div');
        content.className = 'panel-manager-content';
        
        if (this.mode === 'tabbed') {
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
            // 'focus' mode is handled by CSS, no extra content needed here.
        }

        return content;
    }

    setMode(mode) {
        if (this.mode === mode || !this.container) {
            return;
        }
        this.mode = mode;
        this.container.dataset.mode = this.mode;

        // Re-render header to update active button
        const newHeader = this.createHeader();
        this.container.replaceChild(newHeader, this.header);
        this.header = newHeader;

        // Re-render content to show/hide toggles
        const newContent = this.createContent();
        this.container.replaceChild(newContent, this.content);
        this.content = newContent;
    }

    createToggle(panel) {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'panel-toggle';
        toggleContainer.title = `Toggle ${panel.title}`;
        toggleContainer.dataset.panelId = panel.id;

        // Add a class to indicate visibility state
        if (panel.isVisible) {
            toggleContainer.classList.add('is-visible');
        }

        // Icon
        const icon = document.createElement('div');
        icon.className = 'panel-toggle__icon';
        if (panel.icon) {
            const iconPath = `/client/styles/icons/${panel.icon}.svg`;
            icon.innerHTML = `<img src="${iconPath}" alt="${panel.title} icon">`;
        }
        
        // Title
        const title = document.createElement('span');
        title.className = 'panel-toggle__title';
        title.textContent = panel.title;

        toggleContainer.appendChild(icon);
        toggleContainer.appendChild(title);

        toggleContainer.addEventListener('click', () => {
            panelRegistry.togglePanelVisibility(panel.id);
            toggleContainer.classList.toggle('is-visible');
        });

        return toggleContainer;
    }

    toggleMode() {
        this.setMode(this.mode === 'tabbed' ? 'focus' : 'tabbed');
    }

    collapseAllPanels() {
        // Future implementation
    }

    expandAllPanels() {
        // Future implementation
    }
} 