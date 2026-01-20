document.addEventListener('DOMContentLoaded', () => {
    // Main panel elements will be assigned after layout initialization
    let fileList, testContent, cliCommandDisplay, copyCommandBtn;
    
    // Command Builder Elements - will be assigned after layout initialization
    let projectSelect, reporterSelect, headlessCheckbox, updateSnapshotsCheckbox;
    let takeScreenshotsCheckbox, captureTracesCheckbox, captureHarCheckbox;
    let measurePerformanceCheckbox, logMetricsCheckbox, outputDirInput;
    
        // Capture form elements
    let targetUrlInput, additionalPathsInput;
    let logDirInput, screenshotDirInput, maxDiskUsageInput;
    let showEnvInCliCheckbox;
    
    let namedTestJsonEl, copyJsonBtn;

    // Path display elements
    let outputPathsDiv, viewReportBtn;
    const standaloneTitle = document.getElementById('standalone-title');

    let tests = [];
    let selectedTest = null;
    let config = {};
    let PlaywrightJobObject = {};
    let columnContainer;
    let sections = {};

    // Standalone vs iframe behavior
    const isIframe = window.self !== window.top;
    if (!isIframe && standaloneTitle) {
        standaloneTitle.style.display = 'block';
    }

    // Removed run/list controls from TSV to keep it viewer-only

    async function fetchTestsAndConfig() {
        try {
            const [testsResponse, configResponse] = await Promise.all([
                fetch('/api/tests'),
                fetch('/api/config')
            ]);
            const testsData = await testsResponse.json();
            config = await configResponse.json();
            
            tests = testsData.availableTests;
            tests.unshift({
                name: config.filename,
                content: config.content,
                path: config.paths.config,
                isConfig: true
            });
            
            renderFileList();
            populateCommandBuilder();
            updatePathDisplays();
            
            if (tests.length > 0) {
                let targetEl = fileList.firstElementChild;
                try {
                    const last = window.APP?.utils?.storage.get('pcb_last_file', null);
                    if (last) {
                        const idx = tests.findIndex(t => t.path === last);
                        if (idx >= 0 && fileList.children[idx]) targetEl = fileList.children[idx];
                    }
                } catch (_) {}
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
        if (!fileList) {
            console.warn('fileList element not found, skipping render');
            return;
        }
        fileList.innerHTML = '';
        tests.forEach(test => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.textContent = test.name;
            fileItem.addEventListener('click', () => {
                selectedTest = test;
                setActiveFile(fileItem);
                updateStateFromSelection();
                loadTestContent(test);
                renderFromState();
                try { window.APP?.utils?.storage.set('pcb_last_file', test.path || ''); } catch (_) {}
            });
            fileList.appendChild(fileItem);
        });
    }
    
    // Fetch and populate contexts dropdown
    async function populateContexts() {
        const contextSelect = document.getElementById('context-select');
        if (!contextSelect) return;

        try {
            const resp = await fetch('/api/contexts');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const contexts = await resp.json();

            contextSelect.innerHTML = '';
            contexts.forEach(ctx => {
                const option = document.createElement('option');
                option.value = ctx.id;
                option.textContent = ctx.name;
                if (ctx.hasCookies || ctx.hasOrigins) {
                    option.textContent += ' (has auth)';
                }
                contextSelect.appendChild(option);
            });

            // Select default context
            contextSelect.value = 'default';
        } catch (error) {
            console.error('Failed to fetch contexts:', error);
            // Keep default option if API fails
        }
    }

    // Context Editor Modal
    async function openContextEditor(contextId) {
        // Fetch full context data
        let context;
        try {
            const resp = await fetch(`/api/contexts/${contextId}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            context = await resp.json();
        } catch (error) {
            console.error('Failed to fetch context:', error);
            alert(`Failed to load context: ${error.message}`);
            return;
        }

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'context-editor-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const modal = document.createElement('div');
        modal.className = 'context-editor-modal';
        modal.style.cssText = `
            background: var(--devwatch-bg-primary, #0d0d1a);
            border: 1px solid var(--devwatch-border-primary, #333);
            border-radius: 8px;
            padding: 24px;
            min-width: 500px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
        `;

        const cookieCount = context.storageState?.cookies?.length || 0;
        const originCount = context.storageState?.origins?.length || 0;
        const isDefault = context.id === 'default';

        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--devwatch-text-primary, #e0e0e0);">Edit Context</h2>
                <button class="context-editor-close ghost-btn" style="font-size: 20px;">&times;</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; color: var(--devwatch-text-secondary, #aaa); font-size: 12px;">Context ID</label>
                    <input type="text" value="${context.id}" readonly style="width: 100%; padding: 8px; background: var(--devwatch-bg-tertiary, #1a1a2e); border: 1px solid var(--devwatch-border-primary, #333); color: var(--devwatch-text-muted, #666); border-radius: 4px;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 4px; color: var(--devwatch-text-secondary, #aaa); font-size: 12px;">Name</label>
                    <input type="text" id="context-name-input" value="${context.name}" style="width: 100%; padding: 8px; background: var(--devwatch-bg-secondary, #1a1a2e); border: 1px solid var(--devwatch-border-primary, #333); color: var(--devwatch-text-primary, #e0e0e0); border-radius: 4px;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; color: var(--devwatch-text-secondary, #aaa); font-size: 12px;">Viewport Width</label>
                        <input type="number" id="context-viewport-width" value="${context.viewport?.width || 1280}" style="width: 100%; padding: 8px; background: var(--devwatch-bg-secondary, #1a1a2e); border: 1px solid var(--devwatch-border-primary, #333); color: var(--devwatch-text-primary, #e0e0e0); border-radius: 4px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; color: var(--devwatch-text-secondary, #aaa); font-size: 12px;">Viewport Height</label>
                        <input type="number" id="context-viewport-height" value="${context.viewport?.height || 720}" style="width: 100%; padding: 8px; background: var(--devwatch-bg-secondary, #1a1a2e); border: 1px solid var(--devwatch-border-primary, #333); color: var(--devwatch-text-primary, #e0e0e0); border-radius: 4px;">
                    </div>
                </div>

                <div style="padding: 12px; background: var(--devwatch-bg-tertiary, #111); border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="color: var(--devwatch-text-secondary, #aaa); font-size: 12px;">Storage State</span>
                        <span style="color: var(--devwatch-text-muted, #666); font-size: 11px;">${cookieCount} cookies, ${originCount} origins</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button id="context-import-btn" class="capture-btn capture-btn-secondary" style="flex: 1; padding: 6px;">Import</button>
                        <button id="context-export-btn" class="capture-btn capture-btn-secondary" style="flex: 1; padding: 6px;">Export</button>
                        <button id="context-clear-btn" class="capture-btn capture-btn-secondary" style="flex: 1; padding: 6px; color: var(--devwatch-accent-danger, #ff4444);">Clear</button>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--devwatch-border-secondary, #222);">
                    ${!isDefault ? `<button id="context-delete-btn" class="capture-btn capture-btn-secondary" style="color: var(--devwatch-accent-danger, #ff4444);">Delete Context</button>` : ''}
                    <div style="flex: 1;"></div>
                    <button id="context-cancel-btn" class="capture-btn capture-btn-secondary">Cancel</button>
                    <button id="context-save-btn" class="capture-btn capture-btn-primary">Save Changes</button>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Hidden file input for import
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // Event handlers
        const closeModal = () => {
            overlay.remove();
            fileInput.remove();
        };

        overlay.querySelector('.context-editor-close').addEventListener('click', closeModal);
        modal.querySelector('#context-cancel-btn').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Save changes
        modal.querySelector('#context-save-btn').addEventListener('click', async () => {
            const name = modal.querySelector('#context-name-input').value.trim();
            const width = parseInt(modal.querySelector('#context-viewport-width').value) || 1280;
            const height = parseInt(modal.querySelector('#context-viewport-height').value) || 720;

            try {
                const resp = await fetch(`/api/contexts/${contextId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        viewport: { width, height }
                    })
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                await populateContexts();
                if (window.DevWatch) window.DevWatch.addLogEntry('Context updated', 'success', { id: contextId, name });
                closeModal();
            } catch (error) {
                console.error('Failed to save context:', error);
                alert(`Failed to save: ${error.message}`);
            }
        });

        // Delete context
        const deleteBtn = modal.querySelector('#context-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm(`Are you sure you want to delete "${context.name}"?`)) return;

                try {
                    const resp = await fetch(`/api/contexts/${contextId}`, { method: 'DELETE' });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                    await populateContexts();
                    if (window.DevWatch) window.DevWatch.addLogEntry('Context deleted', 'info', { id: contextId });
                    closeModal();
                } catch (error) {
                    console.error('Failed to delete context:', error);
                    alert(`Failed to delete: ${error.message}`);
                }
            });
        }

        // Import storageState
        modal.querySelector('#context-import-btn').addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const storageState = JSON.parse(text);

                const resp = await fetch(`/api/contexts/${contextId}/storageState`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(storageState)
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                await populateContexts();
                if (window.DevWatch) window.DevWatch.addLogEntry('Storage state imported', 'success', { id: contextId });
                closeModal();
            } catch (error) {
                console.error('Failed to import storageState:', error);
                alert(`Failed to import: ${error.message}`);
            }
        });

        // Export storageState
        modal.querySelector('#context-export-btn').addEventListener('click', async () => {
            try {
                const resp = await fetch(`/api/contexts/${contextId}/storageState`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const storageState = await resp.json();

                const blob = new Blob([JSON.stringify(storageState, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${contextId}-storageState.json`;
                a.click();
                URL.revokeObjectURL(url);

                if (window.DevWatch) window.DevWatch.addLogEntry('Storage state exported', 'info', { id: contextId });
            } catch (error) {
                console.error('Failed to export storageState:', error);
                alert(`Failed to export: ${error.message}`);
            }
        });

        // Clear storageState
        modal.querySelector('#context-clear-btn').addEventListener('click', async () => {
            if (!confirm('Clear all cookies and storage? This cannot be undone.')) return;

            try {
                const resp = await fetch(`/api/contexts/${contextId}/storageState`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cookies: [], origins: [] })
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                await populateContexts();
                if (window.DevWatch) window.DevWatch.addLogEntry('Storage state cleared', 'info', { id: contextId });
                closeModal();
            } catch (error) {
                console.error('Failed to clear storageState:', error);
                alert(`Failed to clear: ${error.message}`);
            }
        });
    }

    function populateCommandBuilder() {
        if (!projectSelect) {
            console.warn('projectSelect element not found, deferring populateCommandBuilder');
            setTimeout(populateCommandBuilder, 200);
            return;
        }

        // Populate project dropdown
        projectSelect.innerHTML = '<option value="">All Projects</option>';
        if (config.projects) {
            config.projects.forEach(proj => {
                const option = document.createElement('option');
                option.value = proj;
                option.textContent = proj;
                projectSelect.appendChild(option);
            });
        }

        // Populate contexts dropdown
        populateContexts();

        outputDirInput.placeholder = config.paths.outputDir || 'Override default...';

        const allBuilderElements = [
            projectSelect, reporterSelect, headlessCheckbox, updateSnapshotsCheckbox,
            takeScreenshotsCheckbox, captureTracesCheckbox, captureHarCheckbox,
            measurePerformanceCheckbox, logMetricsCheckbox, outputDirInput,
            targetUrlInput, additionalPathsInput, logDirInput,
            screenshotDirInput, maxDiskUsageInput, showEnvInCliCheckbox
        ];
        allBuilderElements.filter(Boolean).forEach(el => el.addEventListener('input', () => { updateStateFromUI(); renderFromState(); }));
        allBuilderElements.filter(Boolean).forEach(el => el.addEventListener('change', () => { updateStateFromUI(); renderFromState(); }));
        
        // Setup custom environment variables
        setupCustomEnvVars();
        
        copyCommandBtn.addEventListener('click', copyCommandToClipboard);
        if (copyJsonBtn) {
            copyJsonBtn.addEventListener('click', () => {
                const text = namedTestJsonEl?.textContent || '';
                navigator.clipboard.writeText(text).then(() => {
                    copyJsonBtn.textContent = '✅';
                    setTimeout(() => { copyJsonBtn.textContent = '📋'; }, 1500);
                }).catch(() => {});
            });
        }
        viewReportBtn.addEventListener('click', () => {
            // This opens the report in a new tab. 
            // The server must be configured to serve files from the reports directory.
            window.open(`/reports/`, '_blank');
        });

        // TSV is viewer-only; no run/list listeners here
    }

    function renderTestContent(test) {
        testContent.textContent = typeof test.content === 'string' ? test.content : '';
        
        // Update section title to show full path
        if (sections.codeViewer && test.path) {
            sections.codeViewer.setTitle(`Code Viewer - ${test.path}`);
        }
        
        try {
            if (window.hljs && typeof window.hljs.highlightElement === 'function') {
                window.hljs.highlightElement(testContent);
            }
        } catch (_) {}
    }

    function buildCommandFromJson(json) {
        // Build the actual command line from the JSON configuration
        const envVars = [];
        if (json.environment) {
            Object.entries(json.environment).forEach(([key, value]) => {
                if (value && value !== '') {
                    if (typeof value === 'boolean') {
                        envVars.push(`${key}=${value}`);
                    } else {
                        envVars.push(`${key}="${value}"`);
                    }
                }
            });
        }

        let command = envVars.length > 0 ? envVars.join(' ') + ' ' : '';
        command += 'npx playwright test';

        if (Array.isArray(json.files) && json.files[0]) {
            command += ` ${json.files[0]}`;
        }

        // Handle multiple projects
        if (json.project && Array.isArray(json.project)) {
            json.project.forEach(proj => {
                if (proj) command += ` --project="${proj}"`;
            });
        } else if (json.project) {
            command += ` --project="${json.project}"`;
        }
        
        if (json.reporter) {
            command += ` --reporter=${json.reporter}`;
        }
        
        if (!json.options?.headless) {
            command += ` --headed`;
        }

        if (json.options?.updateSnapshots) {
            command += ' --update-snapshots';
        }

        if (json.outputDir) {
            command += ` --output=${json.outputDir}`;
        }

        return command;
    }

    function computePlaywrightJobFromUI() {
        const nameInput = document.getElementById('nt-name');
        const userInput = document.getElementById('nt-user');
        const passInput = document.getElementById('nt-pass');
        const tokenInput = document.getElementById('nt-token');
        const harChk = document.getElementById('nt-har-capture');
        const harPath = document.getElementById('nt-har-path');
        const harMode = document.getElementById('nt-har-mode');

        // Get custom environment variables
        const customEnvVars = {};
        document.querySelectorAll('.custom-env-row').forEach(row => {
            const nameInput = row.querySelector('.env-name-input');
            const valueInput = row.querySelector('.env-value-input');
            if (nameInput && valueInput && nameInput.value.trim() && valueInput.value.trim()) {
                customEnvVars[nameInput.value.trim()] = valueInput.value.trim();
            }
        });

        const name = (nameInput?.value || '').trim();
        const files = selectedTest && !selectedTest.isConfig ? [selectedTest.path] : [];

        // Single project selection (no longer multi-select)
        const selectedProject = projectSelect?.value || '';

        const pjo = {
            name,
            files,
            project: selectedProject ? [selectedProject] : [''],
            reporter: reporterSelect?.value || '',
            options: {
                headless: !!headlessCheckbox?.checked,
                updateSnapshots: !!updateSnapshotsCheckbox?.checked,
                takeScreenshots: !!takeScreenshotsCheckbox?.checked,
                captureTraces: !!captureTracesCheckbox?.checked,
                captureHar: !!captureHarCheckbox?.checked,
                measurePerformance: !!measurePerformanceCheckbox?.checked,
                logMetrics: !!logMetricsCheckbox?.checked
            },
            environment: {
                ...(targetUrlInput?.value?.trim() && { PLAYWRIGHT_TARGET_URL: targetUrlInput.value.trim() }),
                ...(additionalPathsInput?.value?.trim() && { PLAYWRIGHT_ADDITIONAL_PATHS: additionalPathsInput.value.trim() }),
                ...(logDirInput?.value?.trim() && { PLAYWRIGHT_LOG_DIR: logDirInput.value.trim() }),
                ...(screenshotDirInput?.value?.trim() && { PLAYWRIGHT_SCREENSHOT_DIR: screenshotDirInput.value.trim() }),
                ...(maxDiskUsageInput?.value?.trim() && { PLAYWRIGHT_MAX_DISK_USAGE: maxDiskUsageInput.value.trim() }),
                ...(!!headlessCheckbox?.checked && { PLAYWRIGHT_HEADLESS: true }),
                ...(!!takeScreenshotsCheckbox?.checked && { TAKE_SCREENSHOTS: true }),
                ...(!!captureTracesCheckbox?.checked && { CAPTURE_TRACES: true }),
                ...(!!captureHarCheckbox?.checked && { CAPTURE_HAR: true }),
                ...(!!measurePerformanceCheckbox?.checked && { PLAYWRIGHT_MEASURE_PERFORMANCE: true }),
                ...(!!logMetricsCheckbox?.checked && { PLAYWRIGHT_LOG_METRICS: true }),
                ...customEnvVars
            },
            auth: { user: userInput?.value || '', password: passInput?.value || '', authToken: tokenInput?.value || '' },
            har: { enabled: !!harChk?.checked, path: harPath?.value || '', mode: harMode?.value || 'minimal', content: null },
            outputDir: outputDirInput?.value?.trim() || '',
            description: `Created from PCB at ${new Date().toLocaleString()}`,
            timestamp: new Date().toISOString()
        };

        pjo.command = buildCommandFromJson(pjo);
        PlaywrightJobObject = pjo;

        return PlaywrightJobObject;
    }

    function updatePlaywrightJobPreview() {
        if (!namedTestJsonEl) return;
        const json = PlaywrightJobObject;
        try {
            namedTestJsonEl.textContent = JSON.stringify(json, null, 2);
            if (window.hljs && typeof window.hljs.highlightElement === 'function') {
                window.hljs.highlightElement(namedTestJsonEl);
            }
        } catch (_) {}
    }

    function updateStateFromSelection() {
        computePlaywrightJobFromUI();
    }

    function updateStateFromUI() {
        computePlaywrightJobFromUI();
    }

    function renderFromState() {
        updateCliCommand();
        updatePlaywrightJobPreview();
    }

    // Save command from current configuration
    async function saveCommand() {
        const nameInput = document.getElementById('nt-name');
        const name = (nameInput?.value || '').trim();
        if (!name) {
            console.error('No command name provided');
            if (window.DevWatch) window.DevWatch.addLogEntry('Command name is required', 'error');
            return;
        }
        
        const json = computePlaywrightJobFromUI();
        console.log('DEBUG: Generated command:', json.command);
        console.log('DEBUG: JSON object:', json);
        
        const command = {
            id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name,
            description: json.description,
            command: json.command,
            type: 'playwright',
            category: 'test-execution',
            environment: json.environment?.PLAYWRIGHT_TARGET_ENV || 'dev',
            files: json.files,
            project: json.project,
            options: {
                headless: json.options.headless,
                updateSnapshots: json.options.updateSnapshots,
                captureHar: !!json.har.enabled,
                measurePerformance: json.options.measurePerformance,
                logMetrics: json.options.logMetrics,
                systemCommand: false,
                safe: true,
                readOnly: false
            },
            expectedOutput: 'test-results',
            tags: ['playwright', 'test', json.environment?.PLAYWRIGHT_TARGET_ENV || 'dev'],
            auth: json.auth,
            har: { capture: !!json.har.enabled, path: json.har.path, mode: json.har.mode },
            metadata: {
                generated: false,
                source: 'pcb',
                version: '1.0'
            },
            json: json // Store the full PCB object for compatibility
        };
        
        try {
            const resp = await fetch('/api/saved-commands/playwright', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(command)
            });
            
            if (!resp.ok) {
                const errorText = await resp.text();
                console.error('DEBUG: Error response:', errorText);
                throw new Error(`HTTP ${resp.status}: ${errorText}`);
            }
            
            const saved = await resp.json();
            
            if (window.DevWatch) window.DevWatch.addLogEntry('✅ Command saved successfully!', 'success', { 
                commandId: saved.id, 
                name: saved.name,
                storagePath: `PW_DIR/data/saved-commands/playwright/${saved.id}.json`
            });
            
            if (window.APP?.bus) window.APP.bus.emit('commands:updated', { action: 'save', item: saved });
            refreshSavedCommands();
            
            // Clear the name input after successful save
            if (nameInput) nameInput.value = '';
            
        } catch (e) {
            console.error('DEBUG: Save failed:', e);
            if (window.DevWatch) window.DevWatch.addLogEntry('❌ Failed to save command', 'error', { 
                error: String(e)
            });
        }
    }

    async function loadTestContent(test) {
        // Config already has content from /api/config
        if (test.isConfig || typeof test.content === 'string') {
            renderTestContent(test);
            updatePlaywrightJobPreview();
            return;
        }

        // Lazily fetch test source when first selected
        try {
            testContent.textContent = 'Loading...';
            const resp = await fetch(`/api/tests/${encodeURIComponent(test.name)}/source`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            test.content = data.content || '';
            renderTestContent(test);
            updatePlaywrightJobPreview();
        } catch (err) {
            console.error('Failed to load test source:', err);
            testContent.textContent = 'Failed to load file content.';
        }
    }

    function updateCliCommand() {
        if (!selectedTest || !cliCommandDisplay) return;

        // Check if we should show environment variables
        const showEnvCheckbox = document.getElementById('show-env-in-cli');
        const showEnv = showEnvCheckbox ? showEnvCheckbox.checked : true;

        // Build environment variables prefix
        const envVars = [];
        if (showEnv && PlaywrightJobObject?.environment) {
            Object.entries(PlaywrightJobObject.environment).forEach(([key, value]) => {
                if (value && value !== '') {
                    if (typeof value === 'boolean') {
                        envVars.push(`${key}=${value}`);
                    } else {
                        envVars.push(`${key}="${value}"`);
                    }
                }
            });
        }

        let command = envVars.length > 0 ? envVars.join(' ') + ' ' : '';
        command += 'npx playwright test';

        // From PlaywrightJobObject
        if (Array.isArray(PlaywrightJobObject.files) && PlaywrightJobObject.files[0]) {
            command += ` ${PlaywrightJobObject.files[0]}`;
        } else if (!selectedTest.isConfig) {
            command += ` ${selectedTest.path}`;
        }

        // Handle multiple projects
        if (PlaywrightJobObject.project && Array.isArray(PlaywrightJobObject.project)) {
            PlaywrightJobObject.project.forEach(proj => {
                if (proj) command += ` --project="${proj}"`;
            });
        } else if (PlaywrightJobObject.project) {
            command += ` --project="${PlaywrightJobObject.project}"`;
        }
        
        if (PlaywrightJobObject.reporter) {
            command += ` --reporter=${PlaywrightJobObject.reporter}`;
        }
        
        if (!PlaywrightJobObject.options?.headless) {
            command += ` --headed`;
        }

        if (PlaywrightJobObject.options?.updateSnapshots) {
            command += ' --update-snapshots';
        }

        if (PlaywrightJobObject.outputDir) {
            command += ` --output=${PlaywrightJobObject.outputDir}`;
        }

        cliCommandDisplay.textContent = command;
    }

    function buildCommandForApi({ includePath = true, isList = false } = {}) {
        const includeSelectedPath = includePath && selectedTest && !selectedTest.isConfig;
        const testArg = includeSelectedPath ? ` ${selectedTest.path}` : '';
        
        // Check if we should show environment variables
        const showEnvCheckbox = document.getElementById('show-env-in-cli');
        const showEnv = showEnvCheckbox ? showEnvCheckbox.checked : true;
        
        // Build environment variables prefix
        const envVars = [];
        if (showEnv && PlaywrightJobObject?.environment) {
            Object.entries(PlaywrightJobObject.environment).forEach(([key, value]) => {
                if (value && value !== '') {
                    if (typeof value === 'boolean') {
                        envVars.push(`${key}=${value}`);
                    } else {
                        envVars.push(`${key}="${value}"`);
                    }
                }
            });
        }
        
        let command = envVars.length > 0 ? envVars.join(' ') + ' ' : '';
        command += `npx playwright test${isList ? ' --list' : ''}${testArg}`;
        
        if (projectSelect.value) {
            command += ` --project="${projectSelect.value}"`;
        }
        if (!headlessCheckbox.checked && !isList) {
            command += ' --headed';
        }
        if (updateSnapshotsCheckbox.checked && !isList) {
            command += ' --update-snapshots';
        }
        if (outputDirInput.value.trim() && !isList) {
            command += ` --output=${outputDirInput.value.trim()}`;
        }
        return command;
    }

    function setupCustomEnvVars() {
        const addBtn = document.getElementById('add-env-var-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                addCustomEnvVarRow();
            });
        }
    }

    function addCustomEnvVarRow(key = '', value = '') {
        const customEnvContainer = document.getElementById('custom-env-vars');
        const addBtn = document.getElementById('add-env-var-btn');
        if (!customEnvContainer || !addBtn) return;

        const newRow = document.createElement('div');
        newRow.className = 'custom-env-row';
        newRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr auto; gap:8px; margin-bottom:8px;';
        newRow.innerHTML = `
            <input type="text" placeholder="Variable name" class="env-name-input" style="font-size:12px;padding:6px;" value="${key}">
            <input type="text" placeholder="Variable value" class="env-value-input" style="font-size:12px;padding:6px;" value="${value}">
            <button type="button" class="ghost-btn remove-env-btn">✕</button>
        `;
        
        const removeBtn = newRow.querySelector('.remove-env-btn');
        removeBtn.addEventListener('click', () => {
            newRow.remove();
            updateStateFromUI();
            renderFromState();
        });
        
        const nameInput = newRow.querySelector('.env-name-input');
        const valueInput = newRow.querySelector('.env-value-input');
        [nameInput, valueInput].forEach(input => {
            input.addEventListener('input', () => {
                updateStateFromUI();
                renderFromState();
            });
        });
        
        customEnvContainer.insertBefore(newRow, addBtn);
    }

    async function executePlaywrightCommand(command, label) {
        try {
            // Default environment (env dropdown removed from UI)
            const env = 'dev';

            // Use enhanced logging for command execution
            const { response: resp, result, success } = await APP.log.executeCommandWithLogging(command, {
                component: 'pcb',
                type: 'playwright',
                environment: env,
                label: label
            });
            const data = result; // Enhanced logging already provides parsed result
            
            // Check for API errors
            if (!success) {
                const errorMsg = `API Error ${resp.status}: ${data.error || 'Unknown error'}`;
                console.error('Playwright API Error:', errorMsg, data);
                if (window.DevWatch && typeof window.DevWatch.addLogEntry === 'function') {
                    window.DevWatch.addLogEntry('Playwright API Error', 'error', {
                        command,
                        env,
                        error: errorMsg,
                        data: data
                    });
                }
                return;
            }
            
            if (window.DevWatch && typeof window.DevWatch.addLogEntry === 'function') {
                const isDryRun = !!data.isDryRun || command.includes('--list');
                const logType = data.success === false ? 'error' : 'info';
                window.DevWatch.addLogEntry(label || (isDryRun ? 'Playwright test discovery' : 'Playwright test run'), logType, {
                    isDryRun,
                    command,
                    env,
                    rawOutput: data.rawOutput,
                    results: data.results,
                    errors: data.errors,
                    success: data.success,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            // Enhanced error handling with user-friendly messages
            const errorId = APP.log.displayUserError(
                `Failed to execute Playwright command: ${label || 'Test'}`,
                {
                    command,
                    environment: env,
                    label,
                    originalError: err.message,
                    component: 'pcb'
                }
            );

            if (window.DevWatch && typeof window.DevWatch.addLogEntry === 'function') {
                window.DevWatch.addLogEntry('Playwright command failed', 'error', { 
                    command, 
                    error: `${err.message} (Error ID: ${errorId})`,
                    errorId 
                });
            }
        }
    }
    
    function copyCommandToClipboard() {
        navigator.clipboard.writeText(cliCommandDisplay.textContent).then(() => {
            copyCommandBtn.textContent = '✅';
            setTimeout(() => { copyCommandBtn.textContent = '📋'; }, 2000);
        }).catch(err => console.error('Failed to copy command: ', err));
    }

    function updatePathDisplays() {
        if (!config.paths || !outputPathsDiv) return;
        const testFilesCount = Math.max(0, (tests?.length || 0) - 1); // exclude config entry
        outputPathsDiv.innerHTML = `
            <strong>Tests dir:</strong> ${config.paths.tests} <em>(files detected: ${testFilesCount})</em><br>
            <strong>Results:</strong> ${config.paths.outputDir}<br>
            <strong>Reports:</strong> ${config.paths.reportsFolder}<br>
            <strong>Snapshots:</strong> ${config.paths.snapshots}
        `;
    }
    function setActiveFile(activeItem) {
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    function setupSaveButton() {
        const saveBtn = document.getElementById('save-named-test-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                saveCommand();
            });
        } else {
            console.error('Save button not found!');
        }
    }

    function showDeleteConfirmation(command, listItem, deleteBtn) {
        // Create inline confirmation UI
        const confirmDiv = document.createElement('div');
        confirmDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--devwatch-bg-secondary);
            border: 1px solid var(--devwatch-accent-danger);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 8px;
            font-size: 11px;
            z-index: 10;
        `;
        
        confirmDiv.innerHTML = `
            <span style="color: var(--devwatch-accent-danger);">Delete "${command.name}"?</span>
            <div style="display: flex; gap: 4px;">
                <button class="ghost-btn" style="padding: 2px 6px; font-size: 10px; background: var(--devwatch-accent-danger); color: white;" data-action="confirm">Yes</button>
                <button class="ghost-btn" style="padding: 2px 6px; font-size: 10px;" data-action="cancel">No</button>
            </div>
        `;
        
        // Position the list item relatively for absolute positioning
        listItem.style.position = 'relative';
        listItem.appendChild(confirmDiv);
        
        // Handle confirmation actions
        confirmDiv.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = e.target.dataset.action;
            
            if (action === 'confirm') {
                try {
                    // Delete the saved command
                    const resp = await fetch(`/api/saved-commands/playwright/${encodeURIComponent(command.id)}`, {
                        method: 'DELETE'
                    });
                    
                    if (resp.ok) {
                        // Remove from UI with animation
                        listItem.style.transition = 'opacity 0.3s ease';
                        listItem.style.opacity = '0';
                        setTimeout(() => {
                            listItem.remove();
                        }, 300);
                        
                        if (window.DevWatch) window.DevWatch.addLogEntry(`Deleted saved command: ${command.name}`, 'success');
                        if (window.APP?.bus) window.APP.bus.emit('commands:updated', { action: 'delete', id: command.id });
                    } else {
                        throw new Error(`HTTP ${resp.status}`);
                    }
                } catch (error) {
                    console.error('Failed to delete command:', error);
                    if (window.DevWatch) window.DevWatch.addLogEntry(`Failed to delete command: ${error.message}`, 'error');
                    // Remove confirmation UI on error
                    confirmDiv.remove();
                    listItem.style.position = '';
                }
            } else if (action === 'cancel') {
                // Remove confirmation UI
                confirmDiv.remove();
                listItem.style.position = '';
            }
        });
        
        // Auto-cancel after 5 seconds
        setTimeout(() => {
            if (confirmDiv.parentNode) {
                confirmDiv.remove();
                listItem.style.position = '';
            }
        }, 5000);
    }

    async function refreshSavedCommands() {
        const listEl = document.getElementById('nt-list');
        if (!listEl) return;
        try {
            const resp = await fetch('/api/saved-commands/playwright');
            const items = await resp.json();
            listEl.innerHTML = '';
            if (!Array.isArray(items) || items.length === 0) {
                listEl.innerHTML = '<li style="opacity:.7;">No saved commands yet.</li>';
                return;
            }
            items.forEach(item => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.alignItems = 'center';
                li.style.gap = '6px';
                li.style.justifyContent = 'space-between';
                const nameBtn = document.createElement('button');
                nameBtn.className = 'ghost-btn';
                nameBtn.style.padding = '2px 6px';
                nameBtn.textContent = item.name;
                nameBtn.title = 'Load command into form';
                nameBtn.addEventListener('click', () => {
                    try {
                        const pcbObject = item.json; // Prioritize the full JSON object

                        if (pcbObject) {
                            PlaywrightJobObject = pcbObject;

                            // Update form fields from PlaywrightJobObject
                            const nameInput = document.getElementById('nt-name');
                            if (nameInput) nameInput.value = pcbObject.name || item.name;

                            if (projectSelect) projectSelect.value = pcbObject.project || '';
                            if (reporterSelect) reporterSelect.value = pcbObject.reporter || '';

                            if (headlessCheckbox) headlessCheckbox.checked = !!pcbObject.options?.headless;
                            if (updateSnapshotsCheckbox) updateSnapshotsCheckbox.checked = !!pcbObject.options?.updateSnapshots;
                            if (takeScreenshotsCheckbox) takeScreenshotsCheckbox.checked = !!pcbObject.options?.takeScreenshots;
                            if (captureTracesCheckbox) captureTracesCheckbox.checked = !!pcbObject.options?.captureTraces;
                            if (captureHarCheckbox) captureHarCheckbox.checked = !!pcbObject.options?.captureHar;
                            if (measurePerformanceCheckbox) measurePerformanceCheckbox.checked = !!pcbObject.options?.measurePerformance;
                            if (logMetricsCheckbox) logMetricsCheckbox.checked = !!pcbObject.options?.logMetrics;

                            if(outputDirInput) outputDirInput.value = pcbObject.outputDir || '';
                            
                            const userInput = document.getElementById('nt-user');
                            const passInput = document.getElementById('nt-pass');
                            const tokenInput = document.getElementById('nt-token');
                            if (userInput) userInput.value = pcbObject.auth?.user || '';
                            if (passInput) passInput.value = pcbObject.auth?.password || '';
                            if (tokenInput) tokenInput.value = pcbObject.auth?.authToken || '';
                            
                            const harChk = document.getElementById('nt-har-capture');
                            const harPath = document.getElementById('nt-har-path');
                            const harMode = document.getElementById('nt-har-mode');
                            if (harChk) harChk.checked = !!pcbObject.har?.enabled;
                            if (harPath) harPath.value = pcbObject.har?.path || '';
                            if (harMode) harMode.value = pcbObject.har?.mode || 'minimal';
                            
                            // Load environment variables
                            const env = pcbObject.environment || {};
                            if (targetUrlInput) targetUrlInput.value = env.PLAYWRIGHT_TARGET_URL || '';
                            if (additionalPathsInput) additionalPathsInput.value = env.PLAYWRIGHT_ADDITIONAL_PATHS || '';
                            if (logDirInput) logDirInput.value = env.PLAYWRIGHT_LOG_DIR || '';
                            if (screenshotDirInput) screenshotDirInput.value = env.PLAYWRIGHT_SCREENSHOT_DIR || '';
                            if (maxDiskUsageInput) maxDiskUsageInput.value = env.PLAYWRIGHT_MAX_DISK_USAGE || '';
                            
                            // Clear and repopulate custom env vars
                            const customEnvContainer = document.getElementById('custom-env-vars');
                            if (customEnvContainer) {
                                customEnvContainer.querySelectorAll('.custom-env-row').forEach(row => row.remove());
                            }

                            const standardEnvKeys = new Set([
                                'PLAYWRIGHT_TARGET_URL', 'PLAYWRIGHT_TARGET_ENV', 'PLAYWRIGHT_ADDITIONAL_PATHS', 
                                'PLAYWRIGHT_LOG_DIR', 'PLAYWRIGHT_SCREENSHOT_DIR', 'PLAYWRIGHT_MAX_DISK_USAGE',
                                'PLAYWRIGHT_HEADLESS', 'TAKE_SCREENSHOTS', 'CAPTURE_TRACES', 'CAPTURE_HAR',
                                'PLAYWRIGHT_MEASURE_PERFORMANCE', 'PLAYWRIGHT_LOG_METRICS'
                            ]);
                            
                            Object.entries(env).forEach(([key, value]) => {
                                if (!standardEnvKeys.has(key)) {
                                    addCustomEnvVarRow(key, String(value));
                                }
                            });

                            // Load file if specified
                            if (Array.isArray(pcbObject.files) && pcbObject.files[0]) {
                                const match = tests.find(t => t.path === pcbObject.files[0]);
                                if (match) {
                                    selectedTest = match;
                                    const fileItemEl = Array.from(fileList.children).find(child => child.textContent === match.name);
                                    if (fileItemEl) setActiveFile(fileItemEl);
                                    loadTestContent(match);
                                }
                            } else {
                                selectedTest = null;
                                const activeFile = fileList.querySelector('.active');
                                if (activeFile) activeFile.classList.remove('active');
                                testContent.textContent = 'Select a test file to see its content.';
                            }
                        } else {
                            // Legacy fallback for older saved commands without the .json property
                            const legacyPcbObject = {
                                name: item.name,
                                files: item.files || [],
                                project: item.project,
                                reporter: '', // Use config default
                                options: item.options || {},
                                environment: item.environment || {},
                                auth: item.auth || {},
                                har: item.har || {},
                                outputDir: '' // Not available in old format
                            };

                            PlaywrightJobObject = legacyPcbObject;

                            const nameInput = document.getElementById('nt-name');
                            if (nameInput) nameInput.value = item.name;
                            if (projectSelect) projectSelect.value = item.project || '';
                            if (headlessCheckbox) headlessCheckbox.checked = !!item.options?.headless;
                            if (updateSnapshotsCheckbox) updateSnapshotsCheckbox.checked = !!item.options?.updateSnapshots;

                            const userInput = document.getElementById('nt-user');
                            const passInput = document.getElementById('nt-pass');
                            const tokenInput = document.getElementById('nt-token');
                            if (userInput) userInput.value = item.auth?.user || '';
                            if (passInput) passInput.value = item.auth?.password || '';
                            if (tokenInput) tokenInput.value = item.auth?.authToken || '';
                            
                            const harChk = document.getElementById('nt-har-capture');
                            const harPath = document.getElementById('nt-har-path');
                            const harMode = document.getElementById('nt-har-mode');
                            if (harChk) harChk.checked = !!item.har?.capture;
                            if (harPath) harPath.value = item.har?.path || '';
                            if (harMode) harMode.value = item.har?.mode || 'minimal';
                            
                            if (Array.isArray(item.files) && item.files[0]) {
                                const match = tests.find(t => t.path === item.files[0]);
                                if (match) {
                                    selectedTest = match;
                                    loadTestContent(match);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Failed to load saved command:', e);
                    }
                    renderFromState();
                });
                
                const row = document.createElement('div');
                const copyBtn = document.createElement('button');
                copyBtn.className = 'ghost-btn';
                copyBtn.title = 'Copy command ID';
                copyBtn.textContent = '📋';
                copyBtn.addEventListener('click', () => navigator.clipboard.writeText(item.id));
                
                const delBtn = document.createElement('button');
                delBtn.className = 'ghost-btn';
                delBtn.title = 'Delete saved command';
                delBtn.textContent = '🗑';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showDeleteConfirmation(item, li, delBtn);
                });
                
                li.appendChild(nameBtn);
                row.appendChild(copyBtn);
                row.appendChild(delBtn);
                li.appendChild(row);
                listEl.appendChild(li);
            });
        } catch (e) {
            console.error('Failed to load saved commands:', e);
            listEl.innerHTML = '<li style="color: red;">Failed to load saved commands</li>';
        }
    }

        // Initialize the layout first, then fetch data
    initializePcbLayout();

    // Restore saved layout state
    setTimeout(() => {
        const savedState = DevWatchUiSection.loadState();
        if (savedState) {
            DevWatchUiSection.restoreLayout(savedState, 50);
        }
    }, 50);

    // After layout is created, fetch data
            setTimeout(() => {
        fetchTestsAndConfig();
        refreshSavedCommands();
    }, 150);

    function initializePcbLayout() {
        const mainContainer = document.getElementById('pcb-main-container');
        if (!mainContainer) return;

        // Create the column container
        columnContainer = new DevWatchColumnContainer({
            id: 'pcb-columns',
            columns: ['left', 'right'],
            resizable: true,
            parentContainer: mainContainer
        });

        // Create left column sections
        sections.testFiles = new DevWatchUiSection({
            id: 'test-files-section',
            title: 'Test Files',
            content: '<div id="file-list" class="file-list"></div>',
            position: 'left',
            isOpen: true
        });

        sections.savedCommands = new DevWatchUiSection({
            id: 'saved-commands-section',
            title: 'Saved Commands <span style="font-size:10px;color:var(--devwatch-text-muted);font-weight:normal;">(playwright type)</span>',
            content: `
                <div style="padding:8px;">
                    <div style="font-size:10px;color:var(--devwatch-text-muted);margin-bottom:8px;">Your saved commands • Click to edit</div>
                    <ul id="nt-list" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px;"></ul>
                </div>
            `,
            position: 'left',
            isOpen: true
        });

        sections.info = new DevWatchUiSection({
            id: 'info-section',
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
                        <tr><td style="padding:2px 8px 2px 0; color:#88ff88;"><strong>HAR:</strong></td><td style="color:#ddd;">Capture network traffic</td></tr>
                    </table>
                    
                    <h2 style="margin:16px 0 8px 0; color:#4a9eff; font-size:14px;">🌍 Environment Variables</h2>
                    <p style="margin:0 0 8px 0; color:#ddd; font-size:12px;">Configure Playwright behavior through environment variables:</p>
                    <ul style="margin:0 0 16px 16px; color:#ddd; font-size:11px;">
                        <li><code>PLAYWRIGHT_TARGET_URL</code> - Override base URL</li>
                        <li><code>PLAYWRIGHT_TARGET_ENV</code> - Environment (dev/staging/prod)</li>
                        <li><code>TAKE_SCREENSHOTS</code> - Enable screenshot capture</li>
                        <li><code>CAPTURE_TRACES</code> - Enable trace recording</li>
                        <li><code>CAPTURE_HAR</code> - Enable network capture</li>
                        <li><code>PLAYWRIGHT_HEADLESS</code> - Browser visibility</li>
                    </ul>
                    
                    <h2 style="margin:16px 0 8px 0; color:#4a9eff; font-size:14px;">💾 Command Storage</h2>
                    <p style="margin:0 0 8px 0; color:#ddd; font-size:12px;">Your saved commands are stored at:</p>
                    <ul style="margin:0 0 16px 16px; color:#ddd; font-size:11px;">
                        <li><strong>Saved Commands:</strong> <code>PW_DIR/data/saved-commands/playwright/</code></li>
                        <li><strong>Execution Logs:</strong> <code>PW_DIR/data/executions/</code></li>
                        <li><strong>Test Reports:</strong> <code>PW_DIR/reports/</code></li>
                    </ul>
                    
                    <h2 style="margin:16px 0 8px 0; color:#4a9eff; font-size:14px;">🎯 Command Builder Workflow</h2>
                    <div style="margin:0 0 16px 16px; color:#ddd; font-size:12px;">
                        <p><strong>Build → Save → Run</strong></p>
                        <p style="font-size:11px; opacity:0.8;">Configure your test command visually, save it with a memorable name, then execute it in Command Runner whenever needed.</p>
                    </div>
                    
                    <div style="margin-top:16px; padding:8px; background:var(--devwatch-bg-tertiary); border-radius:4px; border-left:3px solid var(--devwatch-accent-primary);">
                        <p style="margin:0; color:var(--devwatch-text-secondary); font-size:11px;"><strong>💡 Tip:</strong> Sections are draggable and resizable. Click section headers to collapse/expand.</p>
                    </div>
                </div>
            `,
            position: 'right',
            isOpen: false
        });

        // Create right column sections
        sections.codeViewer = new DevWatchUiSection({
            id: 'code-viewer-section',
            title: 'Code Viewer',
            content: `
                <div class="test-content-display">
                    <pre style="min-height:220px;">
                        <code id="test-content" class="language-javascript"></code>
                    </pre>
                </div>
            `,
            position: 'right',
            isOpen: true
        });

        // New Capture section - prominent URL + context + project + capture options
        sections.capture = new DevWatchUiSection({
            id: 'capture-section',
            title: 'Capture',
            content: `
                <div class="capture-form">
                    <!-- Prominent URL input -->
                    <div class="capture-url-bar">
                        <input type="text" id="target-url-input" class="capture-url-input"
                               placeholder="https://example.com" autocomplete="url">
                    </div>

                    <!-- Context and Project selectors -->
                    <div class="capture-selectors">
                        <div class="capture-selector-group">
                            <label for="context-select">Context:</label>
                            <select id="context-select" class="capture-select">
                                <option value="default">Default Context</option>
                            </select>
                            <div class="capture-context-actions">
                                <button type="button" id="new-context-btn" class="capture-btn-icon" title="New Context">+</button>
                                <button type="button" id="edit-context-btn" class="capture-btn-icon" title="Edit Context">Edit</button>
                            </div>
                        </div>
                        <div class="capture-selector-group">
                            <label for="project-select">Project:</label>
                            <select id="project-select" class="capture-select">
                                <option value="">All Projects</option>
                            </select>
                        </div>
                    </div>

                    <!-- Capture options (grouped checkboxes) -->
                    <div class="capture-options">
                        <div class="capture-option">
                            <input type="checkbox" id="take-screenshots-checkbox" checked>
                            <label for="take-screenshots-checkbox">Screenshot</label>
                        </div>
                        <div class="capture-option">
                            <input type="checkbox" id="capture-har-checkbox">
                            <label for="capture-har-checkbox">HAR</label>
                        </div>
                        <div class="capture-option">
                            <input type="checkbox" id="capture-traces-checkbox">
                            <label for="capture-traces-checkbox">Trace</label>
                        </div>
                        <div class="capture-option">
                            <input type="checkbox" id="headless-checkbox" checked>
                            <label for="headless-checkbox">Headless</label>
                        </div>
                    </div>

                    <!-- Action buttons -->
                    <div class="capture-actions">
                        <button type="button" id="record-actions-btn" class="capture-btn capture-btn-secondary">Record Actions</button>
                        <button type="button" id="run-capture-btn" class="capture-btn capture-btn-primary">Run Capture</button>
                    </div>
                </div>
            `,
            position: 'right',
            isOpen: true
        });

        sections.testOptions = new DevWatchUiSection({
            id: 'test-options-section',
            title: 'Test Options',
            content: `
                <div class="devwatch-card" style="padding:10px;">
                    <div class="command-options">
                        <div class="option-group">
                            <label for="reporter-select">Reporter:</label>
                            <select id="reporter-select">
                                <option value="">Use config (recommended)</option>
                                <option>list</option>
                                <option>html</option>
                                <option>dot</option>
                                <option>json</option>
                            </select>
                        </div>
                        <div class="option-group">
                            <input type="checkbox" id="update-snapshots-checkbox">
                            <label for="update-snapshots-checkbox">Update Snapshots</label>
                        </div>
                        <div class="option-group">
                            <input type="checkbox" id="measure-performance-checkbox">
                            <label for="measure-performance-checkbox">Measure Performance</label>
                        </div>
                        <div class="option-group">
                            <input type="checkbox" id="log-metrics-checkbox">
                            <label for="log-metrics-checkbox">Log Metrics</label>
                        </div>
                    </div>
                    <div class="output-override-group">
                        <label for="output-dir-input">Output Dir:</label>
                        <input type="text" id="output-dir-input" placeholder="Override default...">
                    </div>
                </div>
            `,
            position: 'right',
            isOpen: false
        });

        sections.authAndHar = new DevWatchUiSection({
            id: 'auth-har-section',
            title: 'Auth & HAR',
            content: `
                <div class="devwatch-card" style="padding:10px;">
                    <div class="devwatch-grid-3" style="gap:8px;margin-top:8px;">
                        <div>
                            <label for="nt-user">User</label>
                            <input id="nt-user" type="text" placeholder="user" style="font-size:12px;padding:6px;">
                        </div>
                        <div>
                            <label for="nt-pass">Password</label>
                            <input id="nt-pass" type="password" placeholder="password" style="font-size:12px;padding:6px;">
                        </div>
                        <div>
                            <label for="nt-token">Auth Token</label>
                            <input id="nt-token" type="text" placeholder="token" style="font-size:12px;padding:6px;">
                        </div>
                    </div>
                    <div class="devwatch-grid-3" style="gap:8px;margin-top:8px;align-items:end;">
                        <div>
                            <label><input id="nt-har-capture" type="checkbox"> Capture HAR</label>
                        </div>
                        <div>
                            <label for="nt-har-path">HAR Path</label>
                            <input id="nt-har-path" type="text" placeholder="optional path" style="font-size:12px;padding:6px;">
                        </div>
                        <div>
                            <label for="nt-har-mode">Mode</label>
                            <select id="nt-har-mode" style="font-size:12px;padding:6px;">
                                <option value="minimal">minimal</option>
                                <option value="full">full</option>
                            </select>
                        </div>
                    </div>
                </div>
            `,
            position: 'right',
            isOpen: false
        });

        sections.environment = new DevWatchUiSection({
            id: 'environment-section',
            title: 'Advanced Options',
            content: `
                <div class="devwatch-card" style="padding:10px;">
                    <div class="env-variables-grid" style="display:grid; grid-template-columns:1fr 2fr; gap:8px; align-items:center;">
                        <label for="additional-paths-input">Additional Paths:</label>
                        <input type="text" id="additional-paths-input" placeholder="path1,path2,path3">

                        <label for="log-dir-input">Log Directory:</label>
                        <input type="text" id="log-dir-input" placeholder="Override log directory">

                        <label for="screenshot-dir-input">Screenshot Directory:</label>
                        <input type="text" id="screenshot-dir-input" placeholder="Override screenshot directory">

                        <label for="max-disk-usage-input">Max Disk Usage:</label>
                        <input type="text" id="max-disk-usage-input" placeholder="e.g., 10GB">
                    </div>
                    <details style="margin-top:12px;">
                        <summary style="cursor:pointer;">Custom Environment Variables</summary>
                        <div id="custom-env-vars" style="margin-top:8px;">
                            <button type="button" id="add-env-var-btn" class="ghost-btn">+ Add Environment Variable</button>
                        </div>
                    </details>
                </div>
            `,
            position: 'right',
            isOpen: false
        });

        sections.namedTestJson = new DevWatchUiSection({
            id: 'command-json-section',
            title: 'Generated Command <span style="font-size:10px; color: var(--devwatch-text-muted); font-weight: normal;">Saves to: PW_DIR/data/saved-commands/playwright/</span>',
            content: `
                <div class="devwatch-card" style="padding:10px;">
                    <div style="display: flex; gap: 8px; align-items: end; margin-bottom: 10px;">
                        <div style="flex-grow: 1;">
                            <label for="nt-name">Command Name <span style="font-size:10px;color:var(--devwatch-text-muted);">(becomes command ID)</span></label>
                            <input id="nt-name" type="text" placeholder="e.g., Mobile Smoke" style="font-size:12px;padding:6px;">
                        </div>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <button id="save-named-test-btn" class="ghost-btn" title="Save Command">Save</button>
                            <button id="copy-json-btn" class="ghost-btn" title="Copy JSON">📋</button>
                        </div>
                    </div>
                    <pre style="margin-top:10px; max-height:240px; overflow:auto;"><code id="named-test-json" class="language-json">{}</code></pre>
                </div>
            `,
            position: 'right',
            isOpen: false
        });

        sections.cli = new DevWatchUiSection({
            id: 'cli-section',
            title: 'Command Line Interface',
            content: `
                <div style="padding:8px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <label style="font-size:12px; color:#ccc;">
                            <input type="checkbox" id="show-env-in-cli" checked> Show Environment Variables
                        </label>
                    </div>
                    <div class="cli-command-builder">
                        <div class="cli-command-container">
                            <div id="cli-command" class="cli-command-display"></div>
                            <button id="copy-command-btn" title="Copy Command" class="ghost-btn">📋</button>
                        </div>
                    </div>
                </div>
            `,
            position: 'right',
            isOpen: false
        });

        sections.outputPaths = new DevWatchUiSection({
            id: 'output-paths-section',
            title: 'Output Paths',
            content: `
                <div class="output-paths-display" style="margin-top:6px; padding:10px;">
                    <div id="output-paths" class="paths-content"></div>
                    <div style="margin-top:8px;display:flex;justify-content:flex-end;">
                        <button id="view-report-btn" class="ghost-btn">View Report</button>
                    </div>
                </div>
            `,
            position: 'right',
            isOpen: false
        });

        // Add sections to columns
        columnContainer.addSection(sections.testFiles, 'left');
        columnContainer.addSection(sections.savedCommands, 'left');

        // Capture section first (prominent position)
        columnContainer.addSection(sections.capture, 'right');
        columnContainer.addSection(sections.codeViewer, 'right');
        columnContainer.addSection(sections.testOptions, 'right');
        columnContainer.addSection(sections.authAndHar, 'right');
        columnContainer.addSection(sections.environment, 'right');
        columnContainer.addSection(sections.namedTestJson, 'right');
        columnContainer.addSection(sections.cli, 'right');
        columnContainer.addSection(sections.outputPaths, 'right');
        columnContainer.addSection(sections.info, 'right');

        // Re-assign element references after creation
        setTimeout(() => {
            fileList = document.getElementById('file-list');
            testContent = document.getElementById('test-content');
            cliCommandDisplay = document.getElementById('cli-command');
            copyCommandBtn = document.getElementById('copy-command-btn');

            // Capture form elements
            targetUrlInput = document.getElementById('target-url-input');
            const contextSelect = document.getElementById('context-select');
            const newContextBtn = document.getElementById('new-context-btn');
            const editContextBtn = document.getElementById('edit-context-btn');
            const recordActionsBtn = document.getElementById('record-actions-btn');
            const runCaptureBtn = document.getElementById('run-capture-btn');

            // Test options elements
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

            // Advanced options elements
            additionalPathsInput = document.getElementById('additional-paths-input');
            logDirInput = document.getElementById('log-dir-input');
            screenshotDirInput = document.getElementById('screenshot-dir-input');
            maxDiskUsageInput = document.getElementById('max-disk-usage-input');
            showEnvInCliCheckbox = document.getElementById('show-env-in-cli');

            namedTestJsonEl = document.getElementById('named-test-json');
            copyJsonBtn = document.getElementById('copy-json-btn');

            outputPathsDiv = document.getElementById('output-paths');
            viewReportBtn = document.getElementById('view-report-btn');

            // Setup capture action buttons
            if (recordActionsBtn) {
                recordActionsBtn.addEventListener('click', async () => {
                    const url = targetUrlInput?.value?.trim() || '';
                    if (!url) {
                        alert('Please enter a URL first');
                        return;
                    }

                    try {
                        const resp = await fetch('/api/capture/codegen', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                url,
                                contextId: contextSelect?.value || 'default'
                            })
                        });
                        const data = await resp.json();

                        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);

                        // Show the codegen command to the user
                        const msg = `Run this command in your terminal:\n\n${data.command}\n\n${data.note}`;
                        alert(msg);

                        // Also copy to clipboard
                        navigator.clipboard.writeText(data.command).catch(() => {});

                        if (window.DevWatch) window.DevWatch.addLogEntry('Playwright codegen command ready', 'info', {
                            url,
                            command: data.command
                        });
                    } catch (error) {
                        console.error('Failed to get codegen command:', error);
                        alert(`Error: ${error.message}`);
                    }
                });
            }

            if (runCaptureBtn) {
                runCaptureBtn.addEventListener('click', async () => {
                    const url = targetUrlInput?.value?.trim() || '';
                    if (!url) {
                        alert('Please enter a URL first');
                        return;
                    }

                    runCaptureBtn.classList.add('loading');
                    runCaptureBtn.disabled = true;

                    try {
                        const captureOptions = {
                            url,
                            contextId: contextSelect?.value || 'default',
                            project: projectSelect?.value || 'chromium',
                            options: {
                                screenshot: takeScreenshotsCheckbox?.checked ?? true,
                                har: captureHarCheckbox?.checked ?? false,
                                trace: captureTracesCheckbox?.checked ?? false,
                                headless: headlessCheckbox?.checked ?? true
                            }
                        };

                        const resp = await fetch('/api/capture', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(captureOptions)
                        });
                        const data = await resp.json();

                        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);

                        if (window.DevWatch) window.DevWatch.addLogEntry('Capture started', 'success', {
                            captureId: data.captureId,
                            url,
                            status: data.status
                        });

                        // Poll for completion
                        const pollCapture = async (captureId, attempts = 0) => {
                            if (attempts > 30) {
                                if (window.DevWatch) window.DevWatch.addLogEntry('Capture timeout', 'warning', { captureId });
                                return;
                            }

                            try {
                                const statusResp = await fetch(`/api/capture/${captureId}`);
                                const status = await statusResp.json();

                                if (status.status === 'completed') {
                                    if (window.DevWatch) window.DevWatch.addLogEntry('Capture completed', 'success', {
                                        captureId,
                                        artifacts: status.artifacts
                                    });
                                } else if (status.status === 'failed') {
                                    if (window.DevWatch) window.DevWatch.addLogEntry('Capture failed', 'error', {
                                        captureId,
                                        error: status.error
                                    });
                                } else {
                                    // Still running, poll again
                                    setTimeout(() => pollCapture(captureId, attempts + 1), 1000);
                                }
                            } catch (pollError) {
                                console.error('Poll error:', pollError);
                            }
                        };

                        pollCapture(data.captureId);

                    } catch (error) {
                        console.error('Capture error:', error);
                        if (window.DevWatch) window.DevWatch.addLogEntry('Capture failed', 'error', {
                            url,
                            error: error.message
                        });
                        alert(`Capture failed: ${error.message}`);
                    } finally {
                        runCaptureBtn.classList.remove('loading');
                        runCaptureBtn.disabled = false;
                    }
                });
            }

            if (newContextBtn) {
                newContextBtn.addEventListener('click', async () => {
                    const name = prompt('Enter context name:');
                    if (name) {
                        try {
                            const resp = await fetch('/api/contexts', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name })
                            });
                            if (!resp.ok) {
                                const err = await resp.json();
                                throw new Error(err.error || `HTTP ${resp.status}`);
                            }
                            const newContext = await resp.json();
                            // Refresh context dropdown
                            await populateContexts();
                            // Select the new context
                            contextSelect.value = newContext.id;
                            if (window.DevWatch) window.DevWatch.addLogEntry('Created new context', 'success', { id: newContext.id, name: newContext.name });
                        } catch (error) {
                            console.error('Failed to create context:', error);
                            alert(`Failed to create context: ${error.message}`);
                        }
                    }
                });
            }

            if (editContextBtn) {
                editContextBtn.addEventListener('click', async () => {
                    const currentContextId = contextSelect?.value || 'default';
                    await openContextEditor(currentContextId);
                });
            }

            // Setup event listeners after elements are created
            setupSaveButton();
        }, 50);
    }
});
