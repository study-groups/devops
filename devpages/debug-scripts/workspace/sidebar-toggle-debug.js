/**
 * Sidebar Toggle Debug Script
 * Run in Chrome DevTools Console to diagnose sidebar toggle issues
 */

console.log('🔍 SIDEBAR TOGGLE DEBUG SCRIPT');
console.log('================================');

// 1. Check Redux Store State
console.log('\n1. REDUX STORE STATE:');
if (window.APP && window.APP.store) {
    const state = window.APP.store.getState();
    console.log('UI State:', state.ui);
    console.log('Left Sidebar Visible:', state.ui?.leftSidebarVisible);
    console.log('Right Sidebar Visible:', state.ui?.rightSidebarVisible);
} else {
    console.error('❌ Redux store not found');
}

// 2. Check DOM Elements
console.log('\n2. DOM ELEMENTS:');
const sidebarToggleBtn = document.querySelector('#sidebar-toggle-btn');
const fileBrowserToggleBtn = document.querySelector('#file-browser-toggle-btn');
const leftSidebar = document.querySelector('#left-sidebar');
const rightSidebar = document.querySelector('#right-sidebar');

console.log('Sidebar Toggle Button:', sidebarToggleBtn);
console.log('File Browser Toggle Button:', fileBrowserToggleBtn);
console.log('Left Sidebar Element:', leftSidebar);
console.log('Right Sidebar Element:', rightSidebar);

// 3. Check Event Listeners
console.log('\n3. EVENT LISTENERS:');
if (sidebarToggleBtn) {
    console.log('Sidebar toggle button found');
    // Test click programmatically
    console.log('Testing programmatic click...');
    sidebarToggleBtn.click();
} else {
    console.error('❌ Sidebar toggle button not found');
}

// 4. Check Redux Actions
console.log('\n4. REDUX ACTIONS TEST:');
if (window.APP && window.APP.store) {
    console.log('Testing direct Redux dispatch...');
    try {
        // Import uiThunks if available
        if (window.APP.uiThunks) {
            window.APP.store.dispatch(window.APP.uiThunks.toggleLeftSidebar());
            console.log('✅ Direct Redux dispatch successful');
        } else {
            // Try manual action
            window.APP.store.dispatch({
                type: 'ui/toggleLeftSidebar'
            });
            console.log('✅ Manual action dispatch successful');
        }
    } catch (error) {
        console.error('❌ Redux dispatch failed:', error);
    }
}

// 5. Check CSS Classes
console.log('\n5. CSS CLASSES:');
if (leftSidebar) {
    console.log('Left sidebar classes:', leftSidebar.className);
    console.log('Left sidebar computed style display:', getComputedStyle(leftSidebar).display);
    console.log('Left sidebar computed style visibility:', getComputedStyle(leftSidebar).visibility);
}

// 6. Check PathManager Component
console.log('\n6. PATHMANAGER COMPONENT:');
const contextManager = document.querySelector('#context-manager-container');
console.log('Context Manager Container:', contextManager);
if (contextManager) {
    const buttons = contextManager.querySelectorAll('button');
    console.log('Buttons in context manager:', buttons.length);
    buttons.forEach((btn, i) => {
        console.log(`Button ${i}:`, btn.id, btn.className, btn.textContent.trim());
    });
}

// 7. Manual Toggle Function
console.log('\n7. MANUAL TOGGLE FUNCTION:');
window.debugToggleSidebar = function() {
    console.log('🔧 Manual sidebar toggle...');
    if (window.APP && window.APP.store) {
        const currentState = window.APP.store.getState();
        const isVisible = currentState.ui?.leftSidebarVisible;
        console.log('Current sidebar visible:', isVisible);
        
        window.APP.store.dispatch({
            type: 'ui/setLeftSidebarVisible',
            payload: !isVisible
        });
        
        console.log('Toggle dispatched, new state should be:', !isVisible);
        
        // Check state after dispatch
        setTimeout(() => {
            const newState = window.APP.store.getState();
            console.log('New sidebar visible:', newState.ui?.leftSidebarVisible);
        }, 100);
    }
};

console.log('✅ Debug script complete. Use debugToggleSidebar() to manually test.');
