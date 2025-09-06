// Panel Visibility Debug Test
(function() {
    'use strict';
    
    console.log('=== PANEL VISIBILITY TEST ===');
    
    // Find all panels
    const panels = document.querySelectorAll('.base-panel');
    console.log(`Found ${panels.length} panels with .base-panel class`);
    
    panels.forEach((panel, index) => {
        const style = window.getComputedStyle(panel);
        const rect = panel.getBoundingClientRect();
        
        console.log(`\nPanel ${index + 1}:`);
        console.log(`  ID: ${panel.id}`);
        console.log(`  Classes: ${panel.className}`);
        console.log(`  Display: ${style.display}`);
        console.log(`  Visibility: ${style.visibility}`);
        console.log(`  Opacity: ${style.opacity}`);
        console.log(`  Position: ${style.position}`);
        console.log(`  Z-Index: ${style.zIndex}`);
        console.log(`  Transform: ${style.transform}`);
        console.log(`  Rect: top=${rect.top}, left=${rect.left}, width=${rect.width}, height=${rect.height}`);
        console.log(`  Is visible: ${rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0'}`);
        
        // Check if has is-visible class
        if (!panel.classList.contains('is-visible')) {
            console.log(`  ⚠️  Missing 'is-visible' class!`);
        }
    });
    
    // Check for UI Inspector specifically
    const uiInspector = document.querySelector('[data-panel-id="ui-inspector"]') || 
                       document.querySelector('#ui-inspector-panel') ||
                       Array.from(panels).find(p => p.textContent.includes('UI Inspector'));
    
    if (uiInspector) {
        console.log('\n=== UI INSPECTOR PANEL ===');
        console.log('Found UI Inspector panel:', uiInspector);
        console.log('Classes:', uiInspector.className);
        console.log('Computed style:', {
            display: window.getComputedStyle(uiInspector).display,
            visibility: window.getComputedStyle(uiInspector).visibility,
            opacity: window.getComputedStyle(uiInspector).opacity,
            zIndex: window.getComputedStyle(uiInspector).zIndex
        });
    } else {
        console.log('\n❌ UI Inspector panel not found in DOM');
    }
    
})();