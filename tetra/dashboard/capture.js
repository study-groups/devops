// Capture UI - Unified API with Composable Outputs
(function() {
    const org = 'tetra'; // TODO: get from parent/context
    let journeySteps = [];
    let currentCapture = null;
    let currentSession = null;
    let sessions = [];
    let extractedSelectors = { clickable: [], fillable: [] };
    let currentNavigateUrl = null;

    // Presets map: capture types + optional wait strategy
    const PRESETS = {
        quick: { capture: ['screenshot', 'text'] },
        full: { capture: ['screenshot', 'dom', 'text', 'structure'] },
        extract: { capture: ['screenshot', 'interactions'] },
        spa: { capture: ['screenshot', 'dom', 'text'], waitFor: '[data-ready]' }
    };

    // Domain grouping state - localhost domains default expanded
    const expandedDomains = new Set();

    // Capture cache for instant switching
    const captureCache = new Map();

    // Helper: extract domain from URL
    function extractDomain(url) {
        try {
            const u = new URL(url);
            return u.host;
        } catch {
            return 'unknown';
        }
    }

    // Helper: get path from URL (for display under domain header)
    function getPathFromUrl(url) {
        try {
            return new URL(url).pathname || '/';
        } catch {
            return url;
        }
    }

    // DOM elements
    const urlInput = document.getElementById('url-input');
    const presetSelect = document.getElementById('preset-select');
    const waitForInput = document.getElementById('wait-for');
    const viewportWidth = document.getElementById('viewport-width');
    const viewportHeight = document.getElementById('viewport-height');
    const captureTypesEl = document.getElementById('capture-types');
    const stepsMode = document.getElementById('steps-mode');
    const sessionSelect = document.getElementById('session-select');
    const optionsToggle = document.getElementById('options-toggle');
    const headerOptions = document.getElementById('header-options');
    const captureBtn = document.getElementById('capture-btn');
    const previewScreenshot = document.getElementById('preview-screenshot');
    const previewDom = document.getElementById('preview-dom');
    const previewText = document.getElementById('preview-text');
    const previewMeta = document.getElementById('preview-meta');
    const captureId = document.getElementById('capture-id');
    let activePreviewTab = 'screenshot';
    const capturesList = document.getElementById('captures-list');
    const sessionsList = document.getElementById('sessions-list');
    const apiDocs = document.getElementById('api-docs');
    const detailsContent = document.getElementById('details-content');
    const status = document.getElementById('status');
    const journeyBuilder = document.getElementById('journey-builder');
    const stepList = document.getElementById('step-list');
    const stepAction = document.getElementById('step-action');
    const stepParam1 = document.getElementById('step-param1');
    const stepParam2 = document.getElementById('step-param2');
    const selectorDropdown = document.getElementById('selector-dropdown');
    const selectorsPanel = document.getElementById('selectors-panel');
    const selectorsStatus = document.getElementById('selectors-status');
    const resizeHandle = document.getElementById('resize-handle');
    const resizeHandleH = document.getElementById('resize-handle-h');
    const resizeHandleV = document.getElementById('resize-handle-v');
    const journeySelect = document.getElementById('journey-select');
    const newSessionBtn = document.getElementById('new-session-btn');
    const importSessionBtn = document.getElementById('import-session-btn');
    const sessionEditorModal = document.getElementById('session-editor-modal');
    const importModal = document.getElementById('import-modal');
    const mainPanel = document.querySelector('.main-panel');
    let journeys = [];
    const previewPanel = document.querySelector('.preview');
    const sidebar = document.querySelector('.sidebar');
    const sidebarLists = document.querySelector('.sidebar-lists');
    const detailsPanel = document.querySelector('.details-panel');
    const contentArea = document.querySelector('.content');

    // Get selected capture types from pill buttons
    function getSelectedCaptures() {
        const pills = captureTypesEl.querySelectorAll('.pill.active');
        return Array.from(pills).map(p => p.dataset.target);
    }

    // Set capture type pills
    function setSelectedCaptures(types) {
        captureTypesEl.querySelectorAll('.pill').forEach(pill => {
            pill.classList.toggle('active', types.includes(pill.dataset.target));
        });
    }

    // Initialize
    async function init() {
        // Set URL input from data-default attribute
        if (urlInput.dataset.default) {
            urlInput.value = urlInput.dataset.default;
        }
        await Promise.all([loadCaptures(), loadSessions(), loadJourneys()]);
        renderApiDocs();
        attachEventListeners();
    }

    function attachEventListeners() {
        captureBtn.addEventListener('click', doCapture);
        document.getElementById('refresh-list').addEventListener('click', loadCaptures);
        document.getElementById('refresh-sessions').addEventListener('click', loadSessions);
        document.getElementById('copy-api-docs').addEventListener('click', copyApiDocs);
        document.getElementById('add-step-btn').addEventListener('click', addStep);
        document.getElementById('copy-content').addEventListener('click', copyContent);
        document.getElementById('refresh-selectors').addEventListener('click', () => {
            if (currentNavigateUrl) extractSelectors(currentNavigateUrl);
        });
        document.getElementById('save-journey-btn').addEventListener('click', saveJourney);
        document.getElementById('clear-journey-btn').addEventListener('click', clearJourney);

        // Session editor modal
        newSessionBtn.addEventListener('click', () => openSessionEditor());
        importSessionBtn.addEventListener('click', () => openImportModal());
        document.getElementById('close-session-editor').addEventListener('click', closeSessionEditor);
        document.getElementById('cancel-session-btn').addEventListener('click', closeSessionEditor);
        document.getElementById('save-session-btn').addEventListener('click', saveSessionFromEditor);
        document.getElementById('add-variable-btn').addEventListener('click', addVariableRow);

        // Auth type toggle
        document.getElementById('session-auth-type').addEventListener('change', (e) => {
            document.getElementById('jwt-fields').classList.toggle('hidden', e.target.value !== 'jwt');
        });

        // Collapsible sections
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                const target = document.getElementById(header.dataset.target);
                const icon = header.querySelector('.toggle-icon');
                const isHidden = target.classList.toggle('hidden');
                icon.textContent = isHidden ? '+' : '-';
            });
        });

        // Import modal
        document.getElementById('close-import-modal').addEventListener('click', closeImportModal);
        document.getElementById('cancel-import-btn').addEventListener('click', closeImportModal);
        document.getElementById('do-import-btn').addEventListener('click', doImportSession);
        document.getElementById('copy-import-script').addEventListener('click', () => {
            const script = document.getElementById('import-script').textContent;
            navigator.clipboard.writeText(script);
            setStatus('Script copied to clipboard', 'success');
        });

        // Session selector
        sessionSelect.addEventListener('change', () => {
            const name = sessionSelect.value;
            if (name) {
                onSessionSelected(name);
            } else {
                clearSessionInfo();
            }
        });

        // Journey selector
        journeySelect.addEventListener('change', async () => {
            const name = journeySelect.value;
            if (name) {
                await loadJourneyIntoBuilder(name);
            }
        });

        // Options toggle (gear button)
        optionsToggle.addEventListener('click', () => {
            headerOptions.classList.toggle('active');
            optionsToggle.classList.toggle('active');
        });

        // Preset dropdown changes capture types and waitFor
        presetSelect.addEventListener('change', () => {
            const preset = presetSelect.value;
            if (preset && PRESETS[preset]) {
                setSelectedCaptures(PRESETS[preset].capture);
                waitForInput.value = PRESETS[preset].waitFor || '';
            }
        });

        // Capture type pill clicks
        captureTypesEl.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill');
            if (pill) {
                pill.classList.toggle('active');
                // Update preset dropdown to match
                const selected = getSelectedCaptures();
                let matchedPreset = '';
                for (const [name, config] of Object.entries(PRESETS)) {
                    const types = config.capture;
                    if (types.length === selected.length && types.every(t => selected.includes(t))) {
                        matchedPreset = name;
                        break;
                    }
                }
                presetSelect.value = matchedPreset;
            }
        });

        // Steps/Journey mode toggle (pill button)
        stepsMode.addEventListener('click', () => {
            const isActive = stepsMode.classList.toggle('active');
            journeyBuilder.classList.toggle('active', isActive);
            resizeHandle.classList.toggle('visible', isActive);
        });

        stepAction.addEventListener('change', () => {
            const action = stepAction.value;
            stepParam2.classList.toggle('hidden', action !== 'fill');
            updateSelectorUI(action);
        });

        // Selector dropdown changes input
        selectorDropdown.addEventListener('change', () => {
            if (selectorDropdown.value) {
                stepParam1.value = selectorDropdown.value;
            }
        });

        // Sidebar tabs
        setupTabs('.sidebar-lists > .tabs', { panelSelector: '.list-panel' });

        // Details tabs
        setupTabs('.details-panel > .tabs', { onSwitch: showDetails });

        // Preview tabs
        setupTabs('.preview-header .tabs', {
            panelSelector: '.preview-pane',
            onSwitch: (value) => {
                activePreviewTab = value;
                if (value === 'dom') loadDomContent();
            }
        });

        // Copy preview content
        document.getElementById('copy-preview').addEventListener('click', copyPreviewContent);

        // Resize handle drag
        initResizeHandle();
        initResizeHandleH();
        initResizeHandleV();
    }

    function initResizeHandle() {
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = journeyBuilder.offsetHeight;
            resizeHandle.classList.add('active');
            journeyBuilder.classList.add('resizing');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const deltaY = startY - e.clientY;
            const newHeight = Math.max(150, Math.min(startHeight + deltaY, mainPanel.offsetHeight - 100));
            journeyBuilder.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('active');
                journeyBuilder.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('capture-journey-height', journeyBuilder.style.height);
            }
        });

        const savedHeight = localStorage.getItem('capture-journey-height');
        if (savedHeight) journeyBuilder.style.height = savedHeight;
    }

    function initResizeHandleH() {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizeHandleH.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;
            resizeHandleH.classList.add('active');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const deltaX = startX - e.clientX;
            const newWidth = Math.max(200, Math.min(startWidth + deltaX, contentArea.offsetWidth - 300));
            sidebar.style.width = newWidth + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizeHandleH.classList.remove('active');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('capture-sidebar-width', sidebar.style.width);
            }
        });

        const savedWidth = localStorage.getItem('capture-sidebar-width');
        if (savedWidth) sidebar.style.width = savedWidth;
    }

    function initResizeHandleV() {
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;

        resizeHandleV.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = detailsPanel.offsetHeight;
            resizeHandleV.classList.add('active');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const deltaY = startY - e.clientY;
            const newHeight = Math.max(80, Math.min(startHeight + deltaY, sidebar.offsetHeight - 150));
            detailsPanel.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizeHandleV.classList.remove('active');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('capture-details-height', detailsPanel.style.height);
            }
        });

        const savedHeight = localStorage.getItem('capture-details-height');
        if (savedHeight) detailsPanel.style.height = savedHeight;
    }

    function copyPreviewContent() {
        let content = '';
        switch (activePreviewTab) {
            case 'screenshot':
                const img = previewScreenshot.querySelector('img');
                content = img ? img.src : '';
                break;
            case 'dom':
                content = previewDom.querySelector('.preview-code')?.textContent || '';
                break;
            case 'text':
                content = previewText.querySelector('.preview-code')?.textContent || '';
                break;
            case 'meta':
                content = previewMeta.querySelector('.preview-code')?.textContent || '';
                break;
        }
        if (content) {
            navigator.clipboard.writeText(content);
            setStatus(`Copied ${activePreviewTab} content to clipboard`, 'success');
        }
    }

    function updatePreviewPanes(capture) {
        // Screenshot
        if (capture.screenshotUrl) {
            previewScreenshot.innerHTML = `<img src="${capture.screenshotUrl}" alt="Screenshot">`;
        } else {
            previewScreenshot.innerHTML = '<div class="placeholder">No screenshot available</div>';
        }

        // Text
        previewText.querySelector('.preview-code').textContent = capture.textContent || '(no text content)';

        // DOM - lazy load, just mark as pending
        previewDom.dataset.url = capture.domUrl || '';
        previewDom.dataset.loaded = 'false';
        if (!capture.domUrl) {
            previewDom.querySelector('.preview-code').textContent = '(DOM not captured - enable "dom" checkbox)';
        } else {
            previewDom.querySelector('.preview-code').textContent = '(click to load DOM)';
        }

        // Meta
        const meta = {
            id: capture.id,
            url: capture.url,
            finalUrl: capture.finalUrl,
            title: capture.title,
            capture: capture.capture,
            timestamp: capture.timestamp,
            duration: capture.duration
        };
        previewMeta.querySelector('.preview-code').textContent = JSON.stringify(meta, null, 2);
    }

    function loadDomContent() {
        const url = previewDom.dataset.url;
        if (!url || previewDom.dataset.loaded === 'true') return;

        previewDom.querySelector('.preview-code').textContent = 'Loading...';
        fetch(url)
            .then(r => r.text())
            .then(html => {
                previewDom.querySelector('.preview-code').textContent = html;
                previewDom.dataset.loaded = 'true';
            })
            .catch(() => {
                previewDom.querySelector('.preview-code').textContent = '(DOM not available)';
            });
    }

    function updateSelectorUI(action) {
        const needsSelector = ['click', 'fill', 'waitForSelector'].includes(action);
        const hasSelectors = extractedSelectors.clickable.length > 0 || extractedSelectors.fillable.length > 0;

        if (needsSelector && hasSelectors) {
            selectorDropdown.classList.remove('hidden');
            stepParam1.style.flex = '1';
            populateSelectorDropdown(action);
        } else {
            selectorDropdown.classList.add('hidden');
        }

        stepParam1.placeholder = getPlaceholder(action);
    }

    function populateSelectorDropdown(action) {
        selectorDropdown.innerHTML = '<option value="">-- Pick selector --</option>';
        const selectors = action === 'fill' ? extractedSelectors.fillable : extractedSelectors.clickable;
        selectors.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.selector;
            opt.textContent = `${s.text || s.label || s.type || 'element'} (${s.selector})`.substring(0, 60);
            selectorDropdown.appendChild(opt);
        });
    }

    // Extract selectors from a URL using extract preset
    async function extractSelectors(url) {
        selectorsStatus.textContent = 'extracting...';
        selectorsStatus.className = 'selectors-status loading';

        try {
            const res = await fetch('/api/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org,
                    url,
                    preset: 'extract',
                    session: sessionSelect.value || null
                })
            });

            const result = await res.json();

            if (result.success && (result.clickableCount > 0 || result.fillableCount > 0)) {
                // Fetch the interactions file
                const intRes = await fetch(`/api/capture/${org}/${result.id}/file/interactions.json`);
                const interactions = await intRes.json();

                extractedSelectors = {
                    clickable: interactions.clickable || [],
                    fillable: interactions.fillable || []
                };

                selectorsStatus.textContent = `${extractedSelectors.clickable.length + extractedSelectors.fillable.length} elements`;
                selectorsStatus.className = 'selectors-status ready';

                renderSelectorsPanel();
                updateSelectorUI(stepAction.value);
                selectorsPanel.classList.remove('hidden');
            } else {
                selectorsStatus.textContent = 'no elements';
                selectorsStatus.className = 'selectors-status';
            }
        } catch (e) {
            selectorsStatus.textContent = 'error';
            selectorsStatus.className = 'selectors-status';
            console.error('Extract failed:', e);
        }
    }

    function renderSelectorsPanel() {
        const clickableList = document.getElementById('clickable-list');
        const fillableList = document.getElementById('fillable-list');
        document.getElementById('clickable-count').textContent = extractedSelectors.clickable.length;
        document.getElementById('fillable-count').textContent = extractedSelectors.fillable.length;

        clickableList.innerHTML = extractedSelectors.clickable.slice(0, 20).map(s => `
            <div class="selector-item" data-selector="${escapeAttr(s.selector)}" data-type="click">
                <span class="sel-text">${escapeHtml(s.text || s.tag || 'element')}</span>
                <span class="sel-selector">${escapeHtml(s.selector)}</span>
                <button title="Add click step">+</button>
            </div>
        `).join('') || '<div class="empty-state">None found</div>';

        fillableList.innerHTML = extractedSelectors.fillable.slice(0, 20).map(s => `
            <div class="selector-item" data-selector="${escapeAttr(s.selector)}" data-type="fill">
                <span class="sel-text">${escapeHtml(s.label || s.placeholder || s.name || s.type)}</span>
                <span class="sel-selector">${escapeHtml(s.selector)}</span>
                <button title="Add fill step">+</button>
            </div>
        `).join('') || '<div class="empty-state">None found</div>';

        selectorsPanel.querySelectorAll('.selector-item button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.selector-item');
                const selector = item.dataset.selector;
                const type = item.dataset.type;
                stepAction.value = type;
                stepParam1.value = selector;
                updateSelectorUI(type);
                if (type === 'fill') stepParam2.classList.remove('hidden');
            });
        });

        selectorsPanel.querySelectorAll('.selector-item').forEach(item => {
            item.addEventListener('click', () => {
                stepParam1.value = item.dataset.selector;
            });
        });
    }

    function escapeAttr(str) {
        return String(str).replace(/"/g, '&quot;');
    }

    function getPlaceholder(action) {
        switch(action) {
            case 'navigate': return 'URL';
            case 'click': return 'Selector (e.g., #btn-login)';
            case 'fill': return 'Selector';
            case 'wait': return 'Milliseconds (e.g., 2000)';
            case 'waitForSelector': return 'Selector';
            case 'evaluate': return 'JavaScript code';
            case 'saveSession': return 'Session name';
            case 'setViewport': return 'Width x Height (e.g., 375x667)';
            default: return 'Parameter';
        }
    }

    function addStep() {
        const action = stepAction.value;
        const param1 = stepParam1.value.trim();
        const param2 = stepParam2.value.trim();

        if (!param1) return;

        const step = { action };
        switch(action) {
            case 'navigate': step.url = param1; break;
            case 'click': step.selector = param1; break;
            case 'fill': step.selector = param1; step.value = param2; break;
            case 'wait': step.ms = parseInt(param1) || 1000; break;
            case 'waitForSelector': step.selector = param1; break;
            case 'evaluate': step.script = param1; break;
            case 'saveSession': step.name = param1; break;
            case 'setViewport':
                // Parse "1280x720" or "1280,720" format
                const dims = param1.split(/[x,]/);
                step.width = parseInt(dims[0]) || 1280;
                step.height = parseInt(dims[1]) || 720;
                break;
        }

        journeySteps.push(step);
        renderSteps();
        stepParam1.value = '';
        stepParam2.value = '';
        selectorDropdown.value = '';

        // If this is a navigate step, extract selectors
        if (action === 'navigate') {
            currentNavigateUrl = param1;
            extractSelectors(param1);
        }
    }

    function removeStep(index) {
        journeySteps.splice(index, 1);
        renderSteps();
    }

    function saveJourney() {
        const nameInput = document.getElementById('journey-name');
        const name = nameInput.value.trim() || 'draft';

        if (journeySteps.length === 0) {
            setStatus('Add at least one step', 'error');
            return;
        }

        // Save to localStorage as a quick draft
        const draft = {
            name,
            steps: journeySteps,
            capture: getSelectedCaptures(),
            saved: Date.now()
        };
        localStorage.setItem(`capture-draft-${org}`, JSON.stringify(draft));
        setStatus(`Steps saved as "${name}" draft`, 'success');
    }

    function clearJourney() {
        if (journeySteps.length === 0) return;

        const btn = document.getElementById('clear-journey-btn');
        if (btn.classList.contains('confirm')) {
            journeySteps = [];
            renderSteps();
            document.getElementById('journey-name').value = '';
            currentNavigateUrl = null;
            extractedSelectors = { clickable: [], fillable: [] };
            updateSelectorUI(stepAction.value);
            selectorsPanel.classList.add('hidden');
            setStatus('Journey cleared', 'success');
            btn.classList.remove('confirm');
            btn.textContent = 'Clear';
        } else {
            btn.classList.add('confirm');
            btn.textContent = 'Clear?';
            setTimeout(() => {
                btn.classList.remove('confirm');
                btn.textContent = 'Clear';
            }, 2000);
        }
    }

    function loadJourneyDraft() {
        // Load steps from localStorage draft
        const draftJson = localStorage.getItem(`capture-draft-${org}`);
        if (!draftJson) {
            setStatus('No saved draft', 'error');
            return;
        }

        try {
            const draft = JSON.parse(draftJson);
            loadStepsIntoBuilder(draft.steps, draft.name, draft.capture);
            setStatus(`Loaded draft "${draft.name}" (${draft.steps.length} steps)`, 'success');
        } catch (e) {
            setStatus('Error loading draft', 'error');
        }
    }

    function loadStepsIntoBuilder(steps, name = '', captureTypes = null) {
        journeySteps = steps || [];
        renderSteps();
        document.getElementById('journey-name').value = name;

        // Enable steps mode
        stepsMode.classList.add('active');
        journeyBuilder.classList.add('active');
        resizeHandle.classList.add('visible');

        // Set capture types if provided
        if (captureTypes) {
            setSelectedCaptures(captureTypes);
            presetSelect.value = '';
        }

        // Extract selectors from first navigate step
        const navigateStep = journeySteps.find(s => s.action === 'navigate');
        if (navigateStep) {
            currentNavigateUrl = navigateStep.url;
            extractSelectors(navigateStep.url);
        }
    }

    function renderSteps() {
        stepList.innerHTML = journeySteps.map((step, i) => {
            let value = '';
            switch(step.action) {
                case 'navigate': value = step.url; break;
                case 'click': value = step.selector; break;
                case 'fill': value = `${step.selector} = "${step.value}"`; break;
                case 'wait': value = `${step.ms}ms`; break;
                case 'waitForSelector': value = step.selector; break;
                case 'evaluate': value = step.script?.substring(0, 40) + (step.script?.length > 40 ? '...' : ''); break;
                case 'saveSession': value = step.name; break;
            }
            return `
                <div class="step-item">
                    <span class="step-num">${i + 1}</span>
                    <span class="step-action">${step.action}</span>
                    <span class="step-value">${escapeHtml(value)}</span>
                    <button onclick="window.removeStep(${i})">&times;</button>
                </div>
            `;
        }).join('');
    }
    window.removeStep = removeStep;

    async function doCapture() {
        const url = urlInput.value.trim();
        const isStepsMode = stepsMode.classList.contains('active');
        const session = sessionSelect.value || null;
        const captureTypes = getSelectedCaptures();

        if (!isStepsMode && !url) {
            setStatus('URL required', 'error');
            return;
        }

        if (isStepsMode && journeySteps.length === 0) {
            setStatus('Add at least one step', 'error');
            return;
        }

        if (captureTypes.length === 0) {
            setStatus('Select at least one capture type', 'error');
            return;
        }

        setStatus('Capturing...', 'capturing');
        captureBtn.disabled = true;

        try {
            const waitFor = waitForInput.value.trim();
            const body = {
                org,
                capture: captureTypes,
                session
            };

            // Add viewport if specified
            const vw = parseInt(viewportWidth.value);
            const vh = parseInt(viewportHeight.value);
            if (vw && vh) {
                body.viewport = { width: vw, height: vh };
            }

            if (waitFor) {
                body.waitForSelector = waitFor;
            }

            if (isStepsMode) {
                body.steps = journeySteps;
            } else {
                body.url = url;
            }

            const res = await fetch('/api/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await res.json();

            if (result.success) {
                setStatus(`Captured: ${result.id}`, 'success');
                captureId.textContent = result.id;
                currentCapture = result;

                // Update preview panes
                const screenshotUrl = result.screenshotFile ? `/api/capture/${org}/${result.id}/file/${result.screenshotFile}` : null;
                const domUrl = result.domFile ? `/api/capture/${org}/${result.id}/file/${result.domFile}` : null;
                updatePreviewPanes({
                    ...result,
                    screenshotUrl,
                    domUrl
                });

                // Reload captures list
                loadCaptures();
                if (isStepsMode) loadSessions();
            } else {
                setStatus(`Error: ${result.error}`, 'error');
            }
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        } finally {
            captureBtn.disabled = false;
        }
    }

    function renderCaptureItem(c, showPath = false) {
        const displayUrl = showPath ? getPathFromUrl(c.url) : (c.url || c.title || c.id);
        const captureTypes = (c.capture || []).join(', ') || 'screenshot';
        return `
            <div class="capture-item" data-id="${c.id}" data-url="${escapeAttr(c.url || '')}">
                <div class="capture-row">
                    <span class="url">${escapeHtml(displayUrl)}</span>
                    <span class="time">${formatTime(c.timestamp)}</span>
                </div>
                <div class="capture-row">
                    <span class="capture-badge">${captureTypes}</span>
                    <span class="actions">
                        <button class="use-capture" data-id="${c.id}" data-url="${escapeAttr(c.url || '')}">Use</button>
                        <button class="delete delete-capture" data-id="${c.id}">Del</button>
                    </span>
                </div>
            </div>
        `;
    }

    async function loadCaptures() {
        try {
            const res = await fetch(`/api/capture/list?org=${org}`);
            const captures = await res.json();

            if (captures.length === 0) {
                capturesList.innerHTML = '<div class="empty-state">No captures yet</div>';
                return;
            }

            // Group by domain
            const byDomain = {};
            captures.forEach(c => {
                const domain = extractDomain(c.url || '');
                if (!byDomain[domain]) byDomain[domain] = [];
                byDomain[domain].push(c);
            });

            // Sort domains by most recent capture
            const domains = Object.keys(byDomain).sort((a, b) => {
                const aTime = byDomain[a][0].timestamp;
                const bTime = byDomain[b][0].timestamp;
                return new Date(bTime) - new Date(aTime);
            });

            // Auto-expand localhost domains on first load
            if (expandedDomains.size === 0) {
                domains.forEach(d => {
                    if (d.startsWith('localhost') || d.startsWith('127.0.0.1')) {
                        expandedDomains.add(d);
                    }
                });
                if (domains.length > 0 && !expandedDomains.has(domains[0])) {
                    expandedDomains.add(domains[0]);
                }
            }

            // Render grouped by domain
            capturesList.innerHTML = domains.map(domain => {
                const items = byDomain[domain];
                const expanded = expandedDomains.has(domain);
                return `
                    <div class="domain-group ${expanded ? 'expanded' : ''}" data-domain="${escapeAttr(domain)}">
                        <div class="domain-header">
                            <span class="expand-icon">${expanded ? '▼' : '▶'}</span>
                            <span class="domain-name">${escapeHtml(domain)}</span>
                            <span class="domain-count">(${items.length})</span>
                        </div>
                        <div class="domain-items">
                            ${items.map(c => renderCaptureItem(c, true)).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            // Attach click handlers for selecting capture
            capturesList.querySelectorAll('.capture-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    selectCapture(item.dataset.id, item.dataset.url);
                });
            });

            // Use button handlers - populate URL
            capturesList.querySelectorAll('.use-capture').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const url = btn.dataset.url;

                    // Check if capture had steps
                    try {
                        const res = await fetch(`/api/capture/${org}/${id}`);
                        const manifest = await res.json();

                        if (manifest.steps && manifest.steps.length > 0) {
                            // Load steps
                            journeySteps = manifest.steps.map(s => {
                                const step = { action: s.action };
                                if (s.url) step.url = s.url;
                                if (s.selector) step.selector = s.selector;
                                if (s.value) step.value = s.value;
                                if (s.sessionSaved) step.name = s.sessionSaved;
                                if (s.ms) step.ms = s.ms;
                                if (s.script) step.script = s.script;
                                return step;
                            });
                            renderSteps();
                            stepsMode.classList.add('active');
                            journeyBuilder.classList.add('active');
                            resizeHandle.classList.add('visible');
                            setStatus(`Loaded ${journeySteps.length} steps`, 'success');
                        } else if (url) {
                            urlInput.value = url;
                            stepsMode.classList.remove('active');
                            journeyBuilder.classList.remove('active');
                            resizeHandle.classList.remove('visible');
                            setStatus(`URL ready: ${url}`, 'success');
                        }

                        // Set capture types from manifest
                        if (manifest.capture) {
                            setSelectedCaptures(manifest.capture);
                            presetSelect.value = '';
                        }
                    } catch (e) {
                        setStatus('Error loading capture: ' + e.message, 'error');
                    }
                });
            });

            // Delete button handlers
            capturesList.querySelectorAll('.delete-capture').forEach(btn => {
                setupDeleteButton(btn, () => deleteCapture(btn.dataset.id));
            });

            // Domain header toggle handlers
            capturesList.querySelectorAll('.domain-header').forEach(header => {
                header.addEventListener('click', (e) => {
                    const group = header.closest('.domain-group');
                    const domain = group.dataset.domain;
                    const icon = header.querySelector('.expand-icon');

                    if (expandedDomains.has(domain)) {
                        expandedDomains.delete(domain);
                        group.classList.remove('expanded');
                        icon.textContent = '▶';
                    } else {
                        expandedDomains.add(domain);
                        group.classList.add('expanded');
                        icon.textContent = '▼';
                    }
                });
            });
        } catch (e) {
            capturesList.innerHTML = `<div class="empty-state">Error loading captures</div>`;
        }
    }

    async function deleteCapture(id) {
        try {
            const res = await fetch(`/api/capture/${org}/${id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.deleted) {
                captureCache.delete(id);
                setStatus(`Deleted: ${id}`, 'success');
                loadCaptures();
            } else {
                setStatus('Error deleting capture', 'error');
            }
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        }
    }

    async function loadSessions() {
        try {
            const res = await fetch(`/api/capture/sessions?org=${org}`);
            sessions = await res.json();

            sessionSelect.innerHTML = '<option value="">No Session</option>';
            sessions.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = s.name;
                sessionSelect.appendChild(opt);
            });

            if (sessions.length === 0) {
                sessionsList.innerHTML = '<div class="empty-state">No saved sessions<br><small>Use Steps mode with saveSession action</small></div>';
                return;
            }

            sessionsList.innerHTML = sessions.map(s => {
                const badges = [];
                if (s.hasCredentials) badges.push('creds');
                if (s.authType === 'jwt') badges.push('JWT');
                else if (s.hasAuth) badges.push('auth');
                if (s.variableCount) badges.push(`${s.variableCount} vars`);
                if (s.hasState) badges.push('state');

                return `
                <div class="session-item" data-name="${s.name}">
                    <div class="name">${escapeHtml(s.name)}</div>
                    <div class="meta">
                        <span>${escapeHtml(s.baseUrl || s.targetUrl || 'No URL')}</span>
                    </div>
                    ${badges.length ? `<div class="meta">${badges.map(b => `<span class="session-badge">${b}</span>`).join('')}</div>` : ''}
                    <div class="actions">
                        <button class="use-session" data-name="${s.name}">Use</button>
                        <button class="edit-session" data-name="${s.name}">Edit</button>
                        <button class="delete delete-session" data-name="${s.name}">Del</button>
                    </div>
                </div>
            `}).join('');

            sessionsList.querySelectorAll('.session-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    selectSession(item.dataset.name);
                });
            });

            sessionsList.querySelectorAll('.use-session').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    sessionSelect.value = btn.dataset.name;
                    onSessionSelected(btn.dataset.name);
                });
            });

            sessionsList.querySelectorAll('.edit-session').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openSessionEditor(btn.dataset.name);
                });
            });

            sessionsList.querySelectorAll('.delete-session').forEach(btn => {
                setupDeleteButton(btn, () => deleteSession(btn.dataset.name));
            });
        } catch (e) {
            sessionsList.innerHTML = `<div class="empty-state">Error loading sessions</div>`;
        }
    }

    async function selectSession(name) {
        try {
            const res = await fetch(`/api/capture/sessions/${org}/${name}/state`);
            currentSession = await res.json();
            currentCapture = null;

            sessionsList.querySelectorAll('.session-item').forEach(item => {
                item.classList.toggle('active', item.dataset.name === name);
            });
            capturesList.querySelectorAll('.capture-item').forEach(item => {
                item.classList.remove('active');
            });

            previewScreenshot.innerHTML = `<div class="placeholder">Session: ${name}</div>`;
            previewDom.querySelector('.preview-code').textContent = '(session selected - no DOM)';
            previewText.querySelector('.preview-code').textContent = '(session selected - no text)';
            previewMeta.querySelector('.preview-code').textContent = JSON.stringify(currentSession, null, 2);
            captureId.textContent = name;

            showSessionDetails();
            setStatus(`Session: ${name} - ${currentSession.cookies?.length || 0} cookies`, 'success');
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        }
    }

    function showSessionDetails() {
        if (!currentSession) return;

        const cookies = currentSession.cookies || [];
        const origins = currentSession.origins || [];

        let html = '<div class="session-details">';
        html += `<div class="session-section">`;
        html += `<div class="session-section-header">Cookies (${cookies.length})</div>`;
        if (cookies.length === 0) {
            html += '<div class="empty-state">No cookies</div>';
        } else {
            html += '<div class="cookie-list">';
            cookies.forEach(c => {
                const expires = c.expires > 0 ? new Date(c.expires * 1000).toLocaleDateString() : 'Session';
                html += `
                    <div class="cookie-item">
                        <span class="cookie-name">${escapeHtml(c.name)}</span>
                        <span class="cookie-domain">${escapeHtml(c.domain || '')}</span>
                        <span class="cookie-value" title="${escapeHtml(c.value)}">${escapeHtml(c.value.substring(0, 30))}${c.value.length > 30 ? '...' : ''}</span>
                        <span class="cookie-expires">${expires}</span>
                    </div>
                `;
            });
            html += '</div>';
        }
        html += '</div>';

        origins.forEach(o => {
            if (o.localStorage && o.localStorage.length > 0) {
                html += `<div class="session-section">`;
                html += `<div class="session-section-header">localStorage: ${escapeHtml(o.origin)} (${o.localStorage.length})</div>`;
                html += '<div class="storage-list">';
                o.localStorage.forEach(item => {
                    const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
                    html += `
                        <div class="storage-item">
                            <span class="storage-key">${escapeHtml(item.name)}</span>
                            <span class="storage-value" title="${escapeHtml(value)}">${escapeHtml(value.substring(0, 50))}${value.length > 50 ? '...' : ''}</span>
                        </div>
                    `;
                });
                html += '</div>';
                html += '</div>';
            }
        });

        html += '</div>';
        detailsContent.innerHTML = html;
    }

    async function deleteSession(name) {
        try {
            const res = await fetch(`/api/capture/sessions/${org}/${name}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.deleted) {
                setStatus(`Deleted session: ${name}`, 'success');
                loadSessions();
            } else {
                setStatus(`Error deleting session`, 'error');
            }
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        }
    }

    // API Documentation
    function getApiDocsContent() {
        const baseUrl = window.location.origin;
        return `# Capture API

Base URL: ${baseUrl}

## Capture a Page
POST /api/capture
Content-Type: application/json

{
  "url": "https://example.com",
  "org": "${org}",
  "capture": ["screenshot", "dom", "text"],
  "waitForSelector": "#main-content"
}

### Capture Types
- screenshot: PNG image
- dom: Full HTML
- text: Visible text content
- struct: Page structure
- interact: Clickable/fillable elements

### Wait Strategies (pick one)
- "waitForSelector": "#element-id"  (best for SPAs)
- "waitForTimeout": 2000            (ms delay)
- "waitUntil": "networkidle0"       (no requests for 500ms)
- "waitUntil": "domcontentloaded"   (faster, less reliable)

## Viewport Configuration
Set browser window dimensions:

{
  "url": "https://example.com",
  "org": "${org}",
  "viewport": {"width": 1280, "height": 720},
  "capture": ["screenshot"]
}

### Common Viewport Sizes
- Desktop: 1920x1080, 1440x900, 1280x720
- Tablet: 768x1024, 1024x768
- Mobile: 375x667, 414x896

## Multi-Step Capture
POST /api/capture
{
  "org": "${org}",
  "capture": ["screenshot"],
  "steps": [
    {"action": "navigate", "url": "https://example.com/login"},
    {"action": "waitForSelector", "selector": "#login-form"},
    {"action": "fill", "selector": "#email", "value": "user@example.com"},
    {"action": "fill", "selector": "#password", "value": "secret"},
    {"action": "click", "selector": "button[type=submit]"},
    {"action": "waitForSelector", "selector": ".dashboard"},
    {"action": "saveSession", "name": "logged-in"}
  ]
}

### Step Actions
- navigate: {"action": "navigate", "url": "..."}
- click: {"action": "click", "selector": "..."}
- fill: {"action": "fill", "selector": "...", "value": "..."}
- wait: {"action": "wait", "ms": 1000}
- waitForSelector: {"action": "waitForSelector", "selector": "..."}
- evaluate: {"action": "evaluate", "script": "return document.title"}
- saveSession: {"action": "saveSession", "name": "..."}
- setViewport: {"action": "setViewport", "width": 375, "height": 667}

### Dynamic Viewport (in steps)
Resize during a journey for responsive testing:
{"action": "setViewport", "width": 375, "height": 667}

## List Captures
GET /api/capture/list?org=${org}

## Get Capture
GET /api/capture/${org}/{id}

## Get Capture File
GET /api/capture/${org}/{id}/file/{filename}

## Delete Capture
DELETE /api/capture/${org}/{id}

## Sessions
GET /api/capture/sessions?org=${org}
DELETE /api/capture/sessions/${org}/{name}

## Use Session in Capture
POST /api/capture
{
  "url": "https://example.com/dashboard",
  "org": "${org}",
  "session": "logged-in",
  "capture": ["screenshot"]
}`;
    }

    function renderApiDocs() {
        const content = getApiDocsContent();
        apiDocs.innerHTML = `<pre class="api-docs-content">${escapeHtml(content)}</pre>`;
    }

    function copyApiDocs() {
        const content = getApiDocsContent();
        navigator.clipboard.writeText(content).then(() => {
            setStatus('API docs copied', 'success');
        }).catch(() => {
            setStatus('Copy failed', 'error');
        });
    }

    async function selectCapture(id, captureUrl) {
        // Immediate visual feedback
        capturesList.querySelectorAll('.capture-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === id);
        });
        sessionsList.querySelectorAll('.session-item').forEach(item => {
            item.classList.remove('active');
        });
        currentSession = null;
        captureId.textContent = id;

        try {
            // Check cache first
            if (captureCache.has(id)) {
                currentCapture = captureCache.get(id);
            } else {
                const res = await fetch(`/api/capture/${org}/${id}`);
                currentCapture = await res.json();
                captureCache.set(id, currentCapture);
                // Limit cache size
                if (captureCache.size > 20) {
                    const firstKey = captureCache.keys().next().value;
                    captureCache.delete(firstKey);
                }
            }

            // Build URLs for resources (cache-bust to ensure fresh images)
            const screenshotUrl = currentCapture.screenshotFile ? `/api/capture/${org}/${id}/file/${currentCapture.screenshotFile}?t=${Date.now()}` : null;
            const domUrl = currentCapture.domFile ? `/api/capture/${org}/${id}/file/${currentCapture.domFile}` : null;

            updatePreviewPanes({
                ...currentCapture,
                screenshotUrl,
                domUrl
            });

            // Populate URL input
            const urlToUse = captureUrl || currentCapture.url || currentCapture.finalUrl;
            if (urlToUse) urlInput.value = urlToUse;

            // Set capture types
            if (currentCapture.capture) {
                setSelectedCaptures(currentCapture.capture);
                presetSelect.value = '';
            }

            // Toggle steps mode based on capture
            const hasSteps = currentCapture.steps && currentCapture.steps.length > 0;
            stepsMode.classList.toggle('active', hasSteps);
            journeyBuilder.classList.toggle('active', hasSteps);
            resizeHandle.classList.toggle('visible', hasSteps);

            showDetails('text');
            setStatus(`Loaded: ${id}`, 'success');
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        }
    }

    function showDetails(tab) {
        if (!currentCapture) return;

        let content = '';
        switch(tab) {
            case 'text':
                content = currentCapture.textContent || currentCapture.finalState?.textContent || 'No text content';
                break;
            case 'structure':
                if (currentCapture.steps) {
                    content = currentCapture.steps.map((s, i) =>
                        `${i + 1}. ${s.action} ${s.success ? '✓' : '✗'} ${s.result ? JSON.stringify(s.result) : (s.state?.url || '')}`
                    ).join('\n');
                } else {
                    content = JSON.stringify(currentCapture.structure || currentCapture.headings || {}, null, 2);
                }
                break;
            case 'meta':
                const meta = { ...currentCapture };
                delete meta.textContent;
                delete meta.structure;
                delete meta.headings;
                delete meta.links;
                delete meta.forms;
                delete meta.images;
                delete meta.buttons;
                content = JSON.stringify(meta, null, 2);
                break;
        }

        detailsContent.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
    }

    function copyContent() {
        const text = detailsContent.textContent;
        navigator.clipboard.writeText(text).then(() => {
            setStatus('Copied to clipboard', 'success');
        });
    }

    function setStatus(msg, cls) {
        status.textContent = msg;
        status.className = 'status ' + (cls || '');
    }

    function formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ========================================================================
    // Session Selection & Info Display
    // ========================================================================

    const sessionInfoEl = document.getElementById('session-info');
    const sessionInfoUrl = document.getElementById('session-info-url');
    const sessionInfoVars = document.getElementById('session-info-vars');
    let activeSessionData = null;

    async function onSessionSelected(name) {
        try {
            const res = await fetch(`/api/capture/sessions/${org}/${name}`);
            activeSessionData = await res.json();

            // Show session info bar
            sessionInfoEl.classList.remove('hidden');
            sessionInfoUrl.textContent = activeSessionData.baseUrl || '(no base URL)';

            // Build variables display
            const vars = [];
            if (activeSessionData.credentials?.username) {
                vars.push({ key: 'username', val: activeSessionData.credentials.username });
            }
            if (activeSessionData.credentials?.password) {
                vars.push({ key: 'password', val: '***' });
            }
            if (activeSessionData.variables) {
                Object.entries(activeSessionData.variables).forEach(([key, val]) => {
                    // Truncate long values
                    const displayVal = val.length > 20 ? val.substring(0, 17) + '...' : val;
                    vars.push({ key, val: displayVal });
                });
            }
            if (activeSessionData.auth?.jwt) {
                vars.push({ key: 'jwt', val: '...' + activeSessionData.auth.jwt.slice(-8) });
            }

            sessionInfoVars.innerHTML = vars.map(v =>
                `<span class="session-var"><span class="session-var-key">${escapeHtml(v.key)}:</span> <span class="session-var-val">${escapeHtml(v.val)}</span></span>`
            ).join('');

            // Also set URL input to baseUrl if empty
            if (activeSessionData.baseUrl && !urlInput.value) {
                urlInput.value = activeSessionData.baseUrl;
            }

            setStatus(`Session: ${name}`, 'success');
        } catch (e) {
            setStatus('Error loading session: ' + e.message, 'error');
        }
    }

    function clearSessionInfo() {
        sessionInfoEl.classList.add('hidden');
        sessionInfoUrl.textContent = '';
        sessionInfoVars.innerHTML = '';
        activeSessionData = null;
    }

    // ========================================================================
    // Session Editor
    // ========================================================================

    let editingSession = null;

    function openSessionEditor(sessionName = null) {
        editingSession = sessionName;
        document.getElementById('session-editor-title').textContent = sessionName ? `Edit: ${sessionName}` : 'New Session';

        // Reset form
        document.getElementById('session-name').value = '';
        document.getElementById('session-base-url').value = '';
        document.getElementById('session-description').value = '';
        document.getElementById('session-username').value = '';
        document.getElementById('session-password').value = '';
        document.getElementById('session-auth-type').value = '';
        document.getElementById('session-jwt').value = '';
        document.getElementById('session-jwt-header').value = 'Authorization';
        document.getElementById('session-jwt-prefix').value = 'Bearer ';
        document.getElementById('jwt-fields').classList.add('hidden');

        // Clear variables
        const varsTable = document.getElementById('session-variables');
        varsTable.innerHTML = `<div class="var-row var-header"><span>Key</span><span>Value</span><span></span></div>`;

        // If editing, load session data
        if (sessionName) {
            loadSessionForEdit(sessionName);
        }

        sessionEditorModal.classList.add('active');
    }

    async function loadSessionForEdit(name) {
        try {
            const res = await fetch(`/api/capture/sessions/${org}/${name}`);
            const session = await res.json();

            document.getElementById('session-name').value = session.name || name;
            document.getElementById('session-base-url').value = session.baseUrl || '';
            document.getElementById('session-description').value = session.description || '';

            if (session.credentials) {
                document.getElementById('session-username').value = session.credentials.username || '';
                document.getElementById('session-password').value = session.credentials.password || '';
            }

            if (session.auth) {
                document.getElementById('session-auth-type').value = session.auth.type || '';
                if (session.auth.type === 'jwt') {
                    document.getElementById('jwt-fields').classList.remove('hidden');
                    document.getElementById('session-jwt').value = session.auth.jwt || '';
                    document.getElementById('session-jwt-header').value = session.auth.jwtHeader || 'Authorization';
                    document.getElementById('session-jwt-prefix').value = session.auth.jwtPrefix || 'Bearer ';
                }
            }

            // Load variables
            if (session.variables) {
                Object.entries(session.variables).forEach(([key, value]) => {
                    addVariableRow(key, value);
                });
            }
        } catch (e) {
            setStatus('Error loading session: ' + e.message, 'error');
        }
    }

    function closeSessionEditor() {
        sessionEditorModal.classList.remove('active');
        editingSession = null;
    }

    function addVariableRow(key = '', value = '') {
        const varsTable = document.getElementById('session-variables');
        const row = document.createElement('div');
        row.className = 'var-row';
        row.innerHTML = `
            <input type="text" class="var-key" placeholder="key" value="${escapeAttr(key)}">
            <input type="text" class="var-value" placeholder="value" value="${escapeAttr(value)}">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">&times;</button>
        `;
        varsTable.appendChild(row);
    }

    function getVariablesFromEditor() {
        const vars = {};
        document.querySelectorAll('#session-variables .var-row:not(.var-header)').forEach(row => {
            const key = row.querySelector('.var-key').value.trim();
            const value = row.querySelector('.var-value').value;
            if (key) vars[key] = value;
        });
        return vars;
    }

    async function saveSessionFromEditor() {
        const name = document.getElementById('session-name').value.trim();
        if (!name) {
            setStatus('Session name required', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            setStatus('Invalid name. Use letters, numbers, dashes, underscores only.', 'error');
            return;
        }

        const baseUrl = document.getElementById('session-base-url').value.trim();
        const description = document.getElementById('session-description').value.trim();
        const username = document.getElementById('session-username').value.trim();
        const password = document.getElementById('session-password').value;
        const authType = document.getElementById('session-auth-type').value;
        const variables = getVariablesFromEditor();

        const sessionData = {
            baseUrl,
            description,
            credentials: {},
            variables,
            auth: {}
        };

        if (username) sessionData.credentials.username = username;
        if (password) sessionData.credentials.password = password;

        if (authType === 'jwt') {
            sessionData.auth = {
                type: 'jwt',
                jwt: document.getElementById('session-jwt').value.trim(),
                jwtHeader: document.getElementById('session-jwt-header').value.trim() || 'Authorization',
                jwtPrefix: document.getElementById('session-jwt-prefix').value || 'Bearer '
            };
        }

        try {
            const res = await fetch(`/api/capture/sessions/${org}/${name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });

            const result = await res.json();
            if (result.saved) {
                setStatus(`Session "${name}" saved`, 'success');
                closeSessionEditor();
                loadSessions();
            } else {
                setStatus('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (e) {
            setStatus('Error saving session: ' + e.message, 'error');
        }
    }

    // ========================================================================
    // Import Session
    // ========================================================================

    function openImportModal() {
        document.getElementById('import-data').value = '';
        document.getElementById('import-session-name').value = '';
        importModal.classList.add('active');
    }

    function closeImportModal() {
        importModal.classList.remove('active');
    }

    async function doImportSession() {
        const dataStr = document.getElementById('import-data').value.trim();
        const name = document.getElementById('import-session-name').value.trim();

        if (!dataStr) {
            setStatus('Paste the browser extract data', 'error');
            return;
        }

        if (!name) {
            setStatus('Session name required', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            setStatus('Invalid name. Use letters, numbers, dashes, underscores only.', 'error');
            return;
        }

        let extract;
        try {
            extract = JSON.parse(dataStr);
        } catch (e) {
            setStatus('Invalid JSON. Make sure you copied the entire output.', 'error');
            return;
        }

        try {
            const res = await fetch(`/api/capture/sessions/${org}/${name}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extract })
            });

            const result = await res.json();
            if (result.imported) {
                setStatus(`Imported "${name}": ${result.cookieCount} cookies, ${result.localStorageCount} localStorage items`, 'success');
                closeImportModal();
                loadSessions();
            } else {
                setStatus('Error: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (e) {
            setStatus('Error importing: ' + e.message, 'error');
        }
    }

    // ========================================================================
    // Journey Loading
    // ========================================================================

    async function loadJourneys() {
        try {
            const res = await fetch(`/api/capture/journeys?org=${org}`);
            journeys = await res.json();

            journeySelect.innerHTML = '<option value="">(none)</option>';
            journeys.forEach(j => {
                const opt = document.createElement('option');
                opt.value = j.name;
                opt.textContent = `${j.name} (${j.stepCount || j.steps?.length || 0} steps)`;
                journeySelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Error loading journeys:', e);
        }
    }

    async function loadJourneyIntoBuilder(name) {
        try {
            const res = await fetch(`/api/capture/journeys?org=${org}`);
            const journeys = await res.json();
            const journey = journeys.find(j => j.name === name);

            if (journey && journey.steps) {
                loadStepsIntoBuilder(journey.steps, name, journey.capture);
                setStatus(`Loaded journey "${name}" (${journey.steps.length} steps)`, 'success');
            }
        } catch (e) {
            setStatus('Error loading journey: ' + e.message, 'error');
        }
    }

    init();
})();
