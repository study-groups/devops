/**
 * Test BasePanel Compatibility
 * Verify that the new BasePanel maintains compatibility with old panel methods
 */

console.log('🧪 Testing BasePanel Compatibility...');

async function testBasePanelCompatibility() {
    try {
        const { BasePanel } = await import('./client/panels/BasePanel.js');
        console.log('✅ BasePanel imported successfully');
        
        // Create test panel
        class TestCompatibilityPanel extends BasePanel {
            renderContent() {
                return '<div>Test compatibility panel content</div>';
            }
            
            onMount(container) {
                super.onMount(container);
                console.log('✅ onMount called successfully');
            }
            
            init() {
                super.init();
                console.log('✅ init called successfully');
            }
            
            onStateChange(newState) {
                super.onStateChange(newState);
                console.log('✅ onStateChange called successfully');
            }
            
            cleanup() {
                super.cleanup();
                console.log('✅ cleanup called successfully');
            }
        }
        
        // Test panel creation
        const panel = new TestCompatibilityPanel({ 
            id: 'test-compatibility', 
            title: 'Test Compatibility Panel' 
        });
        console.log('✅ Panel instance created');
        
        // Test methods exist
        const methods = ['init', 'onMount', 'onUnmount', 'onStateChange', 'cleanup', 'createElement', 'mount', 'unmount', 'render', 'destroy'];
        
        methods.forEach(method => {
            if (typeof panel[method] === 'function') {
                console.log(`✅ Method ${method} exists`);
            } else {
                console.log(`❌ Method ${method} missing`);
            }
        });
        
        // Test method calls
        console.log('\n🔧 Testing method calls:');
        
        panel.init();
        
        // Create test container
        const testContainer = document.createElement('div');
        document.body.appendChild(testContainer);
        
        // Test mount
        panel.mount(testContainer);
        
        // Test state change
        panel.onStateChange({ test: true });
        
        // Test cleanup
        panel.cleanup();
        
        // Clean up
        testContainer.remove();
        
        console.log('\n🎉 BasePanel compatibility test completed successfully!');
        
    } catch (error) {
        console.error('❌ BasePanel compatibility test failed:', error);
    }
}

// Run test
testBasePanelCompatibility();

// Export for manual testing
if (typeof window !== 'undefined') {
    window.testBasePanelCompatibility = testBasePanelCompatibility;
    console.log('🧪 Test function available: window.testBasePanelCompatibility()');
}

export { testBasePanelCompatibility };
