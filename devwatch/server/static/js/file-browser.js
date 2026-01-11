/**
 * FileBrowser v2 - Bookmark-First Context Builder
 * Supports bookmarks, spans, tabbed view, and QA integration
 */
const FileBrowser = (function() {
    'use strict';

    const STORAGE_KEY = 'devwatch_filebrowser_v2';
    const VERSION = 2;

    // ═══════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════

    function createDefaultState() {
        return {
            _version: VERSION,
            _lastSaved: null,

            // Bookmarks - primary organizing concept
            bookmarks: {},
            activeBookmarkId: null,

            // Navigation - per-root browsing state
            navigation: {
                currentRoot: 'pd',
                roots: {}
            },

            // UI state (transient, partially persisted)
            ui: {
                activeTab: 'preview',
                leftMode: 'browse',  // 'bookmark' or 'browse'
                qa: {
                    prompt: '',
                    channel: 'db',
                    isSubmitting: false,
                    lastResponse: null,
                    history: []
                }
            }
        };
    }

    function loadState() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                // Check for v1 data to migrate
                return migrateV1ToV2();
            }
            const parsed = JSON.parse(stored);
            if (parsed._version !== VERSION) {
                return migrateV1ToV2();
            }
            return parsed;
        } catch (e) {
            console.warn('[FileBrowser] Failed to load state:', e);
            return createDefaultState();
        }
    }

    function migrateV1ToV2() {
        const newState = createDefaultState();

        try {
            // Migrate navigation contexts
            const oldContexts = localStorage.getItem('pja_filebrowser_contexts');
            if (oldContexts) {
                newState.navigation.roots = JSON.parse(oldContexts);
            }

            // Migrate savedContexts → bookmarks
            const oldSavedContexts = localStorage.getItem('pja_filebrowser_savedcontexts');
            if (oldSavedContexts) {
                const contexts = JSON.parse(oldSavedContexts);
                for (const ctx of contexts) {
                    const items = [];

                    // Convert files
                    for (const f of (ctx.files || [])) {
                        items.push({
                            type: 'file',
                            ref: { root: f.root, path: f.path },
                            enabled: true
                        });
                    }

                    // Convert spans
                    for (const s of (ctx.spans || [])) {
                        items.push({
                            type: 'span',
                            ref: { root: s.root, path: s.path, lines: s.lines },
                            content: s.content,
                            enabled: true
                        });
                    }

                    // Use new bookmark ID format
                    const bmId = ctx.id.replace('ctx_', 'bm_');
                    newState.bookmarks[bmId] = {
                        id: bmId,
                        name: ctx.name,
                        items,
                        created: ctx.created,
                        lastUsed: ctx.lastUsed,
                        useCount: ctx.useCount || 0
                    };
                }
            }

            // Clean up old keys after successful migration
            localStorage.removeItem('pja_filebrowser_contexts');
            localStorage.removeItem('pja_filebrowser_selected');
            localStorage.removeItem('pja_filebrowser_spans');
            localStorage.removeItem('pja_filebrowser_savedcontexts');

            console.log('[FileBrowser] Migrated from v1 to v2');
        } catch (e) {
            console.warn('[FileBrowser] Migration failed:', e);
        }

        return newState;
    }

    function saveState(state) {
        try {
            state._lastSaved = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('[FileBrowser] Failed to save state:', e);
        }
    }

    // ═══════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════

    function itemKey(item) {
        if (item.type === 'file') {
            return `${item.ref.root}:${item.ref.path}`;
        }
        return `${item.ref.root}:${item.ref.path}::${item.ref.lines.start},${item.ref.lines.end}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Estimate tokens (~4 chars per token for English text)
    function estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    function formatTokens(count) {
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
        return count.toString();
    }

    function getLineNumbers(text, startOffset, endOffset) {
        const lines = text.split('\n');
        let charCount = 0;
        let startLine = 1, endLine = 1;

        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1;
            if (charCount + lineLength > startOffset && startLine === 1) {
                startLine = i + 1;
            }
            if (charCount + lineLength >= endOffset) {
                endLine = i + 1;
                break;
            }
            charCount += lineLength;
        }

        return { startLine, endLine };
    }

    // ═══════════════════════════════════════════
    // MAIN COMPONENT
    // ═══════════════════════════════════════════

    function create(containerSelector, options = {}) {
        const container = typeof containerSelector === 'string'
            ? document.querySelector(containerSelector)
            : containerSelector;

        if (!container) {
            console.error('[FileBrowser] Container not found:', containerSelector);
            return null;
        }

        const config = {
            apiBase: '/api/docs',
            qaApiBase: '/api/qa',
            onSelect: () => {},
            onContextChange: () => {},
            ...options
        };

        // Load persisted state
        const state = loadState();

        // Runtime state (not persisted)
        const runtime = {
            roots: [],
            files: [],
            fileContent: null,
            isLoading: false
        };

        let elements = {};
        let saveTimeout = null;

        // Debounced save
        function scheduleSave() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => saveState(state), 500);
        }

        // ═══════════════════════════════════════════
        // BOOKMARK CRUD
        // ═══════════════════════════════════════════

        function createBookmark(name) {
            const id = 'bm_' + Date.now();
            state.bookmarks[id] = {
                id,
                name,
                items: [],
                created: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                useCount: 0
            };
            state.activeBookmarkId = id;
            scheduleSave();
            render();
            return id;
        }

        function renameBookmark(id, name) {
            if (state.bookmarks[id]) {
                state.bookmarks[id].name = name;
                scheduleSave();
                render();
            }
        }

        function deleteBookmark(id) {
            if (state.bookmarks[id]) {
                delete state.bookmarks[id];
                if (state.activeBookmarkId === id) {
                    state.activeBookmarkId = null;
                }
                scheduleSave();
                render();
            }
        }

        function setActiveBookmark(id) {
            if (id && state.bookmarks[id]) {
                state.bookmarks[id].lastUsed = new Date().toISOString();
                state.bookmarks[id].useCount++;
            }
            state.activeBookmarkId = id;
            state.ui.leftMode = id ? 'bookmark' : 'browse';
            scheduleSave();
            render();
        }

        function addItemToBookmark(item) {
            const bmId = state.activeBookmarkId;
            if (!bmId || !state.bookmarks[bmId]) {
                // Create new bookmark with default name, then add item
                const newId = createBookmark('New Bookmark');
                state.bookmarks[newId].items.push(item);
                scheduleSave();
                render();
                // Focus the name input so user can rename
                setTimeout(() => {
                    if (elements.bookmarkName) {
                        elements.bookmarkName.select();
                        elements.bookmarkName.focus();
                    }
                }, 50);
                config.onContextChange(getEnabledItems());
                return;
            }

            const key = itemKey(item);
            const existing = state.bookmarks[bmId].items.find(i => itemKey(i) === key);
            if (existing) {
                return; // Silently ignore duplicates
            }

            state.bookmarks[bmId].items.push(item);
            scheduleSave();
            render();
            config.onContextChange(getEnabledItems());
        }

        function removeItemFromBookmark(key) {
            const bmId = state.activeBookmarkId;
            if (!bmId || !state.bookmarks[bmId]) return;

            state.bookmarks[bmId].items = state.bookmarks[bmId].items.filter(i => itemKey(i) !== key);
            scheduleSave();
            render();
            config.onContextChange(getEnabledItems());
        }

        function toggleItemEnabled(key) {
            const bmId = state.activeBookmarkId;
            if (!bmId || !state.bookmarks[bmId]) return;

            const item = state.bookmarks[bmId].items.find(i => itemKey(i) === key);
            if (item) {
                item.enabled = !item.enabled;
                scheduleSave();
                render();
                config.onContextChange(getEnabledItems());
            }
        }

        function getEnabledItems() {
            const bmId = state.activeBookmarkId;
            if (!bmId || !state.bookmarks[bmId]) return [];
            return state.bookmarks[bmId].items.filter(i => i.enabled);
        }

        function getActiveBookmark() {
            return state.activeBookmarkId ? state.bookmarks[state.activeBookmarkId] : null;
        }

        // ═══════════════════════════════════════════
        // NAVIGATION
        // ═══════════════════════════════════════════

        function getCurrentNavContext() {
            const root = state.navigation.currentRoot;
            if (!state.navigation.roots[root]) {
                state.navigation.roots[root] = { currentPath: '', scrollTop: 0 };
            }
            return state.navigation.roots[root];
        }

        function switchRoot(rootId) {
            const ctx = getCurrentNavContext();
            if (elements.fileList) {
                ctx.scrollTop = elements.fileList.scrollTop;
            }
            state.navigation.currentRoot = rootId;
            scheduleSave();
            loadDirectory(getCurrentNavContext().currentPath || '');
        }

        async function loadDirectory(path) {
            runtime.isLoading = true;
            const ctx = getCurrentNavContext();
            ctx.currentPath = path;

            try {
                const response = await fetch(
                    `${config.apiBase}/browse?root=${state.navigation.currentRoot}&path=${encodeURIComponent(path)}`
                );
                const data = await response.json();

                if (data.error) {
                    if (elements.fileList) {
                        elements.fileList.innerHTML = `<div class="fb-error">${data.error}</div>`;
                    }
                    return;
                }

                runtime.files = data.files || [];
                scheduleSave();
                renderFileList();
                renderBreadcrumb(path);

                if (elements.pathDisplay) {
                    elements.pathDisplay.textContent = data.basePath || state.navigation.currentRoot;
                }
            } catch (error) {
                if (elements.fileList) {
                    elements.fileList.innerHTML = `<div class="fb-error">Failed to load: ${error.message}</div>`;
                }
            } finally {
                runtime.isLoading = false;
            }
        }

        async function loadFile(path) {
            const ctx = getCurrentNavContext();
            ctx.selectedFile = path;
            scheduleSave();

            try {
                const response = await fetch(
                    `${config.apiBase}/file?root=${state.navigation.currentRoot}&path=${encodeURIComponent(path)}`
                );
                const data = await response.json();

                if (data.error) {
                    if (elements.tabContent) {
                        elements.tabContent.innerHTML = `<div class="fb-error">${data.error}</div>`;
                    }
                    return;
                }

                runtime.fileContent = data;
                renderTabContent();
                config.onSelect({ root: state.navigation.currentRoot, path, content: data.content });
            } catch (error) {
                if (elements.tabContent) {
                    elements.tabContent.innerHTML = `<div class="fb-error">Failed to load: ${error.message}</div>`;
                }
            }
        }

        // ═══════════════════════════════════════════
        // SPAN SELECTION
        // ═══════════════════════════════════════════

        function addSpanFromSelection() {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                alert('Select text in the content pane first');
                return;
            }

            const selectedText = selection.toString().trim();
            if (!selectedText) return;

            const ctx = getCurrentNavContext();
            if (!ctx.selectedFile || !runtime.fileContent) {
                alert('No file loaded');
                return;
            }

            const fullContent = runtime.fileContent.content;
            const textContent = elements.tabContent?.textContent || '';
            const startOffset = textContent.indexOf(selectedText);
            const endOffset = startOffset + selectedText.length;

            const { startLine, endLine } = getLineNumbers(fullContent, startOffset, endOffset);

            const item = {
                type: 'span',
                ref: {
                    root: state.navigation.currentRoot,
                    path: ctx.selectedFile,
                    lines: { start: startLine, end: endLine }
                },
                content: selectedText,
                enabled: true
            };

            addItemToBookmark(item);
            selection.removeAllRanges();
        }

        // ═══════════════════════════════════════════
        // CONTEXT BUILDING
        // ═══════════════════════════════════════════

        async function buildContext(format = 'multicat') {
            const enabledItems = getEnabledItems();
            const parts = [];

            for (const item of enabledItems) {
                if (item.type === 'file') {
                    try {
                        const response = await fetch(
                            `${config.apiBase}/file?root=${item.ref.root}&path=${encodeURIComponent(item.ref.path)}`
                        );
                        const data = await response.json();

                        if (!data.error) {
                            if (format === 'multicat') {
                                const pathParts = item.ref.path.split('/');
                                const filename = pathParts.pop();
                                const dir = pathParts.length > 0 ? './' + pathParts.join('/') : '.';
                                parts.push(
                                    `#MULTICAT_START\n` +
                                    `# dir: ${dir}\n` +
                                    `# file: ${filename}\n` +
                                    `# span: full\n` +
                                    `#MULTICAT_END\n` +
                                    data.content
                                );
                            } else {
                                const ext = item.ref.path.split('.').pop() || 'txt';
                                parts.push(`## ${item.ref.path}\n\`\`\`${ext}\n${data.content}\n\`\`\``);
                            }
                        }
                    } catch (e) {
                        parts.push(`# Error loading: ${item.ref.path}`);
                    }
                } else {
                    // Span
                    if (format === 'multicat') {
                        const pathParts = item.ref.path.split('/');
                        const filename = pathParts.pop();
                        const dir = pathParts.length > 0 ? './' + pathParts.join('/') : '.';
                        parts.push(
                            `#MULTICAT_START\n` +
                            `# dir: ${dir}\n` +
                            `# file: ${filename}\n` +
                            `# span: lines=${item.ref.lines.start}:${item.ref.lines.end}\n` +
                            `#MULTICAT_END\n` +
                            item.content
                        );
                    } else {
                        const ext = item.ref.path.split('.').pop() || 'txt';
                        parts.push(
                            `## ${item.ref.path}::${item.ref.lines.start},${item.ref.lines.end}\n` +
                            `\`\`\`${ext}\n${item.content}\n\`\`\``
                        );
                    }
                }
            }

            return parts.join('\n\n');
        }

        async function copyToClipboard() {
            const format = elements.formatSelect?.value || 'multicat';
            const context = await buildContext(format);

            try {
                await navigator.clipboard.writeText(context);
                if (elements.copyBtn) {
                    elements.copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        elements.copyBtn.textContent = 'Copy';
                    }, 2000);
                }
            } catch (e) {
                console.error('[FileBrowser] Copy failed:', e);
            }
        }

        // ═══════════════════════════════════════════
        // QA INTEGRATION
        // ═══════════════════════════════════════════

        async function submitToQA() {
            const prompt = state.ui.qa.prompt.trim();
            if (!prompt) {
                alert('Enter a prompt');
                return;
            }

            state.ui.qa.isSubmitting = true;
            renderQAPane();

            try {
                const context = await buildContext('markdown');
                const response = await fetch(`${config.qaApiBase}/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        context,
                        prompt,
                        channel: state.ui.qa.channel
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'QA query failed');
                }

                state.ui.qa.lastResponse = {
                    answer: result.answer,
                    qaId: result.qaId,
                    channel: result.channel,
                    prompt,
                    timestamp: new Date().toISOString()
                };

                // Add to history
                state.ui.qa.history = [prompt, ...state.ui.qa.history.slice(0, 19)];
                state.ui.qa.prompt = '';
                scheduleSave();
            } catch (error) {
                state.ui.qa.lastResponse = { error: error.message };
            } finally {
                state.ui.qa.isSubmitting = false;
                renderQAPane();
            }
        }

        // ═══════════════════════════════════════════
        // RENDERING
        // ═══════════════════════════════════════════

        function render() {
            container.innerHTML = renderContainer();
            cacheElements();
            bindEvents();
            loadDirectory(getCurrentNavContext().currentPath || '');
            renderBookmarkItems();
            renderTabContent();
            updateFooter();
        }

        function cacheElements() {
            elements = {
                bookmarkPicker: container.querySelector('.fb-bookmark-picker'),
                bookmarkName: container.querySelector('.fb-bookmark-name'),
                bookmarkDropdown: container.querySelector('.fb-bookmark-dropdown'),
                bookmarkList: container.querySelector('.fb-bookmark-list'),
                deleteBookmarkBtn: container.querySelector('.fb-delete-bookmark'),
                rootSelect: container.querySelector('.fb-root-select'),
                addRootBtn: container.querySelector('.fb-add-root'),
                pathDisplay: container.querySelector('.fb-path'),
                breadcrumb: container.querySelector('.fb-breadcrumb'),
                leftModeToggle: container.querySelector('.fb-left-mode-toggle'),
                bookmarkItems: container.querySelector('.fb-bookmark-items'),
                fileList: container.querySelector('.fb-file-list'),
                tabBar: container.querySelector('.fb-tab-bar'),
                tabContent: container.querySelector('.fb-tab-content'),
                addSpanBtn: container.querySelector('.fb-add-span'),
                selectionCount: container.querySelector('.fb-selection-count'),
                formatSelect: container.querySelector('.fb-format-select'),
                copyBtn: container.querySelector('.fb-copy-context')
            };
        }

        function renderContainer() {
            const sortedBookmarks = Object.values(state.bookmarks).sort((a, b) =>
                new Date(b.lastUsed) - new Date(a.lastUsed)
            );

            const bookmarkListItems = sortedBookmarks.map(bm => {
                const count = bm.items.filter(i => i.enabled).length;
                const active = bm.id === state.activeBookmarkId ? ' active' : '';
                return `<div class="fb-bm-list-item${active}" data-id="${bm.id}">${escapeHtml(bm.name)} (${count})</div>`;
            }).join('');

            const activeBm = getActiveBookmark();
            const bmName = activeBm ? activeBm.name : '';

            const rootOptions = runtime.roots.map(r => {
                const status = r.exists ? '' : ' (missing)';
                const selected = r.id === state.navigation.currentRoot ? ' selected' : '';
                return `<option value="${r.id}"${selected}>${r.name}${status}</option>`;
            }).join('');

            const leftModeBookmark = state.ui.leftMode === 'bookmark' ? ' active' : '';
            const leftModeBrowse = state.ui.leftMode === 'browse' ? ' active' : '';

            return `
                <div class="fb-topbar">
                    <div class="fb-topbar-left">
                        <div class="fb-bookmark-picker">
                            <input type="text" class="fb-bookmark-name" placeholder="New bookmark..." value="${escapeHtml(bmName)}">
                            <button class="fb-bookmark-dropdown" title="Select bookmark">▼</button>
                            <div class="fb-bookmark-list" style="display:none">
                                ${bookmarkListItems || '<div class="fb-bm-list-empty">No bookmarks yet</div>'}
                            </div>
                        </div>
                        <button class="fb-delete-bookmark" title="Delete bookmark" style="display:${state.activeBookmarkId ? 'inline-block' : 'none'}">×</button>
                    </div>
                    <div class="fb-topbar-center">
                        <span class="fb-path">Loading...</span>
                    </div>
                    <div class="fb-topbar-right">
                        <select class="fb-root-select">${rootOptions}</select>
                        <button class="fb-add-root" title="Add root">+</button>
                    </div>
                </div>
                <div class="fb-breadcrumb"></div>
                <div class="fb-body">
                    <div class="fb-left-panel">
                        <div class="fb-left-mode-toggle">
                            <button class="fb-mode-btn${leftModeBookmark}" data-mode="bookmark">Bookmark</button>
                            <button class="fb-mode-btn${leftModeBrowse}" data-mode="browse">Browse</button>
                        </div>
                        <div class="fb-bookmark-items" style="display:${state.ui.leftMode === 'bookmark' ? 'block' : 'none'}">
                            <div class="fb-empty">No bookmark selected</div>
                        </div>
                        <div class="fb-file-list" style="display:${state.ui.leftMode === 'browse' ? 'block' : 'none'}">
                            <div class="fb-empty">Loading...</div>
                        </div>
                    </div>
                    <div class="fb-right-panel">
                        <div class="fb-tab-bar">
                            <button class="fb-tab${state.ui.activeTab === 'preview' ? ' active' : ''}" data-tab="preview">Preview</button>
                            <button class="fb-tab${state.ui.activeTab === 'aggregate' ? ' active' : ''}" data-tab="aggregate">Aggregate</button>
                            <button class="fb-tab${state.ui.activeTab === 'multicat' ? ' active' : ''}" data-tab="multicat">MULTICAT</button>
                            <button class="fb-tab${state.ui.activeTab === 'qa' ? ' active' : ''}" data-tab="qa">QA</button>
                            <button class="fb-add-span" title="Add selected text as span">+ Span</button>
                        </div>
                        <div class="fb-tab-content">
                            <div class="fb-empty">Select a file to preview</div>
                        </div>
                    </div>
                </div>
                <div class="fb-footer">
                    <span class="fb-selection-count">Nothing selected</span>
                    <div class="fb-footer-actions">
                        <select class="fb-format-select">
                            <option value="multicat">MULTICAT</option>
                            <option value="markdown">Markdown</option>
                        </select>
                        <button class="fb-copy-context">Copy</button>
                    </div>
                </div>
            `;
        }

        function renderBookmarkItems() {
            if (!elements.bookmarkItems) return;

            const bm = getActiveBookmark();
            if (!bm || bm.items.length === 0) {
                elements.bookmarkItems.innerHTML = '<div class="fb-empty">No items in bookmark</div>';
                return;
            }

            elements.bookmarkItems.innerHTML = bm.items.map(item => {
                const key = itemKey(item);
                const checked = item.enabled ? ' checked' : '';
                const icon = item.type === 'file' ? '📄' : '📏';
                const label = item.type === 'file'
                    ? item.ref.path
                    : `${item.ref.path}::${item.ref.lines.start}-${item.ref.lines.end}`;
                const preview = item.type === 'span' ? escapeHtml(item.content.slice(0, 30) + '...') : '';

                return `
                    <div class="fb-bm-item" data-key="${key}">
                        <input type="checkbox" class="fb-bm-toggle"${checked}>
                        <span class="fb-bm-icon">${icon}</span>
                        <span class="fb-bm-label">${label}</span>
                        ${preview ? `<span class="fb-bm-preview">${preview}</span>` : ''}
                        <button class="fb-bm-remove" title="Remove">×</button>
                    </div>
                `;
            }).join('');
        }

        function renderFileList() {
            if (!elements.fileList) return;

            if (!runtime.files || runtime.files.length === 0) {
                elements.fileList.innerHTML = '<div class="fb-empty">No files found</div>';
                return;
            }

            const sorted = [...runtime.files].sort((a, b) => {
                if (a.isDir !== b.isDir) return b.isDir - a.isDir;
                return a.name.localeCompare(b.name);
            });

            const ctx = getCurrentNavContext();
            const bm = getActiveBookmark();
            const bmKeys = bm ? new Set(bm.items.map(itemKey)) : new Set();

            elements.fileList.innerHTML = sorted.map(file => {
                const icon = file.isDir ? '📁' : '📄';
                const isActive = file.path === ctx.selectedFile ? ' active' : '';
                const key = `${state.navigation.currentRoot}:${file.path}`;
                const inBookmark = bmKeys.has(key);

                return `
                    <div class="fb-file-item${file.isDir ? ' is-dir' : ''}${isActive}"
                         data-path="${file.path}" data-isdir="${file.isDir}">
                        <span class="fb-icon">${icon}</span>
                        <span class="fb-name">${file.name}</span>
                        ${!file.isDir ? `<button class="fb-add-to-bm${inBookmark ? ' in-bm' : ''}" title="${inBookmark ? 'In bookmark' : 'Add to bookmark'}">+</button>` : ''}
                    </div>
                `;
            }).join('');
        }

        function renderBreadcrumb(path) {
            if (!elements.breadcrumb) return;

            const parts = path.split('/').filter(p => p);
            let html = '<span class="fb-breadcrumb-item" data-path="">root</span>';
            let pathSoFar = '';

            parts.forEach(part => {
                pathSoFar += (pathSoFar ? '/' : '') + part;
                html += `<span class="fb-breadcrumb-sep">/</span>`;
                html += `<span class="fb-breadcrumb-item" data-path="${pathSoFar}">${part}</span>`;
            });

            elements.breadcrumb.innerHTML = html;
        }

        function renderTabContent() {
            if (!elements.tabContent) return;

            switch (state.ui.activeTab) {
                case 'preview':
                    renderPreviewPane();
                    break;
                case 'aggregate':
                    renderAggregatePane();
                    break;
                case 'multicat':
                    renderMulticatPane();
                    break;
                case 'qa':
                    renderQAPane();
                    break;
            }
        }

        function renderPreviewPane() {
            const bm = getActiveBookmark();

            // If bookmark is selected, show statistics
            if (bm) {
                renderBookmarkStats();
                return;
            }

            // Otherwise show file preview
            if (!runtime.fileContent) {
                elements.tabContent.innerHTML = '<div class="fb-empty">Select a file to preview</div>';
                return;
            }

            const ext = runtime.fileContent.name.split('.').pop();
            if (ext === 'md' && typeof marked !== 'undefined') {
                elements.tabContent.innerHTML = `<div class="fb-preview">${marked.parse(runtime.fileContent.content)}</div>`;
            } else {
                elements.tabContent.innerHTML = `<div class="fb-preview"><pre><code>${escapeHtml(runtime.fileContent.content)}</code></pre></div>`;
            }
        }

        async function renderBookmarkStats() {
            const bm = getActiveBookmark();
            if (!bm) return;

            const enabled = bm.items.filter(i => i.enabled);
            const files = enabled.filter(i => i.type === 'file');
            const spans = enabled.filter(i => i.type === 'span');

            // Show loading state with current counts
            elements.tabContent.innerHTML = `
                <div class="fb-stats-pane">
                    <div class="fb-stats-token-display">
                        <span class="fb-stats-token-count">...</span>
                        <span class="fb-stats-token-label">est. tokens</span>
                    </div>
                    <div class="fb-stats-loading">Calculating...</div>
                </div>
            `;

            // Calculate actual content size
            let totalChars = 0;
            let totalLines = 0;
            const fileDetails = [];

            for (const item of enabled) {
                if (item.type === 'file') {
                    try {
                        const response = await fetch(
                            `${config.apiBase}/file?root=${item.ref.root}&path=${encodeURIComponent(item.ref.path)}`
                        );
                        const data = await response.json();
                        if (!data.error && data.content) {
                            const chars = data.content.length;
                            const lines = data.content.split('\n').length;
                            totalChars += chars;
                            totalLines += lines;
                            fileDetails.push({
                                path: item.ref.path,
                                chars,
                                lines,
                                tokens: estimateTokens(data.content)
                            });
                        }
                    } catch (e) {
                        fileDetails.push({ path: item.ref.path, error: true });
                    }
                } else {
                    // Span - use cached content
                    const chars = item.content?.length || 0;
                    const lines = item.content?.split('\n').length || 0;
                    totalChars += chars;
                    totalLines += lines;
                    fileDetails.push({
                        path: `${item.ref.path}::${item.ref.lines.start}-${item.ref.lines.end}`,
                        chars,
                        lines,
                        tokens: estimateTokens(item.content),
                        isSpan: true
                    });
                }
            }

            const totalTokens = Math.ceil(totalChars / 4);

            // Render full stats
            elements.tabContent.innerHTML = `
                <div class="fb-stats-pane">
                    <div class="fb-stats-token-display">
                        <span class="fb-stats-token-count">${formatTokens(totalTokens)}</span>
                        <span class="fb-stats-token-label">est. tokens</span>
                    </div>
                    <div class="fb-stats-summary">
                        <div class="fb-stats-row">
                            <span class="fb-stats-label">Files</span>
                            <span class="fb-stats-value">${files.length}</span>
                        </div>
                        <div class="fb-stats-row">
                            <span class="fb-stats-label">Spans</span>
                            <span class="fb-stats-value">${spans.length}</span>
                        </div>
                        <div class="fb-stats-row">
                            <span class="fb-stats-label">Total Lines</span>
                            <span class="fb-stats-value">${totalLines.toLocaleString()}</span>
                        </div>
                        <div class="fb-stats-row">
                            <span class="fb-stats-label">Total Chars</span>
                            <span class="fb-stats-value">${totalChars.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="fb-stats-breakdown">
                        <h4>Breakdown</h4>
                        ${fileDetails.map(f => `
                            <div class="fb-stats-file ${f.isSpan ? 'is-span' : ''} ${f.error ? 'has-error' : ''}">
                                <span class="fb-stats-file-path">${f.isSpan ? '📏' : '📄'} ${escapeHtml(f.path)}</span>
                                ${f.error ? '<span class="fb-stats-file-error">Error</span>' :
                                    `<span class="fb-stats-file-tokens">${formatTokens(f.tokens)} tokens</span>`}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        async function renderAggregatePane() {
            const enabledItems = getEnabledItems();
            if (enabledItems.length === 0) {
                elements.tabContent.innerHTML = '<div class="fb-empty">No items enabled in bookmark</div>';
                return;
            }

            elements.tabContent.innerHTML = '<div class="fb-loading">Building context...</div>';
            const content = await buildContext('markdown');
            elements.tabContent.innerHTML = `<div class="fb-aggregate"><pre>${escapeHtml(content)}</pre></div>`;
        }

        async function renderMulticatPane() {
            const enabledItems = getEnabledItems();
            if (enabledItems.length === 0) {
                elements.tabContent.innerHTML = '<div class="fb-empty">No items enabled in bookmark</div>';
                return;
            }

            elements.tabContent.innerHTML = '<div class="fb-loading">Building MULTICAT...</div>';
            const content = await buildContext('multicat');
            elements.tabContent.innerHTML = `<div class="fb-multicat"><pre>${escapeHtml(content)}</pre></div>`;
        }

        function renderQAPane() {
            const qa = state.ui.qa;
            const hasResponse = qa.lastResponse && !qa.lastResponse.error;
            const hasError = qa.lastResponse && qa.lastResponse.error;

            elements.tabContent.innerHTML = `
                <div class="fb-qa-pane">
                    <div class="fb-qa-input-section">
                        <div class="fb-qa-channel">
                            <label>Channel:</label>
                            <select class="fb-qa-channel-select">
                                <option value="db"${qa.channel === 'db' ? ' selected' : ''}>db (main)</option>
                                <option value="1"${qa.channel === '1' ? ' selected' : ''}>1</option>
                                <option value="2"${qa.channel === '2' ? ' selected' : ''}>2</option>
                                <option value="3"${qa.channel === '3' ? ' selected' : ''}>3</option>
                                <option value="4"${qa.channel === '4' ? ' selected' : ''}>4</option>
                            </select>
                        </div>
                        <textarea class="fb-qa-prompt" placeholder="Enter your question..."${qa.isSubmitting ? ' disabled' : ''}>${escapeHtml(qa.prompt)}</textarea>
                        <div class="fb-qa-actions">
                            <span class="fb-qa-context-info">${getEnabledItems().length} items in context</span>
                            <button class="fb-qa-submit"${qa.isSubmitting ? ' disabled' : ''}>${qa.isSubmitting ? 'Sending...' : 'Send to QA'}</button>
                        </div>
                    </div>
                    ${hasResponse ? `
                        <div class="fb-qa-response">
                            <div class="fb-qa-response-header">
                                Response [${qa.lastResponse.channel}/${qa.lastResponse.qaId}]
                            </div>
                            <div class="fb-qa-response-content">
                                ${typeof marked !== 'undefined' ? marked.parse(qa.lastResponse.answer) : escapeHtml(qa.lastResponse.answer)}
                            </div>
                        </div>
                    ` : ''}
                    ${hasError ? `
                        <div class="fb-qa-error">${escapeHtml(qa.lastResponse.error)}</div>
                    ` : ''}
                </div>
            `;

            // Bind QA-specific events
            const promptEl = elements.tabContent.querySelector('.fb-qa-prompt');
            if (promptEl) {
                promptEl.addEventListener('input', (e) => {
                    state.ui.qa.prompt = e.target.value;
                });
                promptEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        submitToQA();
                    }
                });
            }

            const channelEl = elements.tabContent.querySelector('.fb-qa-channel-select');
            if (channelEl) {
                channelEl.addEventListener('change', (e) => {
                    state.ui.qa.channel = e.target.value;
                });
            }

            const submitBtn = elements.tabContent.querySelector('.fb-qa-submit');
            if (submitBtn) {
                submitBtn.addEventListener('click', submitToQA);
            }
        }

        function updateFooter() {
            if (!elements.selectionCount) return;

            const bm = getActiveBookmark();
            if (!bm) {
                elements.selectionCount.textContent = 'No bookmark selected';
                return;
            }

            const enabled = bm.items.filter(i => i.enabled);
            const files = enabled.filter(i => i.type === 'file').length;
            const spans = enabled.filter(i => i.type === 'span').length;

            let text = bm.name + ': ';
            const parts = [];
            if (files > 0) parts.push(`${files} file${files !== 1 ? 's' : ''}`);
            if (spans > 0) parts.push(`${spans} span${spans !== 1 ? 's' : ''}`);
            text += parts.length > 0 ? parts.join(', ') + ' enabled' : 'nothing enabled';

            elements.selectionCount.textContent = text;
        }

        // ═══════════════════════════════════════════
        // EVENT BINDING
        // ═══════════════════════════════════════════

        function bindEvents() {
            // Bookmark name input - create or rename
            elements.bookmarkName?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const name = e.target.value.trim();
                    if (!name) return;

                    if (state.activeBookmarkId) {
                        // Rename existing bookmark
                        renameBookmark(state.activeBookmarkId, name);
                    } else {
                        // Create new bookmark
                        createBookmark(name);
                    }
                    e.target.blur();
                }
            });

            elements.bookmarkName?.addEventListener('blur', (e) => {
                const name = e.target.value.trim();
                if (name && state.activeBookmarkId) {
                    const bm = getActiveBookmark();
                    if (bm && bm.name !== name) {
                        renameBookmark(state.activeBookmarkId, name);
                    }
                }
            });

            // Bookmark dropdown toggle
            elements.bookmarkDropdown?.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = elements.bookmarkList.style.display !== 'none';
                elements.bookmarkList.style.display = isVisible ? 'none' : 'block';
            });

            // Bookmark list selection
            elements.bookmarkList?.addEventListener('click', (e) => {
                const item = e.target.closest('.fb-bm-list-item');
                if (item) {
                    setActiveBookmark(item.dataset.id);
                    elements.bookmarkList.style.display = 'none';
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (elements.bookmarkList && !elements.bookmarkPicker?.contains(e.target)) {
                    elements.bookmarkList.style.display = 'none';
                }
            });

            // Delete bookmark
            elements.deleteBookmarkBtn?.addEventListener('click', () => {
                if (state.activeBookmarkId && confirm('Delete this bookmark?')) {
                    deleteBookmark(state.activeBookmarkId);
                }
            });

            // Root selector
            elements.rootSelect?.addEventListener('change', (e) => {
                switchRoot(e.target.value);
            });

            // Add root
            elements.addRootBtn?.addEventListener('click', addCustomRoot);

            // Left mode toggle
            elements.leftModeToggle?.addEventListener('click', (e) => {
                const btn = e.target.closest('.fb-mode-btn');
                if (btn) {
                    state.ui.leftMode = btn.dataset.mode;
                    render();
                }
            });

            // Bookmark items
            elements.bookmarkItems?.addEventListener('click', (e) => {
                const item = e.target.closest('.fb-bm-item');
                if (!item) return;
                const key = item.dataset.key;

                if (e.target.classList.contains('fb-bm-toggle')) {
                    toggleItemEnabled(key);
                } else if (e.target.classList.contains('fb-bm-remove')) {
                    removeItemFromBookmark(key);
                }
            });

            // File list
            elements.fileList?.addEventListener('click', handleFileClick);

            // Breadcrumb
            elements.breadcrumb?.addEventListener('click', (e) => {
                const item = e.target.closest('.fb-breadcrumb-item');
                if (item) loadDirectory(item.dataset.path || '');
            });

            // Tab bar
            elements.tabBar?.addEventListener('click', (e) => {
                const tab = e.target.closest('.fb-tab');
                if (tab) {
                    state.ui.activeTab = tab.dataset.tab;
                    elements.tabBar.querySelectorAll('.fb-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderTabContent();
                }
            });

            // Add span
            elements.addSpanBtn?.addEventListener('click', addSpanFromSelection);

            // Copy
            elements.copyBtn?.addEventListener('click', copyToClipboard);
        }

        function handleFileClick(e) {
            const item = e.target.closest('.fb-file-item');
            if (!item) return;

            const path = item.dataset.path;
            const isDir = item.dataset.isdir === 'true';

            if (e.target.classList.contains('fb-add-to-bm')) {
                if (!e.target.classList.contains('in-bm')) {
                    addItemToBookmark({
                        type: 'file',
                        ref: { root: state.navigation.currentRoot, path },
                        enabled: true
                    });
                }
                return;
            }

            if (isDir) {
                loadDirectory(path);
            } else {
                elements.fileList.querySelectorAll('.fb-file-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                state.ui.activeTab = 'preview';
                loadFile(path);
            }
        }

        async function addCustomRoot() {
            const rootPath = prompt('Enter directory path:');
            if (!rootPath) return;

            const name = prompt('Name:', rootPath.split('/').pop() || 'custom');
            if (!name) return;

            const id = 'custom_' + Date.now();

            try {
                const response = await fetch(`${config.apiBase}/roots`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, name, path: rootPath })
                });

                const result = await response.json();
                if (!response.ok) {
                    alert(result.error || 'Failed to add root');
                    return;
                }

                runtime.roots.push(result.root);
                elements.rootSelect.value = result.root.id;
                switchRoot(result.root.id);
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }

        // ═══════════════════════════════════════════
        // INITIALIZATION
        // ═══════════════════════════════════════════

        async function init() {
            container.innerHTML = '<div class="fb-loading">Loading...</div>';

            try {
                const response = await fetch(`${config.apiBase}/roots`);
                runtime.roots = await response.json();

                if (runtime.roots.length > 0) {
                    const existingRoot = runtime.roots.find(r => r.exists);
                    if (!state.navigation.currentRoot || !runtime.roots.find(r => r.id === state.navigation.currentRoot)) {
                        state.navigation.currentRoot = existingRoot ? existingRoot.id : runtime.roots[0].id;
                    }
                }

                render();
            } catch (error) {
                container.innerHTML = `<div class="fb-error">Failed to load: ${error.message}</div>`;
            }
        }

        init();

        // Public API
        return {
            getBookmarks: () => ({ ...state.bookmarks }),
            getActiveBookmark,
            getEnabledItems,
            getContext: buildContext,
            createBookmark,
            deleteBookmark,
            setActiveBookmark,
            navigate: (root, path) => {
                if (root !== state.navigation.currentRoot) switchRoot(root);
                loadDirectory(path);
            },
            refresh: () => render(),
            destroy: () => { container.innerHTML = ''; }
        };
    }

    return { create };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileBrowser;
}
