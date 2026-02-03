/**
 * vox-defaults.js - Server defaults + save default button
 */
window.Vox = window.Vox || {};

Vox.loadDefaults = function() {
    var dom = Vox.dom;
    fetch(Vox.API + '/defaults').then(function(r) { return r.json(); }).then(function(data) {
        var prefs = Vox.loadPrefs();
        var provider = prefs.provider || data.provider || 'coqui';
        dom.providerSelect.value = provider;
        Vox.updateModelDropdown();
        var model = prefs.model || data.model || 'vits';
        dom.modelSelect.value = model;
        Vox.updateVoiceDropdown();
        var voice = prefs.voice || data.voice || '';
        if (voice) dom.voiceSelect.value = voice;
    }).catch(function() {
        var prefs = Vox.loadPrefs();
        if (prefs.provider) dom.providerSelect.value = prefs.provider;
        Vox.updateModelDropdown();
        if (prefs.model) dom.modelSelect.value = prefs.model;
        Vox.updateVoiceDropdown();
        if (prefs.voice) dom.voiceSelect.value = prefs.voice;
    });
};

Vox.initSaveDefaultBtn = function() {
    var dom = Vox.dom;
    dom.saveDefaultBtn.addEventListener('click', function() {
        dom.saveDefaultBtn.textContent = 'saving...';
        fetch(Vox.API + '/defaults', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: dom.providerSelect.value,
                model: dom.modelSelect.value,
                voice: Vox.getVoiceValue()
            })
        }).then(function(r) { return r.json(); }).then(function() {
            dom.saveDefaultBtn.textContent = 'saved';
            setTimeout(function() { dom.saveDefaultBtn.textContent = 'Save Default'; }, 1500);
        }).catch(function() {
            dom.saveDefaultBtn.textContent = 'Save Default';
        });
    });
};
