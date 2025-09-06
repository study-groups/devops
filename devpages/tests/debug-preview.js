/**
 * Debug script for preview panel issues
 * Run this in the browser console to get detailed information
 */

function debugPreview() {
    console.log('=== PREVIEW PANEL DEBUG ===');
    
    // 1. Check DOM elements
    console.log('\n1. DOM ELEMENTS:');
    const previewPanel = document.querySelector('.preview-panel');
    const previewContent = document.querySelector('.preview-content');
    console.log('Preview panel element:', previewPanel);
    console.log('Preview content element:', previewContent);
    
    if (previewPanel) {
        console.log('Preview panel HTML:', previewPanel.outerHTML);
        console.log('Preview panel innerHTML length:', previewPanel.innerHTML.length);
    }
    
    if (previewContent) {
        console.log('Preview content HTML:', previewContent.outerHTML);
        console.log('Preview content innerHTML:', previewContent.innerHTML);
        console.log('Preview content innerHTML length:', previewContent.innerHTML.length);
    }
    
    // 2. Check Redux state
    console.log('\n2. REDUX STATE:');
    let store = null;
    if (window.APP && window.APP.services && window.APP.services.store) {
        store = window.APP.services.store;
    } else if (window.APP && window.APP.services && window.APP.services.appStore) {
        store = window.APP.services.appStore;
    }
    
    if (store) {
        const state = store.getState();
        console.log('Auth state:', state.auth);
        console.log('Editor state:', state.editor);
        console.log('Path state:', state.path);
        console.log('Current pathname:', state.path?.currentPathname);
        console.log('Editor content length:', state.editor?.content?.length || 0);
        console.log('Editor content preview:', state.editor?.content?.substring(0, 200) || 'No content');
    } else {
        console.log('Redux store not available at window.APP.services.store or window.APP.services.appStore');
        console.log('Available APP.services:', window.APP?.services ? Object.keys(window.APP.services) : 'None');
    }
    
    // 3. Check workspace manager
    console.log('\n3. WORKSPACE MANAGER:');
    if (window.APP && window.APP.services) {
        console.log('Available services:', Object.keys(window.APP.services));
        console.log('SimplifiedWorkspaceManager:', window.APP.services.simplifiedWorkspaceManager);
        console.log('Old WorkspaceManager (should be null):', window.APP.services.workspaceManager);
    }
    
    // 4. Test renderMarkdown function
    console.log('\n4. RENDER MARKDOWN TEST:');
    if (store) {
        const state = store.getState();
        const content = state.editor?.content;
        const pathname = state.path?.currentPathname;
        
        if (content && pathname) {
            console.log('Testing renderMarkdown with:');
            console.log('- Content length:', content.length);
            console.log('- Pathname:', pathname);
            
            // Import and test renderMarkdown
            import('/client/preview/renderer.js').then(({ renderMarkdown }) => {
                console.log('renderMarkdown function loaded');
                return renderMarkdown(content, pathname);
            }).then(result => {
                console.log('renderMarkdown result:', result);
                console.log('Result keys:', Object.keys(result));
                console.log('HTML length:', result.html?.length || 0);
                console.log('HTML content:', result.html);
            }).catch(error => {
                console.error('renderMarkdown test failed:', error);
            });
        } else {
            console.log('No content or pathname available for test');
            console.log('Content exists:', !!content);
            console.log('Pathname exists:', !!pathname);
        }
    } else {
        console.log('Cannot test renderMarkdown - no Redux store available');
    }
    
    // 5. Check preview panel instance
    console.log('\n5. PREVIEW PANEL INSTANCE:');
    if (window.APP && window.APP.services && window.APP.services.simplifiedWorkspaceManager) {
        const wsm = window.APP.services.simplifiedWorkspaceManager;
        console.log('Workspace manager loadedPanelInstances:', wsm.loadedPanelInstances);
        console.log('Workspace manager coreAreas:', wsm.coreAreas);
        
        const previewPanelInstance = wsm.loadedPanelInstances?.get?.('preview-panel');
        console.log('Preview panel instance:', previewPanelInstance);
        
        if (previewPanelInstance) {
            console.log('Preview panel element:', previewPanelInstance.element);
            console.log('Preview panel mounted:', previewPanelInstance.mounted);
            console.log('Preview panel stateUnsubscribe:', previewPanelInstance.stateUnsubscribe);
        }
        
        // Check if preview panel is listening to state changes
        console.log('Testing manual state sync...');
        if (previewPanelInstance && typeof previewPanelInstance.syncContent === 'function') {
            previewPanelInstance.syncContent();
            console.log('Manual syncContent called');
        }
        
        // Test manual state change trigger
        if (previewPanelInstance && typeof previewPanelInstance.onStateChange === 'function') {
            console.log('Testing manual onStateChange...');
            previewPanelInstance.onStateChange();
            console.log('Manual onStateChange called');
        }
    }
    
    // 6. Check for errors
    console.log('\n6. ERROR CHECK:');
    console.log('Check browser console for any JavaScript errors');
    console.log('Check network tab for failed requests');
    
    console.log('\n=== DEBUG COMPLETE ===');
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
    debugPreview();
}

// Export for manual use
if (typeof module !== 'undefined') {
    module.exports = { debugPreview };
}
