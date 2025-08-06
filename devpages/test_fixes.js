/**
 * Test script to verify the fixes work
 * Run this in browser console after refreshing the page
 */

console.log('🔧 TESTING RECENT FIXES');
console.log('========================');

// 1. Test fileThunks availability
console.log('1. Testing fileThunks availability:');
import('/client/thunks/fileThunks.js')
    .then(module => {
        console.log('✅ fileThunks.js imported successfully');
        console.log('   - Available thunks:', Object.keys(module.fileThunks || {}));
        console.log('   - loadTopLevelDirectories available:', !!module.fileThunks?.loadTopLevelDirectories);
        console.log('   - loadFileContent available:', !!module.fileThunks?.loadFileContent);
    })
    .catch(error => {
        console.log('❌ fileThunks.js import failed:', error.message);
    });

// 2. Test PathManager layout
console.log('\n2. Testing PathManager layout:');
const pathManagerContainer = document.getElementById('context-manager-container');
if (pathManagerContainer) {
    const sidebarToggle = document.getElementById('sidebar-toggle-btn');
    const breadcrumbs = document.querySelector('.context-breadcrumbs');
    const wrapper = document.querySelector('.context-path-and-file-wrapper');
    
    console.log('✅ PathManager found');
    console.log('   - Sidebar toggle exists:', !!sidebarToggle);
    console.log('   - Breadcrumbs exist:', !!breadcrumbs);
    console.log('   - Wrapper has flex display:', wrapper?.style.display === 'flex');
    console.log('   - Wrapper computed style:', getComputedStyle(wrapper)?.display);
} else {
    console.log('❌ PathManager container not found');
}

// 3. Test file selection
console.log('\n3. Testing file selection:');
const fileSelector = document.querySelector('.context-selector');
if (fileSelector) {
    console.log('✅ File selector found');
    console.log('   - Options count:', fileSelector.options?.length || 0);
    console.log('   - Is disabled:', fileSelector.disabled);
    
    // Add temporary event listener to test selection
    const testHandler = (e) => {
        console.log('🔄 File selection changed to:', e.target.value);
        fileSelector.removeEventListener('change', testHandler);
    };
    fileSelector.addEventListener('change', testHandler);
    console.log('   - Test change handler added (will auto-remove)');
} else {
    console.log('❌ File selector not found');
}

// 4. Test Redux store state
console.log('\n4. Testing Redux state:');
if (window.APP?.services?.store) {
    const state = window.APP.services.store.getState();
    console.log('✅ Redux store accessible');
    console.log('   - UI contextManagerVisible:', state.ui?.contextManagerVisible);
    console.log('   - Auth isAuthenticated:', state.auth?.isAuthenticated);
    console.log('   - Path currentListing:', !!state.path?.currentListing);
} else {
    console.log('❌ Redux store not accessible');
}

console.log('\n🎯 TEST COMPLETE - Check results above!');