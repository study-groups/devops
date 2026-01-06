// Capture UI with Session Support and Selector Discovery
(function() {
    const org = 'tetra'; // TODO: get from parent/context
    let journeySteps = [];
    let currentCapture = null;
    let currentSession = null;
    let sessions = [];
    let extractedSelectors = { clickable: [], fillable: [] };
    let currentNavigateUrl = null;

    // DOM elements
    const urlInput = document.getElementById('url-input');
    const modeSelect = document.getElementById('mode-select');
    const sessionSelect = document.getElementById('session-select');
    const sessionIndicator = document.getElementById('session-indicator');
    const captureBtn = document.getElementById('capture-btn');
    const previewScreenshot = document.getElementById('preview-screenshot');
    const previewDom = document.getElementById('preview-dom');
    const previewText = document.getElementById('preview-text');
    const previewMeta = document.getElementById('preview-meta');
    const captureId = document.getElementById('capture-id');
    let activePreviewTab = 'screenshot';
    const capturesList = document.getElementById('captures-list');
    const sessionsList = document.getElementById('sessions-list');
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
    const mainPanel = document.querySelector('.main-panel');
    const previewPanel = document.querySelector('.preview');

    // Initialize
    async function init() {
        await Promise.all([loadCaptures(), loadSessions()]);
        attachEventListeners();
    }

    function attachEventListeners() {
        captureBtn.addEventListener('click', doCapture);
        document.getElementById('refresh-list').addEventListener('click', loadCaptures);
        document.getElementById('refresh-sessions').addEventListener('click', loadSessions);
        document.getElementById('add-step-btn').addEventListener('click', addStep);
        document.getElementById('copy-content').addEventListener('click', copyContent);
        document.getElementById('refresh-selectors').addEventListener('click', () => {
            if (currentNavigateUrl) extractSelectors(currentNavigateUrl);
        });

        modeSelect.addEventListener('change', () => {
            const isJourney = modeSelect.value === 'journey';
            journeyBuilder.classList.toggle('active', isJourney);
            resizeHandle.classList.toggle('visible', isJourney);
        });

        sessionSelect.addEventListener('change', () => {
            const session = sessionSelect.value;
            if (session) {
                sessionIndicator.textContent = session;
                sessionIndicator.style.display = 'inline-block';
            } else {
                sessionIndicator.style.display = 'none';
            }
        });

        stepAction.addEventListener('change', () => {
            const action = stepAction.value;
            stepParam2.style.display = action === 'fill' ? 'inline-block' : 'none';
            updateSelectorUI(action);
        });

        // Selector dropdown changes input
        selectorDropdown.addEventListener('change', () => {
            if (selectorDropdown.value) {
                stepParam1.value = selectorDropdown.value;
            }
        });

        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.list-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.panel + '-panel').classList.add('active');
            });
        });

        // Details tabs (sidebar)
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                showDetails(tab.dataset.tab);
            });
        });

        // Preview tabs
        document.querySelectorAll('.preview-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.preview-pane').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                activePreviewTab = tab.dataset.preview;
                document.getElementById('preview-' + activePreviewTab).classList.add('active');
            });
        });

        // Copy preview content
        document.getElementById('copy-preview').addEventListener('click', copyPreviewContent);

        // Resize handle drag
        initResizeHandle();
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
                // Save preference
                localStorage.setItem('capture-journey-height', journeyBuilder.style.height);
            }
        });

        // Restore saved height
        const savedHeight = localStorage.getItem('capture-journey-height');
        if (savedHeight) {
            journeyBuilder.style.height = savedHeight;
        }
    }

    function copyPreviewContent() {
        let content = '';
        switch (activePreviewTab) {
            case 'screenshot':
                // Can't copy image directly, copy URL instead
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

        // DOM - fetch if available
        if (capture.domUrl) {
            fetch(capture.domUrl)
                .then(r => r.text())
                .then(html => {
                    previewDom.querySelector('.preview-code').textContent = html;
                })
                .catch(() => {
                    previewDom.querySelector('.preview-code').textContent = '(DOM not available)';
                });
        } else {
            previewDom.querySelector('.preview-code').textContent = '(DOM not available - use Full mode)';
        }

        // Meta
        const meta = {
            id: capture.id,
            url: capture.url,
            finalUrl: capture.finalUrl,
            title: capture.title,
            mode: capture.mode,
            timestamp: capture.timestamp,
            duration: capture.duration
        };
        previewMeta.querySelector('.preview-code').textContent = JSON.stringify(meta, null, 2);
    }

    // Show/hide selector dropdown based on action type
    function updateSelectorUI(action) {
        const needsSelector = ['click', 'fill', 'waitForSelector'].includes(action);
        const hasSelectors = extractedSelectors.clickable.length > 0 || extractedSelectors.fillable.length > 0;

        if (needsSelector && hasSelectors) {
            selectorDropdown.style.display = 'inline-block';
            stepParam1.style.flex = '1';
            populateSelectorDropdown(action);
        } else {
            selectorDropdown.style.display = 'none';
        }

        stepParam1.placeholder = getPlaceholder(action);
    }

    // Populate dropdown based on action type
    function populateSelectorDropdown(action) {
        selectorDropdown.innerHTML = '<option value="">-- Pick selector --</option>';

        const selectors = action === 'fill'
            ? extractedSelectors.fillable
            : extractedSelectors.clickable;

        selectors.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.selector;
            opt.textContent = `${s.text || s.label || s.type || 'element'} (${s.selector})`.substring(0, 60);
            selectorDropdown.appendChild(opt);
        });
    }

    // Extract selectors from a URL
    async function extractSelectors(url) {
        selectorsStatus.textContent = 'extracting...';
        selectorsStatus.className = 'selectors-status loading';

        try {
            const res = await fetch('/api/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org,
                    mode: 'extract',
                    url,
                    session: sessionSelect.value || null
                })
            });

            const result = await res.json();

            if (result.success && result.interactions) {
                extractedSelectors = {
                    clickable: result.interactions.clickable || [],
                    fillable: result.interactions.fillable || []
                };

                selectorsStatus.textContent = `${extractedSelectors.clickable.length + extractedSelectors.fillable.length} elements`;
                selectorsStatus.className = 'selectors-status ready';

                renderSelectorsPanel();
                updateSelectorUI(stepAction.value);
                selectorsPanel.style.display = 'block';
            } else {
                selectorsStatus.textContent = 'failed';
                selectorsStatus.className = 'selectors-status';
            }
        } catch (e) {
            selectorsStatus.textContent = 'error';
            selectorsStatus.className = 'selectors-status';
            console.error('Extract failed:', e);
        }
    }

    // Render the selectors panel with clickable items
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

        // Attach click handlers to add steps directly
        selectorsPanel.querySelectorAll('.selector-item button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.selector-item');
                const selector = item.dataset.selector;
                const type = item.dataset.type;
                stepAction.value = type;
                stepParam1.value = selector;
                updateSelectorUI(type);
                if (type === 'fill') stepParam2.style.display = 'inline-block';
            });
        });

        // Click on item to select
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
            case 'saveSession': return 'Session name';
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
            case 'saveSession': step.name = param1; break;
        }

        journeySteps.push(step);
        renderSteps();
        stepParam1.value = '';
        stepParam2.value = '';
        selectorDropdown.value = '';

        // If this is a navigate step (first step), extract selectors from the URL
        if (action === 'navigate') {
            currentNavigateUrl = param1;
            extractSelectors(param1);
        }
    }

    function removeStep(index) {
        journeySteps.splice(index, 1);
        renderSteps();
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
                case 'saveSession': value = step.name; break;
            }
            return `
                <div class="step-item">
                    <span class="step-num">${i + 1}</span>
                    <span class="step-action">${step.action}</span>
                    <span class="step-value">${value}</span>
                    <button onclick="window.removeStep(${i})">&times;</button>
                </div>
            `;
        }).join('');
    }
    window.removeStep = removeStep;

    async function doCapture() {
        const url = urlInput.value.trim();
        const mode = modeSelect.value;
        const session = sessionSelect.value || null;

        if (mode !== 'journey' && !url) {
            setStatus('URL required', 'error');
            return;
        }

        if (mode === 'journey' && journeySteps.length === 0) {
            setStatus('Add at least one journey step', 'error');
            return;
        }

        setStatus('Capturing...', 'capturing');
        captureBtn.disabled = true;

        try {
            const body = { org, mode, session };
            if (mode === 'journey') {
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
                const screenshotUrl = `/api/capture/${org}/${mode}/${result.id}/screenshot`;
                const domUrl = mode === 'full' ? `/api/capture/${org}/${mode}/${result.id}/dom` : null;
                updatePreviewPanes({
                    ...result,
                    screenshotUrl,
                    domUrl
                });

                // Reload lists
                loadCaptures();
                if (mode === 'journey') {
                    loadSessions(); // May have saved a session
                }
            } else {
                setStatus(`Error: ${result.error}`, 'error');
            }
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        } finally {
            captureBtn.disabled = false;
        }
    }

    async function loadCaptures() {
        try {
            const res = await fetch(`/api/capture/list?org=${org}`);
            const captures = await res.json();

            if (captures.length === 0) {
                capturesList.innerHTML = '<div class="empty-state">No captures yet</div>';
                return;
            }

            capturesList.innerHTML = captures.map(c => `
                <div class="capture-item" data-id="${c.id}" data-mode="${c.mode}" data-url="${escapeAttr(c.url || '')}">
                    <div class="url">${escapeHtml(c.url || c.title || c.id)}</div>
                    <div class="meta">
                        <span class="mode-badge">${c.mode}</span>
                        <span>${formatTime(c.timestamp)}</span>
                    </div>
                    <div class="actions">
                        <button class="use-capture" data-id="${c.id}" data-mode="${c.mode}" data-url="${escapeAttr(c.url || '')}">Use</button>
                        <button class="delete delete-capture" data-id="${c.id}" data-mode="${c.mode}">Delete</button>
                    </div>
                </div>
            `).join('');

            // Attach click handlers for selecting capture
            capturesList.querySelectorAll('.capture-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Don't select if clicking buttons
                    if (e.target.tagName === 'BUTTON') return;
                    selectCapture(item.dataset.id, item.dataset.mode, item.dataset.url);
                });
            });

            // Use button handlers - populate URL or journey steps
            capturesList.querySelectorAll('.use-capture').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const mode = btn.dataset.mode;
                    const id = btn.dataset.id;
                    const url = btn.dataset.url;

                    if (mode === 'journey') {
                        // Load journey steps from the manifest
                        try {
                            const res = await fetch(`/api/capture/${org}/${mode}/${id}`);
                            const manifest = await res.json();
                            if (manifest.steps) {
                                // Extract step definitions (action/url/selector/value/name/ms)
                                journeySteps = manifest.steps.map(s => {
                                    const step = { action: s.action };
                                    if (s.url) step.url = s.url;
                                    if (s.selector) step.selector = s.selector;
                                    if (s.value) step.value = s.value;
                                    if (s.sessionSaved) step.name = s.sessionSaved;
                                    if (s.ms) step.ms = s.ms;
                                    return step;
                                });
                                renderSteps();
                                modeSelect.value = 'journey';
                                journeyBuilder.classList.add('active');
                                resizeHandle.classList.add('visible');
                                setStatus(`Loaded ${journeySteps.length} steps from journey`, 'success');
                            }
                        } catch (e) {
                            setStatus('Error loading journey: ' + e.message, 'error');
                        }
                    } else {
                        // For quick/full/extract, populate URL
                        if (url) {
                            urlInput.value = url;
                            modeSelect.value = mode;
                            journeyBuilder.classList.remove('active');
                            resizeHandle.classList.remove('visible');
                            setStatus(`URL ready: ${url}`, 'success');
                        }
                    }
                });
            });

            // Delete button handlers with in-place confirm
            capturesList.querySelectorAll('.delete-capture').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (btn.classList.contains('confirm')) {
                        // Second click - delete
                        await deleteCapture(btn.dataset.id, btn.dataset.mode);
                    } else {
                        // First click - show confirm state
                        btn.classList.add('confirm');
                        btn.textContent = 'del?';
                        // Reset after 2 seconds if not clicked
                        setTimeout(() => {
                            btn.classList.remove('confirm');
                            btn.textContent = 'Delete';
                        }, 2000);
                    }
                });
            });
        } catch (e) {
            capturesList.innerHTML = `<div class="empty-state">Error loading captures</div>`;
        }
    }

    async function deleteCapture(id, mode) {
        try {
            const res = await fetch(`/api/capture/${org}/${mode}/${id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.deleted) {
                setStatus(`Deleted capture: ${id}`, 'success');
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

            // Update dropdown
            sessionSelect.innerHTML = '<option value="">No Session</option>';
            sessions.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.textContent = s.name;
                sessionSelect.appendChild(opt);
            });

            // Update list
            if (sessions.length === 0) {
                sessionsList.innerHTML = '<div class="empty-state">No saved sessions<br><small>Use Journey mode with saveSession action</small></div>';
                return;
            }

            sessionsList.innerHTML = sessions.map(s => `
                <div class="session-item" data-name="${s.name}">
                    <div class="name">${s.name}</div>
                    <div class="meta">
                        <span>${s.targetUrl || 'Unknown URL'}</span>
                    </div>
                    <div class="meta">
                        <span>Created: ${formatTime(s.created)}</span>
                    </div>
                    <div class="actions">
                        <button class="use-session" data-name="${s.name}">Use</button>
                        <button class="delete delete-session" data-name="${s.name}">Delete</button>
                    </div>
                </div>
            `).join('');

            // Attach click handlers for selecting session
            sessionsList.querySelectorAll('.session-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    selectSession(item.dataset.name);
                });
            });

            // Use button handlers
            sessionsList.querySelectorAll('.use-session').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    sessionSelect.value = btn.dataset.name;
                    sessionSelect.dispatchEvent(new Event('change'));
                    setStatus(`Using session: ${btn.dataset.name}`, 'success');
                });
            });

            sessionsList.querySelectorAll('.delete-session').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (btn.classList.contains('confirm')) {
                        await deleteSession(btn.dataset.name);
                    } else {
                        btn.classList.add('confirm');
                        btn.textContent = 'del?';
                        setTimeout(() => {
                            btn.classList.remove('confirm');
                            btn.textContent = 'Delete';
                        }, 2000);
                    }
                });
            });
        } catch (e) {
            sessionsList.innerHTML = `<div class="empty-state">Error loading sessions</div>`;
        }
    }

    async function selectSession(name) {
        try {
            const res = await fetch(`/api/capture/sessions/${org}/${name}/state`);
            currentSession = await res.json();
            currentCapture = null; // Clear capture selection

            // Highlight selected
            sessionsList.querySelectorAll('.session-item').forEach(item => {
                item.classList.toggle('active', item.dataset.name === name);
            });
            capturesList.querySelectorAll('.capture-item').forEach(item => {
                item.classList.remove('active');
            });

            // Clear preview - show session info
            previewScreenshot.innerHTML = `<div class="placeholder">Session: ${name}</div>`;
            previewDom.querySelector('.preview-code').textContent = '(session selected - no DOM)';
            previewText.querySelector('.preview-code').textContent = '(session selected - no text)';
            previewMeta.querySelector('.preview-code').textContent = JSON.stringify(currentSession, null, 2);
            captureId.textContent = name;

            // Show session details
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

        // Cookies section
        html += `<div class="session-section">`;
        html += `<div class="session-section-header">Cookies (${cookies.length})</div>`;
        if (cookies.length === 0) {
            html += '<div class="empty-state">No cookies</div>';
        } else {
            html += '<div class="cookie-list">';
            cookies.forEach(c => {
                const expires = c.expires > 0
                    ? new Date(c.expires * 1000).toLocaleDateString()
                    : 'Session';
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

        // LocalStorage section
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

    async function selectCapture(id, mode, captureUrl) {
        try {
            const res = await fetch(`/api/capture/${org}/${mode}/${id}`);
            currentCapture = await res.json();
            currentSession = null; // Clear session selection

            // Highlight selected
            capturesList.querySelectorAll('.capture-item').forEach(item => {
                item.classList.toggle('active', item.dataset.id === id);
            });
            sessionsList.querySelectorAll('.session-item').forEach(item => {
                item.classList.remove('active');
            });

            // Build URLs for resources
            const screenshotUrl = `/api/capture/${org}/${mode}/${id}/screenshot`;
            const domUrl = mode === 'full' ? `/api/capture/${org}/${mode}/${id}/dom` : null;

            // Update preview panes
            captureId.textContent = id;
            updatePreviewPanes({
                ...currentCapture,
                screenshotUrl,
                domUrl
            });

            // Populate URL input for easy redo
            const urlToUse = captureUrl || currentCapture.url || currentCapture.finalUrl;
            if (urlToUse) {
                urlInput.value = urlToUse;
            }

            // Set mode to match
            if (mode && modeSelect.querySelector(`option[value="${mode}"]`)) {
                modeSelect.value = mode;
                const isJourney = mode === 'journey';
                journeyBuilder.classList.toggle('active', isJourney);
                resizeHandle.classList.toggle('visible', isJourney);
            }

            // Show details in sidebar
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
                    // Journey results
                    content = currentCapture.steps.map((s, i) =>
                        `${i + 1}. ${s.action} ${s.success ? '✓' : '✗'} ${s.state?.url || ''}`
                    ).join('\n');
                } else {
                    content = JSON.stringify(currentCapture.structure || {}, null, 2);
                }
                break;
            case 'meta':
                const meta = { ...currentCapture };
                delete meta.textContent;
                delete meta.structure;
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

    init();
})();
