/**
 * Simplified Log Viewer - Clean, Fast Implementation
 * Replaces the complex DSL-based system with simple, efficient filtering
 */

class LogViewer {
    constructor() {
        this.state = {
            logs: [],
            filteredLogs: [],
            latestLogTimestamp: null
        };

        this.columns = [
            { 
                id: 'time', 
                title: 'Time', 
                width: '120px', 
                sortable: true,
                cellRenderer: (time) => {
                    if (!time) return '';
                    try {
                        // Format to HH:MM:SS.ms
                        const d = new Date(time);
                        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                        const ms = d.getMilliseconds().toString().padStart(3, '0');
                        return `${timeStr}.${ms}`;
                    } catch (e) {
                        return time; // Fallback to raw time
                    }
                }
            },
            { 
                id: 'level', 
                title: 'Level', 
                width: '80px', 
                sortable: true,
                cellRenderer: (level) => {
                    if (!level) return '';
                    const levelClass = level.toLowerCase();
                    return `<span class="log-level ${levelClass}">${level}</span>`;
                }
            },
            { id: 'type', title: 'Type', width: '100px', sortable: true },
            { id: 'from', title: 'From', width: '250px', sortable: true },
            { id: 'msg', title: 'Message', width: '1fr', sortable: true }
        ];
        
        this.logTimestamps = {};
        this.logService = new LogService();
        this.filterManager = new FilterManager({
            onFilterChange: () => this.applyFilters()
        });

        this.initializeElements();

        this.logDetails = new LogDetails(this.logService);
        this.logDisplay = new LogDisplay(this.elements.display, {
            columns: this.columns,
            // The detailsRenderer is now wrapped to add the necessary container class
            detailsRenderer: (log) => {
                const container = document.createElement('div');
                container.className = 'log-details-container'; // Add a class for event delegation
                container.innerHTML = this.logDetails.render(log);
                return container.outerHTML; // Return the HTML string, not the element object
            }
        });

        this.attachEventListeners();
        this.loadLogs(true); // Initial full load
        // this.startAutoRefresh(); // DISABLED: User requested to stop auto-refresh
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }

    render() {
        const { filteredLogs, logs } = this.state;
        const data = filteredLogs.slice(0, 500).map(log => ({
            time: log.timestamp || new Date().toISOString(),
            level: (log.level || 'INFO').toUpperCase(),
            type: log.type || 'UNKNOWN',
            from: `${log.module || 'unknown'}.${log.action || 'unknown'}`,
            msg: log.message || '',
            // Keep original log for details
            _original: log
        }));

        this.logDisplay.render(data);
        this.updateCount();
    }

    initializeElements() {
        this.elements = {
            display: document.getElementById('log-display'),
            refreshBtn: document.getElementById('refresh-btn'),
            copyBtn: document.getElementById('copy-all-btn'),
            clearBtn: document.getElementById('clear-logs-btn'),
            logCount: document.getElementById('log-count'),
        };
    }

    attachEventListeners() {
        // Refresh button
        this.elements.refreshBtn.addEventListener('click', () => {
            this.loadLogs();
        });

        // Copy button
        this.elements.copyBtn.addEventListener('click', () => {
            this.copyLogsToClipboard();
        });

        // Clear logs button
        this.elements.clearBtn.addEventListener('click', () => {
            this.clearLogs();
        });

        // Event delegation for stack trace links and other dynamic content
        this.elements.display.addEventListener('click', (e) => {
            if (e.target.closest('.btn-copy-log-data')) {
                this.copyLogData(e.target.closest('.btn-copy-log-data'));
            }
            // Delegate stack trace clicks to the LogDetails instance
            if (e.target.closest('.stack-trace-link')) {
                this.logDetails.handleStackTraceClick(e);
            }
        });
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.checkForUpdates();
        }, 5000); // Check every 5 seconds
    }

    async checkForUpdates() {
        // This functionality is currently disabled.
        return;
        try {
            const sources = ['server', 'monitor']; // Or dynamically get sources
            let needsUpdate = false;

            for (const source of sources) {
                try {
                    const url = `/api/logs/status?source=${source}`;
                    const response = await fetch(url);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        if (data.success) {
                            const lastModified = new Date(data.lastModified);
                            const currentTimestamp = this.logTimestamps[source] || new Date(0);
                            
                            if (lastModified > currentTimestamp) {
                                this.logTimestamps[source] = lastModified;
                                needsUpdate = true;
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to check updates for ${source}:`, error);
                }
            }

            if (needsUpdate) {
                // Only load new logs, don't replace entire log list
                await this.loadLogs(false);
            }
        } catch (error) {
            console.warn('Auto-refresh check failed:', error);
        }
    }

    async loadLogs(isInitialLoad = false) {
        try {
            if (isInitialLoad) {
                this.logDisplay.showLoading();
            }
            
            const sources = ['server', 'frontend'];
            
            if (isInitialLoad) {
                const logs = await this.logService.fetchLogs(sources);
                logs.sort((a, b) => new Date(b.Time) - new Date(a.Time));
                const latestLogTimestamp = logs.length > 0 ? logs[0].Time : null;

                this.setState({ logs, latestLogTimestamp });
                this.filterManager.populateFilters(this.state.logs);
                this.applyFilters();
            } else {
                const newLogs = await this.logService.fetchLogs(sources, this.state.latestLogTimestamp);
                if (newLogs.length > 0) {
                    const allLogs = [...this.state.logs, ...newLogs];
                    allLogs.sort((a, b) => new Date(b.Time || b.timestamp) - new Date(a.Time || a.timestamp));
                    const latestLogTimestamp = allLogs.length > 0 ? (allLogs[0].Time || allLogs[0].timestamp) : this.state.latestLogTimestamp;
                    
                    this.setState({ logs: allLogs, latestLogTimestamp });
                    this.applyFilters();
                }
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
            if (isInitialLoad) {
                this.logDisplay.showError('Failed to load logs');
            }
        }
    }

    clearLogs() {
        // Temporary visual feedback
        this.elements.clearBtn.classList.add('clearing');
        this.elements.clearBtn.textContent = 'Clearing...';

        // Use a timeout to simulate a "clearing" process
        setTimeout(async () => {
            try {
                // Clear client-side logs
                const clientSuccess = this.logService.clearLogs();

                // Clear server-side logs for both server and frontend sources
                const serverSources = ['server', 'frontend'];
                const serverResults = await Promise.all(
                    serverSources.map(source => this.logService.clearServerLogs(source))
                );

                // Check if all operations were successful
                const allSuccessful = clientSuccess && 
                    serverResults.every(result => result.success);

                if (allSuccessful) {
                    this.setState({
                        logs: [],
                        filteredLogs: [],
                        latestLogTimestamp: null
                    });

                    // Reset button state
                    this.elements.clearBtn.classList.remove('clearing');
                    this.elements.clearBtn.textContent = 'Cleared';
                    
                    // Briefly show "Cleared" state
                    setTimeout(() => {
                        this.elements.clearBtn.textContent = 'Clear';
                    }, 1500);
                } else {
                    throw new Error('Failed to clear all logs');
                }
            } catch (error) {
                // If clearing fails, show a brief error state
                this.elements.clearBtn.classList.remove('clearing');
                this.elements.clearBtn.classList.add('error');
                
                // Customize error message based on error type
                let errorMessage = 'Failed to clear logs';
                if (error.type) {
                    switch (error.type) {
                        case 'CONFIG_ERROR':
                            errorMessage = 'Server configuration error';
                            break;
                        case 'INVALID_SOURCE':
                            errorMessage = 'Invalid log source';
                            break;
                        case 'PERMISSION_DENIED':
                            errorMessage = 'Permission denied';
                            break;
                        case 'FILE_OPERATION_ERROR':
                            errorMessage = 'File operation failed';
                            break;
                        default:
                            errorMessage = 'Unexpected error';
                    }
                }

                this.elements.clearBtn.textContent = errorMessage;
                
                // Reset button after a short time
                setTimeout(() => {
                    this.elements.clearBtn.classList.remove('error');
                    this.elements.clearBtn.textContent = 'Clear';
                }, 3000);

                console.error('Log clearing failed:', error);
            }
        }, 300);
    }

    applyFilters() {
        const filteredLogs = this.filterManager.filter(this.state.logs);
        this.setState({ filteredLogs });
    }

    updateDisplay() {
        // This method is now replaced by render()
    }

    formatSource(log) {
        // DEPRECATED: This is replaced by the 'from' field in the new data mapping.
        const module = log.module || 'unknown';
        const action = log.action || 'unknown';
        return `${module}.${action}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateCount() {
        this.elements.logCount.textContent = `${this.state.filteredLogs.length}/${this.state.logs.length}`;
    }

    showLoading() {
        this.logDisplay.showLoading();
    }

    showEmpty() {
        this.logDisplay.showEmpty();
    }

    showError(message) {
        this.logDisplay.showError(message);
    }

    async copyLogData(button) {
        const data = button.dataset.logData;
        try {
            await navigator.clipboard.writeText(data);
            
            const originalText = button.innerHTML;
            button.innerHTML = '✓ Copied';
            button.disabled = true;
            setTimeout(() => {
                button.innerHTML = originalText;
                button.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Failed to copy log data:', error);
            alert('Failed to copy log data to clipboard');
        }
    }

    async copyLogsToClipboard() {
        try {
            const logText = this.state.filteredLogs.map(log => {
                const timestamp = new Date(log.timestamp).toISOString();
                const level = (log.level || 'INFO').toUpperCase();
                const type = log.type || 'UNKNOWN';
                const from = `${log.module || 'unknown'}.${log.action || 'unknown'}`;
                const message = log.message || '';
                
                return `[${timestamp}] [${level}] [${type}] [${from}] ${message}`;
            }).join('\n');
            
            await navigator.clipboard.writeText(logText);
            
            // Visual feedback
            const originalText = this.elements.copyBtn.textContent;
            this.elements.copyBtn.textContent = originalText;
            setTimeout(() => {
                this.elements.copyBtn.textContent = originalText;
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy logs:', error);
            alert('Failed to copy logs to clipboard');
        }
    }
}

// Ensure the global APP namespace exists
window.APP = window.APP || {};

// Initialize and attach the log viewer to the APP namespace
window.APP.logViewer = new LogViewer();
