#!/usr/bin/env node
/**
 * Test script to verify the save button functionality
 * Run this in the browser console after loading a file
 */

console.log("🧪 Testing Save Button Functionality");

// Check if we're in the browser and have access to the store
if (typeof window === 'undefined' || !window.appStore) {
    console.error("❌ This test must be run in the browser console with the app loaded");
    process.exit(1);
}

const store = window.appStore;

function testSaveButton() {
    console.log("\n🔍 Current State Analysis:");
    
    const state = store.getState();
    console.log("Current state:", {
        path: state.path?.currentPathname,
        isDirectorySelected: state.path?.isDirectorySelected,
        editorContent: state.editor?.content?.substring(0, 50) + "...",
        editorModified: state.editor?.isModified,
        fileCurrentPath: state.file?.currentFile?.pathname,
        fileModified: state.file?.currentFile?.isModified,
        authStatus: state.auth?.isAuthenticated
    });
    
    // Check save button state
    const saveButton = document.querySelector('#save-btn');
    if (saveButton) {
        console.log("💾 Save Button State:", {
            exists: true,
            disabled: saveButton.disabled,
            text: saveButton.textContent,
            dataAction: saveButton.getAttribute('data-action')
        });
    } else {
        console.log("❌ Save button not found in DOM");
    }
    
    // Test if we can dispatch save action
    try {
        console.log("\n🚀 Attempting to dispatch save action...");
        
        // Import the fileThunks
        import('/client/store/slices/fileSlice.js').then(({ fileThunks }) => {
            store.dispatch(fileThunks.saveFile());
            console.log("✅ Save action dispatched successfully");
            
            // Monitor for state changes
            setTimeout(() => {
                const newState = store.getState();
                console.log("📊 Post-save state:", {
                    fileStatus: newState.file?.status,
                    editorModified: newState.editor?.isModified,
                    lastSaved: newState.editor?.lastSaved
                });
            }, 2000);
        });
        
    } catch (error) {
        console.error("❌ Error dispatching save action:", error);
    }
}

// Export for browser use
if (typeof window !== 'undefined') {
    window.testSaveButton = testSaveButton;
    console.log("✅ Test function loaded. Run testSaveButton() in the console to test.");
}

export { testSaveButton };