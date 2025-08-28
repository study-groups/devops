/**
 * @file test-flyout-system.js
 * @description Test and demonstration of the panel flyout system
 */

import { panelFlyoutManager } from './PanelFlyoutManager.js';
import { appStore, dispatch } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';

/**
 * Test the panel flyout system with debug panels
 */
export async function testPanelFlyoutSystem() {
    console.log('🧪 Testing Panel Flyout System...');
    
    // Test 1: Fly out a debug panel
    console.log('Test 1: Flying out debug panel...');
    const success1 = await panelFlyoutManager.flyOutPanel('devtools', {
        position: { x: 300, y: 200 },
        size: { width: 500, height: 400 },
        title: '🛠️ DevTools (Flying Out)'
    });
    console.log(`✅ Debug panel flyout: ${success1 ? 'SUCCESS' : 'FAILED'}`);
    
    // Test 2: Fly out another panel
    setTimeout(async () => {
        console.log('Test 2: Flying out DOM inspector...');
        const success2 = await panelFlyoutManager.flyOutPanel('dom-inspector', {
            position: { x: 400, y: 250 },
            size: { width: 450, height: 350 },
            title: '🔍 DOM Inspector (Flying Out)'
        });
        console.log(`✅ DOM inspector flyout: ${success2 ? 'SUCCESS' : 'FAILED'}`);
    }, 2000);
    
    // Test 3: Toggle flyout state
    setTimeout(async () => {
        console.log('Test 3: Toggling devtools flyout state...');
        const success3 = await panelFlyoutManager.togglePanelFlyout('devtools');
        console.log(`✅ DevTools toggle: ${success3 ? 'SUCCESS' : 'FAILED'}`);
    }, 4000);
    
    // Test 4: Show flyout status
    setTimeout(() => {
        console.log('Test 4: Current flyout status...');
        const flyoutPanels = panelFlyoutManager.getFlyoutPanels();
        console.log(`✅ Currently flying out: ${flyoutPanels.join(', ') || 'none'}`);
        
        flyoutPanels.forEach(panelId => {
            console.log(`   - ${panelId}: ${panelFlyoutManager.isPanelFlyingOut(panelId) ? 'FLYING' : 'DOCKED'}`);
        });
    }, 6000);
    
    return true;
}

/**
 * Create test panels for flyout demonstration
 */
export function createTestFlyoutPanels() {
    console.log('🏗️ Creating test panels for flyout demonstration...');
    
    // Create test panels in Redux state
    const testPanels = [
        {
            id: 'test-panel-1',
            title: 'Test Panel 1',
            dockId: 'debug-dock',
            content: '<div style="padding: 16px;"><h3>Test Panel 1</h3><p>This is a test panel for flyout demonstration.</p></div>'
        },
        {
            id: 'test-panel-2', 
            title: 'Test Panel 2',
            dockId: 'debug-dock',
            content: '<div style="padding: 16px;"><h3>Test Panel 2</h3><p>Another test panel with different content.</p></div>'
        },
        {
            id: 'test-panel-3',
            title: 'Test Panel 3',
            dockId: 'settings-dock',
            content: '<div style="padding: 16px;"><h3>Test Panel 3</h3><p>A settings panel for testing flyout.</p></div>'
        }
    ];
    
    testPanels.forEach(panel => {
        dispatch(panelActions.createPanel(panel.id, panel.dockId, panel.title, {
            content: panel.content,
            isVisible: true,
            isFlyout: false
        }));
    });
    
    console.log(`✅ Created ${testPanels.length} test panels`);
    return testPanels;
}

/**
 * Test panel reordering within docks
 */
export function testPanelReordering() {
    console.log('🔄 Testing panel reordering...');
    
    const state = appStore.getState();
    const debugDock = state.panels?.docks?.['debug-dock'];
    
    if (debugDock && debugDock.panels.length > 1) {
        const originalOrder = [...debugDock.panels];
        const newOrder = [originalOrder[1], originalOrder[0], ...originalOrder.slice(2)];
        
        console.log(`Original order: ${originalOrder.join(', ')}`);
        console.log(`New order: ${newOrder.join(', ')}`);
        
        dispatch(panelActions.reorderPanels('debug-dock', newOrder));
        console.log('✅ Panel reordering dispatched');
        
        // Verify the change
        setTimeout(() => {
            const updatedState = appStore.getState();
            const updatedDock = updatedState.panels?.docks?.['debug-dock'];
            console.log(`Updated order: ${updatedDock?.panels?.join(', ') || 'none'}`);
        }, 100);
    } else {
        console.log('⚠️ Not enough panels in debug dock for reordering test');
    }
}

/**
 * Test dock collapse/expand state
 */
export function testDockCollapseExpand() {
    console.log('📁 Testing dock collapse/expand...');
    
    const dockIds = ['debug-dock', 'settings-dock', 'sidebar-dock'];
    
    dockIds.forEach((dockId, index) => {
        setTimeout(() => {
            console.log(`Toggling visibility for ${dockId}...`);
            dispatch(panelActions.toggleDockVisibility(dockId));
            
            // Check state after toggle
            setTimeout(() => {
                const state = appStore.getState();
                const dock = state.panels?.docks?.[dockId];
                console.log(`${dockId} is now: ${dock?.isVisible ? 'VISIBLE' : 'HIDDEN'}`);
            }, 100);
        }, index * 1000);
    });
}

/**
 * Test state persistence for flyout panels
 */
export function testStatePersistence() {
    console.log('💾 Testing state persistence...');
    
    // Create a flyout panel and modify its state
    panelFlyoutManager.flyOutPanel('test-panel-1', {
        position: { x: 100, y: 100 },
        size: { width: 300, height: 250 }
    }).then(() => {
        console.log('✅ Test panel flew out');
        
        // Simulate page reload by restoring flyout panels
        setTimeout(() => {
            console.log('🔄 Simulating page reload - restoring flyout panels...');
            panelFlyoutManager.restoreFlyoutPanels();
            console.log('✅ Flyout panels restored');
        }, 2000);
    });
}

/**
 * Run comprehensive flyout system tests
 */
export async function runFlyoutSystemTests() {
    console.log('🚀 Running comprehensive flyout system tests...');
    
    // Step 1: Create test panels
    createTestFlyoutPanels();
    
    // Step 2: Test flyout functionality
    setTimeout(() => testPanelFlyoutSystem(), 500);
    
    // Step 3: Test reordering
    setTimeout(() => testPanelReordering(), 3000);
    
    // Step 4: Test collapse/expand
    setTimeout(() => testDockCollapseExpand(), 5000);
    
    // Step 5: Test persistence
    setTimeout(() => testStatePersistence(), 8000);
    
    console.log('✅ All flyout system tests scheduled');
}

/**
 * Add flyout buttons to existing panels for testing
 */
export function addFlyoutButtonsToExistingPanels() {
    console.log('🔘 Adding flyout buttons to existing panels...');
    
    // Find all panel headers and add flyout buttons
    const panelHeaders = document.querySelectorAll('.panel-header, .subpanel-header');
    
    panelHeaders.forEach(header => {
        const panelId = header.dataset.panelId || header.dataset.subpanelId;
        if (!panelId) return;
        
        // Check if flyout button already exists
        if (header.querySelector('.panel-flyout-btn')) return;
        
        const flyoutBtn = document.createElement('button');
        flyoutBtn.className = 'panel-flyout-btn';
        flyoutBtn.innerHTML = '🪟';
        flyoutBtn.title = 'Fly out panel';
        flyoutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panelFlyoutManager.togglePanelFlyout(panelId);
        });
        
        // Add to header
        const controls = header.querySelector('.panel-controls') || header;
        controls.appendChild(flyoutBtn);
    });
    
    console.log(`✅ Added flyout buttons to ${panelHeaders.length} panels`);
}

// Expose functions to window for console testing
if (typeof window !== 'undefined') {
    window.testPanelFlyout = {
        testSystem: testPanelFlyoutSystem,
        createTestPanels: createTestFlyoutPanels,
        testReordering: testPanelReordering,
        testCollapseExpand: testDockCollapseExpand,
        testPersistence: testStatePersistence,
        runAllTests: runFlyoutSystemTests,
        addFlyoutButtons: addFlyoutButtonsToExistingPanels
    };
    
    console.log('🧪 Panel flyout test functions available at window.testPanelFlyout');
}
