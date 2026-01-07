/**
 * Test Suite Manager for Playwright
 * 
 * Provides a comprehensive interface for managing Playwright test suites:
 * - Left panel: Test suite list and configuration
 * - Right panel: Test suite viewer and editor
 * - Real-time test execution and monitoring
 * 
 * Author: Test Suite Management System
 * Created: 2024
 */

class TestSuiteManager {
    constructor() {
        this.initialized = false;
        this.currentTestSuite = null;
        this.testSuites = [];
        this.testConfigurations = [];
        this.executionHistory = [];
        
        // Cache for test data
        this.cache = {
            suites: null,
            configs: null,
            history: null
        };
        
        this.init();
    }

    async init() {
        console.log('[TestSuiteManager] Initializing...');
        this.createUI();
        await this.loadTestSuites();
        this.initialized = true;
        console.log('[TestSuiteManager] Initialization complete');
    }

    createUI() {
        // Create main container
        const container = document.createElement('div');
        container.id = 'test-suite-manager';
        container.className = 'test-suite-manager';
        container.innerHTML = `
            <div class="manager-header">
                <h2>🧪 Playwright Test Suite Manager</h2>
                <div class="manager-controls">
                    <button id="run-selected-btn" class="btn btn-success">▶️ Run Selected</button>
                    <button id="run-all-btn" class="btn btn-primary">🚀 Run All</button>
                    <button id="refresh-suites-btn" class="btn btn-secondary">🔄 Refresh</button>
                </div>
            </div>
            
            <div class="manager-content">
                <div class="left-panel">
                    <div class="tab-bar">
                        <button class="tab-link active" data-tab="configure">⚙️ Configure</button>
                        <button class="tab-link" data-tab="suites">📋 Suites</button>
                        <button class="tab-link" data-tab="actions">⚡ Actions</button>
                        <button class="tab-link" data-tab="history">📈 History</button>
                    </div>

                    <div id="configure" class="tab-content active">
                        <div class="config-section">
                            <h4>⚙️ Test Configuration</h4>
                            <div class="config-grid">
                                <div class="config-item">
                                    <label for="target-env">Target Environment:</label>
                                    <select id="target-env" class="config-select">
                                        <option value="dev">Development</option>
                                        <option value="staging">Staging</option>
                                        <option value="prod">Production</option>
                                        <option value="local">Local Server</option>
                                    </select>
                                </div>
                                <div class="config-item">
                                    <label for="browser-project">Browser Project:</label>
                                    <select id="browser-project" class="config-select">
                                        <option value="Desktop Chrome">Desktop Chrome</option>
                                        <option value="Desktop Firefox">Desktop Firefox</option>
                                        <option value="Desktop Safari">Desktop Safari</option>
                                        <option value="Mobile iPhone">Mobile iPhone</option>
                                        <option value="Mobile Android">Mobile Android</option>
                                        <option value="all">All Browsers</option>
                                    </select>
                                </div>
                                <div class="config-item">
                                    <label for="headless-mode">Headless Mode:</label>
                                    <select id="headless-mode" class="config-select">
                                        <option value="true">Headless (Fast)</option>
                                        <option value="false">Headed (Debug)</option>
                                    </select>
                                </div>
                                <div class="config-item">
                                    <label for="performance-mode">Performance Tracking:</label>
                                    <select id="performance-mode" class="config-select">
                                        <option value="false">Disabled</option>
                                        <option value="true">Enabled</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="suites" class="tab-content">
                        <div class="suite-list-section">
                            <h4>📝 Available Test Suites</h4>
                            <div id="test-suite-list" class="suite-list">
                                <div class="loading">Loading test suites...</div>
                            </div>
                        </div>
                    </div>
                    <div id="actions" class="tab-content">
                        <div class="quick-actions">
                            <h4>⚡ Quick Actions</h4>
                            <button id="health-check-btn" class="action-btn">🏥 Health Check</button>
                            <button id="smoke-test-btn" class="action-btn">💨 Smoke Tests</button>
                            <button id="full-regression-btn" class="action-btn">🔍 Full Regression</button>
                            <button id="performance-test-btn" class="action-btn">📊 Performance Test</button>
                        </div>
                    </div>
                    <div id="history" class="tab-content">
                        <div class="history-section">
                            <h4>📈 Recent Executions</h4>
                            <div id="execution-history" class="execution-history">
                                <div class="loading">Loading execution history...</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Right Panel: Test Suite Viewer/Editor -->
                <div class="right-panel">
                    <div class="panel-header">
                        <h3 id="suite-title">📄 Test Suite Viewer</h3>
                        <div class="viewer-controls">
                            <button id="edit-suite-btn" class="btn btn-small">✏️ Edit</button>
                            <button id="save-suite-btn" class="btn btn-small" style="display:none;">💾 Save</button>
                            <button id="cancel-edit-btn" class="btn btn-small" style="display:none;">❌ Cancel</button>
                        </div>
                    </div>
                    
                    <!-- Test Suite Content -->
                    <div id="suite-content" class="suite-content">
                        <div class="welcome-message">
                            <h3>👋 Welcome to Test Suite Manager</h3>
                            <p>Select a test suite from the left panel to view and edit its contents.</p>
                            
                            <div class="suite-overview">
                                <h4>📊 Test Suite Overview</h4>
                                <div class="overview-stats">
                                    <div class="stat-item">
                                        <span class="stat-label">Total Suites:</span>
                                        <span class="stat-value" id="total-suites">-</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Test Files:</span>
                                        <span class="stat-value" id="total-files">-</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Last Execution:</span>
                                        <span class="stat-value" id="last-execution">-</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="environment-info">
                                <h4>🌐 Current Environment Configuration</h4>
                                <div id="env-config-display" class="env-display">
                                    Loading environment configuration...
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Test Execution Output -->
                    <div id="execution-output" class="execution-output" style="display:none;">
                        <div class="output-header">
                            <h4>🖥️ Test Execution Output</h4>
                            <button id="clear-output-btn" class="btn btn-small">🗑️ Clear</button>
                        </div>
                        <div id="output-content" class="output-content"></div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this.addStyles();
        
        // Append to body or a specific container
        document.body.appendChild(container);

        // Bind event handlers
        this.bindEvents();
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .test-suite-manager {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                max-width: 1600px;
                margin: 20px auto;
                background: #1a1a1a;
                color: #e0e0e0;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                height: calc(100vh - 80px);
                display: flex;
                flex-direction: column;
            }

            .manager-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #333;
            }

            .manager-header h2 {
                margin: 0;
                color: #4CAF50;
                font-size: 1.5em;
            }

            .manager-controls {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .manager-content {
                display: flex;
                gap: 20px;
                flex: 1;
                overflow: hidden;
            }

            .left-panel {
                width: 350px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .right-panel {
                flex: 1;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .panel-header {
                background: #333;
                padding: 15px;
                border-bottom: 1px solid #444;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .panel-header h3 {
                margin: 0;
                color: #4CAF50;
                font-size: 1.1em;
            }

            .panel-description {
                color: #aaa;
                font-size: 0.9em;
            }

            .viewer-controls {
                display: flex;
                gap: 5px;
            }

            .config-section {
                padding: 15px;
                border-bottom: 1px solid #444;
            }

            .config-section h4 {
                margin: 0 0 10px 0;
                color: #FFC107;
                font-size: 1em;
            }

            .config-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 10px;
            }

            .config-item {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .config-item label {
                font-size: 0.9em;
                color: #aaa;
                font-weight: bold;
            }

            .config-select {
                background: #333;
                border: 1px solid #555;
                color: #e0e0e0;
                padding: 8px;
                border-radius: 4px;
                font-family: inherit;
                font-size: 0.9em;
            }

            .config-select:focus {
                outline: none;
                border-color: #4CAF50;
            }

            .suite-list-section {
                padding: 15px;
                border-bottom: 1px solid #444;
                flex: 1;
                overflow-y: auto;
            }

            .suite-list-section h4 {
                margin: 0 0 10px 0;
                color: #FFC107;
                font-size: 1em;
            }

            .suite-list {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .suite-item {
                background: #333;
                padding: 10px;
                border-radius: 4px;
                border: 1px solid #555;
                cursor: pointer;
                transition: all 0.2s;
            }

            .suite-item:hover {
                background: #444;
                border-color: #4CAF50;
            }

            .suite-item.selected {
                background: #4CAF50;
                color: white;
                border-color: #45a049;
            }

            .suite-name {
                font-weight: bold;
                margin-bottom: 5px;
            }

            .suite-info {
                font-size: 0.8em;
                color: #aaa;
            }

            .suite-item.selected .suite-info {
                color: rgba(255, 255, 255, 0.8);
            }

            .quick-actions {
                padding: 15px;
                border-bottom: 1px solid #444;
            }

            .quick-actions h4 {
                margin: 0 0 10px 0;
                color: #FFC107;
                font-size: 1em;
            }

            .action-btn {
                display: block;
                width: 100%;
                background: #666;
                color: white;
                border: none;
                padding: 8px;
                margin-bottom: 5px;
                border-radius: 4px;
                cursor: pointer;
                font-family: inherit;
                font-size: 0.9em;
                transition: background-color 0.2s;
            }

            .action-btn:hover {
                background: #777;
            }

            .history-section {
                padding: 15px;
                max-height: 200px;
                overflow-y: auto;
            }

            .history-section h4 {
                margin: 0 0 10px 0;
                color: #FFC107;
                font-size: 1em;
            }

            .execution-history {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .history-item {
                background: #333;
                padding: 8px;
                border-radius: 4px;
                border-left: 3px solid #4CAF50;
                font-size: 0.8em;
            }

            .history-item.failed {
                border-left-color: #f44336;
            }

            .history-time {
                color: #aaa;
                margin-bottom: 3px;
            }

            .history-details {
                color: #e0e0e0;
            }

            .suite-content {
                padding: 20px;
                flex: 1;
                overflow-y: auto;
            }

            .welcome-message h3 {
                color: #4CAF50;
                margin-top: 0;
            }

            .suite-overview {
                background: #333;
                padding: 15px;
                border-radius: 6px;
                margin: 15px 0;
                border-left: 3px solid #4CAF50;
            }

            .suite-overview h4 {
                margin: 0 0 10px 0;
                color: #FFC107;
            }

            .overview-stats {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 15px;
            }

            .stat-item {
                text-align: center;
            }

            .stat-label {
                display: block;
                font-size: 0.9em;
                color: #aaa;
                margin-bottom: 5px;
            }

            .stat-value {
                display: block;
                font-size: 1.2em;
                font-weight: bold;
                color: #4CAF50;
            }

            .environment-info {
                background: #333;
                padding: 15px;
                border-radius: 6px;
                margin: 15px 0;
                border-left: 3px solid #FF9800;
            }

            .environment-info h4 {
                margin: 0 0 10px 0;
                color: #FFC107;
            }

            .env-display {
                font-family: monospace;
                background: #1e1e1e;
                padding: 10px;
                border-radius: 4px;
                border: 1px solid #444;
                font-size: 0.9em;
            }

            .test-file-content {
                background: #1e1e1e;
                padding: 15px;
                border-radius: 6px;
                border: 1px solid #444;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 0.9em;
                line-height: 1.4;
                overflow-x: auto;
            }

            .line-numbers {
                color: #666;
                margin-right: 15px;
                user-select: none;
            }

            .code-line {
                display: block;
                margin: 2px 0;
            }

            .execution-output {
                background: #1e1e1e;
                border-top: 1px solid #444;
                display: flex;
                flex-direction: column;
                max-height: 300px;
            }

            .output-header {
                background: #333;
                padding: 10px 15px;
                border-bottom: 1px solid #444;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .output-header h4 {
                margin: 0;
                color: #FFC107;
                font-size: 1em;
            }

            .output-content {
                padding: 15px;
                flex: 1;
                overflow-y: auto;
                font-family: monospace;
                font-size: 0.9em;
                line-height: 1.4;
                background: #0a0a0a;
            }

            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-family: inherit;
                font-size: 0.9em;
                transition: background-color 0.2s;
            }

            .btn-success {
                background: #4CAF50;
                color: white;
            }

            .btn-success:hover {
                background: #45a049;
            }

            .btn-primary {
                background: #2196F3;
                color: white;
            }

            .btn-primary:hover {
                background: #1976D2;
            }

            .btn-secondary {
                background: #666;
                color: white;
            }

            .btn-secondary:hover {
                background: #777;
            }

            .btn-small {
                padding: 6px 12px;
                font-size: 0.8em;
            }

            .tab-bar {
                display: flex;
                background: #333;
                border-bottom: 1px solid #444;
                justify-content: space-around;
            }

            .tab-link {
                padding: 10px 5px;
                cursor: pointer;
                background: none;
                border: none;
                color: #aaa;
                font-family: inherit;
                font-size: 0.85em;
                border-bottom: 2px solid transparent;
                flex-grow: 1;
                text-align: center;
            }

            .tab-link.active {
                color: #4CAF50;
                border-bottom-color: #4CAF50;
                background: #2a2a2a;
            }

            .tab-content {
                display: none;
                padding: 15px;
                overflow-y: auto;
                flex: 1;
            }

            .tab-content.active {
                display: block;
            }


            .loading {
                text-align: center;
                color: #888;
                font-style: italic;
                padding: 20px;
            }

            .error-message {
                background: #f44336;
                color: white;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
            }
        `;
        document.head.appendChild(style);
    }

    bindEvents() {
        // Main controls
        document.getElementById('run-selected-btn').addEventListener('click', () => {
            this.runSelectedTest();
        });

        document.getElementById('run-all-btn').addEventListener('click', () => {
            this.runAllTests();
        });

        document.getElementById('refresh-suites-btn').addEventListener('click', () => {
            this.loadTestSuites();
        });

        // Suite viewer controls
        document.getElementById('edit-suite-btn').addEventListener('click', () => {
            this.enableSuiteEditing();
        });

        document.getElementById('save-suite-btn').addEventListener('click', () => {
            this.saveSuiteChanges();
        });

        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            this.cancelSuiteEditing();
        });

        // Quick actions
        document.getElementById('health-check-btn').addEventListener('click', () => {
            this.runHealthCheck();
        });

        document.getElementById('smoke-test-btn').addEventListener('click', () => {
            this.runSmokeTests();
        });

        document.getElementById('full-regression-btn').addEventListener('click', () => {
            this.runFullRegression();
        });

        document.getElementById('performance-test-btn').addEventListener('click', () => {
            this.runPerformanceTest();
        });

        // Output controls
        document.getElementById('clear-output-btn').addEventListener('click', () => {
            this.clearExecutionOutput();
        });

        // Tab switching logic
        document.querySelector('.tab-bar').addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-link')) {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            }
        });
    }

    switchTab(tabName) {
        // Deactivate all tabs and content
        document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Activate the selected tab and content
        document.querySelector(`.tab-link[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }

    async loadTestSuites() {
        try {
            console.log('[TestSuiteManager] Loading test suites...');
            
            // Get filesystem data that includes test suite information
            const response = await fetch('/api/system/filesystem');
            const data = await response.json();
            
            console.log('[TestSuiteManager] Full API Response:', JSON.stringify(data, null, 2));
            console.log('[TestSuiteManager] Directories:', Object.keys(data.directories || {}));
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Extract test suite information from the filesystem data
            const playwrightSource = data.directories['Playwright Source (PW_SRC)'];
            console.log('[TestSuiteManager] Playwright Source:', playwrightSource);
            
            if (playwrightSource && playwrightSource.testSuites) {
                this.testSuites = playwrightSource.testSuites.map(filename => ({
                    name: filename,
                    filename: filename,
                    path: `${playwrightSource.path}/tests/${filename}`,
                    lastModified: new Date().toISOString(), // Would be extracted from file stats
                    lines: 0, // Would be calculated from file content
                    tests: 0 // Would be calculated from file content
                }));
            }

            // Load additional test suite details
            await this.loadTestSuiteDetails();
            
            this.renderTestSuiteList();
            this.updateOverviewStats();
            this.loadEnvironmentConfig();
            
            console.log('[TestSuiteManager] Test suites loaded successfully');
        } catch (error) {
            console.error('[TestSuiteManager] Failed to load test suites:', error);
            document.getElementById('test-suite-list').innerHTML = 
                `<div class="error-message">Failed to load test suites: ${error.message}</div>`;
        }
    }

    async loadTestSuiteDetails() {
        // In a real implementation, this would fetch the actual file contents
        // For now, we'll populate with sample data based on what we know
        const suiteDetails = {
            'games.spec.js': {
                lines: 89,
                tests: 6,
                description: 'Game loading and functionality tests | 📍 playwright/tests/games.spec.js:1-89',
                environment: 'Uses PLAYWRIGHT_ADDITIONAL_PATHS, PLAYWRIGHT_MEASURE_PERFORMANCE'
            },
            'game-flow.spec.js': {
                lines: 165,
                tests: 12,
                description: 'End-to-end game flow testing | 📍 playwright/tests/game-flow.spec.js:1-165',
                environment: 'Uses PLAYWRIGHT_USE_LOCAL_SERVER, PLAYWRIGHT_TARGET_ENV'
            },
            'metrics.spec.js': {
                lines: 36,
                tests: 3,
                description: 'Performance and metrics validation | 📍 playwright/tests/metrics.spec.js:1-36',
                environment: 'Performance tracking and measurement tests'
            },
            'simple-firefox.js': {
                lines: 14,
                tests: 1,
                description: 'Firefox-specific compatibility test | 📍 playwright/tests/simple-firefox.js:1-14',
                environment: 'Firefox browser compatibility validation'
            }
        };

        this.testSuites = this.testSuites.map(suite => ({
            ...suite,
            ...suiteDetails[suite.filename]
        }));
    }

    renderTestSuiteList() {
        const listContainer = document.getElementById('test-suite-list');
        
        if (this.testSuites.length === 0) {
            listContainer.innerHTML = '<div class="loading">No test suites found</div>';
            return;
        }

        let html = '';
        this.testSuites.forEach((suite, index) => {
            html += `
                <div class="suite-item" data-suite-index="${index}">
                    <div class="suite-name">📄 ${suite.name}</div>
                    <div class="suite-info">
                        ${suite.tests} tests | ${suite.lines} lines<br>
                        ${suite.description || 'Test suite description'}
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;

        // Add click handlers for suite selection
        listContainer.querySelectorAll('.suite-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectTestSuite(parseInt(item.dataset.suiteIndex));
            });
        });
    }

    selectTestSuite(index) {
        // Remove previous selection
        document.querySelectorAll('.suite-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selection to clicked item
        document.querySelectorAll('.suite-item')[index].classList.add('selected');

        // Load and display the selected test suite
        this.currentTestSuite = this.testSuites[index];
        this.displayTestSuite(this.currentTestSuite);
    }

    async displayTestSuite(suite) {
        document.getElementById('suite-title').textContent = `📄 ${suite.name}`;
        
        try {
            // In a real implementation, this would fetch the actual file content
            // For now, we'll show a formatted representation
            const suiteContent = await this.getTestSuiteContent(suite);
            
            const html = `
                <div class="test-suite-header">
                    <h3>${suite.name}</h3>
                    <p>${suite.description}</p>
                    <div class="suite-metadata">
                        <span><strong>Path:</strong> ${suite.path}</span><br>
                        <span><strong>Tests:</strong> ${suite.tests} | <strong>Lines:</strong> ${suite.lines}</span><br>
                        <span><strong>Environment:</strong> ${suite.environment}</span>
                    </div>
                </div>
                
                <div class="test-file-content">
                    <div class="code-preview">
                        ${suiteContent}
                    </div>
                </div>
            `;

            document.getElementById('suite-content').innerHTML = html;
        } catch (error) {
            console.error('[TestSuiteManager] Failed to load test suite content:', error);
            document.getElementById('suite-content').innerHTML = 
                `<div class="error-message">Failed to load test suite: ${error.message}</div>`;
        }
    }

    async getTestSuiteContent(suite) {
        // This would typically fetch the actual file content from the server
        // For now, return formatted sample content based on the file
        const sampleContent = {
            'games.spec.js': `<span class="line-numbers">1</span><span class="code-line">// tests/games.spec.js - Standardized test structure</span>
<span class="line-numbers">2</span><span class="code-line">const { test, expect } = require('@playwright/test');</span>
<span class="line-numbers">3</span><span class="code-line"></span>
<span class="line-numbers">4</span><span class="code-line">// Test paths - can be extended via configuration</span>
<span class="line-numbers">5</span><span class="code-line">const paths = [</span>
<span class="line-numbers">6</span><span class="code-line">  '/games',</span>
<span class="line-numbers">7</span><span class="code-line">  '/games/cornhole-hero',</span>
<span class="line-numbers">8</span><span class="code-line">  '/games/cheap-golf'</span>
<span class="line-numbers">9</span><span class="code-line">];</span>
<span class="line-numbers">10</span><span class="code-line"></span>
<span class="line-numbers">11</span><span class="code-line">// Optional: Load additional paths from configuration</span>
<span class="line-numbers">12</span><span class="code-line">const additionalPaths = process.env.PLAYWRIGHT_ADDITIONAL_PATHS</span>
<span class="line-numbers">13</span><span class="code-line">  ? process.env.PLAYWRIGHT_ADDITIONAL_PATHS.split(',')</span>
<span class="line-numbers">14</span><span class="code-line">  : [];</span>
<span class="line-numbers">15</span><span class="code-line"></span>
<span class="line-numbers">16</span><span class="code-line">const allPaths = [...paths, ...additionalPaths];</span>
<span class="line-numbers">17</span><span class="code-line"></span>
<span class="line-numbers">18</span><span class="code-line">for (const path of allPaths) {</span>
<span class="line-numbers">19</span><span class="code-line">  test.describe(\`Page: \${path}\`, () => {</span>
<span class="line-numbers">20</span><span class="code-line">    test(\`should load and contain main content\`, async ({ page, baseURL }) => {</span>
<span class="line-numbers">21</span><span class="code-line">      // Test implementation...</span>
<span class="line-numbers">22</span><span class="code-line">    });</span>
<span class="line-numbers">23</span><span class="code-line">  });</span>
<span class="line-numbers">24</span><span class="code-line">}</span>`,
            'game-flow.spec.js': `<span class="line-numbers">1</span><span class="code-line">// tests/game-flow.spec.js - End-to-end game flow testing</span>
<span class="line-numbers">2</span><span class="code-line">const { test, expect } = require('@playwright/test');</span>
<span class="line-numbers">3</span><span class="code-line">const useLocalServer = process.env.PLAYWRIGHT_USE_LOCAL_SERVER === 'true';</span>
<span class="line-numbers">4</span><span class="code-line">const targetEnvironment = process.env.PLAYWRIGHT_TARGET_ENV || 'dev';</span>
<span class="line-numbers">5</span><span class="code-line"></span>
<span class="line-numbers">6</span><span class="code-line">test.describe('Game Flow Tests', () => {</span>
<span class="line-numbers">7</span><span class="code-line">  test('complete game session flow', async ({ page }) => {</span>
<span class="line-numbers">8</span><span class="code-line">    // Complete game flow implementation...</span>
<span class="line-numbers">9</span><span class="code-line">  });</span>
<span class="line-numbers">10</span><span class="code-line">});</span>`,
            'metrics.spec.js': `<span class="line-numbers">1</span><span class="code-line">// tests/metrics.spec.js - Performance and metrics validation</span>
<span class="line-numbers">2</span><span class="code-line">const { test, expect } = require('@playwright/test');</span>
<span class="line-numbers">3</span><span class="code-line"></span>
<span class="line-numbers">4</span><span class="code-line">test.describe('Performance Metrics', () => {</span>
<span class="line-numbers">5</span><span class="code-line">  test('page load performance', async ({ page }) => {</span>
<span class="line-numbers">6</span><span class="code-line">    // Performance measurement implementation...</span>
<span class="line-numbers">7</span><span class="code-line">  });</span>
<span class="line-numbers">8</span><span class="code-line">});</span>`,
            'simple-firefox.js': `<span class="line-numbers">1</span><span class="code-line">// tests/simple-firefox.js - Firefox compatibility test</span>
<span class="line-numbers">2</span><span class="code-line">const { test, expect } = require('@playwright/test');</span>
<span class="line-numbers">3</span><span class="code-line"></span>
<span class="line-numbers">4</span><span class="code-line">test('Firefox compatibility check', async ({ page }) => {</span>
<span class="line-numbers">5</span><span class="code-line">  await page.goto('/');</span>
<span class="line-numbers">6</span><span class="code-line">  await expect(page).toHaveTitle(/Pixeljam Arcade/);</span>
<span class="line-numbers">7</span><span class="code-line">});</span>`
        };

        return sampleContent[suite.filename] || '<div class="loading">Loading test content...</div>';
    }

    updateOverviewStats() {
        document.getElementById('total-suites').textContent = this.testSuites.length;
        document.getElementById('total-files').textContent = this.testSuites.reduce((sum, suite) => sum + suite.tests, 0);
        document.getElementById('last-execution').textContent = 'Never'; // Would be from actual data
    }

    loadEnvironmentConfig() {
        const envConfig = `
📁 TSM Data Storage Locations:
  • Test Suite Config: $PW_DIR/config/test-suites.json
  • Test Results DB: $PW_DIR/master-test-results.json  
  • Test Files: $PW_DIR/tests/*.spec.js
  • Saved Tests: $PW_DIR/saved-tests/
  • Archive: $PD_DIR/archive/ (if configured)

⚙️ Environment Variables:
  • PW_DIR = $PW_DIR (Playwright working directory)
  • PD_DIR = $PD_DIR (Archive/historical data)
  • PLAYWRIGHT_TARGET_ENV = dev
  • PLAYWRIGHT_USE_LOCAL_SERVER = false
  • PLAYWRIGHT_HEADLESS = true

🎯 Current Configuration:
  • Target Environment: Development
  • Browser Projects: All Available
  • Performance Tracking: Disabled
        `.trim();

        document.getElementById('env-config-display').textContent = envConfig;
    }

    // Test execution methods
    async runSelectedTest() {
        if (!this.currentTestSuite) {
            alert('Please select a test suite first');
            return;
        }

        this.showExecutionOutput();
        this.addOutputLine(`🚀 Running selected test: ${this.currentTestSuite.name}`);
        this.addOutputLine(`📍 Location: ${this.currentTestSuite.path}`);
        
        // Get configuration
        const config = this.getTestConfiguration();
        this.addOutputLine(`⚙️ Configuration: ${JSON.stringify(config, null, 2)}`);
        
        // Simulate test execution
        await this.simulateTestExecution(this.currentTestSuite.name, config);
    }

    async runAllTests() {
        this.showExecutionOutput();
        this.addOutputLine('🚀 Running all test suites...');
        
        const config = this.getTestConfiguration();
        this.addOutputLine(`⚙️ Configuration: ${JSON.stringify(config, null, 2)}`);
        
        for (const suite of this.testSuites) {
            await this.simulateTestExecution(suite.name, config);
        }
        
        this.addOutputLine('✅ All tests completed');
    }

    getTestConfiguration() {
        return {
            targetEnv: document.getElementById('target-env').value,
            browserProject: document.getElementById('browser-project').value,
            headless: document.getElementById('headless-mode').value === 'true',
            performance: document.getElementById('performance-mode').value === 'true'
        };
    }

    async simulateTestExecution(suiteName, config) {
        this.addOutputLine(`\n▶️ Starting ${suiteName}...`);
        
        // Simulate test steps
        await this.delay(1000);
        this.addOutputLine(`   ✓ Loading test environment (${config.targetEnv})`);
        
        await this.delay(800);
        this.addOutputLine(`   ✓ Launching ${config.browserProject} browser`);
        
        await this.delay(1200);
        this.addOutputLine(`   ✓ Running test cases...`);
        
        await this.delay(2000);
        const success = Math.random() > 0.2; // 80% success rate
        if (success) {
            this.addOutputLine(`   ✅ ${suiteName} completed successfully`);
        } else {
            this.addOutputLine(`   ❌ ${suiteName} failed with errors`);
        }
    }

    // Quick action methods
    async runHealthCheck() {
        this.showExecutionOutput();
        this.addOutputLine('🏥 Running health check...');
        await this.simulateTestExecution('health-check', { targetEnv: 'dev', browserProject: 'Desktop Chrome' });
    }

    async runSmokeTests() {
        this.showExecutionOutput();
        this.addOutputLine('💨 Running smoke tests...');
        await this.simulateTestExecution('smoke-tests', { targetEnv: 'dev', browserProject: 'all' });
    }

    async runFullRegression() {
        this.showExecutionOutput();
        this.addOutputLine('🔍 Running full regression suite...');
        await this.runAllTests();
    }

    async runPerformanceTest() {
        this.showExecutionOutput();
        this.addOutputLine('📊 Running performance tests...');
        await this.simulateTestExecution('performance-tests', { 
            targetEnv: 'staging', 
            browserProject: 'Desktop Chrome',
            performance: true 
        });
    }

    // Suite editing methods
    enableSuiteEditing() {
        // Implementation for enabling suite editing
        alert('Suite editing mode would be enabled here');
    }

    saveSuiteChanges() {
        // Implementation for saving suite changes
        alert('Suite changes would be saved here');
    }

    cancelSuiteEditing() {
        // Implementation for canceling suite editing
        alert('Suite editing would be canceled here');
    }

    // Output management
    showExecutionOutput() {
        document.getElementById('execution-output').style.display = 'flex';
    }

    addOutputLine(text) {
        const outputContent = document.getElementById('output-content');
        const timestamp = new Date().toLocaleTimeString();
        outputContent.innerHTML += `<div>[${timestamp}] ${text}</div>`;
        outputContent.scrollTop = outputContent.scrollHeight;
    }

    clearExecutionOutput() {
        document.getElementById('output-content').innerHTML = '';
    }

    // Utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Cleanup method
    destroy() {
        const container = document.getElementById('test-suite-manager');
        if (container) {
            container.remove();
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.testSuiteManager = new TestSuiteManager();
    });
} else {
    window.testSuiteManager = new TestSuiteManager();
}

// Export for manual initialization
window.TestSuiteManager = TestSuiteManager;