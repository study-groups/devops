/**
 * TetraUI Core - Shared utilities for dashboard components
 *
 * Usage:
 *   <script src="js/tetra-ui/core.js"></script>
 *
 * Provides:
 *   TetraUI.dom.esc(str)        - HTML escape
 *   TetraUI.dom.el(tag, cls, content) - Create element string
 *   TetraUI.dom.elAttr(tag, attrs, content) - Element with attributes
 *   TetraUI.dom.cache(ids)      - Cache DOM elements by ID
 *   TetraUI.fmt.bytes(n)        - Format bytes
 *   TetraUI.fmt.duration(secs)  - Format duration
 *   TetraUI.fmt.relTime(iso)    - Relative time string
 *   TetraUI.fmt.truncate(s, n)  - Truncate with ellipsis
 */

window.TetraUI = window.TetraUI || {};

// =============================================================================
// DOM Utilities
// =============================================================================

TetraUI.dom = {
    /**
     * Escape HTML entities
     */
    esc: function(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Create element HTML string
     * @param {string} tag - Tag name
     * @param {string} cls - CSS class(es)
     * @param {string} content - Inner content
     */
    el: function(tag, cls, content) {
        var classAttr = cls ? ' class="' + cls + '"' : '';
        return '<' + tag + classAttr + '>' + (content || '') + '</' + tag + '>';
    },

    /**
     * Create element with attributes
     * @param {string} tag - Tag name
     * @param {Object} attrs - Attribute key-value pairs
     * @param {string} content - Inner content
     */
    elAttr: function(tag, attrs, content) {
        var attrStr = Object.keys(attrs).map(function(k) {
            return k + '="' + TetraUI.dom.esc(attrs[k]) + '"';
        }).join(' ');
        return '<' + tag + ' ' + attrStr + '>' + (content || '') + '</' + tag + '>';
    },

    /**
     * Cache DOM elements by ID
     * @param {string[]} ids - Array of element IDs
     * @returns {Object} Map of id -> element
     */
    cache: function(ids) {
        var els = {};
        for (var i = 0; i < ids.length; i++) {
            els[ids[i]] = document.getElementById(ids[i]);
        }
        return els;
    },

    /**
     * Query selector shorthand
     */
    $: function(sel, ctx) {
        return (ctx || document).querySelector(sel);
    },

    /**
     * Query selector all shorthand
     */
    $$: function(sel, ctx) {
        return Array.from((ctx || document).querySelectorAll(sel));
    }
};

// =============================================================================
// Formatting Utilities
// =============================================================================

TetraUI.fmt = {
    /**
     * Format bytes to human readable
     */
    bytes: function(bytes) {
        if (bytes == null || isNaN(bytes)) return '-';
        var n = Number(bytes);
        if (n === 0) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = Math.floor(Math.log(n) / Math.log(1024));
        i = Math.min(i, units.length - 1);
        return (n / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    },

    /**
     * Format duration in seconds
     */
    duration: function(secs) {
        if (secs == null || secs === '') return '';
        var n = Number(secs);
        if (isNaN(n)) return secs;
        if (n < 60) return n + 's';
        if (n < 3600) return Math.floor(n / 60) + 'm' + (n % 60 ? (n % 60) + 's' : '');
        var h = Math.floor(n / 3600);
        var m = Math.floor((n % 3600) / 60);
        return h + 'h' + (m ? m + 'm' : '');
    },

    /**
     * Format ISO timestamp to relative time
     */
    relTime: function(isoStr) {
        if (!isoStr) return '';
        var date = new Date(isoStr);
        if (isNaN(date.getTime())) return isoStr.slice(11, 16) || '';

        var now = new Date();
        var diffMs = now - date;
        var diffMin = Math.floor(diffMs / 60000);
        var diffHr = Math.floor(diffMs / 3600000);
        var diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'now';
        if (diffMin < 60) return diffMin + 'm ago';
        if (diffHr < 24) return diffHr + 'h ago';
        if (diffDay < 7) return diffDay + 'd ago';

        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[date.getMonth()] + ' ' + date.getDate();
    },

    /**
     * Truncate string with ellipsis
     */
    truncate: function(str, maxLen) {
        if (!str || str.length <= maxLen) return str || '';
        return str.slice(0, maxLen - 1) + '\u2026';
    },

    /**
     * Pad number with leading zeros
     */
    pad: function(num, width) {
        var s = String(num);
        while (s.length < width) s = '0' + s;
        return s;
    }
};

// =============================================================================
// Version
// =============================================================================

TetraUI.VERSION = '1.0.0';
