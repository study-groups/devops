// reporters/metrics-reporter.js - Custom reporter for LCP and performance metrics
const fs = require('fs/promises');
const path = require('path');

class MetricsReporter {
  constructor(options = {}) {
    const pwDir = options.pwDir || process.env.PW_DIR;
    
    if (!pwDir) {
      console.error('ERROR: PW_DIR environment variable is not set. MetricsReporter is disabled.');
      this.metricsFile = null;
    } else {
      this.metricsFile = path.join(pwDir, 'metrics.json');
    }
    
    this.metrics = [];
  }

  onTestEnd(test, result) {
    if (!this.metricsFile) return;

    // Only process metrics.spec.js tests
    if (!test.location.file.includes('metrics.spec.js')) return;

    // Extract LCP from attachments
    let lcp = null;
    let ttfb = null;
    let fcp = null;
    let pageLoadTime = null;
    let reportUrl = null;

    for (const attachment of result.attachments) {
      if (attachment.name === 'performance-metrics') {
        try {
          const metricsData = JSON.parse(attachment.body.toString());
          lcp = metricsData.largestContentfulPaint;
          ttfb = metricsData.ttfb;
          fcp = metricsData.firstContentfulPaint;
          pageLoadTime = metricsData.pageLoadTime;
        } catch (error) {
          console.warn('Could not parse performance metrics:', error.message);
        }
      }
    }

    // Extract LCP from stdout if available
    if (lcp === null && result.stdout) {
      const stdout = result.stdout.join('\n');
      const lcpMatch = stdout.match(/LCP\(ms\): ([\d.]+)/);
      if (lcpMatch) {
        lcp = parseFloat(lcpMatch[1]);
      }

      const ttfbMatch = stdout.match(/TTFB\(ms\): ([\d.]+)/);
      if (ttfbMatch) {
        ttfb = parseFloat(ttfbMatch[1]);
      }

      const fcpMatch = stdout.match(/FCP\(ms\): ([\d.]+)/);
      if (fcpMatch) {
        fcp = parseFloat(fcpMatch[1]);
      }

      const loadMatch = stdout.match(/Load\(ms\): ([\d.]+)/);
      if (loadMatch) {
        pageLoadTime = parseFloat(loadMatch[1]);
      }
    }

    // Generate report URL
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    reportUrl = `/reports/index.html?t=${timestamp}`;

    const metric = {
      timestamp: new Date().toISOString(),
      testTitle: test.title,
      projectName: test.parent.project().name,
      status: result.status,
      lcp: lcp,
      ttfb: ttfb,
      fcp: fcp,
      pageLoadTime: pageLoadTime,
      reportUrl: reportUrl,
      duration: result.duration
    };

    this.metrics.push(metric);
  }

  async onEnd() {
    if (!this.metricsFile || this.metrics.length === 0) return;

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.metricsFile), { recursive: true });
      
      // Load existing metrics
      let existingMetrics = [];
      try {
        const existing = await fs.readFile(this.metricsFile, 'utf8');
        existingMetrics = JSON.parse(existing);
      } catch (e) {
        // File doesn't exist yet, start fresh
      }

      // Append new metrics
      existingMetrics.push(...this.metrics);

      // Keep only last 100 results to prevent infinite growth
      if (existingMetrics.length > 100) {
        existingMetrics = existingMetrics.slice(-100);
      }

      // Write updated metrics
      await fs.writeFile(this.metricsFile, JSON.stringify(existingMetrics, null, 2));

      // Output just the LCP metrics for easy consumption
      const lcpMetrics = this.metrics
        .filter(m => m.lcp !== null)
        .map(m => ({
          lcp: m.lcp,
          timestamp: m.timestamp,
          project: m.projectName,
          status: m.status,
          reportUrl: m.reportUrl
        }));

      if (lcpMetrics.length > 0) {
        console.log('\n🎯 LCP Metrics:');
        lcpMetrics.forEach(m => {
          const statusIcon = m.status === 'passed' ? '✅' : '❌';
          console.log(`${statusIcon} ${m.project}: ${m.lcp}ms LCP - Report: ${m.reportUrl}`);
        });

        // Output simple JSON for scripting
        process.stdout.write(JSON.stringify(lcpMetrics, null, 2));
      }

    } catch (error) {
      console.error('Failed to write metrics:', error);
    }
  }
}

module.exports = MetricsReporter;
