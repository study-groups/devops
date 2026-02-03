/**
 * TetraUI Modal - Popup dialogs and info panels
 *
 * Usage:
 *   // Info popup (just shows info, close button only)
 *   TetraUI.Modal.info('Title', 'Body content or HTML');
 *
 *   // Confirmation dialog
 *   TetraUI.Modal.confirm({
 *       title: 'Delete item?',
 *       body: 'This cannot be undone.',
 *       onConfirm: function() { doDelete(); }
 *   });
 *
 *   // Danger confirmation
 *   TetraUI.Modal.danger({
 *       title: 'Delete all data?',
 *       body: TetraUI.Modal.callout('danger', 'This will permanently delete everything.'),
 *       confirmText: 'Delete Everything',
 *       onConfirm: function() { deleteAll(); }
 *   });
 *
 *   // Close programmatically
 *   TetraUI.Modal.hide();
 *
 * Helper methods for body content:
 *   TetraUI.Modal.section(title, content)   - Styled section block
 *   TetraUI.Modal.kv(key, value)            - Key-value row
 *   TetraUI.Modal.list(items)               - Styled list
 *   TetraUI.Modal.callout(type, text)       - Info/warning/danger callout
 *   TetraUI.Modal.pre(text)                 - Preformatted code block
 *
 * Requires: css/components/modal.css
 */

(function() {
    'use strict';

    window.TetraUI = window.TetraUI || {};

    var overlay = null;
    var currentCallback = null;

    /**
     * Create or get the modal overlay element
     */
    function ensureOverlay() {
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.className = 'tetra-modal-overlay';
        overlay.innerHTML = [
            '<div class="tetra-modal">',
            '  <div class="tetra-modal-title"></div>',
            '  <div class="tetra-modal-body"></div>',
            '  <div class="tetra-modal-buttons"></div>',
            '</div>'
        ].join('');

        // Close on overlay click
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                TetraUI.Modal.hide();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                TetraUI.Modal.hide();
            }
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    /**
     * Show modal with options
     */
    function show(opts) {
        opts = opts || {};
        var el = ensureOverlay();
        var modal = el.querySelector('.tetra-modal');
        var titleEl = el.querySelector('.tetra-modal-title');
        var bodyEl = el.querySelector('.tetra-modal-body');
        var buttonsEl = el.querySelector('.tetra-modal-buttons');

        // Size
        modal.className = 'tetra-modal' + (opts.size ? ' size-' + opts.size : '');

        // Title
        titleEl.textContent = opts.title || '';
        titleEl.className = 'tetra-modal-title' + (opts.danger ? ' danger' : opts.warning ? ' warning' : '');

        // Body
        bodyEl.innerHTML = opts.body || '';

        // Buttons
        currentCallback = opts.onConfirm || null;
        var buttons = [];

        if (opts.mode === 'info') {
            buttons.push('<button class="tetra-modal-btn primary" data-action="close">OK</button>');
        } else {
            buttons.push('<button class="tetra-modal-btn" data-action="cancel">' + (opts.cancelText || 'Cancel') + '</button>');
            var confirmClass = opts.danger ? 'danger' : 'primary';
            buttons.push('<button class="tetra-modal-btn ' + confirmClass + '" data-action="confirm">' + (opts.confirmText || 'Confirm') + '</button>');
        }

        buttonsEl.innerHTML = buttons.join('');

        // Button handlers
        buttonsEl.querySelectorAll('button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var action = btn.dataset.action;
                if (action === 'confirm' && currentCallback) {
                    currentCallback();
                }
                TetraUI.Modal.hide();
            });
        });

        // Show
        el.classList.add('active');

        // Focus first button
        var firstBtn = buttonsEl.querySelector('button');
        if (firstBtn) firstBtn.focus();
    }

    TetraUI.Modal = {
        /**
         * Show info popup (close button only)
         */
        info: function(title, body, opts) {
            opts = opts || {};
            show({
                title: title,
                body: body,
                mode: 'info',
                size: opts.size
            });
        },

        /**
         * Show confirmation dialog
         */
        confirm: function(opts) {
            show({
                title: opts.title,
                body: opts.body,
                mode: 'confirm',
                confirmText: opts.confirmText,
                cancelText: opts.cancelText,
                onConfirm: opts.onConfirm,
                size: opts.size
            });
        },

        /**
         * Show danger confirmation dialog
         */
        danger: function(opts) {
            show({
                title: opts.title,
                body: opts.body,
                mode: 'confirm',
                danger: true,
                confirmText: opts.confirmText || 'Delete',
                cancelText: opts.cancelText,
                onConfirm: opts.onConfirm,
                size: opts.size
            });
        },

        /**
         * Hide modal
         */
        hide: function() {
            if (overlay) {
                overlay.classList.remove('active');
                currentCallback = null;
            }
        },

        // =========================================================================
        // Content helpers
        // =========================================================================

        /**
         * Create a section block
         */
        section: function(title, content) {
            var titleHtml = title ? '<div class="tetra-modal-section-title">' + TetraUI.dom.esc(title) + '</div>' : '';
            return '<div class="tetra-modal-section">' + titleHtml + content + '</div>';
        },

        /**
         * Create a key-value row
         */
        kv: function(key, value) {
            return '<div class="tetra-modal-kv"><span class="key">' + TetraUI.dom.esc(key) + '</span><span class="val">' + TetraUI.dom.esc(value) + '</span></div>';
        },

        /**
         * Create multiple key-value rows
         */
        kvList: function(pairs) {
            return pairs.map(function(p) {
                return TetraUI.Modal.kv(p[0], p[1]);
            }).join('');
        },

        /**
         * Create a styled list
         */
        list: function(items) {
            var lis = items.map(function(item) {
                return '<li>' + TetraUI.dom.esc(item) + '</li>';
            }).join('');
            return '<ul class="tetra-modal-list">' + lis + '</ul>';
        },

        /**
         * Create a callout (info/warning/danger)
         */
        callout: function(type, text, icon) {
            icon = icon || (type === 'danger' ? '\u26a0\ufe0f' : type === 'warning' ? '\u26a0\ufe0f' : '\u2139\ufe0f');
            return '<div class="tetra-modal-callout ' + type + '">' +
                '<span>' + icon + '</span>' +
                '<span>' + text + '</span>' +
                '</div>';
        },

        /**
         * Create a preformatted code block
         */
        pre: function(text) {
            return '<div class="tetra-modal-pre">' + TetraUI.dom.esc(text) + '</div>';
        }
    };

})();
