/**
 * Terrain CLI Module
 * Command-line interface for node interaction
 */
(function() {
    'use strict';

    const Events = window.Terrain.Events;
    const Utils = window.Terrain.Utils;

    const TerrainCLI = {
        /**
         * Render CLI into a container
         */
        render: function(container, index, node) {
            container.innerHTML = `
                <div class="cli-container cli-hidden" data-index="${index}">
                    <div class="cli-input-row cli-input-main">
                        <span class="cli-prompt">▸</span>
                        <input type="text" class="cli-input" data-index="${index}" placeholder="ping, state, list, help, or JSON...">
                        <select class="cli-target" data-index="${index}">
                            <option value="iframe">iframe</option>
                            <option value="system">system</option>
                            <option value="all">all</option>
                        </select>
                    </div>
                    <div class="cli-log" data-index="${index}"></div>
                </div>
                <div class="cli-status-line" data-index="${index}">
                    <span class="cli-status-indicator">●</span>
                    <span class="cli-status-text">ready</span>
                </div>
                <div class="node-iframe-container">
                    <iframe src="${node.iframeSrc || node.link || 'about:blank'}" class="node-iframe"></iframe>
                </div>
            `;

            this.bindEvents(container, index);
        },

        /**
         * Bind CLI input events
         */
        bindEvents: function(container, index) {
            const self = this;
            const input = container.querySelector('.cli-input');
            const targetSelect = container.querySelector('.cli-target');

            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const cmd = input.value.trim();
                        if (cmd) {
                            self.execute(index, cmd, targetSelect?.value || 'iframe');
                            input.value = '';
                        }
                    }
                });
            }
        },

        /**
         * Toggle CLI visibility
         */
        toggle: function(index) {
            const card = document.querySelector(`[data-index="${index}"]`);
            if (!card || !card.classList.contains('expanded')) return;

            const cliContainer = card.querySelector('.cli-container');
            const statusLine = card.querySelector('.cli-status-line');

            if (cliContainer) {
                cliContainer.classList.toggle('cli-hidden');
                const isHidden = cliContainer.classList.contains('cli-hidden');

                // Show status line when CLI is hidden
                if (statusLine) {
                    statusLine.classList.toggle('cli-hidden', !isHidden);
                }

                // Focus input when showing CLI
                if (!isHidden) {
                    const input = cliContainer.querySelector('.cli-input');
                    if (input) input.focus();
                }

                // Update toggle button state
                const toggleBtn = card.querySelector('.node-cli-toggle');
                if (toggleBtn) {
                    toggleBtn.classList.toggle('active', !isHidden);
                }
            }
        },

        /**
         * Execute a CLI command
         */
        execute: function(index, cmd, target) {
            this.log(index, 'cmd', cmd);

            // Parse command
            let message;
            try {
                // Try parsing as JSON first
                message = JSON.parse(cmd);
            } catch (e) {
                // Parse as command string: "type arg1 arg2..."
                const parts = cmd.split(/\s+/);
                const type = parts[0];
                const args = parts.slice(1);

                // Built-in commands
                switch (type) {
                    case 'ping':
                        message = { type: 'ping', timestamp: Date.now() };
                        break;
                    case 'state':
                    case 'getState':
                        message = { type: 'getState' };
                        break;
                    case 'list':
                        const targets = Terrain.IframeManager?.getTargets() || [];
                        this.log(index, 'sys', 'Registered iframes: ' + targets.join(', '));
                        return;
                    case 'help':
                        this.log(index, 'sys', 'Commands: ping, state, list, help, clear, or send JSON');
                        return;
                    case 'clear':
                        const log = document.querySelector(`.cli-log[data-index="${index}"]`);
                        if (log) log.innerHTML = '';
                        return;
                    default:
                        message = { type: type, args: args };
                }
            }

            // Send to target
            if (target === 'iframe') {
                Terrain.IframeManager?.sendToNode(index, message);
                this.log(index, 'out', message);
            } else if (target === 'system') {
                this.log(index, 'sys', 'System: ' + JSON.stringify(message));
                this.updateStatus(index, 'active', 'system: ' + message.type);
            } else if (target === 'all') {
                Terrain.IframeManager?.broadcast(message);
                this.log(index, 'out', { target: 'all', ...message });
            } else {
                const sent = Terrain.IframeManager?.sendToTarget(target, message);
                if (sent) {
                    this.log(index, 'out', { target, ...message });
                } else {
                    this.log(index, 'err', 'Target not found: ' + target);
                }
            }
        },

        /**
         * Log message to CLI
         */
        log: function(index, direction, data) {
            const log = document.querySelector(`.cli-log[data-index="${index}"]`);
            if (!log) return;

            const entry = document.createElement('div');
            entry.className = 'cli-entry cli-' + direction;

            let prefix = '';
            switch (direction) {
                case 'in': prefix = '←'; break;
                case 'out': prefix = '→'; break;
                case 'cmd': prefix = '▸'; break;
                case 'sys': prefix = '●'; break;
                case 'err': prefix = '✗'; break;
            }

            const content = typeof data === 'string' ? data : JSON.stringify(data);
            entry.innerHTML = `<span class="cli-prefix">${prefix}</span> ${Utils.escapeHtml(content)}`;

            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;

            // Limit log entries
            while (log.children.length > 50) {
                log.removeChild(log.firstChild);
            }
        },

        /**
         * Update status line
         */
        updateStatus: function(index, status, text) {
            const statusLine = document.querySelector(`.cli-status-line[data-index="${index}"]`);
            if (!statusLine) return;

            const indicator = statusLine.querySelector('.cli-status-indicator');
            const textEl = statusLine.querySelector('.cli-status-text');

            if (indicator) {
                indicator.className = 'cli-status-indicator';
                indicator.classList.add('status-' + status);
            }
            if (textEl) {
                textEl.textContent = text;
            }
        },

        /**
         * Update CLI target dropdown with registered iframes
         */
        updateTargets: function(cardIndex) {
            const select = document.querySelector(`.cli-target[data-index="${cardIndex}"]`);
            if (!select) return;

            // Preserve current selection
            const current = select.value;

            // Rebuild options
            select.innerHTML = '<option value="iframe">iframe</option>';
            select.innerHTML += '<option value="system">system</option>';
            select.innerHTML += '<option value="all">all</option>';

            const targets = Terrain.IframeManager?.getTargets() || [];
            targets.forEach(id => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = id;
                select.appendChild(opt);
            });

            // Restore selection if still valid
            if (Array.from(select.options).some(o => o.value === current)) {
                select.value = current;
            }
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.CLI = TerrainCLI;

})();
