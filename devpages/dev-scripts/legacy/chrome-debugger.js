#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function connectChrome() {
    // Read token from PData
    const tokenPath = path.join(__dirname, '..', 'pdata', 'auth-token.json');
    let token;
    
    try {
        token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        
        // Check token expiration
        if (Date.now() > token.expires) {
            console.error('🚨 Token has expired. Generating new token.');
            throw new Error('Token expired');
        }
    } catch (error) {
        console.error('🔄 Could not read or validate token:', error.message);
        
        // Regenerate token script
        const { execSync } = require('child_process');
        execSync(`node ${__dirname}/generate-token.js`);
        
        // Re-read token
        token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    }

    // Launch browser with debugging
    const browser = await chromium.launch({
        headless: false,  // Show browser
        devtools: true,   // Open DevTools
        args: [
            `--remote-debugging-port=9222`,
            `--user-data-dir=/tmp/chrome-debug-profile`,
            `--no-first-run`,
            `--disable-extensions`
        ]
    });

    // Create a new page
    const context = await browser.newContext();
    const page = await context.newPage();

    // Load test page
    await page.goto('file://' + path.join(__dirname, '..', 'client', 'sidebar-test.html'));

    // Attach debugger and log events
    page.on('console', msg => console.log('🖥️ Console:', msg.text()));
    page.on('pageerror', error => console.error('❌ Page Error:', error));

    // Keep track of browser for potential cleanup
    return { browser, page, token };
}

// Continuous debugging loop
async function startDebugLoop() {
    console.log('🚀 Starting Chrome Debugger');
    
    let debugSession;
    try {
        debugSession = await connectChrome();
        
        console.log('🔐 Authentication Token:', debugSession.token.value);
        console.log('🌐 DevTools available at: http://localhost:9222');
        
        // Keep the process running
        await new Promise(() => {});
    } catch (error) {
        console.error('🔥 Debugging session failed:', error);
        
        // Optional: Retry mechanism
        if (debugSession && debugSession.browser) {
            await debugSession.browser.close();
        }
    }
}

// Run the debug loop
startDebugLoop().catch(console.error);
