/**
 * Footer Component
 * Site footer with links and logo
 */

export const Footer = {
  render() {
    return `
      <footer class="footer">
        <div class="footer-content">
          <nav class="footer-nav">
            <a href="#/about" class="footer-link">About</a>
            <a href="#/terms" class="footer-link">Terms</a>
          </nav>
          <div class="footer-logo-card chunky-shadow-paper-dark">
            <svg viewBox="0 0 252 52" aria-label="Pixeljam Arcade">
              <use href="#svg_arcade_logo"/>
            </svg>
          </div>
        </div>
      </footer>
    `;
  }
};
