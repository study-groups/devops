/**
 * Credits Screen - TETRA Framework / GAMMA Arcade Branding
 *
 * Displays framework and arcade credits.
 * Duration: 2 seconds (60 frames @ 30fps), skippable with input
 */

// ANSI color codes
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',
  brightGreen: '\x1b[92m',
  brightCyan: '\x1b[96m',
  brightMagenta: '\x1b[95m',
  brightYellow: '\x1b[93m',
  brightWhite: '\x1b[97m',
};

// TETRA ASCII logo (simple block style)
const TETRA_LOGO = [
  '████████╗███████╗████████╗██████╗  █████╗ ',
  '╚══██╔══╝██╔════╝╚══██╔══╝██╔══██╗██╔══██╗',
  '   ██║   █████╗     ██║   ██████╔╝███████║',
  '   ██║   ██╔══╝     ██║   ██╔══██╗██╔══██║',
  '   ██║   ███████╗   ██║   ██║  ██║██║  ██║',
  '   ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝',
];

/**
 * Render credits screen with fade animation
 * @param {Object} context - Rendering context
 * @param {number} context.frame - Current frame in credits sequence (0-59)
 * @param {number} context.width - Display width in characters
 * @param {number} context.height - Display height in lines
 * @param {Object} context.info - Additional info to display
 * @returns {string} ANSI-formatted display string
 */
function renderCreditsScreen(context) {
  const { frame, width, height, info = {} } = context;
  const lines = [];

  // Animation phases
  const fadeInEnd = 15;         // 0-15: Fade in
  const holdEnd = 45;           // 15-45: Hold
  const fadeOutEnd = 60;        // 45-60: Fade out

  // Calculate opacity (0-1)
  let opacity = 1;
  if (frame < fadeInEnd) {
    opacity = frame / fadeInEnd;
  } else if (frame > holdEnd) {
    opacity = 1 - ((frame - holdEnd) / (fadeOutEnd - holdEnd));
  }

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

  // Choose color based on opacity
  const logoColor = opacity > 0.5 ? C.brightCyan : C.cyan;
  const textColor = opacity > 0.5 ? C.white : C.dim;

  const innerWidth = width - 4;

  // Top border
  lines.push(C.cyan + '╔' + '═'.repeat(width - 2) + '╗' + C.reset);

  // Padding to center content vertically
  const contentHeight = TETRA_LOGO.length + 6; // Logo + spacing + text
  const topPad = Math.floor((height - 2 - contentHeight) / 2);

  for (let i = 0; i < topPad; i++) {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // "POWERED BY" text
  if (opacity > 0.3) {
    lines.push(C.cyan + '║' + padLine(center(C.dim + 'POWERED BY' + C.reset, innerWidth), width - 2) + '║' + C.reset);
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  } else {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // TETRA logo
  for (const logoLine of TETRA_LOGO) {
    const centered = center(logoColor + logoLine + C.reset, innerWidth);
    lines.push(C.cyan + '║' + padLine(centered, width - 2) + '║' + C.reset);
  }

  // Empty line
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Framework subtitle
  if (opacity > 0.3) {
    lines.push(C.cyan + '║' + padLine(center(textColor + 'F R A M E W O R K' + C.reset, innerWidth), width - 2) + '║' + C.reset);
  } else {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

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
 * Render loading screen with progress indicator
 * @param {Object} context - Rendering context
 * @param {number} context.frame - Current frame
 * @param {number} context.width - Display width
 * @param {number} context.height - Display height
 * @param {Object} context.info - Load info (progress, gameName, etc.)
 * @returns {string} ANSI-formatted display string
 */
function renderLoadScreen(context) {
  const { frame, width, height, info = {} } = context;
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
  const progress = info.progress || 0; // 0-100

  // Top border
  lines.push(C.cyan + '╔' + '═'.repeat(width - 2) + '╗' + C.reset);

  // Padding to center content
  const topPad = Math.floor((height - 10) / 2);
  for (let i = 0; i < topPad; i++) {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Loading text
  lines.push(C.cyan + '║' + padLine(center(C.brightCyan + 'LOADING' + C.reset, innerWidth), width - 2) + '║' + C.reset);
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Game name
  lines.push(C.cyan + '║' + padLine(center(C.brightWhite + gameName + C.reset, innerWidth), width - 2) + '║' + C.reset);
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Progress bar
  const barWidth = Math.min(40, innerWidth - 4);
  const filled = Math.floor((progress / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  lines.push(C.cyan + '║' + padLine(center(C.green + bar + C.reset, innerWidth), width - 2) + '║' + C.reset);

  // Percentage
  lines.push(C.cyan + '║' + padLine(center(C.dim + `${progress}%` + C.reset, innerWidth), width - 2) + '║' + C.reset);

  // Spinner animation
  const spinChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const spinner = spinChars[frame % spinChars.length];
  lines.push(C.cyan + '║' + padLine(center(C.yellow + spinner + C.reset, innerWidth), width - 2) + '║' + C.reset);

  // Pad remaining space
  const bottomPad = height - lines.length - 1;
  for (let i = 0; i < bottomPad; i++) {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Bottom border
  lines.push(C.cyan + '╚' + '═'.repeat(width - 2) + '╝' + C.reset);

  return lines.join('\n');
}

module.exports = { renderCreditsScreen, renderLoadScreen, TETRA_LOGO, C };
