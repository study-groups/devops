// Deploy Panel - Configuration
var CONFIG = {
    defaultEnvs: ['dev', 'staging', 'prod']
};

// DOM elements
var els = {};

// Expand/collapse state (persisted in localStorage)
var expandedTargets = {};
try {
    var saved = JSON.parse(localStorage.getItem('deploy-expanded') || '{}');
    if (saved && typeof saved === 'object') expandedTargets = saved;
} catch (_) {}

// Current target filter for history
var historyTargetFilter = '';

// Cached targets data
var targetsData = [];

// Persisted selections across re-renders
var savedSelections = {};

// Persisted output per target (survives re-render)
var targetOutputs = {}; // { targetName: { html, label } }

function saveExpanded() {
    try { localStorage.setItem('deploy-expanded', JSON.stringify(expandedTargets)); } catch (_) {}
}

// --- Render helpers ---

function el(tag, cls, content) {
    return '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>' + (content || '') + '</' + tag + '>';
}

function elAttr(tag, attrs, content) {
    var a = Object.keys(attrs).map(function(k) { return k + '="' + attrs[k] + '"'; }).join(' ');
    return '<' + tag + ' ' + a + '>' + (content || '') + '</' + tag + '>';
}

function flowSteps(steps) {
    if (!steps || !steps.length) return '';
    return steps.map(function(step) {
        var cls = 'step';
        if (step.startsWith('remote:')) cls = 'step step-remote';
        else if (step.startsWith('build:')) cls = 'step step-build';
        else if (step === 'push') cls = 'step step-push';
        var label = step.replace('remote:', '').replace('build:', '');
        return el('span', cls, label);
    }).join('<span class="step-arrow">\u2192</span>');
}

function envTable(envs) {
    if (!envs || !envs.length || typeof envs[0] !== 'object') return '';
    var rows = envs.map(function(e) {
        var port = e.port ? ':' + e.port : '';
        var branch = e.branch ? el('span', 'env-branch', e.branch) : '';
        return el('div', 'env-table-row',
            el('span', 'env-name', e.name) +
            el('span', 'env-domain', (e.domain || '-') + port) +
            branch);
    }).join('');
    return el('div', 'env-table', rows);
}

function tagList(items, cls) {
    return items.map(function(item) { return el('span', cls, item); }).join('');
}

// --- Selection persistence ---

function snapshotSelections() {
    savedSelections = {};
    document.querySelectorAll('.env-select').forEach(function(s) {
        var t = s.dataset.target;
        if (!savedSelections[t]) savedSelections[t] = {};
        savedSelections[t].env = s.value;
    });
    document.querySelectorAll('.pipeline-select').forEach(function(s) {
        var t = s.dataset.target;
        if (!savedSelections[t]) savedSelections[t] = {};
        savedSelections[t].pipeline = s.value;
    });
}

function restoreSelections() {
    Object.keys(savedSelections).forEach(function(t) {
        var sel = savedSelections[t];
        if (sel.env) {
            var envEl = document.querySelector('.env-select[data-target="' + t + '"]');
            if (envEl) envEl.value = sel.env;
        }
        if (sel.pipeline) {
            var pipEl = document.querySelector('.pipeline-select[data-target="' + t + '"]');
            if (pipEl) pipEl.value = sel.pipeline;
        }
    });
}

// --- Toggle ---

function toggleTarget(name) {
    // If collapsing while output is showing, just clear output instead
    if (expandedTargets[name] && targetOutputs[name]) {
        delete targetOutputs[name];
        renderTargets();
        return;
    }

    expandedTargets[name] = !expandedTargets[name];
    saveExpanded();

    // Wire history filter
    if (expandedTargets[name]) {
        historyTargetFilter = name;
    } else {
        historyTargetFilter = '';
    }
    renderHistoryFilterIndicator();
    loadHistory();

    renderTargets();
}

function clearHistoryFilter() {
    historyTargetFilter = '';
    renderHistoryFilterIndicator();
    loadHistory();
}

function renderHistoryFilterIndicator() {
    var indicator = document.getElementById('history-filter');
    if (!indicator) return;
    if (historyTargetFilter) {
        indicator.style.display = 'flex';
        indicator.innerHTML = '<span>Showing: ' + historyTargetFilter + '</span>' +
            '<span class="filter-clear" id="clear-history-filter">\u00D7</span>';
        var clearBtn = document.getElementById('clear-history-filter');
        if (clearBtn) clearBtn.addEventListener('click', clearHistoryFilter);
    } else {
        indicator.style.display = 'none';
        indicator.innerHTML = '';
    }
}

function updateHeader() {
    var header = document.querySelector('.iframe-header span:first-child');
    if (!header) return;

    var org = Terrain.State.org;
    var env = Terrain.State.env;
    if (env === 'local') {
        header.textContent = 'Deploy';
    } else {
        header.innerHTML = 'Deploy <span class="env-indicator ' + env + '">' + org + ':' + env + '</span>';
    }
}

async function loadTargets() {
    try {
        var url = Terrain.State.apiUrl('/api/deploy/targets');
        var res = await fetch(url);
        var data = await res.json();

        if (!data.targets || data.targets.length === 0) {
            els.targets.innerHTML = '<div class="empty">(no targets configured)</div>';
            targetsData = [];
            return;
        }

        targetsData = data.targets;
        renderTargets();
    } catch (err) {
        els.targets.innerHTML = '<div class="error">Failed to load targets</div>';
    }
}

function renderTargets() {
    if (!targetsData.length) return;

    snapshotSelections();

    els.targets.innerHTML = targetsData.map(function(t) {
        var isExpanded = !!expandedTargets[t.name];
        var toggle = isExpanded ? '\u25BC' : '\u25B6';
        var cardClass = 'target ' + (isExpanded ? 'expanded' : 'icon');

        // Env options
        var envOptions = (t.envs || []).map(function(e) {
            var eName = typeof e === 'string' ? e : e.name;
            return '<option value="' + eName + '">' + eName + '</option>';
        }).join('');

        // Pipeline options
        var pipelineNames = t.pipelines ? Object.keys(t.pipelines) : [];
        var pipelineOptions = '';
        if (pipelineNames.length > 0) {
            pipelineOptions = pipelineNames.map(function(p) {
                var steps = t.pipelines[p] || [];
                return '<option value="' + p + '" title="' + steps.join(' \u2192 ') + '"' +
                    (p === 'default' ? ' selected' : '') + '>' + p + '</option>';
            }).join('');
        }

        // Format badge
        var formatBadge = t.format ? el('span', 'target-format ' + t.format, t.format) : '';

        // Description
        var desc = t.description ? el('span', 'target-desc', t.description) : '';

        // --- Details section (always rendered, CSS hides when .icon) ---
        var details = '';
        var lines = [];

        // Strategy banner
        if (t.strategy) {
            var stratIcon = {
                'remote-exec': '\u2192 server',
                'local-push': '\u2191 push',
                'hybrid': '\u21C4 both'
            }[t.strategy] || '';
            lines.push(el('div', 'detail-row strategy-row',
                el('span', 'strategy-badge strategy-' + t.strategy, stratIcon) + ' ' +
                el('span', 'detail-value', t.strategyDesc || t.strategy)));
        }

        // Default pipeline flow
        var defaultSteps = t.pipelines && t.pipelines['default'];
        if (defaultSteps && defaultSteps.length > 0) {
            lines.push(el('div', 'detail-row',
                el('span', 'detail-label', 'default:') + ' ' +
                el('span', 'pipeline-flow', flowSteps(defaultSteps))));
        }

        // Repo
        if (t.repo) {
            var shortRepo = t.repo.replace('git@github.com:', '').replace('.git', '');
            lines.push(el('div', 'detail-row',
                el('span', 'detail-label', 'Repo:') + ' ' +
                el('span', 'detail-value', shortRepo)));
        }

        // Env table
        lines.push(envTable(t.envs));

        // Other pipelines
        var allPipelineNames = t.pipelines ? Object.keys(t.pipelines) : [];
        var otherPipelines = allPipelineNames.filter(function(p) { return p !== 'default'; });
        if (otherPipelines.length > 0) {
            var pTags = otherPipelines.map(function(p) {
                var steps = t.pipelines[p] || [];
                return '<span class="pipeline-tag" title="' + steps.join(' \u2192 ') + '">' + p +
                    el('span', 'step-count', steps.length) + '</span>';
            }).join('');
            lines.push(el('div', 'detail-row',
                el('span', 'detail-label', 'Pipelines:') +
                el('div', 'pipeline-tags', pTags)));
        }

        // Remote commands
        if (t.remoteCommands && t.remoteCommands.length > 0) {
            lines.push(el('div', 'detail-row',
                el('span', 'detail-label', 'Remote:') +
                el('div', 'remote-tags', tagList(t.remoteCommands, 'remote-tag'))));
        }

        // Files
        if (t.files && t.files.length > 0) {
            lines.push(el('div', 'detail-row',
                el('span', 'detail-label', 'Files:') +
                el('div', 'remote-tags', tagList(t.files, 'remote-tag'))));
        }

        // TOML path
        if (t.path) {
            var shortPath = t.path.replace(/.*\/orgs\//, 'orgs/');
            lines.push(el('div', 'detail-row toml-path',
                el('span', 'detail-label', 'TOML:') + ' ' +
                el('span', 'detail-value', shortPath)));
        }

        details = el('div', 'target-details', lines.join(''));

        // Actions (always rendered, layout differs by CSS)
        var actions = '<div class="target-actions">' +
            elAttr('select', { 'class': 'env-select', 'data-target': t.name }, envOptions) +
            (pipelineOptions ? elAttr('select', { 'class': 'pipeline-select', 'data-target': t.name }, pipelineOptions) : '') +
            elAttr('button', { 'class': 'btn deploy-btn', 'data-action': 'edit', 'data-target': t.name }, 'Edit') +
            elAttr('button', { 'class': 'btn deploy-btn', 'data-action': 'dry-run', 'data-target': t.name }, 'Dry Run') +
            elAttr('button', { 'class': 'btn deploy-btn danger', 'data-action': 'deploy', 'data-target': t.name }, 'Deploy') +
            '</div>';

        // Inline editor area
        var editorArea = '<div class="target-editor" id="editor-' + t.name + '"></div>';

        // Inline output area (per-target, shown after actions)
        var inlineOutput = '<div class="target-output" id="output-' + t.name + '"></div>';

        // Single-pass card markup
        return '<div class="' + cardClass + '" data-target-name="' + t.name + '">' +
            '<div class="target-row">' +
                el('span', 'target-toggle', toggle) +
                el('span', 'target-name', t.name) +
                desc +
                el('span', 'target-org', t.org || '') +
                formatBadge +
                (isExpanded ? '' : '<span style="flex:1"></span>') +
            '</div>' +
            details +
            actions +
            editorArea +
            inlineOutput +
        '</div>';
    }).join('');

    restoreSelections();
    restoreOutputs();

    // Event delegation for expand/collapse
    els.targets.querySelectorAll('.target').forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'OPTION' || e.target.tagName === 'TEXTAREA') return;
            if (e.target.closest('.target-editor')) return;
            var name = card.getAttribute('data-target-name');
            if (name) toggleTarget(name);
        });
    });
}

function formatTimestamp(isoStr) {
    if (!isoStr) return '';
    var date = new Date(isoStr);
    if (isNaN(date.getTime())) return isoStr.slice(11, 16) || '';
    var now = new Date();
    var diffMs = now - date;
    var diffMin = Math.floor(diffMs / 60000);
    var diffHr = Math.floor(diffMs / 3600000);
    var diffDay = Math.floor(diffMs / 86400000);

    // Under 1 hour: "Xm ago"
    if (diffMin < 60) return diffMin + 'm ago';
    // Under 24 hours: "Xh ago"
    if (diffHr < 24) return diffHr + 'h ago';
    // Under 7 days: "Xd ago"
    if (diffDay < 7) return diffDay + 'd ago';
    // Older: "Jan 15" or "Dec 3"
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[date.getMonth()] + ' ' + date.getDate();
}

function formatDuration(secs) {
    if (secs == null || secs === '') return '';
    var n = Number(secs);
    if (isNaN(n)) return secs;
    if (n < 60) return n + 's';
    return Math.floor(n / 60) + 'm' + (n % 60 ? (n % 60) + 's' : '');
}

async function loadHistory() {
    try {
        var baseUrl = Terrain.State.apiUrl('/api/deploy/history');
        if (historyTargetFilter) baseUrl += '&target=' + encodeURIComponent(historyTargetFilter);

        var res = await fetch(baseUrl);
        var data = await res.json();

        if (!data.history || data.history.length === 0) {
            els.history.innerHTML = '<div class="empty">(no deployment history)</div>';
            return;
        }

        els.history.innerHTML = data.history.slice(0, 15).map(function(h) {
            var ts = formatTimestamp(h.timestamp);
            // target field may be "arcade:tsm" — split to get base target name
            var rawTarget = h.target || '';
            var targetName = rawTarget.split(':')[0];
            var pipeline = rawTarget.split(':')[1] || '';
            var dur = formatDuration(h.duration);

            // Cross-reference with loaded targets for config details
            var targetConfig = null;
            var envConfig = null;
            for (var i = 0; i < targetsData.length; i++) {
                if (targetsData[i].name === targetName) {
                    targetConfig = targetsData[i];
                    var envs = targetConfig.envs || [];
                    for (var j = 0; j < envs.length; j++) {
                        if (envs[j].name === h.env) { envConfig = envs[j]; break; }
                    }
                    break;
                }
            }

            // Build detail lines (each wrapped in hd-line for vertical layout)
            var detailLines = [];
            function hdLine(label, value) {
                return '<span class="hd-line">' + el('span', 'hd-label', label) + ' ' + el('span', 'hd-value', value) + '</span>';
            }
            if (envConfig) {
                if (envConfig.ssh) detailLines.push(hdLine('ssh', envConfig.ssh));
                if (envConfig.domain) detailLines.push(hdLine('host', envConfig.domain + (envConfig.port ? ':' + envConfig.port : '')));
                if (envConfig.branch) detailLines.push(hdLine('branch', envConfig.branch));
            }
            if (h.branch && (!envConfig || h.branch !== envConfig.branch)) {
                detailLines.push(hdLine('branch', h.branch));
            }
            if (h.commit) detailLines.push(hdLine('commit', h.commit.slice(0, 8)));
            if (h.user) detailLines.push(hdLine('user', h.user));
            if (pipeline && targetConfig && targetConfig.pipelines && targetConfig.pipelines[pipeline]) {
                var steps = targetConfig.pipelines[pipeline];
                detailLines.push('<span class="hd-line">' + el('span', 'hd-label', 'steps') + ' ' + el('span', 'hd-value hd-steps', steps.join(' \u2192 ')) + '</span>');
            }
            if (targetConfig && targetConfig.strategy) {
                detailLines.push(hdLine('mode', targetConfig.strategyDesc || targetConfig.strategy));
            }

            // Full timestamp on hover
            var fullTs = h.timestamp || '';

            return '<div class="history-item expanded">' +
                '<div class="history-row">' +
                    '<span class="timestamp" title="' + fullTs + '">' + ts + '</span>' +
                    '<span class="h-target">' + targetName + '</span>' +
                    '<span class="h-pipeline">' + pipeline + '</span>' +
                    '<span class="h-env">' + (h.env || '') + '</span>' +
                    '<span class="h-status ' + (h.status || '') + '">' + (h.status || '') + '</span>' +
                    (dur ? '<span class="h-duration">' + dur + '</span>' : '') +
                '</div>' +
                (detailLines.length ? '<div class="history-details">' + detailLines.join('') + '</div>' : '') +
            '</div>';
        }).join('');

        els.history.querySelectorAll('.history-item').forEach(function(item) {
            item.addEventListener('click', function() {
                item.classList.toggle('expanded');
            });
        });
    } catch (err) {
        els.history.innerHTML = '<div class="error">Failed to load history</div>';
    }
}

function getPipeline(target) {
    var pipelineSelect = document.querySelector('select.pipeline-select[data-target="' + target + '"]');
    return pipelineSelect ? pipelineSelect.value : 'default';
}

async function dryRun(target) {
    var envSelect = document.querySelector('select[data-target="' + target + '"].env-select');
    var env = envSelect ? envSelect.value : 'dev';
    var pipeline = getPipeline(target);

    showOutput('Running dry-run...', target + ':' + pipeline, target);

    try {
        var res = await fetch(Terrain.State.apiUrl('/api/deploy/deploy'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: target, env: env, pipeline: pipeline, dryRun: true })
        });
        var data = await res.json();
        showOutput(data.output || data.message || JSON.stringify(data, null, 2), target + ':' + pipeline, target);
    } catch (err) {
        showOutput('Error: ' + err.message, target + ':' + pipeline, target);
    }
}

async function deploy(target) {
    var envSelect = document.querySelector('select[data-target="' + target + '"].env-select');
    var env = envSelect ? envSelect.value : 'dev';
    var pipeline = getPipeline(target);

    if (env === 'prod' && !confirm('Deploy ' + target + ' to PRODUCTION?')) {
        return;
    }

    showOutput('Deploying...', target + ':' + pipeline, target);

    try {
        var res = await fetch(Terrain.State.apiUrl('/api/deploy/deploy'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: target, env: env, pipeline: pipeline, dryRun: false })
        });
        var data = await res.json();
        showOutput(data.output || data.message || JSON.stringify(data, null, 2), target + ':' + pipeline, target);
        loadHistory();
    } catch (err) {
        showOutput('Error: ' + err.message, target + ':' + pipeline, target);
    }
}

function showOutput(text, label, targetName) {
    // Persist in JS state so re-renders don't lose it
    if (targetName) {
        targetOutputs[targetName] = { text: text, label: label };
    }

    var container = targetName ? document.getElementById('output-' + targetName) : null;
    if (container) {
        renderOutputInContainer(container, text, label, targetName);
    } else {
        // Fallback to global output
        els.outputContainer.style.display = 'block';
        els.output.innerHTML = '<pre class="output-pre">' + formatOutput(text) + '</pre>';
    }
}

function renderOutputInContainer(container, text, label, targetName) {
    var closeId = 'close-output-' + targetName;
    container.innerHTML = el('div', 'output-header',
        el('span', 'output-label', label || '') +
        '<span class="output-close" id="' + closeId + '">\u00D7</span>') +
        '<pre class="output-pre">' + formatOutput(text) + '</pre>';
    container.style.display = 'block';
    var closeBtn = document.getElementById(closeId);
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            container.style.display = 'none';
            container.innerHTML = '';
            delete targetOutputs[targetName];
        });
    }
}

function restoreOutputs() {
    Object.keys(targetOutputs).forEach(function(name) {
        var container = document.getElementById('output-' + name);
        if (container) {
            var o = targetOutputs[name];
            renderOutputInContainer(container, o.text, o.label, name);
        }
    });
}

function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatOutput(raw) {
    var clean = stripAnsi(raw);
    var lines = clean.split('\n');
    return lines.map(function(line) {
        // Section headers: [target:pipeline:env]
        if (/^\[.*:.*\]/.test(line.trim())) {
            return '<span class="out-header">' + escapeHtml(line) + '</span>';
        }
        // DRY RUN banner
        if (/\[DRY RUN\]/.test(line)) {
            return '<span class="out-dryrun">' + escapeHtml(line) + '</span>';
        }
        // Step names: [remote:pull], [build:tsm], etc
        if (/^\s+\[[\w:.-]+\]/.test(line)) {
            return '<span class="out-step">' + escapeHtml(line) + '</span>';
        }
        // Horizontal rules
        if (/^[─]{4,}/.test(line.trim())) {
            return '<span class="out-rule">' + escapeHtml(line) + '</span>';
        }
        // Done line
        if (/^Done\s/.test(line.trim())) {
            return '<span class="out-done">' + escapeHtml(line) + '</span>';
        }
        // Command lines (indented)
        if (/^\s{2,}\S/.test(line)) {
            return '<span class="out-cmd">' + escapeHtml(line) + '</span>';
        }
        return escapeHtml(line);
    }).join('\n');
}

// --- TOML Editor ---

var editorDebounceTimer = null;

function parseEditorHints(content) {
    var sections = [];
    var vars = [];
    var lines = content.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var sMatch = lines[i].match(/^\[([^\]]+)\]/);
        if (sMatch) sections.push({ name: sMatch[1], line: i });
        var vMatches = lines[i].matchAll(/\{\{(\w+)\}\}/g);
        for (var m of vMatches) {
            if (vars.indexOf(m[1]) === -1) vars.push(m[1]);
        }
    }
    return { sections: sections, vars: vars };
}

function renderHints(targetName, content) {
    var hints = parseEditorHints(content);
    var html = '';
    hints.sections.forEach(function(s) {
        html += '<span class="editor-hint section" data-line="' + s.line + '">[' + s.name + ']</span>';
    });
    hints.vars.forEach(function(v) {
        html += '<span class="editor-hint var" data-var="' + v + '">{{' + v + '}}</span>';
    });
    var hintsEl = document.querySelector('#editor-' + targetName + ' .editor-hints');
    if (hintsEl) hintsEl.innerHTML = html;
}

async function editTarget(targetName) {
    var container = document.getElementById('editor-' + targetName);
    if (!container) return;

    // Toggle off if already active
    if (container.classList.contains('active')) {
        closeEditor(targetName);
        return;
    }

    container.innerHTML = '<div class="editor-hints"></div>' +
        '<textarea class="editor-textarea" spellcheck="false">Loading...</textarea>' +
        '<div class="editor-actions">' +
            '<button class="btn deploy-btn" data-editor-action="save" data-target="' + targetName + '">Save</button>' +
            '<button class="btn deploy-btn" data-editor-action="cancel" data-target="' + targetName + '">Cancel</button>' +
            '<span class="editor-msg" id="editor-msg-' + targetName + '"></span>' +
        '</div>';
    container.classList.add('active');

    // Wire save/cancel
    container.querySelector('[data-editor-action="save"]').addEventListener('click', function() { saveTarget(targetName); });
    container.querySelector('[data-editor-action="cancel"]').addEventListener('click', function() { closeEditor(targetName); });

    try {
        var url = Terrain.State.apiUrl('/api/deploy/config/' + encodeURIComponent(targetName));
        var res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load config');
        var data = await res.json();

        var textarea = container.querySelector('.editor-textarea');
        textarea.value = data.content;
        renderHints(targetName, data.content);

        // Debounced hint updates
        textarea.addEventListener('input', function() {
            clearTimeout(editorDebounceTimer);
            editorDebounceTimer = setTimeout(function() {
                renderHints(targetName, textarea.value);
            }, 500);
        });

        // Hint click handlers (delegated)
        container.querySelector('.editor-hints').addEventListener('click', function(e) {
            var hint = e.target.closest('.editor-hint');
            if (!hint) return;
            if (hint.classList.contains('section')) {
                var line = parseInt(hint.dataset.line, 10);
                scrollTextareaToLine(textarea, line);
            } else if (hint.classList.contains('var')) {
                var varName = hint.dataset.var;
                insertAtCursor(textarea, '{{' + varName + '}}');
            }
        });
    } catch (err) {
        container.querySelector('.editor-textarea').value = 'Error: ' + err.message;
    }
}

function scrollTextareaToLine(textarea, lineNum) {
    var lines = textarea.value.split('\n');
    var charPos = 0;
    for (var i = 0; i < lineNum && i < lines.length; i++) {
        charPos += lines[i].length + 1;
    }
    textarea.focus();
    textarea.setSelectionRange(charPos, charPos);
    // Approximate scroll: lineHeight ~13.5px (9px font * 1.5 line-height)
    var lineHeight = 13.5;
    textarea.scrollTop = lineNum * lineHeight - textarea.clientHeight / 3;
}

function insertAtCursor(textarea, text) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var val = textarea.value;
    textarea.value = val.substring(0, start) + text + val.substring(end);
    var newPos = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);
}

async function saveTarget(targetName) {
    var container = document.getElementById('editor-' + targetName);
    if (!container) return;
    var textarea = container.querySelector('.editor-textarea');
    var msgEl = document.getElementById('editor-msg-' + targetName);

    try {
        var url = Terrain.State.apiUrl('/api/deploy/config/' + encodeURIComponent(targetName));
        var res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'text/plain' },
            body: textarea.value
        });
        if (!res.ok) {
            var err = await res.json();
            throw new Error(err.error || 'Save failed');
        }
        closeEditor(targetName);
        loadTargets();
    } catch (err) {
        if (msgEl) {
            msgEl.textContent = err.message;
            msgEl.style.color = 'var(--one)';
        }
    }
}

function closeEditor(targetName) {
    var container = document.getElementById('editor-' + targetName);
    if (!container) return;
    container.classList.remove('active');
    container.innerHTML = '';
}

function loadAll() {
    updateHeader();
    loadTargets();
    loadHistory();
}

function init() {
    els = {
        targets: document.getElementById('targets'),
        history: document.getElementById('history'),
        output: document.getElementById('output'),
        outputContainer: document.getElementById('output-container')
    };

    Terrain.Iframe.init({
        name: 'deploy'
    });

    Terrain.State.onEnvChange(function() {
        loadAll();
    });

    Terrain.Iframe.on('edit', function(el, data) { editTarget(data.target); });
    Terrain.Iframe.on('dry-run', function(el, data) { dryRun(data.target); });
    Terrain.Iframe.on('deploy', function(el, data) { deploy(data.target); });
    Terrain.Iframe.on('refresh', function() { loadAll(); });

    loadAll();
}

// Start
init();
