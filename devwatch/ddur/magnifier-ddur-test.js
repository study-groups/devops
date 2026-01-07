const { test, expect } = require('@playwright/test');
const D2URInspector = require('./ui-state-inspector');
const fs = require('fs');
const path = require('path');

// D2UR Cycle: Mermaid Magnifier Functionality Test
test.describe('D2UR Cycle: Mermaid Magnifier', () => {
    let inspector;
    let cycleLog;

    test.beforeEach(async () => {
        // Initialize D2UR Inspector with specific configuration for magnifier testing
        inspector = new D2URInspector({
            targetSelectors: [
                '.pja-docs-viewer',
                '.pja-mermaid-diagram-wrapper', 
                '.pja-mermaid-magnifier',
                '.pja-mermaid-magnify-btn',
                '.pja-mermaid-magnify-modal'
            ],
            captureFullPage: true,
            logLevel: 'debug'
        });

        // Initialize cycle log
        cycleLog = {
            id: `D2UR-magnifier-${Date.now()}`,
            timestamp: new Date().toISOString(),
            objective: "Verify Mermaid diagram magnifier functionality - hover reveals magnify button, click opens modal",
            target: {
                selectors: inspector.options.targetSelectors,
                sourceFiles: [
                    "server/static/js/docs-manager.js",
                    "server/static/dashboard/index.html"
                ]
            },
            loops: [],
            status: "PENDING"
        };
    });

    test('Execute D2UR Loop for Magnifier Functionality', async ({ page }) => {
        console.log('\n=== D2UR CYCLE START ===');
        console.log(`Objective: ${cycleLog.objective}`);
        
        // OBSERVE (Baseline)
        console.log('\n--- OBSERVE (Baseline) ---');
        await page.goto('http://localhost:3000/dashboard');
        
        // Wait for page to load and navigate to docs
        await page.waitForSelector('#docs');
        
        // Create a test document with Mermaid content
        const newDocButton = page.locator('[data-action="new-doc"]');
        await newDocButton.click();
        
        // Fill in document with Mermaid diagram
        const filenameInput = page.locator('#doc-filename');
        const contentInput = page.locator('#doc-content');
        
        await filenameInput.fill('test-mermaid.md');
        await contentInput.fill(`# Test Mermaid Document

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`

This is a test document with a Mermaid diagram.`);
        
        // Save the document
        const saveButton = page.locator('[data-action="save-doc"]');
        await saveButton.click();
        
        // Wait for save and mermaid rendering
        await page.waitForTimeout(2000);
        
        // Capture baseline state
        const baselineSnapshot = await inspector.captureSnapshot(page, 'baseline');
        
        const loop1 = {
            loopNumber: 1,
            analysis: "Baseline captured. Document created with Mermaid diagram. Need to verify magnifier elements exist and function correctly.",
            decision: "Test hover interaction to reveal magnifier button, then test click to open modal.",
            actionSummary: "Perform hover and click interactions on Mermaid diagram."
        };

        // ORIENT & DECIDE
        console.log('\n--- ORIENT & DECIDE ---');
        console.log('Analysis:', loop1.analysis);
        console.log('Decision:', loop1.decision);

        // ACT - Test magnifier functionality
        console.log('\n--- ACT ---');
        
        // Wait for Mermaid diagram to render
        await page.waitForSelector('svg', { timeout: 5000 });
        
        // Look for diagram wrapper
        const diagramWrapper = page.locator('.pja-mermaid-diagram-wrapper').first();
        const diagramExists = await diagramWrapper.count() > 0;
        
        if (!diagramExists) {
            loop1.outcome = "CAUTION (FAIL): Mermaid diagram wrapper not found. Magnifier functionality not implemented correctly.";
            cycleLog.loops.push(loop1);
            cycleLog.status = "CAUTION (FAIL)";
        } else {
            // Test hover to reveal magnifier
            await diagramWrapper.hover();
            await page.waitForTimeout(500); // Allow transition
            
            // Check if magnifier button is visible
            const magnifierButton = page.locator('.pja-mermaid-magnify-btn').first();
            const buttonVisible = await magnifierButton.isVisible();
            
            if (!buttonVisible) {
                loop1.outcome = "CAUTION (FAIL): Magnifier button not visible on hover.";
                cycleLog.loops.push(loop1);
                cycleLog.status = "CAUTION (FAIL)";
            } else {
                // Test click to open modal
                await magnifierButton.click();
                await page.waitForTimeout(500);
                
                // OBSERVE (After)
                console.log('\n--- OBSERVE (After) ---');
                const afterSnapshot = await inspector.captureSnapshot(page, 'after-change');
                
                // Compare snapshots
                const diffReport = inspector.compareSnapshots(baselineSnapshot, afterSnapshot);
                
                // Check if modal is open
                const modal = page.locator('.pja-mermaid-magnify-modal.is-open');
                const modalOpen = await modal.count() > 0;
                
                if (modalOpen) {
                    loop1.outcome = "SUCCESS: Magnifier functionality working correctly. Modal opened on button click.";
                    cycleLog.status = "SUCCESS";
                    
                    // Test close functionality
                    const closeButton = page.locator('.pja-mermaid-magnify-close');
                    await closeButton.click();
                    await page.waitForTimeout(500);
                    
                    const modalClosed = await page.locator('.pja-mermaid-magnify-modal.is-open').count() === 0;
                    if (modalClosed) {
                        loop1.outcome += " Modal closes correctly.";
                    }
                } else {
                    loop1.outcome = "CAUTION (FAIL): Modal did not open when magnifier button clicked.";
                    cycleLog.status = "CAUTION (FAIL)";
                }
                
                cycleLog.loops.push(loop1);
                
                // Log quantitative results
                console.log('\n--- QUANTITATIVE RESULTS ---');
                console.log(`Changes detected: ${diffReport.changes.length}`);
                diffReport.changes.forEach(change => {
                    console.log(`- ${change.selector}: ${change.type} changes`);
                    if (change.changes) {
                        change.changes.forEach(c => {
                            console.log(`  * ${c.property}: ${c.from} → ${c.to}`);
                        });
                    }
                });
            }
        }

        // Generate final assessment
        cycleLog.finalAssessment = loop1.outcome;
        cycleLog.learnings = "Magnifier functionality requires proper Mermaid diagram rendering and CSS hover states. Modal visibility is key success metric.";

        // Save cycle log
        const logPath = path.join(inspector.resultsDir, `magnifier-cycle-${Date.now()}.json`);
        fs.writeFileSync(logPath, JSON.stringify(cycleLog, null, 2));
        
        console.log('\n=== D2UR CYCLE COMPLETE ===');
        console.log(`Status: ${cycleLog.status}`);
        console.log(`Log saved to: ${logPath}`);
        
        // Assertions for test framework
        expect(cycleLog.status).toBe('SUCCESS');
    });

    test.afterEach(async ({ page }) => {
        // Cleanup: Delete test document
        try {
            const deleteButton = page.locator('#delete-doc-btn');
            if (await deleteButton.isVisible()) {
                await deleteButton.click();
                // Confirm deletion if confirmation dialog appears
                await page.waitForTimeout(1000);
            }
        } catch (error) {
            console.log('Cleanup note: Test document may need manual deletion');
        }
    });
});
