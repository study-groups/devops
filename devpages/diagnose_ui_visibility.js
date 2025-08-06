/**
 * Quick UI Visibility Diagnostic Script
 * Run this in browser console to check what's broken
 */

console.log('🔍 UI VISIBILITY DIAGNOSTIC');
console.log('===========================');

// 1. Check if PathManager component exists and is visible
const pathManagerContainer = document.getElementById('context-manager-container');
console.log('1. PathManager Container:');
console.log('   - Exists:', !!pathManagerContainer);
console.log('   - Visible:', pathManagerContainer?.style.display !== 'none');
console.log('   - Content length:', pathManagerContainer?.innerHTML?.length || 0);
console.log('   - Element:', pathManagerContainer);

// 2. Check ViewControls
const viewControlsContainer = document.getElementById('view-controls-container');
console.log('\n2. ViewControls Container:');
console.log('   - Exists:', !!viewControlsContainer);
console.log('   - Visible:', viewControlsContainer?.style.display !== 'none');
console.log('   - Content length:', viewControlsContainer?.innerHTML?.length || 0);
console.log('   - Element:', viewControlsContainer);

// 3. Check Edit/Log buttons
const editButton = document.querySelector('[data-action="edit"], .edit-btn, #edit-btn');
const logButton = document.querySelector('[data-action="log"], .log-btn, #log-btn');
console.log('\n3. Navigation Buttons:');
console.log('   - Edit button exists:', !!editButton);
console.log('   - Edit button element:', editButton);
console.log('   - Log button exists:', !!logButton);
console.log('   - Log button element:', logButton);

// 4. Check workspace visibility
const workspaceSidebar = document.getElementById('workspace-sidebar');
console.log('\n4. Workspace Sidebar:');
console.log('   - Exists:', !!workspaceSidebar);
console.log('   - data-visible:', workspaceSidebar?.getAttribute('data-visible'));
console.log('   - Style display:', workspaceSidebar?.style.display);
console.log('   - Computed visibility:', getComputedStyle(workspaceSidebar)?.visibility);

// 5. Check Redux UI state
try {
    const uiState = window.APP?.services?.store?.getState()?.ui;
    console.log('\n5. Redux UI State:');
    console.log('   - UI state exists:', !!uiState);
    console.log('   - Current view mode:', uiState?.currentView);
    console.log('   - Panel visibility:', uiState?.panelVisibility);
    console.log('   - Full UI state:', uiState);
} catch (e) {
    console.log('\n5. Redux UI State: ERROR -', e.message);
}

// 6. Check if event handlers are working
console.log('\n6. Event Handler Test:');
const testButton = document.querySelector('.tab-btn, [data-action]');
if (testButton) {
    console.log('   - Found test button:', testButton);
    console.log('   - Has click handler:', !!testButton.onclick);
    console.log('   - Event listeners:', getEventListeners ? getEventListeners(testButton) : 'getEventListeners not available');
} else {
    console.log('   - No test button found');
}

// 7. Check if CSS is loaded
const computedStyles = getComputedStyle(document.body);
console.log('\n7. CSS Loading Check:');
console.log('   - Body font-family:', computedStyles.fontFamily);
console.log('   - Body background:', computedStyles.backgroundColor);

console.log('\n🎯 SUMMARY:');
console.log('- Check if containers exist but are hidden via CSS');
console.log('- Check if event handlers are missing');  
console.log('- Check if Redux state is correctly setting visibility');
console.log('- Look for JavaScript errors preventing UI updates');