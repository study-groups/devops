/**
 * ASTPreviewView.js - AST-based preview for JavaScript files
 * Shows code outline with functions, classes, imports in a navigable view
 */

import { ViewInterface } from '/client/layout/ViewInterface.js';
import { appStore } from '/client/appState.js';
import { parseJavaScript, clearAst } from '/client/store/slices/astSlice.js';
import { eventBus } from '/client/eventBus.js';

export class ASTPreviewView extends ViewInterface {
    constructor(options = {}) {
        super({
            id: 'ast-preview-view',
            title: 'Code Structure',
            ...options
        });

        this.viewMode = 'outline'; // 'outline' | 'tree' | 'graph'
        this.unsubscribe = null;
        this.lastRenderedHash = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'ast-preview-container';
        container.innerHTML = `
            <style>
                .ast-preview-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    font-family: var(--font-mono, 'SF Mono', Monaco, monospace);
                    font-size: 13px;
                    background: var(--bg-primary, #1e1e1e);
                    color: var(--text-primary, #d4d4d4);
                }
                .ast-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--border-color, #333);
                    background: var(--bg-secondary, #252526);
                }
                .ast-toolbar select {
                    background: var(--bg-tertiary, #3c3c3c);
                    color: var(--text-primary, #d4d4d4);
                    border: 1px solid var(--border-color, #555);
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                }
                .ast-toolbar .ast-stats {
                    margin-left: auto;
                    font-size: 11px;
                    color: var(--text-muted, #888);
                }
                .ast-content {
                    flex: 1;
                    overflow: auto;
                    padding: 12px;
                }
                .ast-placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--text-muted, #666);
                    font-style: italic;
                }
                .ast-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--text-muted, #888);
                }
                .ast-error {
                    padding: 16px;
                    color: var(--color-error, #f44);
                    background: var(--bg-error, rgba(255,68,68,0.1));
                    border-radius: 4px;
                    margin: 8px;
                }
                .ast-section {
                    margin-bottom: 16px;
                }
                .ast-section h4 {
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: var(--text-muted, #888);
                    margin: 0 0 8px 0;
                    padding-bottom: 4px;
                    border-bottom: 1px solid var(--border-color, #333);
                }
                .ast-item {
                    display: flex;
                    align-items: center;
                    padding: 4px 8px;
                    cursor: pointer;
                    border-radius: 3px;
                    transition: background 0.1s;
                }
                .ast-item:hover {
                    background: var(--bg-hover, rgba(255,255,255,0.05));
                }
                .ast-item.ast-function .ast-icon { color: #dcdcaa; }
                .ast-item.ast-class .ast-icon { color: #4ec9b0; }
                .ast-item.ast-import .ast-icon { color: #c586c0; }
                .ast-item.ast-variable .ast-icon { color: #9cdcfe; }
                .ast-item.ast-method .ast-icon { color: #dcdcaa; opacity: 0.8; }
                .ast-icon {
                    width: 20px;
                    font-weight: bold;
                    flex-shrink: 0;
                }
                .ast-name {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .ast-meta {
                    font-size: 11px;
                    color: var(--text-muted, #666);
                    margin-left: 8px;
                }
                .ast-line {
                    font-size: 10px;
                    color: var(--text-muted, #555);
                    margin-left: 8px;
                }
                .ast-methods {
                    margin-left: 20px;
                    border-left: 1px solid var(--border-color, #333);
                    padding-left: 8px;
                }
                .ast-exported {
                    font-size: 9px;
                    background: var(--color-success, #4caf50);
                    color: #fff;
                    padding: 1px 4px;
                    border-radius: 2px;
                    margin-left: 6px;
                }
            </style>
            <div class="ast-toolbar">
                <select id="ast-view-mode" class="ast-mode-select">
                    <option value="outline">Outline</option>
                    <option value="tree" disabled>Tree View (soon)</option>
                    <option value="graph" disabled>Graph (soon)</option>
                </select>
                <span class="ast-stats" id="ast-stats"></span>
            </div>
            <div class="ast-content" id="ast-content">
                <div class="ast-placeholder">
                    Select a JavaScript file to view its structure
                </div>
            </div>
        `;
        return container;
    }

    onMount(container) {
        // Subscribe to Redux store updates
        this.unsubscribe = appStore.subscribe(() => {
            this.handleStateChange();
        });

        // Handle view mode changes
        const modeSelect = this.element?.querySelector('#ast-view-mode');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                this.viewMode = e.target.value;
                this.renderContent();
            });
        }

        // Initial render
        this.handleStateChange();
    }

    onUnmount() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    handleStateChange() {
        const state = appStore.getState();
        const { file, ast } = state;

        // Update stats display
        this.updateStats(ast);

        // Check if we need to parse
        const filePath = file?.currentFile?.pathname;
        const content = file?.currentFile?.content;

        if (filePath && content && this.isJavaScriptFile(filePath)) {
            // Only trigger parse if we haven't parsed this content yet
            if (ast.lastParsedPath !== filePath || ast.status === 'idle') {
                appStore.dispatch(parseJavaScript({ code: content, filePath }));
            }
        }

        // Render content if AST has changed
        if (ast.lastHash !== this.lastRenderedHash || ast.status !== this.lastStatus) {
            this.lastRenderedHash = ast.lastHash;
            this.lastStatus = ast.status;
            this.renderContent();
        }
    }

    isJavaScriptFile(pathname) {
        if (!pathname) return false;
        return pathname.endsWith('.js') || pathname.endsWith('.mjs') || pathname.endsWith('.jsx');
    }

    updateStats(ast) {
        const statsEl = this.element?.querySelector('#ast-stats');
        if (!statsEl) return;

        if (ast.stats) {
            statsEl.textContent = `${ast.stats.functionCount} functions, ${ast.stats.classCount} classes, ${ast.stats.importCount} imports`;
        } else {
            statsEl.textContent = '';
        }
    }

    renderContent() {
        const contentEl = this.element?.querySelector('#ast-content');
        if (!contentEl) return;

        const state = appStore.getState();
        const { ast, file } = state;

        // Check if current file is JavaScript
        const filePath = file?.currentFile?.pathname;
        if (!filePath || !this.isJavaScriptFile(filePath)) {
            contentEl.innerHTML = '<div class="ast-placeholder">Select a JavaScript file to view its structure</div>';
            return;
        }

        // Handle loading state
        if (ast.status === 'loading') {
            contentEl.innerHTML = '<div class="ast-loading">Parsing...</div>';
            return;
        }

        // Handle error state
        if (ast.status === 'failed') {
            contentEl.innerHTML = `<div class="ast-error">Parse error: ${ast.error}</div>`;
            return;
        }

        // Render based on view mode
        switch (this.viewMode) {
            case 'outline':
                this.renderOutline(contentEl, ast.outline);
                break;
            case 'tree':
                this.renderTree(contentEl, ast.outline);
                break;
            case 'graph':
                this.renderGraph(contentEl, ast);
                break;
            default:
                this.renderOutline(contentEl, ast.outline);
        }
    }

    renderOutline(container, outline) {
        if (!outline) {
            container.innerHTML = '<div class="ast-placeholder">No outline available</div>';
            return;
        }

        let html = '<div class="ast-outline">';

        // Imports
        if (outline.imports?.length > 0) {
            html += '<div class="ast-section"><h4>Imports</h4>';
            outline.imports.forEach(imp => {
                const specifiers = imp.specifiers?.map(s => s.local || s.imported).join(', ') || '*';
                html += `
                    <div class="ast-item ast-import" data-line="${imp.loc?.start?.line || 1}">
                        <span class="ast-icon">→</span>
                        <span class="ast-name">${this.escapeHtml(specifiers)}</span>
                        <span class="ast-meta">from '${this.escapeHtml(imp.source)}'</span>
                        <span class="ast-line">:${imp.loc?.start?.line || '?'}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Functions
        if (outline.functions?.length > 0) {
            html += '<div class="ast-section"><h4>Functions</h4>';
            outline.functions.forEach(fn => {
                const asyncBadge = fn.async ? '<span class="ast-meta">async</span>' : '';
                const exportBadge = fn.exported ? '<span class="ast-exported">export</span>' : '';
                html += `
                    <div class="ast-item ast-function" data-line="${fn.loc?.start?.line || 1}">
                        <span class="ast-icon">ƒ</span>
                        <span class="ast-name">${this.escapeHtml(fn.name)}${this.escapeHtml(fn.params || '()')}</span>
                        ${asyncBadge}${exportBadge}
                        <span class="ast-line">:${fn.loc?.start?.line || '?'}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Classes
        if (outline.classes?.length > 0) {
            html += '<div class="ast-section"><h4>Classes</h4>';
            outline.classes.forEach(cls => {
                const exportBadge = cls.exported ? '<span class="ast-exported">export</span>' : '';
                html += `
                    <div class="ast-item ast-class" data-line="${cls.loc?.start?.line || 1}">
                        <span class="ast-icon">◆</span>
                        <span class="ast-name">${this.escapeHtml(cls.name)}</span>
                        ${exportBadge}
                        <span class="ast-line">:${cls.loc?.start?.line || '?'}</span>
                    </div>
                `;

                // Methods
                if (cls.methods?.length > 0) {
                    html += '<div class="ast-methods">';
                    cls.methods.forEach(method => {
                        const kindIcon = method.kind === 'constructor' ? '⚙' :
                                        method.kind === 'getter' ? '←' :
                                        method.kind === 'setter' ? '→' : 'ƒ';
                        html += `
                            <div class="ast-item ast-method" data-line="${method.loc?.start?.line || 1}">
                                <span class="ast-icon">${kindIcon}</span>
                                <span class="ast-name">${this.escapeHtml(method.name)}${this.escapeHtml(method.params || '()')}</span>
                                <span class="ast-line">:${method.loc?.start?.line || '?'}</span>
                            </div>
                        `;
                    });
                    html += '</div>';
                }
            });
            html += '</div>';
        }

        // Variables (non-function)
        const vars = outline.variables?.filter(v => v.type !== 'function') || [];
        if (vars.length > 0) {
            html += '<div class="ast-section"><h4>Variables</h4>';
            vars.forEach(v => {
                html += `
                    <div class="ast-item ast-variable" data-line="${v.loc?.start?.line || 1}">
                        <span class="ast-icon">${v.declaration === 'const' ? 'C' : 'V'}</span>
                        <span class="ast-name">${this.escapeHtml(v.name)}</span>
                        <span class="ast-meta">${v.kind || ''}</span>
                        <span class="ast-line">:${v.loc?.start?.line || '?'}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;

        // Add click handlers for navigation
        container.querySelectorAll('.ast-item').forEach(item => {
            item.addEventListener('click', () => {
                const line = parseInt(item.dataset.line, 10);
                if (!isNaN(line)) {
                    this.navigateToLine(line);
                }
            });
        });
    }

    renderTree(container, outline) {
        container.innerHTML = '<div class="ast-placeholder">Tree view coming soon</div>';
    }

    renderGraph(container, astData) {
        container.innerHTML = '<div class="ast-placeholder">Graph view coming soon</div>';
    }

    navigateToLine(line) {
        // Emit event for editor to scroll to line
        eventBus.emit('editor:goto-line', { line });

        // Also try direct textarea manipulation as fallback
        const textarea = document.querySelector('#md-editor');
        if (textarea) {
            const lines = textarea.value.split('\n');
            let position = 0;
            for (let i = 0; i < line - 1 && i < lines.length; i++) {
                position += lines[i].length + 1;
            }
            textarea.focus();
            textarea.setSelectionRange(position, position);

            // Scroll textarea to show the line
            const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
            textarea.scrollTop = (line - 5) * lineHeight;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
