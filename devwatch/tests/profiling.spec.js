// metrics-with-cpu-profile.spec.js
const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('LCP + post-LCP CPU profile', async ({}) => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture LCP before any profiling (minimize bias)
  await page.addInitScript(() => {
    let last;
    try {
      const po = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) last = e;
        window.__lcp = last ? { value: last.startTime, size: last.size, url: last.url } : null;
      });
      po.observe({ type: 'largest-contentful-paint', buffered: true });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden')
          window.__lcp = last ? { value: last.startTime, size: last.size, url: last.url } : window.__lcp ?? null;
      }, { once: true });
    } catch {}
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // Read LCP (ms)
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find(e => e.name === 'first-contentful-paint')?.startTime ?? null;
    const lcp = window.__lcp?.value ?? null;
    return {
      lcp: lcp,
      fcp: fcp,
      ttfb: (nav && Number.isFinite(nav.responseStart) && Number.isFinite(nav.requestStart))
              ? nav.responseStart - nav.requestStart : null
    };
  });

  // Start CPU profiling AFTER LCP is recorded to avoid skewing LCP
  const client = await context.newCDPSession(page);
  await client.send('Profiler.enable');
  // Optional: larger interval reduces overhead; default ~1000µs
  await client.send('Profiler.setSamplingInterval', { interval: 2000 }); // microseconds
  await client.send('Profiler.start');

  // Do workload you want to profile (e.g., route change, interaction)
  await page.evaluate(() => {
    // example workload
    requestAnimationFrame(() => {
      for (let i = 0; i < 5e6; i++) Math.sqrt(i);
    });
  });
  await page.waitForTimeout(2000);

  const { profile } = await client.send('Profiler.stop');
  await browser.close();

  // Persist artifacts
  const OUT = process.env.PW_DIR ?? './pw-reports';
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 2));
  fs.writeFileSync(path.join(OUT, 'cpu-profile.json'), JSON.stringify(profile)); // importable in Chrome DevTools

  // Basic constraint on LCP if present
  if (metrics.lcp != null) expect(metrics.lcp).toBeLessThan(4000);
});
