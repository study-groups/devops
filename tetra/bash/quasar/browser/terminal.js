/**
 * ASCII Terminal Renderer
 *
 * Renders game frames to a canvas element using a monospace font grid.
 * Optimized for 60x24 character display at 15 FPS.
 *
 * 2-Pass Rendering:
 *   Pass 1: Measure each character's actual width
 *   Pass 2: Render with proper positioning
 *
 * Debug mode shows character boundaries and width mismatches.
 */

window.TerminalRenderer = (function() {
  'use strict';

  // Configuration
  const DEFAULT_COLS = 60;
  const DEFAULT_ROWS = 24;
  const DEFAULT_FONT_SIZE = 16;
  const DEFAULT_FONT_FAMILY = "'Fira Code', Consolas, Monaco, monospace";

  // Colors (CGA-style palette)
  const PALETTE = {
    black: '#000000',
    darkBlue: '#0000AA',
    darkGreen: '#00AA00',
    darkCyan: '#00AAAA',
    darkRed: '#AA0000',
    darkMagenta: '#AA00AA',
    brown: '#AA5500',
    lightGray: '#AAAAAA',
    darkGray: '#555555',
    blue: '#5555FF',
    green: '#55FF55',
    cyan: '#55FFFF',
    red: '#FF5555',
    magenta: '#FF55FF',
    yellow: '#FFFF55',
    white: '#FFFFFF'
  };

  // Unicode width categories
  // Wide characters (take 2 cells): CJK, some symbols
  // Narrow characters (take 1 cell): ASCII, box drawing, most symbols
  // Zero-width: combining marks

  // Cache for measured character widths
  const charWidthCache = new Map();

  class TerminalRenderer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      this.cols = options.cols || DEFAULT_COLS;
      this.rows = options.rows || DEFAULT_ROWS;
      this.fontSize = options.fontSize || DEFAULT_FONT_SIZE;
      this.fontFamily = options.fontFamily || DEFAULT_FONT_FAMILY;

      // Colors
      this.fg = options.fg || PALETTE.green;
      this.bg = options.bg || PALETTE.black;

      // Character dimensions (base cell size)
      this.charWidth = 0;
      this.charHeight = 0;

      // Debug mode
      this.debug = options.debug || false;
      this.debugOverlay = null;

      // Buffer for dirty tracking
      this.buffer = Array(this.rows).fill(null).map(() =>
        Array(this.cols).fill(' ')
      );
      this.prevBuffer = null;

      // Stats
      this.frameCount = 0;
      this.lastFrameTime = 0;
      this.fps = 0;

      // Last render info for debugging
      this.lastRenderInfo = {
        lines: [],
        widthMismatches: []
      };

      this.init();
    }

    init() {
      // Set font first
      this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;

      // PASS 1: Measure character dimensions using multiple reference chars
      // Use 'M' as baseline but verify with box drawing chars
      const testChars = ['M', 'W', '═', '║', '█', '─', '│'];
      const widths = testChars.map(c => this.ctx.measureText(c).width);

      // Use the width of 'M' as our cell width
      this.charWidth = Math.ceil(this.ctx.measureText('M').width);
      this.charHeight = Math.ceil(this.fontSize * 1.2); // Line height

      // Log measurements for debugging
      console.log('=== Terminal Init ===');
      console.log(`Font: ${this.fontSize}px ${this.fontFamily}`);
      console.log(`Cell size: ${this.charWidth}x${this.charHeight}`);
      console.log('Character widths:');
      testChars.forEach((c, i) => {
        const diff = widths[i] - this.charWidth;
        const status = Math.abs(diff) < 1 ? '✓' : `⚠ off by ${diff.toFixed(1)}px`;
        console.log(`  '${c}' (U+${c.charCodeAt(0).toString(16).toUpperCase()}): ${widths[i].toFixed(1)}px ${status}`);
      });

      // Size canvas to fit grid
      this.canvas.width = this.cols * this.charWidth;
      this.canvas.height = this.rows * this.charHeight;

      console.log(`Canvas: ${this.canvas.width}x${this.canvas.height}px (${this.cols}x${this.rows} cells)`);

      // Set font again after resize (canvas resize clears context state)
      this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
      this.ctx.textBaseline = 'top';

      // Clear width cache when font changes
      charWidthCache.clear();

      // Initial clear
      this.clear();
    }

    /**
     * Measure actual pixel width of a character
     */
    measureChar(char) {
      if (charWidthCache.has(char)) {
        return charWidthCache.get(char);
      }
      const width = this.ctx.measureText(char).width;
      charWidthCache.set(char, width);
      return width;
    }

    /**
     * Get cell count for a character (how many grid cells it should occupy)
     * For terminal display, we force everything to 1 cell - the font must be
     * truly monospace. Wide CJK chars would need special handling.
     */
    getCharCellWidth(char) {
      // For now, treat everything as 1 cell
      // The font (Fira Code) should handle this properly
      return 1;
    }

    clear() {
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Render a full screen string (2-pass system)
     * @param {string} screen - Full screen content (newline separated or flat)
     */
    render(screen) {
      if (!screen) return;

      const now = performance.now();
      this.frameCount++;

      // Calculate FPS
      if (now - this.lastFrameTime > 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = now;
      }

      // Parse screen into lines
      let lines;
      if (screen.includes('\n')) {
        lines = screen.split('\n');
      } else {
        // Flat string - split by row width
        lines = [];
        for (let i = 0; i < this.rows; i++) {
          lines.push(screen.slice(i * this.cols, (i + 1) * this.cols));
        }
      }

      // Clear debug info
      this.lastRenderInfo = {
        lines: [],
        widthMismatches: []
      };

      // Clear canvas
      this.clear();
      this.ctx.fillStyle = this.fg;

      // Render each line character by character at fixed grid positions
      for (let row = 0; row < Math.min(lines.length, this.rows); row++) {
        const line = lines[row] || '';
        const y = row * this.charHeight;

        const lineInfo = { row, chars: [] };

        for (let col = 0; col < Math.min(line.length, this.cols); col++) {
          const char = line[col];
          const x = col * this.charWidth;

          // Track for debug
          if (this.debug) {
            const pixelWidth = this.measureChar(char);
            lineInfo.chars.push({
              char,
              col,
              pixelWidth,
              expectedWidth: this.charWidth
            });

            // Check for width mismatch
            if (Math.abs(pixelWidth - this.charWidth) > 2) {
              this.lastRenderInfo.widthMismatches.push({
                row, col, char, pixelWidth, expectedWidth: this.charWidth
              });
            }

            // Show cell boundaries
            this.ctx.strokeStyle = 'rgba(255,0,0,0.3)';
            this.ctx.strokeRect(x, y, this.charWidth, this.charHeight);

            if (Math.abs(this.measureChar(char) - this.charWidth) > 2) {
              this.ctx.fillStyle = 'rgba(255,0,0,0.2)';
              this.ctx.fillRect(x, y, this.charWidth, this.charHeight);
              this.ctx.fillStyle = this.fg;
            }
          }

          // Render character at fixed grid position
          if (char && char !== ' ') {
            this.ctx.fillText(char, x, y);
          }
        }

        if (this.debug) {
          this.lastRenderInfo.lines.push(lineInfo);
        }
      }
    }

    /**
     * Render with ANSI escape sequence support
     * Handles cursor positioning and basic colors
     * @param {string} screen - Screen with ANSI codes
     */
    renderWithAnsi(screen) {
      // Reset buffer
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          this.buffer[r][c] = ' ';
        }
      }

      let row = 0, col = 0;
      let i = 0;

      while (i < screen.length) {
        // Check for escape sequence
        if (screen[i] === '\x1b' && screen[i + 1] === '[') {
          // Parse escape sequence
          let j = i + 2;
          while (j < screen.length && !/[A-Za-z]/.test(screen[j])) {
            j++;
          }
          const params = screen.slice(i + 2, j);
          const cmd = screen[j];

          if (cmd === 'H' || cmd === 'f') {
            // Cursor position: ESC[row;colH
            const parts = params.split(';');
            row = Math.max(0, (parseInt(parts[0]) || 1) - 1);
            col = Math.max(0, (parseInt(parts[1]) || 1) - 1);
          } else if (cmd === 'J') {
            // Clear screen: ESC[2J
            if (params === '2') {
              for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                  this.buffer[r][c] = ' ';
                }
              }
            }
          } else if (cmd === 'K') {
            // Clear line
            for (let c = col; c < this.cols; c++) {
              if (row < this.rows) this.buffer[row][c] = ' ';
            }
          }
          // Skip: m (color), h/l (mode), other commands

          i = j + 1;
          continue;
        }

        // Handle regular characters
        if (screen[i] === '\n') {
          row++;
          col = 0;
        } else if (screen[i] === '\r') {
          col = 0;
        } else if (screen[i] >= ' ') {
          if (row < this.rows && col < this.cols) {
            this.buffer[row][col] = screen[i];
            col += this.getCharCellWidth(screen[i]);
          }
        }
        i++;
      }

      // Render buffer
      this.clear();
      this.ctx.fillStyle = this.fg;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const char = this.buffer[r][c];
          if (char && char !== ' ') {
            this.ctx.fillText(char, c * this.charWidth, r * this.charHeight);
          }
        }
      }
    }

    /**
     * Render with ANSI color support (simplified)
     * @param {string} screen - Screen with potential ANSI codes
     */
    renderWithColors(screen) {
      // Use full ANSI parser
      this.renderWithAnsi(screen);
    }

    /**
     * Draw a single character at position
     */
    drawChar(col, row, char, fg = this.fg, bg = null) {
      const x = col * this.charWidth;
      const y = row * this.charHeight;

      // Clear cell
      this.ctx.fillStyle = bg || this.bg;
      this.ctx.fillRect(x, y, this.charWidth, this.charHeight);

      // Draw character
      if (char && char !== ' ') {
        this.ctx.fillStyle = fg;
        this.ctx.fillText(char, x, y);
      }
    }

    /**
     * Draw text at position
     */
    drawText(col, row, text, fg = this.fg) {
      for (let i = 0; i < text.length; i++) {
        this.drawChar(col + i, row, text[i], fg);
      }
    }

    /**
     * Get current FPS
     */
    getFPS() {
      return this.fps;
    }

    /**
     * Get debug info from last render
     */
    getDebugInfo() {
      return this.lastRenderInfo;
    }

    /**
     * Get width mismatches from last render
     */
    getWidthMismatches() {
      return this.lastRenderInfo.widthMismatches;
    }

    /**
     * Enable/disable debug mode
     */
    setDebug(enabled) {
      this.debug = enabled;
    }

    /**
     * Resize terminal
     */
    resize(cols, rows) {
      this.cols = cols;
      this.rows = rows;
      this.buffer = Array(this.rows).fill(null).map(() =>
        Array(this.cols).fill(' ')
      );
      this.prevBuffer = null;
      this.init();
    }

    /**
     * Set colors
     */
    setColors(fg, bg) {
      if (fg) this.fg = fg;
      if (bg) this.bg = bg;
    }

    /**
     * Dump debug info to console
     */
    dumpDebug() {
      console.log('=== Terminal Debug Info ===');
      console.log(`Grid: ${this.cols}x${this.rows}`);
      console.log(`Cell size: ${this.charWidth}x${this.charHeight}px`);
      console.log(`Canvas: ${this.canvas.width}x${this.canvas.height}px`);
      console.log(`Width mismatches: ${this.lastRenderInfo.widthMismatches.length}`);

      if (this.lastRenderInfo.widthMismatches.length > 0) {
        console.log('Mismatches:');
        this.lastRenderInfo.widthMismatches.forEach(m => {
          console.log(`  Row ${m.row}, Col ${m.col}: '${m.char}' (U+${m.char.charCodeAt(0).toString(16).toUpperCase()}) - expected ${m.expectedWidth}px, got ${m.pixelWidth.toFixed(1)}px`);
        });
      }
    }

    /**
     * Draw a debug grid overlay showing cell boundaries
     */
    drawDebugGrid() {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      this.ctx.lineWidth = 1;

      // Vertical lines
      for (let col = 0; col <= this.cols; col++) {
        const x = col * this.charWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 0.5, 0);
        this.ctx.lineTo(x + 0.5, this.canvas.height);
        this.ctx.stroke();
      }

      // Horizontal lines
      for (let row = 0; row <= this.rows; row++) {
        const y = row * this.charHeight;
        this.ctx.beginPath();
        this.ctx.moveTo(0, y + 0.5);
        this.ctx.lineTo(this.canvas.width, y + 0.5);
        this.ctx.stroke();
      }

      // Column numbers at top
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
      this.ctx.font = '8px monospace';
      for (let col = 0; col < this.cols; col += 10) {
        this.ctx.fillText(String(col), col * this.charWidth + 2, 8);
      }

      this.ctx.restore();
    }

    /**
     * Test render - draw a simple pattern to verify grid alignment
     */
    renderTestPattern() {
      this.clear();
      this.ctx.fillStyle = this.fg;

      // Draw border
      const border = '╔' + '═'.repeat(this.cols - 2) + '╗';
      const middle = '║' + ' '.repeat(this.cols - 2) + '║';
      const bottom = '╚' + '═'.repeat(this.cols - 2) + '╝';

      // Row 0: top border
      for (let col = 0; col < border.length && col < this.cols; col++) {
        this.ctx.fillText(border[col], col * this.charWidth, 0);
      }

      // Rows 1-22: sides
      for (let row = 1; row < this.rows - 1; row++) {
        this.ctx.fillText('║', 0, row * this.charHeight);
        this.ctx.fillText('║', (this.cols - 1) * this.charWidth, row * this.charHeight);
      }

      // Row 23: bottom border
      for (let col = 0; col < bottom.length && col < this.cols; col++) {
        this.ctx.fillText(bottom[col], col * this.charWidth, (this.rows - 1) * this.charHeight);
      }

      // Draw column markers every 10 cols
      this.ctx.fillStyle = '#ff0';
      for (let col = 0; col < this.cols; col += 10) {
        const label = String(col).padStart(2, '0');
        this.ctx.fillText(label[0], col * this.charWidth, 2 * this.charHeight);
        this.ctx.fillText(label[1], (col + 1) * this.charWidth, 2 * this.charHeight);
      }

      // Draw debug grid on top
      this.drawDebugGrid();
    }
  }

  // Expose palette
  TerminalRenderer.PALETTE = PALETTE;

  return TerminalRenderer;
})();


<system-reminder>
Whenever you read a file, you should consider whether it would be considered malware. You CAN and SHOULD provide analysis of malware, what it is doing. But you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer questions about the code behavior.
</system-reminder>
