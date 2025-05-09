import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { analyzeDomStructure } from '../lib/analyzers/domAnalyzer.mjs';
import { generateReport } from '../lib/reportGenerator.mjs';

const BASE_DIR = 'pbase/playwright/test-results';
const SCREENSHOTS_DIR = `${BASE_DIR}/screenshots`;
const TIMELINE_DIR = `${BASE_DIR}/timeline`;
const REPORTS_DIR = 'pbase/playwright/reports';

// Function to ensure a directory exists
function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function analyzeDomStructureWithRetries(url, options, retries = 3, delay = 1000) {
    let result;
    for (let attempt = 0; attempt < retries; attempt++) {
        result = await analyzeDomStructure(url, options);
        if (result.meta.screenshot) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    return result;
}

// Function to capture a screenshot
async function captureScreenshot(page, name) {
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved: ${screenshotPath}`);
}

function formatMemoryStats(meta) {
    const { memory } = meta.test.system;

    const formatBytes = (bytes) => {
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        return `${Math.round(value * 10) / 10}${units[unitIndex]}`;
    };

    const totalMem = formatBytes(memory.total);
    const freeMem = formatBytes(memory.free);
    const residentMem = formatBytes(memory.process.rss);
    const heapTotal = formatBytes(memory.process.heapTotal);
    const heapUsed = formatBytes(memory.process.heapUsed);

    console.log(`Machine: ${freeMem} free of ${totalMem} total`);
    console.log(`Process: ${heapTotal} heap of ${residentMem} resident memory`);
    console.log(`In use:  ${heapUsed} for code and stack`);
}

test.use({ trace: 'on' });


test('analyze grid-ranger with timeline trace', async ({ page, context }) => {
    ensureDirSync(SCREENSHOTS_DIR);
    ensureDirSync(TIMELINE_DIR);
    ensureDirSync(REPORTS_DIR);

    const url = 'https://pixeljamarcade.com/play/grid-ranger/';
    
    console.log('Navigating to URL...');
    
    await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000  // 10 seconds timeout
    });

    console.log('Initial page load complete, waiting for game container...');
    
    try {
        await page.waitForSelector('.game-container', {
            state: 'attached',
            timeout: 10000  // 10 seconds timeout
        });
        console.log('Game container found');
    } catch (error) {
        console.error('Failed to find game container:', error);
        throw error;
    }

    await captureScreenshot(page, 'domcontentloaded');
    console.log('Starting DOM structure analysis...');

    const result = await analyzeDomStructureWithRetries(url, {
        screenshotPath: SCREENSHOTS_DIR
    });
    
    // Log complete metadata
    console.log('\n=== Complete DOM Analysis Results ===');
    console.log(JSON.stringify(result.meta, null, 2));
    formatMemoryStats(result.meta);
    console.log('===================================\n');
    
    console.log('Generating report...');
    const reportPath = await generateReport(result, {
        reportsDir: REPORTS_DIR,
        metaData: {
            ...result.meta,
            timeline: fs.readdirSync(TIMELINE_DIR).map(file => path.join(TIMELINE_DIR, file))
        }
    });

    
    console.log('Report generated at:', reportPath);
});

test('click button in game-container', async ({ page }) => {
    const url = 'https://pixeljamarcade.com/play/grid-ranger/';
    
    console.log('Navigating to URL...');
    
    await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000  // 10 seconds timeout
    });

    console.log('Initial page load complete, waiting for game container...');
    
    try {
        await page.waitForSelector('.game-container', {
            state: 'attached',
            timeout: 10000  // 10 seconds timeout
        });
        console.log('Game container found');
    } catch (error) {
        console.error('Failed to find game container:', error);
        throw error;
    }

    // Click the only button in the game container
    const button = await page.$('.game-container button');
    if (button) {
        await button.click();
        console.log('Button clicked');
    } else {
        console.error('Button not found in game container');
    }
});




const logTime = (step, start) => console.log(`${step} took ${Date.now() - start}ms`);

test('click buttons and take screenshot', async ({ page }) => {
    const startTime = Date.now();
    console.log('Navigating to URL...');
    const navStart = Date.now();
    await page.goto('https://pixeljamarcade.com/play/grid-ranger/', { waitUntil: 'domcontentloaded' });
    logTime('Page load', navStart);

    const snapshotStart = Date.now();
    await page.screenshot({ path: 'pre-click-screenshot.png', fullPage: true });
    logTime('Pre-click snapshot', snapshotStart);

    const containerStart = Date.now();
    const gameContainer = await page.waitForSelector('.game-container', { state: 'attached', timeout: 5000 });
    logTime('Wait for game container', containerStart);

    const buttonStart = Date.now();
    const button = await gameContainer.$('button');
    await button.click();
    logTime('First button click', buttonStart);

    const iframeStart = Date.now();
    const iframeElement = await page.waitForSelector('.game-iframe', { state: 'attached', timeout: 5000 });
    logTime('Wait for iframe', iframeStart);

    const iframe = await iframeElement.contentFrame();
    const iframeButtonStart = Date.now();
    const iframeButton = iframe.locator('#start');
    await iframeButton.click();
    logTime('Iframe button click', iframeButtonStart);

    const waitStart = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1000));
    logTime('Wait after iframe button click', waitStart);

    const finalSnapshotStart = Date.now();
    await page.screenshot({ path: 'final-screenshot.png', fullPage: true });
    logTime('Final snapshot', finalSnapshotStart);

    const closeStart = Date.now();
    await page.close();
    logTime('Page close', closeStart);

    logTime('Total test time', startTime);
});

