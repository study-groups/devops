// System Control Panel - PCB-style interface with theme management
window.addEventListener('DOMContentLoaded', () => {
    console.log('System Control Panel loaded');
    
    // Handle iframe/standalone mode
    const isIframe = window.self !== window.top;
    const panelHeader = document.querySelector('.panel-header');
    
    if (isIframe && panelHeader) {
        panelHeader.classList.add('iframe-mode');
    }
    
    // Initialize the control panel
    initialize();
    
    function initialize() {
        // Make functions available globally first
        window.systemControlPanel = {
            refresh: refreshAll,
            refreshStats: loadSystemStats,
            refreshDirectories: loadDirectoryStats,
            refreshInfo: loadSystemInfo,
            logMessage: null // Will be set by setupMessageTesting
        };
        
        setupThemeSelector();
        setupMessageTesting();
        setupIconManagement(); // Add this line
        
        new DevWatchPanelManager({
            container: '.devwatch-columns',
            tabs: '.devwatch-tab',
            tabPanels: '.devwatch-tab-panel',
            coupledPanels: '.devwatch-column-panel',
            resizer: '.devwatch-column-resizer',
            initialTab: 'system',
            breakpoint: 800
        });

        // Initial data load using the new consolidated endpoint
        loadConsolidatedData();
    }

    function setupCoupledPanels() {
        const triggerContainer = document.querySelector('.devwatch-tab-list');
        const targetContainer = document.getElementById('right-column');

        if (triggerContainer && targetContainer) {
            new DevWatchCoupledPanels(triggerContainer, targetContainer);
        } else {
            console.warn('Coupled panel containers not found');
        }
    }

    function setupTabs() {
        // This is now handled by devwatch-tabs.js, which is more generic.
        // If specific tab logic is needed, it can be added here.
        console.log('PJA tabs initialized.');
    }
    
    function setupThemeSelector() {
        const container = document.getElementById('theme-selector-container');
        if (!container) {
            console.warn('Theme selector container not found');
            return;
        }

        // Check if we're in iframe mode
        const isIframe = window.self !== window.top;
        
        if (isIframe) {
            // In iframe mode, create our own theme selector since the theme manager
            // auto-initializes for iframe mode instead of creating selectors
            createSystemThemeSelector(container);
            console.log('Theme selector added to control panel (iframe mode)');
        } else {
            // Standalone mode - use normal theme selector if available
            if (window.DevWatchThemeManager) {
                window.DevWatchThemeManager.createThemeSelector(container);
                console.log('Theme selector added to control panel (standalone mode)');
            } else {
                createSystemThemeSelector(container);
                console.log('Theme selector added to control panel (fallback mode)');
            }
        }
    }

    function createSystemThemeSelector(container) {
        // Create theme selector with correct theme definitions
        const themes = [
            { id: 'retro', name: 'Retro', icon: '🔮', description: 'Classic understated look with subtle green accents' },
            { id: 'cyber', name: 'Cyber', icon: '🟣', description: 'Neon pink and blue futuristic theme' },
            { id: 'phosphor', name: 'Phosphor', icon: '⚡', description: 'Brutal glowing green phosphor - maximum intensity' },
            { id: 'matrix', name: 'Matrix', icon: '🟢', description: 'Classic green terminal theme' },
            { id: 'bright', name: 'Bright', icon: '⚪', description: 'Clean light theme for readability' },
            { id: 'terminal', name: 'Terminal', icon: '⚫', description: 'Pure black and white terminal' }
        ];

        const currentTheme = localStorage.getItem('devwatch-theme') || 'retro';

        const selector = document.createElement('div');
        selector.className = 'devwatch-theme-selector';
        selector.innerHTML = `
            <label for="system-theme-select" style="display: block; margin-bottom: var(--devwatch-space-sm); color: var(--devwatch-text-secondary); font-size: var(--devwatch-font-size-xs);">
                Theme Selection
            </label>
            <div class="theme-dropdown" style="position: relative;">
                <select id="system-theme-select" style="width: 100%; padding: var(--devwatch-space-sm); border: 1px solid var(--devwatch-border-primary); border-radius: var(--devwatch-radius-sm); background: var(--devwatch-bg-primary); color: var(--devwatch-text-primary); font-size: var(--devwatch-font-size-sm);">
                    ${themes.map(theme => 
                        `<option value="${theme.id}" ${theme.id === currentTheme ? 'selected' : ''}>${theme.icon} ${theme.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div style="font-size: var(--devwatch-font-size-xs); color: var(--devwatch-text-muted); margin-top: var(--devwatch-space-sm);">
                Theme changes apply system-wide across all interfaces.
            </div>
        `;

        const select = selector.querySelector('#system-theme-select');
        select.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            
            // Apply theme directly
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('devwatch-theme', newTheme);
            
            // Notify parent window
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    source: 'devwatch-iframe',
                    type: 'devwatch-theme-update',
                    data: { theme: newTheme }
                }, '*');
            }
            
            console.log(`[System Control Panel] Theme applied: ${newTheme}`);
        });

        container.appendChild(selector);
        console.log('Theme selector added to control panel');
    }
    
    async function loadConsolidatedData() {
        try {
            const response = await fetch('/api/system/');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Update all sections with the new data
            updateSystemInfo(data.environment);
            updateSystemStats(data.systemInfo);
            updateDirectoryStats(data.directories);
            updateProcessCount(data.processes);

        } catch (error) {
            console.error('Error loading consolidated system data:', error);
            // Set error states for all sections
            setErrorState('summary-pw-dir', 'Error');
            setErrorState('summary-pw-src', 'Error');
            setErrorState('summary-pwd', 'Error');
            setErrorState('summary-server', 'Error');
            setErrorState('summary-user', 'Error');
            setErrorState('summary-ip', 'Error');
            updateElement('cpu-usage', 'N/A');
            updateElement('memory-usage', 'N/A');
            updateElement('disk-usage', 'N/A');
            updateElement('process-count', 'N/A');
            const statsBody = document.getElementById('directory-stats-body');
            if (statsBody) {
                statsBody.innerHTML = `<div class="pja-directory-stats__row"><div class="pja-directory-stats__cell" style="grid-column: 1 / -1;">Error: ${error.message}</div></div>`;
            }
        }
    }

    function updateSystemInfo(environment) {
        if (!environment) return;
        updateElement('summary-pw-dir', environment.PW_DIR || 'Not set');
        updateElement('summary-pw-src', environment.PW_SRC || 'Not set');
        updateElement('summary-pwd', environment.PROCESS_PWD || 'Not set');
        updateElement('summary-server', environment.SERVER_INFO || 'Unknown');
        updateElement('summary-user', environment.USER_INFO || 'Unknown');
        updateElement('summary-ip', environment.IP_INFO || 'Unknown');
        updateElement('pw-dir-path', environment.PW_DIR || 'Not available');
    }

    function updateDirectoryStats(directories) {
        const statsBody = document.getElementById('directory-stats-body');
        if (!statsBody) {
            console.error('Directory stats container not found.');
            return;
        }

        if (directories && typeof directories === 'object') {
            const statsArray = Object.entries(directories).map(([name, details]) => ({
                name: name,
                files: details.fileCount || (Array.isArray(details.files) ? details.files.length : 0),
                size: details.size || '0 B',
                modified: details.modified || '-'
            }));
            displayDirectoryStats(statsArray);
        } else {
            statsBody.innerHTML = `<div class="pja-directory-stats__row"><div class="pja-directory-stats__cell" style="grid-column: 1 / -1;">Directory data not available.</div></div>`;
        }
    }

    async function loadSystemInfo() {
        try {
            // Use the existing /api/system/environment endpoint
            const response = await fetch('/api/system/environment');
            if (!response.ok) throw new Error('Failed to fetch system info');
            
            const data = await response.json();
            
            // Update runtime environment using the correct field names from the API
            updateElement('summary-pw-dir', data.PW_DIR || 'Not set');
            updateElement('summary-pw-src', data.PW_SRC || 'Not set');
            updateElement('summary-pwd', data.PROCESS_PWD || 'Not set');
            updateElement('summary-server', data.SERVER_INFO || 'Unknown');
            updateElement('summary-user', data.USER_INFO || 'Unknown');
            updateElement('summary-ip', data.IP_INFO || 'Unknown');
            
            // Also update the PW_DIR path display for directory stats
            updateElement('pw-dir-path', data.PW_DIR || 'Not available');
            
        } catch (error) {
            console.error('Error loading system info:', error);
            // Set error states
            setErrorState('summary-pw-dir', 'Error');
            setErrorState('summary-pw-src', 'Error');
            setErrorState('summary-pwd', 'Error');
            setErrorState('summary-server', 'Error');
            setErrorState('summary-user', 'Error');
            setErrorState('summary-ip', 'Error');
        }
    }
    
    async function loadDirectoryStats() {
        const statsBody = document.getElementById('directory-stats-body');
        if (!statsBody) {
            console.error('Directory stats container not found.');
            return;
        }

        try {
            statsBody.innerHTML = '<div class="pja-directory-stats__row"><div class="pja-directory-stats__cell" style="grid-column: 1 / -1;">Loading...</div></div>';
            
            const response = await fetch('/api/system/stats'); // Corrected URL
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Transform the received object into an array for the display function
            if (data.directories && typeof data.directories === 'object') {
                const statsArray = Object.entries(data.directories).map(([name, details]) => ({
                    name: name,
                    files: details.fileCount || (Array.isArray(details.files) ? details.files.length : 0),
                    size: details.size || '0 B',
                    modified: details.modified || '-'
                }));
                displayDirectoryStats(statsArray);
            } else {
                throw new Error('Directory data is not in the expected format.');
            }

        } catch (error) {
            console.error('Error loading directory stats:', error);
            statsBody.innerHTML = `<div class="pja-directory-stats__row"><div class="pja-directory-stats__cell" style="grid-column: 1 / -1;">Error: ${error.message}</div></div>`;
        }
    }

    function displayDirectoryStats(stats) {
        const statsBody = document.getElementById('directory-stats-body');
        if (!statsBody) return;

        statsBody.innerHTML = ''; // Clear previous stats

        if (!stats || stats.length === 0) {
            statsBody.innerHTML = '<div class="pja-directory-stats__row"><div class="pja-directory-stats__cell" style="grid-column: 1 / -1;">No directory stats available.</div></div>';
            return;
        }

        stats.forEach(item => {
            const row = document.createElement('div');
            row.className = 'pja-directory-stats__row';

            row.innerHTML = `
                <div class="pja-directory-stats__cell">${item.name}</div>
                <div class="pja-directory-stats__cell">${item.files}</div>
                <div class="pja-directory-stats__cell">${item.size}</div>
                <div class="pja-directory-stats__cell">${item.modified}</div>
            `;
            statsBody.appendChild(row);
        });
    }
    
    function updateSystemStats(systemInfo) {
        if (!systemInfo) return;

        if (systemInfo.load && systemInfo.load[0] !== undefined) {
            updateElement('cpu-usage', `${(systemInfo.load[0] * 100).toFixed(1)}%`);
        } else {
            updateElement('cpu-usage', '--');
        }

        if (systemInfo.memory) {
            updateElement('memory-usage', `${(systemInfo.memory.used / 1024).toFixed(1)}GB`);
        } else {
            updateElement('memory-usage', '--');
        }
    }

    async function loadSystemStats() {
        try {
            // Use the existing /api/system/info endpoint
            const response = await fetch('/api/system/info');
            if (!response.ok) throw new Error('Failed to fetch system stats');
            
            const data = await response.json();
            
            // Update system statistics using the available data structure
            if (data.load && data.load[0] !== undefined) {
                // CPU load average (1-minute)
                updateElement('cpu-usage', `${(data.load[0] * 100).toFixed(1)}%`);
            } else {
                updateElement('cpu-usage', '--');
            }
            
            if (data.memory) {
                // Memory usage in MB, convert to GB
                updateElement('memory-usage', `${(data.memory.used / 1024).toFixed(1)}GB`);
            } else {
                updateElement('memory-usage', '--');
            }
            
            // For disk usage, we need to get it from the stats endpoint
            loadDiskStats();
            
            // Process count - try to get from stats endpoint
            loadProcessCount();
                
        } catch (error) {
            console.error('Error loading system stats:', error);
            // Set all to unavailable
            updateElement('cpu-usage', 'N/A');
            updateElement('memory-usage', 'N/A');
            updateElement('disk-usage', 'N/A');
            updateElement('process-count', 'N/A');
        }
    }
    
    async function loadDiskStats() {
        try {
            // Try to get disk stats from the stats endpoint
            const response = await fetch('/api/system/stats');
            if (response.ok) {
                const data = await response.json();
                if (data.directories) {
                    // Calculate total disk usage from directory stats
                    let totalSize = 0;
                    Object.values(data.directories).forEach(dir => {
                        if (dir.sizeBytes) {
                            totalSize += dir.sizeBytes;
                        }
                    });
                    updateElement('disk-usage', formatBytes(totalSize));
                } else {
                    updateElement('disk-usage', '--');
                }
            } else {
                updateElement('disk-usage', 'N/A');
            }
        } catch (error) {
            console.error('Error loading disk stats:', error);
            updateElement('disk-usage', 'N/A');
        }
    }
    
    function updateProcessCount(processes) {
        if (processes) {
            if (Array.isArray(processes)) {
                updateElement('process-count', processes.length);
            } else if (typeof processes === 'number') {
                updateElement('process-count', processes);
            } else if (typeof processes === 'object') {
                updateElement('process-count', Object.keys(processes).length || '--');
            } else {
                updateElement('process-count', String(processes));
            }
        } else {
            updateElement('process-count', '--');
        }
    }

    async function loadProcessCount() {
        try {
            // Try to get process count from the stats endpoint
            const response = await fetch('/api/system/stats');
            if (response.ok) {
                const data = await response.json();
                if (data.processes) {
                    // Handle different data structures for processes
                    if (Array.isArray(data.processes)) {
                        updateElement('process-count', data.processes.length);
                    } else if (typeof data.processes === 'number') {
                        updateElement('process-count', data.processes);
                    } else if (typeof data.processes === 'object') {
                        // If it's an object, try to count properties or extract a number
                        updateElement('process-count', Object.keys(data.processes).length || '--');
                    } else {
                        updateElement('process-count', String(data.processes));
                    }
                } else {
                    updateElement('process-count', '--');
                }
            } else {
                updateElement('process-count', 'N/A');
            }
        } catch (error) {
            console.error('Error loading process count:', error);
            updateElement('process-count', 'N/A');
        }
    }
    
    function updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            element.style.color = ''; // Reset any error styling
        }
    }
    
    function setErrorState(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.color = 'var(--devwatch-error)';
        }
    }
    
    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (e) {
            return 'Invalid Date';
        }
    }
    
    // Manual refresh functions
    function refreshAll() {
        loadConsolidatedData();
    }
    
    function setupMessageTesting() {
        const messageLog = document.getElementById('message-log');
        const sendBtn = document.getElementById('send-message-btn');
        const clearBtn = document.getElementById('clear-log-btn');
        const pingBtn = document.getElementById('ping-host-btn');
        const testBtn = document.getElementById('message-test-btn');
        
        // Message log functionality
        function logMessage(direction, type, data, success = true) {
            if (!messageLog) return;
            
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.style.marginBottom = '0.25rem';
            logEntry.style.color = success ? 'var(--devwatch-text-primary)' : 'var(--devwatch-error)';
            
            const arrow = direction === 'out' ? '→' : '←';
            const prefix = direction === 'out' ? 'SENT' : 'RECV';
            logEntry.innerHTML = `<span style="color: var(--devwatch-text-muted)">[${timestamp}]</span> ${arrow} ${prefix}: <strong>${type}</strong>`;
            
            if (data && Object.keys(data).length > 0) {
                logEntry.innerHTML += `<br><span style="color: var(--devwatch-text-secondary); margin-left: 1rem;">${JSON.stringify(data)}</span>`;
            }
            
            // Remove placeholder if it exists
            const placeholder = messageLog.querySelector('[style*="font-style: italic"]');
            if (placeholder) {
                placeholder.remove();
            }
            
            messageLog.appendChild(logEntry);
            messageLog.scrollTop = messageLog.scrollHeight;
        }
        
        // Send message function
        function sendMessage(type, data = {}) {
            if (!window.DevWatch) {
                logMessage('out', type, data, false);
                logMessage('out', 'ERROR', { message: 'PJA SDK not available' }, false);
                return;
            }
            
            try {
                window.DevWatch.sendMessage(type, data);
                logMessage('out', type, data, true);
            } catch (error) {
                logMessage('out', 'ERROR', { message: error.message }, false);
            }
        }
        
        // Quick ping button
        if (pingBtn) {
            pingBtn.addEventListener('click', () => {
                sendMessage('ping', { timestamp: Date.now(), message: 'Hello from iframe!' });
            });
        }
        
        // Message test button - opens Messages tab
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                // Switch to messages tab
                const messagesTab = document.querySelector('[data-tab="messages"]');
                const messagesContent = document.getElementById('messages');
                
                if (messagesTab && messagesContent) {
                    // Remove active from all tabs
                    document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                    
                    // Activate messages tab
                    messagesTab.classList.add('active');
                    messagesContent.classList.add('active');
                }
            });
        }
        
        // Send message button
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                const typeSelect = document.getElementById('message-type');
                const dataTextarea = document.getElementById('message-data');
                
                if (!typeSelect || !dataTextarea) return;
                
                const type = typeSelect.value;
                let data = {};
                
                // Parse JSON data if provided
                if (dataTextarea.value.trim()) {
                    try {
                        data = JSON.parse(dataTextarea.value.trim());
                    } catch (e) {
                        logMessage('out', 'ERROR', { message: 'Invalid JSON in message data' }, false);
                        return;
                    }
                }
                
                // Add some default data for certain message types
                if (type === 'ping') {
                    data = { ...data, timestamp: Date.now(), source: 'system-control-panel' };
                } else if (type === 'devwatch-title-update') {
                    data = { title: data.title || 'System Control Panel - Test Title', ...data };
                } else if (type === 'devwatch-theme-update') {
                    data = { theme: data.theme || 'matrix', ...data };
                }
                
                sendMessage(type, data);
            });
        }
        
        // Clear log button
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (messageLog) {
                    messageLog.innerHTML = '<div style="color: var(--devwatch-text-muted); font-style: italic;">Message log cleared...</div>';
                }
            });
        }
        
        // Update message type data placeholder
        const typeSelect = document.getElementById('message-type');
        const dataTextarea = document.getElementById('message-data');
        
        if (typeSelect && dataTextarea) {
            typeSelect.addEventListener('change', () => {
                const type = typeSelect.value;
                let placeholder = '{"key": "value"}';
                
                switch (type) {
                    case 'ping':
                        placeholder = '{"message": "Hello from iframe!"}';
                        break;
                    case 'devwatch-theme-update':
                        placeholder = '{"theme": "cyberpunk"}';
                        break;
                    case 'devwatch-title-update':
                        placeholder = '{"title": "Custom Title"}';
                        break;
                    case 'pja-custom-test':
                        placeholder = '{"testData": "example", "count": 42}';
                        break;
                }
                
                dataTextarea.placeholder = placeholder;
            });
        }
        
        // Listen for messages from host
        window.addEventListener('message', (event) => {
            if (event.source !== window.parent) return;
            
            const { source, type, data } = event.data;
            if (source === 'devwatch-host') {
                logMessage('in', type, data, true);
            } else if (source === 'devwatch-iframe-log' && type === 'log-event') {
                // Handle log events from other iframes if the setting is enabled
                const showLogs = localStorage.getItem('pja-show-ui-logs') === 'true';
                if (showLogs) {
                    const logData = data || {};
                    const message = `${logData.from} - ${logData.message}`;
                    logMessage('in', logData.level || 'INFO', { message, ...logData.data }, true);
                }
            }
        });
        
        // Expose logMessage globally for iframe SDK
        window.systemControlPanel.logMessage = logMessage;
        
        // Initial log message
        logMessage('out', 'SYSTEM', { status: 'Message testing initialized' }, true);
    }

    function setupIconManagement() {
        const iconEditorBtn = document.getElementById('icon-editor-btn');
        const backToMonitorBtn = document.getElementById('back-to-monitor-btn');
        const iconEditorPanel = document.getElementById('icon-editor-panel');
        const systemMonitorPanel = document.getElementById('system-monitor-panel');

        if (!iconEditorBtn || !backToMonitorBtn || !iconEditorPanel || !systemMonitorPanel) {
            console.warn('Icon management elements not fully found');
            return;
        }

        iconEditorBtn.addEventListener('click', () => {
            // Use the panel manager to switch to icon editor
            // Hide system monitor panel and show icon editor panel
            systemMonitorPanel.classList.remove('is-active');
            iconEditorPanel.classList.add('is-active');

            // Load PIF editor if not already loaded
            const editorContainer = document.getElementById('pif-editor-container');
            if (editorContainer && (!editorContainer.innerHTML.trim())) {
                // Trigger PIF editor initialization
                if (window.DevWatchIconEditor) {
                    window.DevWatchIconEditor.init(editorContainer);
                } else {
                    console.error('DevWatchIconEditor not available');
                }
            }
        });

        backToMonitorBtn.addEventListener('click', () => {
            // Use the panel manager to switch back to system monitor
            iconEditorPanel.classList.remove('is-active');
            systemMonitorPanel.classList.add('is-active');
        });
    }
    
    console.log('System Control Panel initialized with PCB-style interface');
});