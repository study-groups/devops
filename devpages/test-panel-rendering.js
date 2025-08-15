// Test panel rendering - paste in browser console

console.log('🎬 TESTING PANEL RENDERING');
console.log('=========================');

const store = window.APP?.store || window.APP?.services?.appStore;
const workspaceManager = window.APP?.services?.workspaceManager;

if (!store) {
    console.error('❌ Redux store not found!');
    throw new Error('Redux store not available');
}

if (!workspaceManager) {
    console.error('❌ WorkspaceManager not found!');
    throw new Error('WorkspaceManager not available');
}

// Check current state
const state = store.getState();
const docks = state.panels?.docks || {};
const panels = state.panels?.panels || {};

console.log('\n1️⃣ CURRENT STATE:');
console.log('Docks:', Object.keys(docks));
console.log('Panels:', Object.keys(panels));

console.log('\n2️⃣ EDITOR/PREVIEW DOCK STATUS:');
const editorDock = docks['editor-dock'];
const previewDock = docks['preview-dock'];

console.log('Editor dock:', editorDock);
console.log('Preview dock:', previewDock);

console.log('\n3️⃣ EDITOR/PREVIEW PANEL STATUS:');
const editorPanel = panels['editor'];
const previewPanel = panels['preview'];

console.log('Editor panel:', editorPanel);
console.log('Preview panel:', previewPanel);

console.log('\n4️⃣ DOM CONTAINERS:');
const editorContainer = document.getElementById('workspace-editor');
const previewContainer = document.getElementById('workspace-preview');

console.log('Editor container:', editorContainer ? 'EXISTS' : 'MISSING');
console.log('Preview container:', previewContainer ? 'EXISTS' : 'MISSING');

if (editorContainer) {
    console.log('Editor container children:', editorContainer.children.length);
}
if (previewContainer) {
    console.log('Preview container children:', previewContainer.children.length);
}

console.log('\n5️⃣ TRIGGERING WORKSPACE MANAGER RENDER:');
console.log('Watch the console for detailed logging...');

try {
    workspaceManager.render();
    console.log('✅ Render triggered successfully');
} catch (error) {
    console.error('❌ Render failed:', error);
}

// Check results after a short delay
setTimeout(() => {
    console.log('\n6️⃣ POST-RENDER CHECK:');
    
    const editorPanelEl = document.getElementById('editor');
    const previewPanelEl = document.getElementById('preview');
    
    console.log('Editor panel in DOM:', editorPanelEl ? 'EXISTS' : 'MISSING');
    console.log('Preview panel in DOM:', previewPanelEl ? 'EXISTS' : 'MISSING');
    
    if (editorContainer) {
        console.log('Editor container children after render:', editorContainer.children.length);
        Array.from(editorContainer.children).forEach(child => {
            console.log(`  - ${child.tagName}#${child.id}.${child.className}`);
        });
    }
    
    if (previewContainer) {
        console.log('Preview container children after render:', previewContainer.children.length);
        Array.from(previewContainer.children).forEach(child => {
            console.log(`  - ${child.tagName}#${child.id}.${child.className}`);
        });
    }
    
    console.log('\n✅ Panel rendering test complete!');
}, 1000);
