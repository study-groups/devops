import { test } from '@playwright/test';

const games = {
  'rat-maze': 'https://pixeljamarcade.com/play/rat-maze/',
  'utopia-must-fall': 'https://pixeljamarcade.com/play/utopia-must-fall/',
  'cheap-golf': 'https://pixeljamarcade.com/play/cheap-golf/',
  'gamma-bros': 'https://pixeljamarcade.com/play/gamma-bros/',
  'last-horizon': 'https://pixeljamarcade.com/play/last-horizon/',
  'diff': 'https://pixeljamarcade.com/play/diff/',
  'cornhole': 'https://pixeljamarcade.com/play/cornhole/',
};

// Read environment variables
const gameToTest = process.env.GAME || 'all';
const browserToTest = process.env.BROWSER || 'all';
const isMobile = process.env.MOBILE === 'true';

// Select games to test
const selectedGames = gameToTest === 'all' ? Object.entries(games) : Object.entries(games).filter(([name]) => name === gameToTest);

// Configure browsers
const browsers = [
  { name: 'Chromium', browser: 'chromium' },
  { name: 'Firefox', browser: 'firefox' },
  { name: 'WebKit', browser: 'webkit' },
];
const selectedBrowsers = browserToTest === 'all' ? browsers : browsers.filter(b => b.browser === browserToTest);

test.describe.parallel('Game Load Time Tests', () => {
  selectedGames.forEach(([gameName, url]) => {
    test.describe(gameName, () => {
      selectedBrowsers.forEach(({ name, browser }) => {
        const config = {
          viewport: isMobile ? { width: 375, height: 667 } : { width: 1280, height: 720 },
          isMobile,
        };

        test(`${name} ${isMobile ? '(Mobile)' : '(Desktop)'}`, async ({ browser: playwrightBrowser }, testInfo) => {
          const context = await playwrightBrowser.newContext(config);
          const page = await context.newPage();
          const startTime = Date.now();
          await page.goto(url, { waitUntil: 'load' });
          const loadTime = Date.now() - startTime;

          // Attach screenshot
          const screenshotBuffer = await page.screenshot({ fullPage: true });
          testInfo.attach(`${gameName} ${name} screenshot`, {
            body: screenshotBuffer,
            contentType: 'image/png',
          });

          console.log(`[${gameName}] [${name}] Load time: ${loadTime}ms`);
          await context.close();
        });
      });
    });
  });
});
