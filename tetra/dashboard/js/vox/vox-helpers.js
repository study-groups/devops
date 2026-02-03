/**
 * vox-helpers.js - Utility functions for Vox panel
 */
window.Vox = window.Vox || {};

Vox.API = '/api/vox';
Vox.PREFS_KEY = 'vox-prefs';

Vox.formatBytes = function(bytes) {
    if (bytes == null) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
};

Vox.formatDate = function(iso) {
    if (!iso) return '-';
    return iso.substring(0, 10);
};

Vox.escapeHtml = function(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
};
