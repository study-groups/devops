/**
 * Terrain Projects Module
 * Project card CRUD, rendering, and drag functionality
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;

    const DEFAULT_TOKEN = 'gridranger';
    let canvasContent = null;
    let selectedIndex = null;

    // Iframe registry - tracks all registered iframes
    const iframeRegistry = new Map();  // id -> { iframe, project, ready }

    const TerrainProjects = {
        /**
         * Initialize projects module
         */
        init: function() {
            canvasContent = document.getElementById('canvas-content');

            if (!canvasContent) {
                console.error('[Projects] Canvas content element not found');
                return;
            }

            // Render initial projects
            this.renderAll();

            // Listen for state changes
            Events.on(Events.EVENTS.STATE_LOADED, () => this.renderAll());

            // Deselect on canvas click
            const canvas = document.getElementById('canvas');
            if (canvas) {
                canvas.addEventListener('click', (e) => {
                    if (e.target.id === 'canvas' || e.target.id === 'grid-canvas' || e.target.id === 'canvas-content') {
                        this.deselectAll();
                        this.collapseAllCards();
                    }
                });
            }

            // Listen for iframe messages
            window.addEventListener('message', (e) => {
                if (e.data && e.data.type) {
                    console.log('[Terrain] Iframe message:', e.data);
                    this.handleIframeMessage(e);
                    Events.emit('IFRAME_MESSAGE', e.data);
                }
            });
        },

        /**
         * Handle messages from iframes
         */
        handleIframeMessage: function(event) {
            const data = event.data;
            const source = event.source;

            // Find which iframe sent this message
            let senderIndex = null;
            document.querySelectorAll('.project-iframe').forEach((iframe, idx) => {
                if (iframe.contentWindow === source) {
                    const card = iframe.closest('.project-card');
                    senderIndex = parseInt(card?.dataset.index);
                }
            });

            // Handle registration
            if (data.type === 'ready') {
                const project = senderIndex !== null ? State.projects.get(senderIndex) : null;
                const id = data.from || (project ? project.id : 'unknown-' + Date.now());

                iframeRegistry.set(id, {
                    source: source,
                    projectIndex: senderIndex,
                    project: project,
                    ready: true,
                    registeredAt: Date.now()
                });

                console.log('[Terrain] Iframe registered:', id);
                this.updateCliTargets(senderIndex);

                // Inject tokens when iframe is ready
                if (senderIndex !== null) {
                    const card = document.querySelector(`[data-index="${senderIndex}"]`);
                    const iframe = card?.querySelector('.project-iframe');
                    if (iframe) {
                        this.injectTokensToIframe(iframe);
                    }
                    this.updateStatusLine(senderIndex, 'active', 'connected: ' + id);
                }
            }

            // Log to CLI if card is expanded
            if (senderIndex !== null) {
                this.logToCli(senderIndex, 'in', data);
            }
        },

        /**
         * Render all project cards
         */
        renderAll: function() {
            canvasContent.innerHTML = '';
            const projects = State.projects.getAll();
            projects.forEach((project, index) => this.createCard(project, index));
        },

        /**
         * Create a project card element
         */
        createCard: function(project, index) {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.style.left = project.x + 'px';
            card.style.top = project.y + 'px';
            card.dataset.index = index;

            card.innerHTML = `
                <div class="project-card-header">
                    <div class="project-title">${this.escapeHtml(project.title)}</div>
                    <div class="project-header-actions">
                        <button class="project-cli-toggle" data-action="toggle-cli" data-index="${index}">⌘</button>
                        <button class="project-close-btn" data-action="close" data-index="${index}">×</button>
                    </div>
                </div>
                <div class="project-card-view">
                    <div class="project-desc">${this.escapeHtml(project.desc)}</div>
                    <div class="project-card-footer">
                        <button class="project-open-btn" data-action="open" data-index="${index}">OPEN</button>
                        <button class="project-card-edit-trigger" data-action="edit" data-index="${index}">Edit</button>
                    </div>
                </div>
                <div class="project-card-open"></div>
                <div class="project-card-edit">
                    <label>Title</label>
                    <input type="text" class="edit-title" value="${this.escapeHtml(project.title)}">

                    <label>Description</label>
                    <input type="text" class="edit-desc" value="${this.escapeHtml(project.desc)}">

                    <label>Link</label>
                    <input type="text" class="edit-link" value="${this.escapeHtml(project.link)}">

                    <label>Status</label>
                    <select class="edit-status">
                        <option value="draft" ${project.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="live" ${project.status === 'live' ? 'selected' : ''}>Live</option>
                    </select>

                    <label>Token (enter to save changes)</label>
                    <input type="password" class="edit-token token-input" placeholder="Enter token..." value="">
                    <div class="token-error">Invalid token.</div>

                    <div class="project-card-edit-actions">
                        <button class="cancel" data-action="cancel" data-index="${index}">Cancel</button>
                        <button class="save" data-action="save" data-index="${index}">Save</button>
                    </div>
                </div>
            `;

            // Apply hidden state
            if (!State.ui.projects || project.hidden) {
                card.classList.add('hidden');
            }

            // Bind events
            this.bindCardEvents(card, index);

            canvasContent.appendChild(card);
            return card;
        },

        /**
         * Bind events to a card
         */
        bindCardEvents: function(card, index) {
            const self = this;

            // Open button - expand card with iframe
            card.querySelector('[data-action="open"]').addEventListener('click', (e) => {
                e.stopPropagation();
                self.expandCard(index);
            });

            // Close button - collapse card
            card.querySelector('[data-action="close"]').addEventListener('click', (e) => {
                e.stopPropagation();
                self.collapseCard(index);
            });

            // CLI toggle button
            card.querySelector('[data-action="toggle-cli"]').addEventListener('click', (e) => {
                e.stopPropagation();
                self.toggleCli(index);
            });

            // Edit button
            card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
                e.stopPropagation();
                self.editCard(index);
            });

            // Cancel button
            card.querySelector('[data-action="cancel"]').addEventListener('click', (e) => {
                e.stopPropagation();
                self.cancelEdit(index);
            });

            // Save button
            card.querySelector('[data-action="save"]').addEventListener('click', (e) => {
                e.stopPropagation();
                self.saveEdit(index);
            });

            // Click to select (not on buttons/inputs)
            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
                if (card.classList.contains('editing')) return;
                e.stopPropagation();
                self.selectCard(index);
            });

            // Drag functionality (only in small mode)
            card.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
                if (card.classList.contains('editing')) return;
                if (card.classList.contains('expanded')) return;

                e.stopPropagation();
                self.startDrag(card, index, e);
            });
        },

        /**
         * Select a card
         */
        selectCard: function(index) {
            // Deselect previous
            if (selectedIndex !== null && selectedIndex !== index) {
                const prev = document.querySelector(`[data-index="${selectedIndex}"]`);
                if (prev) prev.classList.remove('selected');
            }
            // Select new
            selectedIndex = index;
            const card = document.querySelector(`[data-index="${index}"]`);
            if (card) {
                card.classList.add('selected');
            }
            Events.emit('PROJECT_SELECT', { index });
        },

        /**
         * Deselect all cards
         */
        deselectAll: function() {
            document.querySelectorAll('.project-card.selected').forEach(c => {
                c.classList.remove('selected');
            });
            selectedIndex = null;
        },

        /**
         * Expand a card with iframe
         */
        expandCard: function(index) {
            const project = State.projects.get(index);
            const card = document.querySelector(`[data-index="${index}"]`);
            if (!card) return;

            // Toggle if already expanded
            if (card.classList.contains('expanded')) {
                this.collapseCard(index);
                return;
            }

            // Collapse others first
            this.collapseAllCards();

            // Select and expand
            this.selectCard(index);
            card.classList.add('expanded');

            // Populate the open container - iframe first, CLI hidden by default
            const openContainer = card.querySelector('.project-card-open');
            openContainer.innerHTML = `
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
                <div class="project-iframe-container">
                    <iframe src="${project.iframeSrc || project.link}" class="project-iframe"></iframe>
                </div>
            `;

            // Bind CLI events
            this.bindCliEvents(card, index);

            Events.emit('PROJECT_EXPAND', { index, project });
        },

        /**
         * Toggle CLI visibility
         */
        toggleCli: function(index) {
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
                const toggleBtn = card.querySelector('.project-cli-toggle');
                if (toggleBtn) {
                    toggleBtn.classList.toggle('active', !isHidden);
                }
            }
        },

        /**
         * Update status line
         */
        updateStatusLine: function(index, status, text) {
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
         * Bind CLI input events
         */
        bindCliEvents: function(card, index) {
            const self = this;
            const input = card.querySelector('.cli-input');
            const targetSelect = card.querySelector('.cli-target');

            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const cmd = input.value.trim();
                        if (cmd) {
                            self.executeCliCommand(index, cmd, targetSelect?.value || 'self');
                            input.value = '';
                        }
                    }
                });

                // Focus input when expanded
                setTimeout(() => input.focus(), 100);
            }
        },

        /**
         * Execute a CLI command
         */
        executeCliCommand: function(index, cmd, target) {
            this.logToCli(index, 'cmd', cmd);

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
                        this.logToCli(index, 'sys', 'Registered iframes: ' +
                            Array.from(iframeRegistry.keys()).join(', '));
                        return;
                    case 'help':
                        this.logToCli(index, 'sys', 'Commands: ping, state, list, help, or send JSON');
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
                this.sendToIframe(index, message);
                this.logToCli(index, 'out', message);
            } else if (target === 'system') {
                // System commands - handle locally
                this.logToCli(index, 'sys', 'System: ' + JSON.stringify(message));
                this.updateStatusLine(index, 'active', 'system: ' + message.type);
            } else if (target === 'all') {
                iframeRegistry.forEach((entry, id) => {
                    if (entry.source) {
                        entry.source.postMessage(message, '*');
                    }
                });
                this.logToCli(index, 'out', { target: 'all', ...message });
            } else {
                const entry = iframeRegistry.get(target);
                if (entry && entry.source) {
                    entry.source.postMessage(message, '*');
                    this.logToCli(index, 'out', { target, ...message });
                } else {
                    this.logToCli(index, 'err', 'Target not found: ' + target);
                }
            }
        },

        /**
         * Log message to CLI
         */
        logToCli: function(index, direction, data) {
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
            entry.innerHTML = `<span class="cli-prefix">${prefix}</span> ${this.escapeHtml(content)}`;

            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;

            // Limit log entries
            while (log.children.length > 50) {
                log.removeChild(log.firstChild);
            }
        },

        /**
         * Update CLI target dropdown with registered iframes
         */
        updateCliTargets: function(cardIndex) {
            const select = document.querySelector(`.cli-target[data-index="${cardIndex}"]`);
            if (!select) return;

            // Preserve current selection
            const current = select.value;

            // Rebuild options
            select.innerHTML = '<option value="self">self</option>';
            select.innerHTML += '<option value="all">all</option>';

            iframeRegistry.forEach((entry, id) => {
                if (entry.projectIndex !== cardIndex) {
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = id;
                    select.appendChild(opt);
                }
            });

            // Restore selection if still valid
            if (Array.from(select.options).some(o => o.value === current)) {
                select.value = current;
            }
        },

        /**
         * Collapse a card
         */
        collapseCard: function(index) {
            const card = document.querySelector(`[data-index="${index}"]`);
            if (!card) return;

            card.classList.remove('expanded');

            // Clear the open container
            const openContainer = card.querySelector('.project-card-open');
            if (openContainer) openContainer.innerHTML = '';

            Events.emit('PROJECT_COLLAPSE', { index });
        },

        /**
         * Collapse all expanded cards
         */
        collapseAllCards: function() {
            document.querySelectorAll('.project-card.expanded').forEach(card => {
                const index = parseInt(card.dataset.index);
                this.collapseCard(index);
            });
        },

        /**
         * Send message to a card's iframe
         */
        sendToIframe: function(index, data) {
            const card = document.querySelector(`[data-index="${index}"]`);
            const iframe = card?.querySelector('.project-iframe');
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(data, '*');
            }
        },

        /**
         * Extract CSS tokens from parent document
         */
        extractTokens: function() {
            const style = getComputedStyle(document.documentElement);
            const tokenNames = [
                // Surfaces
                'surface-void', 'surface-panel', 'surface-elevated', 'surface-hover',
                // Edges
                'edge-subtle', 'edge-visible', 'edge-active',
                // Ink
                'ink-primary', 'ink-secondary', 'ink-muted', 'ink-code',
                // Signals
                'signal-primary', 'signal-secondary', 'signal-success', 'signal-error', 'signal-warning',
                // Typography
                'font-primary', 'font-secondary', 'font-code',
                // Curves
                'curve-sm', 'curve-md', 'curve-lg',
                // Gaps
                'gap-xs', 'gap-sm', 'gap-md', 'gap-lg', 'gap-xl',
                // Tempo
                'tempo-fast', 'tempo-normal', 'tempo-slow'
            ];

            const tokens = {};
            tokenNames.forEach(name => {
                const value = style.getPropertyValue('--' + name).trim();
                if (value) {
                    tokens[name] = value;
                }
            });
            return tokens;
        },

        /**
         * Inject CSS tokens into an iframe
         */
        injectTokensToIframe: function(iframe) {
            if (!iframe?.contentWindow) return;
            const tokens = this.extractTokens();
            iframe.contentWindow.postMessage({
                type: 'injectTokens',
                tokens: tokens
            }, '*');
            console.log('[Terrain.Projects] Injected tokens to iframe:', Object.keys(tokens).length);
        },

        /**
         * Start dragging a card
         */
        startDrag: function(card, index, e) {
            const self = this;
            const scale = State.canvas.scale;
            const startCardX = e.clientX / scale - parseFloat(card.style.left);
            const startCardY = e.clientY / scale - parseFloat(card.style.top);

            card.classList.add('dragging');

            function moveCard(e) {
                const newX = e.clientX / scale - startCardX;
                const newY = e.clientY / scale - startCardY;
                card.style.left = newX + 'px';
                card.style.top = newY + 'px';

                // Update state
                State.projects.update(index, { x: newX, y: newY });
            }

            function stopMove() {
                card.classList.remove('dragging');
                document.removeEventListener('mousemove', moveCard);
                document.removeEventListener('mouseup', stopMove);

                Events.emit(Events.EVENTS.PROJECT_MOVE, {
                    index,
                    project: State.projects.get(index)
                });
            }

            document.addEventListener('mousemove', moveCard);
            document.addEventListener('mouseup', stopMove);
        },

        /**
         * Enter edit mode for a card
         */
        editCard: function(index) {
            // Close any other editing cards
            document.querySelectorAll('.project-card.editing').forEach(c => {
                c.classList.remove('editing');
            });

            const cards = document.querySelectorAll('.project-card');
            const card = cards[index];
            if (card) {
                card.classList.add('editing');
                // Make sure card is visible
                if (card.classList.contains('hidden')) {
                    card.classList.remove('hidden');
                }
            }
        },

        /**
         * Cancel editing a card
         */
        cancelEdit: function(index) {
            const cards = document.querySelectorAll('.project-card');
            const card = cards[index];
            if (card) {
                card.classList.remove('editing');
                // Clear token error and input
                const errorEl = card.querySelector('.token-error');
                if (errorEl) errorEl.classList.remove('show');
                const tokenInput = card.querySelector('.edit-token');
                if (tokenInput) tokenInput.value = '';
            }
        },

        /**
         * Save card edits
         */
        saveEdit: function(index) {
            const cards = document.querySelectorAll('.project-card');
            const card = cards[index];
            if (!card) return;

            const project = State.projects.get(index);
            const token = card.querySelector('.edit-token').value;
            const errorEl = card.querySelector('.token-error');

            // Validate token
            const requiredToken = project.token || DEFAULT_TOKEN;
            if (token !== requiredToken) {
                errorEl.classList.add('show');
                return;
            }

            // Get values from form
            const title = card.querySelector('.edit-title').value;
            const desc = card.querySelector('.edit-desc').value;
            const link = card.querySelector('.edit-link').value;
            const status = card.querySelector('.edit-status').value;

            // Update state
            State.projects.update(index, { title, desc, link, status });

            // Re-render all cards
            this.renderAll();

            Events.emit(Events.EVENTS.PROJECT_UPDATE, {
                index,
                project: State.projects.get(index)
            });
        },

        /**
         * Toggle visibility of a specific project
         */
        toggleVisibility: function(index) {
            const project = State.projects.get(index);
            const newHidden = !project.hidden;
            State.projects.update(index, { hidden: newHidden });

            const cards = document.querySelectorAll('.project-card');
            const card = cards[index];
            if (card) {
                card.classList.toggle('hidden', newHidden);
            }
        },

        /**
         * Toggle all projects visibility
         */
        toggleAll: function() {
            State.ui.projects = !State.ui.projects;
            const cards = document.querySelectorAll('.project-card');
            cards.forEach(card => {
                card.classList.toggle('hidden', !State.ui.projects);
            });
            Events.emit(Events.EVENTS.UI_TOGGLE, { element: 'projects', visible: State.ui.projects });
        },

        /**
         * Add a new project
         */
        addProject: function(projectData) {
            const { translateX, translateY, scale } = State.get('canvas');
            const project = {
                id: projectData.id || 'project-' + Date.now(),
                title: projectData.title || 'New Project',
                desc: projectData.desc || 'No description',
                link: projectData.link || '#',
                status: projectData.status || 'draft',
                x: projectData.x || (-translateX / scale + Math.random() * 600 + 200),
                y: projectData.y || (-translateY / scale + Math.random() * 400 + 200),
                hidden: false,
                token: projectData.token || DEFAULT_TOKEN
            };

            State.projects.add(project);
            this.createCard(project, State.projects.getAll().length - 1);
        },

        /**
         * Escape HTML to prevent XSS
         */
        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Projects = TerrainProjects;

})();
