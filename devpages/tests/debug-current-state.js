// Debug current panel state - paste in browser console

console.log('🔍 DEBUGGING CURRENT PANEL STATE');
console.log('================================');

const store = window.APP?.store || window.APP?.services?.appStore;
if (!store) {
    console.error('❌ Redux store not found!');
    throw new Error('Redux store not available');
}

const state = store.getState();
const docks = state.panels?.docks || {};
const panels = state.panels?.panels || {};

console.log('\n1️⃣ ALL DOCKS:');
Object.entries(docks).forEach(([dockId, dock]) => {
    console.log(`${dockId}:`, {
        isVisible: dock.isVisible,
        panels: dock.panels,
        title: dock.title
    });
});

console.log('\n2️⃣ ALL PANELS:');
Object.entries(panels).forEach(([panelId, panel]) => {
    console.log(`${panelId}:`, {
        dockId: panel.dockId,
        isVisible: panel.isVisible,
        title: panel.title
    });
});

console.log('\n3️⃣ EDITOR/PREVIEW SPECIFIC:');
const editorPanel = panels['editor'];
const previewPanel = panels['preview'];
const editorDock = docks['editor-dock'];
const previewDock = docks['preview-dock'];

console.log('Editor panel:', editorPanel);
console.log('Preview panel:', previewPanel);
console.log('Editor dock:', editorDock);
console.log('Preview dock:', previewDock);

console.log('\n4️⃣ DOM CONTAINERS:');
const containers = {
    'workspace-sidebar': document.getElementById('workspace-sidebar'),
    'workspace-editor': document.getElementById('workspace-editor'),
    'workspace-preview': document.getElementById('workspace-preview')
};

Object.entries(containers).forEach(([id, element]) => {
    console.log(`${id}:`, element ? 'EXISTS' : 'MISSING');
    if (element) {
        console.log(`  Children: ${element.children.length}`);
        Array.from(element.children).forEach((child, i) => {
            console.log(`    ${i}: ${child.tagName}#${child.id}.${child.className}`);
        });
    }
});

console.log('\n5️⃣ PANEL ELEMENTS IN DOM:');
const editorEl = document.getElementById('editor');
const previewEl = document.getElementById('preview');

console.log('Editor panel element:', editorEl ? 'EXISTS' : 'MISSING');
console.log('Preview panel element:', previewEl ? 'EXISTS' : 'MISSING');

console.log('\n6️⃣ WORKSPACE MANAGER STATUS:');
const workspaceManager = window.APP?.services?.workspaceManager;
console.log('WorkspaceManager available:', !!workspaceManager);

if (workspaceManager) {
    console.log('Loaded panel instances:', workspaceManager.loadedPanelInstances?.size || 0);
    if (workspaceManager.loadedPanelInstances) {
        console.log('Loaded panels:', Array.from(workspaceManager.loadedPanelInstances.keys()));
    }
}

console.log('\n7️⃣ MANUAL PANEL VISIBILITY FIX:');
// Try to make editor and preview panels visible if they exist but aren't visible
if (editorPanel && !editorPanel.isVisible) {
    console.log('🔧 Making editor panel visible...');
    store.dispatch({
        type: 'panels/updatePanel',
        payload: { id: 'editor', updates: { isVisible: true } }
    });
}

if (previewPanel && !previewPanel.isVisible) {
    console.log('🔧 Making preview panel visible...');
    store.dispatch({
        type: 'panels/updatePanel', 
        payload: { id: 'preview', updates: { isVisible: true } }
    });
}

console.log('\n8️⃣ TRIGGER RENDER:');
if (workspaceManager) {
    console.log('🔄 Triggering WorkspaceManager render...');
    workspaceManager.render();
} else {
    console.log('❌ WorkspaceManager not available');
}

setTimeout(() => {
    console.log('\n9️⃣ FINAL CHECK:');
    const finalEditorEl = document.getElementById('editor');
    const finalPreviewEl = document.getElementById('preview');
    
    console.log('Final editor element:', finalEditorEl ? 'EXISTS' : 'MISSING');
    console.log('Final preview element:', finalPreviewEl ? 'EXISTS' : 'MISSING');
    
    console.log('\n✅ Debug complete!');
}, 1000);
