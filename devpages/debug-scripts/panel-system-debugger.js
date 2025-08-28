/**
 * @file panel-system-debugger.js
 * @description Debug commands for the complete panel system
 */

// =================================================================
// PANEL SYSTEM DEBUG COMMANDS
// =================================================================

// Ensure APP.debug exists
if (!window.APP) import appInitializer from '../client/core/AppInitializer.js';
// Migrated from direct window.APP assignment
// window.APP = {};
if (!window.APP.debug) import appInitializer from '../client/core/AppInitializer.js';
// Migrated from direct window.APP property assignment
appInitializer.setAppProperty('debug', {});

window.APP.debug.panelSystem = {
    
    // Quick status check
    status() {
        console.log('🔍 Panel System Status Check');
        console.log('='.repeat(40));
        
        const manager = window.APP?.services?.workspaceManager;
        const panelFlyout = window.panelFlyoutManager;
        const dockFlyout = window.dockFlyoutManager;
        const reorder = window.panelReorderManager;
        const persistence = window.panelStatePersistence;
        
        console.log(`Workspace Manager: ${manager ? '✅' : '❌'}`);
        console.log(`Panel Flyout: ${panelFlyout ? '✅' : '❌'}`);
        console.log(`Dock Flyout: ${dockFlyout ? '✅' : '❌'}`);
        console.log(`Reorder Manager: ${reorder ? '✅' : '❌'}`);
        console.log(`State Persistence: ${persistence ? '✅' : '❌'}`);
        
        if (manager) {
            const status = manager.getStatus();
            console.log(`\nWorkspace: ${status.zones} zones, ${status.docks} docks, ${status.panels} panels`);
        }
        
        if (panelFlyout) {
            const flyouts = panelFlyout.getFlyoutPanels();
            console.log(`Flying Panels: ${flyouts.length} (${flyouts.join(', ')})`);
        }
        
        if (dockFlyout) {
            const floating = dockFlyout.getFloatingDocks();
            console.log(`Floating Docks: ${floating.length} (${floating.join(', ')})`);
        }
    },
    
    // Fix the panelActions duplicate error
    fixPanelActions() {
        console.log('🔧 Checking panelActions duplicate issue...');
        try {
            const { panelActions } = window.APP.store.getState().panels ? 
                require('/client/store/slices/panelSlice.js') : {};
            console.log('✅ panelActions loaded successfully');
            console.log('Available actions:', Object.keys(panelActions || {}));
        } catch (error) {
            console.error('❌ panelActions error:', error.message);
        }
    },
    
    // Test panel flyouts
    async testFlyouts() {
        console.log('🪟 Testing Panel Flyouts...');
        
        if (!window.panelFlyoutManager) {
            console.error('❌ Panel flyout manager not available');
            return;
        }
        
        // Fly out devtools panel
        const success = await window.panelFlyoutManager.flyOutPanel('devtools', {
            position: { x: 300, y: 200 },
            size: { width: 500, height: 400 }
        });
        
        console.log(`Devtools flyout: ${success ? '✅' : '❌'}`);
        
        // List all flyout panels
        const flyouts = window.panelFlyoutManager.getFlyoutPanels();
        console.log(`Currently flying: ${flyouts.join(', ')}`);
    },
    
    // Test dock floating
    async testDockFloat() {
        console.log('⚓ Testing Dock Floating...');
        
        if (!window.dockFlyoutManager) {
            console.error('❌ Dock flyout manager not available');
            return;
        }
        
        // Float debug dock
        const success = await window.dockFlyoutManager.floatDock('debug-dock', {
            position: { x: 400, y: 250 },
            size: { width: 450, height: 400 }
        });
        
        console.log(`Debug dock float: ${success ? '✅' : '❌'}`);
        
        // List floating docks
        const floating = window.dockFlyoutManager.getFloatingDocks();
        console.log(`Currently floating: ${floating.join(', ')}`);
    },
    
    // Test reordering
    testReorder() {
        console.log('🔄 Testing Panel Reordering...');
        
        if (!window.panelReorderManager) {
            console.error('❌ Panel reorder manager not available');
            return;
        }
        
        // Get current order
        const order = window.panelReorderManager.getPanelOrder('debug-dock');
        console.log(`Current order: ${order.join(', ')}`);
        
        // Reverse the order as a test
        if (order.length > 1) {
            const newOrder = [...order].reverse();
            window.panelReorderManager.setPanelOrder('debug-dock', newOrder);
            console.log(`New order: ${newOrder.join(', ')}`);
        }
    },
    
    // Test state persistence
    testPersistence() {
        console.log('💾 Testing State Persistence...');
        
        if (!window.panelStatePersistence) {
            console.error('❌ Panel state persistence not available');
            return;
        }
        
        // Save current state
        window.panelStatePersistence.saveAllStatesImmediate();
        console.log('✅ State saved');
        
        // Show storage stats
        const stats = window.panelStatePersistence.getStorageStats();
        console.log(`Storage: ${stats.itemCount} items, ${stats.totalSize} bytes`);
        
        // Show what's stored
        Object.entries(stats.items).forEach(([type, info]) => {
            if (info.size) {
                console.log(`  ${type}: ${info.size} bytes (${info.version})`);
            }
        });
    },
    
    // Create test panels for debugging
    createTestPanels() {
        console.log('🏗️ Creating Test Panels...');
        
        const { panelActions } = require('/client/store/slices/panelSlice.js');
        const { dispatch } = require('/client/appState.js');
        
        const testPanels = [
            { id: 'debug-test-1', title: 'Debug Test 1', dockId: 'debug-dock' },
            { id: 'debug-test-2', title: 'Debug Test 2', dockId: 'debug-dock' },
            { id: 'settings-test-1', title: 'Settings Test 1', dockId: 'settings-dock' }
        ];
        
        testPanels.forEach(panel => {
            dispatch(panelActions.createPanel(panel.id, panel.dockId, panel.title, {
                content: `<div style="padding:16px;"><h3>${panel.title}</h3><p>Test panel for debugging</p></div>`,
                isVisible: true
            }));
            console.log(`✅ Created: ${panel.id}`);
        });
    },
    
    // Clean up test panels
    cleanupTestPanels() {
        console.log('🧹 Cleaning up test panels...');
        
        const testIds = ['debug-test-1', 'debug-test-2', 'settings-test-1'];
        
        testIds.forEach(id => {
            // Close flyouts
            if (window.panelFlyoutManager?.isPanelFlyingOut(id)) {
                window.panelFlyoutManager.dockPanel(id);
            }
            
            // Remove from DOM
            const element = document.getElementById(`panel-${id}`);
            if (element) element.remove();
            
            console.log(`🗑️ Cleaned: ${id}`);
        });
    },
    
    // Reset all panel states
    resetPanelStates() {
        console.log('🔄 Resetting Panel States...');
        
        // Close all flyouts
        if (window.panelFlyoutManager) {
            const flyouts = window.panelFlyoutManager.getFlyoutPanels();
            flyouts.forEach(id => {
                window.panelFlyoutManager.dockPanel(id);
                console.log(`📥 Docked: ${id}`);
            });
        }
        
        // Park all floating docks
        if (window.dockFlyoutManager) {
            const floating = window.dockFlyoutManager.getFloatingDocks();
            floating.forEach(id => {
                window.dockFlyoutManager.parkDock(id);
                console.log(`⚓ Parked: ${id}`);
            });
        }
        
        // Clear persisted state
        if (window.panelStatePersistence) {
            window.panelStatePersistence.clearAllStates();
            console.log('🗑️ Cleared persisted states');
        }
        
        console.log('✅ Panel states reset');
    },
    
    // Show Redux state
    showReduxState() {
        console.log('🔄 Redux Panel State:');
        
        const state = window.APP?.store?.getState();
        if (!state) {
            console.error('❌ Redux store not available');
            return;
        }
        
        console.log('Panels:', state.panels?.panels || {});
        console.log('Docks:', state.panels?.docks || {});
    },
    
    // Run integration test
    async runIntegrationTest() {
        console.log('🧪 Running Integration Test...');
        
        if (window.testUnifiedWorkspace) {
            await window.testUnifiedWorkspace.full();
        } else {
            console.error('❌ Unified workspace tests not available');
        }
    },
    
    // Quick health check
    healthCheck() {
        console.log('🏥 Panel System Health Check');
        console.log('='.repeat(30));
        
        const checks = [
            { name: 'Workspace Manager', check: () => !!window.APP?.services?.workspaceManager },
            { name: 'Panel Flyout Manager', check: () => !!window.panelFlyoutManager },
            { name: 'Dock Flyout Manager', check: () => !!window.dockFlyoutManager },
            { name: 'Panel Reorder Manager', check: () => !!window.panelReorderManager },
            { name: 'State Persistence', check: () => !!window.panelStatePersistence },
            { name: 'Redux Store', check: () => !!window.APP?.store },
            { name: 'Panel Actions', check: () => {
                try {
                    const { panelActions } = require('/client/store/slices/panelSlice.js');
                    return !!panelActions;
                } catch { return false; }
            }}
        ];
        
        let passed = 0;
        checks.forEach(({ name, check }) => {
            const result = check();
            console.log(`${result ? '✅' : '❌'} ${name}`);
            if (result) passed++;
        });
        
        console.log(`\n🎯 Health: ${passed}/${checks.length} systems healthy`);
        
        if (passed === checks.length) {
            console.log('🎉 All systems operational!');
        } else {
            console.log('⚠️ Some systems need attention');
        }
    }
};

// =================================================================
// QUICK COMMANDS
// =================================================================

// Shortcut functions for common operations under APP.debug
window.APP.debug.flyout = (panelId) => window.panelFlyoutManager?.flyOutPanel(panelId);
window.APP.debug.dock = (panelId) => window.panelFlyoutManager?.dockPanel(panelId);
window.APP.debug.float = (dockId) => window.dockFlyoutManager?.floatDock(dockId);
window.APP.debug.park = (dockId) => window.dockFlyoutManager?.parkDock(dockId);

// =================================================================
// AUTO-INITIALIZATION
// =================================================================

console.log('🛠️ Panel System Debugger Loaded');
console.log('Available commands:');
console.log('  APP.debug.panelSystem.status() - System status');
console.log('  APP.debug.panelSystem.healthCheck() - Health check');
console.log('  APP.debug.panelSystem.testFlyouts() - Test panel flyouts');
console.log('  APP.debug.panelSystem.testDockFloat() - Test dock floating');
console.log('  APP.debug.panelSystem.testReorder() - Test reordering');
console.log('  APP.debug.panelSystem.testPersistence() - Test state persistence');
console.log('  APP.debug.panelSystem.createTestPanels() - Create test panels');
console.log('  APP.debug.panelSystem.resetPanelStates() - Reset everything');
console.log('  APP.debug.panelSystem.runIntegrationTest() - Full integration test');
console.log('');
console.log('Quick shortcuts:');
console.log('  APP.debug.flyout("panel-id") - Fly out panel');
console.log('  APP.debug.dock("panel-id") - Dock panel');
console.log('  APP.debug.float("dock-id") - Float dock');
console.log('  APP.debug.park("dock-id") - Park dock');
