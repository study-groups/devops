/**
 * Header Component
 * Logo, navigation, and theme selector
 */

export const Header = {
  render(activePath = '/') {
    const navLinks = [
      { href: '#/', label: 'Home', path: '/' },
      { href: '#/games', label: 'Games', path: '/games' },
      { href: '#/account', label: 'Account', path: '/account' }
    ];

    return `
      <!-- Header bar (behind logo) -->
      <header class="header"></header>

      <!-- Logo container with overhang -->
      <div class="logo-container chunky-shadow-title">
        <a href="#/" class="logo" aria-label="Pixeljam Arcade">
          <div class="logo-wrapper">
            <svg class="logo-front" viewBox="0 0 252 52">
              <use href="#svg_arcade_logo"/>
            </svg>
            <svg class="logo-shadow" viewBox="0 0 252 52">
              <use href="#svg_arcade_logo"/>
            </svg>
          </div>
        </a>
      </div>

      <!-- Centered navigation -->
      <nav class="nav">
        ${navLinks.map(link => `
          <a href="${link.href}" class="nav-link${activePath === link.path ? ' active' : ''}">${link.label}</a>
        `).join('')}
      </nav>

      <!-- Secondary navigation with overhang -->
      <div class="secondary-nav chunky-shadow-title">
        <button class="theme-selector" data-action="theme:next" title="Change theme">
          <span class="theme-name" id="currentTheme">lava</span>
          <div class="theme-colors">
            <div class="color-bar" style="background: var(--paper-dark)"></div>
            <div class="color-bar" style="background: var(--paper-mid)"></div>
            <div class="color-bar" style="background: var(--paper-light)"></div>
            <div class="color-bar" style="background: var(--ink)"></div>
            <div class="color-bar" style="background: var(--four)"></div>
            <div class="color-bar" style="background: var(--two)"></div>
            <div class="color-bar" style="background: var(--three)"></div>
            <div class="color-bar" style="background: var(--one)"></div>
          </div>
        </button>
      </div>
    `;
  },

  mount(container) {
    const themeSpan = container.querySelector('#currentTheme');
    if (themeSpan && window.PJA?.services?.theme) {
      window.PJA.services.theme.subscribe((theme) => {
        themeSpan.textContent = theme;
      });
    }
  }
};
