// Report Routes - Serves Playwright HTML reports
// Consolidates the functionality of the separate report server

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { getMasterTestResults, getCombinedReportData } = require('../utils/database');

const router = express.Router();

// Serve Playwright HTML reports for direct access - using dynamic PW_DIR
router.use('/raw', (req, res, next) => {
    const PW_DIR = req.app.locals.PW_DIR;
    if (!PW_DIR) {
        return res.status(500).json({ error: 'PW_DIR not configured' });
    }
    express.static(path.join(PW_DIR, 'reports'))(req, res, next);
});

// Serve specific files (like index.html) directly 
router.use('/', (req, res, next) => {
    const PW_DIR = req.app.locals.PW_DIR;
    if (!PW_DIR) {
        return res.status(500).json({ error: 'PW_DIR not configured' });
    }
    express.static(path.join(PW_DIR, 'reports'), { index: false })(req, res, next);
});

// Route to handle specific test ID requests
router.get('/test', async (req, res) => {
    const testId = req.query.testId;
    const PW_DIR = req.app.locals.PW_DIR;

    if (!testId) {
        return res.status(400).send('No test ID provided');
    }

    try {
        // Check if the specific test report exists
        const reportPath = path.join(PW_DIR, 'reports', testId);
        
        try {
            await fs.access(reportPath);
            // If directory exists, serve the index.html from that directory
            express.static(reportPath, { index: 'index.html' })(req, res);
        } catch (dirError) {
            // If specific directory doesn't exist, fall back to main reports index
            res.sendFile(path.join(PW_DIR, 'reports', 'index.html'));
        }
    } catch (error) {
        res.status(500).send(`Error accessing test report: ${error.message}`);
    }
});

// Report index - Enhanced reports dashboard
router.get('/', async (req, res) => {
    try {
        const PW_DIR = req.app.locals.PW_DIR;
        const reportDir = path.join(PW_DIR, 'reports');
        
        // Get combined report data (saved results + live events)
        const reportData = await getCombinedReportData(PW_DIR);
        
        // Check if HTML report directory exists
        let hasHtmlReports = false;
        let htmlReportsSection = '';
        try {
            await fs.access(reportDir);
            const indexPath = path.join(reportDir, 'index.html');
            try {
                await fs.access(indexPath);
                hasHtmlReports = true;
                const stats = await fs.stat(indexPath);
                const lastModified = stats.mtime.toLocaleString();
                htmlReportsSection = `
                    <div class="section">
                        <h2><span class="icon icon-document"></span>HTML Test Reports</h2>
                        <div class="info">
                            <p><span class="icon icon-chart"></span>Full Playwright HTML report with test details, traces, and screenshots.</p>
                            <p>📅 <strong>Last Updated:</strong> ${lastModified}</p>
                            <div style="margin: 15px 0;">
                                <a href="/reports/raw" target="_blank" class="refresh-btn"><span class="icon icon-link"></span>View Full HTML Report</a>
                                <a href="/reports/index.html" target="_blank" class="nav-link" style="margin-left: 10px;"><span class="icon icon-folder"></span>Direct Access</a>
                            </div>
                        </div>
                    </div>
                `;
            } catch (e) {
                htmlReportsSection = `
                    <div class="section">
                        <h2>📄 HTML Test Reports</h2>
                        <div class="warning">
                            <p>⚠️ No HTML reports found. Generate reports by running:</p>
                            <p><code>npx playwright test --reporter=html</code></p>
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            htmlReportsSection = `
                <div class="section">
                    <h2>📄 HTML Test Reports</h2>
                    <div class="warning">
                        <p>⚠️ Report directory doesn't exist. Run tests to generate reports.</p>
                    </div>
                </div>
            `;
        }
        
        // Format individual test results - combining saved results and live events
        let individualResultsSection = '';
        if (reportData.combinedCount === 0) {
            individualResultsSection = `
                <div class="section">
                    <h2>🧪 Test Results Dashboard</h2>
                    <div class="info">
                        <p>📊 No test results yet.</p>
                        <p>Start monitoring or run tests through the <a href="/">Admin Interface</a> to see results accumulate here.</p>
                    </div>
                </div>
            `;
        } else {
            // Combine saved results and live events for display
            const allResults = [
                ...reportData.savedResults.map(r => ({...r, source: 'saved', icon: '💾'})),
                ...reportData.liveEvents.map(e => ({...e, source: 'live', icon: '🔴'}))
            ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const resultCards = allResults.slice(0, 25).map(result => {
                const statusIcon = result.success ? '<span class="icon icon-check text-success"></span>' : '<span class="icon icon-x text-error"></span>';
                const statusClass = result.success ? 'success' : 'failure';
                const timestamp = new Date(result.timestamp).toLocaleString();
                const duration = result.duration ? `${result.duration}ms` : 'N/A';
                const sourceIcon = result.icon || '📄';
                const sourceLabel = result.source === 'live' ? 'LIVE' : 'SAVED';
                
                return `
                    <div class="result-card ${statusClass} ${result.source}">
                        <div class="result-header">
                            <span class="source-indicator">${sourceIcon} ${sourceLabel}</span>
                            <span class="status-icon">${statusIcon}</span>
                            <span class="environment">${result.environment || 'Unknown'}</span>
                            <span class="timestamp">${timestamp}</span>
                        </div>
                        <div class="result-details">
                            <p><strong>URL:</strong> ${result.url || result.dst || 'N/A'}</p>
                            <p><strong>Duration:</strong> ${duration}</p>
                            <p><strong>Test:</strong> ${result.test || result.type || 'N/A'}</p>
                            ${result.error ? `<p class="error-text"><strong>Error:</strong> ${result.error}</p>` : ''}
                            ${result.details ? `<p class="details-text">${result.details}</p>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            individualResultsSection = `
                <div class="section">
                    <h2>🧪 Unified Test Results Dashboard</h2>
                    <div class="stats">
                        <span class="stat"><span class="icon icon-chart"></span>Total: ${reportData.combinedCount}</span>
                        <span class="stat">💾 Saved: ${reportData.stats.saved}</span>
                        <span class="stat">🔴 Live: ${reportData.stats.live}</span>
                        <span class="stat"><span class="icon icon-check text-success"></span>Success Rate: ${reportData.stats.successRate.live}%</span>
                    </div>
                    <div class="results-container">
                        ${resultCards}
                    </div>
                    ${allResults.length > 25 ? `<p class="more-results">... and ${allResults.length - 25} more results available</p>` : ''}
                </div>
            `;
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Playwright Reports Dashboard</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="/static/icons.css">
                <style>
                    body { 
                        font-family: 'Courier New', monospace; 
                        background: #1a1a1a; 
                        color: #00ff00; 
                        margin: 0; 
                        padding: 20px; 
                        line-height: 1.4; 
                    }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .header { 
                        border-bottom: 2px solid #00ff00; 
                        padding-bottom: 10px; 
                        margin-bottom: 20px; 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                    }
                    .section { 
                        background: #2a2a2a; 
                        border: 1px solid #00ff00; 
                        margin: 20px 0; 
                        padding: 20px; 
                        border-radius: 5px; 
                    }
                    .section h2 { margin-top: 0; color: #00ff00; }
                    .info { 
                        background: #1a2a1a; 
                        border: 1px solid #00aa00; 
                        padding: 15px; 
                        border-radius: 5px; 
                        margin: 10px 0; 
                    }
                    .warning { 
                        background: #2a1a1a; 
                        border: 1px solid #ff6600; 
                        padding: 15px; 
                        border-radius: 5px; 
                        margin: 10px 0; 
                    }
                    .stats { 
                        display: flex; 
                        gap: 20px; 
                        margin: 15px 0; 
                        flex-wrap: wrap; 
                    }
                    .stat { 
                        background: #3a3a3a; 
                        padding: 8px 12px; 
                        border-radius: 3px; 
                        border: 1px solid #666; 
                    }
                    .results-container { max-height: 500px; overflow-y: auto; margin: 15px 0; }
                    .result-card { 
                        background: #2a2a2a; 
                        border: 1px solid #666; 
                        margin: 10px 0; 
                        padding: 15px; 
                        border-radius: 5px; 
                        border-left: 4px solid #666; 
                    }
                    .result-card.success { border-left-color: #00aa00; }
                    .result-card.failure { border-left-color: #aa0000; }
                    .result-card.live { 
                        border: 1px solid #ff6600; 
                        background: linear-gradient(135deg, #2a2a2a 0%, #3a2a1a 100%); 
                    }
                    .result-card.saved { 
                        border: 1px solid #666; 
                        background: #2a2a2a; 
                    }
                    .result-header { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        margin-bottom: 10px; 
                        flex-wrap: wrap; 
                    }
                    .status-icon { font-size: 18px; }
                    .environment { 
                        background: #4a4a4a; 
                        padding: 4px 8px; 
                        border-radius: 3px; 
                        font-size: 12px; 
                    }
                    .source-indicator {
                        background: #1a3a1a;
                        color: #00ff00;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 10px;
                        font-weight: bold;
                        border: 1px solid #00aa00;
                    }
                    .result-card.live .source-indicator {
                        background: #3a1a1a;
                        color: #ff6600;
                        border-color: #ff6600;
                    }
                    .details-text {
                        color: #888;
                        font-size: 12px;
                        font-style: italic;
                    }
                    .timestamp { color: #888; font-size: 12px; }
                    .result-details p { margin: 5px 0; font-size: 14px; }
                    .error-text { color: #ff6666; }
                    .more-results { text-align: center; color: #888; font-style: italic; }
                    a { color: #00ff00; text-decoration: none; }
                    a:hover { color: #ffffff; text-decoration: underline; }
                    .nav-link { 
                        background: #3a3a3a; 
                        padding: 8px 15px; 
                        border-radius: 3px; 
                        border: 1px solid #00ff00; 
                    }
                    .nav-link:hover { background: #4a4a4a; }
                    code { 
                        background: #3a3a3a; 
                        padding: 2px 5px; 
                        border-radius: 3px; 
                        font-family: 'Courier New', monospace; 
                    }
                    .refresh-btn {
                        background: #2a4a2a;
                        border: 1px solid #00aa00;
                        color: #00ff00;
                        padding: 8px 15px;
                        border-radius: 3px;
                        cursor: pointer;
                        text-decoration: none;
                        font-family: 'Courier New', monospace;
                    }
                    .refresh-btn:hover { background: #3a5a3a; }
                </style>
                <script>
                    // Auto-refresh every 30 seconds
                    setTimeout(() => {
                        location.reload();
                    }, 30000);
                </script>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1><span class="icon icon-chart"></span>Playwright Reports Dashboard</h1>
                        <div>
                            <a href="/" class="nav-link"><span class="icon icon-home"></span>Admin Interface</a>
                            <a href="/reports/" class="refresh-btn" style="margin-left: 10px;"><span class="icon icon-refresh"></span>Refresh</a>
                        </div>
                    </div>
                    
                    ${htmlReportsSection}
                    ${individualResultsSection}
                    
                    <div class="section">
                        <h2>💡 Quick Actions</h2>
                        <div class="info">
                            <p><strong>To generate fresh reports:</strong></p>
                            <ul>
                                <li>Use the <a href="/">Admin Interface</a> to run individual tests</li>
                                <li>Run <code>npx playwright test --reporter=html</code> for full HTML reports</li>
                                <li>Individual test results will accumulate automatically</li>
                            </ul>
                            <p><em>🔄 This page auto-refreshes every 30 seconds</em></p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
        
    } catch (error) {
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body style="font-family: Arial, sans-serif; background: #1a1a1a; color: #ff6666; padding: 20px;">
                <h1>❌ Error Loading Reports</h1>
                <p>Error: ${error.message}</p>
                <p><a href="/" style="color: #00ff00;">← Back to Admin Interface</a></p>
            </body>
            </html>
        `);
    }
});

module.exports = router;