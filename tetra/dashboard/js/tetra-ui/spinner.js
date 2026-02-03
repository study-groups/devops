/**
 * TetraUI Spinner - Loading indicator component
 *
 * Usage:
 *   TetraUI.Spinner.html()              - Get spinner HTML (default size)
 *   TetraUI.Spinner.html('lg')          - Large spinner
 *   TetraUI.Spinner.create(container)   - Create spinner in container
 *   TetraUI.Spinner.loading(msg)        - Spinner with message
 *
 * Sizes: 'sm' (10px), 'md' (14px default), 'lg' (20px)
 */

window.TetraUI = window.TetraUI || {};

TetraUI.Spinner = {
    /**
     * Generate spinner HTML
     * @param {string} size - 'sm', 'md', or 'lg'
     * @returns {string} HTML string
     */
    html: function(size) {
        var cls = 'tetra-spinner';
        if (size === 'sm') cls += ' tetra-spinner--sm';
        else if (size === 'lg') cls += ' tetra-spinner--lg';
        return '<span class="' + cls + '">' +
            '<span></span><span></span><span></span><span></span>' +
        '</span>';
    },

    /**
     * Create spinner element in container
     * @param {HTMLElement|string} container - Container element or selector
     * @param {string} size - Size variant
     * @returns {HTMLElement} The spinner element
     */
    create: function(container, size) {
        var el = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        if (!el) return null;

        el.innerHTML = this.html(size);
        return el.firstChild;
    },

    /**
     * Generate loading message with spinner
     * @param {string} msg - Loading message
     * @param {string} size - Spinner size
     * @returns {string} HTML string
     */
    loading: function(msg, size) {
        return '<div class="tetra-loading">' +
            this.html(size || 'md') +
            (msg ? '<span class="tetra-loading__msg">' + TetraUI.dom.esc(msg) + '</span>' : '') +
        '</div>';
    },

    /**
     * Show loading state in container
     * @param {HTMLElement|string} container
     * @param {string} msg
     */
    showIn: function(container, msg) {
        var el = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        if (!el) return;

        el.innerHTML = this.loading(msg || 'Loading...');
    }
};
