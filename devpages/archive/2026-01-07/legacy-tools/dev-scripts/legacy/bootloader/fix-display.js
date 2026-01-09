// ACTUAL FIX - Populate the workspace containers with file content

console.log('🔧 FIXING DISPLAY - Populating workspace containers...');

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
        console.log('File state:', state.file);
        console.log('Editor state:', state.editor);
        return;
    }
    
    console.log(`✅ Found content: ${content.length} characters`);
    
    // Get the workspace containers
    const editorContainer = document.getElementById('workspace-editor');
    const previewContainer = document.getElementById('workspace-preview');
    
    if (!editorContainer) {
        console.log('❌ No workspace-editor container');
        return;
    }
    
    if (!previewContainer) {
        console.log('❌ No workspace-preview container');
        return;
    }
    
    console.log('✅ Found workspace containers');
    
    // Create proper editor textarea
    editorContainer.innerHTML = `
        <div class="editor-section" style="height: 100%; display: flex; flex-direction: column;">
            <div class="editor-top-bar" style="height: 36px; padding: 0 12px; border-bottom: 1px solid #ddd; background: #f8f9fa; display: flex; align-items: center; gap: 8px; font-size: 12px;">
                <span class="file-type-badge" data-type="markdown" style="padding: 2px 8px; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 12px; font-size: 11px; color: #1976d2;">
                    📝 ${state.file?.currentFile?.pathname?.split('/').pop() || 'file.md'}
                </span>
                <div style="margin-left: auto; color: #666;">
                    ${content.length} chars
                </div>
            </div>
            <textarea 
                id="md-editor" 
                class="markdown-editor" 
                style="width: 100%; height: 100%; min-height: 300px; border: none; padding: 16px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px; line-height: 1.5; background: #fff; color: #333; resize: none; outline: none; box-sizing: border-box;"
                placeholder="Start typing your markdown..."
            >${content}</textarea>
        </div>
    `;
    
    // Create proper preview container
    previewContainer.innerHTML = `
        <div class="preview-section" style="height: 100%; display: flex; flex-direction: column;">
            <div class="preview-top-bar" style="height: 36px; padding: 0 12px; border-bottom: 1px solid #ddd; background: #f8f9fa; display: flex; align-items: center; gap: 8px; font-size: 12px;">
                <span style="color: #666;">📖 Preview</span>
                <div style="margin-left: auto; color: #666;">
                    Live preview
                </div>
            </div>
            <div class="preview-container" style="flex: 1; padding: 16px; overflow-y: auto; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6;">
                <div style="color: #666; text-align: center; padding: 40px;">
                    Loading preview...
                </div>
            </div>
        </div>
    `;
    
    console.log('✅ Populated workspace containers');
    
    // Make sure containers are visible
    editorContainer.style.display = 'flex';
    previewContainer.style.display = 'flex';
    
    // Get the textarea and set up basic functionality
    const textarea = document.getElementById('md-editor');
    if (textarea) {
        // Auto-resize functionality
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
        
        console.log('✅ Editor functionality set up');
    }
    
    // Try to render markdown preview if possible
    const previewDiv = previewContainer.querySelector('.preview-container');
    if (previewDiv && content) {
        try {
            // Simple markdown-like rendering for immediate display
            let html = content
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
                .replace(/\*(.*)\*/gim, '<em>$1</em>')
                .replace(/\n/gim, '<br>');
            
            previewDiv.innerHTML = html;
            console.log('✅ Basic preview rendered');
        } catch (error) {
            previewDiv.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace;">${content}</pre>`;
            console.log('✅ Fallback preview rendered');
        }
    }
    
    console.log('🎉 Display fix complete!');
}
