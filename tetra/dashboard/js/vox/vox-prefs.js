/**
 * vox-prefs.js - LocalStorage preferences
 */
window.Vox = window.Vox || {};

Vox.loadPrefs = function() {
    try {
        return JSON.parse(localStorage.getItem(Vox.PREFS_KEY)) || {};
    } catch (_) {
        return {};
    }
};

Vox.savePrefs = function() {
    var dom = Vox.dom;
    localStorage.setItem(Vox.PREFS_KEY, JSON.stringify({
        provider: dom.providerSelect.value,
        model: dom.modelSelect.value,
        voice: dom.voiceSelect.value
    }));
};
