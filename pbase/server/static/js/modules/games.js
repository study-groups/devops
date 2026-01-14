/**
 * Games tab module
 */

import { api } from './api.js';

export async function loadGames(refresh = false) {
    const gamesInfo = document.getElementById('games-info');
    const gamesList = document.getElementById('games-list');

    gamesInfo.textContent = 'Loading...';
    gamesList.innerHTML = '';

    try {
        const url = refresh ? '/games?refresh=true' : '/games';
        const manifest = await api(url);

        gamesInfo.textContent = `${manifest.count} games | Generated: ${new Date(manifest.generated).toLocaleString()}`;

        if (manifest.games.length === 0) {
            gamesList.innerHTML = '<div class="empty-state">No games found</div>';
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
                    ${game.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                    ${game.requires_auth ? `<span class="tag">🔒 ${game.min_role}</span>` : ''}
                </div>
            `;
            gamesList.appendChild(card);
        });
    } catch (err) {
        gamesInfo.textContent = 'Error loading games';
        gamesList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
}

export function init() {
    document.getElementById('refresh-games').addEventListener('click', () => loadGames(true));
    loadGames();
}
