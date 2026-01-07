/**
 * Games Listing Page
 */

export const GamesPage = {
  render() {
    return `
      <div class="page page-games">
        <header class="header">
          <div class="logo">PIXELJAM</div>
          <nav class="nav">
            <a href="#/" class="nav-link">Home</a>
            <a href="#/games" class="nav-link active">Games</a>
          </nav>
          <button class="theme-toggle" data-action="theme:next" title="Change theme">
            <span class="theme-icon"></span>
          </button>
        </header>

        <main class="main">
          <div class="page-header">
            <h1>All Games</h1>
            <div class="filters">
              <button class="filter-btn active" data-filter="all">All</button>
              <button class="filter-btn" data-filter="arcade">Arcade</button>
              <button class="filter-btn" data-filter="puzzle">Puzzle</button>
              <button class="filter-btn" data-filter="action">Action</button>
            </div>
          </div>

          <div class="game-grid" id="gamesGrid">
            <div class="loading-state">Loading games...</div>
          </div>
        </main>

        <footer class="footer">
          <p>&copy; Pixeljam</p>
        </footer>
      </div>
    `;
  },

  mount(container) {
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
          <article class="game-card" data-action="navigate" data-to="/play/${game.slug}">
            <div class="game-card-thumb" style="background: var(--color-surface);">
              ${game.thumb
                ? `<img src="/api/game-files/${game.thumb}" alt="${game.name}" loading="lazy">`
                : `<span class="game-icon">${(game.name || game.slug)[0].toUpperCase()}</span>`
              }
            </div>
            <h3 class="game-card-title">${game.name || game.slug}</h3>
            <p class="game-card-desc">${game.description || ''}</p>
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
