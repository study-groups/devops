// Caddy Panel - Config Tab
// Exports: loadConfig, loadConfigTree, renderEnvLifecycle, highlightCaddyfile, deployConfig, copyConfig

async function loadConfig() {
    const pre = document.getElementById('resolved-config');
    if (!pre) return;

    try {
        const res = await fetch(apiUrl('config') + '&resolve=true');
        const data = await res.json();

        if (data.config) {
            pre.innerHTML = highlightCaddyfile(data.config);
            state.lastConfig = data.config;
        } else {
            pre.innerHTML = '<span class="empty">No config found</span>';
        }
    } catch (err) {
        pre.innerHTML = `<span class="error">Failed to load config: ${err.message}</span>`;
    }
}

async function loadConfigTree() {
    const container = document.getElementById('config-tree');
    if (!container) return;

    try {
        const res = await fetch(apiUrl('info'));
        const data = await res.json();

        const files = [];
        const env = state.env === 'local' ? 'dev' : state.env;
        const caddyfileName = env + '.Caddyfile';

        // Main Caddyfile
        files.push({ name: caddyfileName, icon: '┌─', active: true });

        // Snippets
        if (data.snippets) {
            files.push({ name: 'snippets.caddy', icon: '├─' });
        }

        // Modules dir
        const modules = data.envModules || data.modules || [];
        if (modules.length > 0) {
            files.push({ name: `modules/${env}/`, icon: '└─', badge: `${modules.length} files` });
            modules.forEach((m, i) => {
                files.push({
                    name: '   ' + m,
                    icon: i === modules.length - 1 ? '  └' : '  ├',
                    indent: true
                });
            });
        }

        container.innerHTML = files.map(f => `
            <div class="tree-file">
                <span class="tree-icon">${f.icon}</span>
                <span class="tree-name${f.active ? ' active' : ''}">${f.name}</span>
                ${f.badge ? `<span class="tree-badge">${f.badge}</span>` : ''}
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="error">Failed to load config tree</div>`;
    }
}

function renderEnvLifecycle() {
    const stages = document.querySelectorAll('#env-lifecycle .env-stage');
    const currentEnv = state.env === 'local' ? 'local' : state.env;
    stages.forEach(s => {
        s.classList.toggle('active', s.dataset.env === currentEnv);
    });
}

function highlightCaddyfile(text) {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return escaped.split('\n').map(line => {
        // Section markers from resolved imports
        if (line.match(/^# ---.*---$/)) {
            return `<span class="cfg-section">${line}</span>`;
        }
        // Comments
        if (line.match(/^\s*#/)) {
            return `<span class="cfg-comment">${line}</span>`;
        }
        // Snippet definitions (name) {
        const snippetDef = line.match(/^(\s*\(.+?\))/);
        if (snippetDef) {
            return line.replace(snippetDef[1], `<span class="cfg-snippet">${snippetDef[1]}</span>`);
        }
        // Site blocks: domain.com { or *.domain.com {
        if (line.match(/^\S.*\{/)) {
            return `<span class="cfg-site">${line}</span>`;
        }
        // Directives
        const directives = ['reverse_proxy', 'file_server', 'handle', 'handle_path', 'log', 'basic_auth',
            'header', 'header_up', 'encode', 'tls', 'redir', 'rewrite', 'import', 'email', 'respond'];
        for (const d of directives) {
            if (line.match(new RegExp(`^\\s*${d}\\b`))) {
                return line.replace(new RegExp(`(${d})`), `<span class="cfg-directive">$1</span>`);
            }
        }
        // Ports localhost:NNNN
        if (line.match(/localhost:\d+/)) {
            return line.replace(/(localhost:\d+)/g, `<span class="cfg-port">$1</span>`);
        }
        return line;
    }).join('\n');
}

async function deployConfig() {
    const dryRun = document.getElementById('chk-dry-run')?.checked ?? true;
    const env = state.env;

    if (env === 'local') {
        showToast('Cannot deploy to local');
        return;
    }

    const ssh = `Deploy ${dryRun ? '(dry-run) ' : ''}${env} config?`;
    if (!dryRun && !confirm(ssh)) return;

    const btn = document.getElementById('btn-deploy');
    if (btn) btn.textContent = 'Deploying...';

    try {
        const res = await fetch(apiUrl('deploy') + `&dry_run=${dryRun}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.error) {
            showToast(`Deploy failed: ${data.error}`, 4000);
        } else {
            showToast(dryRun ? 'Dry run complete' : 'Deployed successfully');
            if (data.output) {
                const pre = document.getElementById('resolved-config');
                if (pre) pre.textContent = data.output;
            }
            if (!dryRun) {
                loadConfig();
                loadConfigTree();
            }
        }
    } catch (err) {
        showToast(`Deploy failed: ${err.message}`, 4000);
    } finally {
        if (btn) btn.textContent = 'Deploy ▸';
    }
}

function copyConfig() {
    const config = state.lastConfig;
    if (!config) {
        showToast('No config loaded');
        return;
    }
    navigator.clipboard.writeText(config).then(() => {
        showToast('Config copied to clipboard');
    }).catch(() => {
        showToast('Copy failed');
    });
}

function initConfig() {
    document.getElementById('btn-deploy')?.addEventListener('click', deployConfig);
    document.getElementById('btn-copy-config')?.addEventListener('click', copyConfig);
}

registerTab('config', {
    onActivate: () => { loadConfig(); loadConfigTree(); renderEnvLifecycle(); },
    onInit: initConfig
});
