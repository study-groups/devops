/**
 * TetraUI TerminalOutput - Non-interactive terminal output display
 *
 * Usage:
 *   const term = TetraUI.TerminalOutput.create(container, opts);
 *   term.append('line of text');           // Add line (ANSI auto-parsed)
 *   term.appendRaw('<span>html</span>');   // Add pre-formatted HTML
 *   term.write('partial');                 // Write without newline
 *   term.clear();                          // Clear output
 *   term.scrollToBottom();                 // Scroll to end
 *   term.destroy();                        // Cleanup
 *
 * Options:
 *   maxLines: 1000          - Max lines to keep (0 = unlimited)
 *   autoScroll: true        - Auto-scroll on new content
 *   parseAnsi: true         - Parse ANSI escape codes
 *   showLineNumbers: false  - Show line numbers
 *   wrap: true              - Wrap long lines
 *
 * ANSI colors map to TDS design system:
 *   red/magenta -> --one (#ff6b6b)
 *   green/cyan  -> --two (#4ecdc4)
 *   yellow      -> --three (#ffe66d)
 *   blue        -> --four (#6b5ce7)
 */

window.TetraUI = window.TetraUI || {};

TetraUI.TerminalOutput = {
    // TDS color palette (direct hex for inline styles)
    colors: {
        black:   '#0a0a0a',
        red:     '#ff6b6b',    // TDS --one
        green:   '#4ecdc4',    // TDS --two
        yellow:  '#ffe66d',    // TDS --three
        blue:    '#6b5ce7',    // TDS --four
        magenta: '#ff6b6b',    // map to --one
        cyan:    '#4ecdc4',    // map to --two
        white:   '#e0e0e0',    // TDS --ink

        // Bright variants
        brightBlack:   '#666666',
        brightRed:     '#ff8a8a',
        brightGreen:   '#7eeee6',
        brightYellow:  '#fff09d',
        brightBlue:    '#9389ed',
        brightMagenta: '#ff8a8a',
        brightCyan:    '#7eeee6',
        brightWhite:   '#ffffff'
    },

    // ANSI code to color name
    codeMap: {
        30: 'black', 31: 'red', 32: 'green', 33: 'yellow',
        34: 'blue', 35: 'magenta', 36: 'cyan', 37: 'white',
        90: 'brightBlack', 91: 'brightRed', 92: 'brightGreen',
        93: 'brightYellow', 94: 'brightBlue', 95: 'brightMagenta',
        96: 'brightCyan', 97: 'brightWhite'
    },

    // Background codes (40-47, 100-107)
    bgCodeMap: {
        40: 'black', 41: 'red', 42: 'green', 43: 'yellow',
        44: 'blue', 45: 'magenta', 46: 'cyan', 47: 'white',
        100: 'brightBlack', 101: 'brightRed', 102: 'brightGreen',
        103: 'brightYellow', 104: 'brightBlue', 105: 'brightMagenta',
        106: 'brightCyan', 107: 'brightWhite'
    },

    /**
     * Escape HTML entities
     */
    _escapeHtml: function(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    /**
     * Parse ANSI escape codes and convert to HTML spans
     * @param {string} str - String with ANSI codes
     * @returns {string} HTML string
     */
    parseAnsi: function(str) {
        if (!str) return '';

        var self = this;
        var result = '';
        var lastIndex = 0;
        var currentFg = null;
        var currentBg = null;
        var bold = false;
        var dim = false;

        // Match ANSI escape sequences
        var regex = /\x1b\[([0-9;]*)m/g;
        var match;

        while ((match = regex.exec(str)) !== null) {
            // Append text before this escape (with current styling)
            if (match.index > lastIndex) {
                var text = self._escapeHtml(str.slice(lastIndex, match.index));
                result += self._wrapWithStyle(text, currentFg, currentBg, bold, dim);
            }
            lastIndex = match.index + match[0].length;

            // Parse codes
            var codes = match[1].split(';').map(Number);
            for (var i = 0; i < codes.length; i++) {
                var code = codes[i];

                if (code === 0) {
                    // Reset all
                    currentFg = null;
                    currentBg = null;
                    bold = false;
                    dim = false;
                } else if (code === 1) {
                    bold = true;
                } else if (code === 2) {
                    dim = true;
                } else if (code === 22) {
                    bold = false;
                    dim = false;
                } else if (code === 39) {
                    currentFg = null;
                } else if (code === 49) {
                    currentBg = null;
                } else if (self.codeMap[code]) {
                    currentFg = self.colors[self.codeMap[code]];
                } else if (self.bgCodeMap[code]) {
                    currentBg = self.colors[self.bgCodeMap[code]];
                }
            }
        }

        // Append remaining text
        if (lastIndex < str.length) {
            var remaining = self._escapeHtml(str.slice(lastIndex));
            result += self._wrapWithStyle(remaining, currentFg, currentBg, bold, dim);
        }

        return result;
    },

    /**
     * Wrap text with inline style if needed
     */
    _wrapWithStyle: function(text, fg, bg, bold, dim) {
        if (!fg && !bg && !bold && !dim) return text;

        var styles = [];
        if (fg) styles.push('color:' + fg);
        if (bg) styles.push('background:' + bg);
        if (bold) styles.push('font-weight:bold');
        if (dim) styles.push('opacity:0.6');

        return '<span style="' + styles.join(';') + '">' + text + '</span>';
    },

    /**
     * Strip ANSI codes entirely
     * @param {string} str - String with ANSI codes
     * @returns {string} Clean string
     */
    strip: function(str) {
        if (!str) return '';
        return str.replace(/\x1b\[[0-9;]*m/g, '');
    },

    /**
     * Create a new TerminalOutput instance
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} opts - Options
     * @returns {Object} TerminalOutput instance
     */
    create: function(container, opts) {
        var el = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!el) {
            console.error('[TerminalOutput] Container not found');
            return null;
        }

        opts = opts || {};
        var self = this;

        var instance = {
            container: el,
            options: {
                maxLines: opts.maxLines !== undefined ? opts.maxLines : 1000,
                autoScroll: opts.autoScroll !== false,
                parseAnsi: opts.parseAnsi !== false,
                showLineNumbers: opts.showLineNumbers || false,
                wrap: opts.wrap !== false
            },
            lineCount: 0,
            _partialLine: '',
            _preEl: null,

            /**
             * Initialize the terminal output
             */
            init: function() {
                this.container.classList.add('tetra-terminal-output');
                if (!this.options.wrap) {
                    this.container.classList.add('tetra-terminal-output--nowrap');
                }

                this._preEl = document.createElement('pre');
                this._preEl.className = 'tetra-terminal-output__content';
                this.container.appendChild(this._preEl);

                return this;
            },

            /**
             * Append a line of text
             * @param {string} line - Text line (ANSI parsed if enabled)
             */
            append: function(line) {
                var html = this.options.parseAnsi
                    ? self.parseAnsi(line)
                    : self._escapeHtml(line);

                var lineEl = document.createElement('div');
                lineEl.className = 'tetra-terminal-output__line';

                if (this.options.showLineNumbers) {
                    this.lineCount++;
                    var numEl = document.createElement('span');
                    numEl.className = 'tetra-terminal-output__linenum';
                    numEl.textContent = this.lineCount;
                    lineEl.appendChild(numEl);
                }

                var textEl = document.createElement('span');
                textEl.className = 'tetra-terminal-output__text';
                textEl.innerHTML = html;
                lineEl.appendChild(textEl);

                this._preEl.appendChild(lineEl);
                this._enforceMaxLines();

                if (this.options.autoScroll) {
                    this.scrollToBottom();
                }

                return this;
            },

            /**
             * Append multiple lines
             * @param {string[]} lines - Array of lines
             */
            appendLines: function(lines) {
                for (var i = 0; i < lines.length; i++) {
                    this.append(lines[i]);
                }
                return this;
            },

            /**
             * Append raw HTML (no parsing)
             * @param {string} html - HTML string
             */
            appendRaw: function(html) {
                var lineEl = document.createElement('div');
                lineEl.className = 'tetra-terminal-output__line';
                lineEl.innerHTML = html;
                this._preEl.appendChild(lineEl);
                this._enforceMaxLines();

                if (this.options.autoScroll) {
                    this.scrollToBottom();
                }
                return this;
            },

            /**
             * Write text without newline (for streaming)
             * @param {string} text - Partial text
             */
            write: function(text) {
                this._partialLine += text;

                // Check for complete lines
                var lines = this._partialLine.split('\n');
                for (var i = 0; i < lines.length - 1; i++) {
                    this.append(lines[i]);
                }
                this._partialLine = lines[lines.length - 1];

                return this;
            },

            /**
             * Flush any partial line
             */
            flush: function() {
                if (this._partialLine) {
                    this.append(this._partialLine);
                    this._partialLine = '';
                }
                return this;
            },

            /**
             * Clear all content
             */
            clear: function() {
                this._preEl.innerHTML = '';
                this.lineCount = 0;
                this._partialLine = '';
                return this;
            },

            /**
             * Scroll to bottom
             */
            scrollToBottom: function() {
                this.container.scrollTop = this.container.scrollHeight;
                return this;
            },

            /**
             * Scroll to top
             */
            scrollToTop: function() {
                this.container.scrollTop = 0;
                return this;
            },

            /**
             * Get plain text content
             */
            getText: function() {
                return self.strip(this._preEl.textContent || '');
            },

            /**
             * Get HTML content
             */
            getHtml: function() {
                return this._preEl.innerHTML;
            },

            /**
             * Set content (replaces all)
             * @param {string} text - Text with newlines
             */
            setContent: function(text) {
                this.clear();
                var lines = text.split('\n');
                for (var i = 0; i < lines.length; i++) {
                    this.append(lines[i]);
                }
                return this;
            },

            /**
             * Enforce max lines limit
             */
            _enforceMaxLines: function() {
                if (this.options.maxLines <= 0) return;

                var lines = this._preEl.children;
                while (lines.length > this.options.maxLines) {
                    this._preEl.removeChild(lines[0]);
                }
            },

            /**
             * Cleanup and remove
             */
            destroy: function() {
                this.container.classList.remove('tetra-terminal-output', 'tetra-terminal-output--nowrap');
                this.container.innerHTML = '';
                this._preEl = null;
            }
        };

        return instance.init();
    }
};

// Convenience alias
TetraUI.ansi = {
    toHtml: function(str) { return TetraUI.TerminalOutput.parseAnsi(str); },
    strip: function(str) { return TetraUI.TerminalOutput.strip(str); },
    colors: TetraUI.TerminalOutput.colors
};
