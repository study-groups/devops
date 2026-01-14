/**
 * Config module - displays server configuration
 */

let configData = null;

export function init() {
    document.getElementById('refresh-config')?.addEventListener('click', loadConfig);
}

export async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        configData = await res.json();
        renderConfig();
    } catch (err) {
        console.error('Failed to load config:', err);
    }
}

function renderConfig() {
    if (!configData) return;

    // Service section
    renderSection('config-service', {
        'Name': configData.service.name,
        'Command': configData.service.command,
        'Working Dir': configData.service.cwd,
        'Environment': configData.environment,
    });

    // Paths section
    renderSection('config-paths', {
        'PD_DIR': configData.paths.PD_DIR,
        'PD_DATA': configData.paths.PD_DATA,
        'GAMES_DIR': configData.paths.GAMES_DIR,
    });

    // S3 section
    renderSection('config-s3', {
        'Bucket': configData.s3.bucket,
        'Endpoint': configData.s3.endpoint,
        'Configured': configData.s3.configured ? 'Yes' : 'No',
    });

    // Runtime section
    renderSection('config-runtime', {
        'Port': configData.runtime.port,
        'PID': configData.runtime.pid,
        'Uptime': formatUptime(configData.runtime.uptime),
        'Node': configData.runtime.node,
    });
}

function renderSection(sectionId, data) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const dl = section.querySelector('dl');
    if (!dl) return;

    dl.innerHTML = Object.entries(data)
        .map(([key, value]) => `
            <dt>${key}</dt>
            <dd>${escapeHtml(String(value))}</dd>
        `)
        .join('');
}

function formatUptime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
