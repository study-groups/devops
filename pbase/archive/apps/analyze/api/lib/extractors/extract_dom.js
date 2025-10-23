import { chromium } from 'playwright';
import process from 'process';

// Separate logging function that writes to stderr instead of stdout
const log = (...args) => {
    console.error(...args);
};

async function extractDom(url, selector) {
    const sanitizedUrl = url.replace(/^['"]|['"]$/g, '');
    const sanitizedSelector = selector.replace(/^['"]|['"]$/g, '');
    
    log('Starting DOM extraction for:', {
        url: sanitizedUrl,
        selector: sanitizedSelector
    });
    
    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-web-security', '--disable-features=IsolateOrigins']
    });
    const context = await browser.newContext({
        bypassCSP: true,
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    try {
        new URL(sanitizedUrl);
        
        log('Navigating to URL:', sanitizedUrl);
        
        await page.goto(sanitizedUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        log('Initial page load complete, waiting for hydration...');

        try {
            await Promise.race([
                page.waitForLoadState('networkidle', { timeout: 5000 }),
                page.waitForLoadState('load', { timeout: 5000 }),
                page.waitForTimeout(5000)
            ]);
        } catch (error) {
            log('Load state wait completed with:', error.message);
        }

        await page.waitForTimeout(2000);

        log('Page appears ready, analyzing content...');
        
        const possibleSelectors = [
            sanitizedSelector,
            '#game-container',
            '[data-game-container]',
            'canvas',
            '.game',
            '[class*="game"]'
        ];

        let elementInfo = null;
        
        for (const currentSelector of possibleSelectors) {
            try {
                const exists = await page.$(currentSelector);
                if (exists) {
                    log(`Found matching element with selector: ${currentSelector}`);
                    elementInfo = await page.evaluate((selector) => {
                        const element = document.querySelector(selector);
                        return {
                            outerHTML: element.outerHTML,
                            tagName: element.tagName,
                            id: element.id,
                            className: element.className,
                            attributes: Array.from(element.attributes).map(attr => ({
                                name: attr.name,
                                value: attr.value
                            })),
                            boundingBox: element.getBoundingClientRect(),
                            foundWith: selector
                        };
                    }, currentSelector);
                    break;
                }
            } catch (error) {
                log(`Selector "${currentSelector}" check failed:`, error.message);
            }
        }

        if (!elementInfo) {
            const debugInfo = await page.evaluate(() => {
                const allElements = document.querySelectorAll('*');
                return {
                    bodyClasses: document.body.className,
                    mainContent: document.body.innerHTML.substring(0, 1000),
                    elementCount: allElements.length,
                    interestingElements: Array.from(allElements)
                        .filter(el => {
                            const className = el.className?.toString() || '';
                            const id = el.id || '';
                            return className.includes('game') || 
                                   id.includes('game') || 
                                   el.tagName === 'CANVAS';
                        })
                        .map(el => ({
                            tagName: el.tagName,
                            className: el.className,
                            id: el.id,
                            dimensions: el.getBoundingClientRect()
                        }))
                };
            });

            log('Page analysis:', {
                url: sanitizedUrl,
                pageTitle: await page.title(),
                elementCount: debugInfo.elementCount,
                interestingElements: debugInfo.interestingElements
            });

            await browser.close();
            return { error: 'No matching element found', debugInfo };
        }

        await browser.close();
        return elementInfo;

    } catch (error) {
        await browser.close();
        return { error: error.message };
    }
}

// Handle command line arguments
const url = process.argv[2];
const selector = process.argv[3];

if (url && selector) {
    extractDom(url, selector)
        .then(result => {
            // Only output the JSON result to stdout
            process.stdout.write(JSON.stringify(result));
        })
        .catch(error => {
            // Output errors as JSON to stdout
            process.stdout.write(JSON.stringify({ error: error.message }));
            process.exit(1);
        });
}

export { extractDom }; 