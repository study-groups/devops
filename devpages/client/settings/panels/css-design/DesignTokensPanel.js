/**
 * DesignTokensPanel.js - Design Tokens Viewer (Settings Integration)
 * REFACTORED to use the new PanelInterface.
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { settingsRegistry } from '../../core/settingsRegistry.js';

export class DesignTokensPanel extends BasePanel {
    constructor(options = {}) {
        super(options);
        this.tokens = [];
        this.currentFilter = 'all';
        this.viewMode = 'list';
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'theme-editor-panel';
        this.element.innerHTML = `
            <div class="theme-editor-header">
                <h3>Design Tokens</h3>
                <p>Browse and explore design tokens used in the application.</p>
                <div class="token-stats" id="token-stats">Loading tokens...</div>
                <button class="btn btn-secondary btn-sm refresh-btn" id="refresh-tokens">Refresh Tokens</button>
            </div>
            <div class="token-controls">
                <div class="token-filters" id="token-filters"></div>
                <div class="token-view-modes">
                    <button class="view-mode-btn active" data-view="list">List View</button>
                    <button class="view-mode-btn" data-view="grid">Grid View</button>
                </div>
            </div>
            <div class="token-categories" id="token-categories"></div>
        `;
        return this.element;
    }

    async onMount(container) {
        super.onMount(container);
        await this.loadDesignTokens();
        this.attachEventListeners();
    }

    // REMOVED: Custom inline styles that override the beautiful original CSS
    
    attachEventListeners() {
        this.element.querySelector('#refresh-tokens').addEventListener('click', () => this.loadDesignTokens());
        this.element.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setViewMode(btn.dataset.view));
        });
        this.element.querySelector('#token-filters').addEventListener('click', (e) => {
            if (e.target.classList.contains('token-filter-badge')) {
                this.applyFilter(e.target.dataset.filter);
            }
        });
    }

    async loadDesignTokens() {
        // Simplified token loading logic
        this.tokens = [];
        const cssFiles = ['/client/styles/design-system.css'];
        for (const file of cssFiles) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    const cssText = await response.text();
                    this.tokens.push(...this.parseTokensFromCSS(cssText));
                }
            } catch (error) {
                console.warn(`Could not load ${file}:`, error);
            }
        }
        this.renderTokens();
    }
    
    parseTokensFromCSS(cssText) {
        const tokens = [];
        const tokenRegex = /--([a-zA-Z0-9-_]+):\s*([^;]+);/g;
        let match;
        while ((match = tokenRegex.exec(cssText)) !== null) {
            const variable = `--${match[1]}`;
            const value = match[2].trim();
            tokens.push({ variable, value, category: this.categorizeToken(variable) });
        }
        return tokens;
    }

    categorizeToken(variable) {
        if (variable.startsWith('--color-')) return 'Colors';
        if (variable.startsWith('--font-')) return 'Typography';
        if (variable.startsWith('--space-')) return 'Spacing';
        return 'Other';
    }

    renderTokens() {
        this.renderFilterBadges();
        this.updateTokensDisplay();
        this.updateStats();
    }

    renderFilterBadges() {
        const filterContainer = this.element.querySelector('#token-filters');
        const categories = ['all', ...new Set(this.tokens.map(t => t.category))];
        filterContainer.innerHTML = categories.map(cat => 
            `<button class="token-filter-badge ${this.currentFilter === cat ? 'active' : ''}" data-filter="${cat}">${cat}</button>`
        ).join('');
    }

    updateTokensDisplay() {
        const container = this.element.querySelector('#token-categories');
        const filtered = this.tokens.filter(t => this.currentFilter === 'all' || t.category === this.currentFilter);
        
        if (this.viewMode === 'grid' && this.currentFilter === 'Colors') {
            container.innerHTML = this.renderColorGrid(filtered);
        } else {
            container.innerHTML = filtered.map(token => this.renderTokenItem(token)).join('');
        }
    }

    renderTokenItem(token) {
        const isColor = token.category === 'Colors';
        return `
            <div class="token-row">
                ${isColor ? `<div class="color-swatch" style="background-color: ${token.value};"></div>` : ''}
                <span class="token-var">${token.variable}</span>
                <span class="token-value">${token.value}</span>
            </div>
        `;
    }

    renderColorGrid(colorTokens) {
        return `<div class="color-grid">` + colorTokens.map(token => 
            `<div class="grid-swatch" style="background-color: ${token.value};" title="${token.variable}"></div>`
        ).join('') + `</div>`;
    }

    updateStats() {
        const statsContainer = this.element.querySelector('#token-stats');
        statsContainer.textContent = `Total: ${this.tokens.length}`;
    }
    
    setViewMode(mode) {
        this.viewMode = mode;
        this.element.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });
        this.updateTokensDisplay();
    }

    applyFilter(filter) {
        this.currentFilter = filter;
        this.renderTokens();
    }
}
