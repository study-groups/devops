// playwright.config.js - CONSOLIDATED
const { defineConfig, devices } = require('@playwright/test');
const { expect } = require('@playwright/test');
const path = require('path');

// Strict check for the custom data directory environment variable
if (!process.env.PW_DIR) {
  throw new Error(
    'CRITICAL: The PW_DIR environment variable is not set. ' +
    'This variable is required to specify the root directory for all Playwright test data, reports, and results. ' +
    'Please set it before running tests. Example: export PW_DIR="/path/to/your/data/dir"'
  );
}

// Configure snapshot paths to be stored alongside the test files
expect.configure({
  snapshotPath: ({ testPath, snapshotName }) =>
    path.join(path.dirname(testPath), '__snapshots__', snapshotName)
});

// Environment-aware configuration
const isCI = !!process.env.CI;
const useLocalServer = process.env.PLAYWRIGHT_USE_LOCAL_SERVER === 'true';

// Environment definitions for remote testing
const ENVIRONMENTS = {
  dev: 'https://dev.pixeljamarcade.com',
  staging: 'https://staging.pixeljamarcade.com',
  prod: 'https://pixeljamarcade.com'
};

// Environment selection precedence:
// 1) Local server flag
// 2) Named environment via PLAYWRIGHT_TARGET_ENV (dev|staging|prod|local)
// 3) Explicit URL override via PLAYWRIGHT_TARGET_URL (custom)
// 4) All default environments
const targetEnvName = (process.env.PLAYWRIGHT_TARGET_ENV || '').toLowerCase();
const adminTargetUrl = process.env.PLAYWRIGHT_TARGET_URL;
let selectedEnvironments;

if (useLocalServer || targetEnvName === 'local') {
  selectedEnvironments = { local: 'http://localhost:9324' };
} else if (targetEnvName && Object.prototype.hasOwnProperty.call(ENVIRONMENTS, targetEnvName)) {
  selectedEnvironments = { [targetEnvName]: ENVIRONMENTS[targetEnvName] };
} else if (adminTargetUrl) {
  selectedEnvironments = { custom: adminTargetUrl };
} else {
  selectedEnvironments = ENVIRONMENTS;
}

module.exports = defineConfig({
  // Playwright's built-in web server management
  webServer: useLocalServer ? {
    command: 'node server/index.js',
    url: 'http://localhost:9324',
    reuseExistingServer: !isCI,
    timeout: 30 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  } : undefined,

  timeout: 60_000,
  
  use: {
    screenshot: process.env.TAKE_SCREENSHOTS ? 'on' : 'off',
    video: 'off', 
    trace: process.env.CAPTURE_TRACES ? 'on' : 'off',
    actionTimeout: 15_000,
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    contextOptions: {
      recordHar: process.env.CAPTURE_HAR ? { path: 'har' } : undefined,
    }
    // baseURL is now set per-project
  },
  
  // Dynamic matrix: environment × browser combinations
  projects: [
    ...Object.entries(selectedEnvironments).flatMap(([envName, baseURL]) => [
      {
        name: `${envName}-chrome-desktop`,
        use: {
          ...devices['Desktop Chrome'],
          baseURL,
        },
      },
      {
        name: `${envName}-firefox-desktop`, 
        use: {
          ...devices['Desktop Firefox'],
          baseURL,
        },
      },
      {
        name: `${envName}-safari-desktop`,
        use: {
          ...devices['Desktop Safari'],
          baseURL,
        },
      },
      {
        name: `${envName}-iphone-mobile`,
        use: {
          ...devices['iPhone 12'],
          baseURL,
        },
      },
      {
        name: `${envName}-android-mobile`,
        use: {
          ...devices['Pixel 5'],
          baseURL,
        },
      },
    ]),
  ],
  
  reporter: [
    ['list'],
    ['./reporters/metrics-reporter.js'],
    ['html', { 
      outputFolder: `${process.env.PW_DIR}/reports`,
      open: 'never' 
    }],
    ['./reporters/admin-reporter.js'] // Custom reporter for admin interface
  ],
  
  outputDir: `${process.env.PW_DIR}/test-results`,
});
