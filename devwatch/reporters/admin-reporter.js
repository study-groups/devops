// reporters/admin-reporter.js - Custom reporter for admin interface integration
const fs = require('fs/promises');
const path = require('path');

// Enforce the use of the PW_DIR environment variable
if (!process.env.PW_DIR) {
  throw new Error('CRITICAL: PW_DIR environment variable is not set. This is required for the AdminReporter.');
}

class AdminReporter {
  constructor(options = {}) {
    this.outputFile = `${process.env.PW_DIR}/admin-results.json`;
    this.results = [];
  }

  onBegin(config, suite) {
    console.log(`Starting test run with ${config.projects.length} projects`);
  }

  onTestEnd(test, result) {
    // Extract environment and browser from project name
    const [environment, browser] = test.parent.project().name.split('-');
    
    const testResult = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: test.title,
      environment,
      browser,
      status: result.status,
      duration: result.duration,
      url: test.parent.project().use.baseURL,
      error: result.error ? {
        message: result.error.message,
        stack: result.error.stack
      } : null,
      timestamp: new Date().toISOString(),
      projectName: test.parent.project().name
    };

    this.results.push(testResult);
  }

  async onEnd() {
    // Write results for admin interface consumption
    try {
      await fs.mkdir(path.dirname(this.outputFile), { recursive: true });
      await fs.writeFile(this.outputFile, JSON.stringify(this.results, null, 2));
      
      // Also append to master database if it exists
      const masterDbPath = `${process.env.PW_DIR}/master-test-results.json`;
        
      try {
        let masterData = [];
        try {
          const existing = await fs.readFile(masterDbPath, 'utf8');
          masterData = JSON.parse(existing);
        } catch (e) {
          // File doesn't exist yet, start fresh
        }
        
        // Append new results
        masterData.push(...this.results);
        
        // Keep only last 1000 results to prevent infinite growth
        if (masterData.length > 1000) {
          masterData = masterData.slice(-1000);
        }
        
        await fs.writeFile(masterDbPath, JSON.stringify(masterData, null, 2));
      } catch (error) {
        console.warn('Could not update master database:', error.message);
      }
      
    } catch (error) {
      console.error('Failed to write admin results:', error);
    }

    console.log(`\nTest run completed. Results written to ${this.outputFile}`);
    console.log(`Total tests: ${this.results.length}`);
    console.log(`Passed: ${this.results.filter(r => r.status === 'passed').length}`);
    console.log(`Failed: ${this.results.filter(r => r.status === 'failed').length}`);
  }
}

module.exports = AdminReporter;