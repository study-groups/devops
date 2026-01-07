// Cron job management script using PJA Panel System
document.addEventListener('DOMContentLoaded', () => {
    // Map form values to result container IDs
    const envMapping = {
        'dev': 'dev',
        'staging': 'staging', 
        'prod': 'production'
    };

    let resultsStore = {
        dev: [],
        staging: [],
        prod: []
    };

    let layout;
    let panels = {};

    // Health check state management
    let healthCheckState = {
        enabled: false,
        interval: 'every 1 minute',
        environments: [],
        nextTrigger: null,
        countdownTimer: null
    };

    // Initialize the cron interface
    function init() {
        createLayout();
        createPanels();
        loadHealthCheckState();
        loadResults();
        
        // Start polling for results
        setInterval(pollForResults, 5000);
        pollForResults(); // Initial load
    }

    function createLayout() {
        const container = document.getElementById('cron-layout-container');
        if (!container) {
            throw new Error('Cron layout container not found');
        }
        
        layout = new DevWatchColumnLayout({
            id: 'cron-main-layout',
            parentContainer: container,
            leftColumnWidth: 280,
            minLeftWidth: 200,
            maxLeftWidth: 350,
            minRightWidth: 600
        });
        
        window.DevWatchPanelManager.registerLayout(layout);
    }

    function createPanels() {
        // Left Column Panels
        panels.healthChecks = new DevWatchPanel({
            id: 'health-checks-panel',
            title: 'Health Checks',
            content: createHealthChecksContent(),
            position: 'left',
            isCollapsed: false
        });

        panels.manualRun = new DevWatchPanel({
            id: 'manual-run-panel',
            title: 'Manual Run',
            content: createManualRunContent(),
            position: 'left',
            isCollapsed: false
        });

        // Right Column Panels - Environment Results
        panels.devResults = new DevWatchPanel({
            id: 'dev-results-panel',
            title: 'Development',
            content: createResultsContent('dev'),
            position: 'right',
            isCollapsed: false
        });

        panels.stagingResults = new DevWatchPanel({
            id: 'staging-results-panel',
            title: 'Staging',
            content: createResultsContent('staging'),
            position: 'right',
            isCollapsed: false
        });

        panels.productionResults = new DevWatchPanel({
            id: 'production-results-panel',
            title: 'Production',
            content: createResultsContent('prod'),
            position: 'right',
            isCollapsed: false
        });

        // Register and add all panels to layout
        Object.values(panels).forEach(panel => {
            window.DevWatchPanelManager.registerPanel(panel);
            layout.addPanel(panel, panel.position);
        });

        // Setup event handlers after panels are created
        setupEventHandlers();
    }

    function createHealthChecksContent() {
        return `
            <div class="form-group" style="margin-bottom: 1rem;">
                <label class="health-check-master-toggle">
                    <input type="checkbox" id="health-check-enabled" style="margin-right: 8px;">
                    Auto Health Checks
                </label>
                <div id="health-check-countdown" style="font-size: 0.85em; color: var(--devwatch-text-secondary); margin-top: 4px; margin-left: 24px;"></div>
            </div>
            <div class="form-group">
                <label for="health-check-interval">Interval: 
                    <select id="health-check-interval" class="form-control" style="display: inline; width: auto; margin-left: 8px;">
                        <option value="every 1 minute">1 Minute</option>
                        <option value="every 5 minutes">5 Minutes</option>
                        <option value="every 15 minutes">15 Minutes</option>
                        <option value="every 30 minutes">30 Minutes</option>
                        <option value="every 1 hour">1 Hour</option>
                    </select>
                </label>
            </div>
            <div class="env-toggles" id="health-env-toggles">
                <input type="checkbox" id="dev-health-toggle" name="health-env" value="dev">
                <label for="dev-health-toggle">Dev</label>
                <input type="checkbox" id="staging-health-toggle" name="health-env" value="staging">
                <label for="staging-health-toggle">Staging</label>
                <input type="checkbox" id="prod-health-toggle" name="health-env" value="prod">
                <label for="prod-health-toggle">Prod</label>
            </div>
        `;
    }

    function createManualRunContent() {
        return `
            <form id="manual-run-form" class="manual-run-form" onsubmit="return false;">
                <div class="command-input-group">
                    <input type="text" id="manual-command" class="form-control" value="npx playwright test tests/metrics.spec.js">
                    <button type="button" class="btn btn-primary" onclick="submitManualRun()">Run</button>
                </div>
                <div class="env-toggles">
                    <input type="checkbox" id="dev-toggle" name="env" value="dev">
                    <label for="dev-toggle">Dev</label>
                    <input type="checkbox" id="staging-toggle" name="env" value="staging">
                    <label for="staging-toggle">Staging</label>
                    <input type="checkbox" id="prod-toggle" name="env" value="prod">
                    <label for="prod-toggle">Prod</label>
                </div>
            </form>
        `;
    }

    function createResultsContent(env) {
        const mappedEnv = envMapping[env] || env;
        return `
            <div class="env-result-card">
                <div class="env-card-content" id="${mappedEnv}-results-content">
                    <div class="empty-state">No recent results</div>
                </div>
            </div>
        `;
    }

    // Load health check state from server
    const loadHealthCheckState = async () => {
        try {
            const response = await fetch('/api/cron/health-check-state', {
                credentials: 'same-origin'
            });
            if (response.ok) {
                const savedState = await response.json();
                healthCheckState = { ...healthCheckState, ...savedState };
                
                // Restore UI state
                const healthCheckEnabled = document.getElementById('health-check-enabled');
                const healthCheckInterval = document.getElementById('health-check-interval');
                
                if (healthCheckEnabled) healthCheckEnabled.checked = healthCheckState.enabled;
                if (healthCheckInterval) healthCheckInterval.value = healthCheckState.interval;
                
                // Restore environment toggles
                healthCheckState.environments.forEach(env => {
                    const toggle = document.querySelector(`input[name="health-env"][value="${env}"]`);
                    if (toggle) toggle.checked = true;
                });
                
                // Update UI state based on enabled status
                const healthEnvToggles = document.getElementById('health-env-toggles');
                const healthCheckIntervalEl = document.getElementById('health-check-interval');
                
                if (healthCheckState.enabled) {
                    healthEnvToggles?.classList.remove('disabled');
                    healthCheckIntervalEl?.classList.remove('disabled');
                } else {
                    healthEnvToggles?.classList.add('disabled');
                    healthCheckIntervalEl?.classList.add('disabled');
                }
            }
        } catch (error) {
            console.warn('Failed to load health check state from server:', error);
        }
    };

    // Save health check state to server
    const saveHealthCheckState = async () => {
        try {
            const response = await fetch('/api/cron/health-check-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(healthCheckState),
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                console.warn('Failed to save health check state to server');
            }
        } catch (error) {
            console.warn('Failed to save health check state:', error);
        }
    };

    // Update countdown display
    const updateCountdown = () => {
        const countdownEl = document.getElementById('health-check-countdown');
        if (!countdownEl) return;

        if (!healthCheckState.enabled || !healthCheckState.nextTrigger) {
            countdownEl.textContent = '';
            return;
        }

        const now = new Date();
        const nextTrigger = new Date(healthCheckState.nextTrigger);
        const diff = nextTrigger - now;

        if (diff <= 0) {
            countdownEl.textContent = 'Triggering...';
            // Trigger health checks immediately when countdown expires
            if (!updateCountdown.triggeringStart) {
                updateCountdown.triggeringStart = now;
                // Actually trigger health checks for enabled environments
                triggerAutoHealthChecks();
            } else if (now - updateCountdown.triggeringStart > 5000) {
                // Reset the triggering state and recalculate next trigger
                updateCountdown.triggeringStart = null;
                healthCheckState.nextTrigger = calculateNextTrigger();
                if (healthCheckState.nextTrigger) {
                    saveHealthCheckState();
                }
            }
            return;
        } else {
            // Reset triggering start time when we're not in triggering state
            updateCountdown.triggeringStart = null;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        countdownEl.textContent = `Next: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Calculate next trigger time based on interval
    const calculateNextTrigger = () => {
        if (!healthCheckState.enabled) return null;
        
        const now = new Date();
        const intervalMap = {
            'every 1 minute': 60000,
            'every 5 minutes': 300000,
            'every 15 minutes': 900000,
            'every 30 minutes': 1800000,
            'every 1 hour': 3600000
        };
        
        const intervalMs = intervalMap[healthCheckState.interval] || 60000;
        return new Date(now.getTime() + intervalMs);
    };

    // Trigger automatic health checks for enabled environments
    const triggerAutoHealthChecks = () => {
        if (!healthCheckState.enabled || !healthCheckState.environments.length) {
            console.log('Auto health checks: No environments enabled');
            return;
        }

        console.log('Auto health checks: Triggering for environments:', healthCheckState.environments);
        
        healthCheckState.environments.forEach(env => {
            const runId = `auto-health-${env}-${Date.now()}`;
            const command = 'npx playwright test tests/metrics.spec.js --project=' + env + '-chrome-desktop';
            
            // Add running status to results
            resultsStore[env].unshift({ 
                runId, 
                type: 'auto', 
                status: 'running', 
                timestamp: new Date(),
                command: command
            });
            if (resultsStore[env].length > 5) resultsStore[env].pop();
            
            renderResults(env);
            setStatus(env);

            // Execute the health check via manual API endpoint with auto type marker
            fetch('/api/cron/run-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, env, runId, autoType: true })
            }).catch(error => {
                console.error(`Failed to trigger auto health check for ${env}:`, error);
                // Update result with error status
                const resultIndex = resultsStore[env].findIndex(r => r.runId === runId);
                if (resultIndex !== -1) {
                    resultsStore[env][resultIndex].status = 'error';
                    resultsStore[env][resultIndex].error = error.message;
                    renderResults(env);
                    setStatus(env);
                }
            });
        });
    };

    // Load results from API instead of localStorage
    const loadResults = async () => {
        try {
            const response = await fetch('/api/cron/results', {
                credentials: 'same-origin'
            });
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('Results API not available yet');
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const allResults = await response.json();
            
            if (!allResults || typeof allResults !== 'object') {
                console.warn('Invalid response format from results API');
                return;
            }
            
            // Load results from API
            Object.keys(allResults).forEach(env => {
                const envResults = allResults[env];
                const resultsArray = Array.isArray(envResults) ? envResults : 
                                   (envResults && envResults.results ? envResults.results : []);
                
                if (resultsArray && resultsArray.length > 0) {
                    resultsStore[env] = resultsArray.map(result => {
                        // Preserve the original type field to prevent override from nested data
                        const preservedType = result.type;
                        
                        return {
                            ...result,
                            type: preservedType, // Explicitly preserve the type
                            timestamp: new Date(result.timestamp || result.storedAt || Date.now())
                        };
                    }).slice(0, 5); // Keep only the latest 5
                    
                    renderResults(env);
                    setStatus(env);
                }
            });
            
        } catch (error) {
            console.error('Failed to load results from API:', error);
        }
    };

    const setStatus = (env) => {
        const statusBar = document.querySelector(`#${env}-results .status-bar`);
        if (statusBar) {
            const isRunning = resultsStore[env].some(r => r.status === 'running');
            const isFinishing = resultsStore[env].some(r => r.status === 'finishing');
            const hasTimedOut = resultsStore[env].some(r => r.status === 'timedout');
            
            if (isRunning) {
                statusBar.textContent = 'RUNNING';
                statusBar.className = 'status-bar running';
            } else if (isFinishing) {
                statusBar.textContent = 'FINISHING';
                statusBar.className = 'status-bar finishing';
            } else if (hasTimedOut) {
                statusBar.textContent = 'TIMED OUT';
                statusBar.className = 'status-bar timedout';
            } else {
                statusBar.textContent = 'IDLE';
                statusBar.className = 'status-bar idle';
            }
        }
    };

    // displayResults function removed - now handled by polling via loadResults

    const renderResults = (env) => {
        const mappedEnv = envMapping[env] || env;
        const resultEl = document.getElementById(`${mappedEnv}-results-content`);
        
        if (!resultEl) {
            console.log(`Element not found: ${env}-results-content`);
            return;
        }
        
        // Show all results since we removed the filter toggles
        const activeResults = resultsStore[env] || [];
        
        resultEl.innerHTML = '';
        activeResults.forEach(r => {
            const item = document.createElement('div');
            item.className = 'result-row';
            
            const statusClass = r.status === 'running' ? 'running' : 
                                (r.status === 'finishing' ? 'finishing' :
                                (r.status === 'success' ? 'success' : 
                                (r.status === 'timedout' ? 'timedout' : 'error')));
            const statusText = r.status === 'running' ? 'RUNNING' : 
                              (r.status === 'finishing' ? 'FINISHING' :
                              (r.status === 'success' ? 'PASS' : 
                              (r.status === 'timedout' ? 'TIMEOUT' : 'FAIL')));
            // Extract LCP from data field or direct property
            // Handle both old (double nested) and new (single nested) data structures
            const lcp = r.data?.lcp || r.data?.data?.lcp || r.lcp;
            const lcpText = lcp ? `LCP: ${Math.round(lcp)}ms` : 'LCP: N/A';
            

            
            const typeText = r.type === 'auto' ? 'A' : 'M';
            
            item.innerHTML = `
                <span class="result-type">${typeText}</span>
                <span class="result-status ${statusClass}">${statusText}</span>
                <span class="result-metric">${lcpText}</span>
                <span class="result-metric">${new Date(r.timestamp).toLocaleTimeString()}</span>
                ${r.reportPath ? `<button class="btn report-btn" onclick="window.open('/reports/${r.reportPath}', '_blank')">R</button>` : '<div></div>'}
            `;
            
            // Make the entire row clickable to show metrics popup
            item.style.cursor = 'pointer';
            item.onclick = () => showMetricsPopup(r);
            
            resultEl.appendChild(item);
        });
    };

    // Filter toggle event listener removed since we removed the filter buttons

    const toggleHealthChecks = async (env, enabled) => {
        const interval = document.getElementById('health-check-interval').value;
        const jobName = `periodic-health-check-${env}`;
        if (enabled) {
            await fetch('/api/cron/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: jobName,
                    path: 'periodic-health-check.js',
                    interval: interval,
                    worker: { workerData: { env } }
                }),
                credentials: 'same-origin'
            });
        } else {
            await fetch(`/api/cron/jobs/stop/${jobName}`, { 
                method: 'POST',
                credentials: 'same-origin'
            });
        }
    };

    function setupEventHandlers() {
        // Health check toggle
        const healthCheckEnabled = document.getElementById('health-check-enabled');
        const healthEnvToggles = document.getElementById('health-env-toggles');
        const healthCheckInterval = document.getElementById('health-check-interval');
        const manualRunForm = document.getElementById('manual-run-form');

        if (healthCheckEnabled) {
            healthCheckEnabled.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                healthCheckState.enabled = isEnabled;
                
                if (isEnabled) {
                    if (healthEnvToggles) healthEnvToggles.classList.remove('disabled');
                    if (healthCheckInterval) healthCheckInterval.classList.remove('disabled');
                    
                    healthCheckState.nextTrigger = calculateNextTrigger();
                    if (healthCheckState.countdownTimer) {
                        clearInterval(healthCheckState.countdownTimer);
                    }
                    healthCheckState.countdownTimer = setInterval(updateCountdown, 1000);
                    updateCountdown();
                } else {
                    if (healthEnvToggles) healthEnvToggles.classList.add('disabled');
                    if (healthCheckInterval) healthCheckInterval.classList.add('disabled');
                    
                    if (healthCheckState.countdownTimer) {
                        clearInterval(healthCheckState.countdownTimer);
                        healthCheckState.countdownTimer = null;
                    }
                    healthCheckState.nextTrigger = null;
                    updateCountdown();
                    
                    document.querySelectorAll('input[name="health-env"]:checked').forEach(toggle => {
                        toggle.checked = false;
                        toggleHealthChecks(toggle.value, false);
                    });
                    healthCheckState.environments = [];
                }
                
                saveHealthCheckState();
            });
        }

        // Environment toggles
        document.querySelectorAll('input[name="health-env"]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                if (!healthCheckEnabled || !healthCheckEnabled.checked) {
                    e.target.checked = false;
                    return;
                }
                
                const env = e.target.value;
                const isChecked = e.target.checked;
                
                if (isChecked) {
                    healthCheckState.environments.push(env);
                } else {
                    healthCheckState.environments = healthCheckState.environments.filter(e => e !== env);
                }
                
                toggleHealthChecks(env, isChecked);
                saveHealthCheckState();
            });
        });

        // Interval change handler
        if (healthCheckInterval) {
            healthCheckInterval.addEventListener('change', (e) => {
                healthCheckState.interval = e.target.value;
                
                if (healthCheckState.enabled) {
                    healthCheckState.nextTrigger = calculateNextTrigger();
                }
                
                saveHealthCheckState();
            });
        }

        // Initialize disabled state
        if (healthEnvToggles) healthEnvToggles.classList.add('disabled');
        if (healthCheckInterval) healthCheckInterval.classList.add('disabled');

        // Manual run form - keep the event listener for form submission via Enter key
        if (manualRunForm) {
            manualRunForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                submitManualRun();
            });
        }
    }

    // Global function for manual run submission
    window.submitManualRun = async () => {
        console.log('Manual run triggered - no page reload');
        
        const command = document.getElementById('manual-command').value;
        const manualRunForm = document.getElementById('manual-run-form');
        const envs = [...manualRunForm.querySelectorAll('input[name="env"]:checked')].map(el => el.value);

        if (!command || envs.length === 0) {
            alert('Please enter a command and select at least one environment.');
            return;
        }

        envs.forEach(async (env) => {
            const runId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            resultsStore[env].unshift({
                runId, 
                type: 'manual', 
                status: 'running', 
                timestamp: new Date(),
                command: command
            });
            
            if (resultsStore[env].length > 5) resultsStore[env].pop();
            
            renderResults(env);
            setStatus(env);

            fetch('/api/cron/run-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: `${command} --project=${env}-chrome-desktop`, env, runId }),
                credentials: 'same-origin'
            });
        });
    };



    const pollForResults = () => {
        loadResults();
    };



    // Show metrics popup with detailed JSON data
    const showMetricsPopup = (result) => {
        // Extract metrics from data field or direct properties
        // Handle both old (double nested) and new (single nested) data structures
        const metrics = result.data || result;
        const lcp = result.data?.lcp || result.data?.data?.lcp || result.lcp;
        const ttfb = result.data?.ttfb || result.data?.data?.ttfb || result.ttfb;
        const fcp = result.data?.fcp || result.data?.data?.fcp || result.fcp;
        const reportPath = result.data?.reportPath || result.data?.data?.reportPath || result.reportPath;
        const fullMetrics = result.data?.fullMetrics || result.data?.data?.fullMetrics || result.fullMetrics || metrics;
        
        // Create modal backdrop
        const modal = document.createElement('div');
        modal.className = 'metrics-modal';
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="closeMetricsPopup()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📊 Performance Metrics</h3>
                    <button class="close-btn" onclick="closeMetricsPopup()">×</button>
                </div>
                <div class="modal-body">
                    <div class="metrics-summary">
                        <div class="metric-card ${lcp && lcp < 2500 ? 'good' : lcp && lcp < 4000 ? 'needs-improvement' : 'poor'}">
                            <span class="metric-label">LCP</span>
                            <span class="metric-value">${lcp ? Math.round(lcp) + 'ms' : 'N/A'}</span>
                        </div>
                        <div class="metric-card ${ttfb && ttfb < 800 ? 'good' : ttfb && ttfb < 1800 ? 'needs-improvement' : 'poor'}">
                            <span class="metric-label">TTFB</span>
                            <span class="metric-value">${ttfb ? Math.round(ttfb) + 'ms' : 'N/A'}</span>
                        </div>
                        <div class="metric-card ${fcp && fcp < 1800 ? 'good' : fcp && fcp < 3000 ? 'needs-improvement' : 'poor'}">
                            <span class="metric-label">FCP</span>
                            <span class="metric-value">${fcp ? Math.round(fcp) + 'ms' : 'N/A'}</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-label">Status</span>
                            <span class="metric-value status-${result.status}">${result.status.toUpperCase()}</span>
                        </div>
                    </div>
                    
                    <div class="metrics-details">
                        <h4>📋 Full Metrics Data</h4>
                        <pre class="json-display">${JSON.stringify(fullMetrics, null, 2)}</pre>
                    </div>
                    
                    <div class="metrics-actions">
                        ${reportPath ? `<button class="btn btn-primary" onclick="window.open('/reports/', '_blank')">View Playwright Report</button>` : ''}
                        ${fullMetrics?.reportUrl ? `<button class="btn btn-primary" onclick="window.open('${fullMetrics.reportUrl}', '_blank')">View Full Test Report</button>` : ''}
                        <button class="btn btn-secondary" onclick="copyMetricsToClipboard('${JSON.stringify(result).replace(/'/g, "\\'")}')">Copy JSON</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        // Add animation
        requestAnimationFrame(() => modal.classList.add('show'));
    };

    // Close metrics popup
    window.closeMetricsPopup = () => {
        const modal = document.querySelector('.metrics-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    };

    // Copy metrics to clipboard
    window.copyMetricsToClipboard = (data) => {
        navigator.clipboard.writeText(data)
            .then(() => {
                // Show brief success indication
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.classList.add('success');
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('success');
                }, 2000);
            })
            .catch(() => {
                alert('Failed to copy to clipboard');
            });
    };

    // Debug helper - clear stuck RUNNING jobs
    const clearStuckJobs = () => {
        Object.keys(resultsStore).forEach(env => {
            resultsStore[env] = resultsStore[env].map(result => {
                if (result.status === 'running' || result.status === 'finishing') {
                    return { ...result, status: 'error', error: 'Manually cleared stuck job' };
                }
                return result;
            });
            renderResults(env);
            setStatus(env);
        });
        console.log('Cleared all stuck RUNNING/FINISHING jobs');
    };

    // Expose for debugging
    window.clearStuckJobs = clearStuckJobs;



    init();
});
