/**
 * Deploy Panel - Main Entry Point
 *
 * Load order:
 *   1. TetraUI components (optional, enhances output)
 *   2. js/deploy/state.js
 *   3. js/deploy/templates.js
 *   4. js/deploy/output.js
 *   5. js/deploy/index.js (this file)
 */

(function() {
    'use strict';

    const CONFIG = {
        defaultEnvs: ['dev', 'staging', 'prod']
    };

    // DOM elements
    let els = {};

    // ==========================================================================
    // Rendering
    // ==========================================================================

    function updateHeader() {
        const header = document.querySelector('.iframe-header span:first-child');
        if (!header) return;

        const org = Terrain.State.org;
        const env = Terrain.State.env;
        if (env === 'local') {
            header.textContent = 'Deploy';
        } else {
            header.innerHTML = 'Deploy <span class="env-indicator ' + env + '">' + org + ':' + env + '</span>';
        }
    }

    async function loadTargets() {
        try {
            const url = Terrain.State.apiUrl('/api/deploy/targets');
            const res = await fetch(url);
            const data = await res.json();

            if (!data.targets || data.targets.length === 0) {
                els.targets.innerHTML = '<div class="empty">(no targets configured)</div>';
                DeployState.setTargets([]);
                return;
            }

            DeployState.setTargets(data.targets);
            renderTargets();
        } catch (err) {
            els.targets.innerHTML = '<div class="error">Failed to load targets</div>';
        }
    }

    function renderTargets() {
        const targets = DeployState.getTargets();
        if (!targets.length) return;

        DeployState.snapshotSelections();

        els.targets.innerHTML = targets.map(t => {
            const isExpanded = DeployState.isExpanded(t.name);
            const hasOutput = DeployState.hasOutput(t.name);
            return DeployTemplates.targetCard(t, isExpanded, hasOutput);
        }).join('');

        DeployState.restoreSelections();
        DeployOutput.restoreOutputs();

        // Wire toggle handlers
        els.targets.querySelectorAll('.target-toggle').forEach(toggle => {
            toggle.addEventListener('click', e => {
                e.stopPropagation();
                const card = toggle.closest('.target');
                const name = card ? card.getAttribute('data-target-name') : null;
                if (name) toggleTarget(name);
            });
        });
    }

    function toggleTarget(name) {
        DeployState.toggleExpanded(name);

        // Wire history filter
        if (DeployState.isExpanded(name)) {
            DeployState.setHistoryFilter(name);
        } else {
            DeployState.setHistoryFilter('');
        }

        renderHistoryFilterIndicator();
        loadHistory();
        renderTargets();
    }

    // ==========================================================================
    // History
    // ==========================================================================

    function renderHistoryFilterIndicator() {
        const indicator = document.getElementById('history-filter');
        if (!indicator) return;

        const filter = DeployState.getHistoryFilter();
        if (filter) {
            indicator.style.display = 'flex';
            indicator.innerHTML = '<span>Showing: ' + filter + '</span>' +
                '<span class="filter-clear" id="clear-history-filter">\u00D7</span>';
            const clearBtn = document.getElementById('clear-history-filter');
            if (clearBtn) clearBtn.addEventListener('click', clearHistoryFilter);
        } else {
            indicator.style.display = 'none';
            indicator.innerHTML = '';
        }
    }

    function clearHistoryFilter() {
        DeployState.setHistoryFilter('');
        renderHistoryFilterIndicator();
        loadHistory();
    }

    async function loadHistory() {
        try {
            let baseUrl = Terrain.State.apiUrl('/api/deploy/history');
            const filter = DeployState.getHistoryFilter();
            if (filter) baseUrl += '&target=' + encodeURIComponent(filter);

            const res = await fetch(baseUrl);
            const data = await res.json();

            if (!data.history || data.history.length === 0) {
                els.history.innerHTML = '<div class="empty">(no deployment history)</div>';
                return;
            }

            const targets = DeployState.getTargets();
            els.history.innerHTML = data.history.slice(0, 15).map(h => {
                const targetConfig = targets.find(t => t.name === (h.target || '').split(':')[0]);
                return DeployTemplates.historyItem(h, targetConfig);
            }).join('');

            wireHistoryEvents();
        } catch (err) {
            els.history.innerHTML = '<div class="error">Failed to load history</div>';
        }
    }

    function wireHistoryEvents() {
        els.history.querySelectorAll('.history-item').forEach(item => {
            item.querySelector('.history-row').addEventListener('click', e => {
                if (!e.target.classList.contains('h-delete')) {
                    item.classList.toggle('expanded');
                }
            });

            const deleteBtn = item.querySelector('.h-delete');
            let confirmTimeout = null;
            deleteBtn.addEventListener('click', e => {
                e.stopPropagation();
                if (deleteBtn.classList.contains('confirming')) {
                    clearTimeout(confirmTimeout);
                    deleteHistoryEntry(item);
                } else {
                    deleteBtn.textContent = 'sure?';
                    deleteBtn.classList.add('confirming');
                    confirmTimeout = setTimeout(() => {
                        deleteBtn.textContent = 'del';
                        deleteBtn.classList.remove('confirming');
                    }, 3000);
                }
            });
        });
    }

    async function deleteHistoryEntry(item) {
        const timestamp = item.dataset.timestamp;
        if (!timestamp) return;

        item.classList.add('deleting');

        try {
            const res = await fetch(Terrain.State.apiUrl('/api/deploy/history/' + timestamp), {
                method: 'DELETE'
            });
            if (res.ok) {
                item.style.height = item.offsetHeight + 'px';
                item.classList.add('deleted');
                setTimeout(() => item.remove(), 200);
            } else {
                item.classList.remove('deleting', 'confirming');
            }
        } catch (err) {
            item.classList.remove('deleting', 'confirming');
        }
    }

    // ==========================================================================
    // Deploy Actions
    // ==========================================================================

    function getPipeline(target) {
        const el = document.querySelector('select.pipeline-select[data-target="' + target + '"]');
        return el ? el.value : 'full';
    }

    function streamDeploy(target, env, pipeline, dryRun) {
        const label = target + ':' + pipeline;
        const lines = [];

        const url = '/api/deploy/stream?' +
            'org=' + encodeURIComponent(Terrain.State.org) +
            '&target=' + encodeURIComponent(target) +
            '&env=' + encodeURIComponent(env) +
            '&pipeline=' + encodeURIComponent(pipeline) +
            '&dryRun=' + (dryRun ? 'true' : 'false');

        const eventSource = new EventSource(url);

        DeployOutput.showStreamingOutput('Connecting...', label, target, true);

        eventSource.addEventListener('start', e => {
            const data = JSON.parse(e.data);
            lines.length = 0;
            DeployOutput.showStreamingOutput('Started ' + (data.dryRun ? '[DRY RUN]' : '[DEPLOY]') + '...', label, target, true);
        });

        eventSource.addEventListener('output', e => {
            const data = JSON.parse(e.data);
            lines.push(data.line);
            DeployOutput.showStreamingOutput(lines.join('\n'), label, target, true);
        });

        eventSource.addEventListener('done', e => {
            eventSource.close();
            DeployOutput.showStreamingOutput(lines.join('\n'), label, target, false);
            if (!dryRun) loadHistory();
        });

        eventSource.addEventListener('error', e => {
            let data = {};
            try { data = JSON.parse(e.data); } catch (_) {}
            eventSource.close();
            lines.push('Error: ' + (data.error || 'Connection lost'));
            DeployOutput.showStreamingOutput(lines.join('\n'), label, target, false);
        });

        eventSource.onerror = () => {
            eventSource.close();
            lines.push('Error: Connection closed');
            DeployOutput.showStreamingOutput(lines.join('\n'), label, target, false);
        };

        return eventSource;
    }

    async function dryRun(target) {
        const envSelect = document.querySelector('select[data-target="' + target + '"].env-select');
        const env = envSelect ? envSelect.value : 'dev';
        const pipeline = getPipeline(target);
        streamDeploy(target, env, pipeline, true);
    }

    async function deploy(target) {
        const envSelect = document.querySelector('select[data-target="' + target + '"].env-select');
        const env = envSelect ? envSelect.value : 'dev';
        const pipeline = getPipeline(target);

        if (env === 'prod' && !confirm('Deploy ' + target + ' to PRODUCTION?')) {
            return;
        }

        streamDeploy(target, env, pipeline, false);
    }

    // ==========================================================================
    // Editor
    // ==========================================================================

    let editorDebounceTimer = null;

    async function editTarget(targetName) {
        const container = document.getElementById('editor-' + targetName);
        if (!container) return;

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

        container.querySelector('[data-editor-action="save"]').addEventListener('click', () => saveTarget(targetName));
        container.querySelector('[data-editor-action="cancel"]').addEventListener('click', () => closeEditor(targetName));

        try {
            const url = Terrain.State.apiUrl('/api/deploy/config/' + encodeURIComponent(targetName));
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load config');
            const data = await res.json();

            const textarea = container.querySelector('.editor-textarea');
            textarea.value = data.content;

            textarea.addEventListener('input', () => {
                clearTimeout(editorDebounceTimer);
                editorDebounceTimer = setTimeout(() => {
                    // Could update hints here
                }, 500);
            });
        } catch (err) {
            container.querySelector('.editor-textarea').value = 'Error: ' + err.message;
        }
    }

    async function saveTarget(targetName) {
        const container = document.getElementById('editor-' + targetName);
        if (!container) return;
        const textarea = container.querySelector('.editor-textarea');
        const msgEl = document.getElementById('editor-msg-' + targetName);

        try {
            const url = Terrain.State.apiUrl('/api/deploy/config/' + encodeURIComponent(targetName));
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'text/plain' },
                body: textarea.value
            });
            if (!res.ok) {
                const err = await res.json();
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
        const container = document.getElementById('editor-' + targetName);
        if (!container) return;
        container.classList.remove('active');
        container.innerHTML = '';
    }

    // ==========================================================================
    // Init
    // ==========================================================================

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

        Terrain.Iframe.init({ name: 'deploy' });

        Terrain.State.onEnvChange(loadAll);

        Terrain.Iframe.on('edit', (el, data) => editTarget(data.target));
        Terrain.Iframe.on('dry-run', (el, data) => dryRun(data.target));
        Terrain.Iframe.on('deploy', (el, data) => deploy(data.target));
        Terrain.Iframe.on('refresh', loadAll);

        loadAll();
    }

    // Export
    window.DeployPanel = { init, loadTargets, loadHistory };

    // Start
    init();
})();
