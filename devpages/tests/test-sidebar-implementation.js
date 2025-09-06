/**
 * test-sidebar-implementation.js
 * Quick test to verify the new sidebar architecture is working
 */

// Test function to verify sidebar implementation
function testSidebarImplementation() {
    console.log('🧪 Testing Sidebar Implementation...');
    
    // Check if WorkspaceManager exists
    const workspaceManager = window.APP?.services?.workspaceManager;
    if (!workspaceManager) {
        console.error('❌ WorkspaceManager not found in window.APP.services');
        return false;
    }
    
    // Check if Sidebar component exists
    if (!workspaceManager.sidebar) {
        console.error('❌ Sidebar component not found in WorkspaceManager');
        return false;
    }
    
    // Check sidebar state
    console.log('📊 Current Sidebar State:', workspaceManager.sidebar.getState());
    
    // Check if we have the sidebar DOM element
    const sidebarElement = document.getElementById('workspace-sidebar');
    if (!sidebarElement) {
        console.error('❌ workspace-sidebar element not found in DOM');
        return false;
    }
    
    // Check current visibility
    const isVisible = sidebarElement.dataset.visible === 'true';
    console.log(`👁️ Sidebar visibility: ${isVisible}`);
    
    // Toggle sidebar to test
    console.log('🔄 Toggling sidebar...');
    try {
        workspaceManager.toggleSidebar();
        
        // Wait a moment and check if content appeared
        setTimeout(() => {
            const sidebarContent = sidebarElement.querySelector('.sidebar-layout');
            if (sidebarContent) {
                console.log('✅ Sidebar layout found!');
                
                // Check for SidebarHeader
                const headerContainer = sidebarElement.querySelector('.sidebar-header-container');
                if (headerContainer) {
                    console.log('✅ SidebarHeader container found!');
                    
                    // Check for CLI elements
                    const cliButtons = sidebarElement.querySelectorAll('.cli-btn');
                    const cliInput = sidebarElement.querySelector('.cli-input');
                    const statusLine = sidebarElement.querySelector('.status-line');
                    
                    console.log(`🎛️ CLI buttons found: ${cliButtons.length}`);
                    console.log(`⌨️ CLI input found: ${!!cliInput}`);
                    console.log(`📊 Status line found: ${!!statusLine}`);
                } else {
                    console.warn('⚠️ SidebarHeader container not found');
                }
                
                // Check for docks container
                const docksContainer = sidebarElement.querySelector('.sidebar-docks-container');
                if (docksContainer) {
                    console.log('✅ Docks container found!');
                    
                    // Check for SettingsDock
                    const settingsDock = sidebarElement.querySelector('#settings-dock-container');
                    if (settingsDock) {
                        console.log('✅ SettingsDock container found!');
                    } else {
                        console.warn('⚠️ SettingsDock container not found');
                    }
                } else {
                    console.warn('⚠️ Docks container not found');
                }
                
            } else {
                console.error('❌ Sidebar layout not found after toggle');
            }
            
            // Test the NEW API
            console.log('🧪 Testing NEW Sidebar API...');
            if (window.APP.sidebar) {
                console.log('✅ NEW Sidebar API exposed at window.APP.sidebar');
                console.log('📊 Sidebar system info:', window.APP.sidebar.getSystemInfo());
                console.log('🎛️ Available docks:', window.APP.sidebar.getSystemInfo().availableDocks);
                
                // Test dock listing
                console.log('📋 Listing docks:');
                window.APP.sidebar.listDocks();
                
                // Test panel listing
                console.log('📄 Listing panels:');
                window.APP.sidebar.listPanels();
                
            } else {
                console.warn('⚠️ NEW Sidebar API not exposed at window.APP.sidebar');
            }
            
            // Test legacy compatibility
            if (window.APP.workspace?.sidebar) {
                console.log('✅ Legacy compatibility maintained at window.APP.workspace.sidebar');
            } else {
                console.warn('⚠️ Legacy compatibility not found');
            }
            
        }, 500); // Wait 500ms for rendering
        
    } catch (error) {
        console.error('❌ Error toggling sidebar:', error);
        return false;
    }
    
    console.log('🎯 Sidebar implementation test completed!');
    return true;
}

// Export for browser console use
if (typeof window !== 'undefined') {
    window.testSidebarImplementation = testSidebarImplementation;
    console.log('🧪 Test function available: window.testSidebarImplementation()');
}

export { testSidebarImplementation };