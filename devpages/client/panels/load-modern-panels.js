/**
 * @file client/panels/load-modern-panels.js
 * @description Simple loader for modern panel system - run in browser console
 */

// Console loader for modern panel system
(async function loadModernPanelSystem() {
    console.log('🚀 Loading Modern Panel System...');
    
    try {
        // Check if we're in the right environment
        if (typeof window === 'undefined') {
            throw new Error('This script must be run in a browser environment');
        }
        
        // Set up mock dependencies if they don't exist
        if (!window.appStore) {
            console.log('📦 Setting up mock Redux store...');
            window.appStore = {
                state: {
                    panels: { sidebarPanels: {} },
                    file: { currentPathname: '/test/example.js' }
                },
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
        
        if (!window.eventBus) {
            console.log('📡 Setting up mock event bus...');
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
            console.log('🔧 Setting up mock createSelector...');
            window.createSelector = (selectors, resultFunc) => {
                return (state) => {
                    const inputs = selectors.map(selector => selector(state));
                    return resultFunc(...inputs);
                };
            };
        }
        
        if (!window.panelActions) {
            console.log('⚡ Setting up mock panel actions...');
            window.panelActions = {
                createPanel: (payload) => ({ type: 'panels/createPanel', payload }),
                updatePanel: (payload) => ({ type: 'panels/updatePanel', payload }),
                removePanel: (id) => ({ type: 'panels/removePanel', payload: { id } })
            };
        }
        
        // Set up path utilities
        if (!window.getParentPath) {
            window.getParentPath = (path) => {
                const parts = path.split('/');
                parts.pop();
                return parts.join('/') || '/';
            };
            
            window.getFilename = (path) => {
                return path.split('/').pop() || '';
            };
            
            window.pathJoin = (...parts) => {
                return parts.join('/').replace(/\/+/g, '/');
            };
        }
        
        // Load CSS files
        console.log('🎨 Loading CSS files...');
        const loadCSS = (href) => {
            if (!document.querySelector(`link[href="${href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
            }
        };
        
        loadCSS('/client/panels/modern-panels.css');
        loadCSS('/client/panels/modern-context-panel.css');
        
        // Import the modern panel modules
        console.log('📦 Importing modern panel modules...');
        
        const { ModernBasePanel } = await import('/client/panels/ModernBasePanel.js');
        const { ModernContextPanel } = await import('/client/panels/ModernContextPanel.js');
        const { PanelMigrationHelper } = await import('/client/panels/PanelMigrationHelper.js');
        
        // Make available globally
        window.ModernBasePanel = ModernBasePanel;
        window.ModernContextPanel = ModernContextPanel;
        window.PanelMigrationHelper = PanelMigrationHelper;
        
        // Create demo functions
        window.panelDemo = {
            // Create a simple test panel
            createTestPanel() {
                class TestPanel extends ModernBasePanel {
                    constructor() {
                        super({
                            id: 'demo-test-panel',
                            title: '🧪 Demo Test Panel',
                            collapsible: true
                        });
                    }
                    
                    renderContent() {
                        const content = document.createElement('div');
                        content.innerHTML = `
                            <div style="padding: 16px;">
                                <h4>✅ Modern Panel System Working!</h4>
                                <ul>
                                    <li>Redux Integration: ✅</li>
                                    <li>Performance Optimized: ✅</li>
                                    <li>Beautiful Styling: ✅</li>
                                    <li>Error Handling: ✅</li>
                                </ul>
                                <p><strong>Panel ID:</strong> ${this.id}</p>
                                <p><strong>Initialized:</strong> ${this.isInitialized}</p>
                                <button onclick="this.closest('.panel').remove()">Remove Panel</button>
                            </div>
                        `;
                        return content;
                    }
                }
                
                return new TestPanel();
            },
            
            // Create modern context panel
            createContextPanel() {
                return new ModernContextPanel();
            },
            
            // Test migration helper
            testMigration() {
                const helper = new PanelMigrationHelper();
                
                // Mock legacy panel
                class MockLegacyPanel {
                    constructor(options) {
                        this.id = options.id || 'mock-legacy';
                    }
                    render() {
                        const div = document.createElement('div');
                        div.innerHTML = '<p>Migrated legacy panel content</p>';
                        return div;
                    }
                }
                
                const config = PanelMigrationHelper.createMigrationConfig('context');
                const ModernizedPanel = helper.migratePanel(MockLegacyPanel, config);
                
                return new ModernizedPanel({ id: 'migrated-demo' });
            },
            
            // Render panel to page
            async renderPanel(panel, containerId = 'demo-container') {
                let container = document.getElementById(containerId);
                if (!container) {
                    container = document.createElement('div');
                    container.id = containerId;
                    container.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        width: 300px;
                        z-index: 10000;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    `;
                    document.body.appendChild(container);
                }
                
                await panel.initialize();
                const element = panel.render();
                container.appendChild(element);
                await panel.onMount(element);
                
                console.log(`✅ Panel rendered: ${panel.id}`);
                return panel;
            },
            
            // Performance test
            async performanceTest(iterations = 50) {
                console.log(`🏃 Running performance test with ${iterations} iterations...`);
                
                const start = performance.now();
                
                for (let i = 0; i < iterations; i++) {
                    const panel = new ModernBasePanel({
                        id: `perf-test-${i}`,
                        title: `Performance Test ${i}`
                    });
                    await panel.initialize();
                }
                
                const end = performance.now();
                const totalTime = end - start;
                const avgTime = totalTime / iterations;
                
                console.log(`⚡ Performance Results:`);
                console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
                console.log(`   Average per panel: ${avgTime.toFixed(2)}ms`);
                console.log(`   Panels per second: ${Math.round(1000 / avgTime)}`);
                
                return { totalTime, avgTime, panelsPerSecond: Math.round(1000 / avgTime) };
            }
        };
        
        console.log('🎉 Modern Panel System loaded successfully!');
        console.log('');
        console.log('📖 Available commands:');
        console.log('   panelDemo.createTestPanel()     - Create a test panel');
        console.log('   panelDemo.createContextPanel()  - Create modern context panel');
        console.log('   panelDemo.testMigration()       - Test panel migration');
        console.log('   panelDemo.renderPanel(panel)    - Render panel to page');
        console.log('   panelDemo.performanceTest()     - Run performance test');
        console.log('');
        console.log('🚀 Quick start:');
        console.log('   const panel = panelDemo.createTestPanel();');
        console.log('   await panelDemo.renderPanel(panel);');
        
        // Auto-create a test panel
        const testPanel = window.panelDemo.createTestPanel();
        await window.panelDemo.renderPanel(testPanel);
        
        return window.panelDemo;
        
    } catch (error) {
        console.error('❌ Failed to load modern panel system:', error);
        throw error;
    }
})();
