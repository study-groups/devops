/**
 * TERRAIN.UI Module
 * Factory functions for reusable UI components
 */
(function() {
    'use strict';

    // Component instance registry
    const instances = new Map();
    let instanceId = 0;

    /**
     * Generate unique instance ID
     */
    function nextId(prefix) {
        return `${prefix}-${++instanceId}`;
    }

    /**
     * Create DOM element with attributes
     */
    function createElement(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key.startsWith('data')) {
                el.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        });
        children.forEach(child => {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else if (child) {
                el.appendChild(child);
            }
        });
        return el;
    }

    const TerrainUI = {
        /**
         * Sidebar Component
         */
        Sidebar: {
            create: function(config = {}) {
                const id = nextId('sidebar');
                const {
                    width = '280px',
                    position = 'left',
                    collapsible = true,
                    title = '',
                    content = null
                } = config;

                const sidebar = createElement('aside', {
                    id,
                    className: `terrain-sidebar terrain-sidebar--${position}`,
                    style: { width }
                });

                if (title) {
                    const header = createElement('div', { className: 'terrain-sidebar__header' }, [
                        createElement('span', { className: 'terrain-sidebar__title' }, [title])
                    ]);

                    if (collapsible) {
                        const toggle = createElement('button', {
                            className: 'terrain-sidebar__toggle',
                            onClick: () => instance.toggle()
                        }, ['\u2630']);
                        header.appendChild(toggle);
                    }

                    sidebar.appendChild(header);
                }

                const body = createElement('div', { className: 'terrain-sidebar__body' });
                if (content) {
                    if (typeof content === 'string') {
                        body.innerHTML = content;
                    } else {
                        body.appendChild(content);
                    }
                }
                sidebar.appendChild(body);

                const instance = {
                    id,
                    el: sidebar,
                    show: () => { sidebar.classList.add('terrain-sidebar--visible'); },
                    hide: () => { sidebar.classList.remove('terrain-sidebar--visible'); },
                    toggle: () => { sidebar.classList.toggle('terrain-sidebar--visible'); },
                    setContent: (html) => { body.innerHTML = html; },
                    appendTo: (parent) => { parent.appendChild(sidebar); return instance; },
                    destroy: () => { sidebar.remove(); instances.delete(id); }
                };

                instances.set(id, instance);
                return instance;
            }
        },

        /**
         * Header Component
         */
        Header: {
            create: function(config = {}) {
                const id = nextId('header');
                const {
                    title = 'Terrain',
                    subtitle = '',
                    actions = []
                } = config;

                const header = createElement('header', {
                    id,
                    className: 'terrain-header'
                });

                const titleArea = createElement('div', { className: 'terrain-header__title-area' }, [
                    createElement('h1', { className: 'terrain-header__title' }, [title])
                ]);

                if (subtitle) {
                    titleArea.appendChild(
                        createElement('span', { className: 'terrain-header__subtitle' }, [subtitle])
                    );
                }

                header.appendChild(titleArea);

                const actionsArea = createElement('div', { className: 'terrain-header__actions' });
                header.appendChild(actionsArea);

                const instance = {
                    id,
                    el: header,
                    setTitle: (text) => { header.querySelector('.terrain-header__title').textContent = text; },
                    setSubtitle: (text) => {
                        let sub = header.querySelector('.terrain-header__subtitle');
                        if (!sub) {
                            sub = createElement('span', { className: 'terrain-header__subtitle' });
                            titleArea.appendChild(sub);
                        }
                        sub.textContent = text;
                    },
                    addAction: (action) => {
                        const btn = createElement('button', {
                            className: 'terrain-header__action',
                            onClick: action.onClick
                        }, [action.label || action.icon || '']);
                        actionsArea.appendChild(btn);
                        return btn;
                    },
                    appendTo: (parent) => { parent.appendChild(header); return instance; },
                    destroy: () => { header.remove(); instances.delete(id); }
                };

                actions.forEach(action => instance.addAction(action));
                instances.set(id, instance);
                return instance;
            }
        },

        /**
         * Footer Component
         */
        Footer: {
            create: function(config = {}) {
                const id = nextId('footer');
                const { status = '', actions = [] } = config;

                const footer = createElement('footer', {
                    id,
                    className: 'terrain-footer'
                });

                const statusArea = createElement('div', { className: 'terrain-footer__status' }, [status]);
                footer.appendChild(statusArea);

                const actionsArea = createElement('div', { className: 'terrain-footer__actions' });
                footer.appendChild(actionsArea);

                const instance = {
                    id,
                    el: footer,
                    setStatus: (text) => { statusArea.textContent = text; },
                    addAction: (action) => {
                        const btn = createElement('button', {
                            className: 'terrain-footer__action',
                            onClick: action.onClick
                        }, [action.label || '']);
                        actionsArea.appendChild(btn);
                        return btn;
                    },
                    appendTo: (parent) => { parent.appendChild(footer); return instance; },
                    destroy: () => { footer.remove(); instances.delete(id); }
                };

                actions.forEach(action => instance.addAction(action));
                instances.set(id, instance);
                return instance;
            }
        },

        /**
         * Fab (Floating Action Button) Component
         */
        Fab: {
            create: function(config = {}) {
                const id = nextId('fab');
                const {
                    icon = '+',
                    position = 'bottom-right',
                    actions = [],
                    onClick = null
                } = config;

                const container = createElement('div', {
                    id,
                    className: `terrain-fab-container terrain-fab--${position}`
                });

                const fab = createElement('button', {
                    className: 'terrain-fab',
                    onClick: onClick || (() => instance.toggleMenu())
                }, [icon]);

                container.appendChild(fab);

                const menu = createElement('div', { className: 'terrain-fab__menu' });
                container.appendChild(menu);

                const instance = {
                    id,
                    el: container,
                    addAction: (action) => {
                        const btn = createElement('button', {
                            className: 'terrain-fab__action',
                            title: action.label || '',
                            onClick: action.onClick
                        }, [action.icon || action.label || '']);
                        menu.appendChild(btn);
                        return btn;
                    },
                    toggleMenu: () => { container.classList.toggle('terrain-fab--open'); },
                    showMenu: () => { container.classList.add('terrain-fab--open'); },
                    hideMenu: () => { container.classList.remove('terrain-fab--open'); },
                    appendTo: (parent) => { parent.appendChild(container); return instance; },
                    destroy: () => { container.remove(); instances.delete(id); }
                };

                actions.forEach(action => instance.addAction(action));
                instances.set(id, instance);
                return instance;
            }
        },

        /**
         * Panel Component (draggable)
         */
        Panel: {
            create: function(config = {}) {
                const id = nextId('panel');
                const {
                    title = 'Panel',
                    draggable = true,
                    closable = true,
                    position = { right: '16px', bottom: '16px' },
                    sections = [],
                    visible = false
                } = config;

                const panel = createElement('div', {
                    id,
                    className: 'terrain-panel' + (visible ? ' terrain-panel--visible' : ''),
                    style: position
                });

                // Header
                const header = createElement('div', { className: 'terrain-panel__header' }, [
                    createElement('span', { className: 'terrain-panel__title' }, [title])
                ]);

                if (closable) {
                    const closeBtn = createElement('button', {
                        className: 'terrain-panel__close',
                        onClick: () => instance.hide()
                    }, ['\u00d7']);
                    header.appendChild(closeBtn);
                }

                panel.appendChild(header);

                // Body
                const body = createElement('div', { className: 'terrain-panel__body' });
                panel.appendChild(body);

                // Dragging
                if (draggable) {
                    let isDragging = false;
                    let startX, startY, startLeft, startTop;

                    header.style.cursor = 'move';
                    header.addEventListener('mousedown', (e) => {
                        if (e.target.classList.contains('terrain-panel__close')) return;
                        isDragging = true;
                        startX = e.clientX;
                        startY = e.clientY;
                        const rect = panel.getBoundingClientRect();
                        startLeft = rect.left;
                        startTop = rect.top;
                        panel.style.right = 'auto';
                        panel.style.bottom = 'auto';
                        panel.style.left = startLeft + 'px';
                        panel.style.top = startTop + 'px';
                    });

                    document.addEventListener('mousemove', (e) => {
                        if (!isDragging) return;
                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;
                        panel.style.left = (startLeft + dx) + 'px';
                        panel.style.top = (startTop + dy) + 'px';
                    });

                    document.addEventListener('mouseup', () => {
                        isDragging = false;
                    });
                }

                const instance = {
                    id,
                    el: panel,
                    body,
                    show: () => { panel.classList.add('terrain-panel--visible'); },
                    hide: () => { panel.classList.remove('terrain-panel--visible'); },
                    toggle: () => { panel.classList.toggle('terrain-panel--visible'); },
                    setTitle: (text) => { panel.querySelector('.terrain-panel__title').textContent = text; },
                    addSection: (sectionConfig) => {
                        const section = TerrainUI.Subpanel.create(sectionConfig);
                        body.appendChild(section.el);
                        return section;
                    },
                    setContent: (html) => { body.innerHTML = html; },
                    appendTo: (parent) => { parent.appendChild(panel); return instance; },
                    destroy: () => { panel.remove(); instances.delete(id); }
                };

                sections.forEach(s => instance.addSection(s));
                instances.set(id, instance);
                return instance;
            }
        },

        /**
         * Subpanel Component (collapsible section)
         */
        Subpanel: {
            create: function(config = {}) {
                const id = nextId('subpanel');
                const {
                    title = 'Section',
                    collapsed = false,
                    content = null
                } = config;

                const section = createElement('div', {
                    id,
                    className: 'terrain-subpanel' + (collapsed ? ' terrain-subpanel--collapsed' : '')
                });

                const header = createElement('div', {
                    className: 'terrain-subpanel__header',
                    onClick: () => instance.toggle()
                }, [
                    createElement('span', { className: 'terrain-subpanel__title' }, [title]),
                    createElement('span', { className: 'terrain-subpanel__icon' }, [collapsed ? '\u25b6' : '\u25bc'])
                ]);

                section.appendChild(header);

                const body = createElement('div', { className: 'terrain-subpanel__body' });
                if (content) {
                    if (typeof content === 'string') {
                        body.innerHTML = content;
                    } else {
                        body.appendChild(content);
                    }
                }
                section.appendChild(body);

                const instance = {
                    id,
                    el: section,
                    body,
                    expand: () => {
                        section.classList.remove('terrain-subpanel--collapsed');
                        header.querySelector('.terrain-subpanel__icon').textContent = '\u25bc';
                    },
                    collapse: () => {
                        section.classList.add('terrain-subpanel--collapsed');
                        header.querySelector('.terrain-subpanel__icon').textContent = '\u25b6';
                    },
                    toggle: () => {
                        if (section.classList.contains('terrain-subpanel--collapsed')) {
                            instance.expand();
                        } else {
                            instance.collapse();
                        }
                    },
                    setContent: (html) => { body.innerHTML = html; },
                    destroy: () => { section.remove(); instances.delete(id); }
                };

                instances.set(id, instance);
                return instance;
            }
        },

        /**
         * Toast utility
         */
        Toast: {
            show: function(message, type = 'info', duration = 3000) {
                const toast = createElement('div', {
                    className: `terrain-toast terrain-toast--${type}`
                }, [message]);

                document.body.appendChild(toast);

                // Trigger animation
                requestAnimationFrame(() => {
                    toast.classList.add('terrain-toast--visible');
                });

                if (duration > 0) {
                    setTimeout(() => {
                        toast.classList.remove('terrain-toast--visible');
                        setTimeout(() => toast.remove(), 300);
                    }, duration);
                }

                return toast;
            }
        },

        /**
         * Modal utility
         */
        Modal: {
            alert: function(message, title = 'Alert') {
                return new Promise(resolve => {
                    const overlay = createElement('div', { className: 'terrain-modal-overlay' });
                    const modal = createElement('div', { className: 'terrain-modal' }, [
                        createElement('div', { className: 'terrain-modal__header' }, [title]),
                        createElement('div', { className: 'terrain-modal__body' }, [message]),
                        createElement('div', { className: 'terrain-modal__footer' }, [
                            createElement('button', {
                                className: 'terrain-modal__btn',
                                onClick: () => { overlay.remove(); resolve(); }
                            }, ['OK'])
                        ])
                    ]);
                    overlay.appendChild(modal);
                    document.body.appendChild(overlay);
                });
            },

            confirm: function(message, title = 'Confirm') {
                return new Promise(resolve => {
                    const overlay = createElement('div', { className: 'terrain-modal-overlay' });
                    const modal = createElement('div', { className: 'terrain-modal' }, [
                        createElement('div', { className: 'terrain-modal__header' }, [title]),
                        createElement('div', { className: 'terrain-modal__body' }, [message]),
                        createElement('div', { className: 'terrain-modal__footer' }, [
                            createElement('button', {
                                className: 'terrain-modal__btn terrain-modal__btn--cancel',
                                onClick: () => { overlay.remove(); resolve(false); }
                            }, ['Cancel']),
                            createElement('button', {
                                className: 'terrain-modal__btn terrain-modal__btn--confirm',
                                onClick: () => { overlay.remove(); resolve(true); }
                            }, ['OK'])
                        ])
                    ]);
                    overlay.appendChild(modal);
                    document.body.appendChild(overlay);
                });
            },

            prompt: function(message, defaultValue = '', title = 'Input') {
                return new Promise(resolve => {
                    const overlay = createElement('div', { className: 'terrain-modal-overlay' });
                    const input = createElement('input', {
                        className: 'terrain-modal__input',
                        type: 'text',
                        value: defaultValue
                    });
                    const modal = createElement('div', { className: 'terrain-modal' }, [
                        createElement('div', { className: 'terrain-modal__header' }, [title]),
                        createElement('div', { className: 'terrain-modal__body' }, [message, input]),
                        createElement('div', { className: 'terrain-modal__footer' }, [
                            createElement('button', {
                                className: 'terrain-modal__btn terrain-modal__btn--cancel',
                                onClick: () => { overlay.remove(); resolve(null); }
                            }, ['Cancel']),
                            createElement('button', {
                                className: 'terrain-modal__btn terrain-modal__btn--confirm',
                                onClick: () => { overlay.remove(); resolve(input.value); }
                            }, ['OK'])
                        ])
                    ]);
                    overlay.appendChild(modal);
                    document.body.appendChild(overlay);
                    input.focus();
                });
            }
        },

        /**
         * Get component instance by ID
         */
        getInstance: function(id) {
            return instances.get(id);
        },

        /**
         * Initialize the module
         */
        init: function() {
            console.log('[TERRAIN.UI] Initialized');
        }
    };

    // Export to TERRAIN namespace (uppercase)
    window.TERRAIN = window.TERRAIN || {};
    window.TERRAIN.UI = TerrainUI;

    // Also export to Terrain for internal use
    window.Terrain = window.Terrain || {};
    window.Terrain.UI = TerrainUI;

})();
