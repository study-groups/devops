const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { info } = require('../../utils/logging');
const { saveCentralTestResult, getCentralTestResults } = require('../../utils/database');

const router = express.Router();

// Returns summary results produced by reporters/admin-reporter.js
router.get('/playwright/admin-results', async (req, res) => {
    try {
        const { PW_DIR } = req.app.locals;
        const adminFile = path.join(PW_DIR, 'admin-results.json');
        const masterFile = path.join(PW_DIR, 'master-test-results.json');
        let admin = [];
        let master = [];
        try {
            const a = await fs.readFile(adminFile, 'utf8');
            admin = JSON.parse(a);
        } catch (_) { /* ignore */ }
        try {
            const m = await fs.readFile(masterFile, 'utf8');
            master = JSON.parse(m);
        } catch (_) { /* ignore */ }
        res.json({ admin, master, counts: {
            admin: admin.length,
            master: master.length,
            passed: master.filter(r => r.status === 'passed').length,
            failed: master.filter(r => r.status === 'failed').length
        }});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API endpoint to save test result to central database
router.post('/test-results/save', async (req, res) => {
    try {
        const testResult = req.body;
        const PW_DIR = req.app.locals.PW_DIR;
        
        const savedResult = await saveCentralTestResult(testResult, PW_DIR);
        
        res.json({
            success: true,
            id: savedResult.centralDbId,
            message: 'Test result saved to central database'
        });
        
        info('Test result saved to central DB', { id: savedResult.centralDbId });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API endpoint to get central database results
router.get('/test-results/central', async (req, res) => {
    try {
        const PW_DIR = req.app.locals.PW_DIR;
        const centralResults = await getCentralTestResults(PW_DIR);
        
        res.json({
            success: true,
            count: centralResults.length,
            results: centralResults.slice(0, 50) // Return last 50 results
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
