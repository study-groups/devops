/**
 * Games/Workspace tab module
 * Manages local workspace with org selection
 */

import { api } from './api.js';

let currentOrg = null;

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
        const workspace = await api('/workspace');
        const url = refresh ? '/games?refresh=true' : '/games';
        const manifest = await api(url);

        // Build info line
        const infoLine = `${workspace.org} | ${manifest.count} games | ${workspace.games_dir}`;
        workspaceInfo.innerHTML = `<span class="workspace-org">${workspace.org}</span> | ${manifest.count} games | <code>${workspace.games_dir}</code>`;

        if (manifest.games.length === 0) {
            gamesList.innerHTML = '<div class="empty-state">No games in workspace</div>';
            return;
        }

        manifest.games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.innerHTML = `
                <h3>${game.name}</h3>
                <div class="slug">${game.slug} v${game.version}</div>
                <p>${game.description || 'No description'}</p>
                <div class="meta">
                    ${(game.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
                    ${game.requires_auth ? `<span class="tag auth">🔒 ${game.min_role}</span>` : ''}
                </div>
            `;
            gamesList.appendChild(card);
        });
    } catch (err) {
        workspaceInfo.textContent = 'Error loading workspace';
        gamesList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
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
