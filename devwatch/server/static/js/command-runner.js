// Command Runner - Refactored from Playwright Job Runner
function initializeCommandRunner() {
    if (!window.APP) {
        console.warn("APP namespace not loaded yet. Retrying in 100ms...");
        setTimeout(initializeCommandRunner, 100);
        return;
    }

    // Optional: Add a soft check for PJA namespace if needed
    if (!window.DevWatch) {
        console.warn("PJA namespace not loaded. Some features may be limited.");
    }

    // UI Components
    let layout = null;
    let panels = {};
    
    // DOM elements (will be assigned after panel creation)
    let commandNameInput, commandInput, environmentSelect, commandTypeSelect, 
        newCommandTypeSelect, runCommandBtn, saveCommandBtn, commandsList, 
        activityLog, resultsList, jsonContent, copyJsonBtn, refreshJsonBtn;

    // State
    let commands = [];
    let commandTypes = [];
    let selectedCommandType = '';
    let selectedNewCommandType = '';
    let selectedCommandId = null;
    let commandResults = [];
    let currentJsonData = {};
    let lastCommandResponse = null;
    let currentActivityId = null;
    let progressPollingInterval = null;

    const API_BASE = window.location.origin;

    function initialize() {
        createLayout();
        createPanels();
        loadCommandTypes();
        loadCommandResults();
        renderResults(); // Initial render
        attachEventListeners();
        
        window.DevWatchPanelManager.loadAllStates();
        
        APP.log.info('frontend.command-runner', 'Command Runner initialized successfully with Panel System');

        // Subscribe to global events for reactive updates
        window.APP?.bus?.on('commands:updated', () => {
            if (selectedCommandType) {
                refreshCommandsForType(selectedCommandType);
            }
        });

        // Subscribe the activity log to the activity bus
        if (window.APP.activityBus) {
            window.APP.activityBus.subscribe(renderActivityLog);
        }
        
        APP.activityBus.addEntry({
            from: 'command-runner',
            message: 'Command Runner initialized.'
        });
    }
    
    function createLayout() {
        const container = document.getElementById('command-runner-layout-container');
        if (!container) {
            throw new Error('Command Runner layout container not found');
        }
        
        layout = new DevWatchColumnLayout({
            id: 'command-runner-main-layout',
            parentContainer: container,
            leftColumnWidth: 320,
            minLeftWidth: 250,
            maxLeftWidth: 500,
            minRightWidth: 400
        });
        
        window.DevWatchPanelManager.registerLayout(layout);

        // Add long-press event listeners for column editor
        const longPress = new LongPress(2000); // 2-second long press
        longPress.attach(layout.leftColumn, () => showColumnEditor('left'));
        longPress.attach(layout.rightColumn, () => showColumnEditor('right'));
    }

    function createPanels() {
        // Left Column Panels
        panels.commandType = new DevWatchPanel({
            id: 'command-type-panel',
            title: 'Select Command Type',
            content: createCommandTypeContent(),
            position: 'left',
            isCollapsed: false
        });

        panels.savedCommands = new DevWatchPanel({
            id: 'saved-commands-panel',
            title: 'Saved Commands',
            content: createSavedCommandsContent(),
            position: 'left',
            isCollapsed: false
        });

        panels.newCommand = new DevWatchPanel({
            id: 'new-command-panel',
            title: 'New Command',
            content: createNewCommandContent(),
            position: 'left',
            isCollapsed: true
        });

        // Right Column Panels
        panels.activity = new DevWatchPanel({
            id: 'activity-panel',
            title: 'Activity',
            content: createActivityContent(),
            position: 'right'
        });
        
        // Add menu to activity panel header after creation
        addActivityPanelMenu();

        panels.selectedCommand = new DevWatchPanel({
            id: 'selected-command-panel',
            title: 'Selected Command',
            content: createCommandContent(),
            position: 'right'
        });

        panels.results = new DevWatchPanel({
            id: 'results-panel',
            title: 'Previous Results',
            content: createResultsContent(),
            position: 'right'
        });
        
        // Add search to results panel header after creation
        addResultsPanelSearch();

        panels.json = new DevWatchPanel({
            id: 'json-panel',
            title: 'Raw JSON',
            content: createJsonContent(),
            position: 'right'
        });

        // Register all panels and add to layout
        Object.values(panels).forEach(panel => {
            window.DevWatchPanelManager.registerPanel(panel);
            layout.addPanel(panel, panel.position);
        });
        
        // Assign form elements after panels are created and content is in the DOM
        assignFormElements();
    }
    
    // --- Panel Content Creation ---
    function createCommandTypeContent() {
        return `
            <div class="devwatch-panel__content-padded">
                <div class="devwatch-section-description">Select type to filter commands</div>
                <div class="form-group" style="margin-top:12px;">
                    <label for="module-type-select">Command Type:</label>
                    <select id="module-type-select" class="pja-select">
                        <option value="">Loading types...</option>
                    </select>
                </div>
            </div>
        `;
    }

    function createSavedCommandsContent() {
        return `
            <div class="devwatch-panel__content-padded">
                <div class="devwatch-section-description">Select command → Execute</div>
                <div class="commands-list" id="commands-list"></div>
            </div>
        `;
    }
    
    function createNewCommandContent() {
        return `
            <div class="devwatch-panel__content-padded">
                <div class="devwatch-section-description">Create and save new commands</div>
                <form class="command-form">
                    <div class="form-group">
                        <label for="new-module-type-select">Command Type</label>
                        <select id="new-module-type-select" class="pja-select">
                            <option value="">Select command type...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="command-name">Command Name</label>
                        <input type="text" id="command-name" class="devwatch-input" placeholder="e.g., Mobile Smoke Test">
                    </div>
                    <div class="form-group">
                        <label for="command-input">Command</label>
                        <input type="text" id="command-input" class="devwatch-input" placeholder="npx playwright test ...">
                    </div>
                    <div class="form-group">
                        <label for="environment-select">Environment</label>
                        <select id="environment-select" class="pja-select">
                            <option value="dev">Development</option>
                            <option value="staging">Staging</option>
                            <option value="prod">Production</option>
                            <option value="local">Local</option>
                        </select>
                    </div>
                    <div class="btn-group">
                        <button type="button" id="run-command-btn" class="devwatch-button devwatch-button--primary" disabled>Run</button>
                        <button type="button" id="save-command-btn" class="devwatch-button" disabled>Save to Type</button>
                    </div>
                </form>
            </div>
        `;
    }

    function assignFormElements() {
        commandNameInput = document.getElementById('command-name');
        commandInput = document.getElementById('command-input');
        environmentSelect = document.getElementById('environment-select');
        commandTypeSelect = document.getElementById('module-type-select');
        newCommandTypeSelect = document.getElementById('new-module-type-select');
        runCommandBtn = document.getElementById('run-command-btn');
        saveCommandBtn = document.getElementById('save-command-btn');
        commandsList = document.getElementById('commands-list');
        activityLog = document.getElementById('activity-log');
        resultsList = document.getElementById('results-list');
        jsonContent = document.getElementById('json-content');
        copyJsonBtn = document.getElementById('copy-json-btn');
        refreshJsonBtn = document.getElementById('refresh-json-btn');
    }

    function showColumnEditor(column) {
        APP.log.info('frontend.command-runner', `Column editor triggered for ${column} column.`);
        // Placeholder for the new UI
        alert(`Long press detected on ${column} column! Implement editor here.`);
    }
    
    class LongPress {
        constructor(duration = 1000) {
            this.duration = duration;
            this.timer = null;
        }
        attach(element, callback) {
            if (!element) return;
            element.addEventListener('mousedown', e => this.onMouseDown(e, callback));
            element.addEventListener('touchstart', e => this.onMouseDown(e, callback));
            element.addEventListener('mouseup', () => this.onMouseUp());
            element.addEventListener('mouseleave', () => this.onMouseUp());
            element.addEventListener('touchend', () => this.onMouseUp());
        }
        onMouseDown(e, callback) {
            // Only trigger for primary button and if target is the column itself
            if (e.button === 0 && e.target.classList.contains('devwatch-column')) {
                this.timer = setTimeout(() => {
                    callback(e);
                }, this.duration);
            }
        }
        onMouseUp() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }
    }

    function createActivityContent() {
        return `<div class="activity-log" id="activity-log"></div>`;
    }

    function addActivityPanelMenu() {
        const activityPanel = panels.activity.element;
        const titleArea = activityPanel.querySelector('.devwatch-panel__title-area');
        
        if (titleArea) {
            // Create menu container
            const menuContainer = document.createElement('div');
            menuContainer.className = 'devwatch-panel__menu';
            menuContainer.style.cssText = 'margin-left: auto; display: flex; align-items: center; gap: 8px;';
            
            // Prevent panel toggle when clicking on menu container
            menuContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Create clear button
            const clearBtn = document.createElement('button');
            clearBtn.className = 'devwatch-button devwatch-button--ghost devwatch-button--small';
            clearBtn.innerHTML = '🗑️ Clear';
            clearBtn.title = 'Clear activity log';
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clearActivityLog();
            });
            
            menuContainer.appendChild(clearBtn);
            titleArea.appendChild(menuContainer);
        }
    }

    function clearActivityLog() {
        if (window.APP.activityBus) {
            window.APP.activityBus.clear();
        }
        
        // Also clear the UI
        const activityLogEl = document.getElementById('activity-log');
        if (activityLogEl) {
            activityLogEl.innerHTML = '<div class="log-entry log-level-info"><span class="log-timestamp">[' + new Date().toLocaleTimeString() + ']</span><span class="log-message">Activity log cleared</span></div>';
        }
    }

    function addResultsPanelSearch() {
        const resultsPanel = panels.results.element;
        const titleArea = resultsPanel.querySelector('.devwatch-panel__title-area');
        
        if (titleArea) {
            // Create search container
            const searchContainer = document.createElement('div');
            searchContainer.className = 'devwatch-panel__search';
            searchContainer.style.cssText = 'margin-left: auto; display: flex; align-items: center; gap: 6px;';
            
            // Prevent panel toggle when clicking on search container
            searchContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Create search input
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'devwatch-input devwatch-input--small';
            searchInput.placeholder = 'last 10 min, today, yesterday...';
            searchInput.style.cssText = 'width: 140px; font-size: 11px;';
            searchInput.addEventListener('input', handleResultsSearch);
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleResultsSearch(e);
                }
            });
            
            // Prevent panel toggle when clicking on search input
            searchInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            searchInput.addEventListener('focus', (e) => {
                e.stopPropagation();
            });
            
            searchContainer.appendChild(searchInput);
            titleArea.appendChild(searchContainer);
        }
    }

    let resultsSearchFilter = null;

    function handleResultsSearch(e) {
        const query = e.target.value.trim().toLowerCase();
        
        if (!query) {
            resultsSearchFilter = null;
            renderResults();
            return;
        }

        const now = new Date();
        let filterTime = null;

        // Parse natural language time queries
        if (query.includes('last') || query.includes('past')) {
            if (query.includes('minute') || query.includes('min')) {
                const minutes = parseInt(query.match(/\d+/)?.[0]) || 10;
                filterTime = new Date(now.getTime() - minutes * 60 * 1000);
            } else if (query.includes('hour') || query.includes('hr')) {
                const hours = parseInt(query.match(/\d+/)?.[0]) || 1;
                filterTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
            } else if (query.includes('day')) {
                const days = parseInt(query.match(/\d+/)?.[0]) || 1;
                filterTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            } else if (query.includes('week')) {
                const weeks = parseInt(query.match(/\d+/)?.[0]) || 1;
                filterTime = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
            }
        } else if (query === 'today') {
            filterTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (query === 'yesterday') {
            filterTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        } else if (query.includes('success') || query.includes('passed')) {
            resultsSearchFilter = (result) => result.success === true;
            renderResults();
            return;
        } else if (query.includes('fail') || query.includes('error')) {
            resultsSearchFilter = (result) => result.success === false;
            renderResults();
            return;
        } else {
            // Text search in command names
            resultsSearchFilter = (result) => 
                result.name.toLowerCase().includes(query) || 
                result.command.toLowerCase().includes(query);
            renderResults();
            return;
        }

        if (filterTime) {
            resultsSearchFilter = (result) => new Date(result.timestamp) >= filterTime;
            renderResults();
        }
    }

    function renderActivityLog(activities) {
        const activityLogEl = document.getElementById('activity-log');
        if (!activityLogEl) return;

        activityLogEl.innerHTML = activities.map(entry => {
            const timestamp = new Date(entry.timestamp).toLocaleTimeString();
            const from = entry.from || 'system';
            const level = entry.level || 'info';
            
            // Check if this is a test-related entry that should be linkable
            const isTestEntry = entry.data && (entry.data.reportUrl || entry.data.command);
            let reportUrl = entry.data?.reportUrl;
            
            // If no specific report URL but it's a playwright test, use general reports page
            if (!reportUrl && entry.data?.command?.includes('playwright test')) {
                reportUrl = '/reports/';
            }
            
            let messageContent = entry.message;
            if (isTestEntry && reportUrl) {
                messageContent = `<a href="${reportUrl}" target="_blank" class="activity-link" title="View test results">${entry.message}</a>`;
            }
            
            return `
                <div class="log-entry log-level-${level}" ${entry.data?.activityId ? `data-activity-id="${entry.data.activityId}"` : ''}>
                    <span class="log-timestamp">${timestamp}</span>
                    <span class="log-from" title="${from}">${from}</span>
                    <span class="log-message">${messageContent}</span>
                </div>
            `;
        }).join('');
        activityLogEl.scrollTop = activityLogEl.scrollHeight;
    }

    function createCommandContent() {
        return `
            <div class="command-details" id="command-tab">
                <div class="empty-state">
                    Select a command from the list to view details
                </div>
            </div>
        `;
    }

    function createResultsContent() {
        return `
            <div class="results-list" id="results-list">
                <div class="empty-state">
                    No previous results yet
                </div>
            </div>
        `;
    }

    function createJsonContent() {
        return `
            <div class="json-viewer" id="json-viewer">
                <div class="json-viewer-header">
                    <h4>Raw JSON Data</h4>
                    <div class="json-controls">
                        <button class="btn btn-sm" id="copy-json-btn">Copy</button>
                        <button class="btn btn-sm" id="refresh-json-btn">Refresh</button>
                    </div>
                </div>
                <div class="json-content" id="json-content">
                    <div class="empty-state">
                        Select a command or run a test to view JSON data
                    </div>
                </div>
            </div>
        `;
    }

    function attachEventListeners() {
        if (runCommandBtn) runCommandBtn.addEventListener('click', runCurrentCommand);
        if (saveCommandBtn) saveCommandBtn.addEventListener('click', saveCurrentCommand);
        
        // Tab switching is now handled by PJA Tabbed View
        
        // JSON tab controls will be attached when tab content is created
        document.addEventListener('click', (e) => {
            if (e.target.id === 'copy-json-btn') {
                copyJsonToClipboard();
            } else if (e.target.id === 'refresh-json-btn') {
                refreshJsonData();
            }
        });
        
        // Form validation and command type selection
        const commandNameInput = document.getElementById('command-name');
        const commandInput = document.getElementById('command-input');
        const commandTypeSelect = document.getElementById('module-type-select');
        const newCommandTypeSelect = document.getElementById('new-module-type-select');
        
        if (commandNameInput) commandNameInput.addEventListener('input', updateFormState);
        if (commandInput) commandInput.addEventListener('input', updateFormState);
        if (commandTypeSelect) commandTypeSelect.addEventListener('change', onCommandTypeChange);
        if (newCommandTypeSelect) newCommandTypeSelect.addEventListener('change', onNewCommandTypeChange);
    }

    function updateFormState() {
        // Allow running when a command is selected
        if (runCommandBtn) runCommandBtn.disabled = !selectedCommandId;
        
        // Allow saving when form has required fields and command type is selected
        const commandNameInput = document.getElementById('command-name');
        const commandInput = document.getElementById('command-input');
        const hasRequiredFields = commandNameInput?.value?.trim() && 
                                 commandInput?.value?.trim() && 
                                 selectedNewCommandType;
        if (saveCommandBtn) saveCommandBtn.disabled = !hasRequiredFields;
    }

    async function loadCommandTypes() {
        try {
            // Use default command types since there's no specific API for types
            commandTypes = [
                { value: 'playwright', label: 'Playwright', description: 'Test execution commands', path: 'playwright' },
                { value: 'system', label: 'System', description: 'System information commands', path: 'system' },
                { value: 'smoke-tests', label: 'Smoke Tests', description: 'Quick validation tests', path: 'smoke-tests' },
                { value: 'integration', label: 'Integration', description: 'Integration test commands', path: 'integration' }
            ];
            
            renderCommandTypes();
            
            // Default to playwright if available
            if (commandTypes.length > 0) {
                selectedCommandType = 'playwright';
                const commandTypeSelect = document.getElementById('module-type-select');
                if(commandTypeSelect) commandTypeSelect.value = selectedCommandType;
                await refreshCommandsForType(selectedCommandType);
            }
        } catch (e) {
            window.APP.log.error('COMMAND_RUNNER.commands.load.failed', 'Failed to load command types', { data: { error: e.message } });
            // Fallback to default types
            commandTypes = [
                { value: 'playwright', label: 'Playwright', description: 'Test execution commands', path: 'playwright' }
            ];
            renderCommandTypes();
        }
    }

    function renderCommandTypes() {
        const commandTypeSelect = document.getElementById('module-type-select');
        const newCommandTypeSelect = document.getElementById('new-module-type-select');
        if (!commandTypeSelect || !newCommandTypeSelect) return;
        
        // Render options for main command type selector
        commandTypeSelect.innerHTML = '';
        commandTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = `${type.label} - ${type.description}`;
            commandTypeSelect.appendChild(option);
        });

        // Render options for new command type selector
        newCommandTypeSelect.innerHTML = '<option value="">Select command type...</option>';
        commandTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            newCommandTypeSelect.appendChild(option);
        });
    }

    async function onCommandTypeChange() {
        const commandTypeSelect = document.getElementById('module-type-select');
        selectedCommandType = commandTypeSelect.value;
        selectedCommandId = null;
        await refreshCommandsForType(selectedCommandType);
        updateFormState();
        
        window.APP.log.info('COMMAND_RUNNER.type.change', `Switched to ${selectedCommandType} commands`, {
            data: { commandType: selectedCommandType }
        });
    }

    function onNewCommandTypeChange() {
        const newCommandTypeSelect = document.getElementById('new-module-type-select');
        selectedNewCommandType = newCommandTypeSelect.value;
        updateFormState();
        
        window.APP.log.info('COMMAND_RUNNER.new.type.select', `Selected ${selectedNewCommandType} for new command`, {
            data: { commandType: selectedNewCommandType },
        });
    }

    async function refreshCommandsForType(commandType) {
        try {
            if (commandType === 'playwright') {
                await loadPlaywrightCommands();
            } else if (commandType === 'system') {
                await loadSystemCommands();
            } else {
                await loadCommandTypeCommands(commandType);
            }
            renderCommands();
            updateFormState();
        } catch (e) {
            window.APP.log.error('COMMAND_RUNNER.commands.load.failed', `Failed to load ${commandType} commands`, { data: { error: e.message } });
        }
    }

    async function loadCommandTypeCommands(commandType) {
        try {
            const resp = await fetch(`${API_BASE}/api/saved-commands/${commandType}`);
            if (resp.ok) {
                const list = await resp.json();
                commands = Array.isArray(list) ? list : [];
            } else if (resp.status === 404) {
                // No saved commands yet for this type
                commands = [];
                window.APP.log.warn('COMMAND_RUNNER.commands.none', `No ${commandType} commands found yet. Create some using the form below.`);
            } else {
                throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
            }
        } catch (e) {
            window.APP.log.error('COMMAND_RUNNER.commands.load.failed', `Failed to load ${commandType} commands`, { data: { error: e.message } });
            commands = [];
        }
    }

    async function loadPlaywrightCommands() {
        try {
            const resp = await fetch(`${API_BASE}/api/saved-commands/playwright`);
            if (resp.ok) {
                const list = await resp.json();
                commands = Array.isArray(list) ? list : [];
            } else if (resp.status === 404) {
                // No saved commands yet, this is normal
                commands = [];
                window.APP.log.info('COMMAND_RUNNER.playwright.none', 'No Playwright commands found yet. Create some using the form below.');
            } else {
                throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
            }
        } catch (e) {
            window.APP.log.error('COMMAND_RUNNER.playwright.load.failed', 'Failed to load Playwright commands', { data: { error: e.message } });
            commands = [];
        }
    }

    async function loadSystemCommands() {
        // Create built-in system commands
        commands = [
            {
                id: 'sys-pwd',
                name: 'Get Current Directory',
                type: 'system',
                command: 'pwd',
                environment: 'local',
                description: 'Show current working directory',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                json: {
                    environment: {},
                    options: { systemCommand: true }
                }
            },
            {
                id: 'sys-disk-usage',
                name: 'Disk Usage',
                type: 'system', 
                command: 'df -h',
                environment: 'local',
                description: 'Show disk space usage',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                json: {
                    environment: {},
                    options: { systemCommand: true }
                }
            },
            {
                id: 'sys-memory',
                name: 'Memory Usage',
                type: 'system',
                command: 'free -h',
                environment: 'local', 
                description: 'Show memory usage',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                json: {
                    environment: {},
                    options: { systemCommand: true }
                }
            }
        ];
    }
    
    function loadCommandResults() {
        commandResults = APP.utils.storage.get('command_results', []);
        
        // Migrate old report URLs to new format
        let needsSave = false;
        commandResults = commandResults.map(result => {
            if (result.result && result.result.reportPaths && result.result.reportPaths.webUrl) {
                const webUrl = result.result.reportPaths.webUrl;
                // Migrate ANY old URL format to use the reports route
                if (webUrl.includes('localhost') || webUrl.includes('/api/') || webUrl.includes('/show-report')) {
                    // Extract report directory if possible, otherwise use general reports page
                    let reportPath = '/reports/';
                    if (webUrl.includes('path=')) {
                        const match = webUrl.match(/path=([^&]+)/);
                        if (match) {
                            const dirName = match[1].replace('/index.html', '');
                            reportPath = `/reports/${dirName}/index.html`;
                        }
                    }
                    result.result.reportPaths.webUrl = reportPath;
                    needsSave = true;
                    console.log(`Migrated URL from ${webUrl} to ${reportPath}`);
                }
            }
            return result;
        });
        
        if (needsSave) {
            saveCommandResults();
            console.log('Migrated cached command results to new report URL format');
        }
        
        // FORCE CLEAR any localhost URLs that might still be cached
        let forceClear = false;
        commandResults = commandResults.map(result => {
            if (result.result && result.result.reportPaths && result.result.reportPaths.webUrl) {
                if (result.result.reportPaths.webUrl.includes('localhost')) {
                    result.result.reportPaths.webUrl = '/reports/';
                    forceClear = true;
                    console.log('FORCE CLEARED localhost URL');
                }
            }
            return result;
        });
        
        if (forceClear) {
            saveCommandResults();
        }
    }

    function saveCommandResults() {
        APP.utils.storage.set('command_results', commandResults);
    }

    function getEnvironmentColor(env) {
        const colors = {
            'dev': 'var(--devwatch-color-warning, #ffa500)',
            'development': 'var(--devwatch-color-warning, #ffa500)',
            'staging': 'var(--devwatch-color-info, #17a2b8)',
            'prod': 'var(--devwatch-color-danger, #dc3545)',
            'production': 'var(--devwatch-color-danger, #dc3545)',
            'local': 'var(--devwatch-color-text-muted, #888)'
        };
        return colors[env.toLowerCase()] || 'var(--devwatch-color-text-secondary, #aaa)';
    }

    function truncateCommand(command, maxLength = 60) {
        if (!command || command.length <= maxLength) {
            return command;
        }
        return command.substring(0, maxLength) + '...';
    }

    function renderCommands() {
        const commandsList = document.getElementById('commands-list');
        if (!commandsList) {
            console.warn('Commands list element not found - may not be initialized yet');
            return;
        }
        
        if (commands.length === 0) {
            commandsList.innerHTML = '<div class="empty-state">No saved commands yet</div>';
            return;
        }

        commandsList.innerHTML = commands.map(item => {
            const typeLabel = item.type === 'system' ? 'system' : 'saved';
            const typeIcon = item.type === 'system' ? '⚙️' : '💾';
            const envColor = getEnvironmentColor(item.environment || 'local');
            
            return `
                <div class="saved-command-card ${selectedCommandId === item.id ? 'selected' : ''}" 
                     data-command-id="${item.id}">
                    <div class="command-card-header">
                        <div class="command-title-section">
                            <div class="command-name">${item.name}</div>
                            <div class="command-badges">
                                <span class="command-type-badge ${item.type}">${typeIcon} ${typeLabel}</span>
                                <span class="environment-badge ${item.environment || 'local'}">
                                    ${item.environment || 'local'}
                                </span>
                            </div>
                        </div>
                        <button class="devwatch-button devwatch-button--ghost devwatch-button--accent devwatch-button--small run-command" 
                                data-command-id="${item.id}" title="Run command">
                            ▶ Run
                        </button>
                    </div>
                    
                    <div class="command-card-body collapsed">
                        <div class="command-preview">${truncateCommand(item.command || 'No command specified', 60)}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners to command items
        commandsList.querySelectorAll('.saved-command-card').forEach(item => {
            item.addEventListener('click', (e) => {
                // Prevent toggle if clicking on run button
                if (e.target.classList.contains('devwatch-button')) {
                    return;
                }

                // Toggle expanded state
                const commandBody = item.querySelector('.command-card-body');
                const isExpanded = commandBody.classList.toggle('expanded');
                commandBody.classList.remove('collapsed');

                // If expanding, add full details
                if (isExpanded) {
                    const commandId = item.dataset.commandId;
                    const command = commands.find(c => c.id === commandId);
                    
                    if (command) {
                        commandBody.innerHTML = `
                            <div class="command-preview">${command.command || 'No command specified'}</div>
                            ${command.description ? `<div class="command-description">${command.description}</div>` : ''}
                            <div class="command-timestamp">
                                Created ${new Date(command.createdAt || command.updatedAt || Date.now()).toLocaleDateString()}
                                ${command.lastRun ? ` • Last run ${new Date(command.lastRun).toLocaleDateString()}` : ''}
                            </div>
                        `;
                    }
                } else {
                    // Collapse back to truncated view
                    commandBody.innerHTML = `
                        <div class="command-preview">${truncateCommand(item.dataset.command || 'No command specified', 60)}</div>
                    `;
                    commandBody.classList.add('collapsed');
                }

                // Prevent selecting command if just expanding
                if (!e.target.classList.contains('run-command')) {
                    selectCommand(item.dataset.commandId);
                }
            });
        });

        commandsList.querySelectorAll('.run-command').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                runSavedCommand(btn.dataset.commandId);
            });
        });

        // Delete disabled in Command Runner; manage via PCB
    }

    function renderResults() {
        const resultsList = document.getElementById('results-list');
        if (!resultsList) {
            console.warn('Results list element not found - may not be initialized yet');
            return;
        }
        
        if (commandResults.length === 0) {
            resultsList.innerHTML = '<div class="empty-state">No previous results yet</div>';
            return;
        }

        // Apply search filter if active
        let filteredResults = commandResults;
        if (resultsSearchFilter) {
            filteredResults = commandResults.filter(resultsSearchFilter);
            
            if (filteredResults.length === 0) {
                resultsList.innerHTML = '<div class="empty-state">No results match your search</div>';
                return;
            }
        }

        resultsList.innerHTML = filteredResults.slice(-10).reverse().map(result => {
            const isPlaywrightCommand = result.command.includes('playwright test');
            const reportPath = isPlaywrightCommand ? getReportPath(result) : null;
            const statusClass = result.success ? 'success' : 'error';
            const statusIcon = result.success ? '✔' : '✖';
            
            return `
                <div class="result-item status-${statusClass}">
                    <div class="result-status-icon" style="color: var(--devwatch-color-${result.success ? 'success' : 'danger'});">${statusIcon}</div>
                    
                    <div class="result-title">
                        ${result.name}
                        <div class="result-timestamp">${new Date(result.timestamp).toLocaleString()}</div>
                    </div>

                    <div class="result-actions">
                        ${reportPath ? `<button class="command-runner-ghost-btn info view-report-btn" data-report-url="${reportPath}">View Results</button>` : ''}
                        <button class="command-runner-ghost-btn repeat-command" data-command="${encodeURIComponent(result.command)}" data-env="${result.environment}">Repeat</button>
                    </div>

                    <div class="result-command">${result.command}</div>
                    
                    <div class="result-meta">
                        <strong>Environment:</strong> ${result.environment || 'N/A'}
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners to repeat buttons
        resultsList.querySelectorAll('.repeat-command').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = decodeURIComponent(btn.dataset.command);
                const env = btn.dataset.env || 'dev';
                panelLog(`Re-running command: ${cmd}`, { toSystem: true });
                executeCommand('Repeat', cmd, env);
            });
        });

        // Attach event listeners to view report buttons
        resultsList.querySelectorAll('.view-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reportUrl = btn.dataset.reportUrl;
                window.open(reportUrl, '_blank');
            });
        });
    }

    function getReportPath(result) {
        // Check if result has actual report path from backend
        if (result.result && result.result.reportPaths && result.result.reportPaths.webUrl) {
            // Convert old directory-based URLs to new test route format
            const webUrl = result.result.reportPaths.webUrl;
            if (webUrl.includes('/reports/') && webUrl.includes('/index.html')) {
                // Extract directory name and convert to testId format
                const match = webUrl.match(/\/reports\/([^\/]+)\/index\.html/);
                if (match) {
                    const dirName = match[1];
                    // Use directory name as testId for new test route
                    return `/reports/test?testId=${dirName}`;
                }
            }
            return result.result.reportPaths.webUrl;
        }
        
        // For all other cases, use the reports route which works through the proxy
        return '/reports/';
    }

    // No longer needed - reports are served directly through /reports/ route

    function selectCommand(commandId) {
        selectedCommandId = commandId;
        renderCommands();
        
        const command = commands.find(c => c.id === commandId);
        if (command) {
            // Load command into form
            const commandNameInput = document.getElementById('command-name');
            const commandInput = document.getElementById('command-input');
            const environmentSelect = document.getElementById('environment-select');
            if (commandNameInput) commandNameInput.value = command.name;
            if (commandInput) commandInput.value = command.command;
            if (environmentSelect) environmentSelect.value = (command.environment || command?.json?.environment?.PLAYWRIGHT_TARGET_ENV || 'dev');
            updateFormState();
            
            panelLog(`Selected ${command.type} command: ${command.name}`, {
                toSystem: true,
                data: {
                    commandId: command.id,
                    commandType: command.type,
                    environment: command.environment
                }
            });

            // Immediately update the Selected Command panel content
            renderSelectedCommand();
            // Update JSON data with selected command
            updateJsonData('selectedCommand', command);
            
            // Switch to Selected Command panel for quick review with visual feedback
            if (layout) {
                // Add a small delay to make the transition more noticeable
                setTimeout(() => {
                    panels.selectedCommand.expand();
                    
                    // Add a subtle highlight effect to the panel content
                    const commandTab = document.getElementById('command-tab');
                    if (commandTab) {
                        commandTab.classList.add('tab-highlight');
                        setTimeout(() => {
                            commandTab.classList.remove('tab-highlight');
                        }, 1000);
                    }
                }, 100);
            }
        }
    }

    function renderSelectedCommand() {
        const commandTab = document.getElementById('command-tab');
        
        if (!commandTab) {
            console.error('Command tab element not found. Panels may not be initialized correctly.');
            return;
        }
        
        if (!selectedCommandId) {
            commandTab.innerHTML = '<div class="command-details"><div class="empty-state">Select a command from the list to view details</div></div>';
            return;
        }

        const command = commands.find(c => c.id === selectedCommandId);
        if (!command) {
            console.error('Selected command not found:', selectedCommandId);
            commandTab.innerHTML = '<div class="command-details"><div class="empty-state">Command not found</div></div>';
            return;
        }

        const env = command.environment || command?.json?.environment?.PLAYWRIGHT_TARGET_ENV || 'dev';
        const created = new Date(command.createdAt || command.updatedAt || Date.now()).toLocaleString();
        const lastRun = command.lastRun ? new Date(command.lastRun).toLocaleString() : 'Never';
        
        // Ensure we're setting a string, not an object
        commandTab.innerHTML = `
            <div class="selected-command-card">
                <div class="selected-command-header">
                    <div class="command-title-area">
                        <div class="command-name">${command.name || 'Unnamed Command'}</div>
                        <div class="command-type-tag">${command.type || 'saved'}</div>
                    </div>
                    <button class="devwatch-button devwatch-button--primary devwatch-button--small" id="run-selected-command-btn">
                        ▶ Run
                    </button>
                </div>
                
                <div class="command-preview-section">
                    <div class="command-preview-label">Command</div>
                    <div class="command-preview-code">${command.command || 'No command specified'}</div>
                </div>
                
                <div class="command-meta-section">
                    <div class="meta-row">
                        <div class="meta-item">
                            <div class="meta-label">Environment</div>
                            <div class="meta-value env-${env}">${env}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Created</div>
                            <div class="meta-value">${new Date(command.createdAt || command.updatedAt || Date.now()).toLocaleDateString()}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Last Run</div>
                            <div class="meta-value ${command.lastRun ? 'has-run' : 'never-run'}">${command.lastRun ? new Date(command.lastRun).toLocaleDateString() : 'Never'}</div>
                        </div>
                    </div>
                </div>
                
                ${command.description ? `
                    <div class="command-description-section">
                        <div class="description-label">Description</div>
                        <div class="description-text">${command.description}</div>
                    </div>
                ` : ''}
            </div>
        `;
        
        const runBtn = commandTab.querySelector('#run-selected-command-btn');
        if(runBtn) {
            runBtn.addEventListener('click', () => runSavedCommand(command.id));
        }
    }

    /**
     * Centralized logging for the command runner panel.
     * Logs to the local UI and optionally to the system logs.
     * @param {string} message - The log message.
     * @param {object} [options={}] - Logging options.
     * @param {string} [options.level='info'] - Log level ('info', 'warn', 'error').
     * @param {object} [options.data={}] - Additional data to log.
     * @param {boolean} [options.toSystem=false] - If true, sends log to server-side system logs.
     * @param {string} [options.from='command-runner'] - The source of the log message.
     */
    function panelLog(message, options = {}) {
        const {
            level = 'info',
            data = {},
            toSystem = false,
            from = 'command-runner'
        } = options;

        // Use the iframe SDK to log to the panel UI if available
        if (window.APP && window.APP.sdk && window.APP.sdk.addLogEntry) {
            window.APP.sdk.addLogEntry(message, level, { ...data, from });
        } else {
            // Fallback to the internal UI logger if SDK is not present
            addLogEntryToUI(`[${from}] ${message}`, level, data ? JSON.stringify(data, null, 2) : null);
        }

        // Log to the system (server-side) if requested
        if (toSystem && message && message.trim()) {
            // Use APP.log if available, fallback to window.Logger
            if (window.APP && window.APP.log && window.APP.log.logToServer) {
                window.APP.log.logToServer(level.toUpperCase(), `panel.${from}`, message, data);
            } else if (window.Logger && window.APP.log.logToServer) {
                window.APP.log.logToServer(level.toUpperCase(), `panel.${from}`, message, data);
            }
        }
    }

    async function saveCurrentCommand() {
        const commandNameInput = document.getElementById('command-name');
        const commandInput = document.getElementById('command-input');
        const environmentSelect = document.getElementById('environment-select');
        const name = commandNameInput?.value?.trim();
        const command = commandInput?.value?.trim();
        const environment = environmentSelect?.value || 'dev';
        
        if (!name || !command || !selectedNewCommandType) {
            window.APP.log.warn('COMMAND_RUNNER.save.validation', 'Please fill in all required fields and select a command type');
            return;
        }

        try {
            const commandData = {
                id: APP.utils.generateId(),
                name,
                command,
                type: selectedNewCommandType,
                environment,
                description: `Saved command in ${selectedNewCommandType} type`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                json: {
                    environment: { PLAYWRIGHT_TARGET_ENV: environment },
                    options: { commandType: selectedNewCommandType }
                }
            };

            const response = await fetch(`${API_BASE}/api/saved-commands/${selectedNewCommandType}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commandData),
            });

            if (response.ok) {
                const result = await response.json();
                panelLog(`Command "${name}" saved to ${selectedNewCommandType} type`, {
                    toSystem: true,
                    level: 'info',
                    data: {
                        commandId: result.id || commandData.id,
                        commandType: selectedNewCommandType,
                        storagePath: `PW_DIR/data/saved-commands/${selectedNewCommandType}/`
                    }
                });
                
                // Clear the form
                clearForm();
                
                // Refresh commands if we're viewing the same type
                if (selectedCommandType === selectedNewCommandType) {
                    await refreshCommandsForType(selectedCommandType);
                }
            } else {
                const error = await response.text();
                panelLog('Failed to save command', {
                    toSystem: true,
                    level: 'error',
                    data: { error }
                });
            }
        } catch (error) {
            panelLog('Error saving command', {
                toSystem: true,
                level: 'error',
                data: { error: error.message }
            });
        }
    }

    function clearForm() {
        const commandNameInput = document.getElementById('command-name');
        const commandInput = document.getElementById('command-input');
        const environmentSelect = document.getElementById('environment-select');
        const newCommandTypeSelect = document.getElementById('new-module-type-select');
        if (commandNameInput) commandNameInput.value = '';
        if (commandInput) commandInput.value = '';
        if (environmentSelect) environmentSelect.value = 'dev';
        if (newCommandTypeSelect) newCommandTypeSelect.value = '';
        selectedCommandId = null;
        selectedNewCommandType = '';
        updateFormState();
    }

    function runCurrentCommand() {
        if (!selectedCommandId) {
            window.APP.log.warn('COMMAND_RUNNER.run.noselection', 'Select a command to run.');
            return;
        }
        const item = commands.find(c => c.id === selectedCommandId);
        if (!item) {
            window.APP.log.error('COMMAND_RUNNER.run.notfound', 'Selected command not found.');
            return;
        }
        const env = (item.environment || item?.json?.environment?.PLAYWRIGHT_TARGET_ENV || 'dev');
        
        // Switch to Activity panel to show command execution progress
        if (layout) {
            panels.activity.expand();
        }
        
        executeCommand(item.name, item.command, env);
    }

    function runSavedCommand(commandId) {
        const command = commands.find(c => c.id === commandId);
        if (command) {
            // Update last run time
            command.lastRun = Date.now();
            renderCommands();
            
            // Switch to Activity panel to show command execution progress
            if (layout) {
                panels.activity.expand();
            }
            
            const env = (command.environment || command?.json?.environment?.PLAYWRIGHT_TARGET_ENV || 'dev');
            executeCommand(command.name, command.command, env);
        }
    }

    function editCommand(commandId) {
        selectCommand(commandId);
        if (layout) {
            panels.activity.expand();
        }
    }

    async function executeCommand(name, command, environment) {
        const commandObj = commands.find(c => c.name === name);
        const commandType = commandObj?.type || 'unknown';
        
        panelLog(`Executing command: ${name}`, {
            toSystem: true,
            level: 'info',
            from: 'runner.execute',
            data: { 
                command, 
                environment, 
                commandType,
                status: 'running',
                storagePath: 'PW_DIR/data/executions/'
            }
        });

        APP.activityBus.addEntry({
            from: 'command-runner',
            message: `🚀 Starting: ${name}`,
            level: 'info',
            data: { command, environment, status: 'starting' }
        });

        try {
            // Use enhanced logging for command execution
            const { response, result, success } = await window.APP.log.executeCommandWithLogging(command, {
                component: 'command-runner',
                type: commandType,
                environment: environment,
                commandName: name
            });
            
            // Store the raw response for JSON viewing
            lastCommandResponse = {
                request: { command, env: environment, name, type: commandType },
                response: result,
                timestamp: new Date().toISOString(),
                success
            };
            updateJsonData('lastCommandResponse', lastCommandResponse);
            
            // Track activity ID for progress monitoring
            if (result.activityId) {
                currentActivityId = result.activityId;
                startProgressPolling();
            }

            // The backend logger already logs the result, so we just update the local UI
            addLogEntryToUI(`${success ? 'Completed' : 'Failed'} ${commandType}: ${name}`, success ? 'success' : 'error', formatResultDetails(result, commandType));
            
            // Add completion message to activity bus with report link
            const reportUrl = getReportPath({ result, command, name });
            APP.activityBus.addEntry({
                from: 'command-runner',
                message: `${success ? '✅ Completed' : '❌ Failed'}: ${name}`,
                level: success ? 'info' : 'error',
                data: { 
                    command, 
                    environment, 
                    status: success ? 'completed' : 'failed',
                    reportUrl: success && reportUrl ? reportUrl : null
                }
            });

            // Store result for later reference
            const commandResult = {
                id: APP.utils.generateId(),
                name,
                command,
                commandType,
                environment,
                timestamp: Date.now(),
                success,
                result
            };

            commandResults.push(commandResult);
            saveCommandResults();
            renderResults();

            if (success) {
                addLogEntryToUI(`Playwright report should be available shortly`, 'info');
            }

        } catch (error) {
            // Enhanced logging already handles logging this error to the backend
            const errorId = `err_${Date.now()}`; // Create a simple local ID

            // Store error response for JSON viewing
            lastCommandResponse = {
                request: { command, env: environment, name },
                error: error.message,
                errorId,
                timestamp: new Date().toISOString(),
                success: false
            };
            updateJsonData('lastCommandResponse', lastCommandResponse);
            
            // Handle specific error types with better user feedback
            if (error.message && error.message.includes('A test run is already in progress')) {
                // Show prominent warning in the UI instead of just console errors
                addLogEntryToUI(`⚠️ CONFLICT: Cannot start "${name}"`, 'warn', 'Another test is currently running - wait or stop it first');
                
                // Show stop button option
                const stopBtn = createStopTestButton();
                if (stopBtn) {
                    const stopContainer = document.createElement('div');
                    stopContainer.style.cssText = 'margin: 10px 0; padding: 10px; background: var(--devwatch-color-warning-bg, #fff3cd); border: 1px solid var(--devwatch-color-warning, #ffc107); border-radius: 4px;';
                    stopContainer.innerHTML = `
                        <div style="margin-bottom: 8px; font-weight: bold;">🛑 Test Conflict</div>
                        <div style="margin-bottom: 8px;">Wait for the current test to complete, or stop it:</div>
                        <div>${stopBtn.outerHTML}</div>
                    `;
                    
                    // Add to activity log
                    const activityLog = document.getElementById('activity-log');
                    if (activityLog) {
                        activityLog.appendChild(stopContainer);
                        activityLog.scrollTop = activityLog.scrollHeight;
                    }
                }
                
                // Also show in panel log
                panelLog(`Test conflict: "${name}" cannot start while another test is running`, {
                    level: 'warn',
                    toSystem: false // Don't spam server logs
                });
                
            } else {
                addLogEntryToUI(`❌ Error: ${name}`, 'error', `${error.message} (Error ID: ${errorId})`);
            }
            
            panelLog(`Execution Error: ${name}`, {
                level: 'error',
                toSystem: true,
                data: { error: error.message }
            });
        }
    }

    function formatResultDetails(result, commandType = 'unknown') {
        if (result.output || result.stdout) {
            return result.output || result.stdout;
        }
        if (commandType === 'playwright' && result.results && result.results.stats) {
            const s = result.results.stats;
            return `Total: ${s.total}, Passed: ${s.passed}, Failed: ${s.failed}, Duration: ${(s.duration/1000).toFixed(1)}s`;
        }
        if (commandType === 'system' && result.stdout) {
            return result.stdout;
        }
        if (result.error) {
            return result.error;
        }
        return `${commandType} command executed`;
    }

    function addLogEntryToUI(message, type = 'info', data = null) {
        const activityLog = document.getElementById('activity-log');
        if (!activityLog) {
            console.warn('Activity log element not found for UI update');
            return null;
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        const logTypeDisplay = `<span style="font-size:9px;color:var(--devwatch-text-muted);margin-left:8px;">COMMAND/runner.${type}</span>`;
        
        entry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span>
            <span class="log-message">${message}</span>
            ${logTypeDisplay}
            ${data ? `<details class="log-details-collapsible"><summary class="log-details-summary">Details</summary><pre class="log-details">${data}</pre></details>` : ''}
        `;
        
        activityLog.appendChild(entry);
        activityLog.scrollTop = activityLog.scrollHeight;
        
        return entry;
    }

    function logToServer(type, from, message, data = {}) {
        // Validate inputs before calling
        if (!type || !message || !message.trim()) {
            console.warn('logToServer called with invalid parameters:', { type, from, message });
            return;
        }
        
        // Wrapper for enhanced logger to add command context
        if (window.Logger && window.APP.log.logToServer) {
            window.APP.log.logToServer(type, `command.${from}`, message, data);
        }
        
        // Also log to the local UI with properly formatted data
        const formattedData = Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : null;
        addLogEntryToUI(message, type.includes('ERROR') ? 'error' : (type.includes('WARN') ? 'warn' : 'info'), formattedData);
    }

    function updateLogEntry(entry, updates) {
        if (!entry) return;
        
        if (updates.message) {
            const messageSpan = entry.querySelector('.log-message');
            if (messageSpan) messageSpan.textContent = updates.message;
        }
        
        if (updates.data) {
            let detailsDiv = entry.querySelector('.log-details');
            if (!detailsDiv) {
                detailsDiv = document.createElement('div');
                detailsDiv.className = 'log-details';
                entry.appendChild(detailsDiv);
            }
            detailsDiv.textContent = updates.data;
        }
        
        const activityLog = document.getElementById('activity-log');
        if (activityLog) {
            activityLog.scrollTop = activityLog.scrollHeight;
        }
    }

    function updateJsonData(key, data) {
        currentJsonData[key] = data;
        currentJsonData.lastUpdated = new Date().toISOString();
        
        // If JSON panel is active, refresh it
        if (layout && panels.json.isActive) {
            renderJsonData();
        }
    }

    function renderJsonData() {
        const jsonContent = document.getElementById('json-content');
        if (!jsonContent) {
            console.warn('JSON content element not found - may not be initialized yet');
            return;
        }
        
        if (Object.keys(currentJsonData).length === 0) {
            jsonContent.innerHTML = '<div class="empty-state">No JSON data available yet</div>';
            return;
        }

        let content = '';
        
        if (currentJsonData.selectedCommand) {
            content += `<div class="json-section">
                <div class="json-section-title">Selected Command</div>
                <pre>${JSON.stringify(currentJsonData.selectedCommand, null, 2)}</pre>
            </div>`;
        }
        
        if (currentJsonData.lastCommandResponse) {
            content += `<div class="json-section">
                <div class="json-section-title">Last Command Response</div>
                <pre>${JSON.stringify(currentJsonData.lastCommandResponse, null, 2)}</pre>
            </div>`;
        }
        
        if (currentJsonData.progressData) {
            content += `<div class="json-section">
                <div class="json-section-title">Live Progress Data</div>
                <pre>${JSON.stringify(currentJsonData.progressData, null, 2)}</pre>
            </div>`;
        }
        
        if (commandResults.length > 0) {
            content += `<div class="json-section">
                <div class="json-section-title">Command Results History (Last 5)</div>
                <pre>${JSON.stringify(commandResults.slice(-5), null, 2)}</pre>
            </div>`;
        }
        
        content += `<div class="json-section">
            <div class="json-section-title">Full JSON State</div>
            <pre>${JSON.stringify({
                currentJsonData,
                commands: commands.length > 0 ? commands.slice(0, 3) : [],
                commandResults: commandResults.slice(-3),
                selectedCommandId,
                timestamp: new Date().toISOString()
            }, null, 2)}</pre>
        </div>`;

        jsonContent.innerHTML = content;
    }

    function copyJsonToClipboard() {
        const jsonText = JSON.stringify(currentJsonData, null, 2);
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(jsonText).then(() => {
                window.APP.log.info('COMMAND_RUNNER.json.copy', 'JSON data copied to clipboard');
            }).catch(err => {
                window.APP.log.error('COMMAND_RUNNER.json.copy.failed', 'Failed to copy JSON', { data: { error: err.message } });
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = jsonText;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                window.APP.log.info('COMMAND_RUNNER.json.copy', 'JSON data copied to clipboard');
            } catch (err) {
                window.APP.log.error('COMMAND_RUNNER.json.copy.failed', 'Failed to copy JSON', { data: { error: err.message } });
            }
            document.body.removeChild(textArea);
        }
    }

    function refreshJsonData() {
        renderJsonData();
        window.APP.log.info('COMMAND_RUNNER.json.refresh', 'JSON data refreshed');
    }

    function startProgressPolling() {
        if (progressPollingInterval) {
            clearInterval(progressPollingInterval);
        }
        
        window.APP.log.info('COMMAND_RUNNER.progress.start', `Started monitoring progress for activity: ${currentActivityId}`);
        
        progressPollingInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE}/api/playwright/progress`);
                if (response.ok) {
                    const progress = await response.json();
                    updateJsonData('progressData', progress);
                    
                    if (progress.status === 'completed' || progress.status === 'failed') {
                        window.APP.log.info('COMMAND_RUNNER.progress.end', `Test run ${progress.status}. Total: ${progress.totalTests}, Completed: ${progress.completedTests}`);
                        stopProgressPolling();
                    } else if (progress.currentTest) {
                        // This log can be very noisy, so we'll just update the UI
                        addLogEntryToUI(`Running: ${progress.currentTest} (${progress.completedTests}/${progress.totalTests})`, 'info');
                    }
                } else if (response.status === 404) {
                    // No active progress file - test might be done
                    stopProgressPolling();
                }
            } catch (error) {
                console.warn('Progress polling error:', error);
                // Don't log every polling error, just continue
            }
        }, 2000); // Poll every 2 seconds
    }

    function stopProgressPolling() {
        if (progressPollingInterval) {
            clearInterval(progressPollingInterval);
            progressPollingInterval = null;
            currentActivityId = null;
            window.APP.log.info('COMMAND_RUNNER.progress.stop', 'Progress monitoring stopped');
        }
    }

    function createStopTestButton() {
        const button = document.createElement('button');
        button.className = 'devwatch-button devwatch-button--danger devwatch-button--small';
        button.textContent = 'Stop Current Test';
        button.onclick = stopCurrentTest;
        return button;
    }

    async function stopCurrentTest() {
        try {
            const response = await fetch(`${API_BASE}/api/playwright/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();
                addLogEntryToUI('Test run stopped successfully', 'info', result.message);
                panelLog('Test run stopped by user', {
                    toSystem: true,
                    level: 'info',
                    data: { action: 'stop_test' }
                });
                
                // Stop progress polling
                stopProgressPolling();
            } else {
                const error = await response.json();
                addLogEntryToUI('Failed to stop test run', 'error', error.error || 'Unknown error');
            }
        } catch (error) {
            addLogEntryToUI('Error stopping test run', 'error', error.message);
            panelLog('Error stopping test run', {
                toSystem: true,
                level: 'error',
                data: { error: error.message }
            });
        }
    }

    // Attach key functions to window.APP instead of window
    if (!window.APP) window.APP = {};
    window.APP.runSavedCommand = runSavedCommand;
    window.APP.editCommand = editCommand;
    window.APP.selectCommand = selectCommand;
    window.APP.runCurrentCommand = runCurrentCommand;

    // Initialize the application
    initialize();
}

// Start initialization when DOM is ready
window.addEventListener('DOMContentLoaded', initializeCommandRunner);
