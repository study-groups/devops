/**
 * Z-Index Debugger
 * Specialized z-index analysis and visualization tool
 */

console.log('📐 Z-INDEX DEBUGGER');
console.log('===================');

// Z-Index visualization and debugging
window.zIndexDebugger = {
    elements: [],
    layers: {},
    conflicts: [],
    visualization: null
};

// 1. Comprehensive Z-Index Scan
function scanZIndexElements() {
    const elements = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach((el, index) => {
        const computed = getComputedStyle(el);
        const zIndex = computed.zIndex;
        
        if (zIndex !== 'auto') {
            const zValue = parseInt(zIndex);
            const rect = el.getBoundingClientRect();
            
            elements.push({
                element: el,
                index,
                tagName: el.tagName.toLowerCase(),
                id: el.id || '',
                classes: Array.from(el.classList),
                zIndex: zValue,
                position: computed.position,
                display: computed.display,
                visibility: computed.visibility,
                opacity: parseFloat(computed.opacity),
                rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                },
                isVisible: rect.width > 0 && rect.height > 0 && computed.visibility !== 'hidden' && computed.display !== 'none',
                stackingContext: computed.position !== 'static' || computed.zIndex !== 'auto'
            });
        }
    });
    
    // Sort by z-index (highest first)
    elements.sort((a, b) => b.zIndex - a.zIndex);
    
    window.zIndexDebugger.elements = elements;
    console.log(`Found ${elements.length} elements with z-index`);
    return elements;
}

// 2. Layer Analysis
function analyzeZIndexLayers() {
    const elements = window.zIndexDebugger.elements;
    const layers = {
        'EXTREME (100000+)': { min: 100000, max: Infinity, elements: [], color: '#ff0000' },
        'DEBUG (10000-99999)': { min: 10000, max: 99999, elements: [], color: '#ff6600' },
        'SYSTEM (1000-9999)': { min: 1000, max: 9999, elements: [], color: '#ffaa00' },
        'UI (100-999)': { min: 100, max: 999, elements: [], color: '#00aa00' },
        'BASE (1-99)': { min: 1, max: 99, elements: [], color: '#0066cc' },
        'NEGATIVE': { min: -Infinity, max: 0, elements: [], color: '#666666' }
    };
    
    elements.forEach(el => {
        const z = el.zIndex;
        if (z >= 100000) layers['EXTREME (100000+)'].elements.push(el);
        else if (z >= 10000) layers['DEBUG (10000-99999)'].elements.push(el);
        else if (z >= 1000) layers['SYSTEM (1000-9999)'].elements.push(el);
        else if (z >= 100) layers['UI (100-999)'].elements.push(el);
        else if (z >= 1) layers['BASE (1-99)'].elements.push(el);
        else layers['NEGATIVE'].elements.push(el);
    });
    
    window.zIndexDebugger.layers = layers;
    
    console.log('\n📊 Z-Index Layers:');
    Object.entries(layers).forEach(([name, layer]) => {
        if (layer.elements.length > 0) {
            console.log(`${name}: ${layer.elements.length} elements`);
            layer.elements.slice(0, 3).forEach(el => {
                console.log(`  - ${el.tagName}${el.id ? '#' + el.id : ''}${el.classes.length ? '.' + el.classes.join('.') : ''} (z: ${el.zIndex})`);
            });
        }
    });
    
    return layers;
}

// 3. Conflict Detection
function detectZIndexConflicts() {
    const elements = window.zIndexDebugger.elements;
    const conflicts = [];
    const groups = {};
    
    // Group by z-index value
    elements.forEach(el => {
        if (!groups[el.zIndex]) groups[el.zIndex] = [];
        groups[el.zIndex].push(el);
    });
    
    // Find overlapping elements with same z-index
    Object.entries(groups).forEach(([zIndex, els]) => {
        if (els.length > 1) {
            // Check for spatial overlap
            for (let i = 0; i < els.length; i++) {
                for (let j = i + 1; j < els.length; j++) {
                    const el1 = els[i];
                    const el2 = els[j];
                    
                    if (el1.isVisible && el2.isVisible && elementsOverlap(el1.rect, el2.rect)) {
                        conflicts.push({
                            zIndex: parseInt(zIndex),
                            elements: [el1, el2],
                            type: 'spatial-overlap',
                            severity: getSeverity(el1, el2)
                        });
                    }
                }
            }
        }
    });
    
    // Find inappropriate z-index values
    elements.forEach(el => {
        const issues = [];
        
        if (el.zIndex > 100000) {
            issues.push('Extremely high z-index (>100000)');
        }
        
        if (el.zIndex === 999999) {
            issues.push('Common debug value (999999) - should use CSS variable');
        }
        
        if (el.position === 'static' && el.zIndex !== 0) {
            issues.push('Z-index on static positioned element (has no effect)');
        }
        
        if (issues.length > 0) {
            conflicts.push({
                zIndex: el.zIndex,
                elements: [el],
                type: 'inappropriate-value',
                issues,
                severity: 'medium'
            });
        }
    });
    
    window.zIndexDebugger.conflicts = conflicts;
    
    console.log(`\n⚠️ Found ${conflicts.length} z-index conflicts:`);
    conflicts.slice(0, 5).forEach((conflict, i) => {
        console.log(`${i + 1}. ${conflict.type} at z-index ${conflict.zIndex}`);
        if (conflict.issues) {
            conflict.issues.forEach(issue => console.log(`   - ${issue}`));
        }
    });
    
    return conflicts;
}

function elementsOverlap(rect1, rect2) {
    return !(rect1.left + rect1.width < rect2.left || 
             rect2.left + rect2.width < rect1.left || 
             rect1.top + rect1.height < rect2.top || 
             rect2.top + rect2.height < rect1.top);
}

function getSeverity(el1, el2) {
    // Higher severity for interactive elements
    const interactive1 = el1.tagName === 'button' || el1.tagName === 'a' || el1.classes.includes('btn');
    const interactive2 = el2.tagName === 'button' || el2.tagName === 'a' || el2.classes.includes('btn');
    
    if (interactive1 && interactive2) return 'high';
    if (interactive1 || interactive2) return 'medium';
    return 'low';
}

// 4. Visual Z-Index Map
function createZIndexVisualization() {
    // Remove existing visualization
    const existing = document.getElementById('zindex-visualization');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'zindex-visualization';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999999;
        font-family: monospace;
        font-size: 12px;
    `;
    
    const elements = window.zIndexDebugger.elements.filter(el => el.isVisible);
    const layers = window.zIndexDebugger.layers;
    
    elements.forEach(el => {
        const indicator = document.createElement('div');
        const layerName = Object.keys(layers).find(name => {
            const layer = layers[name];
            return el.zIndex >= layer.min && el.zIndex <= layer.max;
        });
        const layer = layers[layerName];
        
        indicator.style.cssText = `
            position: absolute;
            top: ${el.rect.top}px;
            left: ${el.rect.left}px;
            width: ${Math.max(el.rect.width, 20)}px;
            height: ${Math.max(el.rect.height, 20)}px;
            border: 2px solid ${layer.color};
            background: ${layer.color}20;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${layer.color};
            font-weight: bold;
            text-shadow: 0 0 3px white;
        `;
        
        indicator.textContent = el.zIndex;
        indicator.title = `${el.tagName}${el.id ? '#' + el.id : ''} z-index: ${el.zIndex}`;
        overlay.appendChild(indicator);
    });
    
    // Add legend
    const legend = document.createElement('div');
    legend.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        border: 2px solid #333;
        padding: 10px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        pointer-events: auto;
        max-width: 200px;
    `;
    
    legend.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Z-Index Layers</div>
        ${Object.entries(layers).map(([name, layer]) => 
            layer.elements.length > 0 ? 
            `<div style="color: ${layer.color}; margin: 2px 0;">
                ■ ${name} (${layer.elements.length})
            </div>` : ''
        ).join('')}
        <button onclick="document.getElementById('zindex-visualization').remove()" 
                style="margin-top: 10px; padding: 5px; cursor: pointer;">
            Close
        </button>
    `;
    
    overlay.appendChild(legend);
    document.body.appendChild(overlay);
    
    window.zIndexDebugger.visualization = overlay;
    console.log('✅ Z-index visualization created');
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.remove();
            console.log('Z-index visualization auto-removed');
        }
    }, 10000);
}

// 5. CSS Variable Integration Check
function checkZIndexVariables() {
    const rootStyles = getComputedStyle(document.documentElement);
    const expectedVars = {
        '--z-dropdown': 1000,
        '--z-sticky': 1020,
        '--z-fixed': 1030,
        '--z-modal-backdrop': 1040,
        '--z-modal': 1050,
        '--z-popover': 1060,
        '--z-tooltip': 1070,
        '--z-toast': 1080
    };
    
    const results = {
        defined: {},
        missing: [],
        unused: [],
        hardcoded: []
    };
    
    // Check defined variables
    Object.entries(expectedVars).forEach(([varName, expectedValue]) => {
        const value = rootStyles.getPropertyValue(varName);
        if (value) {
            results.defined[varName] = parseInt(value.trim());
        } else {
            results.missing.push(varName);
        }
    });
    
    // Check for hardcoded values that should use variables
    window.zIndexDebugger.elements.forEach(el => {
        const z = el.zIndex;
        const shouldUseVar = Object.values(expectedVars).includes(z);
        if (shouldUseVar) {
            const varName = Object.keys(expectedVars).find(key => expectedVars[key] === z);
            results.hardcoded.push({
                element: el,
                zIndex: z,
                suggestedVariable: varName
            });
        }
    });
    
    console.log('\n🔧 CSS Variable Analysis:');
    console.log('Defined variables:', results.defined);
    console.log('Missing variables:', results.missing);
    console.log('Hardcoded values that should use variables:', results.hardcoded.length);
    
    return results;
}

// 6. Generate Z-Index Report
function generateZIndexReport() {
    const elements = scanZIndexElements();
    const layers = analyzeZIndexLayers();
    const conflicts = detectZIndexConflicts();
    const variables = checkZIndexVariables();
    
    const report = {
        summary: {
            totalElements: elements.length,
            highestZIndex: elements[0]?.zIndex || 0,
            conflicts: conflicts.length,
            extremeValues: layers['EXTREME (100000+)'].elements.length,
            missingVariables: variables.missing.length,
            hardcodedValues: variables.hardcoded.length
        },
        recommendations: []
    };
    
    // Generate recommendations
    if (report.summary.extremeValues > 0) {
        report.recommendations.push({
            type: 'extreme-values',
            message: `${report.summary.extremeValues} elements have z-index > 100000. Consider using lower values.`,
            priority: 'high'
        });
    }
    
    if (report.summary.hardcodedValues > 0) {
        report.recommendations.push({
            type: 'use-variables',
            message: `${report.summary.hardcodedValues} elements use hardcoded z-index values. Use CSS variables instead.`,
            priority: 'medium'
        });
    }
    
    if (report.summary.conflicts > 0) {
        report.recommendations.push({
            type: 'resolve-conflicts',
            message: `${report.summary.conflicts} z-index conflicts detected. Review overlapping elements.`,
            priority: 'high'
        });
    }
    
    console.log('\n📋 Z-INDEX REPORT:');
    console.log('==================');
    console.log('Summary:', report.summary);
    console.log('\nRecommendations:');
    report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
    });
    
    return report;
}

// 7. Quick Fixes
window.fixZIndexIssues = function() {
    const elements = window.zIndexDebugger.elements;
    const fixes = [];
    
    elements.forEach(el => {
        if (el.zIndex > 100000) {
            // Reduce extreme values
            el.element.style.zIndex = '1000';
            fixes.push(`Reduced ${el.tagName}${el.id ? '#' + el.id : ''} from ${el.zIndex} to 1000`);
        }
        
        if (el.zIndex === 999999) {
            // Replace debug values
            el.element.style.zIndex = 'var(--z-tooltip)';
            fixes.push(`Replaced debug value on ${el.tagName}${el.id ? '#' + el.id : ''} with CSS variable`);
        }
    });
    
    console.log(`✅ Applied ${fixes.length} z-index fixes:`);
    fixes.forEach(fix => console.log(`  - ${fix}`));
};

window.showZIndexMap = createZIndexVisualization;

// Auto-run analysis
console.log('\n🚀 Running z-index analysis...');
generateZIndexReport();

console.log('\n💡 Available functions:');
console.log('- showZIndexMap() - Visual z-index overlay');
console.log('- fixZIndexIssues() - Auto-fix common issues');
console.log('- generateZIndexReport() - Re-run analysis');
console.log('- window.zIndexDebugger - Full analysis data');
