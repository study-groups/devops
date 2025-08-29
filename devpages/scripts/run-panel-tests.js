const { chromium } = require('playwright');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const indexPath = path.join(projectRoot, 'client', 'index.html');
const APP_URL = `file://${indexPath}`;
const TIMEOUT = 30000; // 30 seconds

async function runPanelTests() {
    console.log(`🚀 Starting panel regression test against ${APP_URL}...`);
    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
        });
        const context = await browser.newContext();
        const page = await context.newPage();

        // Capture console logs from the page
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            // Filter out noisy Redux logger messages for cleaner output
            if (!text.includes('Action:')) {
                console.log(`[Browser Console] ${type.toUpperCase()}: ${text}`);
            }
        });

        console.log(`Navigating to page...`);
        await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

        console.log('Waiting for application to be ready...');
        await page.waitForFunction('window.APP && window.APP.bootloader.phase === "ready"', { timeout: TIMEOUT });

        console.log('✅ Application is ready. Running panel health check...');
        const healthCheckResult = await page.evaluate(() => window.APP.testing.panelHealthCheck());

        if (!healthCheckResult) {
            throw new Error('Panel health check failed. See browser console output for details.');
        }
        console.log('✅ Health check passed.');

        console.log('Running full panel test suite...');
        const testResults = await page.evaluate(() => window.APP.testing.runAllTests());
        
        const failedTests = testResults.filter(r => r.status === 'FAIL');

        if (failedTests.length > 0) {
            console.error(`\n❌ ${failedTests.length} panel test(s) failed:`);
            failedTests.forEach(test => {
                console.error(`  - ${test.name}: ${test.error}`);
            });
            throw new Error('Panel regression test failed.');
        }

        console.log(`\n✅ All ${testResults.length} panel tests passed!`);

    } catch (error) {
        console.error(`\n🚨 An error occurred during the test run: ${error.message}`);
        process.exit(1); // Exit with a non-zero code to indicate failure
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

runPanelTests();
