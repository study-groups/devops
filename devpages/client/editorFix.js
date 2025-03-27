// Ultra-simple fix for editor.initializeEditor not found error
window.editor = window.editor || {
    initializeEditor: function() {
        console.log("Editor initialized from editorFix.js");
        return Promise.resolve(true);
    },
    setContent: function(content) {
        const textarea = document.querySelector('#md-editor textarea');
        if (textarea) textarea.value = content || '';
        return true;
    },
    getContent: function() {
        const textarea = document.querySelector('#md-editor textarea');
        return textarea ? textarea.value : '';
    }
};

// Export for ESM
export default window.editor;
export const editor = window.editor; 