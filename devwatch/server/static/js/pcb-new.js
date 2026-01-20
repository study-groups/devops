/**
 * PCB (Playwright Command Builder) - New Implementation
 * Using the formal PJA Panel System
 */

document.addEventListener('DOMContentLoaded', () => {
    // Global state
    let tests = [];
    let selectedTest = null;
    let config = {};
    let PlaywrightJobObject = {};
    
    // UI Components
    let layout = null;
    let panels = {};
    
    // Form elements (will be assigned after panel creation)
    let fileList, testContent, cliCommandDisplay, copyCommandBtn;
    let projectSelect, reporterSelect, headlessCheckbox, updateSnapshotsCheckbox;
    let takeScreenshotsCheckbox, captureTracesCheckbox, captureHarCheckbox;
    let measurePerformanceCheckbox, logMetricsCheckbox, outputDirInput;
    let targetUrlInput, targetEnvInput, additionalPathsInput;
    let logDirInput, screenshotDirInput, maxDiskUsageInput;
    let showEnvInCliCheckbox;
    let namedTestJsonEl, copyJsonBtn;
    let outputPathsDiv, viewReportBtn;
    
    // Standalone vs iframe behavior
    const isIframe = window.self !== window.top;
    const standaloneTitle = document.getElementById('standalone-title');
    if (!isIframe && standaloneTitle) {
        standaloneTitle.style.display = 'block';
    }
    
    // Function to initialize PCB
    function initializePCB() {
        try {
            // Create the layout
            createLayout();
            
            // Create all panels
            createPanels();
            
            // Fetch initial data
            fetchTestsAndConfig();
            
            // Populate spec file select
            populateSpecFileSelect();
            
            // Setup event listeners
            setupEventListeners();
            
            // Setup copy buttons
            setupCopyButtons();
            
            // Setup save button
            setupSaveButton();
            
            // Populate saved commands list
            populateSavedCommandsList();
            
            // Load saved states
            window.DevWatchPanelManager.loadAllStates();
            
            APP.log.info('frontend.pcb', 'PCB initialized successfully');
        } catch (error) {
            APP.log.error('frontend.pcb', 'Failed to initialize PCB:', error);
        }
    }
    
    // Initialize PCB when DOM is loaded
    initializePCB();
    
    function createLayout() {
        const container = document.getElementById('pcb-layout-container');
        if (!container) {
            throw new Error('PCB layout container not found');
        }
        
        layout = new DevWatchColumnLayout({
            id: 'pcb-main-layout',
            parentContainer: container,
            leftColumnWidth: 320,
            minLeftWidth: 250,
            maxLeftWidth: 500,
            minRightWidth: 400
        });
        
        window.DevWatchPanelManager.registerLayout(layout);
    }
    
    function createPanels() {
        // Left Column Panels
        panels.testFiles = new DevWatchPanel({
            id: 'test-files-panel',
            title: 'Test Files',
            content: '<div id="file-list" class="file-list"></div>',
            position: 'left',
            isCollapsed: false
        });
        
        panels.savedCommands = new DevWatchPanel({
            id: 'saved-commands-panel',
            title: 'Saved Commands <span style="font-size:10px;color:var(--devwatch-text-muted);font-weight:normal;">(playwright type)</span>',
            content: `
                <div style="padding:8px;">
                    <div style="font-size:10px;color:var(--devwatch-text-muted);margin-bottom:8px;">Your saved commands • Click to edit</div>
                    <ul id="nt-list" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px;"></ul>
                </div>
            `,
            position: 'left',
            isCollapsed: false
        });
        
        panels.info = new DevWatchPanel({
            id: 'info-panel',
            title: 'How to Build Commands',
            content: `
                <div style="padding:16px; line-height:1.5;">
                    <h1 style="margin:0 0 16px 0; color:#00ff00; font-size:18px;">🎭 Playwright Command Builder</h1>
                    
                    <p style="margin:0 0 12px 0; color:#ccc;">Build and save Playwright commands with a visual interface. Configure test files, browser settings, environment variables, and execution options.</p>
                    
                    <h2 style="margin:16px 0 8px 0; color:#4a9eff; font-size:14px;">📋 How It Works</h2>
                    <ol style="margin:0 0 16px 16px; color:#ddd; font-size:12px;">
                        <li><strong>Select Test Files:</strong> Choose from discovered *.spec.js files</li>
                        <li><strong>Configure Options:</strong> Set browser, reporter, and test behavior</li>
                        <li><strong>Set Environment:</strong> Configure Playwright ENV variables</li>
                        <li><strong>Generate Command:</strong> View/copy the complete CLI command</li>
                        <li><strong>Save as Playwright Command:</strong> Store commands in PW_DIR/data/saved-commands/playwright/</li>
                    </ol>
                    
                    <h2 style="margin:16px 0 8px 0; color:#4a9eff; font-size:14px;">🔧 Test Options</h2>
                    <table style="width:100%; font-size:11px; border-collapse:collapse; margin:0 0 16px 0;">
                        <tr><td style="padding:2px 8px 2px 0; color:#88ff88;"><strong>Project:</strong></td><td style="color:#ddd;">Browser/device configuration</td></tr>
                        <tr><td style="padding:2px 8px 2px 0; color:#88ff88;"><strong>Reporter:</strong></td><td style="color:#ddd;">Output format (list, html, json, dot)</td></tr>
                        <tr><td style="padding:2px 8px 2px 0; color:#88ff88;"><strong>Headless:</strong></td><td style="color:#ddd;">Run without browser UI</td></tr>
                        <tr><td style="padding:2px 8px 2px 0; color:#88ff88;"><strong>Screenshots:</strong></td><td style="color:#ddd;">Capture test screenshots</td></tr>
                        <tr><td style="padding:2px 8px 2px 0; color:#88ff88;"><strong>Traces:</strong></td><td style="color:#ddd;">Record execution traces</td></tr>
                    </table>
                    
                    <h2 style="margin:16px 0 8px 0; color:#4a9eff; font-size:14px;">💾 Saving Commands</h2>
                    <p style="margin:0 0 12px 0; color:#ddd; font-size:11px;">Commands are saved as JSON files in <code style="color:#ffaa00;">PW_DIR/data/saved-commands/playwright/</code></p>
                </div>
            `,
            position: 'left',
            isCollapsed: true
        });
        
        // Right Column Panels
        panels.codeViewer = new DevWatchPanel({
            id: 'code-viewer-panel',
            title: 'Code Viewer',
            content: '<div id="test-content" class="test-content-display"></div>',
            position: 'right',
            isCollapsed: false
        });
        
        panels.testOptions = new DevWatchPanel({
            id: 'test-options-panel',
            title: 'Test Options',
            content: createTestOptionsContent(),
            position: 'right',
            isCollapsed: false
        });
        
        panels.authAndHar = new DevWatchPanel({
            id: 'auth-har-panel',
            title: 'Auth & HAR',
            content: createAuthHarContent(),
            position: 'right',
            isCollapsed: false
        });
        
        panels.environment = new DevWatchPanel({
            id: 'environment-panel',
            title: 'Environment Variables',
            content: createEnvironmentContent(),
            position: 'right',
            isCollapsed: false
        });
        
        panels.namedTestJson = new DevWatchPanel({
            id: 'named-test-json-panel',
            title: 'Generated Command',
            content: createGeneratedCommandContent(),
            position: 'right',
            isCollapsed: false
        });
        
        panels.cli = new DevWatchPanel({
            id: 'cli-panel',
            title: 'Command Line Interface',
            content: createCliContent(),
            position: 'right',
            isCollapsed: false
        });
        
        panels.outputPaths = new DevWatchPanel({
            id: 'output-paths-panel',
            title: 'Output Paths',
            content: createOutputPathsContent(),
            position: 'right',
            isCollapsed: false
        });
        
        // Register all panels and add to layout
        Object.values(panels).forEach(panel => {
            window.DevWatchPanelManager.registerPanel(panel);
            layout.addPanel(panel, panel.position);
        });
        
        // Assign form elements after panels are created
        assignFormElements();
    }
    
    function createTestOptionsContent() {
        return `
            <div class="test-options-layout">
                <!-- Left Column -->
                <div class="test-options-column">
                    <!-- Spec File Selection -->
                    <div class="form-section">
                        <h4 class="form-section-title">Test Spec File</h4>
                        <div class="form-section-content">
                            <div class="devwatch-form-row">
                                <label for="spec-file-select">Select Spec File:</label>
                                <select id="spec-file-select" class="pja-select">
                                    <option value="">All Tests</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Configuration Section -->
                    <div class="form-section">
                        <h4 class="form-section-title">Configuration</h4>
                        <div class="form-section-content">
                            <div class="devwatch-form-row">
                                <label for="project-select">Project (Environment + Browser):</label>
                                <select id="project-select" class="pja-select">
                                    <option value="">Select project...</option>
                                </select>
                            </div>
                            <div class="devwatch-form-row">
                                <label for="reporter-select">Reporter:</label>
                                <select id="reporter-select" class="pja-select">
                                    <option value="list">List</option>
                                    <option value="html">HTML</option>
                                    <option value="json">JSON</option>
                                    <option value="dot">Dot</option>
                                </select>
                            </div>
                            <div class="devwatch-form-row">
                                <label for="output-dir-input">Output Directory:</label>
                                <input type="text" id="output-dir-input" class="devwatch-input" placeholder="test-results">
                            </div>
                        </div>
                    </div>

                    <!-- Browser Options -->
                    <div class="form-section">
                        <h4 class="form-section-title">Browser Options</h4>
                        <div class="form-section-content">
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="headless-checkbox" class="pja-checkbox">
                                    Headless Mode
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="update-snapshots-checkbox" class="pja-checkbox">
                                    Update Snapshots
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="test-options-column">
                    <!-- Capture Options -->
                    <div class="form-section">
                        <h4 class="form-section-title">Capture & Debugging</h4>
                        <div class="form-section-content">
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="take-screenshots-checkbox" class="pja-checkbox">
                                    Screenshots
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="capture-traces-checkbox" class="pja-checkbox">
                                    Traces
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="capture-har-checkbox" class="pja-checkbox">
                                    HAR Files
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Options -->
                    <div class="form-section">
                        <h4 class="form-section-title">Performance</h4>
                        <div class="form-section-content">
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="measure-performance-checkbox" class="pja-checkbox">
                                    Measure Performance
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" id="log-metrics-checkbox" class="pja-checkbox">
                                    Log Metrics
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function createAuthHarContent() {
        return `
            <div class="devwatch-form-grid">
                <div class="devwatch-form-row">
                    <label for="auth-file-input">Auth File:</label>
                    <input type="text" id="auth-file-input" class="devwatch-input" placeholder="auth.json">
                </div>
                <div class="devwatch-form-row">
                    <label for="har-file-input">HAR File:</label>
                    <input type="text" id="har-file-input" class="devwatch-input" placeholder="network.har">
                </div>
            </div>
        `;
    }
    
    function createEnvironmentContent() {
        return `
            <div class="test-options-layout">
                <!-- Left Column -->
                <div class="test-options-column">
                    <!-- Target Configuration -->
                    <div class="form-section">
                        <h4 class="form-section-title">Target Configuration</h4>
                        <div class="form-section-content">
                            <div class="devwatch-form-row">
                                <label for="target-url-input">Target URL:</label>
                                <input type="text" id="target-url-input" class="devwatch-input" placeholder="https://example.com">
                            </div>
                            <div class="devwatch-form-row">
                                <label for="target-env-input">Target Environment:</label>
                                <input type="text" id="target-env-input" class="devwatch-input" placeholder="staging">
                            </div>
                            <div class="devwatch-form-row">
                                <label for="additional-paths-input">Additional Paths:</label>
                                <input type="text" id="additional-paths-input" class="devwatch-input" placeholder="/api/v1">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="test-options-column">
                    <!-- Output Directories -->
                    <div class="form-section">
                        <h4 class="form-section-title">Output Directories</h4>
                        <div class="form-section-content">
                            <div class="devwatch-form-row">
                                <label for="log-dir-input">Log Directory:</label>
                                <input type="text" id="log-dir-input" class="devwatch-input" placeholder="logs">
                            </div>
                            <div class="devwatch-form-row">
                                <label for="screenshot-dir-input">Screenshot Directory:</label>
                                <input type="text" id="screenshot-dir-input" class="devwatch-input" placeholder="screenshots">
                            </div>
                        </div>
                    </div>

                    <!-- System Limits -->
                    <div class="form-section">
                        <h4 class="form-section-title">System Limits</h4>
                        <div class="form-section-content">
                            <div class="devwatch-form-row">
                                <label for="max-disk-usage-input">Max Disk Usage (MB):</label>
                                <input type="number" id="max-disk-usage-input" class="devwatch-input" placeholder="1000">
                            </div>
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="show-env-in-cli-checkbox" class="pja-checkbox">
                                    Show ENV in CLI
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function createGeneratedCommandContent() {
        return `
            <div class="generated-command-container">
                <div class="command-header">
                    <div id="named-test-json" class="devwatch-code-block">
                        <div class="pja-text-muted">Generated command will appear here...</div>
                    </div>
                    <div class="command-actions">
                        <button id="copy-json-btn" class="devwatch-button devwatch-button--ghost copy-btn">
                            <span class="copy-icon">📋</span>
                            <span class="copy-feedback"></span>
                        </button>
                        <button id="save-command-btn" class="devwatch-button devwatch-button--ghost save-btn">
                            <span class="save-icon">💾</span>
                            <span class="save-feedback"></span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    function createCliContent() {
        return `
            <div class="cli-container">
                <div class="command-header">
                    <div id="cli-command-display" class="devwatch-code-block">
                        <div class="pja-text-muted">CLI command will appear here...</div>
                    </div>
                    <button id="copy-command-btn" class="devwatch-button devwatch-button--ghost copy-btn">
                        <span class="copy-icon">📋</span>
                        <span class="copy-feedback"></span>
                    </button>
                </div>
            </div>
        `;
    }
    
    function createOutputPathsContent() {
        return `
            <div class="output-paths-container">
                <div id="output-paths-div" class="output-paths-display">
                    <div class="pja-text-muted">Output paths will appear here...</div>
                </div>
                <button id="view-report-btn" class="devwatch-button devwatch-button--ghost" style="margin-top: 0.5rem;" disabled>
                    View Report
                </button>
            </div>
        `;
    }
    
    function assignFormElements() {
        // File list
        fileList = document.getElementById('file-list');
        
        // Test content
        testContent = document.getElementById('test-content');
        
        // Test options
        projectSelect = document.getElementById('project-select');
        reporterSelect = document.getElementById('reporter-select');
        headlessCheckbox = document.getElementById('headless-checkbox');
        updateSnapshotsCheckbox = document.getElementById('update-snapshots-checkbox');
        takeScreenshotsCheckbox = document.getElementById('take-screenshots-checkbox');
        captureTracesCheckbox = document.getElementById('capture-traces-checkbox');
        captureHarCheckbox = document.getElementById('capture-har-checkbox');
        measurePerformanceCheckbox = document.getElementById('measure-performance-checkbox');
        logMetricsCheckbox = document.getElementById('log-metrics-checkbox');
        outputDirInput = document.getElementById('output-dir-input');
        
        // Environment variables
        targetUrlInput = document.getElementById('target-url-input');
        targetEnvInput = document.getElementById('target-env-input');
        additionalPathsInput = document.getElementById('additional-paths-input');
        logDirInput = document.getElementById('log-dir-input');
        screenshotDirInput = document.getElementById('screenshot-dir-input');
        maxDiskUsageInput = document.getElementById('max-disk-usage-input');
        showEnvInCliCheckbox = document.getElementById('show-env-in-cli-checkbox');
        
        // Generated command
        namedTestJsonEl = document.getElementById('named-test-json');
        copyJsonBtn = document.getElementById('copy-json-btn');
        
        // CLI
        cliCommandDisplay = document.getElementById('cli-command-display');
        copyCommandBtn = document.getElementById('copy-command-btn');
        
        // Output paths
        outputPathsDiv = document.getElementById('output-paths-div');
        viewReportBtn = document.getElementById('view-report-btn');
    }
    
    async function fetchTestsAndConfig() {
        try {
            const [testsResponse, configResponse] = await Promise.all([
                fetch('/api/tests'),
                fetch('/api/tests/config')
            ]);
            const testsData = await testsResponse.json();
            config = await configResponse.json();

            // Extensive logging
            console.group('Playwright Configuration Debug');
            console.log('Raw Config:', JSON.stringify(config, null, 2));
            console.log('Config Projects:', config.projects);
            console.log('Config Projects Count:', config.projects ? config.projects.length : 'No projects');
            console.log('Available Tests:', testsData.availableTests?.length || 0);
            console.groupEnd();

            // Normalize paths to be relative
            const normalizePath = (fullPath) => {
                // Remove everything before the project root
                const projectRoot = '/home/dev/src/pixeljam/pja/arcade/playwright/';
                return fullPath.includes(projectRoot) 
                    ? './' + fullPath.split(projectRoot)[1] 
                    : fullPath;
            };
            
            // Normalize config path
            const normalizedConfigPath = normalizePath(config.paths.config);
            
            // Start with the config file
            tests = [{
                name: 'playwright.config.js',
                content: config.content,
                path: normalizedConfigPath,
                isConfig: true
            }];

            // Explicitly set projects in the global config
            window.config = config;  // Make config globally accessible

            // Add test files from ./tests and fetch their content
            if (testsData.availableTests && testsData.availableTests.length > 0) {
                for (const test of testsData.availableTests) {
                    try {
                        const contentResponse = await fetch(`/api/tests/${encodeURIComponent(test.name)}/source`);
                        const contentData = await contentResponse.json();
                        tests.push({
                            ...test,
                            path: normalizePath(test.path),
                            content: contentData.content || 'Content not available'
                        });
                    } catch (error) {
                        console.error(`Failed to load content for ${test.name}:`, error);
                        tests.push({
                            ...test,
                            path: normalizePath(test.path),
                            content: 'Failed to load content'
                        });
                    }
                }
            } else {
                console.warn('No available tests found in API response.');
            }
            
            renderFileList();
            populateCommandBuilder();
            updatePathDisplays();
            
            if (tests.length > 0) {
                let targetEl = fileList.firstElementChild;
                targetEl?.click();
            }

        } catch (error) {
            console.error('Error fetching initial data:', error);
            if (fileList) {
                fileList.innerHTML = '<div class="file-item">Error loading files.</div>';
            }
        }
    }
    
    function renderFileList() {
        if (!fileList) return;
        
        fileList.innerHTML = tests.map((test, index) => {
            const isConfig = test.isConfig;
            const displayName = isConfig ? 'playwright.config.js' : test.name;
            const fullPath = test.path;
            
            return `
                <div class="file-item" data-index="${index}" data-full-path="${fullPath}">
                    <span class="file-icon">${isConfig ? '⚙️' : '📄'}</span>
                    <span class="file-name">${displayName}</span>
                </div>
            `;
        }).join('');
        
        // Add click event listeners to file items
        fileList.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => {
                // Remove previous selection
                fileList.querySelectorAll('.file-item').forEach(el => 
                    el.classList.remove('selected')
                );
                
                // Mark current item as selected
                item.classList.add('selected');
                
                // Get the test file details
                const index = parseInt(item.dataset.index, 10);
                const test = tests[index];
                
                // Update code view content
                const testContentEl = document.getElementById('test-content');
                if (testContentEl) {
                    // Set full path in the code view panel header
                    const codeViewerPanel = document.getElementById('code-viewer-panel');
                    if (codeViewerPanel) {
                        const titleEl = codeViewerPanel.querySelector('.devwatch-panel__title');
                        if (titleEl) {
                            titleEl.textContent = test.path;
                        }
                    }
                    
                    // Render the file content with syntax highlighting
                    testContentEl.innerHTML = '';
                    const pre = document.createElement('pre');
                    const code = document.createElement('code');
                    code.className = 'language-javascript';
                    code.textContent = test.content;
                    pre.appendChild(code);
                    testContentEl.appendChild(pre);
                    
                    // Highlight if Prism is available
                    if (window.Prism) {
                        window.Prism.highlightElement(code);
                    }
                }
                
                // Save last viewed file
                try {
                    window.APP?.utils?.storage.set('pcb_last_file', test.path);
                } catch (_) {}
            });
        });

        // Trigger first item click if available
        const firstItem = fileList.querySelector('.file-item');
        if (firstItem) {
            firstItem.click();
        }
    }
    
    function populateCommandBuilder() {
        if (!projectSelect) {
            console.error('Project select element not found');
            return;
        }
        
        // Clear existing options
        projectSelect.innerHTML = '<option value="">Select project...</option>';
        
        // Attempt to get projects from different sources
        let projectsToPopulate = [];
        
        // Try from global config
        if (window.config && window.config.projects) {
            projectsToPopulate = window.config.projects;
            console.log('Using projects from window.config:', projectsToPopulate);
        } 
        // Try from local config
        else if (config && config.projects) {
            projectsToPopulate = config.projects;
            console.log('Using projects from local config:', projectsToPopulate);
        }
        
        // Fallback projects if none found
        if (projectsToPopulate.length === 0) {
            console.warn('No projects found. Using default projects.');
            projectsToPopulate = [
                'prod-chrome-desktop',
                'prod-firefox-desktop', 
                'staging-chrome-desktop', 
                'dev-chrome-desktop'
            ];
        }
        
        // Populate project select
        projectsToPopulate.forEach(project => {
            // If project is a string, use it directly
            // If project is an object, use project.name
            const projectName = typeof project === 'string' ? project : project.name;
            
            if (projectName) {
                const option = document.createElement('option');
                option.value = projectName;
                option.textContent = projectName;
                projectSelect.appendChild(option);
                
                console.log('Added project option:', projectName);
            }
        });
        
        // Attempt to select prod-chrome-desktop by default
        const prodChromeDesktop = projectSelect.querySelector('option[value="prod-chrome-desktop"]');
        if (prodChromeDesktop) {
            prodChromeDesktop.selected = true;
            console.log('Selected prod-chrome-desktop by default');
        } else {
            // If no prod-chrome-desktop, select the first available option
            if (projectSelect.options.length > 1) {
                projectSelect.selectedIndex = 1;
                console.log('Selected first available project:', projectSelect.value);
            }
        }
        
        // Log final state of dropdown
        console.log('Project dropdown populated. Options:', 
            Array.from(projectSelect.options).map(opt => opt.value)
        );
    }

    function populateSpecFileSelect() {
        const specFileSelect = document.getElementById('spec-file-select');
        if (!specFileSelect) return;

        // Populate spec file dropdown
        const specFiles = [
            'game-flow.spec.js',
            'games.spec.js',
            'lpc.spec.js',
            'metrics.spec.js',
            'profiling.spec.js'
        ];

        specFiles.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            specFileSelect.appendChild(option);
        });

        // Add change listener to update command
        specFileSelect.addEventListener('change', updateCommand);
    }
    
    function setupEventListeners() {
        // Add event listeners for form elements
        if (copyCommandBtn) {
            copyCommandBtn.addEventListener('click', copyCliCommand);
        }
        
        if (copyJsonBtn) {
            copyJsonBtn.addEventListener('click', copyGeneratedCommand);
        }
        
        // Add change listeners for form elements to update command
        const formElements = [
            projectSelect, reporterSelect, headlessCheckbox, updateSnapshotsCheckbox,
            takeScreenshotsCheckbox, captureTracesCheckbox, captureHarCheckbox,
            measurePerformanceCheckbox, logMetricsCheckbox, outputDirInput,
            targetUrlInput, targetEnvInput, additionalPathsInput,
            logDirInput, screenshotDirInput, maxDiskUsageInput, showEnvInCliCheckbox
        ];
        
        formElements.forEach(element => {
            if (element) {
                // Ensure both change and input events are captured
                element.addEventListener('change', updateCommand);
                element.addEventListener('input', updateCommand);
            }
        });

        // Explicitly log when project is selected
        if (projectSelect) {
            projectSelect.addEventListener('change', (e) => {
                console.log('Project selected:', e.target.value);
                updateCommand();
            });
        }
    }
    
    // Placeholder functions for PCB functionality
    function setActiveFile(fileItem) {
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('active');
        });
        fileItem.classList.add('active');
    }
    
    function updateStateFromSelection() {
        // Update state based on selected test
        renderFromState();
    }
    
    function loadTestContent(test) {
        if (!testContent) return;
        
        if (test.content) {
            testContent.innerHTML = `<pre><code class="language-javascript">${escapeHtml(test.content)}</code></pre>`;
            hljs.highlightAll();
        } else {
            testContent.innerHTML = '<div class="pja-text-muted">No content available</div>';
        }
    }
    
    function renderFromState() {
        updateCommand();
    }
    
    function updateCommand() {
        // Generate and display the command
        const command = generateCommand();
        
        if (namedTestJsonEl) {
            namedTestJsonEl.innerHTML = `<pre><code class="language-json">${JSON.stringify(command, null, 2)}</code></pre>`;
        }
        
        if (cliCommandDisplay) {
            const cliCommand = generateCliCommand(command);
            cliCommandDisplay.innerHTML = `<pre><code class="language-bash">${escapeHtml(cliCommand)}</code></pre>`;
        }
        
        // Use Prism for syntax highlighting if available
        if (window.Prism) {
            const codeBlocks = document.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                window.Prism.highlightElement(block);
            });
        }
    }
    
    function generateCommand() {
        const command = {
            type: 'playwright',
            project: projectSelect?.value || '', 
            reporter: reporterSelect?.value || 'list',
            headless: headlessCheckbox?.checked || false,
            updateSnapshots: updateSnapshotsCheckbox?.checked || false,
            takeScreenshots: takeScreenshotsCheckbox?.checked || false,
            captureTraces: captureTracesCheckbox?.checked || false,
            captureHar: captureHarCheckbox?.checked || false,
            measurePerformance: measurePerformanceCheckbox?.checked || false,
            logMetrics: logMetricsCheckbox?.checked || false,
            outputDir: outputDirInput?.value || 'test-results',
            specFile: document.getElementById('spec-file-select')?.value || '', // Add spec file
            testFile: selectedTest?.path || '',
            environment: {
                targetUrl: targetUrlInput?.value || '',
                targetEnv: targetEnvInput?.value || '',
                additionalPaths: additionalPathsInput?.value || '',
                logDir: logDirInput?.value || '',
                screenshotDir: screenshotDirInput?.value || '',
                maxDiskUsage: maxDiskUsageInput?.value || ''
            }
        };
        
        return command;
    }
    
    function generateCliCommand(command) {
        let cli = 'npx playwright test';
        
        // Add spec file if selected
        if (command.specFile && command.specFile !== '') {
            cli += ` ${command.specFile}`;
        }
        
        if (command.project && command.project !== 'undefined') {
            cli += ` --project="${command.project}"`;
        }
        
        if (command.reporter) cli += ` --reporter=${command.reporter}`;
        if (command.headless) cli += ' --headed=false';
        if (command.updateSnapshots) cli += ' --update-snapshots';
        if (command.outputDir) cli += ` --output-dir=${command.outputDir}`;
        
        return cli;
    }
    
    function updatePathDisplays() {
        if (!outputPathsDiv) return;
        
        const paths = [
            { label: 'Test Results', path: 'test-results/' },
            { label: 'Screenshots', path: 'test-results/screenshots/' },
            { label: 'Traces', path: 'test-results/traces/' },
            { label: 'Reports', path: 'playwright-report/' }
        ];
        
        const pathsHtml = paths.map(p => 
            `<div class="path-item">
                <strong>${p.label}:</strong> <code>${p.path}</code>
            </div>`
        ).join('');
        
        outputPathsDiv.innerHTML = pathsHtml;
    }
    
    function copyCliCommand() {
        const command = generateCommand();
        const cliCommand = generateCliCommand(command);
        
        navigator.clipboard.writeText(cliCommand).then(() => {
            APP.log.info('frontend.pcb', 'CLI command copied to clipboard');
        }).catch(err => {
            APP.log.error('frontend.pcb', 'Failed to copy CLI command:', err);
        });
    }
    
    function copyGeneratedCommand() {
        const command = generateCommand();
        
        navigator.clipboard.writeText(JSON.stringify(command, null, 2)).then(() => {
            APP.log.info('frontend.pcb', 'Generated command copied to clipboard');
        }).catch(err => {
            APP.log.error('frontend.pcb', 'Failed to copy generated command:', err);
        });
    }

    function setupCopyButtons() {
        const copyJsonBtn = document.getElementById('copy-json-btn');
        const copyCommandBtn = document.getElementById('copy-command-btn');
        const copyJsonFeedback = copyJsonBtn?.querySelector('.copy-feedback');
        const copyCommandFeedback = copyCommandBtn?.querySelector('.copy-feedback');

        function showCopyFeedback(feedbackEl) {
            if (!feedbackEl) return;
            feedbackEl.textContent = 'Copied!';
            feedbackEl.style.color = 'var(--devwatch-accent-primary)';
            setTimeout(() => {
                feedbackEl.textContent = '';
            }, 2000);
        }

        function copyToClipboard(text, feedbackEl) {
            navigator.clipboard.writeText(text).then(() => {
                showCopyFeedback(feedbackEl);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }

        if (copyJsonBtn) {
            copyJsonBtn.addEventListener('click', () => {
                const command = generateCommand();
                copyToClipboard(JSON.stringify(command, null, 2), copyJsonFeedback);
            });
        }

        if (copyCommandBtn) {
            copyCommandBtn.addEventListener('click', () => {
                const command = generateCommand();
                const cliCommand = generateCliCommand(command);
                copyToClipboard(cliCommand, copyCommandFeedback);
            });
        }
    }
    
    // Command Saving Functionality
    function saveCommand() {
        const command = generateCommand();
        
        // Generate a unique ID for the command
        const commandId = `cmd_${Date.now()}`;
        
        // Prepare saved command object
        const savedCommand = {
            id: commandId,
            timestamp: new Date().toISOString(),
            name: `Command ${new Date().toLocaleString()}`,
            command: command
        };
        
        // Retrieve existing saved commands
        let savedCommands = JSON.parse(localStorage.getItem('playwright_saved_commands') || '[]');
        
        // Add new command
        savedCommands.push(savedCommand);
        
        // Save to localStorage
        localStorage.setItem('playwright_saved_commands', JSON.stringify(savedCommands));
        
        // Update saved commands list in UI
        populateSavedCommandsList();
        
        // Provide user feedback
        APP.log.info('frontend.pcb', `Command saved: ${savedCommand.name}`);
        
        return savedCommand;
    }
    
    function populateSavedCommandsList() {
        const savedCommandsList = document.getElementById('nt-list');
        if (!savedCommandsList) return;
        
        // Retrieve saved commands
        const savedCommands = JSON.parse(localStorage.getItem('playwright_saved_commands') || '[]');
        
        // Clear existing list
        savedCommandsList.innerHTML = '';
        
        // Populate list
        savedCommands.forEach(savedCmd => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div class="saved-command-item">
                    <span class="saved-command-name">${savedCmd.name}</span>
                    <span class="saved-command-timestamp">${new Date(savedCmd.timestamp).toLocaleString()}</span>
                    <div class="saved-command-actions">
                        <button class="devwatch-button devwatch-button--ghost load-command-btn" data-id="${savedCmd.id}">Load</button>
                        <button class="devwatch-button devwatch-button--ghost delete-command-btn" data-id="${savedCmd.id}">Delete</button>
                    </div>
                </div>
            `;
            
            // Add event listeners for load and delete
            const loadBtn = listItem.querySelector('.load-command-btn');
            const deleteBtn = listItem.querySelector('.delete-command-btn');
            
            loadBtn.addEventListener('click', () => loadSavedCommand(savedCmd.id));
            deleteBtn.addEventListener('click', () => deleteSavedCommand(savedCmd.id));
            
            savedCommandsList.appendChild(listItem);
        });
    }
    
    function loadSavedCommand(commandId) {
        const savedCommands = JSON.parse(localStorage.getItem('playwright_saved_commands') || '[]');
        const savedCommand = savedCommands.find(cmd => cmd.id === commandId);
        
        if (!savedCommand) {
            APP.log.error('frontend.pcb', 'Command not found');
            return;
        }
        
        // Populate form with saved command details
        const command = savedCommand.command;
        
        // Set project
        if (projectSelect && command.project) {
            projectSelect.value = command.project;
        }
        
        // Set reporter
        if (reporterSelect && command.reporter) {
            reporterSelect.value = command.reporter;
        }
        
        // Set checkboxes
        if (headlessCheckbox) headlessCheckbox.checked = command.headless;
        if (updateSnapshotsCheckbox) updateSnapshotsCheckbox.checked = command.updateSnapshots;
        if (takeScreenshotsCheckbox) takeScreenshotsCheckbox.checked = command.takeScreenshots;
        if (captureTracesCheckbox) captureTracesCheckbox.checked = command.captureTraces;
        if (captureHarCheckbox) captureHarCheckbox.checked = command.captureHar;
        if (measurePerformanceCheckbox) measurePerformanceCheckbox.checked = command.measurePerformance;
        if (logMetricsCheckbox) logMetricsCheckbox.checked = command.logMetrics;
        
        // Set output directory
        if (outputDirInput && command.outputDir) {
            outputDirInput.value = command.outputDir;
        }
        
        // Set spec file
        const specFileSelect = document.getElementById('spec-file-select');
        if (specFileSelect && command.specFile) {
            specFileSelect.value = command.specFile;
        }
        
        // Set environment variables
        if (targetUrlInput && command.environment?.targetUrl) {
            targetUrlInput.value = command.environment.targetUrl;
        }
        if (targetEnvInput && command.environment?.targetEnv) {
            targetEnvInput.value = command.environment.targetEnv;
        }
        
        // Trigger command update
        updateCommand();
        
        APP.log.info('frontend.pcb', `Loaded command: ${savedCommand.name}`);
    }
    
    function deleteSavedCommand(commandId) {
        let savedCommands = JSON.parse(localStorage.getItem('playwright_saved_commands') || '[]');
        
        // Remove the command with the matching ID
        savedCommands = savedCommands.filter(cmd => cmd.id !== commandId);
        
        // Save updated list
        localStorage.setItem('playwright_saved_commands', JSON.stringify(savedCommands));
        
        // Refresh the list
        populateSavedCommandsList();
        
        APP.log.info('frontend.pcb', 'Command deleted');
    }
    
    function setupSaveButton() {
        const saveCommandBtn = document.getElementById('save-command-btn');
        const saveFeedback = saveCommandBtn?.querySelector('.save-feedback');
        
        if (saveCommandBtn) {
            saveCommandBtn.addEventListener('click', () => {
                const savedCommand = saveCommand();
                
                if (saveFeedback) {
                    saveFeedback.textContent = 'Saved!';
                    saveFeedback.style.color = 'var(--devwatch-accent-primary)';
                    setTimeout(() => {
                        saveFeedback.textContent = '';
                    }, 2000);
                }
            });
        }
    }
    
    // Utility function to escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

});
