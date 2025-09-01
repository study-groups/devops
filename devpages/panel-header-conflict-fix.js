// Panel Header Conflict Fix
(function() {
    'use strict';
    
    console.log('=== PANEL HEADER CONFLICT ANALYSIS ===');
    
    // Find all .panel-header rules
    const sheets = Array.from(document.styleSheets);
    const panelHeaderRules = [];
    
    sheets.forEach((sheet, sheetIndex) => {
        try {
            const cssRules = Array.from(sheet.cssRules || sheet.rules || []);
            cssRules.forEach((rule, ruleIndex) => {
                if (rule.selectorText && rule.selectorText.includes('.panel-header')) {
                    panelHeaderRules.push({
                        selector: rule.selectorText,
                        cssText: rule.cssText,
                        sheetHref: sheet.href || 'inline',
                        sheetIndex,
                        ruleIndex
                    });
                }
            });
        } catch (e) {
            console.warn(`Cannot access stylesheet ${sheetIndex}:`, e.message);
        }
    });
    
    console.log(`Found ${panelHeaderRules.length} .panel-header rules:`);
    panelHeaderRules.forEach((rule, index) => {
        console.log(`\n${index + 1}. ${rule.selector}`);
        console.log(`   Source: ${rule.sheetHref}`);
        console.log(`   CSS: ${rule.cssText}`);
    });
    
    // Check actual computed styles on panels
    const panels = document.querySelectorAll('.base-panel');
    console.log(`\nChecking ${panels.length} panels for header conflicts:`);
    
    panels.forEach((panel, index) => {
        const header = panel.querySelector('.panel-header');
        if (header) {
            const computed = window.getComputedStyle(header);
            console.log(`\nPanel ${index + 1} header computed styles:`);
            console.log(`  background: ${computed.background}`);
            console.log(`  padding: ${computed.padding}`);
            console.log(`  height: ${computed.height}`);
            console.log(`  display: ${computed.display}`);
            console.log(`  border: ${computed.border}`);
        }
    });
    
    // Check for BasePanel specific styles
    console.log('\n=== CHECKING BASE-PANEL STYLES ===');
    const basePanelRules = [];
    
    sheets.forEach((sheet, sheetIndex) => {
        try {
            const cssRules = Array.from(sheet.cssRules || sheet.rules || []);
            cssRules.forEach((rule, ruleIndex) => {
                if (rule.selectorText && rule.selectorText.includes('base-panel')) {
                    basePanelRules.push({
                        selector: rule.selectorText,
                        cssText: rule.cssText,
                        sheetHref: sheet.href || 'inline'
                    });
                }
            });
        } catch (e) {
            console.warn(`Cannot access stylesheet ${sheetIndex}:`, e.message);
        }
    });
    
    console.log(`Found ${basePanelRules.length} base-panel rules:`);
    basePanelRules.forEach((rule, index) => {
        console.log(`${index + 1}. ${rule.selector}`);
        console.log(`   ${rule.sheetHref}`);
        if (rule.cssText.includes('opacity') || rule.cssText.includes('visibility') || rule.cssText.includes('transform')) {
            console.log(`   ⚠️  VISIBILITY RULE: ${rule.cssText}`);
        }
    });
    
    window.panelHeaderRules = panelHeaderRules;
    window.basePanelRules = basePanelRules;
    
})();