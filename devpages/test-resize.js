// Test script for log resize functionality
// Run this in the browser console

console.log('=== LOG RESIZE TEST ===');

// 1. Check if resize handle exists
const resizeHandle = document.getElementById('log-resize-handle');
console.log('1. Resize handle exists:', !!resizeHandle);
if (resizeHandle) {
    console.log('   Handle position:', {
        top: resizeHandle.style.top,
        height: resizeHandle.style.height,
        cursor: getComputedStyle(resizeHandle).cursor
    });
    
    // Make it more visible for testing
    resizeHandle.style.backgroundColor = 'red';
    resizeHandle.style.opacity = '0.5';
    console.log('   Made resize handle red for visibility');
}

// 2. Check log container
const logContainer = document.getElementById('log-container');
console.log('2. Log container exists:', !!logContainer);
if (logContainer) {
    const rect = logContainer.getBoundingClientRect();
    console.log('   Container dimensions:', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        visible: rect.height > 0
    });
}

// 3. Test resize programmatically
window.testResize = function(newHeight) {
    console.log('=== TESTING RESIZE TO', newHeight, 'px ===');
    
    // Set CSS variable
    document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
    
    // Update Redux if available
    if (window.appStore && window.dispatch) {
        import('/client/store/uiSlice.js').then(({ uiActions }) => {
            window.dispatch(uiActions.updateSetting({
                key: 'logHeight',
                value: newHeight
            }));
            
            setTimeout(() => {
                const state = window.appStore.getState();
                console.log('Redux logHeight updated to:', state.ui?.logHeight);
                
                if (logContainer) {
                    const newRect = logContainer.getBoundingClientRect();
                    console.log('New container height:', newRect.height);
                }
            }, 100);
        });
    }
};

// 4. Test different heights
console.log('=== TEST FUNCTIONS AVAILABLE ===');
console.log('Run testResize(200) to test 200px height');
console.log('Run testResize(300) to test 300px height');
console.log('Run testResize(150) to test 150px height');

// 5. Check if resize handlers are attached
if (resizeHandle) {
    // Add a test click handler to see if events work
    resizeHandle.addEventListener('click', () => {
        console.log('Resize handle clicked - events are working!');
        alert('Resize handle is clickable! Try dragging it.');
    });
    console.log('Added test click handler to resize handle');
}

// 6. Force log visible for testing
if (logContainer && window.appStore) {
    import('/client/store/uiSlice.js').then(({ uiActions }) => {
        window.dispatch(uiActions.updateSetting({
            key: 'logVisible',
            value: true
        }));
        console.log('Forced log to be visible for testing');
    });
}
