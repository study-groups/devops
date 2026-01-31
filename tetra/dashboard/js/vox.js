/**
 * vox.js - Vox panel logic
 *
 * Vox-based TTS: generate voxes, browse vox log,
 * detail panel with audio player + analyze, set defaults.
 * Cascading dropdowns: provider -> model -> voice from VOX_DATA.
 */
(function() {
    'use strict';

    var API = '/api/vox';
    var PREFS_KEY = 'vox-prefs';

    // DOM refs
    var providerSelect = document.getElementById('vox-provider');
    var modelSelect = document.getElementById('vox-model');
    var voiceSelect = document.getElementById('vox-voice');
    var saveDefaultBtn = document.getElementById('save-default-btn');
    var testText = document.getElementById('test-text');
    var testBtn = document.getElementById('test-btn');
    var playBtn = document.getElementById('play-btn');
    var metricsEl = document.getElementById('test-metrics');
    var logBody = document.getElementById('log-body');
    var statsBar = document.getElementById('stats-bar');
    var autoRefreshCb = document.getElementById('auto-refresh');
    var filterBtns = document.querySelectorAll('.filter-btn');
    var storageLine = document.getElementById('storage-line');
    var sharedAudio = document.getElementById('shared-audio');

    // Detail panel refs
    var detailPanel = document.getElementById('detail-panel');
    var detailId = document.getElementById('detail-id');
    var detailSource = document.getElementById('detail-source');
    var detailAudio = document.getElementById('detail-audio');
    var detailProvider = document.getElementById('detail-provider');
    var detailVoice = document.getElementById('detail-voice');
    var detailDuration = document.getElementById('detail-duration');
    var detailEncode = document.getElementById('detail-encode');
    var detailRtf = document.getElementById('detail-rtf');
    var detailCost = document.getElementById('detail-cost');
    var analyzeBtn = document.getElementById('analyze-btn');
    var deleteVoxBtn = document.getElementById('delete-vox-btn');
    var onsetsRow = document.getElementById('onsets-row');
    var detailOnsets = document.getElementById('detail-onsets');

    var state = {
        voxData: null,
        lastId: null,
        filter: null,
        refreshInterval: null,
        selectedId: null,
        dbPath: '~/tetra/vox/db/',
        count: 0
    };

    // ----------------------------------------------------------------
    // Prefs
    // ----------------------------------------------------------------

    function loadPrefs() {
        try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (_) { return {}; }
    }
    function savePrefs() {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
            provider: providerSelect.value,
            model: modelSelect.value,
            voice: voiceSelect.value
        }));
    }

    // ----------------------------------------------------------------
    // Cascading dropdowns
    // ----------------------------------------------------------------

    function updateModelDropdown() {
        var provider = providerSelect.value;
        var data = state.voxData ? state.voxData[provider] : null;
        var models = data ? Object.keys(data.models) : [];
        var prev = modelSelect.value;
        modelSelect.innerHTML = '';
        models.forEach(function(m) {
            var opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
        });
        if (models.indexOf(prev) !== -1) modelSelect.value = prev;
        modelSelect.disabled = models.length === 0;
        updateVoiceDropdown();
    }

    function updateVoiceDropdown() {
        var provider = providerSelect.value;
        var data = state.voxData ? state.voxData[provider] : null;
        var model = modelSelect.value;
        var voices = (data && data.models[model]) || [];
        var prev = voiceSelect.value;
        voiceSelect.innerHTML = '';
        if (voices.length === 0) {
            voiceSelect.innerHTML = '<option value="">n/a</option>';
            voiceSelect.disabled = true;
        } else {
            voices.forEach(function(v) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                voiceSelect.appendChild(opt);
            });
            if (voices.indexOf(prev) !== -1) voiceSelect.value = prev;
            voiceSelect.disabled = false;
        }
    }

    function getVoiceValue() {
        var provider = providerSelect.value;
        var model = modelSelect.value;
        var voice = voiceSelect.value;
        if (provider === 'coqui' && voice && voice !== 'n/a') {
            return model + '/' + voice;
        }
        if (provider === 'coqui') return model;
        return voice || model;
    }

    providerSelect.addEventListener('change', function() { updateModelDropdown(); savePrefs(); });
    modelSelect.addEventListener('change', function() { updateVoiceDropdown(); savePrefs(); });
    voiceSelect.addEventListener('change', function() { savePrefs(); });

    // ----------------------------------------------------------------
    // Defaults
    // ----------------------------------------------------------------

    function loadDefaults() {
        fetch(API + '/defaults').then(function(r) { return r.json(); }).then(function(data) {
            var prefs = loadPrefs();
            var provider = prefs.provider || data.provider || 'coqui';
            providerSelect.value = provider;
            updateModelDropdown();
            var model = prefs.model || data.model || 'vits';
            modelSelect.value = model;
            updateVoiceDropdown();
            var voice = prefs.voice || data.voice || '';
            if (voice) voiceSelect.value = voice;
        }).catch(function() {
            var prefs = loadPrefs();
            if (prefs.provider) providerSelect.value = prefs.provider;
            updateModelDropdown();
            if (prefs.model) modelSelect.value = prefs.model;
            updateVoiceDropdown();
            if (prefs.voice) voiceSelect.value = prefs.voice;
        });
    }

    saveDefaultBtn.addEventListener('click', function() {
        saveDefaultBtn.textContent = 'saving...';
        fetch(API + '/defaults', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: providerSelect.value,
                model: modelSelect.value,
                voice: getVoiceValue()
            })
        }).then(function(r) { return r.json(); }).then(function() {
            saveDefaultBtn.textContent = 'saved';
            setTimeout(function() { saveDefaultBtn.textContent = 'Save Default'; }, 1500);
        }).catch(function() {
            saveDefaultBtn.textContent = 'Save Default';
        });
    });

    // ----------------------------------------------------------------
    // Storage line
    // ----------------------------------------------------------------

    function updateStorageLine() {
        storageLine.textContent = 'Storage: ' + state.dbPath + ' (' + state.count + ' voxes)';
    }

    // ----------------------------------------------------------------
    // Generate vox
    // ----------------------------------------------------------------

    testBtn.addEventListener('click', function() {
        var text = testText.value.trim();
        if (!text) { testText.focus(); return; }

        testBtn.disabled = true;
        testBtn.textContent = 'generating...';
        metricsEl.textContent = '';

        fetch(API + '/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                provider: providerSelect.value,
                voice: getVoiceValue(),
                model: modelSelect.value
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            testBtn.disabled = false;
            testBtn.textContent = 'Generate';
            if (data.ok) {
                var dur = data.duration ? data.duration.toFixed(1) + 's' : '-';
                var enc = data.encodeTime ? data.encodeTime.toFixed(1) + 's' : '-';
                var rtf = data.rtf ? data.rtf.toFixed(1) : '-';
                var cost = data.cost ? '$' + data.cost.cost.toFixed(4) : '$0';
                metricsEl.textContent = 'vox ' + data.id + '  Dur:' + dur + '  Encode:' + enc + '  RTF:' + rtf + '  Cost:' + cost;

                state.lastId = data.id;
                playBtn.disabled = false;
                loadDb();
            } else {
                metricsEl.textContent = 'Error: ' + (data.error || 'unknown');
            }
        })
        .catch(function(e) {
            testBtn.disabled = false;
            testBtn.textContent = 'Generate';
            metricsEl.textContent = 'Error: ' + e.message;
        });
    });

    playBtn.addEventListener('click', function() {
        if (state.lastId) {
            sharedAudio.src = API + '/db/' + state.lastId + '/audio';
            sharedAudio.play();
        }
    });

    // ----------------------------------------------------------------
    // Vox log
    // ----------------------------------------------------------------

    function loadDb() {
        fetch(API + '/db?limit=50').then(function(r) { return r.json(); }).then(function(data) {
            state.count = data.total || 0;
            if (data.dbPath) state.dbPath = data.dbPath;
            updateStorageLine();
            renderVoxes(data.voxes || []);
        }).catch(function() {});

        fetch(API + '/tasks/stats').then(function(r) { return r.json(); }).then(function(data) {
            renderStats(data);
        }).catch(function() {});
    }

    function renderVoxes(voxes) {
        logBody.innerHTML = '';

        // Apply filter
        var filtered = voxes;
        if (state.filter === 'error') {
            loadErrorTasks();
            return;
        }

        for (var i = 0; i < filtered.length; i++) {
            var vox = filtered[i];
            var id = vox.id || vox.fragmentId;
            var tr = document.createElement('tr');
            tr.setAttribute('data-vox-id', id);
            if (id === state.selectedId) tr.classList.add('selected');

            var time = vox.created ? new Date(vox.created).toLocaleTimeString('en-US', { hour12: false }) : '-';
            var dur = vox.duration ? vox.duration.toFixed(1) : '-';
            var rtf = vox.rtf ? vox.rtf.toFixed(1) : '-';
            var cost = vox.cost ? '$' + vox.cost.toFixed(4) : '$0';
            var voice = vox.voice || '-';
            if (voice.length > 12) voice = voice.substring(0, 11) + '..';
            var shortId = id ? id.slice(-6) : '-';

            tr.innerHTML =
                '<td><button class="play-btn" data-fid="' + id + '" title="Play">&#9654;</button></td>' +
                '<td>' + time + '</td>' +
                '<td>' + shortId + '</td>' +
                '<td>' + (vox.provider || '-') + '</td>' +
                '<td title="' + (vox.voice || '') + '">' + voice + '</td>' +
                '<td>' + dur + '</td>' +
                '<td>' + rtf + '</td>' +
                '<td>' + cost + '</td>';

            // Click row -> show detail
            (function(vid) {
                tr.addEventListener('click', function(e) {
                    if (e.target.classList.contains('play-btn')) return;
                    showDetail(vid);
                });
            })(id);

            logBody.appendChild(tr);
        }

        // Bind play buttons
        var playBtns = logBody.querySelectorAll('.play-btn');
        for (var j = 0; j < playBtns.length; j++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var fid = btn.getAttribute('data-fid');
                    sharedAudio.src = API + '/db/' + fid + '/audio';
                    sharedAudio.play();
                });
            })(playBtns[j]);
        }
    }

    function loadErrorTasks() {
        fetch(API + '/tasks?limit=100&event=vox_generate').then(function(r) { return r.json(); }).then(function(data) {
            var errors = (data.tasks || []).filter(function(t) { return t.status === 'error'; });
            logBody.innerHTML = '';
            for (var i = errors.length - 1; i >= 0; i--) {
                var t = errors[i];
                var tr = document.createElement('tr');
                var time = t.ts ? new Date(t.ts).toLocaleTimeString('en-US', { hour12: false }) : '-';
                tr.innerHTML =
                    '<td></td>' +
                    '<td>' + time + '</td>' +
                    '<td class="error">err</td>' +
                    '<td>' + (t.provider || '-') + '</td>' +
                    '<td>' + (t.voice || '-') + '</td>' +
                    '<td>-</td>' +
                    '<td>-</td>' +
                    '<td>-</td>';
                logBody.appendChild(tr);
            }
        }).catch(function() {});
    }

    function renderStats(data) {
        var mins = Math.floor(data.totalDuration / 60);
        var secs = Math.floor(data.totalDuration % 60);
        var durStr = mins + 'm ' + (secs < 10 ? '0' : '') + secs + 's';
        statsBar.textContent = 'Total: ' + data.count +
            '  Audio: ' + durStr +
            '  Avg RTF: ' + data.avgRtf +
            '  Cost: $' + data.totalCost.toFixed(4);
    }

    // Filters
    filterBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            filterBtns.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.filter = btn.dataset.filter || null;
            loadDb();
        });
    });

    // Auto-refresh
    autoRefreshCb.addEventListener('change', function() {
        if (autoRefreshCb.checked) {
            state.refreshInterval = setInterval(loadDb, 5000);
        } else {
            clearInterval(state.refreshInterval);
            state.refreshInterval = null;
        }
    });

    // ----------------------------------------------------------------
    // Detail panel
    // ----------------------------------------------------------------

    function showDetail(id) {
        state.selectedId = id;
        detailPanel.classList.remove('hidden');
        detailId.textContent = id;
        onsetsRow.style.display = 'none';

        // Highlight selected row
        var rows = logBody.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) {
            rows[i].classList.toggle('selected', rows[i].getAttribute('data-vox-id') === id);
        }

        fetch(API + '/db/' + id).then(function(r) { return r.json(); }).then(function(data) {
            detailSource.textContent = data.source || '-';
            detailAudio.src = API + '/db/' + id + '/audio';
            detailProvider.textContent = data.provider || '-';
            detailVoice.textContent = data.voice || '-';
            detailDuration.textContent = data.duration ? data.duration.toFixed(1) + 's' : '-';
            detailEncode.textContent = data.encodeTime ? data.encodeTime.toFixed(1) + 's' : '-';
            detailRtf.textContent = data.rtf ? data.rtf.toFixed(1) : '-';
            detailCost.textContent = data.cost !== undefined ? '$' + data.cost.toFixed(4) : '$0';

            if (data.onsets && data.onsets.length > 0) {
                onsetsRow.style.display = '';
                detailOnsets.textContent = data.onsets.map(function(v) { return v.toFixed(2); }).join(' ');
            }
        }).catch(function() {
            detailSource.textContent = 'Error loading vox';
        });
    }

    // Analyze button
    analyzeBtn.addEventListener('click', function() {
        if (!state.selectedId) return;
        analyzeBtn.textContent = 'analyzing...';
        analyzeBtn.disabled = true;

        fetch(API + '/db/' + state.selectedId + '/analyze', { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                analyzeBtn.textContent = 'Analyze';
                analyzeBtn.disabled = false;
                if (data.ok && data.onsets) {
                    onsetsRow.style.display = '';
                    detailOnsets.textContent = data.onsets.map(function(v) {
                        return (typeof v === 'number') ? v.toFixed(2) : v;
                    }).join(' ');
                }
            })
            .catch(function() {
                analyzeBtn.textContent = 'Analyze';
                analyzeBtn.disabled = false;
            });
    });

    // Delete button
    deleteVoxBtn.addEventListener('click', function() {
        if (!state.selectedId) return;
        fetch(API + '/db/' + state.selectedId, { method: 'DELETE' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.ok) {
                    state.selectedId = null;
                    detailPanel.classList.add('hidden');
                    loadDb();
                }
            })
            .catch(function() {});
    });

    // ----------------------------------------------------------------
    // Init
    // ----------------------------------------------------------------

    function initVoxData() {
        state.voxData = {
            openai: {
                models: {
                    'tts-1': ['shimmer', 'alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage'],
                    'tts-1-hd': ['shimmer', 'alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage']
                }
            },
            coqui: {
                models: {
                    'vits': [],
                    'tacotron': [],
                    'xtts': [
                        'Claribel_Dervla', 'Daisy_Studious', 'Gracie_Wise',
                        'Tammie_Ema', 'Alison_Dietlinde', 'Ana_Florence',
                        'Annmarie_Nele', 'Asya_Anara', 'Brenda_Stern',
                        'Gitta_Nikolina', 'Henriette_Usha', 'Sofia_Hellen',
                        'Tammy_Grit', 'Tanja_Adelina', 'Vjollca_Johnnie',
                        'Andrew_Chipper', 'Badr_Odhiambo', 'Dionisio_Schuyler',
                        'Royston_Min', 'Viktor_Eka'
                    ]
                }
            }
        };

        fetch(API + '/status').then(function(r) { return r.json(); }).then(function(data) {
            if (data.voxData) state.voxData = data.voxData;
            if (data.count !== undefined) state.count = data.count;
            if (data.dbPath) state.dbPath = data.dbPath;
            updateStorageLine();
            loadDefaults();
        }).catch(function() {
            loadDefaults();
        });
    }

    Terrain.Iframe.init({
        name: 'vox',
        onReady: function() {
            initVoxData();
            loadDb();
        }
    });

    window.addEventListener('message', function(e) {
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'env-change') {
            loadDb();
        }
    });

})();
