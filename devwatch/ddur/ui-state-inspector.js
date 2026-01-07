const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// D2UR (Data-Driven UI Refinement) Inspector
class D2URInspector {
    constructor(options = {}) {
        this.baseDir = path.resolve(__dirname);
        this.loopsDir = path.join(this.baseDir, 'loops');
        this.resultsDir = path.join(this.baseDir, 'results');
        this.options = {
            targetSelectors: options.targetSelectors || [],
            captureFullPage: options.captureFullPage || false,
            captureComputedStyles: options.captureComputedStyles || true,
            captureAttributes: options.captureAttributes || true,
            logLevel: options.logLevel || 'info'
        };
    }

    // Utility method to log messages based on log level
    _log(message, level = 'info') {
        const levels = ['error', 'warn', 'info', 'debug'];
        if (levels.indexOf(level) <= levels.indexOf(this.options.logLevel)) {
            console.log(`[D2UR ${level.toUpperCase()}]: ${message}`);
        }
    }

    // Capture state of specific elements
    async captureElementState(page, selector) {
        return await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (!element) return null;

            // Capture comprehensive element state
            return {
                selector: sel,
                boundingBox: element.getBoundingClientRect(),
                computedStyles: window.getComputedStyle(element),
                attributes: Array.from(element.attributes).reduce((acc, attr) => {
                    acc[attr.name] = attr.value;
                    return acc;
                }, {}),
                innerText: element.innerText,
                innerHTML: element.innerHTML
            };
        }, selector);
    }

    // Main method to capture state snapshot
    async captureSnapshot(page, snapshotType = 'baseline') {
        this._log(`Capturing ${snapshotType} snapshot`);

        const snapshot = {
            timestamp: new Date().toISOString(),
            type: snapshotType,
            url: page.url(),
            viewport: await page.viewportSize(),
            elements: {}
        };

        // Capture state for each target selector
        for (const selector of this.options.targetSelectors) {
            snapshot.elements[selector] = await this.captureElementState(page, selector);
        }

        // Optional: capture full page screenshot
        if (this.options.captureFullPage) {
            const screenshotPath = path.join(this.loopsDir, `${snapshotType}-screenshot.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            snapshot.screenshotPath = screenshotPath;
        }

        // Write snapshot to file
        const snapshotPath = path.join(this.loopsDir, `${snapshotType}.json`);
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

        return snapshot;
    }

    // Compare two snapshots and generate a diff report
    compareSnapshots(baselineSnapshot, afterSnapshot) {
        const diffReport = {
            timestamp: new Date().toISOString(),
            changes: []
        };

        for (const selector in baselineSnapshot.elements) {
            const baseElement = baselineSnapshot.elements[selector];
            const afterElement = afterSnapshot.elements[selector];

            if (!afterElement) {
                diffReport.changes.push({
                    selector,
                    status: 'REMOVED',
                    details: 'Element no longer exists'
                });
                continue;
            }

            // Compare bounding box
            const boundingBoxChanges = this._compareBoundingBox(baseElement.boundingBox, afterElement.boundingBox);
            if (boundingBoxChanges.length > 0) {
                diffReport.changes.push({
                    selector,
                    type: 'boundingBox',
                    changes: boundingBoxChanges
                });
            }

            // Compare computed styles
            const styleChanges = this._compareComputedStyles(baseElement.computedStyles, afterElement.computedStyles);
            if (styleChanges.length > 0) {
                diffReport.changes.push({
                    selector,
                    type: 'styles',
                    changes: styleChanges
                });
            }
        }

        // Write diff report
        const diffReportPath = path.join(this.resultsDir, `diff-${Date.now()}.json`);
        fs.writeFileSync(diffReportPath, JSON.stringify(diffReport, null, 2));

        return diffReport;
    }

    // Helper method to compare bounding boxes
    _compareBoundingBox(base, after) {
        const changes = [];
        const properties = ['x', 'y', 'width', 'height', 'top', 'right', 'bottom', 'left'];
        
        properties.forEach(prop => {
            if (base[prop] !== after[prop]) {
                changes.push({
                    property: prop,
                    from: base[prop],
                    to: after[prop],
                    percentChange: ((after[prop] - base[prop]) / base[prop]) * 100
                });
            }
        });

        return changes;
    }

    // Helper method to compare computed styles
    _compareComputedStyles(base, after) {
        const changes = [];
        const stylesToCompare = [
            'width', 'height', 'minWidth', 'minHeight', 
            'maxWidth', 'maxHeight', 'padding', 'margin', 
            'fontSize', 'color', 'backgroundColor'
        ];

        stylesToCompare.forEach(style => {
            if (base[style] !== after[style]) {
                changes.push({
                    property: style,
                    from: base[style],
                    to: after[style]
                });
            }
        });

        return changes;
    }
}

// Playwright test using D2UR Inspector
test.describe('D2UR UI Refinement Process', () => {
    test('Capture and Compare UI State', async ({ page }) => {
        // Configuration for this specific D2UR cycle
        const inspector = new D2URInspector({
            targetSelectors: ['.pja-mermaid-diagram-wrapper', '.pja-mermaid-magnifier'],
            captureFullPage: true,
            logLevel: 'debug'
        });

        // Navigate to the application
        await page.goto('http://localhost:3000/dashboard');  // Adjust URL as needed

        // Baseline snapshot
        const baselineSnapshot = await inspector.captureSnapshot(page, 'baseline');

        // Perform UI interactions (e.g., hover, click magnify)
        const diagramWrapper = await page.locator('.pja-mermaid-diagram-wrapper').first();
        await diagramWrapper.hover();
        
        const magnifyButton = await page.locator('.pja-mermaid-magnify-btn').first();
        await magnifyButton.click();

        // After-change snapshot
        const afterSnapshot = await inspector.captureSnapshot(page, 'after-change');

        // Compare snapshots and generate diff report
        const diffReport = inspector.compareSnapshots(baselineSnapshot, afterSnapshot);

        // Assertions
        expect(diffReport.changes.length).toBeGreaterThan(0, 'Expected UI changes to occur');
    });
});

module.exports = D2URInspector;
