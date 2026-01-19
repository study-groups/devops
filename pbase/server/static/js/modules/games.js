/**
 * Games/Workspace tab module
 * Manages local workspace with org selection and game details
 */

import { api, formatBytes } from './api.js';

let currentOrg = null;
let currentWorkspace = null;

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
 * Open game detail modal
 */
async function openGameDetail(game) {
    const modal = document.getElementById('game-detail-modal');
    const title = document.getElementById('game-detail-title');

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
        <dt>Local Path</dt><dd>${gameDir}</dd>
        <dt>S3 Key</dt><dd>games/${game.slug}/</dd>
    `;

    // Setup launch button
    const launchBtn = document.getElementById('game-launch-btn');
    launchBtn.onclick = () => {
        window.open(`file://${gameDir}/${game.entry || 'index.html'}`, '_blank');
    };

    // Setup refresh button
    const refreshBtn = document.getElementById('game-refresh-btn');
    refreshBtn.onclick = async () => {
        refreshBtn.textContent = 'Refreshing...';
        try {
            await api(`/games/${game.slug}/refresh`, { method: 'POST' });
            await loadGameFiles(game.slug);
            refreshBtn.textContent = 'Refresh';
        } catch (err) {
            console.error('Refresh failed:', err);
            refreshBtn.textContent = 'Failed';
            setTimeout(() => refreshBtn.textContent = 'Refresh', 2000);
        }
    };

    // Load files
    await loadGameFiles(game.slug);

    modal.showModal();
}

/**
 * Load game files into the modal
 */
async function loadGameFiles(slug) {
    const tbody = document.querySelector('#game-files tbody');
    tbody.innerHTML = '<tr><td colspan="3">Loading files...</td></tr>';

    try {
        const data = await api(`/games/${slug}/files`);

        if (data.files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">No files found</td></tr>';
            return;
        }

        tbody.innerHTML = data.files.map(file => {
            const modified = file.lastModified
                ? new Date(file.lastModified).toLocaleString()
                : 'Unknown';
            return `
                <tr>
                    <td>${file.name}</td>
                    <td class="size">${formatBytes(file.size)}</td>
                    <td class="date">${modified}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3">Error: ${err.message}</td></tr>`;
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

    // Refresh button
    document.getElementById('refresh-games').addEventListener('click', () => loadGames(true));

    // Initial load
    loadGames();
}
