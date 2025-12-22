/**
 * Terrain Card Base
 * Shared functionality for card-like UI elements (nodes, projects)
 *
 * Usage:
 *   const manager = Terrain.CardBase.create({
 *       name: 'nodes',
 *       stateKey: 'nodes',
 *       cardClass: 'terrain-node',
 *       events: { select: 'NODE_SELECT', expand: 'NODE_EXPAND', ... },
 *       renderCard: (item, index) => '<div>...</div>',
 *       onExpand: (card, index, item) => { ... }
 *   });
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;
    const Utils = window.Terrain.Utils;

    /**
     * Create a card manager with shared functionality
     */
    function createCardManager(config) {
        const {
            name,
            stateKey,
            cardClass,
            events = {},
            renderCard,
            renderEditForm,
            onExpand,
            onCollapse,
            onInit,
            getMinWidth,
            getExpandedWidth
        } = config;

        const DEFAULT_TOKEN = 'gridranger';
        let canvasContent = null;
        let selectedIndex = null;

        const manager = {
            name,
            stateKey,

            /**
             * Initialize the card manager
             */
            init: function() {
                canvasContent = document.getElementById('canvas-content');

                if (!canvasContent) {
                    console.error(`[${name}] Canvas content element not found`);
                    return;
                }

                // Render initial items
                this.renderAll();

                // Listen for state changes
                Events.on(Events.STATE_LOADED, () => this.renderAll());

                // Deselect on canvas click
                const canvas = document.getElementById('canvas');
                if (canvas) {
                    canvas.addEventListener('click', (e) => {
                        if (e.target.id === 'canvas' || e.target.id === 'grid-canvas' || e.target.id === 'canvas-content') {
                            this.deselectAll();
                            this.collapseAll();
                        }
                    });
                }

                // Listen for iframe messages
                window.addEventListener('message', (e) => {
                    if (e.data && e.data.type) {
                        console.log('[Terrain] Iframe message:', e.data);
                        Terrain.IframeManager?.handleMessage(e);
                        Events.emit(Events.IFRAME_MESSAGE, e.data);
                    }
                });

                // Call custom init
                if (onInit) onInit.call(this);
            },

            /**
             * Get state accessor
             */
            getState: function() {
                return State[stateKey];
            },

            /**
             * Render all cards
             */
            renderAll: function() {
                canvasContent.innerHTML = '';
                const items = this.getState().getAll();
                items.forEach((item, index) => this.createCard(item, index));
            },

            /**
             * Create a card element
             */
            createCard: function(item, index) {
                const card = document.createElement('div');
                card.className = cardClass;
                card.style.left = item.x + 'px';
                card.style.top = item.y + 'px';
                card.dataset.index = index;

                if (getMinWidth) {
                    card.style.minWidth = getMinWidth(item) + 'px';
                }

                // Use custom render function
                card.innerHTML = renderCard.call(this, item, index);

                // Apply hidden state
                const uiKey = stateKey;
                if (!State.ui[uiKey] || item.hidden) {
                    card.classList.add('hidden');
                }

                // Bind events
                this.bindCardEvents(card, index, item);

                canvasContent.appendChild(card);
                return card;
            },

            /**
             * Bind events to a card
             */
            bindCardEvents: function(card, index, item) {
                const self = this;

                // Open button - expand card
                const openBtn = card.querySelector('[data-action="open"]');
                if (openBtn) {
                    openBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        self.expand(index);
                    });
                }

                // Close button - collapse card
                const closeBtn = card.querySelector('[data-action="close"]');
                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        self.collapse(index);
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
                        self.edit(index);
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
                    self.select(index);
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
             * Select a card
             */
            select: function(index) {
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
                if (events.select) {
                    Events.emit(events.select, { index });
                }
            },

            /**
             * Deselect all cards
             */
            deselectAll: function() {
                document.querySelectorAll(`.${cardClass}.selected`).forEach(c => {
                    c.classList.remove('selected');
                });
                selectedIndex = null;
            },

            /**
             * Expand a card
             */
            expand: function(index) {
                const item = this.getState().get(index);
                const card = document.querySelector(`[data-index="${index}"]`);
                if (!card) return;

                // Toggle if already expanded
                if (card.classList.contains('expanded')) {
                    this.collapse(index);
                    return;
                }

                // Collapse others first
                this.collapseAll();

                // Select and expand
                this.select(index);
                card.classList.add('expanded');

                if (getExpandedWidth) {
                    const width = getExpandedWidth(item);
                    if (width) card.style.minWidth = width + 'px';
                }

                // Call custom expand handler
                if (onExpand) {
                    const container = card.querySelector('.node-open') ||
                                      card.querySelector('.project-card-open');
                    onExpand.call(this, card, container, index, item);
                }

                if (events.expand) {
                    Events.emit(events.expand, { index, item });
                }
            },

            /**
             * Collapse a card
             */
            collapse: function(index) {
                const card = document.querySelector(`[data-index="${index}"]`);
                if (!card) return;

                const item = this.getState().get(index);
                card.classList.remove('expanded');

                if (getMinWidth) {
                    card.style.minWidth = getMinWidth(item) + 'px';
                }

                // Clear the open container
                const container = card.querySelector('.node-open') ||
                                  card.querySelector('.project-card-open');
                if (container) container.innerHTML = '';

                // Call custom collapse handler
                if (onCollapse) {
                    onCollapse.call(this, card, index, item);
                }

                if (events.collapse) {
                    Events.emit(events.collapse, { index });
                }
            },

            /**
             * Collapse all expanded cards
             */
            collapseAll: function() {
                document.querySelectorAll(`.${cardClass}.expanded`).forEach(card => {
                    const index = parseInt(card.dataset.index);
                    this.collapse(index);
                });
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
                    self.getState().update(index, { x: newX, y: newY });
                }

                function stopMove() {
                    card.classList.remove('dragging');
                    document.removeEventListener('mousemove', moveCard);
                    document.removeEventListener('mouseup', stopMove);

                    if (events.move) {
                        Events.emit(events.move, {
                            index,
                            item: self.getState().get(index)
                        });
                    }
                }

                document.addEventListener('mousemove', moveCard);
                document.addEventListener('mouseup', stopMove);
            },

            /**
             * Enter edit mode for a card
             */
            edit: function(index) {
                // Close any other editing cards
                document.querySelectorAll(`.${cardClass}.editing`).forEach(c => {
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
             * Cancel editing a card
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
             * Save card edits (base implementation)
             */
            saveEdit: function(index) {
                const card = document.querySelector(`[data-index="${index}"]`);
                if (!card) return;

                const item = this.getState().get(index);
                const token = card.querySelector('.edit-token')?.value || '';
                const errorEl = card.querySelector('.token-error');

                // Validate token
                const requiredToken = item.token || DEFAULT_TOKEN;
                if (token !== requiredToken) {
                    if (errorEl) errorEl.classList.add('show');
                    return;
                }

                // Get common values from form
                const updates = {
                    title: card.querySelector('.edit-title')?.value || item.title,
                    desc: card.querySelector('.edit-desc')?.value || item.desc,
                    link: card.querySelector('.edit-link')?.value || item.link
                };

                // Get type-specific values
                const typeSelect = card.querySelector('.edit-type');
                if (typeSelect) updates.type = typeSelect.value;

                const statusSelect = card.querySelector('.edit-status');
                if (statusSelect) updates.status = statusSelect.value;

                // Update state
                this.getState().update(index, updates);

                // Re-render all cards
                this.renderAll();

                if (events.update) {
                    Events.emit(events.update, {
                        index,
                        item: this.getState().get(index)
                    });
                }
            },

            /**
             * Toggle visibility of a specific card
             */
            toggleVisibility: function(index) {
                const item = this.getState().get(index);
                const newHidden = !item.hidden;
                this.getState().update(index, { hidden: newHidden });

                const card = document.querySelector(`[data-index="${index}"]`);
                if (card) {
                    card.classList.toggle('hidden', newHidden);
                }
            },

            /**
             * Toggle all cards visibility
             */
            toggleAll: function() {
                State.ui[stateKey] = !State.ui[stateKey];
                const cards = document.querySelectorAll(`.${cardClass}`);
                cards.forEach(card => {
                    card.classList.toggle('hidden', !State.ui[stateKey]);
                });
                if (events.toggle) {
                    Events.emit(events.toggle, { element: stateKey, visible: State.ui[stateKey] });
                }
            },

            /**
             * Add a new card
             */
            add: function(itemData) {
                const { translateX, translateY, scale } = State.get('canvas');
                const item = {
                    id: itemData.id || Utils.uniqueId(name.slice(0, -1)),
                    title: itemData.title || 'New Item',
                    desc: itemData.desc || '',
                    link: itemData.link || '',
                    x: itemData.x || (-translateX / scale + Math.random() * 600 + 200),
                    y: itemData.y || (-translateY / scale + Math.random() * 400 + 200),
                    hidden: false,
                    token: itemData.token || DEFAULT_TOKEN,
                    ...itemData
                };

                this.getState().add(item);
                this.createCard(item, this.getState().getAll().length - 1);
            },

            /**
             * Get selected index
             */
            getSelectedIndex: function() {
                return selectedIndex;
            }
        };

        return manager;
    }

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.CardBase = {
        create: createCardManager
    };

})();
