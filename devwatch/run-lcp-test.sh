#!/bin/bash
# Simple script to run LCP test and output only the LCP metrics

echo "Running LCP test..."
npx playwright test tests/metrics.spec.js --project=dev-chrome-desktop --reporter=./reporters/metrics-reporter.js > lcp-output.json 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ LCP test completed successfully"
    echo "📊 Latest metrics saved to: $PW_DIR/latest-metrics.json"
    echo "📋 Report output saved to: lcp-output.json"
else
    echo "❌ LCP test failed"
    exit 1
fi
