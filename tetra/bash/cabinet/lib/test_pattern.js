/**
 * test_pattern.js - Dev mode gamepak
 *
 * Shows cabinet mechanics without a real game:
 * - Frame rate display
 * - Input echo (shows what keys/controls are pressed)
 * - Slot status (P1, P2, spectators)
 * - Network status
 *
 * Usage:
 *   cabinet --dev
 */

const { Gamepak } = require('./gamepak.js');

class TestPattern extends Gamepak {
    constructor(options = {}) {
        super({
            name: 'test_pattern',
            version: '1.0.0',
            slots: 2,
            ...options
        });

        this.cols = options.cols || 80;
        this.rows = options.rows || 24;
        this.fps = options.fps || 30;

        // State
        this.frameCount = 0;
        this.startTime = null;
        this.lastInputs = {};  // slot -> last input
        this.players = {};     // slot -> player info
        this.intervalId = null;
    }

    start() {
        super.start();
        this.startTime = Date.now();
        this.frameCount = 0;

        // Run at target FPS
        this.intervalId = setInterval(() => {
            this._tick();
        }, 1000 / this.fps);

        return this;
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        super.stop();
    }

    sendInput(slot, input) {
        this.lastInputs[slot] = {
            ...input,
            ts: Date.now()
        };

        // Echo input as event
        this.emitEvent({
            type: 'input',
            slot,
            input
        });
    }

    setPlayers(players) {
        this.players = {};
        for (const p of players) {
            this.players[p.slot] = p;
        }
    }

    _tick() {
        this.frameCount++;
        const elapsed = (Date.now() - this.startTime) / 1000;
        const actualFps = this.frameCount / elapsed;

        const display = this._render(actualFps, elapsed);

        this.emitFrame({
            display,
            snd: this._soundState()
        });
    }

    _render(fps, elapsed) {
        const lines = [];
        const W = this.cols;

        // Header
        lines.push(this._center('╔' + '═'.repeat(W - 2) + '╗', W));
        lines.push(this._center('║' + this._center('CABINET TEST PATTERN', W - 2) + '║', W));
        lines.push(this._center('╠' + '═'.repeat(W - 2) + '╣', W));

        // Stats
        lines.push(this._center('║' + this._pad(`Frame: ${this.frameCount}`, W - 2) + '║', W));
        lines.push(this._center('║' + this._pad(`FPS: ${fps.toFixed(1)} (target: ${this.fps})`, W - 2) + '║', W));
        lines.push(this._center('║' + this._pad(`Uptime: ${elapsed.toFixed(1)}s`, W - 2) + '║', W));
        lines.push(this._center('╠' + '═'.repeat(W - 2) + '╣', W));

        // Slot status
        lines.push(this._center('║' + this._center('SLOTS', W - 2) + '║', W));
        lines.push(this._center('╟' + '─'.repeat(W - 2) + '╢', W));

        for (const slot of ['p1', 'p2']) {
            const player = this.players[slot];
            const status = player ? `Player ${player.id}` : '[ empty ]';
            const input = this.lastInputs[slot];
            const inputStr = input ? `Last: ${input.ctrl || input.key || '?'}` : '';
            lines.push(this._center('║' + this._pad(`  ${slot.toUpperCase()}: ${status}  ${inputStr}`, W - 2) + '║', W));
        }

        lines.push(this._center('╠' + '═'.repeat(W - 2) + '╣', W));

        // Input history
        lines.push(this._center('║' + this._center('INPUT LOG', W - 2) + '║', W));
        lines.push(this._center('╟' + '─'.repeat(W - 2) + '╢', W));

        // Show recent inputs
        const allInputs = Object.entries(this.lastInputs)
            .filter(([_, v]) => Date.now() - v.ts < 3000)  // Last 3 seconds
            .sort((a, b) => b[1].ts - a[1].ts)
            .slice(0, 4);

        if (allInputs.length === 0) {
            lines.push(this._center('║' + this._pad('  (press any key)', W - 2) + '║', W));
        } else {
            for (const [slot, input] of allInputs) {
                const ctrl = input.ctrl || input.key || '?';
                const val = input.val !== undefined ? input.val : '';
                lines.push(this._center('║' + this._pad(`  ${slot}: ${ctrl} ${val}`, W - 2) + '║', W));
            }
        }

        // Pad to fill screen
        while (lines.length < this.rows - 2) {
            lines.push(this._center('║' + ' '.repeat(W - 2) + '║', W));
        }

        // Footer
        lines.push(this._center('╚' + '═'.repeat(W - 2) + '╝', W));

        return lines.join('\n');
    }

    _soundState() {
        // Idle sound - quiet background hum
        return {
            mode: 'tia',
            v: [
                { g: 1, f: 40, w: 6, v: 2 },
                { g: 0, f: 0, w: 0, v: 0 }
            ]
        };
    }

    _center(str, width) {
        const pad = Math.max(0, width - str.length);
        const left = Math.floor(pad / 2);
        return ' '.repeat(left) + str;
    }

    _pad(str, width) {
        if (str.length >= width) return str.slice(0, width);
        return str + ' '.repeat(width - str.length);
    }
}

module.exports = { TestPattern };
