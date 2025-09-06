// Z-Index and Log Display Debug Test
(function() {
    'use strict';
    
    console.log('=== Z-INDEX AND LOG DISPLAY DEBUG TEST ===');
    
    // Get all elements with z-index
    function getAllElementsWithZIndex() {
        const elements = [];
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            const zIndex = style.zIndex;
            if (zIndex !== 'auto' && zIndex !== '') {
                elements.push({
                    element: el,
                    zIndex: parseInt(zIndex) || zIndex,
                    id: el.id,
                    className: el.className,
                    tagName: el.tagName
                });
            }
        });
        
        return elements.sort((a, b) => {
            const aZ = typeof a.zIndex === 'number' ? a.zIndex : -999999;
            const bZ = typeof b.zIndex === 'number' ? b.zIndex : -999999;
            return bZ - aZ; // Highest first
        });
    }
    
    // Test log container specifically
    function testLogContainer() {
        const logContainer = document.getElementById('log-container');
        
        console.log('\n=== LOG CONTAINER TEST ===');
        if (!logContainer) {
            console.error('❌ #log-container NOT FOUND in DOM');
            return null;
        }
        
        const computedStyle = window.getComputedStyle(logContainer);
        const rect = logContainer.getBoundingClientRect();
        
        console.log('✅ #log-container found');
        console.log('Classes:', logContainer.className);
        console.log('Display:', computedStyle.display);
        console.log('Position:', computedStyle.position);
        console.log('Z-Index:', computedStyle.zIndex);
        console.log('Visibility:', computedStyle.visibility);
        console.log('Opacity:', computedStyle.opacity);
        console.log('Height:', computedStyle.height);
        console.log('Bottom:', computedStyle.bottom);
        console.log('BoundingRect:', {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height
        });
        
        return {
            element: logContainer,
            computedStyle,
            rect
        };
    }
    
    // Check what's covering the log
    function findElementsAtLogPosition() {
        const logContainer = document.getElementById('log-container');
        if (!logContainer) return [];
        
        const rect = logContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const bottomY = rect.bottom - 10;
        
        console.log('\n=== ELEMENTS AT LOG POSITION ===');
        console.log(`Testing points: center(${centerX}, ${centerY}), bottom(${centerX}, ${bottomY})`);
        
        const elementsAtCenter = document.elementsFromPoint(centerX, centerY);
        const elementsAtBottom = document.elementsFromPoint(centerX, bottomY);
        
        console.log('Elements at center:', elementsAtCenter.map(el => ({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            zIndex: window.getComputedStyle(el).zIndex
        })));
        
        console.log('Elements at bottom:', elementsAtBottom.map(el => ({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            zIndex: window.getComputedStyle(el).zIndex
        })));
        
        return { elementsAtCenter, elementsAtBottom };
    }
    
    // Run all tests
    function runTests() {
        console.log('DOM Ready State:', document.readyState);
        console.log('Viewport size:', window.innerWidth + 'x' + window.innerHeight);
        
        const logTest = testLogContainer();
        const elementsWithZ = getAllElementsWithZIndex();
        const coveringElements = findElementsAtLogPosition();
        
        console.log('\n=== ALL ELEMENTS WITH Z-INDEX (highest first) ===');
        elementsWithZ.slice(0, 15).forEach((item, index) => {
            console.log(`${index + 1}. Z:${item.zIndex} - ${item.tagName}${item.id ? '#' + item.id : ''}${item.className ? '.' + item.className.split(' ')[0] : ''}`);
        });
        
        // Check CSS custom properties
        const rootStyle = window.getComputedStyle(document.documentElement);
        console.log('\n=== CSS CUSTOM PROPERTIES ===');
        console.log('--z-layer-ui:', rootStyle.getPropertyValue('--z-layer-ui'));
        console.log('--z-modal:', rootStyle.getPropertyValue('--z-modal'));
        console.log('--z-toast:', rootStyle.getPropertyValue('--z-toast'));
        console.log('--z-index-max:', rootStyle.getPropertyValue('--z-index-max'));
        
        return {
            logTest,
            elementsWithZ,
            coveringElements,
            summary: {
                logFound: !!logTest,
                logVisible: logTest && logTest.computedStyle.visibility !== 'hidden' && logTest.computedStyle.opacity !== '0',
                highestZIndex: elementsWithZ[0]?.zIndex || 'none',
                logZIndex: logTest?.computedStyle.zIndex || 'not found'
            }
        };
    }
    
    // Run immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runTests);
    } else {
        const results = runTests();
        console.log('\n=== SUMMARY ===', results.summary);
        
        // Make results available globally for inspection
        window.zIndexTestResults = results;
        console.log('Results saved to window.zIndexTestResults');
    }
    
})();