/**
 * Deploy Panel - State Management
 */

window.DeployState = (function() {
    'use strict';

    // Expand/collapse state (persisted in localStorage)
    let expandedTargets = {};
    try {
        const saved = JSON.parse(localStorage.getItem('deploy-expanded') || '{}');
        if (saved && typeof saved === 'object') expandedTargets = saved;
    } catch (_) {}

    function saveExpanded() {
        try {
            localStorage.setItem('deploy-expanded', JSON.stringify(expandedTargets));
        } catch (_) {}
    }

    // Persisted selections across re-renders
    const savedSelections = {};

    // Persisted output per target
    const targetOutputs = {};

    // Cached targets data
    let targetsData = [];

    // History filter
    let historyTargetFilter = '';

    return {
        // Expanded targets
        isExpanded(name) { return !!expandedTargets[name]; },
        toggleExpanded(name) {
            expandedTargets[name] = !expandedTargets[name];
            saveExpanded();
            return expandedTargets[name];
        },
        setExpanded(name, val) {
            expandedTargets[name] = val;
            saveExpanded();
        },

        // Selections
        getSelection(target) { return savedSelections[target] || {}; },
        setSelection(target, key, value) {
            if (!savedSelections[target]) savedSelections[target] = {};
            savedSelections[target][key] = value;
        },
        snapshotSelections() {
            document.querySelectorAll('.env-select').forEach(s => {
                const t = s.dataset.target;
                if (!savedSelections[t]) savedSelections[t] = {};
                savedSelections[t].env = s.value;
            });
            document.querySelectorAll('.pipeline-select').forEach(s => {
                const t = s.dataset.target;
                if (!savedSelections[t]) savedSelections[t] = {};
                savedSelections[t].pipeline = s.value;
            });
        },
        restoreSelections() {
            Object.keys(savedSelections).forEach(t => {
                const sel = savedSelections[t];
                if (sel.env) {
                    const el = document.querySelector(`.env-select[data-target="${t}"]`);
                    if (el) el.value = sel.env;
                }
                if (sel.pipeline) {
                    const el = document.querySelector(`.pipeline-select[data-target="${t}"]`);
                    if (el) el.value = sel.pipeline;
                }
            });
        },

        // Outputs
        getOutput(target) { return targetOutputs[target]; },
        setOutput(target, data) { targetOutputs[target] = data; },
        clearOutput(target) { delete targetOutputs[target]; },
        hasOutput(target) { return !!targetOutputs[target]; },
        getAllOutputs() { return { ...targetOutputs }; },

        // Targets data
        getTargets() { return targetsData; },
        setTargets(data) { targetsData = data; },

        // History filter
        getHistoryFilter() { return historyTargetFilter; },
        setHistoryFilter(filter) { historyTargetFilter = filter; }
    };
})();
