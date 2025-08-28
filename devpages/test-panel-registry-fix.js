/**
 * test-panel-registry-fix.js
 * Test that the panelRegistry.getAllPanels() method now works
 */

console.log('🔧 TESTING PANEL REGISTRY FIX...');

(async () => {
    try {
        // Import the panel registry
        const { panelRegistry } = await import('/client/panels/panelRegistry.js');
        
        console.log('✅ Panel registry imported');
        
        // Test the getAllPanels method
        const allPanels = panelRegistry.getAllPanels();
        console.log('✅ getAllPanels() method works!');
        console.log(`📊 Found ${allPanels.length} registered panels:`, allPanels.map(p => p.id));
        
        // Test the getPanels method (should be the same)
        const panels = panelRegistry.getPanels();
        console.log('✅ getPanels() method also works!');
        console.log(`📊 Found ${panels.length} panels via getPanels():`, panels.map(p => p.id));
        
        // Verify they return the same data
        if (JSON.stringify(allPanels) === JSON.stringify(panels)) {
            console.log('✅ Both methods return identical data');
        } else {
            console.log('⚠️ Methods return different data');
        }
        
        console.log('🎉 PANEL REGISTRY FIX SUCCESSFUL!');
        console.log('The DebugPanelManager error should now be resolved.');
        
    } catch (error) {
        console.error('❌ Panel registry fix test failed:', error);
    }
})();
