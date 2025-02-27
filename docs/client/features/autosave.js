// Autosave functionality
export function initializeAutosave(interval = 30000) {
    let lastContent = '';
    let timer = null;
    
    // Listen for editor changes
    document.addEventListener('editor:change', (event) => {
        const content = event.detail.content;
        if (content !== lastContent) {
            lastContent = content;
            scheduleAutosave();
        }
    });
    
    function scheduleAutosave() {
        clearTimeout(timer);
        timer = setTimeout(performAutosave, interval);
    }
    
    async function performAutosave() {
        const fileSelect = document.getElementById('file-select');
        if (fileSelect && fileSelect.value) {
            const status = await saveFile();
            if (status) {
                logMessage('[AUTOSAVE] Document saved automatically');
            }
        }
    }
} 