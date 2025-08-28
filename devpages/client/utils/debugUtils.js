/**
 * Debug Utilities
 * Core debug functions available globally via APP.debug
 */

// Initialize APP.debug structure
function initializeDebugUtils() {
    if (typeof window === 'undefined') return;
    
    window.APP = window.APP || {};
    window.APP.debug = window.APP.debug || {};
    
    // Visual Test Function - Always available
    window.APP.debug.visualTest = function(targetSelector = '#log-container') {
        console.log('👁️ VISUAL DEBUG TEST');
        console.log('====================');
        
        // Remove existing test overlay
        const existing = document.getElementById('debug-visual-test-overlay');
        if (existing) {
            existing.remove();
        }

        // Create test overlay
        const testOverlay = document.createElement('div');
        testOverlay.id = 'debug-visual-test-overlay';
        testOverlay.style.cssText = `
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

        // Find target element
        const targetElement = document.querySelector(targetSelector);
        if (!targetElement) {
            console.error(`Target element "${targetSelector}" not found`);
            return;
        }

        const rect = targetElement.getBoundingClientRect();
        console.log(`Target element: ${targetSelector}`, {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top
        });

        // Add border around target
        const targetBorder = document.createElement('div');
        targetBorder.style.cssText = `
            position: absolute;
            left: ${rect.left - 2}px;
            top: ${rect.top - 2}px;
            width: ${rect.width + 4}px;
            height: ${rect.height + 4}px;
            border: 3px solid red;
            background: rgba(255, 0, 0, 0.1);
        `;
        testOverlay.appendChild(targetBorder);

        // Add measurement labels
        const widthLabel = document.createElement('div');
        widthLabel.style.cssText = `
            position: absolute;
            left: ${rect.left + rect.width/2 - 30}px;
            top: ${rect.top - 25}px;
            background: white;
            border: 1px solid black;
            padding: 2px 5px;
            font-weight: bold;
            color: red;
        `;
        widthLabel.textContent = `${Math.round(rect.width)}px`;
        testOverlay.appendChild(widthLabel);

        const heightLabel = document.createElement('div');
        heightLabel.style.cssText = `
            position: absolute;
            left: ${rect.left - 50}px;
            top: ${rect.top + rect.height/2 - 10}px;
            background: white;
            border: 1px solid black;
            padding: 2px 5px;
            font-weight: bold;
            color: red;
            transform: rotate(-90deg);
        `;
        heightLabel.textContent = `${Math.round(rect.height)}px`;
        testOverlay.appendChild(heightLabel);

        // If it's a log container, add column analysis
        if (targetSelector.includes('log')) {
            const header = document.getElementById('log-column-header');
            if (header) {
                const headerCols = header.querySelectorAll('[class*="log-header-"]');
                let currentLeft = rect.left;
                
                headerCols.forEach((col, i) => {
                    const colRect = col.getBoundingClientRect();
                    
                    // Add column border
                    const colBorder = document.createElement('div');
                    colBorder.style.cssText = `
                        position: absolute;
                        left: ${colRect.left}px;
                        top: ${rect.top}px;
                        width: ${colRect.width}px;
                        height: ${rect.height}px;
                        border: 1px dashed blue;
                        background: rgba(0, 0, 255, 0.05);
                    `;
                    testOverlay.appendChild(colBorder);
                    
                    // Add column width label
                    const colLabel = document.createElement('div');
                    colLabel.style.cssText = `
                        position: absolute;
                        left: ${colRect.left + 2}px;
                        top: ${rect.top + 2}px;
                        background: yellow;
                        border: 1px solid black;
                        padding: 1px 3px;
                        font-size: 10px;
                        font-weight: bold;
                    `;
                    colLabel.textContent = `${Math.round(colRect.width)}px`;
                    testOverlay.appendChild(colLabel);
                    
                    // Add column name
                    const colName = document.createElement('div');
                    colName.style.cssText = `
                        position: absolute;
                        left: ${colRect.left + 2}px;
                        top: ${rect.top + 18}px;
                        background: white;
                        border: 1px solid black;
                        padding: 1px 3px;
                        font-size: 9px;
                    `;
                    const className = col.className.replace('log-header-', '');
                    colName.textContent = className;
                    testOverlay.appendChild(colName);
                });
            }
        }

        // Add close button
        const closeButton = document.createElement('div');
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: red;
            color: white;
            padding: 5px 10px;
            cursor: pointer;
            border-radius: 3px;
            font-weight: bold;
            pointer-events: auto;
        `;
        closeButton.textContent = 'Close Visual Test';
        closeButton.onclick = () => testOverlay.remove();
        testOverlay.appendChild(closeButton);

        document.body.appendChild(testOverlay);
        console.log('✅ Visual test overlay added');
        console.log('💡 Click "Close Visual Test" or wait 30 seconds for auto-removal');

        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (testOverlay.parentNode) {
                testOverlay.remove();
                console.log('Visual test overlay auto-removed');
            }
        }, 30000);

        return testOverlay;
    };

    // Add Debug Borders Function
    window.APP.debug.addBorders = function(targetSelector = '#log-container') {
        console.log('🔲 ADDING DEBUG BORDERS');
        console.log('=======================');
        
        // Remove existing borders
        const existingBorders = document.getElementById('debug-borders-style');
        if (existingBorders) {
            existingBorders.remove();
        }

        // Create border styles
        const style = document.createElement('style');
        style.id = 'debug-borders-style';
        
        if (targetSelector.includes('log')) {
            // Log-specific borders
            style.textContent = `
/* DEBUG BORDERS - Log Columns */
.log-header-timestamp { border: 2px solid red !important; background: rgba(255,0,0,0.1) !important; }
.log-header-level { border: 2px solid blue !important; background: rgba(0,0,255,0.1) !important; }
.log-header-type { border: 2px solid green !important; background: rgba(0,255,0,0.1) !important; }
.log-header-module { border: 2px solid orange !important; background: rgba(255,165,0,0.1) !important; }
.log-header-action { border: 2px solid purple !important; background: rgba(128,0,128,0.1) !important; }
.log-header-from { border: 2px solid cyan !important; background: rgba(0,255,255,0.1) !important; }
.log-header-message { border: 2px solid magenta !important; background: rgba(255,0,255,0.1) !important; }

.log-entry-timestamp { border: 2px dashed red !important; }
.log-entry-level { border: 2px dashed blue !important; }
.log-entry-type { border: 2px dashed green !important; }
.log-entry-module { border: 2px dashed orange !important; }
.log-entry-action { border: 2px dashed purple !important; }
.log-entry-from { border: 2px dashed cyan !important; }
.log-entry-message { border: 2px dashed magenta !important; }

#log-column-header { border: 3px solid black !important; }
.log-entry { border-bottom: 1px solid #ccc !important; }
            `;
        } else {
            // Generic borders
            style.textContent = `
/* DEBUG BORDERS - Generic */
${targetSelector} * {
    border: 1px solid red !important;
    background: rgba(255,0,0,0.05) !important;
}
            `;
        }
        
        document.head.appendChild(style);
        console.log('✅ Debug borders added');
        console.log('Colors: RED=timestamp, BLUE=level, GREEN=type, ORANGE=module, PURPLE=action, CYAN=from, MAGENTA=message');

        // Auto-remove after 30 seconds
        setTimeout(() => {
            style.remove();
            console.log('Debug borders auto-removed');
        }, 30000);

        return style;
    };

    // Remove Debug Styles Function
    window.APP.debug.clearStyles = function() {
        const debugStyles = [
            'debug-visual-test-overlay',
            'debug-borders-style',
            'log-alignment-fix',
            'log-debug-borders',
            'nuclear-text-alignment-fix'
        ];
        
        let removed = 0;
        debugStyles.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
                removed++;
            }
        });
        
        console.log(`✅ Cleared ${removed} debug styles`);
        return removed;
    };

    // Quick Log Test
    window.APP.debug.logTest = function() {
        return window.APP.debug.visualTest('#log-container');
    };

    console.log('✅ Debug utilities initialized');
    console.log('Available functions:');
    console.log('  APP.debug.visualTest(selector) - Visual test with measurements');
    console.log('  APP.debug.addBorders(selector) - Add colored borders');
    console.log('  APP.debug.clearStyles() - Remove all debug styles');
    console.log('  APP.debug.logTest() - Quick log visual test');
}

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDebugUtils);
    } else {
        initializeDebugUtils();
    }
}

export { initializeDebugUtils };
