// Tests Panel - Live bash test runner via /api/qa
const CONFIG = {
    org: new URLSearchParams(window.location.search).get('org') || 'tetra',
    env: new URLSearchParams(window.location.search).get('env') || 'local'
};

const state = {
    running: false,
    tests: [],
    currentTest: null,
    stats: { passed: 0, failed: 0, pending: 0, duration: 0 }
};

let els = {};

function setStatus(status) {
    els.statusBadge.className = 'status-badge ' + status;
    els.statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
}

function log(message, type = '') {
    const line = document.createElement('div');
    line.className = 'line ' + type;
    line.textContent = message;
    els.output.appendChild(line);
    els.output.scrollTop = els.output.scrollHeight;
}

function clearOutput() {
    els.output.innerHTML = '';
}

function updateStats() {
    els.passedCount.textContent = state.stats.passed;
    els.failedCount.textContent = state.stats.failed;
    els.pendingCount.textContent = state.stats.pending;
    els.duration.textContent = (state.stats.duration / 1000).toFixed(2) + 's';
}

function renderTests() {
    els.testList.innerHTML = state.tests.map(t => `
        <div class="test-item ${t.id === state.currentTest ? 'active' : ''}" data-action="select-test" data-id="${t.id}">
            <div class="status-icon ${t.status}"></div>
            <div class="name">${t.name}</div>
            <div class="duration">${t.duration ? t.duration + 'ms' : ''}</div>
        </div>
    `).join('');
}

async function selectTest(id) {
    state.currentTest = id;
    renderTests();
    const test = state.tests.find(t => t.id === id);
    if (!test) return;

    clearOutput();
    const icon = test.status === 'passed' ? '\u2713' : '\u2717';
    const statusType = test.status === 'passed' ? 'success' : 'error';
    log(`${icon} ${test.name}`, statusType);
    log('');
    log(`Suite:    ${test.suite}`, 'muted');
    log(`Status:   ${test.status}`, 'muted');
    log(`Duration: ${test.duration}ms`, 'muted');
    log(`Function: ${test.func}`, 'muted');
    log(`File:     ${test.file}`, 'muted');

    if (test.func && test.file) {
        log('');
        log('Loading source...', 'muted');
        try {
            const resp = await fetch(`/api/qa/test/source?file=${encodeURIComponent(test.file)}&function=${encodeURIComponent(test.func)}`);
            const data = await resp.json();
            if (data.source) {
                log(`Lines ${data.startLine}-${data.endLine}:`, 'info');
                log('');
                for (const line of data.source.split('\n')) {
                    log(line);
                }
            } else if (data.error) {
                log(data.error, 'error');
            }
        } catch (e) {
            log('Could not load source: ' + e.message, 'error');
        }
    }
}

function populateFromResponse(data) {
    // Handle both single suite and aggregated (run-all) responses
    const tests = [];
    if (data.suites) {
        for (const suite of data.suites) {
            for (const t of suite.tests) {
                tests.push({
                    id: `${suite.suite}:${t.name}`,
                    suite: suite.suite,
                    name: t.name,
                    func: t.function || '',
                    file: t.file || '',
                    status: t.status === 'pass' ? 'passed' : 'failed',
                    duration: t.duration_ms
                });
            }
        }
        state.stats = {
            passed: data.total_passed,
            failed: data.total_failed,
            pending: 0,
            duration: tests.reduce((s, t) => s + t.duration, 0)
        };
    } else if (data.tests) {
        for (const t of data.tests) {
            tests.push({
                id: `${data.suite}:${t.name}`,
                suite: data.suite,
                name: t.name,
                func: t.function || '',
                file: t.file || '',
                status: t.status === 'pass' ? 'passed' : 'failed',
                duration: t.duration_ms
            });
        }
        state.stats = {
            passed: data.passed,
            failed: data.failed,
            pending: 0,
            duration: data.duration_ms
        };
    }
    state.tests = tests;
}

async function loadSuites() {
    try {
        const resp = await fetch('/api/qa/suites');
        const data = await resp.json();
        // Clear existing options except the default
        els.suiteSelect.innerHTML = '<option value="">Select test suite...</option>';
        els.suiteSelect.innerHTML += '<option value="all">All Suites</option>';
        for (const s of data.suites) {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = s.name;
            els.suiteSelect.appendChild(opt);
        }
    } catch (e) {
        log('Failed to load suites: ' + e.message, 'error');
    }
}

async function loadTests(suite) {
    if (suite === 'all') {
        // For "all", fetch each suite's tests
        try {
            const resp = await fetch('/api/qa/suites');
            const data = await resp.json();
            state.tests = [];
            for (const s of data.suites) {
                const r = await fetch(`/api/qa/suites/${encodeURIComponent(s.name)}/tests`);
                const d = await r.json();
                for (const t of d.tests) {
                    state.tests.push({
                        id: `${d.suite}:${t.name}`,
                        suite: d.suite,
                        name: t.name,
                        func: t.function,
                        file: t.file,
                        status: 'pending',
                        duration: 0
                    });
                }
            }
        } catch (e) {
            log('Failed to load tests: ' + e.message, 'error');
            return;
        }
    } else {
        try {
            const resp = await fetch(`/api/qa/suites/${encodeURIComponent(suite)}/tests`);
            const data = await resp.json();
            state.tests = data.tests.map(t => ({
                id: `${data.suite}:${t.name}`,
                suite: data.suite,
                name: t.name,
                func: t.function,
                file: t.file,
                status: 'pending',
                duration: 0
            }));
        } catch (e) {
            log('Failed to load tests: ' + e.message, 'error');
            return;
        }
    }
    state.stats = { passed: 0, failed: 0, pending: state.tests.length, duration: 0 };
    renderTests();
    updateStats();
    setStatus('idle');
    log(`Loaded ${state.tests.length} tests from: ${suite}`, 'info');
    log('Click "Run All" to execute', 'muted');
}

async function runSuite(suite) {
    state.running = true;
    els.runBtn.disabled = true;
    els.stopBtn.disabled = false;

    try {
        const resp = await fetch('/api/qa/suites/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suite })
        });
        const data = await resp.json();

        if (data.error) {
            setStatus('failed');
            log('Error: ' + data.error, 'error');
            return;
        }

        populateFromResponse(data);
        renderTests();
        updateStats();

        log('');
        for (const t of state.tests) {
            const icon = t.status === 'passed' ? '\u2713' : '\u2717';
            const type = t.status === 'passed' ? 'success' : 'error';
            log(`  ${icon} ${t.name} (${t.duration}ms)`, type);
        }
        log('');

        if (state.stats.failed > 0) {
            setStatus('failed');
            log(`${state.stats.failed} of ${state.stats.passed + state.stats.failed} tests failed`, 'error');
        } else {
            setStatus('passed');
            log(`All ${state.stats.passed} tests passed!`, 'success');
        }
    } catch (e) {
        setStatus('failed');
        log('Request failed: ' + e.message, 'error');
    } finally {
        state.running = false;
        state.currentTest = null;
        els.runBtn.disabled = false;
        els.stopBtn.disabled = true;
    }
}

async function runTests() {
    if (state.running) return;
    const suite = els.suiteSelect.value;
    if (!suite) {
        log('Select a test suite first', 'muted');
        return;
    }
    clearOutput();
    setStatus('running');
    log(`Running suite: ${suite}...`, 'info');
    await runSuite(suite);
}

function stopTests() {
    state.running = false;
    log('');
    log('Tests stopped by user', 'muted');
}

function init() {
    els = {
        suiteSelect: document.getElementById('suite-select'),
        runBtn: document.getElementById('run-btn'),
        stopBtn: document.getElementById('stop-btn'),
        statusBadge: document.getElementById('status-badge'),
        testList: document.getElementById('test-list'),
        output: document.getElementById('output'),
        clearBtn: document.getElementById('clear-btn'),
        passedCount: document.getElementById('passed-count'),
        failedCount: document.getElementById('failed-count'),
        pendingCount: document.getElementById('pending-count'),
        duration: document.getElementById('duration')
    };

    Terrain.Iframe.on('select-test', (el, data) => selectTest(data.id));
    Terrain.Iframe.on('run', () => runTests());
    Terrain.Iframe.on('stop', () => stopTests());
    Terrain.Iframe.on('clear', () => clearOutput());

    els.suiteSelect.addEventListener('change', async () => {
        const suite = els.suiteSelect.value;
        if (!suite) return;
        clearOutput();
        await loadTests(suite);
    });

    loadSuites();
    Terrain.Iframe.send({ type: 'ready', from: 'tests' });
}

init();
