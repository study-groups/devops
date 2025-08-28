/**
 * Test Simple Sidebar System
 * Verify the new simplified panel architecture works
 */

console.log('🧪 Testing Simple Sidebar System...');

async function testSimpleSidebarSystem() {
    console.log('\n📦 Testing Component Imports:');
    
    try {
        // Test imports
        const { Sidebar } = await import('./client/layout/Sidebar.js');
        console.log('✅ Sidebar imported');
        
        const { CLIPanel } = await import('./client/panels/CLIPanel.js');
        console.log('✅ CLIPanel imported');
        
        const { BasePanel } = await import('./client/panels/BasePanel.js');
        console.log('✅ BasePanel imported');
        
        // Test creating sidebar
        console.log('\n🏗️ Testing Sidebar Creation:');
        const sidebar = new Sidebar();
        console.log('✅ Sidebar instance created');
        
        // Test API exposure
        setTimeout(() => {
            console.log('\n🔌 Testing API:');
            if (window.APP?.sidebar) {
                console.log('✅ Sidebar API exposed');
                
                const systemInfo = window.APP.sidebar.getSystemInfo();
                console.log('📊 System Info:', systemInfo);
                
                const panels = window.APP.sidebar.listPanels();
                console.log('📋 Panels:', panels);
                
                // Test CLI panel
                const cliPanel = window.APP.sidebar.getPanel('cli-panel');
                if (cliPanel) {
                    console.log('✅ CLI Panel found');
                } else {
                    console.log('❌ CLI Panel not found');
                }
                
            } else {
                console.log('❌ Sidebar API not exposed');
            }
            
            console.log('\n🎯 Simple Sidebar Test Complete!');
            
        }, 100);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Test enhanced panel features
function testEnhancedPanelFeatures() {
    console.log('\n🎨 Testing Enhanced Panel Features:');
    
    // Create a test container
    const testContainer = document.createElement('div');
    testContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: white;
        border: 1px solid #ccc;
        padding: 10px;
        z-index: 9999;
    `;
    document.body.appendChild(testContainer);
    
    // Create test panel
    class TestPanel extends BasePanel {
        renderContent() {
            return `
                <div>
                    <h4>Test Panel Content</h4>
                    <p>This panel can be:</p>
                    <ul>
                        <li>Collapsed/expanded (click ▼)</li>
                        <li>Dragged out (drag ⋮⋮)</li>
                        <li>Returned to sidebar (× when floating)</li>
                    </ul>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()">Remove Test</button>
                </div>
            `;
        }
    }
    
    const testPanel = new TestPanel({ id: 'test-panel', title: 'Test Panel' });
    const panelElement = testPanel.render();
    testContainer.appendChild(panelElement);
    
    testPanel.onMount(panelElement);
    
    console.log('✅ Test panel created - try interacting with it!');
    console.log('   • Click ▼ to collapse/expand');
    console.log('   • Drag ⋮⋮ to float the panel');
    console.log('   • Click × to return floating panel to sidebar');
}

// Run tests
testSimpleSidebarSystem();

// Export for manual testing
if (typeof window !== 'undefined') {
    window.testSimpleSidebarSystem = testSimpleSidebarSystem;
    window.testEnhancedPanelFeatures = testEnhancedPanelFeatures;
    
    console.log('\n🧪 Test functions available:');
    console.log('   • window.testSimpleSidebarSystem()');
    console.log('   • window.testEnhancedPanelFeatures()');
}

export { testSimpleSidebarSystem, testEnhancedPanelFeatures };
