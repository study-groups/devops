// Database Utilities - Central test results database operations

const fs = require('fs/promises');
const path = require('path');

// Save test result to central database
async function saveCentralTestResult(testResult, pwDir) {
    const centralDbPath = path.join(pwDir, 'central-test-results.json');
    let centralDb = [];
    
    try {
        const dbContent = await fs.readFile(centralDbPath, 'utf8');
        centralDb = JSON.parse(dbContent);
    } catch (e) {
        // File doesn't exist, start with empty array
    }
    
    // Add central database ID and timestamp
    const centralRecord = {
        ...testResult,
        centralDbId: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        savedToCentralAt: new Date().toISOString(),
        localId: testResult.id
    };
    
    // Add to central database
    centralDb.unshift(centralRecord);
    
    // Keep only last 1000 records
    centralDb = centralDb.slice(0, 1000);
    
    // Save to file
    await fs.writeFile(centralDbPath, JSON.stringify(centralDb, null, 2));
    
    return centralRecord;
}

// Get central database results
async function getCentralTestResults(pwDir) {
    const centralDbPath = path.join(pwDir, 'central-test-results.json');
    
    try {
        const dbContent = await fs.readFile(centralDbPath, 'utf8');
        return JSON.parse(dbContent);
    } catch (e) {
        return [];
    }
}

// Get central database statistics
async function getCentralDatabaseStats(pwDir) {
    try {
        const results = await getCentralTestResults(pwDir);
        const now = new Date();
        const last24h = results.filter(r => 
            new Date(r.savedToCentralAt) > new Date(now - 24 * 60 * 60 * 1000)
        );
        const last7d = results.filter(r => 
            new Date(r.savedToCentralAt) > new Date(now - 7 * 24 * 60 * 60 * 1000)
        );
        
        return {
            total: results.length,
            last24h: last24h.length,
            last7d: last7d.length,
            successRate: results.length > 0 ? 
                (results.filter(r => r.success).length / results.length * 100).toFixed(1) : 0,
            environments: {
                dev: results.filter(r => r.environment === 'dev').length,
                staging: results.filter(r => r.environment === 'staging').length,
                prod: results.filter(r => r.environment === 'prod').length
            }
        };
    } catch (error) {
        return {
            total: 0,
            last24h: 0,
            last7d: 0,
            successRate: 0,
            environments: { dev: 0, staging: 0, prod: 0 }
        };
    }
}

// Get recent events from central log file (JSONL format)
async function getCentralLogEvents(pwDir, options = {}) {
    const centralLogPath = path.join(pwDir, 'logs', 'central-events.jsonl');
    const limit = options.limit || 100;
    const type = options.type || null; // Filter by event type
    
    try {
        const logContent = await fs.readFile(centralLogPath, 'utf8');
        const lines = logContent.trim().split('\n').filter(line => line.trim());
        
        const events = [];
        for (const line of lines) {
            try {
                const event = JSON.parse(line);
                
                // Filter by type if specified
                if (type && event.type !== type) continue;
                
                events.push(event);
            } catch (parseError) {
                console.warn('Failed to parse log line:', line);
            }
        }
        
        // Return most recent events first, limited by count
        return events.reverse().slice(0, limit);
        
    } catch (error) {
        // File doesn't exist yet or can't be read
        return [];
    }
}

// Get combined data for reports dashboard
async function getCombinedReportData(pwDir, options = {}) {
    const [savedResults, liveEvents] = await Promise.all([
        getCentralTestResults(pwDir),
        getCentralLogEvents(pwDir, { limit: 50, type: 'PW_LOAD_TEST' })
    ]);
    
    return {
        savedResults: savedResults.slice(0, 20), // Show last 20 saved results
        liveEvents: liveEvents.slice(0, 30), // Show last 30 live events
        combinedCount: savedResults.length + liveEvents.length,
        stats: {
            saved: savedResults.length,
            live: liveEvents.length,
            successRate: {
                saved: savedResults.length > 0 ? 
                    (savedResults.filter(r => r.success).length / savedResults.length * 100).toFixed(1) : 0,
                live: liveEvents.length > 0 ? 
                    (liveEvents.filter(e => e.success).length / liveEvents.length * 100).toFixed(1) : 0
            }
        }
    };
}

module.exports = {
    saveCentralTestResult,
    getCentralTestResults,
    getCentralDatabaseStats,
    getCentralLogEvents,
    getCombinedReportData
};