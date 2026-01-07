/**
 * Play Game Page
 */

export const PlayPage = {
  render(params) {
    const gameId = params.gameId || 'unknown';

    return `
      <div class="page page-play">
        <header class="header header-minimal">
          <a href="#/games" class="back-link" data-action="navigate" data-to="/games">
            &larr; Back to Games
          </a>
          <div class="logo">PIXELJAM</div>
          <button class="theme-toggle" data-action="theme:next" title="Change theme">
            <span class="theme-icon"></span>
          </button>
        </header>

        <main class="main main-game">
          <div class="game-container">
            <div class="game-frame-wrapper">
              <iframe
                id="gameFrame"
                class="game-frame"
                src="about:blank"
                allowfullscreen
              ></iframe>
              <div class="game-loading" id="gameLoading">
                <div class="loading-spinner"></div>
                <p>Loading game...</p>
              </div>
            </div>

            <div class="game-info">
              <h1 class="game-title" id="gameTitle">Loading...</h1>
              <div class="game-controls">
                <button class="btn" id="fullscreenBtn">Fullscreen</button>
                <button class="btn" id="resetBtn">Reset</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  },

  mount(container, params) {
    const gameId = params.gameId;
    console.log('[PlayPage] Mounted, gameId:', gameId);

    const frame = container.querySelector('#gameFrame');
    const loading = container.querySelector('#gameLoading');
    const title = container.querySelector('#gameTitle');
    const fullscreenBtn = container.querySelector('#fullscreenBtn');
    const resetBtn = container.querySelector('#resetBtn');

    // Fetch game metadata and load
    fetch(`/api/games/${gameId}`)
      .then(r => {
        if (!r.ok) throw new Error('Game not found');
        return r.json();
      })
      .then(game => {
        console.log('[PlayPage] Game loaded:', game.slug);

        // Update title
        title.textContent = game.name || game.slug;

        // Build game URL from url_path or engine.path
        const gamePath = game.url_path || game.engine?.path;
        if (!gamePath) {
          throw new Error('Game has no playable path');
        }

        frame.src = `/api/game-files/${gamePath}`;

        // Hide loading when iframe loads
        frame.onload = () => {
          loading.style.display = 'none';
        };
      })
      .catch(err => {
        console.error('[PlayPage] Error:', err);
        loading.innerHTML = `<p class="error-state">Game not found: ${gameId}</p>`;
      });

    // Fullscreen handler
    if (fullscreenBtn && frame) {
      fullscreenBtn.addEventListener('click', () => {
        if (frame.requestFullscreen) {
          frame.requestFullscreen();
        }
      });
    }

    // Reset handler - reload iframe
    if (resetBtn && frame) {
      resetBtn.addEventListener('click', () => {
        const src = frame.src;
        frame.src = 'about:blank';
        setTimeout(() => { frame.src = src; }, 100);
      });
    }
  }
};
