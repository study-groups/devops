/**
 * @file client/panels/simple-clean-panels.js
 * @description Simple, clean panels that match existing sidebar style - no gradients!
 */

// Simple clean panels that match your existing style
(async function createSimpleCleanPanels() {
    console.log('🧹 Creating Simple Clean Panels...');
    
    try {
        // Wait for window.APP if needed
        let attempts = 0;
        while (!window.APP && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // Simple clean panel class - no fancy Redux stuff
        class SimpleCleanPanel {
            constructor(config) {
                this.id = config.id;
                this.title = config.title;
                this.content = config.content || '';
                this.element = null;
                this.isCollapsed = false;
            }
            
            render() {
                // Create panel with your existing clean styling
                const panel = document.createElement('div');
                panel.className = 'sidebar-panel';
                panel.style.cssText = `
                    margin-bottom: 8px;
                    border-radius: 6px;
                    border: 1px solid var(--color-border, #e1e5e9);
                    background: var(--color-bg, #ffffff);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                `;
                
                // Clean header - no gradients!
                const header = document.createElement('div');
                header.className = 'sidebar-panel-header';
                header.style.cssText = `
                    background: var(--color-bg-alt, #f8f9fa);
                    border-bottom: 1px solid var(--color-border, #e1e5e9);
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--color-text, #212529);
                `;
                
                const title = document.createElement('span');
                title.textContent = this.title;
                header.appendChild(title);
                
                // Simple collapse button
                const collapseBtn = document.createElement('button');
                collapseBtn.innerHTML = '−';
                collapseBtn.style.cssText = `
                    background: none;
                    border: none;
                    font-size: 16px;
                    font-weight: bold;
                    color: var(--color-text-secondary, #6c757d);
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                collapseBtn.addEventListener('click', () => this.toggleCollapse());
                header.appendChild(collapseBtn);
                
                panel.appendChild(header);
                
                // Clean content area
                const content = document.createElement('div');
                content.className = 'sidebar-panel-content';
                content.style.cssText = `
                    padding: 12px;
                    background: var(--color-bg, #ffffff);
                    transition: max-height 0.3s ease, opacity 0.3s ease;
                    overflow: hidden;
                `;
                content.innerHTML = this.content;
                
                panel.appendChild(content);
                
                this.element = panel;
                this.headerElement = header;
                this.contentElement = content;
                this.collapseBtn = collapseBtn;
                
                return panel;
            }
            
            toggleCollapse() {
                this.isCollapsed = !this.isCollapsed;
                
                if (this.isCollapsed) {
                    this.contentElement.style.maxHeight = '0';
                    this.contentElement.style.opacity = '0';
                    this.contentElement.style.paddingTop = '0';
                    this.contentElement.style.paddingBottom = '0';
                    this.collapseBtn.innerHTML = '+';
                } else {
                    this.contentElement.style.maxHeight = 'none';
                    this.contentElement.style.opacity = '1';
                    this.contentElement.style.paddingTop = '12px';
                    this.contentElement.style.paddingBottom = '12px';
                    this.collapseBtn.innerHTML = '−';
                }
            }
            
            setVisible(visible) {
                if (this.element) {
                    this.element.style.display = visible ? 'block' : 'none';
                }
            }
        }
        
        // Find existing sidebar or create clean one
        let sidebarContainer = document.querySelector('#workspace-sidebar') ||
                              document.querySelector('.workspace-sidebar') ||
                              document.querySelector('[data-zone="sidebar"]');
        
        if (!sidebarContainer) {
            console.log('🏗️ Creating clean sidebar container...');
            sidebarContainer = document.createElement('div');
            sidebarContainer.id = 'clean-sidebar';
            sidebarContainer.className = 'workspace-sidebar';
            sidebarContainer.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 280px;
                height: 100vh;
                background: var(--color-bg-alt, #f8f9fa);
                border-right: 1px solid var(--color-border, #e1e5e9);
                overflow-y: auto;
                z-index: 1000;
                padding: 8px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;
            document.body.appendChild(sidebarContainer);
            
            // Simple close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: var(--color-bg-elevated, #ffffff);
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 4px;
                width: 24px;
                height: 24px;
                cursor: pointer;
                font-size: 14px;
                color: var(--color-text-secondary, #6c757d);
                z-index: 1001;
            `;
            closeBtn.addEventListener('click', () => {
                sidebarContainer.style.display = 'none';
            });
            sidebarContainer.appendChild(closeBtn);
        }
        
        console.log('📍 Using sidebar container:', sidebarContainer);
        
        // Create simple clean panels
        const panels = [
            {
                id: 'clean-context',
                panel: new SimpleCleanPanel({
                    id: 'clean-context',
                    title: 'Context Manager',
                    content: `
                        <div>
                            <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Current Context</h5>
                            <div style="background: var(--color-bg-alt, #f8f9fa); padding: 8px; border-radius: 4px; margin-bottom: 12px; font-family: monospace; font-size: 12px;">
                                <div>File: <strong>${window.location.pathname || 'No file'}</strong></div>
                                <div>Path: <strong>${window.location.href || '/'}</strong></div>
                            </div>
                            
                            <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Actions</h5>
                            <div style="display: flex; gap: 4px;">
                                <button onclick="console.log('Refresh context')" 
                                        style="background: var(--color-primary, #007bff); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                                    Refresh
                                </button>
                                <button onclick="console.log('Clear context')" 
                                        style="background: var(--color-text-secondary, #6c757d); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                                    Clear
                                </button>
                            </div>
                            
                            <h5 style="margin: 12px 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Status</h5>
                            <div style="font-size: 12px; color: var(--color-text, #212529);">
                                <div>• window.APP: ${!!window.APP ? 'Available' : 'Missing'}</div>
                                <div>• Services: ${Object.keys(window.APP?.services || {}).length}</div>
                                <div>• Clean Style: Active</div>
                            </div>
                        </div>
                    `
                }),
                shortcut: 'ctrl+shift+c'
            },
            {
                id: 'clean-settings',
                panel: new SimpleCleanPanel({
                    id: 'clean-settings',
                    title: 'Settings',
                    content: `
                        <div>
                            <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Panel Options</h5>
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin: 6px 0; font-size: 12px;">
                                    <input type="checkbox" checked style="margin-right: 6px;"> Clean styling (no gradients)
                                </label>
                                <label style="display: block; margin: 6px 0; font-size: 12px;">
                                    <input type="checkbox" checked style="margin-right: 6px;"> Simple panels
                                </label>
                                <label style="display: block; margin: 6px 0; font-size: 12px;">
                                    <input type="checkbox" checked style="margin-right: 6px;"> Keyboard shortcuts
                                </label>
                            </div>
                            
                            <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Shortcuts</h5>
                            <div style="font-size: 11px; font-family: monospace; color: var(--color-text, #212529);">
                                <div style="margin: 4px 0;"><kbd style="background: var(--color-bg-alt, #f8f9fa); padding: 2px 4px; border-radius: 2px;">Ctrl+Shift+C</kbd> Context</div>
                                <div style="margin: 4px 0;"><kbd style="background: var(--color-bg-alt, #f8f9fa); padding: 2px 4px; border-radius: 2px;">Ctrl+Shift+S</kbd> Settings</div>
                                <div style="margin: 4px 0;"><kbd style="background: var(--color-bg-alt, #f8f9fa); padding: 2px 4px; border-radius: 2px;">Ctrl+Shift+D</kbd> Debug</div>
                            </div>
                        </div>
                    `
                }),
                shortcut: 'ctrl+shift+s'
            },
            {
                id: 'clean-debug',
                panel: new SimpleCleanPanel({
                    id: 'clean-debug',
                    title: 'Debug Info',
                    content: `
                        <div>
                            <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">System Status</h5>
                            <div style="font-size: 12px; color: var(--color-text, #212529); margin-bottom: 12px;">
                                <div>• Clean panels: <strong>Active</strong></div>
                                <div>• No gradients: <strong>✓</strong></div>
                                <div>• Simple styling: <strong>✓</strong></div>
                                <div>• Keyboard shortcuts: <strong>Working</strong></div>
                            </div>
                            
                            <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Debug Actions</h5>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <button onclick="console.log('window.APP:', window.APP)" 
                                        style="background: var(--color-bg-elevated, #ffffff); border: 1px solid var(--color-border, #e1e5e9); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; text-align: left;">
                                    Log window.APP
                                </button>
                                <button onclick="console.log('Clean panels:', window.cleanPanels)" 
                                        style="background: var(--color-bg-elevated, #ffffff); border: 1px solid var(--color-border, #e1e5e9); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; text-align: left;">
                                    Log panels
                                </button>
                                <button onclick="window.cleanPanels.showAll()" 
                                        style="background: var(--color-bg-elevated, #ffffff); border: 1px solid var(--color-border, #e1e5e9); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; text-align: left;">
                                    Show all panels
                                </button>
                            </div>
                        </div>
                    `
                }),
                shortcut: 'ctrl+shift+d'
            }
        ];
        
        // Clear existing content and add clean header
        sidebarContainer.innerHTML = '';
        
        // Simple clean header - no gradients!
        const header = document.createElement('div');
        header.style.cssText = `
            background: var(--color-bg-elevated, #ffffff);
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 14px;
            color: var(--color-text, #212529);
        `;
        header.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: between;">
                <span>Clean Panel System</span>
                <span style="font-size: 11px; font-weight: normal; color: var(--color-text-secondary, #6c757d); margin-left: auto;">No gradients!</span>
            </div>
        `;
        sidebarContainer.appendChild(header);
        
        // Render panels
        console.log('🎨 Rendering clean panels...');
        panels.forEach(({ panel }) => {
            const panelElement = panel.render();
            sidebarContainer.appendChild(panelElement);
        });
        
        // Set up keyboard shortcuts
        console.log('⌨️ Setting up keyboard shortcuts...');
        const keyboardShortcuts = new Map();
        panels.forEach(({ id, shortcut }) => {
            keyboardShortcuts.set(shortcut, id);
        });
        
        document.addEventListener('keydown', (event) => {
            const parts = [];
            if (event.ctrlKey || event.metaKey) parts.push('ctrl');
            if (event.shiftKey) parts.push('shift');
            if (event.altKey) parts.push('alt');
            parts.push(event.key.toLowerCase());
            
            const shortcut = parts.join('+');
            
            if (keyboardShortcuts.has(shortcut)) {
                event.preventDefault();
                event.stopPropagation();
                
                const panelId = keyboardShortcuts.get(shortcut);
                const panelInfo = panels.find(p => p.id === panelId);
                
                if (panelInfo) {
                    const panelElement = panelInfo.panel.element;
                    if (panelElement) {
                        const isVisible = panelElement.style.display !== 'none';
                        panelElement.style.display = isVisible ? 'none' : 'block';
                        
                        // Simple feedback - no fancy styling
                        const feedback = document.createElement('div');
                        feedback.style.cssText = `
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            background: var(--color-bg-elevated, #ffffff);
                            border: 1px solid var(--color-border, #e1e5e9);
                            padding: 8px 12px;
                            border-radius: 4px;
                            z-index: 10000;
                            font-size: 12px;
                            color: var(--color-text, #212529);
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        `;
                        feedback.textContent = `${shortcut.toUpperCase()}: ${isVisible ? 'Hidden' : 'Shown'} ${panelInfo.panel.title}`;
                        document.body.appendChild(feedback);
                        
                        setTimeout(() => feedback.remove(), 1500);
                        
                        console.log(`🎯 ${shortcut} -> ${panelId} (${isVisible ? 'hidden' : 'shown'})`);
                    }
                }
            }
        });
        
        // Store references in window.APP and globally
        const cleanPanelsAPI = {
            panels: panels.reduce((acc, p) => {
                acc[p.id] = p.panel;
                return acc;
            }, {}),
            shortcuts: keyboardShortcuts,
            container: sidebarContainer,
            
            togglePanel(panelId) {
                const panel = this.panels[panelId];
                if (panel && panel.element) {
                    const isVisible = panel.element.style.display !== 'none';
                    panel.element.style.display = isVisible ? 'none' : 'block';
                    console.log(`Toggled ${panelId}: ${isVisible ? 'hidden' : 'shown'}`);
                }
            },
            
            showAll() {
                Object.values(this.panels).forEach(panel => {
                    if (panel.element) panel.element.style.display = 'block';
                });
                console.log('All clean panels shown');
            },
            
            hideAll() {
                Object.values(this.panels).forEach(panel => {
                    if (panel.element) panel.element.style.display = 'none';
                });
                console.log('All clean panels hidden');
            }
        };
        
        // Integrate with window.APP
        if (window.APP) {
// Migrated from direct window.APP property assignment
appInitializer.setAppProperty('cleanPanels', cleanPanelsAPI);
        }
        window.cleanPanels = cleanPanelsAPI;
        
        console.log('🎉 Simple Clean Panels Created!');
        console.log('');
        console.log('📖 Features:');
        console.log('   • Clean styling - no gradients or fancy effects');
        console.log('   • Matches your existing sidebar style');
        console.log('   • Working keyboard shortcuts: Ctrl+Shift+C, S, D');
        console.log('   • Simple collapse/expand functionality');
        console.log('');
        console.log('🔧 Available commands:');
        console.log('   window.cleanPanels.togglePanel("clean-context")');
        console.log('   window.cleanPanels.showAll()');
        console.log('   window.cleanPanels.hideAll()');
        
        // Simple success notification - no gradients!
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--color-bg-elevated, #ffffff);
            border: 2px solid var(--color-success, #28a745);
            color: var(--color-text, #212529);
            padding: 16px 24px;
            border-radius: 6px;
            z-index: 10000;
            text-align: center;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        `;
        notification.innerHTML = `
            <h3 style="margin: 0 0 8px 0; color: var(--color-success, #28a745);">✓ Clean Panels Ready</h3>
            <p style="margin: 0; font-size: 14px;">Simple, clean styling - no gradients!</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--color-text-secondary, #6c757d);">Try: Ctrl+Shift+C, S, or D</p>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
        
        return cleanPanelsAPI;
        
    } catch (error) {
        console.error('❌ Failed to create simple clean panels:', error);
        throw error;
    }
})();
