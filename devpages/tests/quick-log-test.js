// Quick Log Test
(function() {
    const log = document.getElementById('log-container');
    if (!log) {
        console.log('❌ No log-container found');
        return;
    }
    
    const style = window.getComputedStyle(log);
    console.log('Log styles:', {
        display: style.display,
        position: style.position,
        zIndex: style.zIndex,
        bottom: style.bottom,
        height: style.height,
        visibility: style.visibility,
        opacity: style.opacity
    });
    
    // Check if CSS is loading
    console.log('CSS loading test:');
    const testEl = document.createElement('div');
    testEl.id = 'log-container';
    testEl.className = 'log-visible';
    testEl.style.position = 'absolute';
    testEl.style.top = '0';
    testEl.style.left = '0';
    testEl.style.width = '10px';
    testEl.style.height = '10px';
    document.body.appendChild(testEl);
    
    setTimeout(() => {
        const testStyle = window.getComputedStyle(testEl);
        console.log('Test element style (should be fixed if CSS loaded):', {
            position: testStyle.position,
            zIndex: testStyle.zIndex
        });
        testEl.remove();
    }, 100);
    
})();