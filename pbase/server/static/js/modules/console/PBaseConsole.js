/**
 * PBaseConsole.js - Main Console Component
 * Integrates CLI, output, and game frame into a unified testing interface
 */

import { ConsoleInput } from './ConsoleInput.js';
import { ConsoleOutput } from './ConsoleOutput.js';
import { ConsoleControls, getParameter, isContinuous, isCategorical } from './ConsoleControls.js';
import { GameFrame } from './GameFrame.js';
import { ALL_COMMANDS, getHelp, CATEGORIES } from './ConsoleCommands.js';

export class PBaseConsole {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        this.options = {
            position: options.position || 'left', // left | right | top | bottom
            consoleSize: options.consoleSize || 400, // initial size in pixels
            minSize: options.minSize || 200,
            showPositionSelector: options.showPositionSelector !== false,
            ...options
        };

        // Legacy layout support
        if (options.layout === 'vertical') {
            this.options.position = 'top';
        }

        this.element = null;
        this.input = null;
        this.output = null;
        this.controls = null;
        this.frame = null;
        this.divider = null;
        this.consolePanel = null;

        // Game list for completion
        this.games = [];

        // Current loaded game
        this._currentGame = null;

        // Resize state
        this._resizing = false;
        this._startPos = 0;
        this._startSize = 0;
    }

    /**
     * Initialize and render the console
     */
    init() {
        // Outer wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'pbase-console-wrapper';
        this.wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;';

        // Status bar (above console/frame)
        if (this.options.showPositionSelector) {
            this.wrapper.appendChild(this._renderStatusBar());
        }

        // Main content area (console + divider + frame)
        this.element = document.createElement('div');
        this._updateLayoutClass();
        this.element.style.flex = '1';
        this.element.style.minHeight = '0'; // Allow shrinking

        // Set initial console size
        this.element.style.setProperty('--console-size', `${this.options.consoleSize}px`);

        // Create components
        this.output = new ConsoleOutput();
        this.controls = new ConsoleControls({
            onChange: (param, value, context) => this._handleControlChange(param, value, context)
        });
        this.frame = new GameFrame({
            onMessage: (type, data) => this._handleGameMessage(type, data),
            onLoad: (url) => this._handleGameLoad(url),
            onError: (err) => this._handleGameError(err)
        });
        this.input = new ConsoleInput({
            onExecute: (cmd) => this._executeCommand(cmd),
            onTab: (partial, items) => this._handleTab(partial, items),
            onControlRequest: (param, context) => this._addControl(param, context)
        });

        // Console panel
        this.consolePanel = document.createElement('div');
        this.consolePanel.className = 'console-panel';
        this.consolePanel.appendChild(this.controls.render());
        this.consolePanel.appendChild(this.output.render());
        this.consolePanel.appendChild(this.input.render());

        // Resizable divider
        this.divider = document.createElement('div');
        this.divider.className = 'console-divider';
        this._initDividerEvents();

        // Frame panel
        this.framePanel = document.createElement('div');
        this.framePanel.className = 'frame-panel';
        this.framePanel.appendChild(this._renderFrameToolbar());
        this.framePanel.appendChild(this.frame.render());

        // Add elements in correct order based on position
        this._appendPanels();

        this.wrapper.appendChild(this.element);
        this.container.appendChild(this.wrapper);

        // Focus input
        this.input.focus();

        return this;
    }

    /**
     * Update layout class based on position
     */
    _updateLayoutClass() {
        this.element.className = `pbase-console console-${this.options.position}`;
    }

    /**
     * Append panels in correct order based on position
     */
    _appendPanels() {
        // Clear existing
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }

        // Order: console, divider, frame (CSS flex-direction handles visual order)
        this.element.appendChild(this.consolePanel);
        this.element.appendChild(this.divider);
        this.element.appendChild(this.framePanel);
    }

    /**
     * Initialize divider drag events
     */
    _initDividerEvents() {
        const onMouseDown = (e) => {
            e.preventDefault();
            this._resizing = true;
            this.element.classList.add('resizing');
            this.divider.classList.add('dragging');

            const isHorizontal = this.options.position === 'left' || this.options.position === 'right';
            this._startPos = isHorizontal ? e.clientX : e.clientY;
            this._startSize = isHorizontal
                ? this.consolePanel.offsetWidth
                : this.consolePanel.offsetHeight;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!this._resizing) return;

            const isHorizontal = this.options.position === 'left' || this.options.position === 'right';
            const currentPos = isHorizontal ? e.clientX : e.clientY;
            let delta = currentPos - this._startPos;

            // Invert delta for right/bottom positions
            if (this.options.position === 'right' || this.options.position === 'bottom') {
                delta = -delta;
            }

            const newSize = Math.max(this.options.minSize, this._startSize + delta);
            this.element.style.setProperty('--console-size', `${newSize}px`);
        };

        const onMouseUp = () => {
            this._resizing = false;
            this.element.classList.remove('resizing');
            this.divider.classList.remove('dragging');

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this.divider.addEventListener('mousedown', onMouseDown);

        // Touch support
        this.divider.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            onMouseDown({ preventDefault: () => {}, clientX: touch.clientX, clientY: touch.clientY });
        });

        document.addEventListener('touchmove', (e) => {
            if (!this._resizing) return;
            const touch = e.touches[0];
            onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        });

        document.addEventListener('touchend', onMouseUp);
    }

    /**
     * Render status bar with game info and position selector
     */
    _renderStatusBar() {
        const statusBar = document.createElement('div');
        statusBar.className = 'console-status-bar';

        // Game info section
        const statusInfo = document.createElement('div');
        statusInfo.className = 'console-status-info';

        // Game name
        const gameItem = document.createElement('div');
        gameItem.className = 'status-item';
        gameItem.innerHTML = `
            <span class="status-label">Game</span>
            <span class="status-value no-game" data-status="game">No game loaded</span>
        `;
        statusInfo.appendChild(gameItem);

        // Game type
        const typeItem = document.createElement('div');
        typeItem.className = 'status-item';
        typeItem.innerHTML = `
            <span class="status-label">Type</span>
            <span class="game-type-badge" data-status="type" style="display:none">—</span>
        `;
        statusInfo.appendChild(typeItem);

        statusBar.appendChild(statusInfo);

        // Position selector
        const positionSelector = this._renderPositionSelector();
        statusBar.appendChild(positionSelector);

        this._statusBar = statusBar;
        return statusBar;
    }

    /**
     * Render position selector buttons
     */
    _renderPositionSelector() {
        const selector = document.createElement('div');
        selector.className = 'console-position-selector';

        const label = document.createElement('span');
        label.className = 'position-label';
        label.textContent = 'Layout';
        selector.appendChild(label);

        const buttons = document.createElement('div');
        buttons.className = 'position-buttons';

        const positions = [
            { pos: 'left', label: '◧', title: 'Console left' },
            { pos: 'top', label: '⬒', title: 'Console top' },
            { pos: 'bottom', label: '⬓', title: 'Console bottom' },
            { pos: 'right', label: '◨', title: 'Console right' },
        ];

        for (const { pos, label: lbl, title } of positions) {
            const btn = document.createElement('button');
            btn.className = `position-btn${this.options.position === pos ? ' active' : ''}`;
            btn.dataset.position = pos;
            btn.textContent = lbl;
            btn.title = title;
            btn.addEventListener('click', () => this.setPosition(pos));
            buttons.appendChild(btn);
        }

        selector.appendChild(buttons);
        this._positionSelector = selector;
        return selector;
    }

    /**
     * Update status bar with game info
     */
    _updateStatusBar(game) {
        if (!this._statusBar) return;

        const gameEl = this._statusBar.querySelector('[data-status="game"]');
        const typeEl = this._statusBar.querySelector('[data-status="type"]');

        if (game) {
            gameEl.textContent = game.name || game.slug || 'Unknown';
            gameEl.classList.remove('no-game');

            if (game.type) {
                typeEl.textContent = game.type;
                typeEl.style.display = '';
            } else {
                typeEl.textContent = 'static';
                typeEl.style.display = '';
            }
        } else {
            gameEl.textContent = 'No game loaded';
            gameEl.classList.add('no-game');
            typeEl.style.display = 'none';
        }
    }

    /**
     * Fetch game info from API
     */
    async _fetchGameInfo(slug) {
        try {
            const res = await fetch(`/api/games/${slug}`);
            if (res.ok) {
                const game = await res.json();
                this._currentGame = game;
                this._updateStatusBar(game);
            }
        } catch (err) {
            // Ignore fetch errors
        }
    }

    /**
     * Set console position
     * @param {'left'|'right'|'top'|'bottom'} position
     */
    setPosition(position) {
        if (!['left', 'right', 'top', 'bottom'].includes(position)) {
            console.warn(`Invalid position: ${position}`);
            return;
        }

        this.options.position = position;
        this._updateLayoutClass();

        // Update position selector active state
        if (this._positionSelector) {
            this._positionSelector.querySelectorAll('.position-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.position === position);
            });
        }

        // Adjust size for orientation change
        const isHorizontal = position === 'left' || position === 'right';
        const wasHorizontal = this.element.style.getPropertyValue('--console-size').includes('px');

        // Reset to sensible default if switching orientation
        if (isHorizontal) {
            const currentSize = parseInt(this.element.style.getPropertyValue('--console-size')) || 400;
            if (currentSize < 250) {
                this.element.style.setProperty('--console-size', '400px');
            }
        } else {
            const currentSize = parseInt(this.element.style.getPropertyValue('--console-size')) || 300;
            if (currentSize > 500) {
                this.element.style.setProperty('--console-size', '300px');
            }
        }
    }

    /**
     * Get current position
     * @returns {'left'|'right'|'top'|'bottom'}
     */
    getPosition() {
        return this.options.position;
    }

    /**
     * Render frame toolbar
     */
    _renderFrameToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'frame-toolbar';

        toolbar.innerHTML = `
            <div class="frame-url-bar">
                <span class="frame-status" title="Not loaded">○</span>
                <input type="text" class="frame-url-input" placeholder="Enter game URL or slug..." />
                <button class="frame-btn load-btn" title="Load">▶</button>
                <button class="frame-btn reload-btn" title="Reload">↻</button>
            </div>
            <div class="frame-controls">
                <button class="frame-btn start-btn" title="Start">Start</button>
                <button class="frame-btn pause-btn" title="Pause">Pause</button>
                <button class="frame-btn stop-btn" title="Stop">Stop</button>
            </div>
        `;

        // Bind events
        const urlInput = toolbar.querySelector('.frame-url-input');
        const loadBtn = toolbar.querySelector('.load-btn');
        const reloadBtn = toolbar.querySelector('.reload-btn');
        const startBtn = toolbar.querySelector('.start-btn');
        const pauseBtn = toolbar.querySelector('.pause-btn');
        const stopBtn = toolbar.querySelector('.stop-btn');

        this._statusIndicator = toolbar.querySelector('.frame-status');
        this._urlInput = urlInput;

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this._loadFromUrlBar();
            }
        });

        loadBtn.addEventListener('click', () => this._loadFromUrlBar());
        reloadBtn.addEventListener('click', () => this.frame.reload());
        startBtn.addEventListener('click', () => this.frame.start());
        pauseBtn.addEventListener('click', () => this.frame.togglePause());
        stopBtn.addEventListener('click', () => this.frame.stop());

        return toolbar;
    }

    /**
     * Load from URL bar
     */
    _loadFromUrlBar() {
        const url = this._urlInput.value.trim();
        if (url) {
            this._executeCommand(`load ${url}`);
        }
    }

    /**
     * Update status indicator
     */
    _updateStatus(status) {
        const colors = {
            idle: '#90a4ae',
            loading: '#ffb74d',
            loaded: '#81c784',
            playing: '#4fc3f7',
            paused: '#ffb74d',
            error: '#ef5350'
        };
        if (this._statusIndicator) {
            this._statusIndicator.style.color = colors[status] || colors.idle;
            this._statusIndicator.textContent = status === 'loaded' || status === 'playing' ? '●' : '○';
            this._statusIndicator.title = status;
        }
    }

    /**
     * Execute a command
     */
    _executeCommand(cmdStr) {
        this.output.command(cmdStr);

        const parts = this._tokenize(cmdStr);
        if (parts.length === 0) return;

        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Dispatch command
        this._dispatch(cmd, args);
    }

    /**
     * Tokenize command string (respects quotes)
     */
    _tokenize(str) {
        const tokens = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = null;

        for (const char of str) {
            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = null;
            } else if (char === ' ' && !inQuotes) {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current) {
            tokens.push(current);
        }

        return tokens;
    }

    /**
     * Dispatch command to handler
     */
    _dispatch(cmd, args) {
        const cmdDef = ALL_COMMANDS[cmd];

        // Game commands
        if (cmd === 'start') {
            this.frame.start();
            this.output.result('Game started', 'game');
            this._updateStatus('playing');
        } else if (cmd === 'stop') {
            this.frame.stop();
            this.output.result('Game stopped', 'game');
            this._updateStatus('loaded');
        } else if (cmd === 'pause') {
            this.frame.pause();
            this.output.result('Game paused', 'game');
            this._updateStatus('paused');
        } else if (cmd === 'resume') {
            this.frame.resume();
            this.output.result('Game resumed', 'game');
            this._updateStatus('playing');
        } else if (cmd === 'toggle') {
            this.frame.togglePause();
            this.output.result('Toggled pause', 'game');
        } else if (cmd === 'state') {
            this.output.result(this.frame.getState(), 'game');
        } else if (cmd === 'paddle') {
            const player = parseInt(args[0]) || 0;
            const value = parseFloat(args[1]) || 0.5;
            this.frame.setPaddle(player, value);
            this.output.result(`Paddle ${player} set to ${value}`, 'game');
        } else if (cmd === 'score') {
            const player = parseInt(args[0]) || 0;
            const points = parseInt(args[1]) || 0;
            this.frame.setScore(player, points);
            this.output.result(`Player ${player} score set to ${points}`, 'game');
        } else if (cmd === 'addscore') {
            const player = parseInt(args[0]) || 0;
            const points = parseInt(args[1]) || 1;
            const state = this.frame.getState();
            const newScore = (state.score[player] || 0) + points;
            this.frame.setScore(player, newScore);
            this.output.result(`Player ${player} score: ${newScore}`, 'game');
        } else if (cmd === 'end') {
            const winner = args[0] ? parseInt(args[0]) : undefined;
            this.frame.postMessage('game:control', { action: 'end', winner });
            this.output.result(winner !== undefined ? `Game ended, winner: ${winner}` : 'Game ended', 'game');
            this._updateStatus('loaded');

        // RT commands
        } else if (cmd === 'send') {
            const type = args[0];
            const data = args[1] ? this._parseJson(args.slice(1).join(' ')) : {};
            if (this.frame.send(type, data)) {
                this.output.result(`Sent: ${type}`, 'rt');
            } else {
                this.output.error('No game loaded');
            }
        } else if (cmd === 'log') {
            this.output.info(args.join(' '));
        } else if (cmd === 'query') {
            this.frame.postMessage('query', { key: args[0] });
            this.output.result(`Queried: ${args[0]}`, 'rt');
        } else if (cmd === 'volume') {
            const level = parseFloat(args[0]) || 1;
            this.frame.setVolume(level);
            this.output.result(`Volume set to ${level}`, 'rt');
        } else if (cmd === 'mute') {
            const muted = args[0] !== 'off';
            this.frame.setMute(muted);
            this.output.result(muted ? 'Muted' : 'Unmuted', 'rt');

        // MP commands
        } else if (cmd === 'connect' || cmd === 'disconnect' || cmd === 'join' ||
                   cmd === 'leave' || cmd === 'queue' || cmd === 'stats' || cmd === 'osc') {
            this.output.warn('Multiplayer commands require server connection (not implemented in console)');

        // Deck commands
        } else if (cmd === 'deck') {
            this.output.info(`ControlDeck channel: ${args[0] || 'default'}`);
        } else if (cmd === 'axis') {
            this.output.result(`Axis ${args[0]}: 0.0 (ControlDeck not connected)`, 'deck');
        } else if (cmd === 'button') {
            this.output.result(`Button ${args[0]}: false (ControlDeck not connected)`, 'deck');
        } else if (cmd === 'deckstate') {
            const state = this._parseJson(args.join(' '));
            this.output.result(`ControlDeck state: ${JSON.stringify(state)}`, 'deck');

        // Theme commands
        } else if (cmd === 'theme.get') {
            const value = getComputedStyle(document.documentElement).getPropertyValue(args[0]);
            this.output.result(`${args[0]}: ${value.trim() || '(not set)'}`, 'theme');
        } else if (cmd === 'theme.set') {
            const name = args[0];
            const value = args.slice(1).join(' ');
            document.documentElement.style.setProperty(name, value);
            this.output.result(`Set ${name} = ${value}`, 'theme');
        } else if (cmd === 'theme.reset') {
            this.output.info('Theme reset (not implemented)');
        } else if (cmd === 'theme.all') {
            const styles = getComputedStyle(document.documentElement);
            const tokens = {};
            for (const prop of ['--bg', '--fg', '--accent', '--one', '--two', '--three', '--four']) {
                tokens[prop] = styles.getPropertyValue(prop).trim();
            }
            this.output.result(tokens, 'theme');
        } else if (cmd === 'theme.apply') {
            const theme = this._parseJson(args.join(' '));
            if (theme) {
                for (const [key, value] of Object.entries(theme)) {
                    document.documentElement.style.setProperty(key, value);
                }
                this.output.result('Theme applied', 'theme');
            }

        // Frame commands
        } else if (cmd === 'load') {
            let url = args[0];
            if (!url) {
                this.output.error('Usage: load <url|slug>');
                return;
            }
            // Check if it's a slug (no protocol or path separators)
            if (!url.includes('/') && !url.includes(':')) {
                // Look up in games list
                const game = this.games.find(g => g.slug === url);
                if (game) {
                    url = game.url || `/api/games/${url}/play/index.html`;
                    this.output.info(`Loading game: ${game.name || url}`);
                    this._currentGame = game;
                    this._updateStatusBar(game);
                } else {
                    url = `/api/games/${url}/play/index.html`;
                    // Fetch game info for status bar
                    this._fetchGameInfo(args[0]);
                }
            } else {
                this._currentGame = null;
                this._updateStatusBar(null);
            }
            this._updateStatus('loading');
            this._urlInput.value = url;
            this.frame.load(url);
        } else if (cmd === 'reload') {
            this._updateStatus('loading');
            this.frame.reload();
        } else if (cmd === 'unload') {
            this.frame.unload();
            this._urlInput.value = '';
            this._updateStatus('idle');
            this._currentGame = null;
            this._updateStatusBar(null);
            this.output.result('Game unloaded', 'frame');
        } else if (cmd === 'inspect') {
            this.output.info('Inspector mode not implemented');
        } else if (cmd === 'postmessage') {
            const type = args[0];
            const data = args[1] ? this._parseJson(args.slice(1).join(' ')) : {};
            this.frame.postMessage(type, data);
            this.output.result(`Posted: ${type}`, 'frame');

        // Util commands
        } else if (cmd === 'help') {
            const helpText = getHelp(args[0]);
            this.output.info(helpText);
        } else if (cmd === 'clear') {
            this.output.clear();
        } else if (cmd === 'history') {
            const history = this.input.getHistory();
            this.output.result(history.length ? history.join('\n') : '(no history)');
        } else if (cmd === 'echo') {
            this.output.info(args.join(' '));
        } else if (cmd === 'json') {
            const obj = this._parseJson(args.join(' '));
            if (obj !== null) {
                this.output.result(obj);
            }
        } else if (cmd === 'eval') {
            try {
                const expr = args.join(' ');
                const result = new Function('frame', 'console', `return ${expr}`)(this.frame, this);
                this.output.result(result);
            } catch (e) {
                this.output.error(`Eval error: ${e.message}`);
            }

        // Category helpers
        } else if (CATEGORIES[cmd]) {
            const helpText = getHelp(cmd);
            this.output.info(helpText);

        // Unknown command
        } else {
            this.output.error(`Unknown command: ${cmd}. Type "help" for available commands.`);
        }
    }

    /**
     * Parse JSON safely
     */
    _parseJson(str) {
        if (!str) return null;
        try {
            return JSON.parse(str);
        } catch {
            // Try to fix common issues
            try {
                // Unquoted keys
                const fixed = str.replace(/(\w+):/g, '"$1":');
                return JSON.parse(fixed);
            } catch {
                this.output.error(`Invalid JSON: ${str}`);
                return null;
            }
        }
    }

    /**
     * Handle game message
     */
    _handleGameMessage(type, data) {
        this.output.message(type, data);

        // Update status based on message
        if (type === 'game:start') {
            this._updateStatus('playing');
        } else if (type === 'game:pause') {
            this._updateStatus('paused');
        } else if (type === 'game:resume') {
            this._updateStatus('playing');
        } else if (type === 'game:stop' || type === 'game:end') {
            this._updateStatus('loaded');
        }
    }

    /**
     * Handle game load
     */
    _handleGameLoad(url) {
        this.output.info(`Loaded: ${url}`);
        this._updateStatus('loaded');

        // Update status bar with current game info
        if (this._currentGame) {
            this._updateStatusBar(this._currentGame);
        }
    }

    /**
     * Handle game error
     */
    _handleGameError(err) {
        this.output.error(err);
        this._updateStatus('error');
    }

    /**
     * Handle tab completion - check for control parameters
     */
    _handleTab(partial, items) {
        const parts = partial.trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase();

        // Check if command has a control parameter
        if (isContinuous(cmd) || isCategorical(cmd)) {
            // Parse context from partial (e.g., "paddle 0" -> player: 0)
            const context = {};
            if (parts[1] !== undefined && cmd === 'paddle') {
                context.player = parts[1];
            }

            // Add control if not already present
            if (!this.controls.hasControl(cmd, context)) {
                this._addControl(cmd, context);
            }
        }
    }

    /**
     * Add an inline control
     */
    _addControl(param, context = {}) {
        if (!this.controls.hasControl(param, context)) {
            this.controls.addControl(param, context);
        }
    }

    /**
     * Handle control value change - silent, no console output
     */
    _handleControlChange(param, value, context) {
        switch (param) {
            case 'volume':
                this.frame.setVolume(value);
                break;
            case 'mute':
                this.frame.setMute(value);
                break;
            case 'paddle':
                this.frame.setPaddle(parseInt(context.player) || 0, value);
                break;
        }
    }

    /**
     * Set available games list (for slug completion)
     */
    setGames(games) {
        this.games = games || [];
    }

    /**
     * Focus the input
     */
    focus() {
        this.input?.focus();
    }

    /**
     * Destroy the console
     */
    destroy() {
        this.frame?.destroy();
        this.wrapper?.remove();
    }
}

// Export factory function
export function createConsole(container, options) {
    return new PBaseConsole(container, options).init();
}
