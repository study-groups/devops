/**
 * EMERGENCY: Stop infinite loop and recover
 * Run this in browser console if the page is stuck in infinite loop
 */

console.log('🚨 EMERGENCY LOOP STOPPER');
console.log('========================');

// 1. Try to stop event bus emissions
if (window.APP?.services?.eventBus) {
    console.log('🛑 Attempting to stop eventBus...');
    
    // Remove all listeners for navigate:pathname
    const originalEmit = window.APP.services.eventBus.emit;
    window.APP.services.eventBus.emit = function(event, ...args) {
        if (event === 'navigate:pathname') {
            console.log('🚫 BLOCKED navigate:pathname event to prevent loop');
            return;
        }
        return originalEmit.call(this, event, ...args);
    };
    
    console.log('✅ EventBus emit temporarily blocked for navigate:pathname');
}

// 2. Clear any pending timeouts/intervals
console.log('🧹 Clearing timeouts and intervals...');
let timeoutId = setTimeout(function(){}, 0);
for (let i = 1; i < timeoutId; i++) {
    clearTimeout(i);
}

let intervalId = setInterval(function(){}, 999999);
for (let i = 1; i < intervalId; i++) {
    clearInterval(i);
}

console.log('✅ Cleared pending timeouts/intervals');

// 3. Force garbage collection if available
if (window.gc) {
    console.log('🗑️ Running garbage collection...');
    window.gc();
    console.log('✅ Garbage collection complete');
}

// 4. Show recovery instructions
console.log('\n🎯 RECOVERY INSTRUCTIONS:');
console.log('1. The infinite loop should now be stopped');
console.log('2. REFRESH THE PAGE to start clean'); 
console.log('3. The fileThunks.js has been fixed to prevent the loop');
console.log('4. If still having issues, hard refresh (Ctrl+F5)');

// 5. Monitor resource usage
console.log('\n📊 RESOURCE CHECK:');
console.log('- Performance memory:', performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB used` : 'Not available');
console.log('- Navigator connection:', navigator.connection ? `${navigator.connection.effectiveType} connection` : 'Not available');

console.log('\n✅ EMERGENCY STOP COMPLETE - Please refresh the page');