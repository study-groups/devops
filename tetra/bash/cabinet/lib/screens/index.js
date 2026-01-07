/**
 * Cabinet Screen Templates
 *
 * Standard screen renderers for GAMMA ANSI Cabinet games.
 * Use these for consistent branding and UX across all games.
 */

const { renderBootScreen, GAMMA_LOGO, ARCADE_TEXT, C } = require('./boot.js');
const { renderCreditsScreen, renderLoadScreen, TETRA_LOGO } = require('./credits.js');
const { renderTitleScreen, renderWaitingScreen, renderGameoverScreen } = require('./title.js');

module.exports = {
  // Boot sequence
  renderBootScreen,
  renderCreditsScreen,
  renderLoadScreen,

  // Game screens
  renderTitleScreen,
  renderWaitingScreen,
  renderGameoverScreen,

  // ASCII art assets
  GAMMA_LOGO,
  TETRA_LOGO,
  ARCADE_TEXT,

  // Color palette
  C,
};
