const { test, expect } = require('@playwright/test');
const path = require('path');
const { PData } = require('../pdata/PData.js');

// Initialize PData with configuration
const pdataConfig = {
    systemRoots: {
        // Add any necessary system root configurations
    }
};
const pdata = new PData(pdataConfig);

test.describe('Panel Sidebar Authentication', () => {
    let authToken;

    // Setup: Authenticate before tests
    test.beforeAll(async () => {
        try {
            // Attempt to create a token for test user
            // You'll need to replace these with actual test credentials
            authToken = await pdata.createToken('testuser', 'testpassword');
            
            if (!authToken) {
                // If token creation fails, try creating the user first
                await pdata.addUser('testuser', 'testpassword', ['user']);
                authToken = await pdata.createToken('testuser', 'testpassword');
            }
            
            if (!authToken) {
                throw new Error('Failed to create authentication token');
            }
        } catch (error) {
            console.error('Authentication setup failed:', error);
            throw error;
        }
    });

    test('renders with correct tabs', async ({ page }) => {
        // Load the page with sidebar
        await page.goto('file://' + path.join(__dirname, '../client/sidebar-test.html'));
        
        // Inject authentication token into the page context
        await page.evaluate((token) => {
            // Store token in localStorage or a global variable
            localStorage.setItem('authToken', token);
            // You might also want to set up a global auth state
            window.authState = { token, isAuthenticated: true };
        }, authToken);
        
        // Select tab buttons
        const tabButtons = await page.$$('.tab-button');
        
        // Verify tab count and labels
        expect(tabButtons).toHaveLength(3);
        
        const expectedTabs = ['Settings', 'Debug', 'Publish'];
        for (let i = 0; i < tabButtons.length; i++) {
            const tabText = await tabButtons[i].textContent();
            expect(tabText).toBe(expectedTabs[i]);
        }
        
        // Take screenshot for visual verification
        await page.screenshot({ 
            path: path.join(__dirname, '__screenshots__/sidebar-tabs.png') 
        });
    });

    test('tab switching works', async ({ page }) => {
        await page.goto('file://' + path.join(__dirname, '../client/sidebar-test.html'));
        
        // Inject authentication token
        await page.evaluate((token) => {
            localStorage.setItem('authToken', token);
            window.authState = { token, isAuthenticated: true };
        }, authToken);
        
        // Click Debug tab
        await page.click('button[data-tag="debug"]');
        
        // Verify active state
        const activeTab = await page.$('.tab-button.active');
        const activeTabText = await activeTab.textContent();
        expect(activeTabText).toBe('Debug');
        
        // Take screenshot
        await page.screenshot({ 
            path: path.join(__dirname, '__screenshots__/sidebar-debug-tab.png') 
        });
    });

    // Cleanup: Validate or remove test user if needed
    test.afterAll(async () => {
        try {
            // Optional: Clean up test user
            await pdata.deleteUser('testuser');
        } catch (error) {
            console.warn('Cleanup failed:', error);
        }
    });
});
