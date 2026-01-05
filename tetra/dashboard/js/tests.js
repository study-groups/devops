// Tests Panel - Configuration
const CONFIG = {
    org: new URLSearchParams(window.location.search).get('org') || 'tetra',
    env: new URLSearchParams(window.location.search).get('env') || 'local',
    mockSuites: {
        unit: [
            { name: 'utils.test.js', tests: ['formatTime', 'parseConfig', 'validateInput'] },
            { name: 'state.test.js', tests: ['setState', 'getState', 'resetState'] },
            { name: 'events.test.js', tests: ['emit', 'on', 'off'] }
        ],
        integration: [
            { name: 'api.test.js', tests: ['GET /status', 'POST /deploy', 'GET /logs'] },
            { name: 'ssh.test.js', tests: ['connect', 'execute', 'disconnect'] }
        ],
        e2e: [
            { name: 'dashboard.spec.js', tests: ['loads panels', 'resizes panes', 'switches views'] },
            { name: 'deploy.spec.js', tests: ['selects target', 'runs deploy', 'shows output'] }
        ]
    }
};

// Consolidated state
const state = {
    running: false,
    tests: [],
    currentTest: null,
    stats: { passed: 0, failed: 0, pending: 0, duration: 0 }
};

// DOM elements
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

function renderTestList(suite) {
    const suiteData = CONFIG.mockSuites[suite];
    if (!suiteData) {
        els.testList.innerHTML = '<div class="placeholder">No tests found</div>';
        return;
    }

    state.tests = [];
    suiteData.forEach(file => {
        file.tests.forEach(test => {
            state.tests.push({
                id: `${file.name}:${test}`,
                file: file.name,
                name: test,
                status: 'pending',
                duration: 0
            });
        });
    });

    renderTests();
    state.stats = { passed: 0, failed: 0, pending: state.tests.length, duration: 0 };
    updateStats();
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

function selectTest(id) {
    state.currentTest = id;
    renderTests();
    const test = state.tests.find(t => t.id === id);
    if (test) {
        log(`Selected: ${test.file} > ${test.name}`, 'info');
    }
}

async function runTests() {
    if (state.running) return;
    state.running = true;

    els.runBtn.disabled = true;
    els.stopBtn.disabled = false;
    setStatus('running');
    clearOutput();

    const startTime = Date.now();
    state.stats = { passed: 0, failed: 0, pending: state.tests.length, duration: 0 };

    log(`Running ${state.tests.length} tests...`, 'info');
    log('');

    for (const test of state.tests) {
        if (!state.running) break;

        state.currentTest = test.id;
        test.status = 'running';
        renderTests();
        log(`  ${test.file} > ${test.name}...`, 'muted');

        const duration = Math.floor(Math.random() * 200) + 50;
        await new Promise(r => setTimeout(r, duration));

        if (!state.running) break;

        const passed = Math.random() > 0.2;
        test.status = passed ? 'passed' : 'failed';
        test.duration = duration;

        if (passed) {
            state.stats.passed++;
            log(`    ✓ passed (${duration}ms)`, 'success');
        } else {
            state.stats.failed++;
            log(`    ✗ failed (${duration}ms)`, 'error');
            log(`      AssertionError: expected value to match`, 'error');
        }

        state.stats.pending--;
        state.stats.duration = Date.now() - startTime;
        updateStats();
        renderTests();
    }

    state.running = false;
    state.currentTest = null;
    els.runBtn.disabled = false;
    els.stopBtn.disabled = true;

    if (state.stats.failed > 0) {
        setStatus('failed');
        log('');
        log(`Tests failed: ${state.stats.failed} of ${state.tests.length}`, 'error');
    } else {
        setStatus('passed');
        log('');
        log(`All ${state.stats.passed} tests passed!`, 'success');
    }

    renderTests();
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

    // Register actions
    Terrain.Iframe.on('select-test', (el, data) => selectTest(data.id));
    Terrain.Iframe.on('run', () => runTests());
    Terrain.Iframe.on('stop', () => stopTests());
    Terrain.Iframe.on('clear', () => clearOutput());

    // Suite select change handler
    els.suiteSelect.addEventListener('change', () => {
        const suite = els.suiteSelect.value;
        if (suite) {
            renderTestList(suite);
            clearOutput();
            log(`Loaded suite: ${suite}`, 'info');
            log(`${state.tests.length} tests found`, 'muted');
        }
    });

    // Notify parent we're ready
    Terrain.Iframe.send({ type: 'ready', from: 'tests' });
}

// Start
init();
