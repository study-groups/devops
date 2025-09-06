/**
 * @file test-workspace-harmonization.js
 * @description Test script to validate workspace harmonization changes
 */

console.log('🧪 Testing Workspace Harmonization Changes');
console.log('='.repeat(50));

// Test 1: Check if SimplifiedWorkspaceManager is available
console.log('\n1️⃣ Testing SimplifiedWorkspaceManager...');
const workspaceManager = window.APP?.services?.workspaceManager;
if (workspaceManager) {
    console.log('✅ WorkspaceManager available');
    console.log('   Type:', workspaceManager.constructor.name);
    
    // Test core areas
    const coreAreas = workspaceManager.coreAreas;
    if (coreAreas) {
        console.log('✅ Core areas available:', Object.keys(coreAreas));
        
        // Check if editor and preview are initialized
        Object.entries(coreAreas).forEach(([name, area]) => {
            const status = area.instance ? '✅' : '❌';
            console.log(`   ${name}: ${status} ${area.instance ? 'initialized' : 'not initialized'}`);
        });
    }
} else {
    console.log('❌ WorkspaceManager not available');
}

// Test 2: Check if WorkspaceController is available
console.log('\n2️⃣ Testing WorkspaceController...');
const workspaceController = window.APP?.services?.workspaceController;
if (workspaceController) {
    console.log('✅ WorkspaceController available');
    console.log('   Initialized:', workspaceController.initialized);
    console.log('   Zones:', workspaceController.zones?.size || 0);
    console.log('   Panels:', workspaceController.panels?.size || 0);
} else {
    console.log('❌ WorkspaceController not available');
}

// Test 3: Check flyout systems
console.log('\n3️⃣ Testing Flyout Systems...');
const panelFlyout = window.panelFlyoutManager;
const dockFlyout = window.dockFlyoutManager;

if (panelFlyout) {
    console.log('✅ PanelFlyoutManager available');
    console.log('   Type:', panelFlyout.constructor.name);
    try {
        const flyouts = panelFlyout.flyoutPanels?.size || 0;
        console.log('   Active flyouts:', flyouts);
    } catch (e) {
        console.log('   Status: Available but may need initialization');
    }
} else {
    console.log('❌ PanelFlyoutManager not available');
}

if (dockFlyout) {
    console.log('✅ DockFlyoutManager available');
    console.log('   Type:', dockFlyout.constructor.name);
    try {
        const floating = dockFlyout.floatingDocks?.size || 0;
        console.log('   Floating docks:', floating);
    } catch (e) {
        console.log('   Status: Available but may need initialization');
    }
} else {
    console.log('❌ DockFlyoutManager not available');
}

// Test 4: Check reorder system
console.log('\n4️⃣ Testing Reorder System...');
const reorderManager = window.panelReorderManager;
if (reorderManager) {
    console.log('✅ PanelReorderManager available');
    console.log('   Type:', reorderManager.constructor.name);
    console.log('   Drop zones:', reorderManager.dropZones?.size || 0);
} else {
    console.log('❌ PanelReorderManager not available');
}

// Test 5: Check if old systems are removed
console.log('\n5️⃣ Testing Cleanup...');
const unifiedManager = window.unifiedWorkspaceManager;
if (unifiedManager) {
    console.log('⚠️ UnifiedWorkspaceManager still exists - should be removed');
} else {
    console.log('✅ UnifiedWorkspaceManager successfully removed');
}

// Test 6: Panel system status
console.log('\n6️⃣ Panel System Status...');
if (window.APP?.debug?.panelSystem?.status) {
    console.log('Running comprehensive panel system status...');
    window.APP.debug.panelSystem.status();
} else {
    console.log('❌ Panel system debugger not available');
}

// Test 7: Try flyout functionality
console.log('\n7️⃣ Testing Flyout Functionality...');
if (panelFlyout && typeof panelFlyout.flyOutPanel === 'function') {
    console.log('✅ Panel flyout functionality available');
    console.log('   Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(panelFlyout))
        .filter(name => typeof panelFlyout[name] === 'function' && !name.startsWith('_'))
        .join(', '));
} else {
    console.log('❌ Panel flyout functionality not available');
}

if (dockFlyout && typeof dockFlyout.floatDock === 'function') {
    console.log('✅ Dock flyout functionality available');
    console.log('   Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(dockFlyout))
        .filter(name => typeof dockFlyout[name] === 'function' && !name.startsWith('_'))
        .join(', '));
} else {
    console.log('❌ Dock flyout functionality not available');
}

console.log('\n🎯 Test Summary:');
console.log('- SimplifiedWorkspaceManager:', workspaceManager ? '✅' : '❌');
console.log('- WorkspaceController:', workspaceController ? '✅' : '❌');
console.log('- PanelFlyoutManager:', panelFlyout ? '✅' : '❌');
console.log('- DockFlyoutManager:', dockFlyout ? '✅' : '❌');
console.log('- PanelReorderManager:', reorderManager ? '✅' : '❌');
console.log('- UnifiedWorkspaceManager removed:', !unifiedManager ? '✅' : '❌');

console.log('\n🚀 Harmonization Status: ' + 
    (workspaceManager && workspaceController && panelFlyout && dockFlyout && reorderManager && !unifiedManager 
        ? 'SUCCESS ✅' 
        : 'NEEDS ATTENTION ⚠️'));
