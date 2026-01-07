// reporters/real-time-reporter.js - Real-time progress reporter for admin interface
const fs = require('fs/promises');
const path = require('path');

class RealTimeReporter {
  constructor(options = {}) {
    const pwDir = options.pwDir || process.env.PW_DIR;
    
    if (!pwDir) {
      console.error('ERROR: PW_DIR environment variable is not set. RealTimeReporter is disabled.');
      this.progressFile = null; // Disable the reporter
    } else {
      this.progressFile = path.join(pwDir, 'logs', 'test-progress.json');
    }

    this.sessionId = options.sessionId || Date.now().toString();
    this.startTime = Date.now();
    this.progress = {
      sessionId: this.sessionId,
      status: 'starting',
      startTime: new Date().toISOString(),
      totalTests: 0,
      completedTests: 0,
      currentTest: null,
      results: [],
      lastUpdate: new Date().toISOString()
    };
  }

  async onBegin(config, suite) {
    if (!this.progressFile) return;
    this.progress.totalTests = suite.allTests().length;
    this.progress.status = 'running';
    this.progress.lastUpdate = new Date().toISOString();
    
    console.log(`🚀 Starting test run: ${this.progress.totalTests} tests (Session: ${this.sessionId})`);
    await this.writeProgress();
  }

  async onTestBegin(test) {
    if (!this.progressFile) return;
    this.progress.currentTest = {
      title: test.title,
      file: test.location.file,
      startTime: new Date().toISOString()
    };
    this.progress.lastUpdate = new Date().toISOString();
    
    console.log(`▶️  Starting: ${test.title}`);
    await this.writeProgress();
  }

  async onTestEnd(test, result) {
    if (!this.progressFile) return;
    const testResult = {
      title: test.title,
      status: result.status,
      duration: result.duration,
      error: result.error ? result.error.message : null,
      timestamp: new Date().toISOString()
    };

    this.progress.results.push(testResult);
    this.progress.completedTests = this.progress.results.length;
    this.progress.currentTest = null;
    this.progress.lastUpdate = new Date().toISOString();

    const statusIcon = result.status === 'passed' ? '✅' : 
                      result.status === 'failed' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${test.title} (${result.duration}ms)`);
    
    await this.writeProgress();
  }

  async onEnd() {
    if (!this.progressFile) return;
    this.progress.status = 'completed';
    this.progress.endTime = new Date().toISOString();
    this.progress.totalDuration = Date.now() - this.startTime;
    this.progress.lastUpdate = new Date().toISOString();

    const passed = this.progress.results.filter(r => r.status === 'passed').length;
    const failed = this.progress.results.filter(r => r.status === 'failed').length;
    
    console.log(`🏁 Test run completed: ${passed} passed, ${failed} failed`);
    await this.writeProgress();
  }

  async writeProgress() {
    if (!this.progressFile) {
      return; // Do nothing if the reporter is disabled
    }
    try {
      await fs.mkdir(path.dirname(this.progressFile), { recursive: true });
      await fs.writeFile(this.progressFile, JSON.stringify(this.progress, null, 2));
    } catch (error) {
      console.error('Failed to write progress to a file:', error);
    }
  }
}

module.exports = RealTimeReporter;
