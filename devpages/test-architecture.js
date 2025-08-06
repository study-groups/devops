/**
 * Simple test to verify the clean architecture works
 */

console.log('=== ARCHITECTURE TEST ===');

// Test 1: Check if layout manager is properly exposed
if (window.APP?.services?.workspaceManager) {
    console.log('✅ Layout manager properly exposed');
    
    // Test 2: Check if semantic areas exist
    const sidebar = document.getElementById('workspace-sidebar');
    const editor = document.getElementById('workspace-editor'); 
    const preview = document.getElementById('workspace-preview');
    
    if (sidebar && editor && preview) {
        console.log('✅ All workspace areas found');
        
        // Test 3: Test the toggle function
        console.log('🧪 Testing editor toggle...');
        const initialDisplay = editor.style.display;
        
        window.APP.services.workspaceManager.toggleEditor();
        console.log(`Editor area display changed from "${initialDisplay}" to "${editor.style.display}"`);
        
        // Toggle back
        window.APP.services.workspaceManager.toggleEditor();
        console.log(`Editor area display restored to "${editor.style.display}"`);
        
    } else {
        console.log('❌ Missing workspace areas');
    }
} else {
    console.log('❌ Layout manager not found');
}

// Test 4: Check panel registry
if (window.APP?.services?.panelManager) {
    console.log('✅ Panel manager found');
} else {
    console.log('⚠️ Panel manager not found (might be okay)');
}

console.log('=== TEST COMPLETE ===');