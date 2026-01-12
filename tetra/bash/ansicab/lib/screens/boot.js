/**
 * Boot Screen - GAMMA ANSI Cabinet System Diagnostics
 *
 * Standard boot sequence with animated system check.
 * Duration: 3 seconds (90 frames @ 30fps)
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
  red: '\x1b[31m',
  white: '\x1b[37m',
  brightGreen: '\x1b[92m',
  brightCyan: '\x1b[96m',
  brightMagenta: '\x1b[95m',
  brightYellow: '\x1b[93m',
  brightWhite: '\x1b[97m',
};

// GAMMA ASCII logo (block letters)
const GAMMA_LOGO = [
  '  ██████╗  █████╗ ███╗   ███╗███╗   ███╗ █████╗ ',
  ' ██╔════╝ ██╔══██╗████╗ ████║████╗ ████║██╔══██╗',
  ' ██║  ███╗███████║██╔████╔██║██╔████╔██║███████║',
  ' ██║   ██║██╔══██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║',
  ' ╚██████╔╝██║  ██║██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║',
  '  ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝',
];

const ARCADE_TEXT = 'A N S I   C A B I N E T';

/**
 * Render boot screen with phased animation
 * @param {Object} context - Rendering context
 * @param {number} context.frame - Current frame in boot sequence (0-89)
 * @param {number} context.width - Display width in characters
 * @param {number} context.height - Display height in lines
 * @param {Object} context.info - System info to display
 * @returns {string} ANSI-formatted display string
 */
function renderBootScreen(context) {
  const { frame, width, height, info = {} } = context;
  const lines = [];

  // Calculate animation phases
  const logoRevealEnd = 30;      // 0-30: Logo reveal
  const diagStartFrame = 30;     // 30-90: Diagnostics
  const readyFrame = 75;         // 75+: Press PLAY prompt

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

  const innerWidth = width - 4; // Account for border

  // Top border
  lines.push(C.cyan + '╔' + '═'.repeat(width - 2) + '╗' + C.reset);

  // Empty line
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // GAMMA logo with reveal animation
  const logoCharsToShow = frame < logoRevealEnd
    ? Math.floor((frame / logoRevealEnd) * GAMMA_LOGO[0].length)
    : GAMMA_LOGO[0].length;

  for (const logoLine of GAMMA_LOGO) {
    const revealed = logoLine.substring(0, logoCharsToShow);
    const centered = center(C.brightMagenta + revealed + C.reset, innerWidth);
    lines.push(C.cyan + '║' + padLine(centered, width - 2) + '║' + C.reset);
  }

  // ARCADE subtitle (fade in after logo)
  const arcadeVisible = frame > 20;
  const arcadeColor = arcadeVisible ? C.cyan : C.dim;
  const arcadeLine = arcadeVisible ? ARCADE_TEXT : '';
  lines.push(C.cyan + '║' + padLine(center(arcadeColor + arcadeLine + C.reset, innerWidth), width - 2) + '║' + C.reset);

  // Empty line
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Diagnostics panel
  const diagBoxWidth = Math.min(52, innerWidth - 4);
  const diagLeft = Math.floor((innerWidth - diagBoxWidth) / 2);

  // Diagnostics appear sequentially
  const diagnostics = [
    { label: 'Display', value: `${info.cols || 60}×${info.rows || 30} chars`, frame: 35 },
    { label: 'Charset', value: 'UTF-8/Box', frame: 45 },
    { label: 'Driver', value: info.gameName || 'GAMMA', frame: 55 },
    { label: 'Match', value: info.matchCode || '----', frame: 60 },
    { label: 'Audio', value: 'TIA/QUASAR', frame: 65 },
  ];

  // Diagnostics header
  if (frame >= diagStartFrame) {
    const headerLine = ' '.repeat(diagLeft) + '┌' + '─'.repeat(diagBoxWidth - 2) + '┐';
    lines.push(C.cyan + '║' + padLine(headerLine, width - 2) + '║' + C.reset);

    const titleLine = ' '.repeat(diagLeft) + '│' +
      C.brightCyan + ' SYSTEM DIAGNOSTICS' + C.reset +
      ' '.repeat(diagBoxWidth - 22) + C.dim + 'v1.0 ' + C.reset + '│';
    lines.push(C.cyan + '║' + padLine(titleLine, width - 2) + '║' + C.reset);

    const sepLine = ' '.repeat(diagLeft) + '├' + '─'.repeat(diagBoxWidth - 2) + '┤';
    lines.push(C.cyan + '║' + padLine(sepLine, width - 2) + '║' + C.reset);
  } else {
    // Empty lines before diagnostics appear
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Diagnostic rows
  for (const diag of diagnostics) {
    if (frame >= diagStartFrame) {
      const visible = frame >= diag.frame;
      const labelPad = 12;
      const valuePad = 16;
      const progressWidth = 12;

      let rowContent;
      if (visible) {
        const progress = '░'.repeat(progressWidth);
        const status = C.brightGreen + '[OK]' + C.reset;
        rowContent = `  ${diag.label.padEnd(labelPad, '.')} ${C.white}${diag.value.padEnd(valuePad)}${C.reset} ${C.dim}${progress}${C.reset} ${status}`;
      } else {
        rowContent = '  ' + '.'.repeat(diagBoxWidth - 6);
      }

      const diagLine = ' '.repeat(diagLeft) + '│' + rowContent.substring(0, diagBoxWidth - 2).padEnd(diagBoxWidth - 2) + '│';
      lines.push(C.cyan + '║' + padLine(diagLine, width - 2) + '║' + C.reset);
    } else {
      lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
    }
  }

  // Diagnostics footer
  if (frame >= diagStartFrame) {
    const footerLine = ' '.repeat(diagLeft) + '└' + '─'.repeat(diagBoxWidth - 2) + '┘';
    lines.push(C.cyan + '║' + padLine(footerLine, width - 2) + '║' + C.reset);
  } else {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Empty line
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // PRESS PLAY prompt (pulsing after ready)
  if (frame >= readyFrame) {
    const pulse = Math.floor(frame / 15) % 2 === 0;
    const promptColor = pulse ? C.brightYellow : C.yellow;
    const promptText = '▶ ▶ ▶  P R E S S   P L A Y  ◀ ◀ ◀';
    lines.push(C.cyan + '║' + padLine(center(promptColor + promptText + C.reset, innerWidth), width - 2) + '║' + C.reset);
  } else {
    lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  // Empty line
  lines.push(C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);

  // Divider
  lines.push(C.cyan + '╠' + '═'.repeat(width - 2) + '╣' + C.reset);

  // Footer with live info
  const footerText = `TETRA FRAMEWORK    │  Match: ${info.matchCode || '----'}  │  Players: ${info.playerCount || 0}/${info.maxPlayers || 4}`;
  lines.push(C.cyan + '║' + padLine(center(C.dim + footerText + C.reset, innerWidth), width - 2) + '║' + C.reset);

  // Bottom border
  lines.push(C.cyan + '╚' + '═'.repeat(width - 2) + '╝' + C.reset);

  // Pad to fill height
  while (lines.length < height) {
    lines.splice(lines.length - 1, 0, C.cyan + '║' + padLine('', width - 2) + '║' + C.reset);
  }

  return lines.join('\n');
}

module.exports = { renderBootScreen, GAMMA_LOGO, ARCADE_TEXT, C };
