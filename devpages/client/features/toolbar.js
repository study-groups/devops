// Markdown toolbar functionality
export function initializeToolbar() {
    const toolbar = document.querySelector('.md-toolbar');
    if (!toolbar) return;
    
    toolbar.addEventListener('click', (event) => {
        if (event.target.classList.contains('toolbar-btn')) {
            const format = event.target.dataset.format;
            applyFormat(format);
        }
    });
    
    function applyFormat(format) {
        const editor = document.querySelector('#md-editor textarea');
        if (!editor) return;
        
        const selStart = editor.selectionStart;
        const selEnd = editor.selectionEnd;
        const selectedText = editor.value.substring(selStart, selEnd);
        
        let replacement = '';
        switch (format) {
            case 'bold':
                replacement = `**${selectedText}**`;
                break;
            case 'italic':
                replacement = `*${selectedText}*`;
                break;
            case 'heading':
                replacement = `\n# ${selectedText}\n`;
                break;
            case 'link':
                replacement = `[${selectedText}](url)`;
                break;
            case 'image':
                replacement = `![${selectedText}](image-url)`;
                break;
            case 'code':
                replacement = `\`\`\`\n${selectedText}\n\`\`\``;
                break;
            case 'list':
                replacement = selectedText.split('\n').map(line => `- ${line}`).join('\n');
                break;
        }
        
        editor.value = editor.value.substring(0, selStart) + replacement + editor.value.substring(selEnd);
        editor.focus();
        
        // Trigger preview update
        editor.dispatchEvent(new Event('input'));
    }
} 