/**
 * tut.js - Tut Editor with pill cards, form editor, live JSON, compiled preview, and vox integration
 *
 * Unified doc model: each document is one pill card combining src + compiled.
 * Right panel switches between form editor (Mode A), compiled preview (Mode B),
 * and info panel (Mode C).
 */
(function() {
    'use strict';

    var API = '/api/tut';

    // DOM refs
    var sidebar = document.getElementById('sidebar');
    var sidebarScroll = document.getElementById('sidebar-scroll');
    var toolbarOrg = document.getElementById('toolbar-org');
    var rightTitle = document.getElementById('right-title');
    var modeEmpty = document.getElementById('mode-empty');
    var modeForm = document.getElementById('mode-form');
    var modePreview = document.getElementById('mode-preview');
    var modeInfo = document.getElementById('mode-info');
    var formSide = document.getElementById('form-side');
    var jsonTextarea = document.getElementById('json-textarea');
    var jsonEditable = document.getElementById('json-editable');
    var previewFrame = document.getElementById('preview-frame');
    var formStatus = document.getElementById('form-status');
    var btnSave = document.getElementById('btn-save');
    var btnBuild = document.getElementById('btn-build');
    var btnTab = document.getElementById('btn-tab');
    var btnHome = document.getElementById('btn-home');
    var docCount = document.getElementById('doc-count');
    var statusDetail = document.getElementById('status-detail');
    var infoChain = document.getElementById('info-chain');

    var state = {
        org: 'tetra',
        env: 'local',
        docs: [],
        activeDoc: null,     // doc object from docs array
        activeMode: null,    // 'form', 'preview', 'info'
        tag: 'all',
        dirty: false,
        docData: null,       // full parsed JSON of current doc
        cleanJson: '',       // snapshot for dirty tracking
        expandedPill: null   // name of expanded pill
    };

    // ----------------------------------------------------------------
    // Init
    // ----------------------------------------------------------------

    function readParams() {
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('org')) state.org = urlParams.get('org');
        if (urlParams.get('env')) state.env = urlParams.get('env');
        toolbarOrg.textContent = state.org;
    }

    // ----------------------------------------------------------------
    // Fetch
    // ----------------------------------------------------------------

    function fetchJSON(url) {
        return fetch(url).then(function(r) { return r.json(); });
    }

    function loadDocs() {
        sidebarScroll.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-muted);font-size:10px">Loading...</div>';
        fetchJSON(API + '/' + state.org + '/docs').then(function(data) {
            state.docs = (data && data.docs) ? data.docs : [];
            renderPills();
            docCount.textContent = state.docs.length;
        }).catch(function() {
            state.docs = [];
            sidebarScroll.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-muted);font-size:10px">Failed to load</div>';
        });
    }

    // ----------------------------------------------------------------
    // Tag filter
    // ----------------------------------------------------------------

    function matchesTag(doc) {
        if (state.tag === 'all') return true;
        return doc.type === state.tag || doc.type === state.tag + 's';
    }

    // ----------------------------------------------------------------
    // Pill card rendering
    // ----------------------------------------------------------------

    function renderPills() {
        sidebarScroll.innerHTML = '';
        var filtered = state.docs.filter(matchesTag);
        filtered.forEach(function(doc) {
            var card = document.createElement('div');
            card.className = 'pill-card';
            if (state.activeDoc && state.activeDoc.name === doc.name) card.classList.add('active');
            if (state.expandedPill === doc.name) card.classList.add('expanded');
            card.dataset.name = doc.name;

            var typeClass = doc.type || '';
            var meta = doc.metadata || {};

            card.innerHTML =
                '<div class="pill-header">' +
                    '<span class="pill-name">' + doc.name + '</span>' +
                    '<span class="pill-version">' + (meta.version || '') + '</span>' +
                    '<span class="pill-type-badge ' + typeClass + '">' + (doc.type || '?') + '</span>' +
                '</div>' +
                '<div class="pill-body">' +
                    '<div class="pill-title">' + (meta.title || doc.name) + '</div>' +
                    '<div class="pill-links">' +
                        '<button class="pill-link" data-link="json">.json</button>' +
                        '<button class="pill-link' + (doc.hasCompiled ? '' : ' disabled') + '" data-link="html">.html</button>' +
                    '</div>' +
                    '<div class="pill-stats">' +
                        doc.stepCount + ' steps &middot; ' + doc.blockCount + ' blocks' +
                        (meta.difficulty ? ' &middot; ' + meta.difficulty : '') +
                    '</div>' +
                    '<div class="pill-actions">' +
                        '<button class="pill-action-btn" data-pill-action="bump">bump</button>' +
                        '<button class="pill-action-btn" data-pill-action="build">build</button>' +
                    '</div>' +
                '</div>';

            // Click header to toggle expand
            card.querySelector('.pill-header').addEventListener('click', function() {
                var wasExpanded = card.classList.contains('expanded');
                // Collapse all
                document.querySelectorAll('.pill-card.expanded').forEach(function(c) {
                    c.classList.remove('expanded');
                });
                if (!wasExpanded) {
                    card.classList.add('expanded');
                    state.expandedPill = doc.name;
                } else {
                    state.expandedPill = null;
                }
            });

            // Click .json link
            card.querySelector('[data-link="json"]').addEventListener('click', function(e) {
                e.stopPropagation();
                openFormEditor(doc);
            });

            // Click .html link
            var htmlLink = card.querySelector('[data-link="html"]');
            if (doc.hasCompiled) {
                htmlLink.addEventListener('click', function(e) {
                    e.stopPropagation();
                    openCompiledPreview(doc);
                });
            }

            // Bump button
            card.querySelector('[data-pill-action="bump"]').addEventListener('click', function(e) {
                e.stopPropagation();
                bumpVersion(doc);
            });

            // Build button
            card.querySelector('[data-pill-action="build"]').addEventListener('click', function(e) {
                e.stopPropagation();
                buildOne(doc);
            });

            sidebarScroll.appendChild(card);
        });

        if (filtered.length === 0) {
            sidebarScroll.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-muted);font-size:10px">No documents</div>';
        }

        updatePillStates();
    }

    function updatePillStates() {
        document.querySelectorAll('.pill-card').forEach(function(card) {
            var isActive = state.activeDoc && card.dataset.name === state.activeDoc.name;
            card.classList.toggle('active', isActive);

            // Highlight active link
            card.querySelectorAll('.pill-link').forEach(function(link) {
                link.classList.remove('active-link');
                if (isActive) {
                    if (state.activeMode === 'form' && link.dataset.link === 'json') link.classList.add('active-link');
                    if (state.activeMode === 'preview' && link.dataset.link === 'html') link.classList.add('active-link');
                }
            });
        });
    }

    // ----------------------------------------------------------------
    // Right panel mode switching
    // ----------------------------------------------------------------

    function setMode(mode) {
        state.activeMode = mode;
        modeEmpty.style.display = mode ? 'none' : '';
        modeForm.classList.toggle('active', mode === 'form');
        modePreview.classList.toggle('active', mode === 'preview');
        modeInfo.classList.toggle('active', mode === 'info');

        btnSave.style.display = mode === 'form' ? '' : 'none';
        btnBuild.style.display = (mode === 'form' || mode === 'preview') ? '' : 'none';
        btnTab.style.display = mode === 'preview' ? '' : 'none';
        btnHome.style.display = mode ? '' : 'none';
        formStatus.textContent = '';

        updatePillStates();
    }

    // ----------------------------------------------------------------
    // Mode A: Form Editor
    // ----------------------------------------------------------------

    function openFormEditor(doc) {
        state.activeDoc = doc;
        state.dirty = false;
        setMode('form');
        rightTitle.textContent = doc.name + '.json';
        formStatus.textContent = 'loading...';
        formStatus.className = 'form-status';

        fetch(API + '/' + state.org + '/src/' + encodeURIComponent(doc.filename))
            .then(function(r) {
                if (!r.ok) throw new Error(r.statusText);
                return r.text();
            })
            .then(function(text) {
                try {
                    state.docData = JSON.parse(text);
                } catch (e) {
                    state.docData = {};
                }
                state.cleanJson = JSON.stringify(state.docData, null, 2);
                jsonTextarea.value = state.cleanJson;
                renderForm();
                formStatus.textContent = '';
                updateStatusBar();
                updateInfoChain(doc);
            })
            .catch(function(err) {
                formStatus.textContent = 'load error: ' + err.message;
                formStatus.className = 'form-status error';
            });
    }

    function renderForm() {
        var data = state.docData;
        if (!data) { formSide.innerHTML = ''; return; }
        var meta = data.metadata || {};
        var html = '';

        // Metadata section
        html += '<div class="form-section">';
        html += '<div class="form-section-title">Metadata</div>';
        html += formRow('title', meta.title || '');
        html += formRow('subtitle', meta.subtitle || '');
        html += formRow('version', meta.version || '0.0.1');
        html += '<div class="form-row">' +
            '<span class="form-label">difficulty</span>' +
            '<select class="form-select" data-meta="difficulty">' +
                '<option value="">-</option>' +
                '<option value="beginner"' + (meta.difficulty === 'beginner' ? ' selected' : '') + '>beginner</option>' +
                '<option value="intermediate"' + (meta.difficulty === 'intermediate' ? ' selected' : '') + '>intermediate</option>' +
                '<option value="advanced"' + (meta.difficulty === 'advanced' ? ' selected' : '') + '>advanced</option>' +
            '</select></div>';
        html += formRow('estimatedTime', meta.estimatedTime || '');
        html += formRow('author', meta.author || '');
        html += '</div>';

        // Content section: steps/groups/sections
        if (Array.isArray(data.steps)) {
            html += '<div class="form-section">';
            html += '<div class="form-section-title">Steps (' + data.steps.length + ')</div>';
            data.steps.forEach(function(step, i) {
                html += renderStepCard(step, i);
            });
            html += '</div>';
        } else if (Array.isArray(data.groups)) {
            html += '<div class="form-section">';
            html += '<div class="form-section-title">Groups (' + data.groups.length + ')</div>';
            data.groups.forEach(function(group, i) {
                html += renderGroupCard(group, i);
            });
            html += '</div>';
        } else if (Array.isArray(data.sections)) {
            html += '<div class="form-section">';
            html += '<div class="form-section-title">Sections (' + data.sections.length + ')</div>';
            data.sections.forEach(function(section, i) {
                html += renderStepCard(section, i);
            });
            html += '</div>';
        }

        formSide.innerHTML = html;

        // Bind metadata inputs
        formSide.querySelectorAll('[data-meta]').forEach(function(input) {
            input.addEventListener('input', function() {
                var key = input.dataset.meta;
                if (!state.docData.metadata) state.docData.metadata = {};
                var val = input.value;
                if (key === 'estimatedTime') val = parseInt(val, 10) || 0;
                state.docData.metadata[key] = val;
                syncJsonFromData();
            });
            input.addEventListener('change', function() {
                var key = input.dataset.meta;
                if (!state.docData.metadata) state.docData.metadata = {};
                state.docData.metadata[key] = input.value;
                syncJsonFromData();
            });
        });

        // Bind step card expand
        formSide.querySelectorAll('.step-card-header').forEach(function(header) {
            header.addEventListener('click', function() {
                header.parentElement.classList.toggle('expanded');
            });
        });

        // Bind timeline editor buttons
        formSide.querySelectorAll('[data-action="open-timeline"]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var blockItem = btn.closest('.block-item');
                if (!blockItem) return;

                // Find block index within step
                var stepBody = blockItem.closest('.step-card-body');
                if (!stepBody) return;
                var items = stepBody.querySelectorAll('.block-item');
                var blockIdx = Array.prototype.indexOf.call(items, blockItem);

                var stepCard = stepBody.closest('.step-card');
                var stepCards = formSide.querySelectorAll('.step-card');
                var stepIdx = Array.prototype.indexOf.call(stepCards, stepCard);

                var steps = state.docData.steps || state.docData.sections || [];
                var step = steps[stepIdx];
                if (!step) return;
                var block = (step.content || [])[blockIdx];
                if (!block || !block.vox) return;

                // Toggle: close if already open
                var existing = blockItem.nextElementSibling;
                if (existing && existing.classList.contains('timeline-editor')) {
                    existing.remove();
                    return;
                }

                var editorDiv = document.createElement('div');
                blockItem.parentElement.insertBefore(editorDiv, blockItem.nextSibling);

                var audioUrl = '/api/vox/db/' + block.vox.docId + '/audio';
                window.TimelineEditor.create(editorDiv, {
                    audioUrl: audioUrl,
                    text: block.text || '',
                    timeline: block.timeline || [],
                    onChange: function(timeline) {
                        block.timeline = timeline;
                        syncJsonFromData();
                    }
                });
            });
        });
    }

    function formRow(key, value) {
        return '<div class="form-row">' +
            '<span class="form-label">' + key + '</span>' +
            '<input class="form-input" data-meta="' + key + '" value="' + escapeAttr(String(value)) + '">' +
            '</div>';
    }

    function renderStepCard(step, index) {
        var blocks = step.content || [];
        var html = '<div class="step-card">';
        html += '<div class="step-card-header">' +
            '<span class="step-card-num">' + (index + 1) + '</span>' +
            '<span class="step-card-title">' + escapeHtml(step.title || step.id || 'Step ' + (index + 1)) + '</span>' +
            '<span class="step-card-count">' + blocks.length + ' blocks</span>' +
            '</div>';
        html += '<div class="step-card-body">';
        blocks.forEach(function(block) {
            html += renderBlockItem(block);
        });
        html += '</div></div>';
        return html;
    }

    function renderGroupCard(group, index) {
        var topics = group.topics || [];
        var totalBlocks = 0;
        topics.forEach(function(t) { totalBlocks += (t.content || []).length; });
        var html = '<div class="step-card">';
        html += '<div class="step-card-header">' +
            '<span class="step-card-num">G' + (index + 1) + '</span>' +
            '<span class="step-card-title">' + escapeHtml(group.title || group.id || 'Group ' + (index + 1)) + '</span>' +
            '<span class="step-card-count">' + topics.length + ' topics &middot; ' + totalBlocks + ' blocks</span>' +
            '</div>';
        html += '<div class="step-card-body">';
        topics.forEach(function(topic) {
            html += '<div style="margin-bottom:4px;font-size:9px;color:var(--two)">' + escapeHtml(topic.title || topic.id || '') + '</div>';
            (topic.content || []).forEach(function(block) {
                html += renderBlockItem(block);
            });
        });
        html += '</div></div>';
        return html;
    }

    function renderBlockItem(block) {
        var preview = '';
        if (block.text) preview = String(block.text).substring(0, 80);
        else if (block.title) preview = String(block.title);
        else if (block.commands && block.commands[0]) preview = String(block.commands[0]);
        else if (block.code) preview = String(block.code).substring(0, 60);
        else if (block.items && block.items[0]) preview = String(block.items[0]);

        var hasVox = block.vox ? ' has-vox' : '';
        var voxBtn = (block.type === 'paragraph' || block.type === 'list')
            ? '<span class="block-vox-btn' + hasVox + '" title="Vox narration">&#x1f50a;</span>'
            : '';

        var hasTimeline = block.timeline && block.timeline.length > 0 ? ' has-timeline' : '';
        var timelineBtn = (block.type === 'paragraph' && block.vox)
            ? '<span class="block-timeline-btn' + hasTimeline + '" title="Timeline editor" data-action="open-timeline">\u23F1</span>'
            : '';

        return '<div class="block-item">' +
            '<span class="block-type">' + (block.type || '?') + '</span>' +
            '<span class="block-preview">' + escapeHtml(preview) + '</span>' +
            timelineBtn +
            voxBtn +
            '</div>';
    }

    // ----------------------------------------------------------------
    // JSON <-> Form sync
    // ----------------------------------------------------------------

    function syncJsonFromData() {
        var json = JSON.stringify(state.docData, null, 2);
        jsonTextarea.value = json;
        setDirty(json !== state.cleanJson);
    }

    function syncDataFromJson() {
        try {
            state.docData = JSON.parse(jsonTextarea.value);
            renderForm();
            setDirty(jsonTextarea.value !== state.cleanJson);
            formStatus.textContent = '';
            formStatus.className = 'form-status';
        } catch (e) {
            formStatus.textContent = 'JSON parse error: ' + e.message;
            formStatus.className = 'form-status error';
        }
    }

    // JSON textarea events
    jsonEditable.addEventListener('change', function() {
        jsonTextarea.readOnly = !jsonEditable.checked;
    });

    jsonTextarea.addEventListener('input', function() {
        if (!jsonTextarea.readOnly) {
            setDirty(jsonTextarea.value !== state.cleanJson);
        }
    });

    jsonTextarea.addEventListener('blur', function() {
        if (!jsonTextarea.readOnly && state.dirty) {
            syncDataFromJson();
        }
    });

    // ----------------------------------------------------------------
    // Dirty state
    // ----------------------------------------------------------------

    function setDirty(dirty) {
        state.dirty = dirty;
        btnSave.textContent = dirty ? 'save *' : 'save';
    }

    function checkDirtyBeforeNavigate(callback) {
        if (state.dirty) {
            if (!confirm('You have unsaved changes. Discard?')) return;
        }
        setDirty(false);
        callback();
    }

    // ----------------------------------------------------------------
    // Mode B: Compiled Preview
    // ----------------------------------------------------------------

    function openCompiledPreview(doc) {
        state.activeDoc = doc;
        setMode('preview');
        rightTitle.textContent = doc.name + '.html';
        var htmlFile = doc.name + '.html';
        previewFrame.src = API + '/' + state.org + '/' + htmlFile;
        updateStatusBar();
        updateInfoChain(doc);
    }

    // ----------------------------------------------------------------
    // Mode C: Info Panel
    // ----------------------------------------------------------------

    function openInfoPanel(doc) {
        state.activeDoc = doc;
        setMode('info');
        rightTitle.textContent = doc.name + ' — info';

        var type = doc.type || 'unknown';
        var templateMap = { guide: 'guide.html', reference: 'reference.html', thesis: 'thesis.html' };
        var schemaMap = { guide: 'guide.schema.json', reference: 'reference.schema.json', thesis: 'thesis.schema.json' };

        var blockTypes = ['paragraph', 'list', 'learn-box', 'you-try', 'info-box', 'warning-box',
            'danger-box', 'command-block', 'code-block', 'image', 'audio-player'];

        var html = '<div class="info-section">';
        html += '<div class="info-section-title">Terrain Framework</div>';
        html += '<div class="info-row"><span class="label">Pipeline: </span>JSON source &rarr; terrain_doc_build &rarr; compiled HTML</div>';
        html += '<div class="info-row"><span class="label">Template: </span>' + (templateMap[type] || 'unknown') + '</div>';
        html += '<div class="info-row"><span class="label">Schema: </span>' + (schemaMap[type] || 'unknown') + '</div>';
        html += '</div>';

        html += '<div class="info-section">';
        html += '<div class="info-section-title">Document: ' + escapeHtml(doc.name) + '</div>';
        var meta = doc.metadata || {};
        html += '<div class="info-row"><span class="label">Type: </span>' + type + '</div>';
        html += '<div class="info-row"><span class="label">Version: </span>' + (meta.version || '?') + '</div>';
        html += '<div class="info-row"><span class="label">Steps/Groups: </span>' + doc.stepCount + '</div>';
        html += '<div class="info-row"><span class="label">Blocks: </span>' + doc.blockCount + '</div>';
        html += '<div class="info-row"><span class="label">Compiled: </span>' + (doc.hasCompiled ? 'yes' : 'no') + '</div>';
        html += '</div>';

        html += '<div class="info-section">';
        html += '<div class="info-section-title">Content Block Types</div>';
        html += '<div class="info-block-types">';
        blockTypes.forEach(function(bt) {
            html += '<span class="info-block-type">' + bt + '</span>';
        });
        html += '</div></div>';

        // Load schema if available
        html += '<div class="info-section" id="schema-info">';
        html += '<div class="info-section-title">Schema Fields</div>';
        html += '<div style="color:var(--ink-muted);font-size:9px">Loading schema...</div>';
        html += '</div>';

        modeInfo.innerHTML = html;

        fetchJSON(API + '/' + state.org + '/schemas/' + type).then(function(schema) {
            var el = document.getElementById('schema-info');
            if (!el) return;
            var fields = '';
            if (schema && schema.properties) {
                Object.keys(schema.properties).forEach(function(key) {
                    var prop = schema.properties[key];
                    fields += '<div class="info-row"><span class="label">' + key + ': </span>' +
                        (prop.type || prop.description || '') + '</div>';
                });
            }
            el.innerHTML = '<div class="info-section-title">Schema Fields</div>' +
                (fields || '<div style="color:var(--ink-muted);font-size:9px">No schema found</div>');
        }).catch(function() {
            var el = document.getElementById('schema-info');
            if (el) el.innerHTML = '<div class="info-section-title">Schema Fields</div>' +
                '<div style="color:var(--ink-muted);font-size:9px">Schema not available</div>';
        });
    }

    // ----------------------------------------------------------------
    // Save
    // ----------------------------------------------------------------

    function saveDoc() {
        if (!state.activeDoc || state.activeMode !== 'form') return;
        formStatus.textContent = 'saving...';
        formStatus.className = 'form-status';

        var content = jsonTextarea.value;

        fetch(API + '/' + state.org + '/src/' + encodeURIComponent(state.activeDoc.filename), {
            method: 'PUT',
            headers: { 'Content-Type': 'text/plain' },
            body: content
        })
            .then(function(r) {
                if (!r.ok) throw new Error(r.statusText);
                return r.json();
            })
            .then(function() {
                state.cleanJson = content;
                setDirty(false);
                formStatus.textContent = 'saved';
                formStatus.className = 'form-status saved';
                setTimeout(function() {
                    if (formStatus.textContent === 'saved') formStatus.textContent = '';
                }, 2000);
                loadDocs();
            })
            .catch(function(err) {
                formStatus.textContent = 'save error: ' + err.message;
                formStatus.className = 'form-status error';
            });
    }

    // ----------------------------------------------------------------
    // Build
    // ----------------------------------------------------------------

    function buildOne(doc) {
        var target = doc.filename || doc.name + '.json';
        formStatus.textContent = 'building...';
        formStatus.className = 'form-status';

        fetch(API + '/' + state.org + '/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: target })
        })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                formStatus.textContent = data.built && data.built.length ? 'built' : 'done';
                formStatus.className = 'form-status saved';
                loadDocs();
                setTimeout(function() { formStatus.textContent = ''; }, 2000);
            })
            .catch(function(err) {
                formStatus.textContent = 'build error: ' + err.message;
                formStatus.className = 'form-status error';
            });
    }

    function buildAll() {
        formStatus.textContent = 'building all...';
        formStatus.className = 'form-status';
        fetch(API + '/' + state.org + '/build', { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                formStatus.textContent = (data.built ? data.built.length : 0) + ' built';
                formStatus.className = 'form-status saved';
                loadDocs();
                setTimeout(function() { formStatus.textContent = ''; }, 2000);
            })
            .catch(function(err) {
                formStatus.textContent = 'build error: ' + err.message;
                formStatus.className = 'form-status error';
            });
    }

    // ----------------------------------------------------------------
    // Bump version
    // ----------------------------------------------------------------

    function bumpVersion(doc) {
        fetch(API + '/' + state.org + '/src/' + encodeURIComponent(doc.filename))
            .then(function(r) { return r.text(); })
            .then(function(text) {
                var data = JSON.parse(text);
                if (!data.metadata) data.metadata = {};
                var v = (data.metadata.version || '0.0.0').split('.');
                v[2] = (parseInt(v[2] || 0, 10) + 1).toString();
                data.metadata.version = v.join('.');
                data.metadata.updated = new Date().toISOString();

                return fetch(API + '/' + state.org + '/src/' + encodeURIComponent(doc.filename), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(data, null, 2)
                });
            })
            .then(function(r) {
                if (!r.ok) throw new Error(r.statusText);
                loadDocs();
                // If this doc is currently open in form editor, reload it
                if (state.activeDoc && state.activeDoc.name === doc.name && state.activeMode === 'form') {
                    openFormEditor(doc);
                }
            })
            .catch(function(err) {
                formStatus.textContent = 'bump error: ' + err.message;
                formStatus.className = 'form-status error';
            });
    }

    // ----------------------------------------------------------------
    // New doc
    // ----------------------------------------------------------------

    function createNewDoc() {
        var name = prompt('New document name (without .json):');
        if (!name) return;
        name = name.trim().replace(/\.json$/, '');
        if (!name) return;
        var filename = name + '.json';

        var template = JSON.stringify({
            type: 'guide',
            metadata: {
                title: name.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }),
                subtitle: '',
                version: '0.0.1',
                description: '',
                author: state.org,
                difficulty: 'beginner',
                estimatedTime: 10,
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            },
            steps: []
        }, null, 2);

        fetch(API + '/' + state.org + '/src/' + encodeURIComponent(filename), {
            method: 'PUT',
            headers: { 'Content-Type': 'text/plain' },
            body: template
        })
            .then(function(r) {
                if (!r.ok) throw new Error(r.statusText);
                return r.json();
            })
            .then(function() {
                loadDocs();
            })
            .catch(function(err) {
                alert('Failed to create: ' + err.message);
            });
    }

    // ----------------------------------------------------------------
    // Validate
    // ----------------------------------------------------------------

    function validateDoc() {
        if (!state.activeDoc || state.activeMode !== 'form') {
            formStatus.textContent = 'select a doc to validate';
            formStatus.className = 'form-status error';
            return;
        }
        try {
            JSON.parse(jsonTextarea.value);
            formStatus.textContent = 'valid JSON';
            formStatus.className = 'form-status saved';
            setTimeout(function() { formStatus.textContent = ''; }, 2000);
        } catch (e) {
            formStatus.textContent = 'invalid JSON: ' + e.message;
            formStatus.className = 'form-status error';
        }
    }

    // ----------------------------------------------------------------
    // Status + info chain
    // ----------------------------------------------------------------

    function updateStatusBar() {
        if (!state.activeDoc) {
            statusDetail.textContent = '';
            return;
        }
        var doc = state.activeDoc;
        var meta = doc.metadata || {};
        statusDetail.textContent = doc.name + ' | ' + (doc.type || '?') + ' | ' +
            doc.stepCount + ' steps | ' + doc.blockCount + ' blocks';
    }

    function updateInfoChain(doc) {
        var type = doc.type || 'unknown';
        var templateMap = { guide: 'guide.html', reference: 'reference.html', thesis: 'thesis.html' };
        var schemaMap = { guide: 'guide.schema.json', reference: 'reference.schema.json', thesis: 'thesis.schema.json' };
        infoChain.innerHTML = '<span>terrain</span> &rarr; ' +
            (templateMap[type] || '?') + ' &rarr; ' +
            (schemaMap[type] || '?');
    }

    // ----------------------------------------------------------------
    // Clear / home
    // ----------------------------------------------------------------

    function clearPanel() {
        state.activeDoc = null;
        state.activeMode = null;
        state.docData = null;
        state.dirty = false;
        setMode(null);
        rightTitle.textContent = '';
        formSide.innerHTML = '';
        jsonTextarea.value = '';
        previewFrame.src = 'about:blank';
        modeInfo.innerHTML = '';
        statusDetail.textContent = '';
        updatePillStates();
    }

    // ----------------------------------------------------------------
    // Utilities
    // ----------------------------------------------------------------

    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ----------------------------------------------------------------
    // Keyboard shortcut
    // ----------------------------------------------------------------

    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveDoc();
        }
    });

    // ----------------------------------------------------------------
    // Action handlers
    // ----------------------------------------------------------------

    Terrain.Iframe.init({
        name: 'tut',
        onReady: function() {
            readParams();
            loadDocs();
        }
    });

    Terrain.Iframe.on('filter-tag', function(el) {
        state.tag = el.dataset.tag;
        document.querySelectorAll('.tag-filter').forEach(function(b) {
            b.classList.toggle('active', b.dataset.tag === state.tag);
        });
        renderPills();
    });

    Terrain.Iframe.on('build-all', function() { buildAll(); });
    Terrain.Iframe.on('build-one', function() {
        if (state.activeDoc) buildOne(state.activeDoc);
    });
    Terrain.Iframe.on('save', function() { saveDoc(); });
    Terrain.Iframe.on('home', function() {
        checkDirtyBeforeNavigate(function() { clearPanel(); });
    });
    Terrain.Iframe.on('open-tab', function() {
        if (state.activeDoc && state.activeMode === 'preview') {
            window.open(API + '/' + state.org + '/' + state.activeDoc.name + '.html', '_blank');
        }
    });
    Terrain.Iframe.on('toggle-sidebar', function() {
        sidebar.classList.toggle('collapsed');
    });
    Terrain.Iframe.on('new-doc', function() { createNewDoc(); });
    Terrain.Iframe.on('validate', function() { validateDoc(); });
    Terrain.Iframe.on('toggle-info', function() {
        var info = document.getElementById('info-chain');
        info.style.display = info.style.display === 'none' ? '' : 'none';
    });

    // Listen for env/org changes from parent
    window.addEventListener('message', function(e) {
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'env-change') {
            if (msg.org && msg.org !== state.org) {
                checkDirtyBeforeNavigate(function() {
                    state.org = msg.org;
                    toolbarOrg.textContent = state.org;
                    clearPanel();
                    loadDocs();
                });
            }
        }
    });

})();
