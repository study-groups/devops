// tests/metrics.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Basic Metrics for Home Page', () => {
  test('collect LCP + baseline metrics', async ({ page }) => {
    // Track console errors
    const consoleErrors = [];
    page.on('console', m => m.type() === 'error' && consoleErrors.push(m.text()));

    // Install an LCP observer BEFORE any navigation
    await page.addInitScript(() => {
      (function () {
        let lcp;
        const po = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // keep the last candidate; it is the LCP at page hide
            lcp = entry;
          }
          // persist on each callback in case the page never hides
          window.__lcp = lcp ? { value: lcp.startTime, size: lcp.size, url: lcp.url } : null;
        });
        try { po.observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
        // freeze LCP on visibility change
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            window.__lcp = lcp ? { value: lcp.startTime, size: lcp.size, url: lcp.url } : window.__lcp ?? null;
          }
        }, { once: true });
      })();
    });

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    expect(response.status()).toBe(200);

    // Baseline metrics from Nav/Paint Timing + LCP from init script
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paints = performance.getEntriesByType('paint');
      const fp = paints.find(e => e.name === 'first-paint')?.startTime ?? null;
      const fcp = paints.find(e => e.name === 'first-contentful-paint')?.startTime ?? null;
      const lcp = (window.__lcp && typeof window.__lcp.value === 'number') ? window.__lcp.value : null;

      // Prefer requestStart for TTFB; fetchStart can include cache/DNS/TLS
      const ttfb = nav && Number.isFinite(nav.responseStart) && Number.isFinite(nav.requestStart)
        ? nav.responseStart - nav.requestStart
        : null;

      return {
        ttfb,                                   // ms
        domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.fetchStart : null,
        pageLoadTime: nav ? nav.loadEventEnd - nav.fetchStart : null,
        firstPaint: fp,
        firstContentfulPaint: fcp,
        largestContentfulPaint: lcp,            // ms
        lcpElementURL: window.__lcp?.url ?? null,
        dnsLookup: nav ? nav.domainLookupEnd - nav.domainLookupStart : null,
        tcpConnect: nav ? nav.connectEnd - nav.connectStart : null,
        serverResponse: nav ? nav.responseEnd - nav.responseStart : null,
      };
    });

    // Generate report URL
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportUrl = `/reports/index.html?t=${timestamp}`;

    // Log single-number KPI with report link
    console.log(`LCP(ms): ${metrics.largestContentfulPaint ?? 'null'} - Report: ${reportUrl}`);

    // Also log context metrics
    console.log(`TTFB(ms): ${metrics.ttfb ?? 'null'}`);
    console.log(`FCP(ms): ${metrics.firstContentfulPaint ?? 'null'}`);
    console.log(`Load(ms): ${metrics.pageLoadTime ?? 'null'}`);

    // Health thresholds (adjust as needed)
    if (metrics.largestContentfulPaint != null) {
      expect(metrics.largestContentfulPaint).toBeLessThan(4000);
    }
    if (metrics.ttfb != null) {
      expect(metrics.ttfb).toBeLessThan(5000);
    }

    // Basic checks
    await expect(page).toHaveTitle(/.*/);
    const bodyExists = await page.locator('body').count();
    expect(bodyExists).toBeGreaterThan(0);
    expect(consoleErrors).toHaveLength(0);

    // Save metrics directly to file for easy access
    try {
      const pwDir = process.env.PW_DIR || './pw-reports';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const runId = `metrics-${test.info().project.name}-${timestamp}`;
      
      const metricsWithMeta = {
        ...metrics,
        timestamp: new Date().toISOString(),
        testTitle: test.info().title,
        projectName: test.info().project.name,
        reportUrl: reportUrl,
        runId: runId
      };
      
      // Ensure directory exists
      fs.mkdirSync(pwDir, { recursive: true });
      
      // Save to latest-metrics.json (for backward compatibility)
      const latestPath = path.resolve(pwDir, 'latest-metrics.json');
      fs.writeFileSync(latestPath, JSON.stringify(metricsWithMeta, null, 2));
      
      // Also append to metrics.json array (for concurrent runs)
      const metricsArrayPath = path.resolve(pwDir, 'metrics.json');
      let metricsArray = [];
      try {
        if (fs.existsSync(metricsArrayPath)) {
          metricsArray = JSON.parse(fs.readFileSync(metricsArrayPath, 'utf8'));
        }
      } catch (e) {
        // Start fresh if file is corrupted
        metricsArray = [];
      }
      
      metricsArray.push(metricsWithMeta);
      
      // Keep only last 50 entries to prevent file from growing too large
      if (metricsArray.length > 50) {
        metricsArray = metricsArray.slice(-50);
      }
      
      fs.writeFileSync(metricsArrayPath, JSON.stringify(metricsArray, null, 2));
    } catch (error) {
      console.warn('Could not save metrics file:', error.message);
    }

    // Attach artifacts
    if (process.env.TAKE_SCREENSHOTS) {
      const png = await page.screenshot({ fullPage: true });
      await test.info().attach('homepage-screenshot', { body: png, contentType: 'image/png' });
    }
    await test.info().attach('performance-metrics', {
      body: JSON.stringify({...metrics, reportUrl}, null, 2),
      contentType: 'application/json',
    });
  });
});
