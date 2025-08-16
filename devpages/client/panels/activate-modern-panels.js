/**
 * @file client/panels/activate-modern-panels.js
 * @description Simple activation script for modern panels in existing sidebar
 */

// Activation script for modern panels
(async function activateModernPanels() {
    console.log('🚀 Activating Modern Panels in Sidebar...');
    
    try {
        // Load CSS if not already loaded
        const loadCSS = (href) => {
            if (!document.querySelector(`link[href="${href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
                console.log(`📄 Loaded CSS: ${href}`);
            }
        };
        
        loadCSS('/client/panels/modern-panels.css');
        loadCSS('/client/panels/modern-context-panel.css');
        
        // Set up mock dependencies if needed
        if (!window.appStore) {
            console.log('📦 Setting up mock Redux store...');
            window.appStore = {
                state: { panels: { sidebarPanels: {} } },
                subscribers: [],
                subscribe(callback) {
                    this.subscribers.push(callback);
                    return () => {
                        const index = this.subscribers.indexOf(callback);
                        if (index > -1) this.subscribers.splice(index, 1);
                    };
                },
                getState() { return this.state; },
                dispatch(action) {
                    console.log('Mock dispatch:', action);
                    if (action.type === 'panels/createPanel') {
                        this.state.panels.sidebarPanels[action.payload.id] = action.payload;
                    } else if (action.type === 'panels/updatePanel') {
                        const existing = this.state.panels.sidebarPanels[action.payload.id];
                        if (existing) Object.assign(existing, action.payload);
                    }
                    this.subscribers.forEach(callback => callback());
                }
            };
        }
        
        if (!window.panelActions) {
            window.panelActions = {
                createPanel: (payload) => ({ type: 'panels/createPanel', payload }),
                updatePanel: (payload) => ({ type: 'panels/updatePanel', payload })
            };
        }
        
        if (!window.eventBus) {
            window.eventBus = {
                listeners: {},
                on(event, callback) {
                    if (!this.listeners[event]) this.listeners[event] = [];
                    this.listeners[event].push(callback);
                },
                off(event, callback) {
                    if (this.listeners[event]) {
                        const index = this.listeners[event].indexOf(callback);
                        if (index > -1) this.listeners[event].splice(index, 1);
                    }
                },
                emit(event, data) {
                    if (this.listeners[event]) {
                        this.listeners[event].forEach(callback => callback(data));
                    }
                }
            };
        }
        
        if (!window.createSelector) {
            window.createSelector = (selectors, resultFunc) => {
                return (state) => {
                    const inputs = selectors.map(selector => selector(state));
                    return resultFunc(...inputs);
                };
            };
        }
        
        // Path utilities
        window.getParentPath = window.getParentPath || ((path) => {
            const parts = path.split('/');
            parts.pop();
            return parts.join('/') || '/';
        });
        
        window.getFilename = window.getFilename || ((path) => {
            return path.split('/').pop() || '';
        });
        
        // Find or create sidebar container
        let sidebarContainer = document.querySelector('#workspace-sidebar') ||
                              document.querySelector('.workspace-sidebar') ||
                              document.querySelector('[data-zone="sidebar"]') ||
                              document.querySelector('.sidebar');
        
        if (!sidebarContainer) {
            console.log('🏗️ Creating sidebar container...');
            sidebarContainer = document.createElement('div');
            sidebarContainer.id = 'modern-sidebar';
            sidebarContainer.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 320px;
                height: 100vh;
                background: #f8f9fa;
                border-right: 1px solid #e9ecef;
                overflow-y: auto;
                z-index: 1000;
                padding: 10px;
                box-shadow: 2px 0 4px rgba(0,0,0,0.1);
            `;
            document.body.appendChild(sidebarContainer);
            
            // Add toggle button
            const toggle = document.createElement('button');
            toggle.innerHTML = '✕';
            toggle.style.cssText = `
                position: fixed;
                left: 280px;
                top: 10px;
                z-index: 1001;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                cursor: pointer;
                font-size: 14px;
            `;
            toggle.addEventListener('click', () => {
                sidebarContainer.style.display = 'none';
                toggle.style.display = 'none';
            });
            document.body.appendChild(toggle);
        }
        
        console.log('📍 Found/created sidebar container:', sidebarContainer);
        
        // Load modern panel modules
        console.log('📦 Loading modern panel modules...');
        const { ModernBasePanel } = await import('/client/panels/ModernBasePanel.js');
        const { ModernContextPanel } = await import('/client/panels/ModernContextPanel.js');
        
        // Create modern panels
        const panels = [];
        
        // 1. Modern Context Panel
        console.log('🔗 Creating Modern Context Panel...');
        const contextPanel = new ModernContextPanel();
        await contextPanel.initialize();
        panels.push({ id: 'modern-context', panel: contextPanel, shortcut: 'ctrl+shift+c' });
        
        // 2. Modern Settings Panel
        console.log('⚙️ Creating Modern Settings Panel...');
        class ModernSettingsPanel extends ModernBasePanel {
            constructor() {
                super({
                    id: 'modern-settings',
                    title: '⚙️ Modern Settings',
                    collapsible: true
                });
            }
            
            renderContent() {
                const content = document.createElement('div');
                content.innerHTML = `
                    <div style="padding: 16px;">
                        <h4>Modern Settings Panel</h4>
                        <div style="margin: 12px 0;">
                            <h5>Panel System</h5>
                            <label style="display: block; margin: 8px 0;">
                                <input type="checkbox" checked> Enable modern panels
                            </label>
                            <label style="display: block; margin: 8px 0;">
                                <input type="checkbox" checked> Auto-collapse panels
                            </label>
                        </div>
                        <div style="margin: 12px 0;">
                            <h5>Keyboard Shortcuts</h5>
                            <div style="font-family: monospace; font-size: 12px;">
                                <p><kbd style="background: #f1f1f1; padding: 2px 4px; border-radius: 3px;">Ctrl+Shift+C</kbd> Context Panel</p>
                                <p><kbd style="background: #f1f1f1; padding: 2px 4px; border-radius: 3px;">Ctrl+Shift+S</kbd> Settings Panel</p>
                                <p><kbd style="background: #f1f1f1; padding: 2px 4px; border-radius: 3px;">Ctrl+Shift+D</kbd> Debug Panel</p>
                            </div>
                        </div>
                    </div>
                `;
                return content;
            }
        }
        
        const settingsPanel = new ModernSettingsPanel();
        await settingsPanel.initialize();
        panels.push({ id: 'modern-settings', panel: settingsPanel, shortcut: 'ctrl+shift+s' });
        
        // 3. Modern Debug Panel
        console.log('🐛 Creating Modern Debug Panel...');
        class ModernDebugPanel extends ModernBasePanel {
            constructor() {
                super({
                    id: 'modern-debug',
                    title: '🐛 Modern Debug',
                    collapsible: true
                });
            }
            
            renderContent() {
                const content = document.createElement('div');
                content.innerHTML = `
                    <div style="padding: 16px;">
                        <h4>Modern Debug Panel</h4>
                        <div style="margin: 12px 0;">
                            <h5>System Status</h5>
                            <p>Modern panels: <strong>3</strong></p>
                            <p>Redux store: <strong>Connected</strong></p>
                            <p>Keyboard shortcuts: <strong>Active</strong></p>
                        </div>
                        <div style="margin: 12px 0;">
                            <button onclick="console.log('Debug info:', window.modernPanels)" 
                                    style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin: 4px;">
                                Show Debug Info
                            </button>
                            <button onclick="location.reload()" 
                                    style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin: 4px;">
                                Refresh Page
                            </button>
                        </div>
                    </div>
                `;
                return content;
            }
        }
        
        const debugPanel = new ModernDebugPanel();
        await debugPanel.initialize();
        panels.push({ id: 'modern-debug', panel: debugPanel, shortcut: 'ctrl+shift+d' });
        
        // Render all panels to sidebar
        console.log('🎨 Rendering panels to sidebar...');
        sidebarContainer.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 16px;">🚀 Modern Panel System</h3>
                <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Integrated with sidebar & keyboard shortcuts</p>
            </div>
        `;
        
        panels.forEach(({ panel }) => {
            const panelElement = panel.render();
            sidebarContainer.appendChild(panelElement);
            panel.onMount(panelElement);
        });
        
        // Set up keyboard shortcuts
        console.log('⌨️ Setting up keyboard shortcuts...');
        const keyboardShortcuts = new Map();
        panels.forEach(({ id, shortcut }) => {
            keyboardShortcuts.set(shortcut, id);
        });
        
        document.addEventListener('keydown', (event) => {
            // Build shortcut string
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
                    // Toggle panel visibility
                    const panelElement = panelInfo.panel.element;
                    if (panelElement) {
                        const isVisible = panelElement.style.display !== 'none';
                        panelElement.style.display = isVisible ? 'none' : 'block';
                        
                        // Show feedback
                        const feedback = document.createElement('div');
                        feedback.style.cssText = `
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            background: #28a745;
                            color: white;
                            padding: 10px 15px;
                            border-radius: 4px;
                            z-index: 10000;
                            font-size: 14px;
                        `;
                        feedback.textContent = `${shortcut.toUpperCase()}: ${isVisible ? 'Hidden' : 'Shown'} ${panelInfo.panel.config.title}`;
                        document.body.appendChild(feedback);
                        
                        setTimeout(() => feedback.remove(), 2000);
                        
                        console.log(`🎯 Keyboard shortcut triggered: ${shortcut} -> ${panelId} (${isVisible ? 'hidden' : 'shown'})`);
                    }
                }
            }
        });
        
        // Store references globally
        window.modernPanels = {
            panels: panels.reduce((acc, p) => {
                acc[p.id] = p.panel;
                return acc;
            }, {}),
            shortcuts: keyboardShortcuts,
            container: sidebarContainer,
            
            // Helper functions
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
                console.log('All panels shown');
            },
            
            hideAll() {
                Object.values(this.panels).forEach(panel => {
                    if (panel.element) panel.element.style.display = 'none';
                });
                console.log('All panels hidden');
            }
        };
        
        console.log('🎉 Modern Panel System Activated Successfully!');
        console.log('');
        console.log('📖 Available keyboard shortcuts:');
        console.log('   Ctrl+Shift+C - Toggle Context Panel');
        console.log('   Ctrl+Shift+S - Toggle Settings Panel');
        console.log('   Ctrl+Shift+D - Toggle Debug Panel');
        console.log('');
        console.log('🔧 Available commands:');
        console.log('   window.modernPanels.togglePanel("modern-context")');
        console.log('   window.modernPanels.showAll()');
        console.log('   window.modernPanels.hideAll()');
        
        // Show success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 20px 30px;
            border-radius: 8px;
            z-index: 10000;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">🎉 Success!</h3>
            <p style="margin: 0;">Modern panels activated in sidebar</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Try Ctrl+Shift+C, Ctrl+Shift+S, or Ctrl+Shift+D</p>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 4000);
        
        return window.modernPanels;
        
    } catch (error) {
        console.error('❌ Failed to activate modern panels:', error);
        throw error;
    }
})();
