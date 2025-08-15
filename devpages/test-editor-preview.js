// Test editor and preview functionality - paste in browser console

console.log('🎬 TESTING EDITOR AND PREVIEW FUNCTIONALITY');
console.log('==========================================');

// Check if ComponentManager mounted the editor and preview
console.log('\n1️⃣ CHECKING COMPONENT MOUNTING:');
const editorElement = document.getElementById('editor');
const previewElement = document.getElementById('preview');

console.log('Editor element:', editorElement ? 'EXISTS' : 'MISSING');
console.log('Preview element:', previewElement ? 'EXISTS' : 'MISSING');

if (editorElement) {
    console.log('Editor element classes:', editorElement.className);
    console.log('Editor element style.display:', editorElement.style.display);
    console.log('Editor element children:', editorElement.children.length);
}

if (previewElement) {
    console.log('Preview element classes:', previewElement.className);
    console.log('Preview element style.display:', previewElement.style.display);
    console.log('Preview element children:', previewElement.children.length);
}

// Check workspace containers
console.log('\n2️⃣ CHECKING WORKSPACE CONTAINERS:');
const editorContainer = document.getElementById('workspace-editor');
const previewContainer = document.getElementById('workspace-preview');

console.log('Editor container:', editorContainer ? 'EXISTS' : 'MISSING');
console.log('Preview container:', previewContainer ? 'EXISTS' : 'MISSING');

if (editorContainer) {
    console.log('Editor container children:', editorContainer.children.length);
    console.log('Editor container style.display:', editorContainer.style.display);
    Array.from(editorContainer.children).forEach((child, i) => {
        console.log(`  ${i}: ${child.tagName}#${child.id}.${child.className}`);
    });
}

if (previewContainer) {
    console.log('Preview container children:', previewContainer.children.length);
    console.log('Preview container style.display:', previewContainer.style.display);
    Array.from(previewContainer.children).forEach((child, i) => {
        console.log(`  ${i}: ${child.tagName}#${child.id}.${child.className}`);
    });
}

// Check Redux state
console.log('\n3️⃣ CHECKING REDUX STATE:');
const store = window.APP?.store || window.APP?.services?.appStore;
if (store) {
    const state = store.getState();
    const fileState = state.file || {};
    const authState = state.auth || {};
    
    console.log('Auth state:', {
        isAuthenticated: authState.isAuthenticated,
        authChecked: authState.authChecked
    });
    
    console.log('File state:', {
        currentFile: fileState.currentFile,
        status: fileState.status,
        currentPathname: fileState.currentPathname
    });
    
    // Check if there are any editor/preview panels in Redux (there shouldn't be now)
    const panels = state.panels?.panels || {};
    const editorPanel = panels['editor'];
    const previewPanel = panels['preview'];
    
    console.log('Editor panel in Redux:', editorPanel ? 'EXISTS (should not)' : 'MISSING (correct)');
    console.log('Preview panel in Redux:', previewPanel ? 'EXISTS (should not)' : 'MISSING (correct)');
} else {
    console.log('❌ Redux store not available');
}

// Test file selection simulation
console.log('\n4️⃣ TESTING FILE SELECTION SIMULATION:');
if (store) {
    console.log('🔧 Simulating file selection...');
    
    // Simulate loading a file
    store.dispatch({
        type: 'file/loadFileSuccess',
        payload: {
            pathname: '/test.html',
            content: '<h1>Test HTML Content</h1>\n<p>This is a test file.</p>'
        }
    });
    
    console.log('✅ Dispatched file load action');
    
    // Check if editor updated
    setTimeout(() => {
        console.log('\n5️⃣ CHECKING EDITOR UPDATE:');
        const textarea = document.querySelector('.editor-textarea');
        if (textarea) {
            console.log('✅ Editor textarea found');
            console.log('Editor content length:', textarea.value.length);
            console.log('Editor content preview:', textarea.value.substring(0, 50) + '...');
        } else {
            console.log('❌ Editor textarea not found');
        }
        
        console.log('\n✅ Editor/Preview test complete!');
        console.log('If you see content in the editor area, it\'s working correctly.');
    }, 500);
} else {
    console.log('❌ Cannot test file selection without Redux store');
}

console.log('\n📋 SUMMARY:');
console.log('• Editor and Preview should be mounted by ComponentManager');
console.log('• They should NOT appear in Redux panel state');
console.log('• They should respond to file state changes');
console.log('• WorkspaceManager should no longer try to manage them as dock panels');
