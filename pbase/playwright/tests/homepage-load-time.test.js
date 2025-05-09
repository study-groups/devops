import { test, expect } from '@playwright/test';

const url = 'https://pixeljamarcade.com/';
const fastTimeout = { timeout: 30000 }; // Timeout for page loading

// Helper function to log and measure load time with screenshot attachment
const measureLoadTime = async (page, configName, testInfo) => {
    const startTime = Date.now();
    await page.goto(url, { waitUntil: 'load', ...fastTimeout });
    const loadTime = Date.now() - startTime;
    console.log(`[${configName}] Page load time: ${loadTime}ms`);

    // Capture screenshot and attach to report
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    testInfo.attach(`${configName} screenshot`, {
        body: screenshotBuffer,
        contentType: 'image/png',
    });

    console.log(`[${configName}] Screenshot attached to report.`);
    return loadTime;
};

// Desktop configurations
const desktopConfigs = [
    { name: 'Desktop Chromium', browser: 'chromium' },
    { name: 'Desktop Firefox', browser: 'firefox' },
    { name: 'Desktop WebKit', browser: 'webkit' },
];

// Mobile configurations
const mobileConfigs = [
    {
        name: 'Mobile Chromium',
        browser: 'chromium',
        viewport: { width: 375, height: 667 }, // iPhone 6/7/8 dimensions
        isMobile: true,
    },
    {
        name: 'Mobile Firefox',
        browser: 'firefox',
        viewport: { width: 375, height: 667 }, // iPhone 6/7/8 dimensions
        isMobile: true,
    },
    {
        name: 'Mobile WebKit',
        browser: 'webkit',
        viewport: { width: 375, height: 667 }, // iPhone 6/7/8 dimensions
        isMobile: true,
    },
];

test.describe('Measure load time and attach screenshots for PixelJam Arcade', () => {
    [...desktopConfigs, ...mobileConfigs].forEach((config) => {
        test(config.name, async ({ browser }, testInfo) => {
            const context = await browser.newContext({
                viewport: config.viewport || { width: 1280, height: 720 },
                isMobile: config.isMobile || false,
                userAgent: config.isMobile
                    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
                    : undefined,
            });
            const page = await context.newPage();
            const loadTime = await measureLoadTime(page, config.name, testInfo);
            console.log(`[${config.name}] Load time: ${loadTime}ms`);
            await context.close();
        });
    });
});
