import { logMessage, toggleLog } from "./log.js";

export function setView(mode) {
    const container = document.getElementById('content');
    const editor = document.getElementById('md-editor');
    const preview = document.getElementById('md-preview');
    const mainContainer = document.getElementById('main-container');
    
    if (!container || !editor || !preview) {
        logMessage('[VIEW ERROR] Required elements not found');
        return;
    }
    
    // Flag that we're changing views to prevent unwanted log toggling
    if (window.recentViewChange !== undefined) {
        window.recentViewChange = true;
    }
    
    // Remove all view classes first
    container.classList.remove('code-view', 'preview-view', 'split-view');
    
    // Add the appropriate class
    container.classList.add(`${mode}-view`);
    
    // Update button states
    document.querySelectorAll('.view-controls button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeButton = document.getElementById(`${mode}-view`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Reset any inline styles that might interfere
    editor.style.width = '';
    preview.style.width = '';
    container.style.display = '';
    container.style.flexDirection = '';
    
    // Handle visibility and sizing based on mode
    if (mode === 'code') {
        editor.style.display = 'flex';
        editor.style.flex = '1';
        preview.style.display = 'none';
        // Show log in code view without toggling
        import('./log.js').then(({ logState }) => {
            logState.setVisible(true);
        });
    } else if (mode === 'preview') {
        editor.style.display = 'none';
        preview.style.display = 'block';
        preview.style.flex = '1';
        // Hide log in preview view without toggling
        import('./log.js').then(({ logState }) => {
            logState.setVisible(false);
        });
    } else if (mode === 'split') {
        // For split view, let CSS handle the layout
        editor.style.display = 'block';
        preview.style.display = 'block';
        // Show log in split view without toggling
        import('./log.js').then(({ logState }) => {
            logState.setVisible(true);
        });
    }
    
    // Save the current view mode
    localStorage.setItem('viewMode', mode);
    
    logMessage(`[VIEW] Changed to ${mode} view`);
    
    // Dispatch a custom event that other components can listen for
    document.dispatchEvent(new CustomEvent('view:changed', { 
        detail: { mode } 
    }));
    
    // Reset the view change flag after a short delay
    setTimeout(() => {
        if (window.recentViewChange !== undefined) {
            window.recentViewChange = false;
        }
    }, 300);
}
