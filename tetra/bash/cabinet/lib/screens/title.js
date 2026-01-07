/**
 * Title Screen - Game-specific title with attract mode transition
 *
 * Standard title screen with game name and "PRESS PLAY" prompt.
 * Transitions to attract mode after 10 seconds of inactivity.
 */

// ANSI color codes
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  brightCyan: '\x1b[96m',
  brightMagenta: '\x1b[95m',
  brightYellow: '\x1b[93m',
  brightGreen: '\x1b[92m',
  brightWhite: '\x1b[97m',
};

/**
 * Render title screen
 * @param {Object} context - Rendering context
 * @param {number} context.frame - Current frame
 * @param {number} context.width - Display width
 * @param {number} context.height - Display height
 * @param {Object} context.info - Game info (gameName, etc.)
 * @param {string[]} context.logo - Optional ASCII logo lines
 * @returns {string} ANSI-formatted display string
 */
function renderTitleScreen(context) {
  const { frame, width, height, info = {}, logo = [] } = context;
  const lines = [];

  // Helper: center text with padding
  const center = (str, w) => {
    const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, '').length;
    if (visibleLen >= w) return str;
    const pad = w - visibleLen;
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  };

  // Helper: pad line to full width
  const padLine = (str, w) => {
    const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, '').length;
    if (visibleLen >= w) return str;
    return str + ' '.repeat(w - visibleLen);
  };

  const innerWidth = width - 4;
  const gameName = info.gameName || 'GAME';

  // Top border
  lines.push(C.cyan + '╔' + '═'.repeat(width - 2) + '╗' + C.reset);

  // Calculate vertical centering
  const logoHeight = logo.length || 0;
  const contentHeight = logoHeight + 8; // Logo + spacing + text
  const topPad = Math.floor((height - 2 - contentHeight) / 2);

  for (let i = 0; i < topPad; i++) {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Game logo (if provided)
  if (logo.length > 0) {
    for (const logoLine of logo) {
      const centered = center(C.brightMagenta + logoLine + C.reset, innerWidth);
      lines.push(C.cyan + '║' + padLine(centered, width - 2) + '║' + C.reset);
    }
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  } else {
    // Default: spaced game name
    const spacedName = gameName.split('').join(' ');
    lines.push(C.cyan + '║' + padLine(center(C.brightCyan + spacedName + C.reset, innerWidth), width - 2) + '║' + C.reset);
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Empty lines
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // PRESS PLAY prompt (pulsing)
  const pulse = Math.floor(frame / 15) % 2 === 0;
  const promptColor = pulse ? C.brightYellow : C.yellow;
  const promptText = '▶ ▶ ▶  P R E S S   P L A Y  ◀ ◀ ◀';
  lines.push(C.cyan + '║' + padLine(center(promptColor + promptText + C.reset, innerWidth), width - 2) + '║' + C.reset);

  // Empty lines
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Player info
  const playerInfo = `Players: ${info.playerCount || 0}/${info.maxPlayers || 4}`;
  lines.push(C.cyan + '║' + padLine(center(C.dim + playerInfo + C.reset, innerWidth), width - 2) + '║' + C.reset);

  // Pad remaining space
  const bottomPad = height - lines.length - 1;
  for (let i = 0; i < bottomPad; i++) {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Bottom border
  lines.push(C.cyan + '╚' + '═'.repeat(width - 2) + '╝' + C.reset);

  return lines.join('\n');
}

/**
 * Render waiting screen (waiting for PLAY button)
 * Similar to title but with different messaging
 */
function renderWaitingScreen(context) {
  return renderTitleScreen(context);
}

/**
 * Render gameover screen
 * @param {Object} context - Rendering context
 * @param {string} context.winner - Winner identifier (p1, p2, etc.)
 * @param {Object} context.scores - Score object { p1: n, p2: n, ... }
 */
function renderGameoverScreen(context) {
  const { frame, width, height, winner, scores = {} } = context;
  const lines = [];

  const center = (str, w) => {
    const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, '').length;
    if (visibleLen >= w) return str;
    const pad = w - visibleLen;
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  };

  const padLine = (str, w) => {
    const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, '').length;
    if (visibleLen >= w) return str;
    return str + ' '.repeat(w - visibleLen);
  };

  const innerWidth = width - 4;

  // Top border
  lines.push(C.cyan + '╔' + '═'.repeat(width - 2) + '╗' + C.reset);

  // Vertical centering
  const topPad = Math.floor((height - 14) / 2);
  for (let i = 0; i < topPad; i++) {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // GAME OVER text
  const gameOverText = 'G A M E   O V E R';
  const pulse = Math.floor(frame / 20) % 2 === 0;
  const gameOverColor = pulse ? C.brightYellow : C.yellow;
  lines.push(C.cyan + '║' + padLine(center(gameOverColor + gameOverText + C.reset, innerWidth), width - 2) + '║' + C.reset);
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Winner announcement
  if (winner) {
    const winnerText = `${winner.toUpperCase()} WINS!`;
    lines.push(C.cyan + '║' + padLine(center(C.brightGreen + winnerText + C.reset, innerWidth), width - 2) + '║' + C.reset);
  }
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Final scores
  const scoreEntries = Object.entries(scores);
  if (scoreEntries.length > 0) {
    const scoreText = scoreEntries.map(([slot, score]) => `${slot.toUpperCase()}:${score}`).join('  ');
    lines.push(C.cyan + '║' + padLine(center(C.dim + scoreText + C.reset, innerWidth), width - 2) + '║' + C.reset);
  }
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Restart prompt
  const restartText = 'Press PLAY to continue';
  lines.push(C.cyan + '║' + padLine(center(C.dim + restartText + C.reset, innerWidth), width - 2) + '║' + C.reset);

  // Pad remaining space
  const bottomPad = height - lines.length - 1;
  for (let i = 0; i < bottomPad; i++) {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Bottom border
  lines.push(C.cyan + '╚' + '═'.repeat(width - 2) + '╝' + C.reset);

  return lines.join('\n');
}

module.exports = { renderTitleScreen, renderWaitingScreen, renderGameoverScreen, C };
