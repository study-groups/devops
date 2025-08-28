/**
 * Test Redux Panel System
 * Verify that the new panel registry and Redux integration works
 */

import { panelRegistry } from './client/panels/panelRegistry.js';
import { appStore } from './client/appState.js';
import { panelActions, selectDocks, selectPanels } from './client/store/slices/panelSlice.js';

console.log('🧪 Testing Redux Panel System...');

// Test 1: Panel Registry
console.log('\n📋 Testing Panel Registry:');
const allPanels = panelRegistry.getAllPanels();
console.log(`✅ Registered ${allPanels.length} panels:`);
allPanels.forEach(panel => {
    console.log(`  - ${panel.id}: ${panel.title} (${panel.allowedZones?.join(', ') || 'any zone'})`);
});

// Test 2: Core Panel Check
console.log('\n📋 Testing Core Panels:');
const contextPanel = panelRegistry.getPanel('context-panel');
if (contextPanel) {
    console.log(`✅ Found Context Panel: ${contextPanel.title}`);
    console.log(`   Factory: ${typeof contextPanel.factory}`);
    console.log(`   Zones: ${contextPanel.allowedZones?.join(', ')}`);
} else {
    console.log('❌ Context Panel not found');
}

// Test 3: Redux State
console.log('\n🏪 Testing Redux State:');
const state = appStore.getState();
const docks = selectDocks(state);
const panels = selectPanels(state);

console.log(`✅ Docks in state: ${Object.keys(docks).length}`);
Object.keys(docks).forEach(dockId => {
    const dock = docks[dockId];
    console.log(`  - ${dockId}: ${dock.panels?.length || 0} panels, zone: ${dock.zone}`);
});

console.log(`✅ Panels in state: ${Object.keys(panels).length}`);
Object.keys(panels).forEach(panelId => {
    const panel = panels[panelId];
    console.log(`  - ${panelId}: dock=${panel.dockId}, visible=${panel.isVisible}`);
});

// Test 4: Redux Actions
console.log('\n⚡ Testing Redux Actions:');
try {
    // Test showing the context panel
    appStore.dispatch(panelActions.showPanel({ panelId: 'context-panel' }));
    
    const updatedState = appStore.getState();
    const contextPanelState = selectPanels(updatedState)['context-panel'];
    
    if (contextPanelState?.isVisible) {
        console.log('✅ Successfully showed Context Panel via Redux');
    } else {
        console.log('❌ Failed to show Context Panel');
    }
    
    // Test dock management
    appStore.dispatch(panelActions.updateDockPosition({ 
        dockId: 'debug-dock', 
        position: { x: 200, y: 150 } 
    }));
    
    const debugDock = selectDocks(appStore.getState())['debug-dock'];
    if (debugDock?.position?.x === 200) {
        console.log('✅ Successfully updated dock position via Redux');
    } else {
        console.log('❌ Failed to update dock position');
    }
    
} catch (error) {
    console.log(`❌ Redux action test failed: ${error.message}`);
}

// Test 5: Panel Factory Loading
console.log('\n🏭 Testing Panel Factory Loading:');
const testPanel = panelRegistry.getPanel('context-panel');
if (testPanel && testPanel.factory) {
    console.log('✅ Panel factory found, attempting to load...');
    testPanel.factory()
        .then(module => {
            const PanelClass = module.default || module;
            if (typeof PanelClass === 'function') {
                console.log('✅ Panel class loaded successfully');
                console.log(`   Constructor: ${PanelClass.name}`);
            } else {
                console.log('❌ Panel factory did not return a constructor');
            }
        })
        .catch(error => {
            console.log(`❌ Panel factory loading failed: ${error.message}`);
        });
} else {
    console.log('❌ No factory found for test panel');
}

console.log('\n🎉 Panel System Test Complete!');
console.log('\n💡 Basic Panel Usage:');
console.log('   1. Dispatch: panelActions.showPanel({ panelId: "context-panel" })');
console.log('   2. The panel will appear in the sidebar dock');
console.log('   3. Use panelRegistry.getAllPanels() to see available panels');
