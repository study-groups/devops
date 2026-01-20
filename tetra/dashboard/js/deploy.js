// Deploy Panel - Configuration
const CONFIG = {
    defaultEnvs: ['dev', 'staging', 'prod']
};

// DOM elements
let els = {};

// Use shared state (Terrain.State) for org/env/user - initialized by Terrain.Iframe.init()

function updateHeader() {
    const header = document.querySelector('.iframe-header span:first-child');
    if (!header) return;

    const { org, env } = Terrain.State;
    if (env === 'local') {
        header.textContent = 'Deploy';
    } else {
        header.innerHTML = `Deploy <span class="env-indicator ${env}">${org}:${env}</span>`;
    }
}

async function loadTargets() {
    try {
        const res = await fetch(Terrain.State.apiUrl('/api/deploy/targets'));
        const data = await res.json();

        if (!data.targets || data.targets.length === 0) {
            els.targets.innerHTML = '<div class="empty">(no targets configured)</div>';
            return;
        }

        els.targets.innerHTML = data.targets.map(t => {
            const targetEnvs = t.envs || ['dev'];
            return `
                <div class="target">
                    <span class="target-name">${t.name}</span>
                    <span class="target-org">${t.org || ''}</span>
                    <select class="env-select" data-target="${t.name}">
                        ${targetEnvs.map(e => `<option value="${e}">${e}</option>`).join('')}
                    </select>
                    <button class="btn deploy-btn" data-action="dry-run" data-target="${t.name}">Preview</button>
                    <button class="btn deploy-btn danger" data-action="deploy" data-target="${t.name}">Deploy</button>
                </div>
            `;
        }).join('');
    } catch (err) {
        els.targets.innerHTML = '<div class="error">Failed to load targets</div>';
    }
}

async function loadHistory() {
    try {
        const res = await fetch(Terrain.State.apiUrl('/api/deploy/history'));
        const data = await res.json();

        if (!data.history || data.history.length === 0) {
            els.history.innerHTML = '<div class="empty">(no deployment history)</div>';
            return;
        }

        els.history.innerHTML = data.history.slice(0, 10).map(h => {
            const ts = h.timestamp ? h.timestamp.split('T')[1]?.slice(0, 5) || h.timestamp.slice(11, 16) : '';
            return `
                <div class="history-item">
                    <span class="timestamp">${ts}</span>
                    <span class="target">${h.target}</span>
                    <span class="env">${h.env}</span>
                    <span class="status ${h.status}">${h.status}</span>
                    <span class="duration">${h.duration || ''}s</span>
                </div>
            `;
        }).join('');
    } catch (err) {
        els.history.innerHTML = '<div class="error">Failed to load history</div>';
    }
}

async function dryRun(target) {
    const envSelect = document.querySelector(`select[data-target="${target}"]`);
    const env = envSelect ? envSelect.value : 'dev';
    const { org, user } = Terrain.State;

    showOutput(`Previewing ${target} -> ${env}...`);

    try {
        const res = await fetch('/api/deploy/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, env, org, user, dryRun: true })
        });
        const data = await res.json();
        showOutput(data.output || data.message || JSON.stringify(data, null, 2));
    } catch (err) {
        showOutput('Error: ' + err.message);
    }
}

async function deploy(target) {
    const envSelect = document.querySelector(`select[data-target="${target}"]`);
    const env = envSelect ? envSelect.value : 'dev';
    const { org, user } = Terrain.State;

    if (env === 'prod' && !confirm(`Deploy ${target} to PRODUCTION?`)) {
        return;
    }

    showOutput(`Deploying ${target} -> ${env}...`);

    try {
        const res = await fetch('/api/deploy/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, env, org, user, dryRun: false })
        });
        const data = await res.json();
        showOutput(data.output || data.message || JSON.stringify(data, null, 2));
        loadHistory();
    } catch (err) {
        showOutput('Error: ' + err.message);
    }
}

function showOutput(text) {
    els.outputContainer.style.display = 'block';
    els.output.textContent = text;
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

    // Initialize Terrain.Iframe with shared state
    Terrain.Iframe.init({
        name: 'deploy'
    });

    // Handle env changes via Terrain.State
    Terrain.State.onEnvChange((changes) => {
        loadAll();
    });

    // Register actions
    Terrain.Iframe.on('dry-run', (el, data) => dryRun(data.target));
    Terrain.Iframe.on('deploy', (el, data) => deploy(data.target));
    Terrain.Iframe.on('refresh', () => loadAll());

    loadAll();
}

// Start
init();
