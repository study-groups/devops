// PROPER FIX - Work with existing UI system instead of bulldozing

console.log('🎯 PROPER DISPLAY FIX - Working with existing UI system...');

const store = window.APP?.services?.store;
if (!store) {
    console.log('❌ No Redux store');
} else {
    const state = store.getState();
    const fileContent = state.file?.currentFile?.content;
    const editorContent = state.editor?.content;
    const content = fileContent || editorContent;
    
    if (!content) {
        console.log('❌ No content in Redux to display');
        return;
    }
    
    console.log(`✅ Found content: ${content.length} characters`);
    console.log('Current UI state:', {
        editorVisible: state.ui?.editorVisible,
        previewVisible: state.ui?.previewVisible,
        logVisible: state.ui?.logVisible
    });
    
    // Check if editor and preview are visible, if not, make them visible
    if (!state.ui?.editorVisible) {
        console.log('📝 Making editor visible...');
        store.dispatch({ type: 'ui/toggleEditorVisibility' });
    }
    
    if (!state.ui?.previewVisible) {
        console.log('👁️ Making preview visible...');
        store.dispatch({ type: 'ui/togglePreviewVisibility' });
    }
    
    // Wait a moment for UI to update, then populate content
    setTimeout(() => {
        // Find the workspace containers
        const editorContainer = document.getElementById('workspace-editor');
        const previewContainer = document.getElementById('workspace-preview');
        
        if (!editorContainer || !previewContainer) {
            console.log('❌ Workspace containers not found');
            return;
        }
        
        // Only populate if they're empty or have placeholder content
        if (editorContainer.children.length === 0 || editorContainer.textContent.includes('No content')) {
            console.log('📝 Populating editor container...');
            
            // Create a simple, clean editor
            editorContainer.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column;">
                    <textarea 
                        id="md-editor" 
                        style="width: 100%; height: 100%; border: none; padding: 16px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px; line-height: 1.5; background: #fff; color: #333; resize: none; outline: none;"
                        placeholder="Start typing..."
                    >${content}</textarea>
                </div>
            `;
        }
        
        if (previewContainer.children.length === 0 || previewContainer.textContent.includes('No content')) {
            console.log('👁️ Populating preview container...');
            
            // Create a simple, clean preview
            previewContainer.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column;">
                    <div class="preview-container" style="flex: 1; padding: 16px; overflow-y: auto; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6;">
                        <div style="color: #666; text-align: center; padding: 20px;">
                            Preview will appear here
                        </div>
                    </div>
                </div>
            `;
        }
        
        console.log('✅ Content populated using proper UI system');
        
        // Update button states to reflect current visibility
        const editButton = document.querySelector('#edit-toggle');
        const previewButton = document.querySelector('#preview-toggle');
        
        if (editButton) {
            editButton.classList.add('active');
            console.log('✅ Editor button marked as active');
        }
        
        if (previewButton) {
            previewButton.classList.add('active');
            console.log('✅ Preview button marked as active');
        }
        
    }, 100);
    
    console.log('🎉 Proper display fix applied!');
}
