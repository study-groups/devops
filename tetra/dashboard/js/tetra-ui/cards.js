/**
 * TetraUI Cards - Card components
 *
 * Usage:
 *   TetraUI.Card.stat(value, label, variant)
 *   TetraUI.Card.kv(key, value)
 *   TetraUI.Card.status(icon, label, status)
 */

window.TetraUI = window.TetraUI || {};

TetraUI.Card = {
    /**
     * Create stat card HTML
     * @param {string|number} value
     * @param {string} label
     * @param {string} variant - 'good', 'warn', 'bad'
     */
    stat: function(value, label, variant) {
        var cls = 'tetra-stat';
        if (variant) cls += ' tetra-stat--' + variant;
        return '<div class="' + cls + '">' +
            '<div class="tetra-stat__value">' + TetraUI.dom.esc(value) + '</div>' +
            '<div class="tetra-stat__label">' + TetraUI.dom.esc(label) + '</div>' +
        '</div>';
    },

    /**
     * Create key-value row HTML
     * @param {string} key
     * @param {string} value
     */
    kv: function(key, value) {
        return '<div class="tetra-kv">' +
            '<span class="tetra-kv__key">' + TetraUI.dom.esc(key) + '</span>' +
            '<span class="tetra-kv__value">' + TetraUI.dom.esc(value) + '</span>' +
        '</div>';
    },

    /**
     * Create key-value list HTML
     * @param {Object} data - {key: value, ...}
     */
    kvList: function(data) {
        var html = '';
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                html += this.kv(key, data[key]);
            }
        }
        return html;
    },

    /**
     * Create status card HTML
     * @param {string} icon - Icon character or HTML
     * @param {string} label
     * @param {string} status - 'ok', 'missing', 'na'
     */
    status: function(icon, label, status) {
        var cls = 'status-card';
        if (status) cls += ' ' + status;
        return '<div class="' + cls + '">' +
            '<div class="status-card-icon">' + icon + '</div>' +
            '<div class="status-card-label">' + TetraUI.dom.esc(label) + '</div>' +
        '</div>';
    },

    /**
     * Create a full card with header and body
     * @param {Object} opts - {title, actions, body, footer}
     */
    create: function(opts) {
        opts = opts || {};
        var html = '<div class="card">';

        if (opts.title) {
            html += '<div class="card-header">' +
                '<span>' + TetraUI.dom.esc(opts.title) + '</span>' +
                (opts.actions || '') +
            '</div>';
        }

        html += '<div class="card-body">' + (opts.body || '') + '</div>';

        if (opts.footer) {
            html += '<div class="card-footer">' + opts.footer + '</div>';
        }

        html += '</div>';
        return html;
    }
};
