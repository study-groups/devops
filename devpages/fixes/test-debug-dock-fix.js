/**
 * Test DebugDock Container Fix
 * Verify that DebugDock initializes properly with containers
 */

console.log('🧪 Testing DebugDock Container Fix...');

// Test 1: Import DebugDock
console.log('\n📦 Testing DebugDock Import:');
try {
    const { DebugDock } = await import('./packages/devpages-debug/DebugDock.js');
    console.log('✅ DebugDock imported successfully');
    
    // Test 2: Create DebugDock instance
    console.log('\n🏗️ Testing DebugDock Creation:');
    const debugDock = new DebugDock();
    console.log('✅ DebugDock instance created');
    
    // Test 3: Check if container was created
    setTimeout(() => {
        const containers = document.querySelectorAll('.debug-dock-container');
        if (containers.length > 0) {
            console.log('✅ DebugDock container created successfully');
            console.log(`   Found ${containers.length} debug dock container(s)`);
        } else {
            console.log('❌ No debug dock containers found');
        }
        
        // Test 4: Check for base dock structure
        const baseDocks = document.querySelectorAll('.base-dock');
        if (baseDocks.length > 0) {
            console.log('✅ BaseDock structure created');
            console.log(`   Found ${baseDocks.length} base dock(s)`);
        } else {
            console.log('❌ No base dock structures found');
        }
        
        console.log('\n🎉 DebugDock Container Test Complete!');
    }, 100); // Give it time to initialize
    
} catch (error) {
    console.log(`❌ DebugDock test failed: ${error.message}`);
    console.error(error);
}
