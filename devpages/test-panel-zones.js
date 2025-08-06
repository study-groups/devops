/**
 * test-panel-zones.js - Quick test to validate panel zone assignments
 * Run this in browser console to see what's actually happening
 */

function testPanelZoneAssignments() {
    console.log('🧪 TESTING PANEL ZONE ASSIGNMENTS...');
    console.log('=====================================');
    
    // Test 1: Check Redux state
    console.log('\n1️⃣ REDUX STATE CHECK:');
    const state = window.APP?.services?.store?.getState();
    if (state && state.panels) {
        console.log('📊 Redux Panel Docks:');
        Object.entries(state.panels.docks).forEach(([dockId, dock]) => {
            console.log(`  ${dockId}: panels=[${dock.panels.join(', ') || 'EMPTY'}], visible=${dock.isVisible}`);
        });
        
        console.log('\n📊 Redux Panel Definitions:');
        Object.entries(state.panels.panels).forEach(([panelId, panel]) => {
            console.log(`  ${panelId}: dockId=${panel.dockId}, visible=${panel.isVisible}`);
        });
    } else {
        console.error('❌ Redux panels state not found');
    }
    
    // Test 2: Check DOM placement
    console.log('\n2️⃣ DOM PLACEMENT CHECK:');
    const zones = {
        'workspace-sidebar': [],
        'workspace-editor': [],
        'workspace-preview': []
    };
    
    Object.keys(zones).forEach(zoneId => {
        const container = document.getElementById(zoneId);
        if (container) {
            const panels = Array.from(container.children)
                .filter(el => el.classList.contains('workspace-panel') || el.id.includes('panel'))
                .map(el => el.id);
            zones[zoneId] = panels;
            console.log(`🏠 ${zoneId}: [${panels.join(', ') || 'EMPTY'}]`);
        } else {
            console.error(`❌ Zone container not found: ${zoneId}`);
        }
    });
    
    // Test 3: Check panel registry expectations vs reality
    console.log('\n3️⃣ EXPECTATION vs REALITY CHECK:');
    const panelDefinitions = [
        { id: 'file-browser', expectedZone: 'sidebar' },
        { id: 'code', expectedZone: 'sidebar' },
        { id: 'editor', expectedZone: 'editor' },
        { id: 'preview', expectedZone: 'preview' },
        { id: 'settings-panel', expectedZone: 'sidebar' },
        { id: 'nlp-panel', expectedZone: 'sidebar' },
        { id: 'log', expectedZone: 'sidebar' }
    ];
    
    panelDefinitions.forEach(({ id, expectedZone }) => {
        const element = document.getElementById(id);
        if (element) {
            const actualContainer = element.closest('[id^="workspace-"]');
            const actualZone = actualContainer ? actualContainer.id.replace('workspace-', '') : 'UNKNOWN';
            const match = actualZone === expectedZone;
            console.log(`${match ? '✅' : '❌'} ${id}: expected=${expectedZone}, actual=${actualZone}`);
        } else {
            console.log(`⚠️ ${id}: element not found in DOM`);
        }
    });
    
    // Test 4: Check WorkspaceManager state
    console.log('\n4️⃣ WORKSPACEMANAGER CHECK:');
    const workspaceManager = window.APP?.services?.workspaceManager;
    if (workspaceManager) {
        console.log('📋 Loaded panel instances:', Array.from(workspaceManager.loadedPanelInstances.keys()));
        console.log('🏠 Semantic zones:', Object.keys(workspaceManager.semanticZones));
        
        // Check if semantic zones are properly mapped
        Object.entries(workspaceManager.semanticZones).forEach(([zoneName, container]) => {
            if (container) {
                console.log(`✅ ${zoneName} → ${container.id}`);
            } else {
                console.log(`❌ ${zoneName} → null/undefined`);
            }
        });
    } else {
        console.error('❌ WorkspaceManager not found');
    }
    
    // Test 5: Quick API test
    console.log('\n5️⃣ API TEST:');
    if (window.APP?.workspace) {
        console.log('✅ APP.workspace API available');
        const systemInfo = window.APP.workspace.getSystemInfo();
        console.log('📊 System info:', systemInfo);
    } else {
        console.log('❌ APP.workspace API not available');
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('- Check Redux dock assignments vs DOM placement');
    console.log('- Look for mismatches between expected and actual zones');
    console.log('- Verify WorkspaceManager semantic zone mapping');
    
    return {
        reduxState: state?.panels,
        domZones: zones,
        workspaceManager: workspaceManager
    };
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
    console.log('🧪 Panel Zone Test loaded. Run testPanelZoneAssignments() to check panel assignments.');
} else {
    module.exports = { testPanelZoneAssignments };
}