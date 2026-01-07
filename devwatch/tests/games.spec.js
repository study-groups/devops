// tests/games.spec.js - Standardized test structure
const { test, expect } = require('@playwright/test');

// Test paths - can be extended via configuration
const paths = [
  '/games',
  '/games/cornhole-hero', 
  '/games/cheap-golf'
];

// Optional: Load additional paths from configuration
const additionalPaths = process.env.PLAYWRIGHT_ADDITIONAL_PATHS 
  ? process.env.PLAYWRIGHT_ADDITIONAL_PATHS.split(',')
  : [];

const allPaths = [...paths, ...additionalPaths];

for (const path of allPaths) {
  test.describe(`Page: ${path}`, () => {
    test(`should load and contain main content`, async ({ page, baseURL }) => {
      const testStart = Date.now();
      
      // Navigate to page
      await page.goto(baseURL + path, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Basic smoke tests
      await expect(page).toHaveTitle(/Pixeljam Arcade/i);
      await expect(page.locator('main')).toBeVisible();

      // Game-specific content checks
      if (path.includes('/games/')) {
        const gameName = path.split('/').pop();
        // Verify game-specific elements exist
        await expect(page.locator(`[data-game="${gameName}"], iframe, canvas, .game-container`)).toBeVisible();
      } else if (path === '/games') {
        // Verify games listing
        await expect(page.locator('.game-item, .game-card, [data-game]')).toBeVisible();
      }

      // Performance measurement for admin interface
      const duration = Date.now() - testStart;
      if (process.env.PLAYWRIGHT_MEASURE_PERFORMANCE) {
        console.log(`Performance: ${path} loaded in ${duration}ms`);
      }

      // Screenshot if enabled
      if (process.env.TAKE_SCREENSHOTS) {
        const envName = new URL(baseURL).hostname.split('.')[0];
        await page.screenshot({ 
          path: `screenshots/${envName}${path.replace(/\//g, '_')}.png`,
          fullPage: true 
        });
      }
    });

    // Optional: Performance-focused test
    test(`should load ${path} with good performance`, async ({ page, baseURL }) => {
      const metrics = [];
      
      // Start performance measurement
      await page.goto(baseURL + path, { waitUntil: 'domcontentloaded' });
      
      // Measure key metrics
      const loadTime = await page.evaluate(() => performance.now());
      const ttfb = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation ? navigation.responseStart - navigation.requestStart : 0;
      });

      // Performance assertions
      expect(loadTime).toBeLessThan(5000); // 5 second max load time
      expect(ttfb).toBeLessThan(2000); // 2 second max TTFB

      // Log for admin interface if enabled
      if (process.env.PLAYWRIGHT_LOG_METRICS) {
        console.log(JSON.stringify({
          path,
          baseURL,
          loadTime: Math.round(loadTime),
          ttfb: Math.round(ttfb),
          timestamp: Date.now()
        }));
      }
    });
  });
}