// lcp-reporter.js
// Prints exactly: {"lcp": <ms|null>, "pass": true|false}
const fs = require('fs');

class LcpReporter {
  onTestEnd(test, result) {
    let lcp = null;
    for (const a of result.attachments || []) {
      if (a.name !== 'performance-metrics') continue;
      const buf = a.body ? (Buffer.isBuffer(a.body) ? a.body : Buffer.from(a.body))
                         : a.path ? fs.readFileSync(a.path) : null;
      if (!buf) continue;
      try {
        const json = JSON.parse(buf.toString('utf-8'));
        if (typeof json.largestContentfulPaint === 'number') lcp = json.largestContentfulPaint;
      } catch {}
    }
    const pass = result.status === 'passed';
    // Single-line JSON to stdout
    process.stdout.write(JSON.stringify({ lcp, pass }) + '\n');
  }
}
module.exports = LcpReporter;
