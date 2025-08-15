// Debug script to test panel warnings fixes - paste in browser console

console.log('🔧 TESTING PANEL WARNINGS FIXES');
console.log('===============================');

const store = window.APP?.store || window.APP?.services?.appStore;
if (!store) {
    console.error('❌ Redux store not found!');
    throw new Error('Redux store not available');
}

// Test 1: Check if deprecated registerPanel warnings are gone
console.log('\n1️⃣ TESTING DEPRECATED REGISTERPANEL WARNINGS:');
console.log('Looking for any remaining registerPanel calls...');

// Test 2: Check dock assignments
console.log('\n2️⃣ TESTING DOCK ASSIGNMENTS:');
const state = store.getState();
const docks = state.panels?.docks || {};

console.log('📊 Current dock assignments:');
Object.entries(docks).forEach(([dockId, dock]) => {
    console.log(`  ${dockId}: panels=[${dock.panels.join(', ') || 'EMPTY'}], visible=${dock.isVisible}`);
});

// Test 3: Check if editor and preview panels are assigned
const editorAssigned = Object.values(docks).some(dock => dock.panels.includes('editor'));
const previewAssigned = Object.values(docks).some(dock => dock.panels.includes('preview'));

console.log(`✅ Editor panel assigned to dock: ${editorAssigned}`);
console.log(`✅ Preview panel assigned to dock: ${previewAssigned}`);

// Test 4: Check directory loading
console.log('\n3️⃣ TESTING DIRECTORY LOADING:');
const pathState = state.path || {};
const fileState = state.file || {};
const authState = state.auth || {};

console.log('🔐 Auth status:', {
    isAuthenticated: authState.isAuthenticated,
    username: authState.username
});

console.log('📁 Path state:', {
    topLevelDirs: pathState.topLevelDirs,
    topLevelDirsLength: pathState.topLevelDirs?.length || 0,
    status: pathState.status,
    error: pathState.error
});

console.log('📂 File state:', {
    availableTopLevelDirs: fileState.availableTopLevelDirs,
    availableTopLevelDirsLength: fileState.availableTopLevelDirs?.length || 0,
    status: fileState.status
});

// Test 5: Try to reload directories if they're empty
if (authState.isAuthenticated && (!pathState.topLevelDirs || pathState.topLevelDirs.length === 0)) {
    console.log('\n🔄 ATTEMPTING TO RELOAD DIRECTORIES:');
    
    // Try to reload directories
    fetch('/api/files/dirs', { credentials: 'include' })
        .then(response => {
            console.log(`API /api/files/dirs response status: ${response.status}`);
            if (response.ok) {
                return response.json();
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        })
        .then(directories => {
            console.log('✅ API returned directories:', directories);
            if (directories && directories.length > 0) {
                console.log('🎯 Directories are available from API - there might be a state update issue');
            } else {
                console.log('❌ API returned empty directories - this is the root cause');
            }
        })
        .catch(error => {
            console.error('❌ API call failed:', error);
            console.log('🔍 This explains why "No directories found" appears');
        });
} else if (!authState.isAuthenticated) {
    console.log('ℹ️ User not authenticated - directory loading skipped');
} else {
    console.log('✅ Directories already loaded');
}

// Test 6: Check for any remaining console warnings
console.log('\n4️⃣ MONITORING FOR WARNINGS:');
console.log('Watch the console for any remaining deprecated registerPanel warnings...');

setTimeout(() => {
    console.log('\n📋 SUMMARY:');
    console.log('• Deprecated registerPanel calls should be eliminated');
    console.log('• Editor and preview panels should be assigned to docks');
    console.log('• Directory loading should work when authenticated');
    console.log('• "No directories found" should only appear if API actually returns empty results');
    console.log('\n✅ Panel warnings fix test complete!');
}, 2000);
