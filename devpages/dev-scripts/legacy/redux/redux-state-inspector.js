/**
 * Redux State Inspector
 * Comprehensive Redux state debugging for DevPages
 */

console.log('🔍 REDUX STATE INSPECTOR');
console.log('========================');

// 1. Store Availability
console.log('\n1. STORE AVAILABILITY:');
console.log('window.APP:', typeof window.APP);
console.log('window.APP.store:', typeof window.APP?.store);
console.log('window.APP.services:', window.APP?.services ? Object.keys(window.APP.services) : 'Not available');

if (!window.APP?.store) {
    console.error('❌ Redux store not available');
    console.log('Available on window.APP:', window.APP ? Object.keys(window.APP) : 'window.APP not found');
} else {

const store = window.APP.store;
const state = store.getState();

// 2. Full State Overview
console.log('\n2. FULL STATE OVERVIEW:');
console.log('State keys:', Object.keys(state));
console.log('Full state:', state);

// 3. UI Slice Deep Dive
console.log('\n3. UI SLICE ANALYSIS:');
if (state.ui) {
    console.log('UI State:', state.ui);
    console.log('Left Sidebar Visible:', state.ui.leftSidebarVisible);
    console.log('Right Sidebar Visible:', state.ui.rightSidebarVisible);
    console.log('Active Panel:', state.ui.activePanel);
    console.log('Color Scheme:', state.ui.colorScheme);
} else {
    console.error('❌ UI slice not found in state');
}

// 4. Panel Slice Analysis
console.log('\n4. PANEL SLICE ANALYSIS:');
if (state.panels) {
    console.log('Panel State:', state.panels);
    console.log('Visible Panels:', state.panels.visiblePanels);
    console.log('Panel Positions:', state.panels.panelPositions);
} else {
    console.log('ℹ️ Panel slice not found (may be normal)');
}

// 5. Settings Slice Analysis
console.log('\n5. SETTINGS SLICE ANALYSIS:');
if (state.settings) {
    console.log('Settings State:', state.settings);
    console.log('Current Context:', state.settings.currentContext);
    console.log('Design Tokens:', state.settings.designTokens);
} else {
    console.log('ℹ️ Settings slice not found');
}

// 6. Action Dispatcher Test
console.log('\n6. ACTION DISPATCHER TEST:');
window.debugDispatch = function(action) {
    console.log('🚀 Dispatching action:', action);
    try {
        store.dispatch(action);
        console.log('✅ Action dispatched successfully');
        console.log('New state:', store.getState());
    } catch (error) {
        console.error('❌ Action dispatch failed:', error);
    }
};

// 7. State Subscription Test
console.log('\n7. STATE SUBSCRIPTION TEST:');
let subscriptionCount = 0;
const unsubscribe = store.subscribe(() => {
    subscriptionCount++;
    console.log(`📡 State change #${subscriptionCount}:`, store.getState());
});

window.debugUnsubscribe = unsubscribe;

// 8. Common Actions Quick Test
console.log('\n8. QUICK ACTION TESTS:');
window.testToggleSidebar = () => debugDispatch({ type: 'ui/toggleLeftSidebar' });
window.testShowSidebar = () => debugDispatch({ type: 'ui/setLeftSidebarVisible', payload: true });
window.testHideSidebar = () => debugDispatch({ type: 'ui/setLeftSidebarVisible', payload: false });

console.log('✅ Redux inspector ready!');
console.log('Available functions:');
console.log('- debugDispatch(action)');
console.log('- testToggleSidebar()');
console.log('- testShowSidebar()');
console.log('- testHideSidebar()');
console.log('- debugUnsubscribe() - stop state monitoring');

} // End of store availability check
