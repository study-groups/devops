// D2UR Playwright Baseline Capture Boilerplate
// This template gets customized for each run with specific URL and selectors

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Template variables - replaced by ddur_baseline function
const TARGET_URL = '{{URL}}';
const RUN_NAME = '{{RUN_NAME}}';
const OUTPUT_PATH = '{{OUTPUT_PATH}}';

async function captureBaseline() {
    console.log(`[DDUR-BASELINE] Starting baseline capture for: ${RUN_NAME}`);
    console.log(`[DDUR-BASELINE] Target URL: ${TARGET_URL}`);
    
    const browser = await chromium.launch({ 
        headless: true,   // Run headless in server environment
        devtools: false   // No DevTools in headless mode
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // Enable console logging to capture chrome-console/out
    const consoleMessages = [];
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
    
    try {
        // Navigate to target URL
        console.log(`[DDUR-BASELINE] Navigating to: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
        
        // Wait for page to be fully loaded
        await page.waitForTimeout(2000);
        
        // Capture comprehensive DOM state
        console.log(`[DDUR-BASELINE] Capturing DOM state...`);
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
        
        // Add console messages to the DOM state
        domState.consoleMessages = consoleMessages;
        
        // Save baseline state
        const outputDir = path.dirname(OUTPUT_PATH);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(domState, null, 2));
        console.log(`[DDUR-BASELINE] Baseline saved to: ${OUTPUT_PATH}`);
        
        // Save console messages separately for chrome-console/out
        const consoleOutPath = OUTPUT_PATH.replace('/dom/', '/chrome-console/out/').replace('.json', '-console.json');
        const consoleOutDir = path.dirname(consoleOutPath);
        if (!fs.existsSync(consoleOutDir)) {
            fs.mkdirSync(consoleOutDir, { recursive: true });
        }
        fs.writeFileSync(consoleOutPath, JSON.stringify(consoleMessages, null, 2));
        
        console.log(`[DDUR-BASELINE] Console output saved to: ${consoleOutPath}`);
        console.log(`[DDUR-BASELINE] Baseline capture completed successfully`);
        
        return {
            success: true,
            domElementCount: countElements(domState.documentElement),
            consoleMessageCount: consoleMessages.length,
            outputPath: OUTPUT_PATH
        };
        
    } catch (error) {
        console.error(`[DDUR-BASELINE] Error during baseline capture:`, error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        // Close browser in headless mode
        console.log(`[DDUR-BASELINE] Closing browser`);
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

// Run the baseline capture
captureBaseline().then(result => {
    console.log(`[DDUR-BASELINE] Final result:`, result);
    if (!result.success) {
        process.exit(1);
    }
}).catch(error => {
    console.error(`[DDUR-BASELINE] Fatal error:`, error);
    process.exit(1);
});
