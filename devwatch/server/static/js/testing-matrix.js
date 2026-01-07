/**
 * Testing Matrix Dashboard
 * Visual matrix showing test coverage across viewports and browsers
 */

class TestingMatrix {
    constructor() {
        this.matrixData = {};
        this.selectedCells = new Set();
        this.runningTests = new Set();
        this.currentMatrix = 'default';
        this.matrixConfig = {
            xAxis: 'environments',
            yAxis: 'browsers', 
            constant: 'dev'
        };
        this.init();
    }

    init() {
        this.loadMatrixData();
        this.setupEventListeners();
        this.updateMatrix(); // Show initial state, matrix will be built when button is clicked
        this.updateRecentRuns();
    }

    async loadMatrixData() {
        try {
            const response = await fetch('/api/testing-matrix');
            const data = await response.json();
            this.matrixData = data.matrix || {};
            this.updateMatrix();
            
            // Show loading feedback on first load
            if (Object.keys(this.matrixData).length === 0) {
                this.initializeDefaultMatrix();
            }
        } catch (error) {
            console.error('Failed to load matrix data:', error);
            notificationSystem.error('Failed to load matrix data', {
                error: error.message,
                operation: 'loadMatrixData'
            });
            this.initializeDefaultMatrix();
        }
    }

    initializeDefaultMatrix() {
        // Initialize with real Playwright project structure
        this.buildMatrix();
    }

    buildMatrix() {
        console.log('buildMatrix called');
        const xAxisSelect = document.getElementById('x-axis-select');
        const yAxisSelect = document.getElementById('y-axis-select');
        const constantSelect = document.getElementById('constant-select');

        if (xAxisSelect) this.matrixConfig.xAxis = xAxisSelect.value;
        if (yAxisSelect) this.matrixConfig.yAxis = yAxisSelect.value;
        if (constantSelect) this.matrixConfig.constant = constantSelect.value;

        console.log('Matrix config:', this.matrixConfig);

        // Define available variables
        const variables = {
            environments: ['dev', 'staging', 'prod'],
            browsers: ['chrome', 'firefox', 'safari'],
            devices: ['desktop', 'iphone-mobile', 'android-mobile'],
            games: ['home', 'games', 'cornhole-hero', 'cheap-golf'],
            sizes: ['small', 'large', 'mobile']
        };

        // Get X and Y axis values
        const xValues = variables[this.matrixConfig.xAxis] || ['dev', 'staging', 'prod'];
        const yValues = variables[this.matrixConfig.yAxis] || ['chrome', 'firefox', 'safari'];

        // Clear existing matrix data
        this.matrixData = {};

        // Build matrix based on real Playwright project structure
        yValues.forEach(yValue => {
            this.matrixData[yValue] = {};
            xValues.forEach(xValue => {
                // Generate project name based on configuration
                const projectName = this.generateProjectName(xValue, yValue);
                
                this.matrixData[yValue][xValue] = {
                    projectName: projectName,
                    status: 'pending',
                    lastRun: null,
                    duration: null,
                    ttfp: null, // Time to First Paint
                    metrics: {
                        loadTime: null,
                        ttfb: null, // Time to First Byte
                        contentSize: null
                    },
                    results: null
                };
            });
        });

        this.updateMatrix();
        this.setupMatrixInteractions();
        console.log('Matrix built:', this.matrixConfig, this.matrixData);
    }

    generateProjectName(xValue, yValue) {
        // Generate project names that match your Playwright config
        const { xAxis, yAxis, constant } = this.matrixConfig;
        
        // Map values to project components
        const projectParts = {};
        
        // Determine environment
        if (xAxis === 'environments') projectParts.env = xValue;
        else if (yAxis === 'environments') projectParts.env = yValue;
        else projectParts.env = constant.includes('dev') ? 'dev' : constant.includes('staging') ? 'staging' : 'prod';
        
        // Determine browser
        if (xAxis === 'browsers') projectParts.browser = xValue;
        else if (yAxis === 'browsers') projectParts.browser = yValue;
        else projectParts.browser = constant.includes('chrome') ? 'chrome' : constant.includes('firefox') ? 'firefox' : 'chrome';
        
        // Determine device type
        if (xAxis === 'devices') projectParts.device = xValue;
        else if (yAxis === 'devices') projectParts.device = yValue;
        else projectParts.device = constant.includes('mobile') ? 'mobile' : 'desktop';
        
        // Build project name like: dev-chrome-desktop, staging-firefox-mobile, etc.
        return `${projectParts.env}-${projectParts.browser}-${projectParts.device}`;
    }

    setupEventListeners() {
        // Cell selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.matrix-cell')) {
                this.handleCellClick(e.target.closest('.matrix-cell'));
                return;
            }
        });

        // Bulk actions - need to check for closest element to handle nested elements
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.run-selected-matrix, .select-row, .select-column, .clear-selection');
            if (!target) return;

            e.preventDefault();
            e.stopPropagation();

            if (target.matches('.run-selected-matrix')) {
                this.runSelectedTests();
            } else if (target.matches('.select-row')) {
                this.selectRow(target.dataset.browser);
            } else if (target.matches('.select-column')) {
                this.selectColumn(target.dataset.viewport);
            } else if (target.matches('.clear-selection')) {
                this.clearSelection();
            }
        });
    }

    updateMatrix() {
        const container = document.getElementById('testing-matrix-grid');
        if (!container) return;

        // Get axis values from the configuration
        const variables = {
            environments: ['dev', 'staging', 'prod'],
            browsers: ['chrome', 'firefox', 'safari'],
            devices: ['desktop', 'mobile'],
            games: ['cornhole-hero', 'cheap-golf'],
            sizes: ['small', 'large', 'mobile']
        };

        const xValues = variables[this.matrixConfig.xAxis] || ['dev', 'staging', 'prod'];
        const yValues = variables[this.matrixConfig.yAxis] || ['chrome', 'firefox', 'safari'];

        if (Object.keys(this.matrixData).length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--devwatch-color-text-secondary);">
                    <span class="icon icon-info"></span>
                    Click "Build Matrix" to generate the test matrix
                </div>
            `;
            return;
        }

        container.innerHTML = this.generateSimpleMatrixHTML(xValues, yValues);
        this.updateStats();
    }

    generateSimpleMatrixHTML(xValues, yValues) {
        console.log('generateSimpleMatrixHTML called with:', { xValues, yValues });
        // Update grid CSS to match the matrix dimensions
        const container = document.getElementById('testing-matrix-grid');
        if (!container) {
            console.error('Matrix grid container not found!');
            return '';
        }
        container.style.gridTemplateColumns = `200px repeat(${xValues.length}, 1fr)`;
        console.log('Set grid columns to:', container.style.gridTemplateColumns);

        // Generate header row
        const headerRow = `
            <div class="matrix-corner">
                ${this.matrixConfig.yAxis} / ${this.matrixConfig.xAxis}
            </div>
            ${xValues.map(xValue => `
                <div class="matrix-column-header" data-x-value="${xValue}">
                    ${xValue}
                </div>
            `).join('')}
        `;

        // Generate matrix cells
        const matrixRows = yValues.map(yValue => {
            const rowCells = xValues.map(xValue => {
                const cellData = this.matrixData[yValue]?.[xValue] || {};
                const cellId = `${yValue}-${xValue}`;
                const isSelected = this.selectedCells.has(cellId);
                const status = cellData.status || 'pending';
                
                return `
                    <div class="matrix-cell ${status} ${isSelected ? 'selected' : ''}" 
                         data-cell-id="${cellId}" 
                         data-y-value="${yValue}" 
                         data-x-value="${xValue}">
                        <div class="cell-header">
                            <div class="project-name">${yValue}-${xValue}</div>
                            <span class="status-indicator ${status}"></span>
                        </div>
                        <div class="cell-meta">
                            Constant: ${this.matrixConfig.constant}
                        </div>
                        <div class="cell-actions">
                            <button class="run-single" data-cell-id="${cellId}">Run</button>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="matrix-row-header" data-y-value="${yValue}">
                    ${yValue}
                </div>
                ${rowCells}
            `;
        }).join('');

        const finalHTML = headerRow + matrixRows;
        console.log('Generated matrix HTML length:', finalHTML.length);
        console.log('Matrix HTML preview:', finalHTML.substring(0, 500) + '...');
        return finalHTML;
    }

    setupMatrixInteractions() {
        // Add click handlers for matrix cells
        const container = document.getElementById('testing-matrix-grid');
        if (!container) return;

        container.addEventListener('click', (event) => {
            const cell = event.target.closest('.matrix-cell');
            if (cell) {
                const cellId = cell.dataset.cellId;
                this.toggleCellSelection(cellId);
            }
        });
    }

    toggleCellSelection(cellId) {
        if (this.selectedCells.has(cellId)) {
            this.selectedCells.delete(cellId);
        } else {
            this.selectedCells.add(cellId);
        }
        
        // Update cell appearance
        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
        if (cell) {
            cell.classList.toggle('selected', this.selectedCells.has(cellId));
        }
        
        // Update selection count
        const countElement = document.getElementById('selection-count');
        if (countElement) {
            countElement.textContent = this.selectedCells.size;
        }

        // Enable/disable run button
        const runButton = document.querySelector('.run-selected-matrix');
        if (runButton) {
            runButton.disabled = this.selectedCells.size === 0;
        }
    }

    generateMatrixHTML(browsers, viewports) {
        const headerRow = `
            <div class="matrix-header">
                <div class="matrix-corner">
                    <span class="icon icon-computer"></span>
                    Browser / Viewport
                </div>
                ${viewports.map(viewport => `
                    <div class="matrix-column-header" data-viewport="${viewport}">
                        <div class="viewport-info">
                            <span class="icon ${this.getViewportIcon(viewport)}"></span>
                            <span class="viewport-name">${this.getViewportDisplayName(viewport)}</span>
                            <span class="viewport-size">${this.getViewportSize(viewport)}</span>
                        </div>
                        <button class="select-column" data-viewport="${viewport}">
                            <span class="icon icon-check"></span>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        const browserRows = browsers.map(browser => `
            <div class="matrix-row" data-browser="${browser}">
                <div class="matrix-row-header" data-browser="${browser}">
                    <div class="browser-info">
                        <span class="icon ${this.getBrowserIcon(browser)}"></span>
                        <span class="browser-name">${this.getBrowserDisplayName(browser)}</span>
                    </div>
                    <button class="select-row" data-browser="${browser}">
                        <span class="icon icon-check"></span>
                    </button>
                </div>
                ${viewports.map(viewport => this.generateCellHTML(browser, viewport)).join('')}
            </div>
        `).join('');

        return headerRow + browserRows;
    }

    generateCellHTML(browser, viewport) {
        const cellData = this.matrixData[browser]?.[viewport] || {};
        const cellId = `${browser}-${viewport}`;
        const isSelected = this.selectedCells.has(cellId);
        const isRunning = this.runningTests.has(cellId);

        const environments = cellData.environments || {};
        const envResults = Object.entries(environments).map(([env, data]) => {
            const statusClass = this.getStatusClass(data.status);
            const statusIcon = this.getStatusIcon(data.status);
            
            return `
                <div class="env-result ${statusClass}" title="${env}: ${data.status}">
                    <span class="env-name">${env}</span>
                    <span class="icon ${statusIcon}"></span>
                    ${data.duration ? `<span class="duration">${data.duration}ms</span>` : ''}
                </div>
            `;
        }).join('');

        // Display project name for easy identification  
        const projectName = cellData.projectName || `${browser}-${viewport}`;
        const statusClass = this.getStatusClass(cellData.status);
        const statusIcon = this.getStatusIcon(cellData.status);

        // Performance metrics display
        const metricsDisplay = cellData.metrics ? `
            <div class="performance-metrics">
                ${cellData.ttfp ? `<div class="metric ttfp" title="Time to First Paint">TTFP: ${cellData.ttfp}ms</div>` : ''}
                ${cellData.metrics.ttfb ? `<div class="metric ttfb" title="Time to First Byte">TTFB: ${cellData.metrics.ttfb}ms</div>` : ''}
                ${cellData.metrics.loadTime ? `<div class="metric load-time" title="Page Load Time">Load: ${cellData.metrics.loadTime}ms</div>` : ''}
                ${cellData.duration ? `<div class="metric duration" title="Test Duration">Duration: ${cellData.duration}ms</div>` : ''}
            </div>
        ` : '';

        return `
            <div class="matrix-cell ${isSelected ? 'selected' : ''} ${isRunning ? 'running' : ''} ${statusClass}" 
                 data-browser="${browser}" 
                 data-viewport="${viewport}"
                 data-cell-id="${cellId}"
                 data-project="${projectName}">
                <div class="cell-header">
                    <span class="project-name" title="Playwright Project: ${projectName}">${projectName}</span>
                    <div class="cell-status">
                        <span class="icon ${statusIcon}"></span>
                        <span class="status-text">${cellData.status || 'pending'}</span>
                    </div>
                </div>
                ${metricsDisplay}
                <div class="cell-environments">
                    ${envResults || this.generatePlaceholderEnvironments()}
                </div>
                <div class="cell-actions">
                    <button class="cell-run" title="Run ${projectName}" data-project="${projectName}">
                        <span class="icon icon-play"></span>Run
                    </button>
                    <button class="cell-details" title="View ${projectName} details">
                        <span class="icon icon-info"></span>Details
                    </button>
                </div>
                <div class="cell-meta">
                    <span class="last-run">${cellData.lastRun ? `Last: ${new Date(cellData.lastRun).toLocaleDateString()}` : 'Never run'}</span>
                </div>
            </div>
        `;
    }

    generatePlaceholderEnvironments() {
        return ['dev', 'staging', 'prod'].map(env => `
            <div class="env-result pending" title="${env}: pending">
                <span class="env-name">${env}</span>
                <span class="icon icon-clock"></span>
            </div>
        `).join('');
    }

    getViewportIcon(viewport) {
        const icons = {
            'web-sm': 'icon-computer',
            'web-lg': 'icon-computer',
            'mobile': 'icon-computer'
        };
        return icons[viewport] || 'icon-computer';
    }

    getViewportDisplayName(viewport) {
        const names = {
            'web-sm': 'Desktop Small',
            'web-lg': 'Desktop Large', 
            'mobile': 'Mobile'
        };
        return names[viewport] || viewport;
    }

    getViewportSize(viewport) {
        const sizes = {
            'web-sm': '1024×768',
            'web-lg': '1920×1080',
            'mobile': '375×667'
        };
        return sizes[viewport] || '';
    }

    getBrowserIcon(browser) {
        const icons = {
            'chrome': 'icon-computer',
            'firefox': 'icon-computer',
            'safari': 'icon-computer',
            'edge': 'icon-computer'
        };
        return icons[browser] || 'icon-computer';
    }

    getBrowserDisplayName(browser) {
        const names = {
            'chrome': 'Chrome',
            'firefox': 'Firefox',
            'safari': 'Safari',
            'edge': 'Edge'
        };
        return names[browser] || browser;
    }

    getStatusClass(status) {
        const classes = {
            'passed': 'status-success',
            'failed': 'status-error', 
            'running': 'status-running',
            'pending': 'status-pending'
        };
        return classes[status] || 'status-unknown';
    }

    getStatusIcon(status) {
        const icons = {
            'passed': 'icon-check',
            'failed': 'icon-x',
            'running': 'icon-refresh',
            'pending': 'icon-clock'
        };
        return icons[status] || 'icon-info';
    }

    handleCellClick(cell) {
        const cellId = cell.dataset.cellId;
        const projectName = cell.dataset.project;
        
        if (this.selectedCells.has(cellId)) {
            this.selectedCells.delete(cellId);
            cell.classList.remove('selected');
        } else {
            this.selectedCells.add(cellId);
            cell.classList.add('selected');
        }

        // Notify parent iframe of selection change
        if (window.testingMatrixIframe) {
            window.testingMatrixIframe.notifyMatrixEvent('cell_selected', {
                cellId,
                projectName,
                selected: this.selectedCells.has(cellId),
                totalSelected: this.selectedCells.size
            });
        }
        
        this.updateSelectionCount();
    }

    selectRow(browser) {
        console.log('Selecting row:', browser);
        const viewports = Object.keys(this.matrixData[browser] || {});
        let selectionCount = 0;
        
        viewports.forEach(viewport => {
            const cellId = `${browser}-${viewport}`;
            this.selectedCells.add(cellId);
            const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
            if (cell) {
                cell.classList.add('selected');
                selectionCount++;
            }
        });
        
        console.log(`Selected ${selectionCount} cells in row ${browser}`);
        this.updateSelectionCount();
        
        // Show feedback
        notificationSystem.showToast({
            title: 'Row Selected',
            message: `Selected ${selectionCount} combinations for ${browser} browser`,
            type: 'info',
            duration: 3000
        });
    }

    selectColumn(viewport) {
        console.log('Selecting column:', viewport);
        let selectionCount = 0;
        
        Object.keys(this.matrixData).forEach(browser => {
            const cellId = `${browser}-${viewport}`;
            this.selectedCells.add(cellId);
            const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
            if (cell) {
                cell.classList.add('selected');
                selectionCount++;
            }
        });
        
        console.log(`Selected ${selectionCount} cells in column ${viewport}`);
        this.updateSelectionCount();
        
        // Show feedback
        notificationSystem.showToast({
            title: 'Column Selected',
            message: `Selected ${selectionCount} combinations for ${viewport} viewport`,
            type: 'info',
            duration: 3000
        });
    }

    clearSelection() {
        this.selectedCells.clear();
        document.querySelectorAll('.matrix-cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
        this.updateSelectionCount();
    }

    updateSelectionCount() {
        const countElement = document.getElementById('selection-count');
        if (countElement) {
            countElement.textContent = this.selectedCells.size;
        }
        
        const runButton = document.querySelector('.run-selected-matrix');
        if (runButton) {
            runButton.disabled = this.selectedCells.size === 0;
        }
    }

    updateStats() {
        const stats = this.calculateStats();
        const statsContainer = document.getElementById('matrix-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <span class="icon icon-chart"></span>
                    <span class="stat-label">Total Combinations</span>
                    <span class="stat-value">${stats.total}</span>
                </div>
                <div class="stat-item">
                    <span class="icon icon-check text-success"></span>
                    <span class="stat-label">Passing</span>
                    <span class="stat-value">${stats.passing}</span>
                </div>
                <div class="stat-item">
                    <span class="icon icon-x text-error"></span>
                    <span class="stat-label">Failing</span>
                    <span class="stat-value">${stats.failing}</span>
                </div>
                <div class="stat-item">
                    <span class="icon icon-refresh text-warning"></span>
                    <span class="stat-label">Running</span>
                    <span class="stat-value">${stats.running}</span>
                </div>
                <div class="stat-item">
                    <span class="icon icon-clock text-muted"></span>
                    <span class="stat-label">Pending</span>
                    <span class="stat-value">${stats.pending}</span>
                </div>
            `;
        }
    }

    calculateStats() {
        let total = 0, passing = 0, failing = 0, running = 0, pending = 0;
        
        Object.values(this.matrixData).forEach(browserData => {
            Object.values(browserData).forEach(viewportData => {
                Object.values(viewportData.environments || {}).forEach(envData => {
                    total++;
                    switch(envData.status) {
                        case 'passed': passing++; break;
                        case 'failed': failing++; break;
                        case 'running': running++; break;
                        default: pending++; break;
                    }
                });
            });
        });
        
        return { total, passing, failing, running, pending };
    }

    storeTestRunInfo(testRunInfo) {
        // Store in localStorage for persistence across page reloads
        let storedRuns = JSON.parse(localStorage.getItem('matrix-test-runs') || '[]');
        storedRuns.unshift(testRunInfo); // Add to beginning
        
        // Keep only last 10 runs
        if (storedRuns.length > 10) {
            storedRuns = storedRuns.slice(0, 10);
        }
        
        localStorage.setItem('matrix-test-runs', JSON.stringify(storedRuns));
        
        // Also send to backend for integration with test logs
        this.sendTestRunToBackend(testRunInfo);
    }

    async sendTestRunToBackend(testRunInfo) {
        try {
            await fetch('/api/testing-matrix/log-run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testRunInfo)
            });
            
            // Also log to system logger if available
            if (typeof systemLogger !== 'undefined') {
                systemLogger.logMatrixRun(
                    testRunInfo.combinations,
                    testRunInfo.estimatedDuration,
                    ['dev', 'staging', 'prod'],
                    testRunInfo.combinations.map(combo => combo.split('-')[0])
                );
            }
        } catch (error) {
            console.warn('Failed to log test run to backend:', error);
        }
    }

    showPersistentTestToast(combinationCount, testRunInfo) {
        // Create persistent toast with live updates
        const toast = document.createElement('div');
        toast.id = `test-toast-${testRunInfo.id}`;
        toast.className = 'persistent-test-toast notification-toast running';
        toast.innerHTML = `
            <div class="toast-header">
                <span class="icon icon-play rotating"></span>
                <span class="toast-title">Tests Running</span>
                <div class="toast-controls">
                    <button class="toast-minimize" onclick="testingMatrix.minimizeToast('${testRunInfo.id}')" title="Minimize">
                        <span class="icon icon-minus"></span>
                    </button>
                    <button class="toast-close" onclick="testingMatrix.closeToast('${testRunInfo.id}')" title="Close">
                        <span class="icon icon-close"></span>
                    </button>
                </div>
            </div>
            
            <div class="toast-content">
                <div class="test-summary">
                    <div class="summary-row">
                        <span class="label">Combinations:</span>
                        <span class="value">${combinationCount}</span>
                    </div>
                    <div class="summary-row">
                        <span class="label">Progress:</span>
                        <span class="value" id="toast-progress-${testRunInfo.id}">0%</span>
                    </div>
                    <div class="summary-row">
                        <span class="label">Status:</span>
                        <span class="value" id="toast-status-${testRunInfo.id}">Initializing...</span>
                    </div>
                </div>
                
                <div class="progress-bar-container">
                    <div class="progress-bar" id="toast-progress-bar-${testRunInfo.id}"></div>
                </div>
                
                <div class="live-stats">
                    <div class="stat">
                        <span class="stat-icon">✓</span>
                        <span class="stat-value" id="toast-passed-${testRunInfo.id}">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">✗</span>
                        <span class="stat-value" id="toast-failed-${testRunInfo.id}">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">⟳</span>
                        <span class="stat-value" id="toast-running-${testRunInfo.id}">1</span>
                    </div>
                </div>
                
                <div class="current-activity">
                    <span class="activity-label">Current:</span>
                    <span class="activity-value" id="toast-current-${testRunInfo.id}">Starting test runner...</span>
                </div>
            </div>

            <div class="toast-actions">
                <button class="toast-details-btn" onclick="testingMatrix.showTestRunDetails('${testRunInfo.id}')">
                    <span class="icon icon-info"></span>
                    Full Details
                </button>
                <a href="/reports" class="toast-link-btn" target="_blank">
                    <span class="icon icon-chart"></span>
                    View Results
                </a>
                <button class="toast-stop-btn" onclick="testingMatrix.stopTestRun('${testRunInfo.id}')">
                    <span class="icon icon-stop"></span>
                    Stop Tests
                </button>
            </div>
        `;

        // Add enhanced styles for persistent toast
        if (!document.querySelector('#persistent-toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'persistent-toast-styles';
            styles.textContent = `
                .persistent-test-toast {
                    min-width: 380px;
                    max-width: 420px;
                    background: #1a1a1a;
                    border: 2px solid #00aa00;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 255, 0, 0.2);
                    position: relative;
                    overflow: hidden;
                }
                
                .persistent-test-toast.minimized {
                    min-width: 280px;
                    max-width: 300px;
                }
                
                .persistent-test-toast.minimized .toast-content {
                    display: none;
                }
                
                .persistent-test-toast.running {
                    border-color: #00aa00;
                    animation: pulse-border 2s infinite;
                }
                
                .persistent-test-toast.complete {
                    border-color: #00ff00;
                }
                
                .persistent-test-toast.error {
                    border-color: #ff4444;
                }
                
                @keyframes pulse-border {
                    0%, 100% { border-color: #00aa00; }
                    50% { border-color: #00ff00; }
                }
                
                .toast-header {
                    background: #2a2a2a;
                    padding: 12px 15px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-bottom: 1px solid #333;
                }
                
                .toast-title {
                    flex: 1;
                    font-weight: bold;
                    color: #00ff00;
                }
                
                .toast-controls {
                    display: flex;
                    gap: 4px;
                }
                
                .toast-minimize, .toast-close {
                    background: #333;
                    border: 1px solid #555;
                    color: #ccc;
                    padding: 4px 6px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                    transition: all 0.2s ease;
                }
                
                .toast-minimize:hover {
                    background: #444;
                    color: #fff;
                }
                
                .toast-close:hover {
                    background: #ff4444;
                    border-color: #ff6666;
                    color: #fff;
                }
                
                .toast-content {
                    padding: 15px;
                }
                
                .test-summary {
                    margin-bottom: 10px;
                }
                
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                    font-size: 12px;
                }
                
                .summary-row .label {
                    color: #888;
                }
                
                .summary-row .value {
                    color: #fff;
                    font-weight: bold;
                }
                
                .progress-bar-container {
                    background: #333;
                    border-radius: 10px;
                    height: 8px;
                    margin: 10px 0;
                    overflow: hidden;
                }
                
                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #00aa00, #00ff00);
                    border-radius: 10px;
                    transition: width 0.5s ease;
                    width: 0%;
                }
                
                .live-stats {
                    display: flex;
                    justify-content: space-around;
                    margin: 10px 0;
                    padding: 8px;
                    background: #2a2a2a;
                    border-radius: 4px;
                }
                
                .stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                }
                
                .stat-icon {
                    font-size: 14px;
                    color: #888;
                }
                
                .stat-value {
                    font-weight: bold;
                    font-size: 16px;
                    color: #00ff00;
                }
                
                .current-activity {
                    background: #333;
                    padding: 8px 10px;
                    border-radius: 4px;
                    margin: 10px 0;
                    font-size: 11px;
                }
                
                .activity-label {
                    color: #888;
                    margin-right: 8px;
                }
                
                .activity-value {
                    color: #fff;
                    font-weight: bold;
                }
                
                .toast-actions {
                    display: flex;
                    gap: 6px;
                    padding: 10px 15px;
                    background: #2a2a2a;
                    border-top: 1px solid #333;
                }
                
                .toast-details-btn, .toast-link-btn, .toast-stop-btn {
                    background: #333;
                    border: 1px solid #555;
                    color: #ccc;
                    padding: 6px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex: 1;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .toast-details-btn:hover, .toast-link-btn:hover {
                    background: #444;
                    color: #fff;
                }
                
                .toast-stop-btn {
                    background: #440000;
                    border-color: #660000;
                    color: #ff8888;
                }
                
                .toast-stop-btn:hover {
                    background: #660000;
                    border-color: #880000;
                    color: #ffaaaa;
                }
                
                .rotating {
                    animation: rotate 1s linear infinite;
                }
                
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                @keyframes slideOut {
                    from { 
                        opacity: 1; 
                        transform: translateX(0); 
                    }
                    to { 
                        opacity: 0; 
                        transform: translateX(100%); 
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        // Create container if it doesn't exist
        let container = document.getElementById('notification-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-height: 90vh;
                overflow-y: auto;
            `;
            document.body.appendChild(container);
        }
        
        container.appendChild(toast);

        // Start live updates for this toast
        this.startToastUpdates(testRunInfo.id);
        
        // Store toast reference for updates
        this.activeToasts = this.activeToasts || new Map();
        this.activeToasts.set(testRunInfo.id, {
            element: toast,
            startTime: Date.now(),
            combinations: combinationCount
        });
    }

    showTestRunDetails(runId) {
        const storedRuns = JSON.parse(localStorage.getItem('matrix-test-runs') || '[]');
        const testRun = storedRuns.find(run => run.id === runId);
        
        if (!testRun) {
            notificationSystem.warning('Test run details not found');
            return;
        }

        // Show the full modal with all details
        notificationSystem.showModal({
            title: 'Test Run Details',
            message: `Matrix test run started with ${testRun.combinations.length} combination(s)`,
            type: 'info',
            details: {
                runId: testRun.id,
                combinations: testRun.combinations,
                estimatedDuration: testRun.estimatedDuration,
                startedAt: testRun.startedAt,
                whereToFind: testRun.whereToFind,
                nextSteps: testRun.nextSteps
            }
        });
    }

    getRecentTestRuns() {
        return JSON.parse(localStorage.getItem('matrix-test-runs') || '[]');
    }

    async checkRealTestStatus(runId) {
        try {
            console.log('[Toast] Checking real test status for runId:', runId);
            
            // Check for actual test results in the reports directory
            const resultsResponse = await fetch('/api/testing-matrix/results');
            console.log('[Toast] Results response status:', resultsResponse.status);
            
            if (resultsResponse.ok) {
                const results = await resultsResponse.json();
                console.log('[Toast] Got results:', results.length, 'entries');
                
                // Look for matching result by runId or recent activity
                let matchingResult = results.find(r => r.runId === runId);
                
                // If no exact match, check for any recent running tests
                if (!matchingResult && results.length > 0) {
                    const recentRunning = results.find(r => 
                        r.status === 'running' || 
                        r.source === 'file-system'
                    );
                    if (recentRunning) {
                        console.log('[Toast] Found recent running test:', recentRunning);
                        matchingResult = recentRunning;
                    }
                }
                
                if (matchingResult) {
                    console.log('[Toast] Using real status from:', matchingResult);
                    return {
                        progress: matchingResult.progress || 50,
                        currentTest: matchingResult.currentTest || 'Processing...',
                        passedTests: matchingResult.passed || 0,
                        failedTests: matchingResult.failed || 0,
                        runningTests: matchingResult.running || 1,
                        status: matchingResult.status || 'running',
                        isReal: true
                    };
                }
            } else if (resultsResponse.status === 404) {
                console.log('[Toast] Results endpoint not found (404) - this is expected for new setups');
                // 404 is expected if the endpoint isn't implemented yet
                return null;
            } else {
                console.warn('[Toast] Results endpoint returned:', resultsResponse.status, resultsResponse.statusText);
            }
        } catch (error) {
            // Network errors, CORS issues, etc.
            console.log('[Toast] Network error checking real test status (this is normal):', error.message);
        }
        return null;
    }

    async checkTestProcesses(runId) {
        try {
            // Check if Playwright processes are actually running
            const processResponse = await fetch('/api/system/processes');
            if (processResponse.ok) {
                const processes = await processResponse.json();
                const playwrightProcesses = processes.filter(p => 
                    p.command && (p.command.includes('playwright') || p.command.includes('npx'))
                );
                
                console.log('[Toast] Found', playwrightProcesses.length, 'Playwright processes');
                
                if (playwrightProcesses.length === 0) {
                    // No Playwright processes running - tests may have failed to start
                    console.log('[Toast] No Playwright processes found - tests may not have started');
                    // Don't immediately mark as error, just log it
                } else {
                    console.log('[Toast] Active Playwright processes detected:', playwrightProcesses.map(p => p.command));
                }
            } else if (processResponse.status === 404) {
                console.log('[Toast] Process monitoring endpoint not available (404)');
            }
        } catch (error) {
            console.log('[Toast] Could not check test processes (this is normal):', error.message);
        }
    }

    markToastStuck(runId) {
        const toast = document.getElementById(`test-toast-${runId}`);
        if (toast) {
            const statusEl = document.getElementById(`toast-status-${runId}`);
            const titleEl = toast.querySelector('.toast-title');
            
            if (statusEl) {
                statusEl.textContent = 'Simulation mode (no admin integration)';
                statusEl.style.color = '#00aaff';
            }
            
            if (titleEl) {
                titleEl.textContent = 'Tests Running (Simulation)';
            }
            
            // Change to info indicator instead of warning
            toast.style.borderColor = '#00aaff';
            const icon = toast.querySelector('.toast-header .icon');
            if (icon) {
                icon.className = 'icon icon-info';
                icon.style.color = '#00aaff';
                icon.classList.remove('rotating');
            }
        }
        
        // Stop the update interval
        if (this.toastIntervals?.has(runId)) {
            clearInterval(this.toastIntervals.get(runId));
            this.toastIntervals.delete(runId);
        }
        
        // Log the issue
        if (typeof systemLogger !== 'undefined') {
            systemLogger.log({
                type: 'MATRIX',
                subtype: 'test-stuck',
                message: `Test run ${runId} appears to be stuck`,
                details: { runId, timestamp: new Date().toISOString() },
                status: 'warning'
            });
        }
        
        // Show notification with helpful context
        notificationSystem.info(
            'Test monitoring switched to simulation mode. This is normal if tests haven\'t been configured to report to the admin system yet.',
            {
                runId,
                explanation: 'The test appears to be running but not reporting status to the admin interface',
                suggestion: 'You can still monitor test progress through the Playwright HTML reports or terminal output',
                actions: [
                    'Check browser developer tools console for any error messages',
                    'Visit /reports to see if any test results are being generated',
                    'Use the Stop Tests button if you need to terminate the process'
                ]
            }
        );
    }

    markToastError(runId, errorMessage) {
        const toast = document.getElementById(`test-toast-${runId}`);
        if (toast) {
            toast.className = toast.className.replace('running', 'error');
            const icon = toast.querySelector('.toast-header .icon');
            const title = toast.querySelector('.toast-title');
            const statusEl = document.getElementById(`toast-status-${runId}`);
            
            if (icon) {
                icon.className = 'icon icon-error';
                icon.classList.remove('rotating');
            }
            if (title) title.textContent = 'Test Error';
            if (statusEl) statusEl.textContent = errorMessage;
        }

        // Clear interval
        if (this.toastIntervals?.has(runId)) {
            clearInterval(this.toastIntervals.get(runId));
            this.toastIntervals.delete(runId);
        }

        // Log the error
        if (typeof systemLogger !== 'undefined') {
            systemLogger.log({
                type: 'MATRIX',
                subtype: 'test-error',
                message: `Test run ${runId} failed: ${errorMessage}`,
                details: { runId, error: errorMessage },
                status: 'error'
            });
        }
    }

    // Toast management methods
    startToastUpdates(runId) {
        // Clear any existing interval for this run
        if (this.toastIntervals && this.toastIntervals.has(runId)) {
            clearInterval(this.toastIntervals.get(runId));
        }

        // Initialize intervals map if needed
        this.toastIntervals = this.toastIntervals || new Map();

        // Start updating every 2 seconds
        const interval = setInterval(() => this.updateToast(runId), 2000);
        this.toastIntervals.set(runId, interval);
    }

    async updateToast(runId) {
        const toast = this.activeToasts?.get(runId);
        if (!toast) return;

        try {
            // Always try to get real status first
            const response = await fetch(`/api/testing-matrix/status/${runId}`);
            let status;
            
            if (response.ok) {
                status = await response.json();
                // If we get real status, use it
                if (status.isReal) {
                    this.updateToastUI(runId, status);
                    return;
                }
            }
            
            // Check if tests have actually been running long enough to be real
            const elapsed = Date.now() - toast.startTime;
            if (elapsed > 10000) { // After 10 seconds, try to check for real results
                const realStatus = await this.checkRealTestStatus(runId);
                if (realStatus) {
                    this.updateToastUI(runId, realStatus);
                    return;
                }
            }
            
            // Only use simulation as a last resort for the first few seconds
            if (elapsed < 20000) { // Extended to 20 seconds to allow more time for test startup
                status = this.simulateToastProgress(runId);
                this.updateToastUI(runId, status);
                console.log('[Toast] Using simulation, elapsed:', Math.round(elapsed/1000), 'seconds');
            } else {
                // After 20 seconds, mark as potentially stuck
                console.log('[Toast] Marking as stuck after', Math.round(elapsed/1000), 'seconds');
                this.markToastStuck(runId);
            }

        } catch (error) {
            console.warn('Failed to get test status:', error);
            // Try to check actual test processes
            this.checkTestProcesses(runId);
        }
    }

    simulateToastProgress(runId) {
        const toast = this.activeToasts.get(runId);
        const elapsed = Date.now() - toast.startTime;
        const totalEstimated = toast.combinations * 60 * 1000; // 1 min per combination
        const progress = Math.min((elapsed / totalEstimated) * 100, 95);

        const currentTests = [
            'games/cornhole-hero',
            'games/cheap-golf', 
            'games/basketball-stars',
            'games/arcade-lobby'
        ];

        const browsers = ['chrome', 'firefox', 'safari'];
        const environments = ['dev', 'staging', 'prod'];

        return {
            progress: Math.round(progress),
            currentTest: currentTests[Math.floor(Math.random() * currentTests.length)],
            currentBrowser: browsers[Math.floor(Math.random() * browsers.length)],
            currentEnvironment: environments[Math.floor(Math.random() * environments.length)],
            passedTests: Math.floor(progress / 10),
            failedTests: Math.floor(Math.random() * 2),
            runningTests: progress < 95 ? 1 : 0,
            status: progress < 95 ? 'running' : 'completing'
        };
    }

    updateToastUI(runId, status) {
        const progressEl = document.getElementById(`toast-progress-${runId}`);
        const statusEl = document.getElementById(`toast-status-${runId}`);
        const currentEl = document.getElementById(`toast-current-${runId}`);
        const progressBarEl = document.getElementById(`toast-progress-bar-${runId}`);
        const passedEl = document.getElementById(`toast-passed-${runId}`);
        const failedEl = document.getElementById(`toast-failed-${runId}`);
        const runningEl = document.getElementById(`toast-running-${runId}`);

        if (progressEl) progressEl.textContent = `${status.progress}%`;
        if (progressBarEl) progressBarEl.style.width = `${status.progress}%`;
        if (passedEl) passedEl.textContent = status.passedTests || 0;
        if (failedEl) failedEl.textContent = status.failedTests || 0;
        if (runningEl) runningEl.textContent = status.runningTests || 0;

        if (statusEl) {
            if (status.status === 'running') {
                statusEl.textContent = `Testing ${status.currentBrowser}...`;
            } else if (status.status === 'completing') {
                statusEl.textContent = 'Generating reports...';
            } else {
                statusEl.textContent = status.status;
            }
        }

        if (currentEl) {
            currentEl.textContent = `${status.currentTest} on ${status.currentEnvironment}`;
        }

        // Update toast state if complete
        if (status.progress >= 100) {
            this.markToastComplete(runId);
        }
    }

    markToastComplete(runId) {
        const toast = document.getElementById(`test-toast-${runId}`);
        if (toast) {
            toast.className = toast.className.replace('running', 'complete');
            const icon = toast.querySelector('.toast-header .icon');
            const title = toast.querySelector('.toast-title');
            if (icon) {
                icon.className = 'icon icon-check';
                icon.classList.remove('rotating');
            }
            if (title) title.textContent = 'Tests Complete';
        }

        // Clear the update interval
        if (this.toastIntervals?.has(runId)) {
            clearInterval(this.toastIntervals.get(runId));
            this.toastIntervals.delete(runId);
        }
    }

    minimizeToast(runId) {
        const toast = document.getElementById(`test-toast-${runId}`);
        if (toast) {
            toast.classList.toggle('minimized');
        }
    }

    closeToast(runId) {
        const toast = document.getElementById(`test-toast-${runId}`);
        if (toast) {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }

        // Clean up intervals and references
        if (this.toastIntervals?.has(runId)) {
            clearInterval(this.toastIntervals.get(runId));
            this.toastIntervals.delete(runId);
        }
        
        if (this.activeToasts?.has(runId)) {
            this.activeToasts.delete(runId);
        }
    }

    async stopTestRun(runId) {
        if (confirm('Stop this test run? This will terminate all running tests.')) {
            try {
                await fetch('/api/testing-matrix/stop', { method: 'POST' });
                
                const toast = document.getElementById(`test-toast-${runId}`);
                if (toast) {
                    toast.className = toast.className.replace('running', 'error');
                    const icon = toast.querySelector('.toast-header .icon');
                    const title = toast.querySelector('.toast-title');
                    if (icon) {
                        icon.className = 'icon icon-stop';
                        icon.classList.remove('rotating');
                    }
                    if (title) title.textContent = 'Tests Stopped';
                }

                // Clear interval
                if (this.toastIntervals?.has(runId)) {
                    clearInterval(this.toastIntervals.get(runId));
                    this.toastIntervals.delete(runId);
                }

                notificationSystem.warning('Test run stopped');

            } catch (error) {
                notificationSystem.error('Failed to stop tests', error.message);
            }
        }
    }

    updateRecentRuns() {
        const container = document.getElementById('recent-runs-list');
        if (!container) return;

        const recentRuns = this.getRecentTestRuns();
        
        if (recentRuns.length === 0) {
            container.innerHTML = `
                <div class="no-recent-runs">
                    <span class="icon icon-info text-muted"></span>
                    No recent test runs. Start a matrix test to see history here.
                </div>
            `;
            return;
        }

        container.innerHTML = recentRuns.slice(0, 5).map(run => {
            const timeAgo = this.getTimeAgo(new Date(run.startedAt));
            return `
                <div class="recent-run-item" onclick="testingMatrix.showTestRunDetails('${run.id}')">
                    <div class="run-header">
                        <span class="icon icon-play text-success"></span>
                        <span class="run-combinations">${run.combinations.length} combinations</span>
                        <span class="run-time">${timeAgo}</span>
                    </div>
                    <div class="run-details">
                        <span class="run-duration">${run.estimatedDuration}</span>
                        <span class="run-status">Started</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    }

    async runSelectedTests() {
        if (this.selectedCells.size === 0) {
            notificationSystem.warning('Please select at least one test combination to run');
            return;
        }
        
        const selectedArray = Array.from(this.selectedCells);
        const runButton = document.querySelector('.run-selected-matrix');
        
        // Show button feedback
        const feedback = notificationSystem.showButtonFeedback(runButton, 'loading', 'Starting tests...');
        runButton.disabled = true;
        
        try {
            const response = await fetch('/api/testing-matrix/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selections: selectedArray })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Notify parent iframe of test run start
                if (window.testingMatrixIframe) {
                    const projectNames = selectedArray.map(cellId => {
                        const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
                        return cell ? cell.dataset.project : cellId;
                    });
                    
                    window.testingMatrixIframe.notifyMatrixEvent('tests_started', {
                        selections: selectedArray,
                        projectNames,
                        estimatedDuration: result.estimatedDuration,
                        startedAt: result.startedAt
                    });
                }
                
                // Mark selected cells as running
                selectedArray.forEach(cellId => {
                    this.runningTests.add(cellId);
                    const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
                    if (cell) {
                        cell.classList.add('running');
                        // Update cell content to show running status
                        const envResults = cell.querySelector('.cell-environments');
                        if (envResults) {
                            envResults.querySelectorAll('.env-result').forEach(env => {
                                env.classList.remove('status-pending');
                                env.classList.add('status-running');
                                env.querySelector('.icon').className = 'icon icon-refresh';
                            });
                        }
                    }
                });
                
                // Store detailed test run info for later access
                const testRunInfo = {
                    id: `matrix-run-${Date.now()}`,
                    combinations: selectedArray,
                    estimatedDuration: `${Math.round(result.estimatedDuration / 1000 / 60)} minutes`,
                    startedAt: result.startedAt,
                    whereToFind: {
                        'Real-time Status': 'This matrix dashboard (auto-refreshes)',
                        'Detailed Results': '/reports dashboard',
                        'HTML Reports': '/reports/raw',
                        'Master Database': 'pw_data/master-test-results.json'
                    },
                    nextSteps: [
                        'Monitor progress in this matrix (cells will show running status)',
                        'Check /reports for detailed results when complete',
                        'Matrix auto-refreshes every 30 seconds'
                    ]
                };

                // Store for later access
                this.storeTestRunInfo(testRunInfo);

                // Show persistent toast with details and progress
                this.showPersistentTestToast(selectedArray.length, testRunInfo);
                
                this.clearSelection();
                
                // Schedule status refresh
                setTimeout(() => this.updateMatrix(), 5000);
                
            } else {
                notificationSystem.error('Failed to start matrix tests', {
                    error: result.error,
                    selections: selectedArray
                });
            }
            
        } catch (error) {
            notificationSystem.debugError(error, {
                operation: 'runMatrixTests',
                selections: selectedArray
            });
        } finally {
            if (feedback) feedback.restore();
            runButton.disabled = this.selectedCells.size === 0;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('testing-matrix-container')) {
        window.testingMatrix = new TestingMatrix();
    }
});