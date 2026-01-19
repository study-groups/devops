/**
 * Games/Workspace tab module
 * Manages local workspace with org selection and game details
 */

import { api, formatBytes } from './api.js';

let currentOrg = null;
let currentWorkspace = null;
let currentGame = null;
let currentFile = null;
let s3FilesCache = null;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Load available orgs and populate selector
 */
async function loadOrgs() {
    const orgSelect = document.getElementById('org-select');

    try {
        const data = await api('/workspace/orgs');
        currentOrg = data.current_org;

        orgSelect.innerHTML = data.orgs
            .map(org => `<option value="${org}" ${org === currentOrg ? 'selected' : ''}>${org}</option>`)
            .join('');
    } catch (err) {
        console.error('Failed to load orgs:', err);
        orgSelect.innerHTML = '<option value="">Error loading orgs</option>';
    }
}

/**
 * Switch to a different org
 */
async function switchOrg(org) {
    const workspaceInfo = document.getElementById('workspace-info');

    try {
        workspaceInfo.textContent = `Switching to ${org}...`;

        await api('/workspace/org', {
            method: 'POST',
            body: { org },
        });

        currentOrg = org;
        await loadGames(true);
    } catch (err) {
        workspaceInfo.textContent = `Error switching org: ${err.message}`;
    }
}

/**
 * Load games from current workspace
 */
export async function loadGames(refresh = false) {
    const workspaceInfo = document.getElementById('workspace-info');
    const gamesList = document.getElementById('games-list');

    workspaceInfo.textContent = 'Loading...';
    gamesList.innerHTML = '';

    try {
        // Get workspace state
        currentWorkspace = await api('/workspace');
        const url = refresh ? '/games?refresh=true' : '/games';
        const manifest = await api(url);

        // Build info line
        workspaceInfo.innerHTML = `<span class="workspace-org">${currentWorkspace.org}</span> | ${manifest.count} games | <code>${currentWorkspace.games_dir}</code>`;

        if (manifest.games.length === 0) {
            gamesList.innerHTML = '<div class="empty-state">No games in workspace</div>';
            return;
        }

        manifest.games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.dataset.slug = game.slug;
            card.innerHTML = `
                <h3>${game.name}</h3>
                <div class="slug">${game.slug} v${game.version}</div>
                <p>${game.description || 'No description'}</p>
                <div class="meta">
                    ${(game.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                    ${game.requires_auth ? `<span class="tag auth">🔒 ${game.min_role}</span>` : ''}
                </div>
            `;
            card.addEventListener('click', () => openGameDetail(game));
            gamesList.appendChild(card);
        });
    } catch (err) {
        workspaceInfo.textContent = 'Error loading workspace';
        gamesList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
}

/**
 * Show cards view, hide detail view
 */
function showCardsView() {
    document.getElementById('games-cards-view').classList.remove('hidden');
    document.getElementById('game-detail-view').classList.add('hidden');
    currentGame = null;
    currentFile = null;
}

/**
 * Show detail view, hide cards view
 */
function showDetailView() {
    document.getElementById('games-cards-view').classList.add('hidden');
    document.getElementById('game-detail-view').classList.remove('hidden');
}

/**
 * Open game detail view
 */
async function openGameDetail(game) {
    const title = document.getElementById('game-detail-title');
    currentGame = game;
    s3FilesCache = null;

    // Reset file viewer
    const viewer = document.getElementById('game-file-viewer');
    viewer.classList.remove('visible', 'compare-mode');

    title.textContent = game.name;

    // Populate metadata section
    const metaDl = document.querySelector('#game-meta dl');
    metaDl.innerHTML = `
        <dt>Slug</dt><dd>${game.slug}</dd>
        <dt>Version</dt><dd>${game.version}</dd>
        <dt>Author</dt><dd>${game.author || 'Unknown'}</dd>
        <dt>Description</dt><dd>${game.description || 'None'}</dd>
        <dt>Tags</dt><dd class="tag-list">${(game.tags || []).map(t => `<span class="tag">${t}</span>`).join('') || 'None'}</dd>
        <dt>Created</dt><dd>${game.created ? new Date(game.created).toLocaleString() : 'Unknown'}</dd>
        <dt>Updated</dt><dd>${game.updated ? new Date(game.updated).toLocaleString() : 'Unknown'}</dd>
    `;

    // Populate access control section
    const accessDl = document.querySelector('#game-access dl');
    accessDl.innerHTML = `
        <dt>Requires Auth</dt><dd>${game.requires_auth ? 'Yes' : 'No'}</dd>
        <dt>Min Role</dt><dd>${game.min_role || 'guest'}</dd>
        <dt>ID</dt><dd>${game.id || game.slug}</dd>
    `;

    // Populate paths section
    const pathsDl = document.querySelector('#game-paths dl');
    const gameDir = `${currentWorkspace.games_dir}/${game.slug}`;
    pathsDl.innerHTML = `
        <dt>Entry</dt><dd>${game.entry || 'index.html'}</dd>
        <dt>Thumbnail</dt><dd>${game.thumbnail || 'None'}</dd>
        <dt>Local</dt><dd>${gameDir}</dd>
        <dt>S3</dt><dd>games/${game.slug}/</dd>
    `;

    // Show detail view
    showDetailView();

    // Load files
    await loadGameFiles(game.slug);
}

/**
 * Load game files into the modal with sync status
 */
async function loadGameFiles(slug) {
    const tbody = document.querySelector('#game-files tbody');
    tbody.innerHTML = '<tr><td colspan="4">Loading files...</td></tr>';

    try {
        // Load local and S3 files in parallel
        const [localData, s3Data] = await Promise.all([
            api(`/games/${slug}/files`),
            fetchS3Files(slug).catch(() => ({ files: [] })),
        ]);

        s3FilesCache = s3Data.files;
        const s3Map = new Map(s3Data.files.map(f => [f.name, f]));

        if (localData.files.length === 0 && s3Data.files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No files found</td></tr>';
            return;
        }

        // Merge local and S3 files
        const allFiles = new Map();
        localData.files.forEach(f => allFiles.set(f.name, { local: f }));
        s3Data.files.forEach(f => {
            if (allFiles.has(f.name)) {
                allFiles.get(f.name).s3 = f;
            } else {
                allFiles.set(f.name, { s3: f });
            }
        });

        tbody.innerHTML = '';
        for (const [name, data] of allFiles) {
            const row = document.createElement('tr');
            row.className = 'file-row';
            if (data.local) row.classList.add('clickable');

            const syncStatus = getSyncStatus(data.local, data.s3);
            const modified = data.local?.lastModified
                ? new Date(data.local.lastModified).toLocaleString()
                : data.s3?.lastModified
                    ? new Date(data.s3.lastModified).toLocaleString()
                    : 'Unknown';
            const size = data.local?.size ?? data.s3?.size ?? 0;

            row.innerHTML = `
                <td class="name">${escapeHtml(name)}</td>
                <td class="size">${formatBytes(size)}</td>
                <td class="date">${modified}</td>
                <td class="sync-status"><span class="sync-badge ${syncStatus.class}" title="${syncStatus.title}">${syncStatus.icon}</span></td>
            `;

            if (data.local) {
                row.addEventListener('click', () => showFileContent(slug, name));
            }
            tbody.appendChild(row);
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4">Error: ${err.message}</td></tr>`;
    }
}

/**
 * Fetch S3 files for a game (S3 doesn't have games/ prefix)
 */
async function fetchS3Files(slug) {
    const result = await api(`/s3/list?prefix=${slug}/&delimiter=false`);
    const files = result.objects
        .filter(obj => !obj.key.endsWith('/'))
        .map(obj => ({
            name: obj.key.replace(`${slug}/`, ''),
            size: obj.size,
            lastModified: obj.lastModified,
        }));
    return { files };
}

/**
 * Get sync status between local and S3 file
 */
function getSyncStatus(local, s3) {
    if (local && s3) {
        const sizeDiff = Math.abs(local.size - s3.size);
        if (sizeDiff === 0) {
            return { class: 'synced', icon: '✓', title: 'Synced (same size)' };
        }
        return { class: 'modified', icon: '~', title: `Modified (local: ${formatBytes(local.size)}, S3: ${formatBytes(s3.size)})` };
    }
    if (local && !s3) {
        return { class: 'local-only', icon: '+', title: 'Local only (not in S3)' };
    }
    if (!local && s3) {
        return { class: 's3-only', icon: '↓', title: 'S3 only (not in local)' };
    }
    return { class: 'unknown', icon: '?', title: 'Unknown' };
}

let currentFileContent = '';

/**
 * Show file content in the viewer pane
 */
async function showFileContent(slug, filename) {
    const viewer = document.getElementById('game-file-viewer');
    const title = viewer.querySelector('.file-viewer-title');
    const bodyContainer = viewer.querySelector('.file-viewer-body');
    const body = bodyContainer.querySelector('code');
    const editor = viewer.querySelector('.file-editor');
    const editBtn = viewer.querySelector('.edit-btn');
    const saveBtn = viewer.querySelector('.save-btn');
    const cancelBtn = viewer.querySelector('.cancel-btn');
    const compareBtn = viewer.querySelector('.compare-btn');
    const closeBtn = viewer.querySelector('.close-viewer-btn');

    currentFile = filename;
    currentFileContent = '';
    viewer.classList.add('visible');
    viewer.classList.remove('compare-mode', 'edit-mode');
    title.textContent = filename;
    body.innerHTML = 'Loading...';

    // Highlight selected row
    document.querySelectorAll('#game-files .file-row.selected').forEach(r => r.classList.remove('selected'));
    const rows = document.querySelectorAll('#game-files .file-row');
    rows.forEach(r => {
        if (r.querySelector('.name')?.textContent === filename) {
            r.classList.add('selected');
        }
    });

    closeBtn.onclick = () => {
        viewer.classList.remove('visible', 'edit-mode');
        document.querySelectorAll('#game-files .file-row.selected').forEach(r => r.classList.remove('selected'));
        currentFile = null;
    };

    editBtn.onclick = () => {
        viewer.classList.add('edit-mode');
        const currentEditor = bodyContainer.querySelector('.file-editor');
        currentEditor.value = currentFileContent;
        currentEditor.focus();
    };

    cancelBtn.onclick = () => {
        viewer.classList.remove('edit-mode');
    };

    saveBtn.onclick = async () => {
        saveBtn.textContent = 'Saving...';
        try {
            const currentEditor = bodyContainer.querySelector('.file-editor');
            const response = await fetch(`/api/games/${slug}/file/${encodeURIComponent(filename)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: currentEditor.value }),
            });
            if (!response.ok) throw new Error('Save failed');

            currentFileContent = currentEditor.value;
            bodyContainer.querySelector('code').innerHTML = escapeHtml(currentFileContent);
            viewer.classList.remove('edit-mode');
            saveBtn.textContent = 'Save';

            // Refresh file list to update size/modified
            await loadGameFiles(slug);
        } catch (err) {
            saveBtn.textContent = 'Failed';
            setTimeout(() => saveBtn.textContent = 'Save', 2000);
        }
    };

    compareBtn.onclick = () => {
        if (viewer.classList.contains('compare-mode')) {
            // Exit compare mode, show normal view
            viewer.classList.remove('compare-mode');
            bodyContainer.innerHTML = `<pre><code>${escapeHtml(currentFileContent)}</code></pre><textarea class="file-editor"></textarea>`;
        } else {
            showCompareView(slug, filename);
        }
    };

    try {
        const response = await fetch(`/api/games/${slug}/file/${encodeURIComponent(filename)}`);
        const text = await response.text();
        currentFileContent = text;
        body.innerHTML = escapeHtml(text);
    } catch (err) {
        body.innerHTML = `Error loading file: ${err.message}`;
    }
}

/**
 * Show side-by-side diff comparison with S3
 */
async function showCompareView(slug, filename) {
    const viewer = document.getElementById('game-file-viewer');
    const title = viewer.querySelector('.file-viewer-title');
    const bodyContainer = viewer.querySelector('.file-viewer-body');

    viewer.classList.remove('edit-mode');
    viewer.classList.add('compare-mode');
    title.textContent = `${filename} (Local ↔ S3)`;

    bodyContainer.innerHTML = `
        <div class="compare-container">
            <div class="compare-pane local">
                <div class="compare-label">Local</div>
                <pre><code>Loading...</code></pre>
            </div>
            <div class="compare-pane s3">
                <div class="compare-label">S3 (Production)</div>
                <pre><code>Loading...</code></pre>
            </div>
        </div>
    `;

    // Load both versions (S3 doesn't have games/ prefix)
    const [localContent, s3Content] = await Promise.all([
        fetch(`/api/games/${slug}/file/${encodeURIComponent(filename)}`)
            .then(r => r.ok ? r.text() : '[File not found locally]')
            .catch(() => '[Error loading local file]'),
        fetch(`/api/s3/get?key=${slug}/${encodeURIComponent(filename)}`)
            .then(r => r.ok ? r.text() : '[File not found in S3]')
            .catch(() => '[Error loading S3 file]'),
    ]);

    bodyContainer.querySelector('.compare-pane.local code').innerHTML = escapeHtml(localContent);
    bodyContainer.querySelector('.compare-pane.s3 code').innerHTML = escapeHtml(s3Content);

    // Highlight differences
    if (localContent !== s3Content && !localContent.startsWith('[') && !s3Content.startsWith('[')) {
        bodyContainer.querySelector('.compare-pane.local').classList.add('has-diff');
        bodyContainer.querySelector('.compare-pane.s3').classList.add('has-diff');
    }
}

/**
 * Initialize the games/workspace tab
 */
export function init() {
    // Load orgs first
    loadOrgs();

    // Org selector change handler
    document.getElementById('org-select').addEventListener('change', (e) => {
        switchOrg(e.target.value);
    });

    // Refresh button (in header)
    document.getElementById('refresh-games').addEventListener('click', () => loadGames(true));

    // Back button
    document.getElementById('game-back-btn').addEventListener('click', showCardsView);

    // Launch button
    document.getElementById('game-launch-btn').addEventListener('click', () => {
        if (!currentGame || !currentWorkspace) return;
        const gameDir = `${currentWorkspace.games_dir}/${currentGame.slug}`;
        window.open(`file://${gameDir}/${currentGame.entry || 'index.html'}`, '_blank');
    });

    // Refresh button (in detail view)
    document.getElementById('game-refresh-btn').addEventListener('click', async () => {
        if (!currentGame) return;
        const btn = document.getElementById('game-refresh-btn');
        btn.textContent = 'Refreshing...';
        try {
            await api(`/games/${currentGame.slug}/refresh`, { method: 'POST' });
            await loadGameFiles(currentGame.slug);
            btn.textContent = 'Refresh';
        } catch (err) {
            console.error('Refresh failed:', err);
            btn.textContent = 'Failed';
            setTimeout(() => btn.textContent = 'Refresh', 2000);
        }
    });

    // Compare All button
    document.getElementById('game-compare-btn').addEventListener('click', showCompareAllSummary);

    // Initial load
    loadGames();
}

/**
 * Show summary comparison of all files between local and S3
 */
async function showCompareAllSummary() {
    if (!currentGame) return;

    const viewer = document.getElementById('game-file-viewer');
    const title = viewer.querySelector('.file-viewer-title');
    const bodyContainer = viewer.querySelector('.file-viewer-body');
    const compareBtn = viewer.querySelector('.compare-btn');

    viewer.classList.add('visible');
    viewer.classList.remove('compare-mode');
    title.textContent = `Sync Summary: ${currentGame.slug}`;
    compareBtn.style.display = 'none';

    bodyContainer.innerHTML = '<pre><code>Loading comparison...</code></pre>';

    try {
        const [localData, s3Data] = await Promise.all([
            api(`/games/${currentGame.slug}/files`),
            fetchS3Files(currentGame.slug).catch(() => ({ files: [] })),
        ]);

        const s3Map = new Map(s3Data.files.map(f => [f.name, f]));
        const localMap = new Map(localData.files.map(f => [f.name, f]));
        const allNames = new Set([...localMap.keys(), ...s3Map.keys()]);

        const summary = {
            synced: [],
            modified: [],
            localOnly: [],
            s3Only: [],
        };

        for (const name of allNames) {
            const local = localMap.get(name);
            const s3 = s3Map.get(name);

            if (local && s3) {
                if (local.size === s3.size) {
                    summary.synced.push(name);
                } else {
                    summary.modified.push({ name, localSize: local.size, s3Size: s3.size });
                }
            } else if (local && !s3) {
                summary.localOnly.push(name);
            } else if (!local && s3) {
                summary.s3Only.push(name);
            }
        }

        let html = `Sync Status for ${currentGame.slug}\n`;
        html += '═'.repeat(40) + '\n\n';

        html += `✓ Synced: ${summary.synced.length} files\n`;
        if (summary.synced.length > 0) {
            summary.synced.forEach(f => html += `  ${f}\n`);
        }
        html += '\n';

        html += `~ Modified: ${summary.modified.length} files\n`;
        if (summary.modified.length > 0) {
            summary.modified.forEach(f => {
                html += `  ${f.name} (local: ${formatBytes(f.localSize)}, S3: ${formatBytes(f.s3Size)})\n`;
            });
        }
        html += '\n';

        html += `+ Local only: ${summary.localOnly.length} files\n`;
        if (summary.localOnly.length > 0) {
            summary.localOnly.forEach(f => html += `  ${f}\n`);
        }
        html += '\n';

        html += `↓ S3 only: ${summary.s3Only.length} files\n`;
        if (summary.s3Only.length > 0) {
            summary.s3Only.forEach(f => html += `  ${f}\n`);
        }

        bodyContainer.innerHTML = `<pre><code>${escapeHtml(html)}</code></pre>`;
    } catch (err) {
        bodyContainer.innerHTML = `<pre><code>Error: ${err.message}</code></pre>`;
    }

    // Restore compare button visibility for next file view
    const closeBtn = viewer.querySelector('.close-viewer-btn');
    closeBtn.onclick = () => {
        viewer.classList.remove('visible');
        compareBtn.style.display = '';
    };
}
