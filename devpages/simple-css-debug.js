// Simple CSS Debug - Find the root cause
(function() {
    console.log('=== SIMPLE CSS DEBUG ===');
    
    // 1. Check for any inline CSS affecting base-panel
    const allStyles = document.querySelectorAll('style');
    console.log(`Found ${allStyles.length} style tags`);
    
    allStyles.forEach((style, i) => {
        if (style.textContent.includes('base-panel') || style.textContent.includes('.panel')) {
            console.log(`Style ${i + 1} (${style.id || 'no-id'}):`, style.textContent.substring(0, 200));
        }
    });
    
    // 2. Check CSS bundles
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    console.log(`\nCSS bundles loaded:`);
    cssLinks.forEach(link => {
        if (link.href) {
            console.log(`- ${link.href.split('/').pop()}`);
        }
    });
    
    // 3. Check UI Inspector panel specifically
    const uiPanel = document.querySelector('[data-panel-id="ui-inspector"]') || 
                   Array.from(document.querySelectorAll('.base-panel')).find(p => 
                       p.textContent.includes('UI Inspector')
                   );
    
    if (uiPanel) {
        const computed = window.getComputedStyle(uiPanel);
        console.log(`\nUI Inspector panel styles:`);
        console.log(`- background: ${computed.background}`);
        console.log(`- backgroundColor: ${computed.backgroundColor}`);
        console.log(`- opacity: ${computed.opacity}`);
        console.log(`- visibility: ${computed.visibility}`);
        console.log(`- classes: ${uiPanel.className}`);
        console.log(`- has is-visible: ${uiPanel.classList.contains('is-visible')}`);
    } else {
        console.log('\nUI Inspector panel not found');
    }
    
    // 4. Force correct styling
    if (uiPanel) {
        console.log('\nForcing correct styling...');
        uiPanel.style.background = 'var(--panel-bg, white)';
        uiPanel.style.opacity = '1';
        uiPanel.style.visibility = 'visible';
        console.log('Done');
    }
    
})();