/**
 * vox-generate.js - Generate vox section
 */
window.Vox = window.Vox || {};

Vox.initGenerate = function() {
    var dom = Vox.dom;
    var state = Vox.state;

    dom.testBtn.addEventListener('click', function() {
        var text = dom.testText.value.trim();
        if (!text) { dom.testText.focus(); return; }

        dom.testBtn.disabled = true;
        dom.testBtn.textContent = 'generating...';
        dom.metricsEl.textContent = '';

        fetch(Vox.API + '/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                provider: dom.providerSelect.value,
                voice: Vox.getVoiceValue(),
                model: dom.modelSelect.value
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            dom.testBtn.disabled = false;
            dom.testBtn.textContent = 'Generate';
            if (data.ok) {
                var dur = data.duration ? data.duration.toFixed(1) + 's' : '-';
                var enc = data.encodeTime ? data.encodeTime.toFixed(1) + 's' : '-';
                var rtf = data.rtf ? data.rtf.toFixed(1) : '-';
                var cost = data.cost ? '$' + data.cost.cost.toFixed(4) : '$0';
                dom.metricsEl.textContent = 'vox ' + data.id + '  Dur:' + dur + '  Encode:' + enc + '  RTF:' + rtf + '  Cost:' + cost;

                state.lastId = data.id;
                dom.playBtn.disabled = false;
                Vox.loadDb();
            } else {
                dom.metricsEl.textContent = 'Error: ' + (data.error || 'unknown');
            }
        })
        .catch(function(e) {
            dom.testBtn.disabled = false;
            dom.testBtn.textContent = 'Generate';
            dom.metricsEl.textContent = 'Error: ' + e.message;
        });
    });

    dom.playBtn.addEventListener('click', function() {
        if (state.lastId) {
            dom.sharedAudio.src = Vox.API + '/db/' + state.lastId + '/audio';
            dom.sharedAudio.play();
        }
    });
};
