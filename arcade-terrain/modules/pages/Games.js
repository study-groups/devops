/**
 * Games Listing Page
 */

import { Header } from '../components/Header.js';
import { Footer } from '../components/Footer.js';

export const GamesPage = {
  render() {
    return `
      <div class="page page-games">
        ${Header.render('/games')}

        <main class="main">
          <div class="games-grid" id="gamesGrid">
            <div class="loading-state">Loading games...</div>
          </div>
        </main>

        ${Footer.render()}
      </div>
    `;
  },

  mount(container) {
    Header.mount(container);
    console.log('[GamesPage] Mounted');

    const grid = container.querySelector('#gamesGrid');

    fetch('/api/games')
      .then(r => r.json())
      .then(({ games }) => {
        if (!games || games.length === 0) {
          grid.innerHTML = '<p class="empty-state">No games available</p>';
          return;
        }

        grid.innerHTML = games.map(game => `
          <article class="game-card-large" data-action="navigate" data-to="/play/${game.slug}">
            <div class="game-card-image">
              ${game.thumb
                ? `<div class="game-thumb" style="background-image: url('/api/game-files/${game.thumb}')"></div>`
                : `<div class="game-thumb-placeholder"><span>${(game.name || game.slug)[0].toUpperCase()}</span></div>`
              }
            </div>
            <div class="game-card-info">
              <h3 class="game-card-title">${game.name || game.slug}</h3>
              ${game.description ? `<p class="game-card-desc">${game.description}</p>` : ''}
            </div>
          </article>
        `).join('');

        console.log(`[GamesPage] Loaded ${games.length} games`);
      })
      .catch(err => {
        console.error('[GamesPage] Error loading games:', err);
        grid.innerHTML = '<p class="error-state">Failed to load games</p>';
      });
  }
};
