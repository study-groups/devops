/**
 * Panel Browser Debug - Client-side debugging utilities for panel system
 * 
 * This script provides browser-based debugging tools for the panel system.
 * Load this in the browser console or include it in debug builds.
 */

(function() {
    'use strict';

    // Ensure APP namespace exists
    window.APP = window.APP || {};
    window.APP.panels = window.APP.panels || {};

    // Extend the main panels API with utility methods
    Object.assign(window.APP.panels, {
        
        // List all panels with their current state
        list() {
            if (!window.APP.panels?.getAllPanels) {
                console.error('Panel system not initialized');
                return;
            }

            const panels = window.APP.panels.getAllPanels();
            console.group('Panel System Status');
            console.log(`Total panels: ${panels.length}`);
            
            panels.forEach(panel => {
                const state = panel.getState();
                console.group(`Panel ${panel.id} (${panel.type})`);
                console.log('Title:', panel.title);
                console.log('Mounted:', panel.mounted);
                console.log('Visible:', state?.visible || false);
                console.log('Position:', state?.position);
                console.log('Size:', state?.size);
                console.log('Z-Index:', state?.zIndex);
                console.log('Config:', panel.config);
                console.groupEnd();
            });
            
            console.groupEnd();
            return panels;
        },

        // Show detailed info about a specific panel
        inspect(panelId) {
            const panel = window.APP.panels.getPanel(panelId);
            if (!panel) {
                console.error(`Panel '${panelId}' not found`);
                return;
            }

            console.group(`🔍 Panel Inspector: ${panelId}`);
            console.log('Panel Object:', panel);
            console.log('Debug Info:', panel.getDebugInfo());
            console.log('Redux State:', panel.getState());
            console.log('DOM Element:', panel.element);
            console.groupEnd();
            
            return panel;
        },

        // Create a test panel
        createTest(type = 'diagnostic', config = {}) {
            if (!window.APP.panels?.createPanel) {
                console.error('Panel system not initialized');
                return;
            }

            const defaultConfig = {
                title: `Test ${type} Panel`,
                position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
                size: { width: 400, height: 300 },
                ...config
            };

            const panel = window.APP.panels.createPanel(type, defaultConfig);
            panel.mount().show();
            
            console.log(`✅ Created test panel: ${panel.id}`);
            return panel;
        },

        // Show/hide all panels
        showAll() {
            const store = window.APP.services?.store;
            if (!store) {
                console.error('Redux store not available');
                return;
            }

            store.dispatch({ type: 'panels/showAllPanels' });
            console.log('✅ Showing all panels');
        },

        hideAll() {
            const store = window.APP.services?.store;
            if (!store) {
                console.error('Redux store not available');
                return;
            }

            store.dispatch({ type: 'panels/hideAllPanels' });
            console.log('✅ Hiding all panels');
        },

        // Cascade panels
        cascade() {
            const store = window.APP.services?.store;
            if (!store) {
                console.error('Redux store not available');
                return;
            }

            store.dispatch({ type: 'panels/cascadePanels' });
            console.log('✅ Cascaded panels');
        },

        // Tile panels
        tile() {
            const store = window.APP.services?.store;
            if (!store) {
                console.error('Redux store not available');
                return;
            }

            store.dispatch({ type: 'panels/tilePanels' });
            console.log('✅ Tiled panels');
        },

        // Get Redux state
        getState() {
            const store = window.APP.services?.store;
            if (!store) {
                console.error('Redux store not available');
                return;
            }

            return store.getState().panels;
        },

        // Monitor panel state changes
        monitor() {
            const store = window.APP.services?.store;
            if (!store) {
                console.error('Redux store not available');
                return;
            }

            let previousState = this.getState();
            
            const unsubscribe = store.subscribe(() => {
                const currentState = this.getState();
                if (currentState !== previousState) {
                    console.group('🔄 Panel State Change');
                    console.log('Previous:', previousState);
                    console.log('Current:', currentState);
                    console.groupEnd();
                    previousState = currentState;
                }
            });

            console.log('👁️ Monitoring panel state changes. Call the returned function to stop.');
            return unsubscribe;
        },

        // Performance testing
        performanceTest(count = 10) {
            console.log(`🚀 Creating ${count} panels for performance testing...`);
            const startTime = performance.now();
            
            const panels = [];
            for (let i = 0; i < count; i++) {
                const panel = this.createTest('test', {
                    title: `Perf Test Panel ${i + 1}`,
                    position: { x: (i % 5) * 100 + 50, y: Math.floor(i / 5) * 100 + 50 }
                });
                panels.push(panel);
            }
            
            const endTime = performance.now();
            console.log(`✅ Created ${count} panels in ${(endTime - startTime).toFixed(2)}ms`);
            
            // Test show/hide performance
            const showStartTime = performance.now();
            panels.forEach(panel => panel.show());
            const showEndTime = performance.now();
            console.log(`✅ Showed ${count} panels in ${(showEndTime - showStartTime).toFixed(2)}ms`);
            
            return panels;
        },

        // Cleanup test panels
        cleanup() {
            const panels = window.APP.panels.getAllPanels();
            const testPanels = panels.filter(p => p.title.includes('Test') || p.type === 'test');
            
            testPanels.forEach(panel => {
                window.APP.panels.destroyPanel(panel.id);
            });
            
            console.log(`🧹 Cleaned up ${testPanels.length} test panels`);
        },

        // Export panel configurations
        export() {
            const state = this.getState();
            const exportData = {
                exported: new Date().toISOString(),
                panels: state.panels,
                globalSettings: state.globalSettings
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            console.log('📤 Panel configuration export:');
            console.log(dataStr);
            
            // Copy to clipboard if available
            if (navigator.clipboard) {
                navigator.clipboard.writeText(dataStr).then(() => {
                    console.log('✅ Copied to clipboard');
                }).catch(err => {
                    console.warn('Failed to copy to clipboard:', err);
                });
            }
            
            return exportData;
        },

        // Help
        help() {
            console.group('🔧 Panel & Sidebar API Commands');
            console.log('// Core Panel Management:');
            console.log('window.APP.panels.createPanel(type, config) - Create a new panel');
            console.log('window.APP.panels.getPanel(id)             - Get panel by ID');
            console.log('window.APP.panels.getAllPanels()           - Get all panels');
            console.log('window.APP.panels.destroyPanel(id)         - Destroy a panel');
            console.log('window.APP.panels.getDebugInfo()           - Get debug information');
            console.log('');
            console.log('// Panel Utilities:');
            console.log('window.APP.panels.list()                   - List all panels with details');
            console.log('window.APP.panels.inspect(id)              - Inspect a specific panel');
            console.log('window.APP.panels.createTest()             - Create a test panel');
            console.log('window.APP.panels.showAll()                - Show all panels');
            console.log('window.APP.panels.hideAll()                - Hide all panels');
            console.log('window.APP.panels.cascade()                - Cascade panels');
            console.log('window.APP.panels.tile()                   - Tile panels');
            console.log('window.APP.panels.getState()               - Get Redux state');
            console.log('window.APP.panels.monitor()                - Monitor state changes');
            console.log('window.APP.panels.performanceTest()        - Performance test');
            console.log('window.APP.panels.cleanup()                - Clean up test panels');
            console.log('window.APP.panels.export()                 - Export configurations');
            console.log('');
            console.log('// Sidebar Management:');
            console.log('window.APP.sidebar.switchToTag(tag)        - Switch to tag (settings/debug/publish)');
            console.log('window.APP.sidebar.getCurrentTag()         - Get current active tag');
            console.log('window.APP.sidebar.getTagPanels(tag)       - Get panels for specific tag');
            console.log('window.APP.sidebar.addPanel(config)        - Add panel to sidebar');
            console.log('window.APP.sidebar.removePanel(id)         - Remove panel from sidebar');
            console.log('');
            console.log('window.APP.panels.help()                   - Show this help');
            console.groupEnd();
        }
    });

    // Auto-initialize if panel system is ready
    if (window.APP.panels?.createPanel) {
        console.log('🔧 Panel utilities loaded and extended');
        console.log('Use window.APP.panels.help() for available commands');
    } else {
        // Wait for panel system to initialize
        const checkInterval = setInterval(() => {
            if (window.APP.panels?.createPanel) {
                clearInterval(checkInterval);
                console.log('🔧 Panel utilities loaded and extended');
                console.log('Use window.APP.panels.help() for available commands');
            }
        }, 100);
        
        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(checkInterval), 10000);
    }

})();
