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
            <button class="btn-run-single" data-action="run-single" data-id="${t.id}" title="Run this test">\u25b6</button>
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

async function runSingleTest(id) {
    const test = state.tests.find(t => t.id === id);
    if (!test || !test.func || !test.suite) return;

    state.currentTest = id;
    test.status = 'running';
    renderTests();
    clearOutput();
    log(`Running: ${test.name}...`, 'info');

    try {
        const resp = await fetch('/api/qa/test/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suite: test.suite, function: test.func })
        });
        const data = await resp.json();

        if (data.error) {
            test.status = 'failed';
            log('Error: ' + data.error, 'error');
        } else if (data.tests && data.tests.length > 0) {
            const result = data.tests[0];
            test.status = result.status === 'pass' ? 'passed' : 'failed';
            test.duration = result.duration_ms;
            const icon = test.status === 'passed' ? '\u2713' : '\u2717';
            const type = test.status === 'passed' ? 'success' : 'error';
            log('');
            log(`  ${icon} ${test.name} (${test.duration}ms)`, type);
        } else {
            test.status = 'failed';
            log('No result returned', 'error');
        }
    } catch (e) {
        test.status = 'failed';
        log('Request failed: ' + e.message, 'error');
    }

    // Recalculate stats from current test states
    state.stats.passed = state.tests.filter(t => t.status === 'passed').length;
    state.stats.failed = state.tests.filter(t => t.status === 'failed').length;
    state.stats.pending = state.tests.filter(t => t.status === 'pending').length;
    updateStats();
    renderTests();
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

function showInfo() {
    const overlay = document.getElementById('info-overlay');
    const body = document.getElementById('info-body');
    body.innerHTML = `
<h2>Architecture</h2>
<p>The CLI is the source of truth. This web panel is a window into it.</p>
<pre>
test-framework.sh (TETRA_TEST_JSON=1)
       | JSON stdout
server/api/qa.js (execSync -> parse)
       | REST response
tests.iframe.html (render live results)
</pre>
<p>When you select a suite, the dashboard reads test names directly from
the <code>run_test</code> calls in the shell script. When you click
<strong>Run All</strong> or the per-test <strong>\u25b6</strong> button,
the server executes the bash script with <code>TETRA_TEST_JSON=1</code>
and returns structured JSON. No separate test runner &mdash; same code
the CLI runs.</p>

<h2>Adding a New Test Suite</h2>
<p>Create a file in <code>tests/startup/</code> named
<code>test-&lt;name&gt;.sh</code>:</p>
<pre>
#!/usr/bin/env bash
set +e
source "$(dirname "$0")/test-framework.sh"

startup_test_setup "My Module Tests"

# Source the module under test
source "$TETRA_SRC/bash/mymod/mymod.sh"

# Define test functions
test_my_feature_works() {
    local result
    result=$(my_function "input")
    [[ "$result" == "expected" ]]
}

test_my_edge_case() {
    ! my_function ""  # expect failure on empty
}

# Register tests
run_test "my_feature produces expected output" test_my_feature_works
run_test "empty input fails gracefully" test_my_edge_case

startup_test_results "My Module Results"
exit $TESTS_FAILED
</pre>
<p>That's it. The suite appears automatically in the dropdown and in
<code>run-all.sh</code> aggregation.</p>

<h2>To include in run-all.sh</h2>
<p>Add your suite to the <code>SUITES</code> array in
<code>tests/startup/run-all.sh</code>:</p>
<pre>
SUITES=(
    ...existing entries...
    "My Module:test-mymod.sh"
)
</pre>

<h2>Framework Harnesses</h2>
<p>The test framework (<code>test-framework.sh</code>) provides:</p>
<ul>
    <li><code>startup_test_setup "Suite Name"</code> &mdash; creates an
    isolated <code>TETRA_DIR</code> in <code>/tmp</code>, sources
    <code>org.sh</code>, sets cleanup trap</li>
    <li><code>run_test "description" function_name</code> &mdash; runs
    the function, captures pass/fail and <code>$EPOCHREALTIME</code>
    timing</li>
    <li><code>startup_test_results "Label"</code> &mdash; prints summary
    (ANSI) or emits JSON blob when <code>TETRA_TEST_JSON=1</code></li>
    <li><code>_create_test_org "name"</code> &mdash; scaffolds a minimal
    org with section files for integration tests</li>
    <li><code>log_info</code>, <code>log_pass</code>,
    <code>log_fail</code>, <code>log_warn</code>,
    <code>log_section</code> &mdash; color output, auto-suppressed in
    JSON mode</li>
</ul>

<h2>Environment Variables</h2>
<ul>
    <li><code>TETRA_TEST_JSON=1</code> &mdash; JSON output mode (no ANSI)</li>
    <li><code>TETRA_TEST_SINGLE=func_name</code> &mdash; run only the
    named test function, skip all others</li>
    <li><code>STARTUP_TEST_CLEANUP=false</code> &mdash; preserve
    <code>/tmp/tetra-test-*</code> dirs for debugging</li>
</ul>

<h2>API Endpoints</h2>
<ul>
    <li><code>GET /api/qa/suites</code> &mdash; list available suites</li>
    <li><code>GET /api/qa/suites/:name/tests</code> &mdash; list tests
    without running (parses <code>run_test</code> calls)</li>
    <li><code>POST /api/qa/suites/run</code> &mdash; execute suite(s),
    body: <code>{"suite":"name"}</code> or <code>{"suite":"all"}</code></li>
    <li><code>POST /api/qa/test/run</code> &mdash; run single test,
    body: <code>{"suite":"name","function":"func"}</code></li>
    <li><code>GET /api/qa/test/source</code> &mdash; extract function
    source from test file</li>
    <li><code>GET /api/qa/guide/:topic</code> &mdash; render a tetra
    guide topic</li>
    <li><code>GET /api/qa/status</code> &mdash; QA index status</li>
</ul>

<h2>CLI Equivalents</h2>
<pre>
# Run one suite
TETRA_TEST_JSON=1 bash tests/startup/test-org-build.sh

# Run all suites
TETRA_TEST_JSON=1 bash tests/startup/run-all.sh

# Run single test
TETRA_TEST_JSON=1 TETRA_TEST_SINGLE=test_org_build_header \\
  bash tests/startup/test-org-build.sh

# Normal ANSI output (no env vars)
bash tests/startup/run-all.sh
</pre>
`;
    overlay.style.display = 'flex';
}

function hideInfo() {
    document.getElementById('info-overlay').style.display = 'none';
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
    Terrain.Iframe.on('run-single', (el, data) => runSingleTest(data.id));
    Terrain.Iframe.on('run', () => runTests());
    Terrain.Iframe.on('stop', () => stopTests());
    Terrain.Iframe.on('clear', () => clearOutput());
    Terrain.Iframe.on('info', () => showInfo());
    Terrain.Iframe.on('info-close', () => hideInfo());

    document.getElementById('info-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'info-overlay') hideInfo();
    });

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
