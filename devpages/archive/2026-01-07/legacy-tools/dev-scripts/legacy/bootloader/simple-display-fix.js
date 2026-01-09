// SIMPLE FIX - Just display the damn file content

console.log('🔧 SIMPLE DISPLAY FIX - Loading file content from Redux...');

const store = window.APP?.services?.store;
if (!store) {
    console.log('❌ No Redux store');
} else {
    const state = store.getState();
    console.log('📊 Redux State Check:');
    console.log('   - file.currentFile.content length:', state.file?.currentFile?.content?.length || 0);
    console.log('   - editor.content length:', state.editor?.content?.length || 0);
    
    const fileContent = state.file?.currentFile?.content;
    const editorContent = state.editor?.content;
    
    if (fileContent) {
        console.log('✅ Found file content in Redux, displaying...');
        console.log('First 200 chars:', fileContent.substring(0, 200));
        
        // Find editor textarea and populate it
        const textarea = document.getElementById('md-editor');
        if (textarea) {
            textarea.value = fileContent;
            console.log('✅ Content loaded into editor textarea');
        } else {
            console.log('❌ No md-editor textarea found');
        }
        
        // Find any preview container and show raw content
        const preview = document.querySelector('.preview-container') || 
                       document.querySelector('#preview-container') ||
                       document.querySelector('[id*="preview"]');
        if (preview) {
            preview.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; padding: 20px;">${fileContent}</pre>`;
            console.log('✅ Content loaded into preview container');
        } else {
            console.log('❌ No preview container found');
        }
        
    } else if (editorContent) {
        console.log('✅ Found editor content in Redux, displaying...');
        console.log('First 200 chars:', editorContent.substring(0, 200));
        
        const textarea = document.getElementById('md-editor');
        if (textarea) {
            textarea.value = editorContent;
            console.log('✅ Editor content loaded into textarea');
        }
        
    } else {
        console.log('❌ NO CONTENT FOUND IN REDUX');
        console.log('Full file state:', state.file);
        console.log('Full editor state:', state.editor);
    }
}

// Also check what DOM elements exist
console.log('\n📋 Available DOM elements:');
const elements = [
    'md-editor',
    'preview-container', 
    'main-content',
    'workspace-container'
];

elements.forEach(id => {
    const el = document.getElementById(id);
    console.log(`   - #${id}: ${el ? '✅ exists' : '❌ missing'}`);
});

console.log('\n🔍 All elements with "editor" in ID:');
document.querySelectorAll('[id*="editor"]').forEach(el => {
    console.log(`   - #${el.id}: ${el.tagName}`);
});

console.log('\n🔍 All elements with "preview" in class or ID:');
document.querySelectorAll('[id*="preview"], [class*="preview"]').forEach(el => {
    console.log(`   - ${el.tagName}#${el.id}.${el.className}`);
});
