import { test } from '@playwright/test';

test('click button inside iframe and debug WebGL and audio', async () => {
    const browser = await playwright.chromium.launch({
        headless: false, // Run in headed mode for debugging
        args: [
            '--use-gl=desktop',
            '--enable-webgl',
            '--ignore-gpu-blacklist',
            '--autoplay-policy=no-user-gesture-required'
        ]
    });

    const page = await browser.newPage();

    // Log messages from the browser console
    page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));

    console.log('Navigating to URL...');
    await page.goto('https://pixeljamarcade.com/play/grid-ranger/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });

    console.log('Initial page load complete, waiting for game container...');
    const gameContainer = await page.waitForSelector('.game-container', {
        state: 'attached',
        timeout: 15000
    });

    console.log('Game container found.');
    const button = await gameContainer.$('button');
    if (!button) {
        throw new Error('Game start button not found');
    }

    await button.click();
    console.log('Game start button clicked.');

    const iframeElement = await page.waitForSelector('.game-iframe', {
        state: 'attached',
        timeout: 15000
    });
    console.log('Iframe appeared.');

    const iframe = await iframeElement.contentFrame();
    if (!iframe) {
        throw new Error('Could not find iframe content frame');
    }

    // Debug WebGL and audio inside the iframe
    await iframe.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) console.error('No canvas found for PixiJS');
        else {
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            console.log(gl ? 'WebGL initialized successfully' : 'WebGL failed to initialize');
        }
        const audioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioContext) console.error('No AudioContext found');
        else console.log(`AudioContext state: ${(new audioContext()).state}`);
    });

    console.log('Test complete.');
    await browser.close(); // Ensure the browser closes at the end
});
