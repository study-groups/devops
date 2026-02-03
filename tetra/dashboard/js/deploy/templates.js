/**
 * Deploy Panel - HTML Templates
 */

window.DeployTemplates = (function() {
    'use strict';

    const esc = (window.TetraUI && TetraUI.dom) ? TetraUI.dom.esc : function(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    function el(tag, cls, content) {
        return '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>' + (content || '') + '</' + tag + '>';
    }

    function elAttr(tag, attrs, content) {
        const a = Object.keys(attrs).map(k => k + '="' + esc(attrs[k]) + '"').join(' ');
        return '<' + tag + ' ' + a + '>' + (content || '') + '</' + tag + '>';
    }

    function flowSteps(steps) {
        if (!steps || !steps.length) return '';
        return steps.map(step => {
            let cls = 'step';
            if (step.startsWith('remote:')) cls = 'step step-remote';
            else if (step.startsWith('build:')) cls = 'step step-build';
            else if (step === 'push') cls = 'step step-push';
            const label = step.replace('remote:', '').replace('build:', '');
            return el('span', cls, label);
        }).join('<span class="step-arrow">\u2192</span>');
    }

    return {
        el,
        elAttr,
        esc,

        /**
         * Target card
         */
        targetCard(t, isExpanded, hasOutput) {
            const toggle = isExpanded ? '\u2212' : '+';
            const cardClass = 'target ' + (isExpanded ? 'expanded' : 'icon') + (hasOutput ? ' has-output' : '');

            // Env options
            const envOptions = (t.envs || []).map(e => {
                const eName = typeof e === 'string' ? e : e.name;
                return '<option value="' + eName + '">' + eName + '</option>';
            }).join('');

            // Pipeline options
            const pipelineNames = t.pipelines ? Object.keys(t.pipelines) : [];
            let pipelineOptions = '';
            if (pipelineNames.length > 0) {
                pipelineOptions = pipelineNames.map(p => {
                    const steps = t.pipelines[p] || [];
                    return '<option value="' + p + '" title="' + steps.join(' \u2192 ') + '"' +
                        (p === 'full' ? ' selected' : '') + '>' + p + '</option>';
                }).join('');
            }

            const desc = t.description ? el('span', 'target-desc', t.description) : '';
            const activeIndicator = hasOutput ? el('span', 'target-active', '\u25CF') : '';

            // Details section
            const details = this.targetDetails(t);

            // Actions
            const actions = '<div class="target-actions">' +
                elAttr('select', { 'class': 'env-select', 'data-target': t.name }, envOptions) +
                (pipelineOptions ? elAttr('select', { 'class': 'pipeline-select', 'data-target': t.name }, pipelineOptions) : '') +
                elAttr('button', { 'class': 'btn deploy-btn', 'data-action': 'edit', 'data-target': t.name }, 'Edit') +
                elAttr('button', { 'class': 'btn deploy-btn', 'data-action': 'dry-run', 'data-target': t.name }, 'Dry Run') +
                elAttr('button', { 'class': 'btn deploy-btn danger', 'data-action': 'deploy', 'data-target': t.name }, 'Deploy') +
                '</div>';

            return '<div class="' + cardClass + '" data-target-name="' + t.name + '">' +
                '<div class="target-header">' +
                    '<div class="target-row">' +
                        el('span', 'target-name', t.name) +
                        activeIndicator +
                    '</div>' +
                    actions +
                    el('span', 'target-toggle', toggle) +
                '</div>' +
                (desc ? '<div class="target-subtitle">' + t.description + '</div>' : '') +
                details +
                '<div class="target-editor" id="editor-' + t.name + '"></div>' +
                '<div class="target-output" id="output-' + t.name + '"></div>' +
            '</div>';
        },

        /**
         * Target details section
         */
        targetDetails(t) {
            const lines = [];

            // Full pipeline flow
            const fullSteps = t.pipelines && t.pipelines['full'];
            if (fullSteps && fullSteps.length > 0) {
                lines.push(el('div', 'detail-row',
                    el('span', 'detail-label', 'full:') + ' ' +
                    el('span', 'pipeline-flow', flowSteps(fullSteps))));
            }

            // Repo
            if (t.repo) {
                const shortRepo = t.repo.replace('git@github.com:', '').replace('.git', '');
                lines.push(el('div', 'detail-row',
                    el('span', 'detail-label', 'Repo:') + ' ' +
                    el('span', 'detail-value', shortRepo)));
            }

            // Env rows
            if (t.envs && t.envs.length && typeof t.envs[0] === 'object') {
                t.envs.forEach(e => {
                    const port = e.port ? ':' + e.port : '';
                    const branch = e.branch ? ' ' + el('span', 'env-branch', e.branch) : '';
                    lines.push(el('div', 'detail-row',
                        el('span', 'detail-label env-name', e.name) +
                        el('span', 'detail-value', (e.domain || '-') + port + branch)));
                });
            }

            // TOML path
            if (t.path) {
                const shortPath = t.path.replace(/.*\/orgs\//, 'orgs/');
                lines.push(el('div', 'detail-row toml-path',
                    el('span', 'detail-label', 'TOML:') + ' ' +
                    el('span', 'detail-value', shortPath)));
            }

            return el('div', 'target-details', lines.join(''));
        },

        /**
         * History item
         */
        historyItem(h, targetConfig) {
            const ts = this.formatTimestamp(h.timestamp);
            const rawTarget = h.target || '';
            const targetName = rawTarget.split(':')[0];
            const pipeline = rawTarget.split(':')[1] || '';
            const dur = this.formatDuration(h.duration);
            const fullTs = h.timestamp || '';

            return '<div class="history-item" data-timestamp="' + encodeURIComponent(fullTs) + '">' +
                '<div class="history-row">' +
                    '<span class="timestamp" title="' + fullTs + '">' + ts + '</span>' +
                    '<span class="h-target">' + targetName + '</span>' +
                    '<span class="h-pipeline">' + pipeline + '</span>' +
                    '<span class="h-env">' + (h.env || '') + '</span>' +
                    '<span class="h-status ' + (h.status || '') + '">' + (h.status || '') + '</span>' +
                    '<span class="h-delete">del</span>' +
                    (dur ? '<span class="h-duration">' + dur + '</span>' : '') +
                '</div>' +
            '</div>';
        },

        /**
         * Format timestamp to relative time
         */
        formatTimestamp(isoStr) {
            if (window.TetraUI && TetraUI.fmt) {
                return TetraUI.fmt.relTime(isoStr);
            }
            if (!isoStr) return '';
            const date = new Date(isoStr);
            if (isNaN(date.getTime())) return isoStr.slice(11, 16) || '';
            const diffMin = Math.floor((Date.now() - date) / 60000);
            if (diffMin < 60) return diffMin + 'm ago';
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return diffHr + 'h ago';
            const diffDay = Math.floor(diffHr / 24);
            if (diffDay < 7) return diffDay + 'd ago';
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return months[date.getMonth()] + ' ' + date.getDate();
        },

        /**
         * Format duration
         */
        formatDuration(secs) {
            if (window.TetraUI && TetraUI.fmt) {
                return TetraUI.fmt.duration(secs);
            }
            if (secs == null || secs === '') return '';
            const n = Number(secs);
            if (isNaN(n)) return secs;
            if (n < 60) return n + 's';
            return Math.floor(n / 60) + 'm' + (n % 60 ? (n % 60) + 's' : '');
        },

        /**
         * Output panel
         */
        outputPanel(text, label, targetName, isStreaming) {
            const closeId = 'close-output-' + targetName;
            const streamingClass = isStreaming ? ' streaming' : '';
            const streamingIndicator = isStreaming ? '<span class="streaming-indicator"></span>' : '';

            return el('div', 'output-header' + streamingClass,
                streamingIndicator +
                el('span', 'output-label', label || '') +
                '<span class="output-close" id="' + closeId + '">\u00D7</span>') +
                '<pre class="output-pre' + streamingClass + '">' + text + '</pre>';
        }
    };
})();
