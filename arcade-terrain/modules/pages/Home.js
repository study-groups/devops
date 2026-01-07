/**
 * Home Page
 */

export const HomePage = {
  render() {
    return `
      <div class="page page-home">
        <header class="header">
          <div class="logo">PIXELJAM</div>
          <nav class="nav">
            <a href="#/" class="nav-link active">Home</a>
            <a href="#/games" class="nav-link">Games</a>
          </nav>
          <button class="theme-toggle" data-action="theme:next" title="Change theme">
            <span class="theme-icon"></span>
          </button>
        </header>

        <main class="main">
          <section class="hero">
            <h1 class="hero-title">Pixeljam Arcade</h1>
            <p class="hero-subtitle">Retro gaming, reimagined</p>
            <a href="#/games" class="btn btn-primary" data-action="navigate" data-to="/games">
              Browse Games
            </a>
          </section>

          <section class="featured">
            <h2>Featured Games</h2>
            <div class="game-grid" id="featuredGames">
              <!-- Games loaded dynamically -->
              <div class="game-card placeholder">
                <div class="game-card-thumb"></div>
                <div class="game-card-title">Loading...</div>
              </div>
            </div>
          </section>
        </main>

        <footer class="footer">
          <p>&copy; Pixeljam</p>
          <p class="theme-indicator">
            Theme: <span id="currentTheme">${window.PJA?.services?.theme?.get() || 'lava'}</span>
          </p>
        </footer>
      </div>
    `;
  },

  mount(container) {
    // Subscribe to theme changes to update indicator
    const themeSpan = container.querySelector('#currentTheme');
    if (themeSpan && window.PJA?.services?.theme) {
      window.PJA.services.theme.subscribe((theme) => {
        themeSpan.textContent = theme;
      });
    }

    console.log('[HomePage] Mounted');
  }
};
