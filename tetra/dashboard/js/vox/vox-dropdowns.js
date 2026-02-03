/**
 * vox-dropdowns.js - Cascading provider/model/voice dropdowns
 */
window.Vox = window.Vox || {};

Vox.updateModelDropdown = function() {
    var dom = Vox.dom;
    var state = Vox.state;
    var provider = dom.providerSelect.value;
    var data = state.voxData ? state.voxData[provider] : null;
    var models = data ? Object.keys(data.models) : [];
    var prev = dom.modelSelect.value;
    dom.modelSelect.innerHTML = '';
    models.forEach(function(m) {
        var opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        dom.modelSelect.appendChild(opt);
    });
    if (models.indexOf(prev) !== -1) dom.modelSelect.value = prev;
    dom.modelSelect.disabled = models.length === 0;
    Vox.updateVoiceDropdown();
};

Vox.updateVoiceDropdown = function() {
    var dom = Vox.dom;
    var state = Vox.state;
    var provider = dom.providerSelect.value;
    var data = state.voxData ? state.voxData[provider] : null;
    var model = dom.modelSelect.value;
    var voices = (data && data.models[model]) || [];
    var prev = dom.voiceSelect.value;
    dom.voiceSelect.innerHTML = '';
    if (voices.length === 0) {
        dom.voiceSelect.innerHTML = '<option value="">n/a</option>';
        dom.voiceSelect.disabled = true;
    } else {
        voices.forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            dom.voiceSelect.appendChild(opt);
        });
        if (voices.indexOf(prev) !== -1) dom.voiceSelect.value = prev;
        dom.voiceSelect.disabled = false;
    }
};

Vox.getVoiceValue = function() {
    var dom = Vox.dom;
    var provider = dom.providerSelect.value;
    var model = dom.modelSelect.value;
    var voice = dom.voiceSelect.value;
    if (provider === 'coqui' && voice && voice !== 'n/a') {
        return model + '/' + voice;
    }
    if (provider === 'coqui') return model;
    return voice || model;
};

Vox.initDropdownListeners = function() {
    var dom = Vox.dom;
    dom.providerSelect.addEventListener('change', function() {
        Vox.updateModelDropdown();
        Vox.savePrefs();
    });
    dom.modelSelect.addEventListener('change', function() {
        Vox.updateVoiceDropdown();
        Vox.savePrefs();
    });
    dom.voiceSelect.addEventListener('change', function() {
        Vox.savePrefs();
    });
};
