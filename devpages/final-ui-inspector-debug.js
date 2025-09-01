// Final UI Inspector Debug - Check what's still causing issues
(function() {
    'use strict';
    
    console.log('=== FINAL UI INSPECTOR DEBUG ===');
    
    function checkSystematicIssues() {
        console.log('🔍 Checking for systematic issues...');
        
        // 1. Check if base-panel-styles inline CSS still exists
        const inlineStyles = document.getElementById('base-panel-styles');
        if (inlineStyles) {
            console.log('❌ FOUND INLINE STYLES - This is the problem!');
            console.log('Inline styles content:', inlineStyles.textContent.substring(0, 200));
            console.log('Removing inline styles...');
            inlineStyles.remove();
            console.log('✅ Inline styles removed');
        } else {
            console.log('✅ No inline styles found');
        }
        
        // 2. Check CSS bundle loading order
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
        console.log('\n📜 CSS Loading Order:');
        stylesheets.forEach((sheet, i) => {
            if (sheet.tagName === 'LINK') {
                console.log(`${i + 1}. LINK: ${sheet.href}`);
            } else {
                console.log(`${i + 1}. STYLE: ${sheet.id || 'no-id'} (${sheet.textContent.length} chars)`);
            }
        });
        
        // 3. Check if panels.bundle.css loaded
        const panelsBundleLoaded = Array.from(document.querySelectorAll('link')).some(link => 
            link.href && link.href.includes('panels.bundle.css')
        );
        console.log(`\n🎛️  Panels bundle loaded: ${panelsBundleLoaded}`);
        
        // 4. Check actual CSS rules for .base-panel
        console.log('\n🎨 Checking .base-panel CSS rules:');
        const sheets = Array.from(document.styleSheets);
        let basePanelRules = [];
        
        sheets.forEach((sheet, sheetIndex) => {
            try {
                const cssRules = Array.from(sheet.cssRules || sheet.rules || []);
                cssRules.forEach((rule) => {
                    if (rule.selectorText && rule.selectorText.includes('.base-panel')) {
                        basePanelRules.push({
                            selector: rule.selectorText,
                            background: rule.style.background || rule.style.backgroundColor,
                            opacity: rule.style.opacity,
                            visibility: rule.style.visibility,
                            sheet: sheet.href || 'inline',
                            cssText: rule.cssText
                        });
                    }
                });
            } catch (e) {
                console.log(`Cannot access sheet ${sheetIndex}: ${e.message}`);
            }
        });
        
        console.log(`Found ${basePanelRules.length} .base-panel rules:`);
        basePanelRules.forEach((rule, i) => {
            console.log(`${i + 1}. ${rule.selector}`);
            console.log(`   Source: ${rule.sheet}`);
            console.log(`   Background: ${rule.background || 'none'}`);
            console.log(`   Opacity: ${rule.opacity || 'default'}`);
            console.log(`   Visibility: ${rule.visibility || 'default'}`);
        });
        
        return basePanelRules;
    }
    
    function forceCorrectStyling() {
        console.log('\n🔧 FORCING CORRECT STYLING...');
        
        // Find all base-panel elements
        const panels = document.querySelectorAll('.base-panel');
        console.log(`Found ${panels.length} base-panel elements`);
        
        panels.forEach((panel, i) => {
            console.log(`\nPanel ${i + 1}:`);
            console.log(`  Current background: ${window.getComputedStyle(panel).background}`);
            console.log(`  Current opacity: ${window.getComputedStyle(panel).opacity}`);
            console.log(`  Current visibility: ${window.getComputedStyle(panel).visibility}`);
            
            // Force proper styling
            panel.style.background = 'var(--panel-bg, #ffffff)';
            panel.style.opacity = panel.classList.contains('is-visible') ? '1' : '0';
            panel.style.visibility = panel.classList.contains('is-visible') ? 'visible' : 'hidden';
            
            console.log('  ✅ Forced correct styling');
        });
    }
    
    function runFullDiagnosis() {
        const rules = checkSystematicIssues();
        forceCorrectStyling();
        
        // Final check
        console.log('\n🏁 FINAL STATUS CHECK:');
        const uiPanel = Array.from(document.querySelectorAll('.base-panel')).find(p => 
            p.textContent.includes('UI Inspector')
        );
        
        if (uiPanel) {
            const computed = window.getComputedStyle(uiPanel);
            console.log('UI Inspector final styles:');
            console.log(`  background: ${computed.background}`);
            console.log(`  backgroundColor: ${computed.backgroundColor}`);
            console.log(`  opacity: ${computed.opacity}`);
            console.log(`  visibility: ${computed.visibility}`);
            console.log(`  display: ${computed.display}`);
            console.log(`  Classes: ${uiPanel.className}`);
        }
        
        return {
            inlineStylesRemoved: !document.getElementById('base-panel-styles'),
            panelsBundleLoaded: Array.from(document.querySelectorAll('link')).some(link => 
                link.href && link.href.includes('panels.bundle.css')
            ),
            basePanelRulesCount: rules.length,
            panelsFound: document.querySelectorAll('.base-panel').length
        };
    }
    
    // Run diagnosis
    const results = runFullDiagnosis();
    
    console.log('\n=== SUMMARY ===');
    console.log(results);
    
    // Expose functions
    window.debugUIFinal = {
        check: runFullDiagnosis,
        forceStyle: forceCorrectStyling,
        removeInline: () => {
            const inline = document.getElementById('base-panel-styles');
            if (inline) inline.remove();
        }
    };
    
    console.log('\n=== HELPER FUNCTIONS ===');
    console.log('- window.debugUIFinal.check()');
    console.log('- window.debugUIFinal.forceStyle()');
    console.log('- window.debugUIFinal.removeInline()');
    
})();