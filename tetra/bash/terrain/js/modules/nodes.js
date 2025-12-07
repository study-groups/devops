/**
 * Terrain Nodes Module
 * Node rendering, state management, and interaction
 *
 * Node Types:
 * - frame: Full node with iframe, CLI, interactivity
 * - info: Static content display, no iframe
 * - link: Minimal, just title and external link
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;
    const Utils = window.Terrain.Utils;

    const DEFAULT_TOKEN = 'gridranger';
    let canvasContent = null;
    let selectedIndex = null;

    // Node type definitions
    const NODE_TYPES = {
        frame: {
            name: 'Frame',
            hasIframe: true,
            hasCli: true,
            hasEdit: true,
            minWidth: 280,
            expandedWidth: 520
        },
        info: {
            name: 'Info',
            hasIframe: false,
            hasCli: false,
            hasEdit: true,
            minWidth: 240,
            expandedWidth: null
        },
        link: {
            name: 'Link',
            hasIframe: false,
            hasCli: false,
            hasEdit: false,
            minWidth: 200,
            expandedWidth: null
        }
    };

    const TerrainNodes = {
        /**
         * Initialize nodes module
         */
        init: function() {
            canvasContent = document.getElementById('canvas-content');

            if (!canvasContent) {
                console.error('[Nodes] Canvas content element not found');
                return;
            }

            // Render initial nodes
            this.renderAll();

            // Listen for state changes
            Events.on(Events.EVENTS.STATE_LOADED, () => this.renderAll());

            // Deselect on canvas click
            const canvas = document.getElementById('canvas');
            if (canvas) {
                canvas.addEventListener('click', (e) => {
                    if (e.target.id === 'canvas' || e.target.id === 'grid-canvas' || e.target.id === 'canvas-content') {
                        this.deselectAll();
                        this.collapseAllNodes();
                    }
                });
            }

            // Listen for iframe messages
            window.addEventListener('message', (e) => {
                if (e.data && e.data.type) {
                    console.log('[Terrain] Iframe message:', e.data);
                    Terrain.IframeManager?.handleMessage(e);
                    Events.emit('IFRAME_MESSAGE', e.data);
                }
            });
        },

        /**
         * Get node type definition
         */
        getNodeType: function(typeName) {
            return NODE_TYPES[typeName] || NODE_TYPES.frame;
        },

        /**
         * Render all nodes
         */
        renderAll: function() {
            canvasContent.innerHTML = '';
            const nodes = State.nodes.getAll();
            nodes.forEach((node, index) => this.createNode(node, index));
        },

        /**
         * Create a node element
         */
        createNode: function(node, index) {
            const type = this.getNodeType(node.type || 'frame');
            const card = document.createElement('div');
            card.className = 'terrain-node node-' + (node.type || 'frame');
            card.style.left = node.x + 'px';
            card.style.top = node.y + 'px';
            card.style.minWidth = type.minWidth + 'px';
            card.dataset.index = index;
            card.dataset.type = node.type || 'frame';

            card.innerHTML = this.renderNodeHTML(node, index, type);

            // Apply hidden state
            if (!State.ui.nodes || node.hidden) {
                card.classList.add('hidden');
            }

            // Bind events
            this.bindNodeEvents(card, index, type);

            canvasContent.appendChild(card);
            return card;
        },

        /**
         * Render node HTML based on type
         */
        renderNodeHTML: function(node, index, type) {
            const escape = Utils.escapeHtml.bind(Utils);

            // Header - always present
            let html = `
                <div class="node-header">
                    <div class="node-title">${escape(node.title)}</div>
                    <div class="node-header-actions">`;

            // CLI toggle only for frame nodes
            if (type.hasCli) {
                html += `<button class="node-cli-toggle" data-action="toggle-cli" data-index="${index}">⌘</button>`;
            }

            // Close button for expandable nodes
            if (type.hasIframe) {
                html += `<button class="node-close-btn" data-action="close" data-index="${index}">×</button>`;
            }

            // External link for link nodes
            if (node.type === 'link' && node.link) {
                html += `<a class="node-link-btn" href="${escape(node.link)}" target="_blank">→</a>`;
            }

            html += `</div></div>`;

            // View section - shown in small mode
            html += `<div class="node-view">`;

            if (node.desc) {
                html += `<div class="node-desc">${escape(node.desc)}</div>`;
            }

            // Footer with actions
            if (type.hasIframe || type.hasEdit) {
                html += `<div class="node-footer">`;
                if (type.hasIframe) {
                    html += `<button class="node-open-btn" data-action="open" data-index="${index}">OPEN</button>`;
                }
                if (type.hasEdit) {
                    html += `<button class="node-edit-trigger" data-action="edit" data-index="${index}">Edit</button>`;
                }
                html += `</div>`;
            }

            html += `</div>`;

            // Open section - for frame nodes
            if (type.hasIframe) {
                html += `<div class="node-open"></div>`;
            }

            // Edit section
            if (type.hasEdit) {
                html += this.renderEditHTML(node, index);
            }

            return html;
        },

        /**
         * Render edit form HTML
         */
        renderEditHTML: function(node, index) {
            const escape = Utils.escapeHtml.bind(Utils);

            return `
                <div class="node-edit">
                    <label>Title</label>
                    <input type="text" class="edit-title" value="${escape(node.title)}">

                    <label>Description</label>
                    <input type="text" class="edit-desc" value="${escape(node.desc || '')}">

                    <label>Link</label>
                    <input type="text" class="edit-link" value="${escape(node.link || '')}">

                    <label>Type</label>
                    <select class="edit-type">
                        <option value="frame" ${node.type === 'frame' ? 'selected' : ''}>Frame</option>
                        <option value="info" ${node.type === 'info' ? 'selected' : ''}>Info</option>
                        <option value="link" ${node.type === 'link' ? 'selected' : ''}>Link</option>
                    </select>

                    <label>Token (enter to save)</label>
                    <input type="password" class="edit-token token-input" placeholder="Enter token..." value="">
                    <div class="token-error">Invalid token.</div>

                    <div class="node-edit-actions">
                        <button class="cancel" data-action="cancel" data-index="${index}">Cancel</button>
                        <button class="save" data-action="save" data-index="${index}">Save</button>
                    </div>
                </div>
            `;
        },

        /**
         * Bind events to a node
         */
        bindNodeEvents: function(card, index, type) {
            const self = this;

            // Open button - expand node
            const openBtn = card.querySelector('[data-action="open"]');
            if (openBtn) {
                openBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    self.expandNode(index);
                });
            }

            // Close button - collapse node
            const closeBtn = card.querySelector('[data-action="close"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    self.collapseNode(index);
                });
            }

            // CLI toggle button
            const cliToggle = card.querySelector('[data-action="toggle-cli"]');
            if (cliToggle) {
                cliToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Terrain.CLI?.toggle(index);
                });
            }

            // Edit button
            const editBtn = card.querySelector('[data-action="edit"]');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    self.editNode(index);
                });
            }

            // Cancel button
            const cancelBtn = card.querySelector('[data-action="cancel"]');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    self.cancelEdit(index);
                });
            }

            // Save button
            const saveBtn = card.querySelector('[data-action="save"]');
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    self.saveEdit(index);
                });
            }

            // Click to select (not on buttons/inputs)
            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' ||
                    e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
                if (card.classList.contains('editing')) return;
                e.stopPropagation();
                self.selectNode(index);
            });

            // Drag functionality (only when not expanded/editing)
            card.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' ||
                    e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
                if (card.classList.contains('editing')) return;
                if (card.classList.contains('expanded')) return;

                e.stopPropagation();
                self.startDrag(card, index, e);
            });
        },

        /**
         * Select a node
         */
        selectNode: function(index) {
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
            Events.emit('NODE_SELECT', { index });
        },

        /**
         * Deselect all nodes
         */
        deselectAll: function() {
            document.querySelectorAll('.terrain-node.selected').forEach(c => {
                c.classList.remove('selected');
            });
            selectedIndex = null;
        },

        /**
         * Expand a frame node
         */
        expandNode: function(index) {
            const node = State.nodes.get(index);
            const card = document.querySelector(`[data-index="${index}"]`);
            if (!card) return;

            const type = this.getNodeType(node.type || 'frame');
            if (!type.hasIframe) return; // Only frame nodes expand

            // Toggle if already expanded
            if (card.classList.contains('expanded')) {
                this.collapseNode(index);
                return;
            }

            // Collapse others first
            this.collapseAllNodes();

            // Select and expand
            this.selectNode(index);
            card.classList.add('expanded');
            if (type.expandedWidth) {
                card.style.minWidth = type.expandedWidth + 'px';
            }

            // Populate the open container
            const openContainer = card.querySelector('.node-open');
            if (openContainer && Terrain.CLI) {
                Terrain.CLI.render(openContainer, index, node);
            }

            Events.emit('NODE_EXPAND', { index, node });
        },

        /**
         * Collapse a node
         */
        collapseNode: function(index) {
            const card = document.querySelector(`[data-index="${index}"]`);
            if (!card) return;

            const node = State.nodes.get(index);
            const type = this.getNodeType(node?.type || 'frame');

            card.classList.remove('expanded');
            card.style.minWidth = type.minWidth + 'px';

            // Clear the open container
            const openContainer = card.querySelector('.node-open');
            if (openContainer) openContainer.innerHTML = '';

            Events.emit('NODE_COLLAPSE', { index });
        },

        /**
         * Collapse all expanded nodes
         */
        collapseAllNodes: function() {
            document.querySelectorAll('.terrain-node.expanded').forEach(card => {
                const index = parseInt(card.dataset.index);
                this.collapseNode(index);
            });
        },

        /**
         * Start dragging a node
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
                State.nodes.update(index, { x: newX, y: newY });
            }

            function stopMove() {
                card.classList.remove('dragging');
                document.removeEventListener('mousemove', moveCard);
                document.removeEventListener('mouseup', stopMove);

                Events.emit('NODE_MOVE', {
                    index,
                    node: State.nodes.get(index)
                });
            }

            document.addEventListener('mousemove', moveCard);
            document.addEventListener('mouseup', stopMove);
        },

        /**
         * Enter edit mode for a node
         */
        editNode: function(index) {
            // Close any other editing nodes
            document.querySelectorAll('.terrain-node.editing').forEach(c => {
                c.classList.remove('editing');
            });

            const card = document.querySelector(`[data-index="${index}"]`);
            if (card) {
                card.classList.add('editing');
                if (card.classList.contains('hidden')) {
                    card.classList.remove('hidden');
                }
            }
        },

        /**
         * Cancel editing a node
         */
        cancelEdit: function(index) {
            const card = document.querySelector(`[data-index="${index}"]`);
            if (card) {
                card.classList.remove('editing');
                const errorEl = card.querySelector('.token-error');
                if (errorEl) errorEl.classList.remove('show');
                const tokenInput = card.querySelector('.edit-token');
                if (tokenInput) tokenInput.value = '';
            }
        },

        /**
         * Save node edits
         */
        saveEdit: function(index) {
            const card = document.querySelector(`[data-index="${index}"]`);
            if (!card) return;

            const node = State.nodes.get(index);
            const token = card.querySelector('.edit-token').value;
            const errorEl = card.querySelector('.token-error');

            // Validate token
            const requiredToken = node.token || DEFAULT_TOKEN;
            if (token !== requiredToken) {
                errorEl.classList.add('show');
                return;
            }

            // Get values from form
            const title = card.querySelector('.edit-title').value;
            const desc = card.querySelector('.edit-desc').value;
            const link = card.querySelector('.edit-link').value;
            const type = card.querySelector('.edit-type').value;

            // Update state
            State.nodes.update(index, { title, desc, link, type });

            // Re-render all nodes (type may have changed)
            this.renderAll();

            Events.emit('NODE_UPDATE', {
                index,
                node: State.nodes.get(index)
            });
        },

        /**
         * Toggle visibility of a specific node
         */
        toggleVisibility: function(index) {
            const node = State.nodes.get(index);
            const newHidden = !node.hidden;
            State.nodes.update(index, { hidden: newHidden });

            const card = document.querySelector(`[data-index="${index}"]`);
            if (card) {
                card.classList.toggle('hidden', newHidden);
            }
        },

        /**
         * Toggle all nodes visibility
         */
        toggleAll: function() {
            State.ui.nodes = !State.ui.nodes;
            const cards = document.querySelectorAll('.terrain-node');
            cards.forEach(card => {
                card.classList.toggle('hidden', !State.ui.nodes);
            });
            Events.emit('UI_TOGGLE', { element: 'nodes', visible: State.ui.nodes });
        },

        /**
         * Add a new node
         */
        addNode: function(nodeData) {
            const { translateX, translateY, scale } = State.get('canvas');
            const node = {
                id: nodeData.id || Utils.uniqueId('node'),
                type: nodeData.type || 'frame',
                title: nodeData.title || 'New Node',
                desc: nodeData.desc || '',
                link: nodeData.link || '',
                iframeSrc: nodeData.iframeSrc || '',
                x: nodeData.x || (-translateX / scale + Math.random() * 600 + 200),
                y: nodeData.y || (-translateY / scale + Math.random() * 400 + 200),
                hidden: false,
                token: nodeData.token || DEFAULT_TOKEN
            };

            State.nodes.add(node);
            this.createNode(node, State.nodes.getAll().length - 1);
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Nodes = TerrainNodes;

})();
