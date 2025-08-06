/**
 * External Dependencies Panel
 * Provides comprehensive oversight of all external JavaScript libraries and CSS dependencies
 */

const log = window.APP.services.log.createLogger('ExternalDependenciesPanel');

export class ExternalDependenciesPanel {
    constructor(parentElement) {
        this.containerElement = null;
        this.dependencies = {
            vendor: new Map(),
            cdn: new Map(),
            nodeModules: new Map(),
            inline: new Set()
        };
        this.refreshInterval = null;

        if (!parentElement) {
            log.error('EXT_DEPS', 'NO_PARENT_ELEMENT', 'ExternalDependenciesPanel requires a parent element.');
            return;
        }

        this.createPanelContent(parentElement);
        this.startMonitoring();
        log.info('EXT_DEPS', 'INSTANCE_CREATED', 'ExternalDependenciesPanel instance created.');
    }

    createPanelContent(parentElement) {
        this.containerElement = document.createElement('div');
        this.containerElement.classList.add('settings-section', 'external-dependencies-panel');
        this.containerElement.style.padding = '12px';
        this.containerElement.style.fontFamily = 'var(--font-family-monospace, monospace)';
        this.containerElement.style.fontSize = '12px';

        // Add initial content
        this.containerElement.innerHTML = `
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
                <button class="refresh-btn" style="background: var(--color-primary, #0066cc); color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                    Refresh
                </button>
                <button class="export-btn" style="background: var(--color-secondary, #6c757d); color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 11px; margin-left: 8px;">
                    Export Report
                </button>
            </div>
        `;

        parentElement.appendChild(this.containerElement);
        this.setupEventListeners();
        this.refreshDependencies();
    }

    setupEventListeners() {
        const refreshBtn = this.containerElement.querySelector('.refresh-btn');
        const exportBtn = this.containerElement.querySelector('.export-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDependencies());
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }
    }

    startMonitoring() {
        // Refresh every 5 seconds to catch dynamic loads
        this.refreshInterval = setInterval(() => {
            this.refreshDependencies();
        }, 5000);
    }

    refreshDependencies() {
        this.scanVendorDependencies();
        this.scanCDNDependencies();
        this.scanNodeModulesDependencies();
        this.scanInlineDependencies();
        this.updateDisplay();
    }

    scanVendorDependencies() {
        this.dependencies.vendor.clear();
        
        // Scan script tags pointing to /client/vendor/scripts/
        document.querySelectorAll('script[src*="/client/vendor/scripts/"]').forEach(script => {
            const src = script.src;
            const filename = src.split('/').pop();
            this.dependencies.vendor.set(filename, {
                type: 'script',
                src: src,
                loaded: !script.hasAttribute('data-loading'),
                size: this.estimateSize(script),
                element: script
            });
        });

        // Scan link tags pointing to /client/vendor/styles/
        document.querySelectorAll('link[href*="/client/vendor/styles/"]').forEach(link => {
            const href = link.href;
            const filename = href.split('/').pop();
            this.dependencies.vendor.set(filename, {
                type: 'stylesheet',
                src: href,
                loaded: link.sheet !== null,
                size: this.estimateSize(link),
                element: link
            });
        });

        // Check for dynamic imports from vendor
        this.scanDynamicImports('/client/vendor/scripts/', this.dependencies.vendor);
    }

    scanCDNDependencies() {
        this.dependencies.cdn.clear();
        
        // Scan for CDN script tags
        document.querySelectorAll('script[src*="://"]').forEach(script => {
            if (script.src.includes('cdn.') || script.src.includes('unpkg.') || script.src.includes('jsdelivr.')) {
                const url = new URL(script.src);
                const key = `${url.hostname}${url.pathname}`;
                this.dependencies.cdn.set(key, {
                    type: 'script',
                    src: script.src,
                    domain: url.hostname,
                    loaded: !script.hasAttribute('data-loading'),
                    size: this.estimateSize(script),
                    element: script
                });
            }
        });

        // Scan for CDN link tags
        document.querySelectorAll('link[href*="://"]').forEach(link => {
            if (link.href.includes('cdn.') || link.href.includes('unpkg.') || link.href.includes('jsdelivr.')) {
                const url = new URL(link.href);
                const key = `${url.hostname}${url.pathname}`;
                this.dependencies.cdn.set(key, {
                    type: 'stylesheet',
                    src: link.href,
                    domain: url.hostname,
                    loaded: link.sheet !== null,
                    size: this.estimateSize(link),
                    element: link
                });
            }
        });
    }

    scanNodeModulesDependencies() {
        this.dependencies.nodeModules.clear();
        
        // Scan for /node_modules/ references
        document.querySelectorAll('script[src*="/node_modules/"]').forEach(script => {
            const src = script.src;
            const pathParts = src.split('/node_modules/')[1].split('/');
            const packageName = pathParts[0];
            this.dependencies.nodeModules.set(packageName, {
                type: 'script',
                src: src,
                package: packageName,
                loaded: !script.hasAttribute('data-loading'),
                size: this.estimateSize(script),
                element: script
            });
        });

        this.scanDynamicImports('/node_modules/', this.dependencies.nodeModules);
    }

    scanInlineDependencies() {
        this.dependencies.inline.clear();
        
        // Scan for inline scripts and styles
        document.querySelectorAll('script:not([src])').forEach(script => {
            if (script.textContent.trim()) {
                this.dependencies.inline.add({
                    type: 'inline-script',
                    content: script.textContent.substring(0, 100) + '...',
                    size: script.textContent.length,
                    element: script
                });
            }
        });

        document.querySelectorAll('style').forEach(style => {
            if (style.textContent.trim()) {
                this.dependencies.inline.add({
                    type: 'inline-style',
                    content: style.textContent.substring(0, 100) + '...',
                    size: style.textContent.length,
                    element: style
                });
            }
        });
    }

    scanDynamicImports(pathPrefix, targetMap) {
        // This is a simplified approach - in reality, tracking dynamic imports is complex
        // We can at least check for common patterns in loaded modules
        if (window.performance && window.performance.getEntriesByType) {
            const resourceEntries = window.performance.getEntriesByType('resource');
            resourceEntries.forEach(entry => {
                if (entry.name.includes(pathPrefix)) {
                    const key = entry.name.split('/').pop();
                    if (!targetMap.has(key)) {
                        targetMap.set(key, {
                            type: 'dynamic-import',
                            src: entry.name,
                            loaded: true,
                            loadTime: entry.duration,
                            size: entry.transferSize || 'unknown'
                        });
                    }
                }
            });
        }
    }

    estimateSize(element) {
        // Try to get actual size from performance API
        if (window.performance && window.performance.getEntriesByType) {
            const resourceEntries = window.performance.getEntriesByType('resource');
            const src = element.src || element.href;
            const entry = resourceEntries.find(r => r.name === src);
            if (entry && entry.transferSize) {
                return this.formatBytes(entry.transferSize);
            }
        }
        return 'unknown';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    updateDisplay() {
        const totalVendor = this.dependencies.vendor.size;
        const totalCDN = this.dependencies.cdn.size;
        const totalNodeModules = this.dependencies.nodeModules.size;
        const totalInline = this.dependencies.inline.size;
        const total = totalVendor + totalCDN + totalNodeModules + totalInline;

        // Update summary
        const summaryEl = this.containerElement.querySelector('.summary-stats');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div><strong>Total Dependencies:</strong> ${total}</div>
                <div style="margin-top: 4px;">
                    Vendor: ${totalVendor} | CDN: ${totalCDN} | node_modules: ${totalNodeModules} | Inline: ${totalInline}
                </div>
            `;
        }

        // Update sections
        this.renderSection('vendor-section', 'Vendor Scripts (/client/vendor/)', this.dependencies.vendor);
        this.renderSection('cdn-section', 'CDN Dependencies', this.dependencies.cdn);
        this.renderSection('node-modules-section', 'Node Modules', this.dependencies.nodeModules);
        this.renderInlineSection();
    }

    renderSection(sectionClass, title, dependencyMap) {
        const sectionEl = this.containerElement.querySelector(`.${sectionClass}`);
        if (!sectionEl) return;

        if (dependencyMap.size === 0) {
            sectionEl.innerHTML = `
                <h5 style="margin: 12px 0 6px 0; font-size: 12px; font-weight: 600;">${title}</h5>
                <div style="color: var(--color-foreground-muted, #666); font-style: italic;">None detected</div>
            `;
            return;
        }

        let html = `<h5 style="margin: 12px 0 6px 0; font-size: 12px; font-weight: 600;">${title}</h5>`;
        html += '<div style="margin-left: 8px;">';

        dependencyMap.forEach((dep, key) => {
            const statusIcon = dep.loaded ? '✅' : '⏳';
            const typeIcon = dep.type === 'script' ? '📄' : dep.type === 'stylesheet' ? '🎨' : '📦';
            
            html += `
                <div style="margin-bottom: 6px; padding: 4px; background: var(--color-background-tertiary, #fafafa); border-radius: 3px;">
                    <div style="font-weight: 500;">${typeIcon} ${key} ${statusIcon}</div>
                    <div style="font-size: 10px; color: var(--color-foreground-muted, #666); margin-top: 2px;">
                        Size: ${dep.size || 'unknown'}
                        ${dep.domain ? ` | Domain: ${dep.domain}` : ''}
                        ${dep.loadTime ? ` | Load: ${dep.loadTime.toFixed(1)}ms` : ''}
                    </div>
                    <div style="font-size: 10px; color: var(--color-foreground-muted, #666); word-break: break-all;">
                        ${dep.src}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        sectionEl.innerHTML = html;
    }

    renderInlineSection() {
        const sectionEl = this.containerElement.querySelector('.inline-section');
        if (!sectionEl) return;

        if (this.dependencies.inline.size === 0) {
            sectionEl.innerHTML = `
                <h5 style="margin: 12px 0 6px 0; font-size: 12px; font-weight: 600;">Inline Scripts & Styles</h5>
                <div style="color: var(--color-foreground-muted, #666); font-style: italic;">None detected</div>
            `;
            return;
        }

        let html = '<h5 style="margin: 12px 0 6px 0; font-size: 12px; font-weight: 600;">Inline Scripts & Styles</h5>';
        html += '<div style="margin-left: 8px;">';

        this.dependencies.inline.forEach((dep, index) => {
            const typeIcon = dep.type === 'inline-script' ? '📄' : '🎨';
            
            html += `
                <div style="margin-bottom: 6px; padding: 4px; background: var(--color-background-tertiary, #fafafa); border-radius: 3px;">
                    <div style="font-weight: 500;">${typeIcon} ${dep.type} (${this.formatBytes(dep.size)})</div>
                    <div style="font-size: 10px; color: var(--color-foreground-muted, #666); margin-top: 2px;">
                        <code style="background: var(--color-background-secondary, #f0f0f0); padding: 2px 4px; border-radius: 2px;">
                            ${dep.content}
                        </code>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        sectionEl.innerHTML = html;
    }

    exportReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.dependencies.vendor.size + this.dependencies.cdn.size + this.dependencies.nodeModules.size + this.dependencies.inline.size,
                vendor: this.dependencies.vendor.size,
                cdn: this.dependencies.cdn.size,
                nodeModules: this.dependencies.nodeModules.size,
                inline: this.dependencies.inline.size
            },
            dependencies: {
                vendor: Array.from(this.dependencies.vendor.entries()),
                cdn: Array.from(this.dependencies.cdn.entries()),
                nodeModules: Array.from(this.dependencies.nodeModules.entries()),
                inline: Array.from(this.dependencies.inline)
            }
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `external-dependencies-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        log.info('EXT_DEPS', 'REPORT_EXPORTED', 'Dependency report exported successfully.');
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        log.info('EXT_DEPS', 'DESTROYED', 'ExternalDependenciesPanel destroyed.');
    }
}