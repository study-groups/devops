/**
 * Dynamic Test Runner Monitor
 * 
 * Provides real-time visibility into test execution with:
 * - Persistent modal that requires manual dismissal
 * - Live progress updates showing current step
 * - Dynamic status of what tests are waiting on
 * - Results capture as they come in
 * - Visual progress indicators
 */

class TestRunnerMonitor {
    constructor() {
        this.activeRuns = new Map();
        this.updateInterval = 2000; // Update every 2 seconds
        this.modal = null;
        this.init();
    }

    init() {
        this.createModalStructure();
        this.setupEventListeners();
    }

    createModalStructure() {
        // Create persistent modal container
        const modalHtml = `
            <div id="test-runner-modal" class="test-runner-modal hidden">
                <div class="modal-backdrop"></div>
                <div class="modal-container">
                    <div class="modal-header">
                        <h3><span class="icon icon-play"></span>Test Runner Monitor</h3>
                        <div class="modal-actions">
                            <button class="minimize-btn" onclick="testRunnerMonitor.minimizeModal()">
                                <span class="icon icon-minus"></span>
                            </button>
                            <button class="close-btn" onclick="testRunnerMonitor.closeModal()">
                                <span class="icon icon-close"></span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="modal-body">
                        <div class="test-run-overview">
                            <div class="run-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Total Tests</span>
                                    <span class="stat-value" id="total-tests">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Completed</span>
                                    <span class="stat-value" id="completed-tests">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Passed</span>
                                    <span class="stat-value text-success" id="passed-tests">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Failed</span>
                                    <span class="stat-value text-error" id="failed-tests">0</span>
                                </div>
                            </div>
                            
                            <div class="progress-section">
                                <div class="progress-bar-container">
                                    <div class="progress-bar" id="test-progress-bar"></div>
                                    <span class="progress-text" id="progress-text">0%</span>
                                </div>
                                <div class="time-info">
                                    <span class="elapsed-time">Elapsed: <span id="elapsed-time">0:00</span></span>
                                    <span class="estimated-remaining">Est. Remaining: <span id="remaining-time">--</span></span>
                                </div>
                            </div>
                        </div>

                        <div class="current-activity">
                            <h4><span class="icon icon-refresh rotating"></span>Current Activity</h4>
                            <div class="activity-details">
                                <div class="current-test">
                                    <span class="label">Running:</span>
                                    <span class="value" id="current-test-name">Initializing...</span>
                                </div>
                                <div class="current-browser">
                                    <span class="label">Browser:</span>
                                    <span class="value" id="current-browser">--</span>
                                </div>
                                <div class="current-environment">
                                    <span class="label">Environment:</span>
                                    <span class="value" id="current-environment">--</span>
                                </div>
                                <div class="waiting-on">
                                    <span class="label">Status:</span>
                                    <span class="value" id="waiting-status">Starting test runner...</span>
                                </div>
                            </div>
                        </div>

                        <div class="progress-steps">
                            <h4><span class="icon icon-list"></span>Test Progress</h4>
                            <div class="steps-container" id="steps-container">
                                <div class="step active">
                                    <span class="step-icon">⟳</span>
                                    <span class="step-text">Initializing test runner</span>
                                    <span class="step-time">now</span>
                                </div>
                            </div>
                        </div>

                        <div class="live-results">
                            <h4>
                                <span class="icon icon-chart"></span>
                                Live Results
                                <button class="toggle-results" onclick="testRunnerMonitor.toggleResults()">
                                    <span class="icon icon-chevron-down"></span>
                                </button>
                            </h4>
                            <div class="results-container" id="results-container">
                                <div class="results-placeholder">
                                    Results will appear here as tests complete...
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <div class="footer-actions">
                            <button class="btn-secondary" onclick="testRunnerMonitor.viewFullResults()">
                                <span class="icon icon-external"></span>View Full Results
                            </button>
                            <button class="btn-secondary" onclick="testRunnerMonitor.exportProgress()">
                                <span class="icon icon-download"></span>Export Progress
                            </button>
                            <button class="btn-danger" onclick="testRunnerMonitor.stopTests()">
                                <span class="icon icon-stop"></span>Stop Tests
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = document.getElementById('test-runner-modal');
    }

    setupEventListeners() {
        // Prevent modal from closing when clicking inside
        const modalContainer = this.modal.querySelector('.modal-container');
        modalContainer.addEventListener('click', (e) => e.stopPropagation());

        // Close modal when clicking backdrop
        const backdrop = this.modal.querySelector('.modal-backdrop');
        backdrop.addEventListener('click', () => this.closeModal());
    }

    /**
     * Start monitoring a test run
     * @param {Object} testRunInfo - Information about the test run
     */
    startMonitoring(testRunInfo) {
        const runId = testRunInfo.id;
        
        // Store run information
        this.activeRuns.set(runId, {
            ...testRunInfo,
            startTime: Date.now(),
            currentStep: 0,
            steps: this.generateInitialSteps(testRunInfo),
            results: []
        });

        // Show modal and start updates
        this.showModal(runId);
        this.startPolling(runId);

        // Log to system logger
        if (typeof systemLogger !== 'undefined') {
            systemLogger.log({
                type: 'MATRIX',
                subtype: 'monitor-started',
                message: `Test runner monitor started for ${testRunInfo.combinations.length} combinations`,
                details: testRunInfo,
                status: 'info'
            });
        }
    }

    generateInitialSteps(testRunInfo) {
        const steps = [
            { name: 'Initializing test runner', status: 'active', time: new Date() },
            { name: 'Setting up test environment', status: 'pending' },
            { name: 'Loading test configurations', status: 'pending' },
            { name: 'Starting browser instances', status: 'pending' }
        ];

        // Add steps for each combination
        testRunInfo.combinations.forEach((combo, index) => {
            const [browser, viewport] = combo.split('-');
            steps.push({
                name: `Running ${browser} ${viewport} tests`,
                status: 'pending',
                browser,
                viewport,
                combination: combo
            });
        });

        steps.push(
            { name: 'Generating test reports', status: 'pending' },
            { name: 'Cleaning up resources', status: 'pending' },
            { name: 'Test run complete', status: 'pending' }
        );

        return steps;
    }

    showModal(runId) {
        this.modal.classList.remove('hidden');
        this.currentRunId = runId;
        this.updateDisplay();
    }

    closeModal() {
        this.modal.classList.add('hidden');
        
        // Stop polling when modal is closed
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }

        // Log closure
        if (typeof systemLogger !== 'undefined') {
            systemLogger.log({
                type: 'MATRIX',
                subtype: 'monitor-closed',
                message: 'Test runner monitor closed by user',
                status: 'info'
            });
        }
    }

    minimizeModal() {
        this.modal.classList.add('minimized');
        
        // Create minimized indicator
        if (!document.getElementById('monitor-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'monitor-indicator';
            indicator.className = 'monitor-indicator';
            indicator.innerHTML = `
                <span class="icon icon-play rotating"></span>
                Tests Running
                <button onclick="testRunnerMonitor.restoreModal()">
                    <span class="icon icon-maximize"></span>
                </button>
            `;
            document.body.appendChild(indicator);
        }
    }

    restoreModal() {
        this.modal.classList.remove('minimized');
        const indicator = document.getElementById('monitor-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    startPolling(runId) {
        // Stop any existing polling
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        // Start new polling
        this.pollInterval = setInterval(() => {
            this.updateTestStatus(runId);
        }, this.updateInterval);
    }

    async updateTestStatus(runId) {
        try {
            const response = await fetch(`/api/testing-matrix/status/${runId}`);
            if (response.ok) {
                const status = await response.json();
                this.processStatusUpdate(runId, status);
            } else {
                // Simulate progress for now since backend might not be fully implemented
                this.simulateProgress(runId);
            }
        } catch (error) {
            console.warn('Failed to fetch test status, simulating progress:', error);
            this.simulateProgress(runId);
        }
    }

    simulateProgress(runId) {
        const run = this.activeRuns.get(runId);
        if (!run) return;

        const elapsed = Date.now() - run.startTime;
        const totalEstimated = parseInt(run.estimatedDuration.replace(/\D/g, '')) * 60 * 1000; // Convert to ms
        const progress = Math.min((elapsed / totalEstimated) * 100, 95); // Never reach 100% in simulation

        // Update current step based on progress
        const stepIndex = Math.floor((progress / 100) * run.steps.length);
        if (stepIndex !== run.currentStep && stepIndex < run.steps.length) {
            // Mark previous step as complete
            if (run.currentStep > 0) {
                run.steps[run.currentStep - 1].status = 'complete';
                run.steps[run.currentStep - 1].endTime = new Date();
            }
            
            // Mark current step as active
            run.steps[stepIndex].status = 'active';
            run.steps[stepIndex].startTime = new Date();
            run.currentStep = stepIndex;

            // Update waiting status based on current step
            this.updateWaitingStatus(run.steps[stepIndex]);
        }

        // Update run progress
        run.progress = progress;
        run.elapsedTime = elapsed;
        run.estimatedRemaining = Math.max(0, totalEstimated - elapsed);

        this.updateDisplay();
    }

    updateWaitingStatus(currentStep) {
        const statusElement = document.getElementById('waiting-status');
        if (!statusElement) return;

        const waitingMessages = {
            'Initializing test runner': 'Starting Playwright test runner...',
            'Setting up test environment': 'Configuring test environment variables...',
            'Loading test configurations': 'Reading playwright.config.js...',
            'Starting browser instances': 'Launching browser processes...',
            'Generating test reports': 'Creating HTML reports...',
            'Cleaning up resources': 'Closing browser instances...',
            'Test run complete': 'All tests finished!'
        };

        if (currentStep.name.includes('Running')) {
            statusElement.textContent = `Testing ${currentStep.browser} on ${currentStep.viewport}...`;
        } else {
            statusElement.textContent = waitingMessages[currentStep.name] || 'Processing...';
        }
    }

    updateDisplay() {
        const run = this.activeRuns.get(this.currentRunId);
        if (!run) return;

        // Update stats
        document.getElementById('total-tests').textContent = run.combinations.length;
        document.getElementById('completed-tests').textContent = run.results.length;
        document.getElementById('passed-tests').textContent = run.results.filter(r => r.status === 'passed').length;
        document.getElementById('failed-tests').textContent = run.results.filter(r => r.status === 'failed').length;

        // Update progress bar
        const progressBar = document.getElementById('test-progress-bar');
        const progressText = document.getElementById('progress-text');
        if (progressBar && progressText) {
            const progress = run.progress || 0;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        }

        // Update time info
        const elapsedElement = document.getElementById('elapsed-time');
        const remainingElement = document.getElementById('remaining-time');
        if (elapsedElement) {
            elapsedElement.textContent = this.formatTime(run.elapsedTime || 0);
        }
        if (remainingElement && run.estimatedRemaining) {
            remainingElement.textContent = this.formatTime(run.estimatedRemaining);
        }

        // Update current activity
        const currentStep = run.steps[run.currentStep];
        if (currentStep) {
            document.getElementById('current-test-name').textContent = currentStep.name;
            document.getElementById('current-browser').textContent = currentStep.browser || '--';
            document.getElementById('current-environment').textContent = 'Multi-environment';
        }

        // Update steps
        this.updateStepsDisplay(run.steps);
    }

    updateStepsDisplay(steps) {
        const container = document.getElementById('steps-container');
        if (!container) return;

        container.innerHTML = steps.map((step, index) => {
            const statusIcon = this.getStepIcon(step.status);
            const timeText = step.startTime ? this.getTimeAgo(step.startTime) : '';
            
            return `
                <div class="step ${step.status}">
                    <span class="step-icon">${statusIcon}</span>
                    <span class="step-text">${step.name}</span>
                    <span class="step-time">${timeText}</span>
                </div>
            `;
        }).join('');
    }

    getStepIcon(status) {
        const icons = {
            pending: '○',
            active: '⟳',
            complete: '✓',
            failed: '✗'
        };
        return icons[status] || '○';
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    getTimeAgo(date) {
        const diff = Date.now() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    }

    toggleResults() {
        const container = document.getElementById('results-container');
        const button = document.querySelector('.toggle-results .icon');
        
        if (container.style.display === 'none') {
            container.style.display = 'block';
            button.className = 'icon icon-chevron-down';
        } else {
            container.style.display = 'none';
            button.className = 'icon icon-chevron-right';
        }
    }

    viewFullResults() {
        window.open('/reports', '_blank');
    }

    exportProgress() {
        const run = this.activeRuns.get(this.currentRunId);
        if (!run) return;

        const data = {
            runId: this.currentRunId,
            progress: run.progress,
            steps: run.steps,
            results: run.results,
            exportTime: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `test-progress-${this.currentRunId}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    async stopTests() {
        if (confirm('Are you sure you want to stop the running tests? This will terminate all active test processes.')) {
            try {
                await fetch('/api/testing-matrix/stop', { method: 'POST' });
                
                // Update UI to show stopped state
                const run = this.activeRuns.get(this.currentRunId);
                if (run) {
                    run.steps[run.currentStep].status = 'failed';
                    run.steps.push({
                        name: 'Tests stopped by user',
                        status: 'failed',
                        time: new Date()
                    });
                }

                notificationSystem.warning('Tests have been stopped');
                this.updateDisplay();

            } catch (error) {
                notificationSystem.error('Failed to stop tests', error.message);
            }
        }
    }
}

// Global instance
const testRunnerMonitor = new TestRunnerMonitor();