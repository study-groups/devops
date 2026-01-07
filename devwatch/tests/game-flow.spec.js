const { test, expect } = require('@playwright/test');

// Get the current baseURL for dynamic test descriptions
const useLocalServer = process.env.PLAYWRIGHT_USE_LOCAL_SERVER === 'true';
const targetEnvironment = process.env.PLAYWRIGHT_TARGET_ENV || 'dev';
const testTarget = useLocalServer ? 'localhost:9324 (local admin)' : `${targetEnvironment}.pixeljamarcade.com`;

test.describe(`Game Flow Testing - ${testTarget}`, () => {
  
  test('should navigate through home -> games -> cornhole-hero and cheap-golf', async ({ page, browserName }) => {
    const testId = Date.now();
    const screenshots = [];
    
    try {
      // Step 1: Navigate to home page
      console.log(`[${testId}] Starting game flow test - ${browserName}`);
      const startTime = Date.now();
      
      const homeResponse = await page.goto('/', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      expect(homeResponse.status()).toBe(200);
      console.log(`[${testId}] Home page loaded successfully`);
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Step 2: Navigate to games page
      await page.goto('/games', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      console.log(`[${testId}] Games page loaded`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Step 3: Test Cornhole Hero
      const cornholeResponse = await page.goto('/play/cornhole-hero', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      expect(cornholeResponse.status()).toBe(200);
      console.log(`[${testId}] Cornhole Hero loaded successfully`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check for game canvas or main game element
      const gameElement = page.locator('canvas, #game, .game-container').first();
      await expect(gameElement).toBeVisible({ timeout: 15000 });
      
      // Step 4: Test Cheap Golf
      const golfResponse = await page.goto('/play/cheap-golf', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      expect(golfResponse.status()).toBe(200);
      console.log(`[${testId}] Cheap Golf loaded successfully`);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Check for game canvas or main game element
      const golfGameElement = page.locator('canvas, #game, .game-container').first();
      await expect(golfGameElement).toBeVisible({ timeout: 15000 });
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      console.log(`[${testId}] Complete flow test completed in ${totalDuration}ms`);
      
      // Log success metrics
      const metrics = {
        testId,
        browser: browserName,
        success: true,
        totalDuration,
        timestamp: new Date().toISOString(),
        pages: ['home', 'games', 'cornhole-hero', 'cheap-golf']
      };
      
      // Attach metrics to test report
      await test.info().attach('metrics', { 
        body: JSON.stringify(metrics, null, 2), 
        contentType: 'application/json' 
      });
      
    } catch (error) {
      console.error(`[${testId}] Test failed:`, error.message);
      
      // Take screenshot on error (only if screenshots are enabled)
      if (process.env.TAKE_SCREENSHOTS) {
        const errorScreenshot = await page.screenshot({ 
          fullPage: true,
          type: 'png'
        });
        
        await test.info().attach('error-screenshot', { 
          body: errorScreenshot, 
          contentType: 'image/png' 
        });
      }
      
      throw error;
    }
  });

  test('should perform quick health check on all target pages', async ({ page, browserName }) => {
    const testId = Date.now();
    const pages = ['/', '/games', '/play/cornhole-hero', '/play/cheap-golf'];
    const results = [];
    
    console.log(`[${testId}] Starting health check - ${browserName}`);
    
    for (const targetPage of pages) {
      const startTime = Date.now();
      
      try {
        const response = await page.goto(targetPage, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        
        const loadTime = Date.now() - startTime;
        const status = response.status();
        
        results.push({
          page: targetPage,
          status,
          loadTime,
          success: status === 200,
          timestamp: new Date().toISOString()
        });
        
        console.log(`[${testId}] ${targetPage}: ${status} (${loadTime}ms)`);
        
        if (status !== 200) {
          console.warn(`[${testId}] Unexpected status for ${targetPage}: ${status}`);
        }
        
      } catch (error) {
        results.push({
          page: targetPage,
          status: 0,
          loadTime: Date.now() - startTime,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        console.error(`[${testId}] Failed to load ${targetPage}:`, error.message);
      }
    }
    
    // Attach results to test report
    await test.info().attach('health-check-results', { 
      body: JSON.stringify(results, null, 2), 
      contentType: 'application/json' 
    });
    
    // Ensure at least some pages loaded successfully
    const successfulPages = results.filter(r => r.success);
    expect(successfulPages.length).toBeGreaterThan(0);
    
    console.log(`[${testId}] Health check completed: ${successfulPages.length}/${results.length} pages successful`);
  });
});