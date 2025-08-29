/**
 * External Dependencies Panel
 * Provides comprehensive oversight of all external JavaScript libraries and CSS dependencies
 */

import { BasePanel } from '/client/panels/BasePanel.js';

const log = window.APP.services.log.createLogger('ExternalDependenciesPanel');

export class ExternalDependenciesPanel extends BasePanel {
    constructor(options) {
        super({
            id: 'external-dependencies-panel',
            title: 'External Dependencies',
            ...options
        });
        
        this.dependencies = {
            vendor: new Map(),
            cdn: new Map(),
            nodeModules: new Map(),
            inline: new Set()
        };
        this.refreshInterval = null;

        log.info('EXT_DEPS', 'INSTANCE_CREATED', 'ExternalDependenciesPanel instance created.');
    }

    renderContent() {
        return `
            <div class="settings-section external-dependencies-panel" style="padding: 12px; font-family: var(--font-family-monospace, monospace); font-size: 12px;">
                <div class="ext-deps-header">
                    <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600;">External Dependencies Monitor</h4>
                    <div class="ext-deps-summary" style="margin-bottom: 16px; padding: 8px; background: var(--color-background-secondary, #f5f5f5); border-radius: 4px;">
                        <div class="summary-stats">Loading dependency information...</div>
                    </div>
                </div>
                <div class="ext-deps-content">
                    <div class="vendor-section"></div>
                    <div class="cdn-section"></div>
                    <div class="node-modules-section"></div>
                    <div class="inline-section"></div>
                </div>
                <div class="ext-deps-controls" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--color-border, #e0e0e0);">
                    <button class="refresh-deps-btn" style="padding: 6px 12px; background: var(--color-primary, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 8px;">
                        🔄 Refresh Dependencies
                    </button>
                    <button class="toggle-monitoring-btn" style="padding: 6px 12px; background: var(--color-secondary, #6c757d); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        ⏸️ Pause Monitoring
                    </button>
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);
        this.startMonitoring();
        this.setupEventListeners();
        this.scanDependencies();
    }

    setupEventListeners() {
        if (!this.element) return;

        const refreshBtn = this.element.querySelector('.refresh-deps-btn');
        const toggleBtn = this.element.querySelector('.toggle-monitoring-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.scanDependencies());
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleMonitoring());
        }
    }

    startMonitoring() {
        if (this.refreshInterval) return;
        
        this.refreshInterval = setInterval(() => {
            this.scanDependencies();
        }, 5000); // Scan every 5 seconds
        
        log.info('EXT_DEPS', 'MONITORING_STARTED', 'Dependency monitoring started.');
    }

    stopMonitoring() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            log.info('EXT_DEPS', 'MONITORING_STOPPED', 'Dependency monitoring stopped.');
        }
    }

    toggleMonitoring() {
        const toggleBtn = this.element?.querySelector('.toggle-monitoring-btn');
        
        if (this.refreshInterval) {
            this.stopMonitoring();
            if (toggleBtn) {
                toggleBtn.textContent = '▶️ Resume Monitoring';
                toggleBtn.style.background = 'var(--color-success, #28a745)';
            }
        } else {
            this.startMonitoring();
            if (toggleBtn) {
                toggleBtn.textContent = '⏸️ Pause Monitoring';
                toggleBtn.style.background = 'var(--color-secondary, #6c757d)';
            }
        }
    }

    scanDependencies() {
        try {
            this.scanScriptTags();
            this.scanLinkTags();
            this.scanInlineScripts();
            this.updateDisplay();
        } catch (error) {
            log.error('EXT_DEPS', 'SCAN_ERROR', 'Error scanning dependencies: ' + error.message, error);
        }
    }

    scanScriptTags() {
        const scripts = document.querySelectorAll('script[src]');
        this.dependencies.vendor.clear();
        this.dependencies.cdn.clear();
        this.dependencies.nodeModules.clear();

        scripts.forEach(script => {
            const src = script.src;
            if (!src) return;

            const info = {
                src,
                type: script.type || 'text/javascript',
                async: script.async,
                defer: script.defer,
                integrity: script.integrity || null,
                crossorigin: script.crossOrigin || null
            };

            if (src.includes('node_modules')) {
                this.dependencies.nodeModules.set(src, info);
            } else if (src.includes('cdn.') || src.includes('unpkg.') || src.includes('jsdelivr.')) {
                this.dependencies.cdn.set(src, info);
            } else if (src.includes('/vendor/') || src.includes('/lib/')) {
                this.dependencies.vendor.set(src, info);
            }
        });
    }

    scanLinkTags() {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        
        links.forEach(link => {
            const href = link.href;
            if (!href) return;

            const info = {
                href,
                media: link.media || 'all',
                integrity: link.integrity || null,
                crossorigin: link.crossOrigin || null
            };

            if (href.includes('node_modules')) {
                this.dependencies.nodeModules.set(href, info);
            } else if (href.includes('cdn.') || href.includes('unpkg.') || href.includes('jsdelivr.')) {
                this.dependencies.cdn.set(href, info);
            } else if (href.includes('/vendor/') || href.includes('/lib/')) {
                this.dependencies.vendor.set(href, info);
            }
        });
    }

    scanInlineScripts() {
        const inlineScripts = document.querySelectorAll('script:not([src])');
        this.dependencies.inline.clear();

        inlineScripts.forEach((script, index) => {
            const content = script.textContent || script.innerHTML;
            if (content.trim()) {
                this.dependencies.inline.add({
                    index,
                    type: script.type || 'text/javascript',
                    size: content.length,
                    preview: content.substring(0, 100) + (content.length > 100 ? '...' : '')
                });
            }
        });
    }

    updateDisplay() {
        if (!this.element) return;

        const summaryEl = this.element.querySelector('.summary-stats');
        const vendorEl = this.element.querySelector('.vendor-section');
        const cdnEl = this.element.querySelector('.cdn-section');
        const nodeModulesEl = this.element.querySelector('.node-modules-section');
        const inlineEl = this.element.querySelector('.inline-section');

        if (summaryEl) {
            const totalExternal = this.dependencies.vendor.size + this.dependencies.cdn.size + this.dependencies.nodeModules.size;
            summaryEl.innerHTML = `
                <strong>Summary:</strong> ${totalExternal} external dependencies, ${this.dependencies.inline.size} inline scripts
                <br><small>Last updated: ${new Date().toLocaleTimeString()}</small>
            `;
        }

        if (vendorEl) {
            vendorEl.innerHTML = this.renderDependencySection('Vendor Libraries', this.dependencies.vendor);
        }

        if (cdnEl) {
            cdnEl.innerHTML = this.renderDependencySection('CDN Dependencies', this.dependencies.cdn);
        }

        if (nodeModulesEl) {
            nodeModulesEl.innerHTML = this.renderDependencySection('Node Modules', this.dependencies.nodeModules);
        }

        if (inlineEl) {
            inlineEl.innerHTML = this.renderInlineSection();
        }
    }

    renderDependencySection(title, dependencies) {
        if (dependencies.size === 0) {
            return `<div style="margin-bottom: 16px;"><h5 style="margin: 0 0 8px 0; color: var(--color-text-secondary, #666);">${title} (0)</h5></div>`;
        }

        let html = `<div style="margin-bottom: 16px;"><h5 style="margin: 0 0 8px 0; color: var(--color-text-primary, #333);">${title} (${dependencies.size})</h5>`;
        
        dependencies.forEach((info, url) => {
            const isScript = url.includes('.js') || info.type?.includes('javascript');
            const icon = isScript ? '📜' : '🎨';
            const fileName = url.split('/').pop() || url;
            
            html += `
                <div style="margin-bottom: 4px; padding: 4px 8px; background: var(--color-background-tertiary, #fafafa); border-radius: 3px; font-size: 11px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>${icon}</span>
                        <span style="font-weight: 500; color: var(--color-text-primary, #333);">${fileName}</span>
                        ${info.async ? '<span style="background: #28a745; color: white; padding: 1px 4px; border-radius: 2px; font-size: 9px;">ASYNC</span>' : ''}
                        ${info.defer ? '<span style="background: #ffc107; color: black; padding: 1px 4px; border-radius: 2px; font-size: 9px;">DEFER</span>' : ''}
                    </div>
                    <div style="font-size: 10px; color: var(--color-text-secondary, #666); margin-top: 2px; word-break: break-all;">
                        ${url}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    renderInlineSection() {
        if (this.dependencies.inline.size === 0) {
            return `<div style="margin-bottom: 16px;"><h5 style="margin: 0 0 8px 0; color: var(--color-text-secondary, #666);">Inline Scripts (0)</h5></div>`;
        }

        let html = `<div style="margin-bottom: 16px;"><h5 style="margin: 0 0 8px 0; color: var(--color-text-primary, #333);">Inline Scripts (${this.dependencies.inline.size})</h5>`;
        
        this.dependencies.inline.forEach(info => {
            html += `
                <div style="margin-bottom: 4px; padding: 4px 8px; background: var(--color-background-tertiary, #fafafa); border-radius: 3px; font-size: 11px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>📝</span>
                        <span style="font-weight: 500;">Script #${info.index + 1}</span>
                        <span style="background: #17a2b8; color: white; padding: 1px 4px; border-radius: 2px; font-size: 9px;">${info.size} chars</span>
                    </div>
                    <div style="font-size: 10px; color: var(--color-text-secondary, #666); margin-top: 2px; font-family: monospace;">
                        ${info.preview}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    destroy() {
        this.stopMonitoring();
        log.info('EXT_DEPS', 'DESTROYED', 'ExternalDependenciesPanel destroyed.');
        super.destroy();
    }
}