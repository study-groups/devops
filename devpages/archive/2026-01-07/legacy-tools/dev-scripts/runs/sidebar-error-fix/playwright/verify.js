// D2UR Playwright Verification Script
// Captures post-change DOM state to verify the fix

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGET_URL = 'https://devpages.qa.pixeljamarcade.com/';
const RUN_NAME = 'sidebar-error-fix';
const OUTPUT_PATH = '/root/src/devops/devpages/dev-scripts/runs/sidebar-error-fix/dom/after.json';

async function captureAfterState() {
    console.log(`[DDUR-VERIFY] Starting post-fix verification for: ${RUN_NAME}`);
    console.log(`[DDUR-VERIFY] Target URL: ${TARGET_URL}`);
    
    const browser = await chromium.launch({ 
        headless: true,
        devtools: false
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // Capture console messages, especially looking for the error
    const consoleMessages = [];
    const jsErrors = [];
    
    page.on('console', msg => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: msg.type(),
            text: msg.text(),
            location: msg.location()
        };
        consoleMessages.push(logEntry);
        console.log(`[CONSOLE-${msg.type().toUpperCase()}] ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            name: error.name
        };
        jsErrors.push(errorEntry);
        console.error(`[JS-ERROR] ${error.message}`);
    });
    
    try {
        // Navigate to target URL
        console.log(`[DDUR-VERIFY] Navigating to: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
        
        // Wait for page to be fully loaded
        await page.waitForTimeout(3000);
        
        // Try to test the SidebarManager functionality
        console.log(`[DDUR-VERIFY] Testing SidebarManager functionality...`);
        const testResults = await page.evaluate(() => {
            const results = {
                sidebarManagerExists: false,
                openTabMethodExists: false,
                addTabMethodExists: false,
                testTabCreation: false,
                errorCount: 0
            };
            
            try {
                // Check if SidebarManager exists
                if (window.sidebarManager || (window.APP && window.APP.sidebarManager)) {
                    results.sidebarManagerExists = true;
                    const manager = window.sidebarManager || window.APP.sidebarManager;
                    
                    // Check if openTab method exists
                    if (typeof manager.openTab === 'function') {
                        results.openTabMethodExists = true;
                    }
                    
                    // Check if addTab method exists
                    if (typeof manager.addTab === 'function') {
                        results.addTabMethodExists = true;
                        
                        // Try to create a test tab (if sidebar is initialized)
                        try {
                            if (manager.sidebarElement) {
                                manager.addTab('test-tab', 'Test', '🔧');
                                results.testTabCreation = true;
                            }
                        } catch (e) {
                            console.log('Test tab creation failed (expected if sidebar not initialized):', e.message);
                        }
                    }
                }
            } catch (e) {
                results.errorCount++;
                console.error('Error during SidebarManager testing:', e);
            }
            
            return results;
        });
        
        console.log(`[DDUR-VERIFY] Test results:`, testResults);
        
        // Capture comprehensive DOM state (same as baseline)
        console.log(`[DDUR-VERIFY] Capturing DOM state...`);
        const domState = await page.evaluate(() => {
            // Helper function to get computed styles for key properties
            function getComputedStylesForElement(element) {
                const computed = window.getComputedStyle(element);
                return {
                    display: computed.display,
                    visibility: computed.visibility,
                    opacity: computed.opacity,
                    position: computed.position,
                    top: computed.top,
                    left: computed.left,
                    width: computed.width,
                    height: computed.height,
                    margin: computed.margin,
                    padding: computed.padding,
                    border: computed.border,
                    backgroundColor: computed.backgroundColor,
                    color: computed.color,
                    fontSize: computed.fontSize,
                    fontFamily: computed.fontFamily,
                    zIndex: computed.zIndex,
                    transform: computed.transform
                };
            }
            
            // Recursively capture element tree with computed styles
            function captureElementTree(element, depth = 0) {
                if (depth > 10) return null; // Prevent infinite recursion
                
                const rect = element.getBoundingClientRect();
                const elementData = {
                    tagName: element.tagName,
                    id: element.id || null,
                    className: element.className || null,
                    textContent: element.textContent ? element.textContent.trim().substring(0, 100) : null,
                    attributes: {},
                    boundingRect: {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        left: rect.left
                    },
                    computedStyles: getComputedStylesForElement(element),
                    children: []
                };
                
                // Capture important attributes
                for (const attr of element.attributes) {
                    elementData.attributes[attr.name] = attr.value;
                }
                
                // Recursively capture children
                for (const child of element.children) {
                    const childData = captureElementTree(child, depth + 1);
                    if (childData) {
                        elementData.children.push(childData);
                    }
                }
                
                return elementData;
            }
            
            return {
                timestamp: new Date().toISOString(),
                url: window.location.href,
                title: document.title,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                documentElement: captureElementTree(document.documentElement),
                // Capture specific elements that are commonly targeted
                commonSelectors: {
                    body: document.body ? captureElementTree(document.body) : null,
                    header: document.querySelector('header') ? captureElementTree(document.querySelector('header')) : null,
                    nav: document.querySelector('nav') ? captureElementTree(document.querySelector('nav')) : null,
                    main: document.querySelector('main') ? captureElementTree(document.querySelector('main')) : null,
                    sidebar: document.querySelector('.sidebar, #sidebar, [class*="sidebar"]') ? 
                        captureElementTree(document.querySelector('.sidebar, #sidebar, [class*="sidebar"]')) : null
                }
            };
        });
        
        // Add console messages and test results to the DOM state
        domState.consoleMessages = consoleMessages;
        domState.jsErrors = jsErrors;
        domState.testResults = testResults;
        
        // Save after state
        const outputDir = path.dirname(OUTPUT_PATH);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(domState, null, 2));
        console.log(`[DDUR-VERIFY] After state saved to: ${OUTPUT_PATH}`);
        
        // Save console messages separately
        const consoleOutPath = OUTPUT_PATH.replace('/dom/', '/chrome-console/out/').replace('.json', '-console.json');
        const consoleOutDir = path.dirname(consoleOutPath);
        if (!fs.existsSync(consoleOutDir)) {
            fs.mkdirSync(consoleOutDir, { recursive: true });
        }
        fs.writeFileSync(consoleOutPath, JSON.stringify({
            consoleMessages,
            jsErrors,
            testResults
        }, null, 2));
        
        console.log(`[DDUR-VERIFY] Console output saved to: ${consoleOutPath}`);
        console.log(`[DDUR-VERIFY] Verification completed successfully`);
        
        return {
            success: true,
            domElementCount: countElements(domState.documentElement),
            consoleMessageCount: consoleMessages.length,
            jsErrorCount: jsErrors.length,
            testResults: testResults,
            outputPath: OUTPUT_PATH
        };
        
    } catch (error) {
        console.error(`[DDUR-VERIFY] Error during verification:`, error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await browser.close();
    }
}

function countElements(elementTree) {
    if (!elementTree) return 0;
    let count = 1;
    for (const child of elementTree.children || []) {
        count += countElements(child);
    }
    return count;
}

// Run the verification
captureAfterState().then(result => {
    console.log(`[DDUR-VERIFY] Final result:`, result);
    if (!result.success) {
        process.exit(1);
    }
}).catch(error => {
    console.error(`[DDUR-VERIFY] Fatal error:`, error);
    process.exit(1);
});
