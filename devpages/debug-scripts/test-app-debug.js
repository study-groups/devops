/**
 * Test APP.debug Setup
 * Quick test to verify APP.debug is working and initialize if needed
 */

console.log('🧪 TESTING APP.DEBUG SETUP');
console.log('===========================');

// Check current state
console.log('window.APP exists:', !!window.APP);
console.log('window.APP.debug exists:', !!window.APP?.debug);
console.log('window.APP.debug.resizer exists:', !!window.APP?.debug?.resizer);

// Initialize APP.debug structure if needed
function initializeAPPDebug() {
    console.log('\n🔧 Initializing APP.debug structure...');
    
    if (!window.APP) {
        window.APP = {};
        console.log('✅ Created window.APP');
    }
    
    if (!window.APP.debug) {
        window.APP.debug = {};
        console.log('✅ Created window.APP.debug');
    }
    
    if (!window.APP.debug.resizer) {
        window.APP.debug.resizer = {
            elements: [],
            css: {},
            javascript: {},
            events: [],
            issues: [],
            recommendations: [],
            report: null
        };
        console.log('✅ Created window.APP.debug.resizer');
    }
    
    console.log('✅ APP.debug structure initialized');
    return true;
}

// Test function
function testAPPDebugAccess() {
    console.log('\n🧪 Testing APP.debug access...');
    
    try {
        // Test basic access
        console.log('APP.debug:', window.APP.debug);
        console.log('APP.debug.resizer:', window.APP.debug.resizer);
        
        // Test function assignment
        window.APP.debug.resizer.test = function() {
            return 'Test function works!';
        };
        
        console.log('Test function result:', window.APP.debug.resizer.test());
        console.log('✅ APP.debug access working correctly');
        
        return true;
    } catch (error) {
        console.error('❌ APP.debug access failed:', error);
        return false;
    }
}

// Run initialization and test
initializeAPPDebug();
const testResult = testAPPDebugAccess();

if (testResult) {
    console.log('\n✅ APP.debug is ready for resizer debugger');
    console.log('💡 You can now load the resizer-debugger.js script');
} else {
    console.log('\n❌ APP.debug setup failed');
}

// Make initialization function available globally
window.initializeAPPDebug = initializeAPPDebug;
