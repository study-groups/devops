/**
 * DevWatchPanelEditor - Modal editor for inspecting and debugging panels
 * Provides deep technical insights into panel structure, relationships, and behavior
 */

class DevWatchPanelEditor {
    constructor(panel) {
        this.panel = panel;
        this.modal = null;
        this.debugInfo = panel.getDebugInfo();
    }
    
    show() {
        this.createModal();
        document.body.appendChild(this.modal);
        
        // Focus trap and escape key handling
        this.setupKeyHandling();
        
        // Animate in
        requestAnimationFrame(() => {
            this.modal.classList.add('devwatch-panel-editor--visible');
        });
    }
    
    hide() {
        this.modal.classList.remove('devwatch-panel-editor--visible');
        setTimeout(() => {
            if (this.modal && this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
        }, 300);
    }
    
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'devwatch-panel-editor';
        
        this.modal.innerHTML = `
            <div class="devwatch-panel-editor__backdrop"></div>
            <div class="devwatch-panel-editor__dialog">
                <header class="devwatch-panel-editor__header">
                    <h2 class="devwatch-panel-editor__title">Panel Inspector: ${this.panel.title}</h2>
                    <button class="devwatch-panel-editor__close" type="button" aria-label="Close">×</button>
                </header>
                
                <div class="devwatch-panel-editor__content">
                    <div class="devwatch-panel-editor__tabs">
                        <button class="devwatch-panel-editor__tab devwatch-panel-editor__tab--active" data-tab="overview">Overview</button>
                        <button class="devwatch-panel-editor__tab" data-tab="styles">Styles</button>
                        <button class="devwatch-panel-editor__tab" data-tab="relationships">Relationships</button>
                        <button class="devwatch-panel-editor__tab" data-tab="storage">Storage</button>
                        <button class="devwatch-panel-editor__tab" data-tab="events">Events</button>
                        <button class="devwatch-panel-editor__tab" data-tab="code">Code</button>
                    </div>
                    
                    <div class="devwatch-panel-editor__panels">
                        <div class="devwatch-panel-editor__panel devwatch-panel-editor__panel--active" data-panel="overview">
                            ${this.createOverviewPanel()}
                        </div>
                        <div class="devwatch-panel-editor__panel" data-panel="styles">
                            ${this.createStylesPanel()}
                        </div>
                        <div class="devwatch-panel-editor__panel" data-panel="relationships">
                            ${this.createRelationshipsPanel()}
                        </div>
                        <div class="devwatch-panel-editor__panel" data-panel="storage">
                            ${this.createStoragePanel()}
                        </div>
                        <div class="devwatch-panel-editor__panel" data-panel="events">
                            ${this.createEventsPanel()}
                        </div>
                        <div class="devwatch-panel-editor__panel" data-panel="code">
                            ${this.createCodePanel()}
                        </div>
                    </div>
                </div>
                
                <footer class="devwatch-panel-editor__footer">
                    <button class="devwatch-button devwatch-button--ghost" id="copy-debug-info">Copy Debug Info</button>
                    <button class="devwatch-button devwatch-button--ghost" id="export-panel-config">Export Config</button>
                    <button class="devwatch-button devwatch-button--ghost" id="close-editor">Close</button>
                </footer>
            </div>
        `;
        
        this.setupEventListeners();
    }
    
    createOverviewPanel() {
        return `
            <div class="pja-debug-section">
                <h3>Panel Information</h3>
                <div class="pja-debug-grid">
                    <div class="pja-debug-item">
                        <label>ID:</label>
                        <code>${this.debugInfo.id}</code>
                    </div>
                    <div class="pja-debug-item">
                        <label>Title:</label>
                        <span>${this.debugInfo.title}</span>
                    </div>
                    <div class="pja-debug-item">
                        <label>Position:</label>
                        <span>${this.debugInfo.position}</span>
                    </div>
                    <div class="pja-debug-item">
                        <label>State:</label>
                        <code>${this.debugInfo.state.isCollapsed ? 'Collapsed' : 'Expanded'}</code>
                    </div>
                    <div class="pja-debug-item">
                        <label>Draggable:</label>
                        <span>${this.debugInfo.isDraggable ? 'Yes' : 'No'}</span>
                    </div>
                    <div class="pja-debug-item">
                        <label>Dimensions:</label>
                        <span>${this.debugInfo.element.offsetWidth}×${this.debugInfo.element.offsetHeight}px</span>
                    </div>
                </div>
            </div>
            
            <div class="pja-debug-section">
                <h3>DOM Element</h3>
                <div class="pja-debug-grid">
                    <div class="pja-debug-item">
                        <label>Tag:</label>
                        <code>${this.debugInfo.element.tagName}</code>
                    </div>
                    <div class="pja-debug-item">
                        <label>Classes:</label>
                        <code>${this.debugInfo.element.className}</code>
                    </div>
                    <div class="pja-debug-item">
                        <label>Children:</label>
                        <span>${this.debugInfo.element.children} elements</span>
                    </div>
                    <div class="pja-debug-item">
                        <label>Scroll Height:</label>
                        <span>${this.debugInfo.element.scrollHeight}px</span>
                    </div>
                </div>
            </div>
            
            <div class="pja-debug-section">
                <h3>Call Stack</h3>
                <pre class="pja-debug-code">${this.getCallStack()}</pre>
            </div>
        `;
    }
    
    createStylesPanel() {
        const styles = this.debugInfo.computedStyles;
        return `
            <div class="pja-debug-section">
                <h3>Computed Styles</h3>
                <div class="pja-debug-styles">
                    ${Object.entries(styles).map(([prop, value]) => `
                        <div class="pja-debug-style-item">
                            <label>${prop}:</label>
                            <code>${value}</code>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="pja-debug-section">
                <h3>CSS Classes Applied</h3>
                <div class="pja-debug-classes">
                    ${this.debugInfo.element.className.split(' ').map(cls => 
                        `<span class="pja-debug-class">${cls}</span>`
                    ).join('')}
                </div>
            </div>
            
            <div class="pja-debug-section">
                <h3>Style Inheritance</h3>
                <pre class="pja-debug-code">${this.getStyleInheritance()}</pre>
            </div>
        `;
    }
    
    createRelationshipsPanel() {
        const rel = this.debugInfo.relationships;
        return `
            <div class="pja-debug-section">
                <h3>Layout Relationships</h3>
                <div class="pja-debug-grid">
                    <div class="pja-debug-item">
                        <label>Layout:</label>
                        <code>${rel.layout || 'None'}</code>
                    </div>
                    <div class="pja-debug-item">
                        <label>Column:</label>
                        <span>${rel.column || 'Unknown'}</span>
                    </div>
                    <div class="pja-debug-item">
                        <label>Siblings:</label>
                        <span>${rel.siblings.length} panels</span>
                    </div>
                </div>
            </div>
            
            <div class="pja-debug-section">
                <h3>Sibling Panels</h3>
                <div class="pja-debug-list">
                    ${rel.siblings.map(sibling => `
                        <div class="pja-debug-list-item">
                            <strong>${sibling.title}</strong>
                            <code>${sibling.id}</code>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="pja-debug-section">
                <h3>Inter-Panel Controls</h3>
                <div class="pja-debug-list">
                    ${rel.canInteractWith.map(target => `
                        <div class="pja-debug-list-item">
                            <strong>${target.title}</strong> (${target.position})
                            <div class="pja-debug-sub-info">
                                Can Control: ${target.canControl ? 'Yes' : 'No'}
                                ${target.controlMethods.length > 0 ? 
                                    `<br>Methods: ${target.controlMethods.map(m => m.text).join(', ')}` : 
                                    ''
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    createStoragePanel() {
        const storage = this.debugInfo.localStorage;
        return `
            <div class="pja-debug-section">
                <h3>Panel State</h3>
                <pre class="pja-debug-code">${storage.panelState || 'No saved state'}</pre>
            </div>
            
            <div class="pja-debug-section">
                <h3>Layout State</h3>
                <pre class="pja-debug-code">${storage.layoutState || 'No saved state'}</pre>
            </div>
            
            <div class="pja-debug-section">
                <h3>All Panel Keys</h3>
                <div class="pja-debug-list">
                    ${storage.allPanelKeys.map(key => `
                        <div class="pja-debug-list-item">
                            <code>${key}</code>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="pja-debug-section">
                <h3>SDK Information</h3>
                <pre class="pja-debug-code">${this.getSDKInfo()}</pre>
            </div>
        `;
    }
    
    createEventsPanel() {
        return `
            <div class="pja-debug-section">
                <h3>Event Listeners</h3>
                <div class="pja-debug-list">
                    ${this.debugInfo.eventListeners.map(event => `
                        <div class="pja-debug-list-item">
                            <code>${event}</code>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="pja-debug-section">
                <h3>Event Flow</h3>
                <pre class="pja-debug-code">${this.getEventFlow()}</pre>
            </div>
        `;
    }
    
    createCodePanel() {
        return `
            <div class="pja-debug-section">
                <h3>Panel HTML</h3>
                <pre class="pja-debug-code">${this.escapeHtml(this.panel.element.outerHTML)}</pre>
            </div>
            
            <div class="pja-debug-section">
                <h3>Panel Content</h3>
                <pre class="pja-debug-code">${this.escapeHtml(this.panel.content)}</pre>
            </div>
            
            <div class="pja-debug-section">
                <h3>Constructor Options</h3>
                <pre class="pja-debug-code">${JSON.stringify({
                    id: this.panel.id,
                    title: this.panel.title,
                    position: this.panel.position,
                    isDraggable: this.panel.isDraggable,
                    className: this.panel.className
                }, null, 2)}</pre>
            </div>
        `;
    }
    
    setupEventListeners() {
        // Close button
        this.modal.querySelector('.devwatch-panel-editor__close').addEventListener('click', () => this.hide());
        this.modal.querySelector('#close-editor').addEventListener('click', () => this.hide());
        
        // Backdrop click
        this.modal.querySelector('.devwatch-panel-editor__backdrop').addEventListener('click', () => this.hide());
        
        // Tab switching
        this.modal.querySelectorAll('.devwatch-panel-editor__tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
        
        // Copy debug info
        this.modal.querySelector('#copy-debug-info').addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(this.debugInfo, null, 2));
        });
        
        // Export config
        this.modal.querySelector('#export-panel-config').addEventListener('click', () => {
            const config = {
                id: this.panel.id,
                title: this.panel.title,
                content: this.panel.content,
                position: this.panel.position,
                isDraggable: this.panel.isDraggable,
                className: this.panel.className,
                state: this.panel.state
            };
            navigator.clipboard.writeText(JSON.stringify(config, null, 2));
        });
    }
    
    setupKeyHandling() {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
    }
    
    switchTab(tabName) {
        // Update tab buttons
        this.modal.querySelectorAll('.devwatch-panel-editor__tab').forEach(tab => {
            tab.classList.toggle('devwatch-panel-editor__tab--active', tab.dataset.tab === tabName);
        });
        
        // Update panels
        this.modal.querySelectorAll('.devwatch-panel-editor__panel').forEach(panel => {
            panel.classList.toggle('devwatch-panel-editor__panel--active', panel.dataset.panel === tabName);
        });
    }
    
    getCallStack() {
        try {
            throw new Error('Stack trace');
        } catch (e) {
            return e.stack || 'Stack trace not available';
        }
    }
    
    getStyleInheritance() {
        const element = this.panel.element;
        let current = element;
        const inheritance = [];
        
        while (current && current !== document.body) {
            inheritance.push({
                tag: current.tagName.toLowerCase(),
                classes: current.className,
                id: current.id
            });
            current = current.parentElement;
        }
        
        return inheritance.map(item => 
            `${item.tag}${item.id ? '#' + item.id : ''}${item.classes ? '.' + item.classes.split(' ').join('.') : ''}`
        ).join('\n  ← ');
    }
    
    getSDKInfo() {
        return JSON.stringify({
            pjaIframe: typeof window.DevWatchIframe !== 'undefined',
            pjaPanelManager: typeof window.DevWatchPanelManager !== 'undefined',
            app: typeof window.APP !== 'undefined',
            panelCount: window.DevWatchPanelManager ? window.DevWatchPanelManager.getAllPanels().length : 0,
            layoutCount: window.DevWatchPanelManager ? window.DevWatchPanelManager.getAllLayouts().length : 0,
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}×${window.innerHeight}`,
            timestamp: new Date().toISOString()
        }, null, 2);
    }
    
    getEventFlow() {
        return `Panel Event Flow:
1. Ctrl+Long click detected (800ms with Ctrl held)
2. openPanelEditor() called
3. DevWatchPanelEditor instantiated
4. getDebugInfo() collected
5. Modal created and displayed
6. Event listeners attached
7. Focus trapped in modal

Available Events:
- Single click: Toggle panel
- Ctrl+Long click: Open panel editor (requires Ctrl key)
- Drag start: Begin drag operation
- Drop: Handle panel reordering

Note: Panel editor requires Ctrl+Long-click to prevent accidental activation.`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DevWatchPanelEditor };
}
