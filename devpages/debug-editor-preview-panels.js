// Debug script to investigate editor/preview panel registration - paste in browser console

console.log('🔍 DEBUGGING EDITOR/PREVIEW PANEL REGISTRATION');
console.log('==============================================');

const store = window.APP?.store || window.APP?.services?.appStore;
if (!store) {
    console.error('❌ Redux store not found!');
    throw new Error('Redux store not available');
}

// Get current state
const state = store.getState();
const docks = state.panels?.docks || {};
const panels = state.panels?.panels || {};

console.log('\n1️⃣ DOCK CONFIGURATION:');
Object.entries(docks).forEach(([dockId, dock]) => {
    console.log(`${dockId}:`, {
        isVisible: dock.isVisible,
        panels: dock.panels,
        title: dock.title
    });
});

console.log('\n2️⃣ PANEL INSTANCES:');
Object.entries(panels).forEach(([panelId, panel]) => {
    console.log(`${panelId}:`, {
        dockId: panel.dockId,
        isVisible: panel.isVisible,
        title: panel.title
    });
});

console.log('\n3️⃣ CHECKING SPECIFIC PANELS:');
const editorPanel = panels['editor'];
const previewPanel = panels['preview'];

console.log('Editor panel:', editorPanel || 'NOT FOUND');
console.log('Preview panel:', previewPanel || 'NOT FOUND');

console.log('\n4️⃣ CHECKING DOCK ASSIGNMENTS:');
const editorDock = docks['editor-dock'];
const previewDock = docks['preview-dock'];

console.log('Editor dock:', editorDock || 'NOT FOUND');
console.log('Preview dock:', previewDock || 'NOT FOUND');

console.log('\n5️⃣ CHECKING DOM ELEMENTS:');
const editorZone = document.getElementById('workspace-editor');
const previewZone = document.getElementById('workspace-preview');

console.log('Editor zone DOM:', editorZone ? 'EXISTS' : 'MISSING');
console.log('Preview zone DOM:', previewZone ? 'EXISTS' : 'MISSING');

if (editorZone) {
    console.log('Editor zone children:', editorZone.children.length);
    Array.from(editorZone.children).forEach(child => {
        console.log(`  - ${child.tagName}#${child.id}.${child.className}`);
    });
}

if (previewZone) {
    console.log('Preview zone children:', previewZone.children.length);
    Array.from(previewZone.children).forEach(child => {
        console.log(`  - ${child.tagName}#${child.id}.${child.className}`);
    });
}

console.log('\n6️⃣ TESTING PANEL CREATION:');
// Try to manually create the panels if they don't exist
if (!editorPanel && editorDock) {
    console.log('🔧 Attempting to create editor panel...');
    try {
        store.dispatch({
            type: 'panels/createPanel',
            payload: {
                id: 'editor',
                dockId: 'editor-dock',
                title: 'Editor',
                config: {
                    factory: () => import('/client/panels/EditorPanel.js').then(m => m.EditorPanel)
                }
            }
        });
        console.log('✅ Editor panel creation dispatched');
    } catch (error) {
        console.error('❌ Failed to create editor panel:', error);
    }
}

if (!previewPanel && previewDock) {
    console.log('🔧 Attempting to create preview panel...');
    try {
        store.dispatch({
            type: 'panels/createPanel',
            payload: {
                id: 'preview',
                dockId: 'preview-dock',
                title: 'Preview',
                config: {
                    factory: () => import('/client/panels/PreviewPanel.js').then(m => m.PreviewPanel)
                }
            }
        });
        console.log('✅ Preview panel creation dispatched');
    } catch (error) {
        console.error('❌ Failed to create preview panel:', error);
    }
}

// Check if WorkspaceManager exists and try to trigger a re-render
console.log('\n7️⃣ TRIGGERING WORKSPACE MANAGER REFRESH:');
const workspaceManager = window.APP?.services?.workspaceManager;
if (workspaceManager) {
    console.log('🔄 Triggering WorkspaceManager render...');
    try {
        workspaceManager.render();
        console.log('✅ WorkspaceManager render triggered');
    } catch (error) {
        console.error('❌ WorkspaceManager render failed:', error);
    }
} else {
    console.log('❌ WorkspaceManager not found');
}

setTimeout(() => {
    console.log('\n📋 FINAL STATE CHECK:');
    const newState = store.getState();
    const newPanels = newState.panels?.panels || {};
    
    console.log('Editor panel now exists:', !!newPanels['editor']);
    console.log('Preview panel now exists:', !!newPanels['preview']);
    
    console.log('\n✅ Debug complete - check for any changes in the UI');
}, 1000);
