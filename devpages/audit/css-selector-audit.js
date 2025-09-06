// CSS Selector Audit Tool - DevPages
// Analyzes all CSS selectors for conflicts, duplicates, and patterns
(function() {
    'use strict';
    
    console.log('=== CSS SELECTOR AUDIT TOOL ===');
    
    // Collect all CSS rules from all stylesheets
    function collectAllCSSRules() {
        const rules = [];
        const sheets = Array.from(document.styleSheets);
        
        sheets.forEach((sheet, sheetIndex) => {
            try {
                const cssRules = Array.from(sheet.cssRules || sheet.rules || []);
                cssRules.forEach((rule, ruleIndex) => {
                    if (rule.selectorText) {
                        rules.push({
                            selector: rule.selectorText,
                            cssText: rule.cssText,
                            sheetIndex,
                            ruleIndex,
                            sheetHref: sheet.href || 'inline',
                            specificity: calculateSpecificity(rule.selectorText)
                        });
                    }
                });
            } catch (e) {
                console.warn(`Cannot access stylesheet ${sheetIndex}:`, e.message);
            }
        });
        
        return rules;
    }
    
    // Calculate CSS specificity (a, b, c, d)
    function calculateSpecificity(selector) {
        const ids = (selector.match(/#[a-zA-Z0-9_-]+/g) || []).length;
        const classes = (selector.match(/\.[a-zA-Z0-9_-]+/g) || []).length;
        const attrs = (selector.match(/\[[^\]]*\]/g) || []).length;
        const pseudoClasses = (selector.match(/:[a-zA-Z0-9_-]+(?:\([^)]*\))?/g) || []).filter(p => !p.startsWith('::'));
        const elements = (selector.match(/\b[a-zA-Z0-9]+(?!\s*[#\.\[:])(?!\s*\()/g) || []).length;
        const pseudoElements = (selector.match(/::[a-zA-Z0-9_-]+/g) || []).length;
        
        return {
            inline: 0, // Would be 1000 for style=""
            ids: ids * 100,
            classes: (classes + attrs + pseudoClasses.length) * 10,
            elements: elements + pseudoElements,
            total: (ids * 100) + ((classes + attrs + pseudoClasses.length) * 10) + elements + pseudoElements
        };
    }
    
    // Extract individual selectors from selector text
    function extractSelectors(selectorText) {
        return selectorText.split(',').map(s => s.trim());
    }
    
    // Categorize selectors
    function categorizeSelector(selector) {
        const categories = [];
        
        if (selector.includes('#')) categories.push('id');
        if (selector.includes('.')) categories.push('class');
        if (selector.includes('[')) categories.push('attribute');
        if (selector.includes(':') && !selector.includes('::')) categories.push('pseudo-class');
        if (selector.includes('::')) categories.push('pseudo-element');
        if (/\b[a-zA-Z0-9]+(?!\s*[#\.\[:])(?!\s*\()/.test(selector)) categories.push('element');
        
        // DevPages specific patterns
        if (selector.includes('dp-')) categories.push('dp-system');
        if (selector.includes('diagnostic')) categories.push('diagnostic');
        if (selector.includes('panel')) categories.push('panel');
        if (selector.includes('log')) categories.push('log');
        if (selector.includes('base-panel')) categories.push('base-panel');
        
        return categories;
    }
    
    // Find potential conflicts
    function findConflicts(rules) {
        const conflicts = [];
        const selectorMap = new Map();
        
        rules.forEach(rule => {
            const selectors = extractSelectors(rule.selector);
            selectors.forEach(sel => {
                if (!selectorMap.has(sel)) {
                    selectorMap.set(sel, []);
                }
                selectorMap.get(sel).push(rule);
            });
        });
        
        selectorMap.forEach((ruleList, selector) => {
            if (ruleList.length > 1) {
                conflicts.push({
                    selector,
                    count: ruleList.length,
                    rules: ruleList,
                    properties: getConflictingProperties(ruleList)
                });
            }
        });
        
        return conflicts.sort((a, b) => b.count - a.count);
    }
    
    // Find conflicting properties within rules
    function getConflictingProperties(rules) {
        const propertyMap = new Map();
        
        rules.forEach(rule => {
            const cssText = rule.cssText;
            const matches = cssText.match(/([a-z-]+)\s*:\s*([^;]+);/g) || [];
            matches.forEach(match => {
                const [, property, value] = match.match(/([a-z-]+)\s*:\s*([^;]+);/) || [];
                if (property && value) {
                    if (!propertyMap.has(property)) {
                        propertyMap.set(property, new Set());
                    }
                    propertyMap.get(property).add(value.trim());
                }
            });
        });
        
        const conflicts = [];
        propertyMap.forEach((values, property) => {
            if (values.size > 1) {
                conflicts.push({
                    property,
                    values: Array.from(values),
                    valueCount: values.size
                });
            }
        });
        
        return conflicts;
    }
    
    // Analyze selector patterns
    function analyzePatterns(rules) {
        const patterns = {
            byPrefix: new Map(),
            byCategory: new Map(),
            bySpecificity: new Map(),
            byLength: new Map()
        };
        
        rules.forEach(rule => {
            const selectors = extractSelectors(rule.selector);
            selectors.forEach(sel => {
                // By prefix
                const prefix = sel.match(/^[\.\#]?([a-zA-Z0-9]+)/)?.[1] || 'other';
                patterns.byPrefix.set(prefix, (patterns.byPrefix.get(prefix) || 0) + 1);
                
                // By category
                const categories = categorizeSelector(sel);
                categories.forEach(cat => {
                    patterns.byCategory.set(cat, (patterns.byCategory.get(cat) || 0) + 1);
                });
                
                // By specificity
                const spec = rule.specificity.total;
                const specRange = spec < 10 ? '0-9' : spec < 100 ? '10-99' : spec < 1000 ? '100-999' : '1000+';
                patterns.bySpecificity.set(specRange, (patterns.bySpecificity.get(specRange) || 0) + 1);
                
                // By length
                const len = sel.length;
                const lenRange = len < 20 ? 'short' : len < 50 ? 'medium' : len < 100 ? 'long' : 'very-long';
                patterns.byLength.set(lenRange, (patterns.byLength.get(lenRange) || 0) + 1);
            });
        });
        
        return patterns;
    }
    
    // Find potential DevPages specific issues
    function findDevPagesIssues(rules) {
        const issues = [];
        
        // Look for dp- vs diagnostic conflicts
        const dpSelectors = rules.filter(r => r.selector.includes('dp-'));
        const diagnosticSelectors = rules.filter(r => r.selector.includes('diagnostic'));
        
        if (dpSelectors.length > 0 && diagnosticSelectors.length > 0) {
            issues.push({
                type: 'naming-conflict',
                description: 'Both dp- and diagnostic selectors found',
                dpCount: dpSelectors.length,
                diagnosticCount: diagnosticSelectors.length
            });
        }
        
        // Look for base-panel related issues
        const basePanelSelectors = rules.filter(r => r.selector.includes('base-panel'));
        const panelSelectors = rules.filter(r => r.selector.includes('.panel-') && !r.selector.includes('base-panel'));
        
        if (basePanelSelectors.length > 0 && panelSelectors.length > 0) {
            issues.push({
                type: 'panel-naming',
                description: 'Both base-panel and .panel- selectors found',
                basePanelCount: basePanelSelectors.length,
                panelCount: panelSelectors.length
            });
        }
        
        // Look for opacity/visibility conflicts
        const opacityRules = rules.filter(r => r.cssText.includes('opacity:'));
        const visibilityRules = rules.filter(r => r.cssText.includes('visibility:'));
        
        issues.push({
            type: 'visibility-rules',
            description: 'Opacity and visibility rules that might conflict',
            opacityCount: opacityRules.length,
            visibilityCount: visibilityRules.length,
            examples: [
                ...opacityRules.slice(0, 3).map(r => ({ type: 'opacity', selector: r.selector, cssText: r.cssText })),
                ...visibilityRules.slice(0, 3).map(r => ({ type: 'visibility', selector: r.selector, cssText: r.cssText }))
            ]
        });
        
        return issues;
    }
    
    // Main analysis function
    function runAnalysis() {
        console.log('📊 Collecting CSS rules...');
        const rules = collectAllCSSRules();
        console.log(`Found ${rules.length} CSS rules across ${document.styleSheets.length} stylesheets`);
        
        console.log('\n🔍 Finding conflicts...');
        const conflicts = findConflicts(rules);
        console.log(`Found ${conflicts.length} conflicting selectors`);
        
        console.log('\n📈 Analyzing patterns...');
        const patterns = analyzePatterns(rules);
        
        console.log('\n⚠️ Finding DevPages specific issues...');
        const devPagesIssues = findDevPagesIssues(rules);
        
        // Report results
        console.log('\n=== TOP CONFLICTS ===');
        conflicts.slice(0, 10).forEach((conflict, i) => {
            console.log(`${i + 1}. "${conflict.selector}" (${conflict.count} rules)`);
            if (conflict.properties.length > 0) {
                console.log(`   Conflicting properties:`, conflict.properties);
            }
            conflict.rules.forEach((rule, j) => {
                console.log(`   ${j + 1}: ${rule.sheetHref} (specificity: ${rule.specificity.total})`);
            });
        });
        
        console.log('\n=== PATTERNS ===');
        console.log('By Category:', Object.fromEntries(Array.from(patterns.byCategory.entries()).sort((a, b) => b[1] - a[1])));
        console.log('By Prefix:', Object.fromEntries(Array.from(patterns.byPrefix.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15)));
        console.log('By Specificity:', Object.fromEntries(patterns.bySpecificity));
        
        console.log('\n=== DEVPAGES ISSUES ===');
        devPagesIssues.forEach(issue => {
            console.log(`${issue.type}: ${issue.description}`);
            console.log(`  Details:`, issue);
        });
        
        // Create downloadable report
        const report = {
            summary: {
                totalRules: rules.length,
                totalStylesheets: document.styleSheets.length,
                conflictCount: conflicts.length
            },
            conflicts: conflicts.slice(0, 20),
            patterns,
            devPagesIssues,
            allRules: rules.slice(0, 100) // Limit to prevent huge output
        };
        
        console.log('\n=== GENERATING REPORT ===');
        console.log('Full report saved to window.cssAuditReport');
        window.cssAuditReport = report;
        
        // Generate downloadable JSON
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        console.log(`Download report: ${url}`);
        
        return report;
    }
    
    // Run analysis
    const results = runAnalysis();
    
    // Specific UI Inspector analysis
    console.log('\n=== UI INSPECTOR SPECIFIC ANALYSIS ===');
    const uiInspectorRules = results.allRules.filter(r => 
        r.selector.includes('ui-inspector') || 
        r.selector.includes('dp-') || 
        r.selector.includes('.base-panel')
    );
    
    console.log('UI Inspector related rules:');
    uiInspectorRules.forEach(rule => {
        console.log(`  ${rule.selector} (specificity: ${rule.specificity.total})`);
        console.log(`    ${rule.sheetHref}`);
    });
    
})();