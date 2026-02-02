/**
 * vox.js - Vox panel logic
 *
 * Vox-based TTS: generate voxes, browse vox log,
 * inline expand with audio player + investigate, set defaults.
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

    var state = {
        voxData: null,
        lastId: null,
        filter: null,
        refreshInterval: null,
        expandedId: null,
        dbPath: '~/tetra/vox/db/',
        count: 0,
        cache: {}
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
    // Helpers
    // ----------------------------------------------------------------

    function formatBytes(bytes) {
        if (bytes == null) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function formatDate(iso) {
        if (!iso) return '-';
        return iso.substring(0, 10);
    }

    // ----------------------------------------------------------------
    // Expand row content builder
    // ----------------------------------------------------------------

    function buildExpandContent(data) {
        var html = '<div class="expand-content">';

        // Source section
        html += '<div class="expand-section">';
        html += '<div class="expand-section-title">Source</div>';
        html += '<div class="expand-source">' + escapeHtml(data.source || '-') + '</div>';
        if (data.stats) {
            html += '<div class="expand-source-stats">' +
                data.stats.characters + ' chars &middot; ' +
                data.stats.words + ' words &middot; ' +
                data.stats.lines + ' line' + (data.stats.lines !== 1 ? 's' : '');
            if (data.source_hash) {
                html += ' &middot; sha256:' + data.source_hash.substring(0, 8) + '...';
            }
            html += '</div>';
        }
        html += '</div>';

        // Audio section — waveform player
        if (data.audio || data.duration) {
            html += '<div class="expand-section">';
            html += '<div class="expand-section-title">Audio</div>';
            html += '<div class="vox-waveform-container" data-vox-wf-id="' + (data.id || '') + '"></div>';
            if (data.audio) {
                var a = data.audio;
                var parts = [];
                if (a.format) parts.push(a.format);
                if (a.codec) parts.push(a.codec);
                if (a.sample_rate) parts.push(a.sample_rate + 'Hz');
                if (a.channels) parts.push(a.channels === 1 ? 'mono' : a.channels === 2 ? 'stereo' : a.channels + 'ch');
                if (a.bit_rate) parts.push(Math.round(a.bit_rate / 1000) + 'kbps');
                html += '<div class="expand-audio-meta">' + parts.join(' &middot; ');
                if (a.size) html += '<br>' + formatBytes(a.size);
                // RMS/VAD summary if available
                if (data.layers && data.layers.rms && data.layers.rms.data) {
                    var rv = data.layers.rms.data.values || [];
                    if (rv.length > 0) {
                        var rmsMean = 0; var rmsPeak = 0;
                        for (var ri = 0; ri < rv.length; ri++) { rmsMean += rv[ri]; if (rv[ri] > rmsPeak) rmsPeak = rv[ri]; }
                        rmsMean /= rv.length;
                        html += '<br>RMS: mean=' + rmsMean.toFixed(4) + ' peak=' + rmsPeak.toFixed(4);
                    }
                }
                if (data.layers && data.layers.vad && data.layers.vad.data) {
                    var segs = data.layers.vad.data.segments || [];
                    html += ' &middot; VAD: ' + segs.length + ' segment' + (segs.length !== 1 ? 's' : '');
                }
                html += '</div>';
            }
            html += '</div>';
        }

        // Files section
        if (data.layers) {
            var layerKeys = Object.keys(data.layers);
            if (layerKeys.length > 0) {
                html += '<div class="expand-section">';
                html += '<div class="expand-section-title">Files</div>';
                html += '<table class="expand-files-table">';
                layerKeys.forEach(function(key) {
                    var l = data.layers[key];
                    if (!l) return;
                    html += '<tr>' +
                        '<td>' + escapeHtml(l.file || key) + '</td>' +
                        '<td>' + formatBytes(l.size) + '</td>' +
                        '<td>' + formatDate(l.modified) + '</td>' +
                        '</tr>';
                });
                html += '</table>';
                html += '</div>';
            }
        }

        // Annotations section
        var annoKeys = [];
        if (data.layers) {
            ['tokens', 'phonemes', 'prosody', 'onsets', 'formants', 'bites', 'spans', 'rms', 'vad'].forEach(function(k) {
                if (data.layers[k] && data.layers[k].data) annoKeys.push(k);
            });
        }
        if (annoKeys.length > 0) {
            html += '<div class="expand-section">';
            html += '<div class="expand-section-title">Annotations</div>';
            html += '<div class="expand-annotations">';
            annoKeys.forEach(function(k) {
                var d = data.layers[k].data;
                var count = Array.isArray(d) ? ' (' + d.length + ')' : '';
                html += '<button class="expand-anno-toggle" data-anno="' + k + '">\u25b6 ' + k + count + '</button>';
            });
            html += '</div>';
            annoKeys.forEach(function(k) {
                var d = data.layers[k].data;
                html += '<div class="expand-anno-content" data-anno-content="' + k + '">' +
                    escapeHtml(JSON.stringify(d, null, 2)) + '</div>';
            });
            html += '</div>';
        }

        // Actions
        html += '<div class="expand-actions">';
        html += '<button class="toolbar-btn expand-save-onsets-btn">Save Onsets</button>';
        html += '<button class="toolbar-btn expand-analyze-btn">Analyze</button>';
        html += '<button class="toolbar-btn expand-link-tut-btn">Link to Tut</button>';
        html += '<button class="toolbar-btn expand-delete-btn">Delete</button>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    // ----------------------------------------------------------------
    // Inline expand
    // ----------------------------------------------------------------

    function toggleExpand(id, dataRow, expandRow) {
        // Collapse previous
        if (state.expandedId && state.expandedId !== id) {
            var prevPlayer = state.cache['_wf_' + state.expandedId];
            if (prevPlayer && prevPlayer.destroy) prevPlayer.destroy();
            delete state.cache['_wf_' + state.expandedId];
            var prev = logBody.querySelector('tr.expand-row.open');
            if (prev) prev.classList.remove('open');
            var prevData = logBody.querySelector('tr.expanded');
            if (prevData) prevData.classList.remove('expanded');
        }

        // Toggle this one
        if (state.expandedId === id && expandRow.classList.contains('open')) {
            expandRow.classList.remove('open');
            dataRow.classList.remove('expanded');
            state.expandedId = null;
            return;
        }

        state.expandedId = id;
        dataRow.classList.add('expanded');
        expandRow.classList.add('open');

        // Already loaded?
        if (state.cache[id]) {
            populateExpandRow(expandRow, state.cache[id]);
            return;
        }

        // Loading state
        expandRow.querySelector('td').innerHTML = '<div class="expand-content" style="color:var(--ink-muted);font-size:9px;">Loading...</div>';

        fetch(API + '/db/' + id).then(function(r) { return r.json(); }).then(function(data) {
            state.cache[id] = data;
            populateExpandRow(expandRow, data);
        }).catch(function() {
            expandRow.querySelector('td').innerHTML = '<div class="expand-content" style="color:var(--one);">Error loading vox</div>';
        });
    }

    function populateExpandRow(expandRow, data) {
        // Ensure data.id is set — fall back to expand row attribute
        if (!data.id) {
            data.id = expandRow.getAttribute('data-expand-id');
        }
        var td = expandRow.querySelector('td');
        td.innerHTML = buildExpandContent(data);

        // Initialize waveform player
        var wfContainer = td.querySelector('.vox-waveform-container');
        if (wfContainer && window.VoxWaveform && data.id) {
            var wfOpts = {
                audioUrl: API + '/db/' + data.id + '/audio',
                duration: (data.audio && data.audio.duration) || data.duration || 1
            };
            if (data.layers) {
                if (data.layers.rms && data.layers.rms.data) wfOpts.rms = data.layers.rms.data;
                if (data.layers.vad && data.layers.vad.data) wfOpts.vad = data.layers.vad.data;
                if (data.layers.onsets && data.layers.onsets.data) {
                    wfOpts.onsets = Array.isArray(data.layers.onsets.data) ? data.layers.onsets.data : [];
                }
            }
            var player = window.VoxWaveform.create(wfContainer, wfOpts);
            state.cache['_wf_' + data.id] = player;
        }

        // Bind annotation toggles
        var toggles = td.querySelectorAll('.expand-anno-toggle');
        for (var i = 0; i < toggles.length; i++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var key = btn.getAttribute('data-anno');
                    var content = td.querySelector('[data-anno-content="' + key + '"]');
                    if (content) {
                        var open = content.classList.toggle('open');
                        btn.textContent = (open ? '\u25bc ' : '\u25b6 ') + btn.textContent.substring(2);
                    }
                });
            })(toggles[i]);
        }

        // Bind analyze
        var analyzeBtn = td.querySelector('.expand-analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', function() {
                var voxId = data.id || expandRow.getAttribute('data-expand-id');
                if (!voxId) { analyzeBtn.textContent = 'no id'; return; }
                analyzeBtn.textContent = 'analyzing...';
                analyzeBtn.disabled = true;
                fetch(API + '/db/' + voxId + '/analyze', { method: 'POST' })
                    .then(function(r) { return r.json(); })
                    .then(function(result) {
                        analyzeBtn.textContent = 'Analyze';
                        analyzeBtn.disabled = false;
                        if (result.ok) {
                            // Invalidate cache and re-expand
                            var vid = data.id || expandRow.getAttribute('data-expand-id');
                            delete state.cache[vid];
                            var prevWf = state.cache['_wf_' + vid];
                            if (prevWf && prevWf.destroy) prevWf.destroy();
                            delete state.cache['_wf_' + vid];
                            state.expandedId = null;
                            var dataRow = logBody.querySelector('tr[data-vox-id="' + vid + '"]');
                            if (dataRow) {
                                toggleExpand(vid, dataRow, expandRow);
                            }
                        }
                    })
                    .catch(function() {
                        analyzeBtn.textContent = 'Analyze';
                        analyzeBtn.disabled = false;
                    });
            });
        }

        // Bind Link to Tut
        var linkTutBtn = td.querySelector('.expand-link-tut-btn');
        if (linkTutBtn) {
            linkTutBtn.addEventListener('click', function() {
                var label = (data.source || '').substring(0, 60);
                if ((data.source || '').length > 60) label += '...';
                var voice = data.voice || (data.voices && data.voices[0]) || '';
                var provider = data.provider || '';
                var block = {
                    type: 'audio-player',
                    voxId: String(data.id),
                    label: label,
                    voice: (provider && voice) ? provider + ':' + voice : voice || provider,
                    codec: 'opus',
                    sourceHash: (data.source_hash || '').substring(0, 10)
                };
                navigator.clipboard.writeText(JSON.stringify(block, null, 2)).then(function() {
                    linkTutBtn.textContent = 'Copied!';
                    setTimeout(function() { linkTutBtn.textContent = 'Link to Tut'; }, 1500);
                }).catch(function() {
                    linkTutBtn.textContent = 'Copy failed';
                    setTimeout(function() { linkTutBtn.textContent = 'Link to Tut'; }, 1500);
                });
            });
        }

        // Bind Save Onsets
        var saveOnsetsBtn = td.querySelector('.expand-save-onsets-btn');
        if (saveOnsetsBtn) {
            saveOnsetsBtn.addEventListener('click', function() {
                var voxId = data.id || expandRow.getAttribute('data-expand-id');
                var player = state.cache['_wf_' + voxId];
                if (!player || !player.getOnsets) {
                    saveOnsetsBtn.textContent = 'no player';
                    setTimeout(function() { saveOnsetsBtn.textContent = 'Save Onsets'; }, 1500);
                    return;
                }
                var onsets = player.getOnsets();
                saveOnsetsBtn.textContent = 'saving...';
                saveOnsetsBtn.disabled = true;
                fetch(API + '/db/' + voxId + '/layers/onsets', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ onsets: onsets })
                }).then(function(r) { return r.json(); }).then(function(result) {
                    saveOnsetsBtn.disabled = false;
                    if (result.ok) {
                        player.markSaved();
                        // Update cache
                        if (state.cache[voxId] && state.cache[voxId].layers) {
                            state.cache[voxId].layers.onsets = {
                                file: voxId + '.vox.onsets.json',
                                data: onsets
                            };
                        }
                        saveOnsetsBtn.textContent = 'saved';
                        setTimeout(function() { saveOnsetsBtn.textContent = 'Save Onsets'; }, 1500);
                    } else {
                        saveOnsetsBtn.textContent = 'error';
                        setTimeout(function() { saveOnsetsBtn.textContent = 'Save Onsets'; }, 1500);
                    }
                }).catch(function() {
                    saveOnsetsBtn.disabled = false;
                    saveOnsetsBtn.textContent = 'Save Onsets';
                });
            });
        }

        // Bind delete
        var deleteBtn = td.querySelector('.expand-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                fetch(API + '/db/' + data.id, { method: 'DELETE' })
                    .then(function(r) { return r.json(); })
                    .then(function(result) {
                        if (result.ok) {
                            delete state.cache[data.id];
                            state.expandedId = null;
                            loadDb();
                        }
                    })
                    .catch(function() {});
            });
        }
    }

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
            var id = vox.id || vox.doc_id || vox.fragmentId;
            var hasAudio = !!(id && vox.voices && vox.voices.length > 0) || !!(id && vox.storagePath) || !!(id && vox.duration);

            // Data row
            var tr = document.createElement('tr');
            if (id) tr.setAttribute('data-vox-id', id);
            if (id === state.expandedId) tr.classList.add('expanded');

            var time = vox.created ? new Date(vox.created).toLocaleTimeString('en-US', { hour12: false }) : '-';
            var dur = vox.duration ? vox.duration.toFixed(1) : '-';
            var rtf = vox.rtf ? vox.rtf.toFixed(1) : '-';
            var cost = vox.cost ? '$' + vox.cost.toFixed(4) : '$0';
            var voice = vox.voice || (vox.voices && vox.voices[0]) || '-';
            if (voice.length > 12) voice = voice.substring(0, 11) + '..';
            var shortId = id ? id.slice(-6) : '-';

            var chevron = id ? (id === state.expandedId ? '\u25bc' : '\u25b6') : '';
            var firstCell;
            if (id && hasAudio) {
                firstCell = '<td class="dual-btn-cell">' +
                    '<button class="play-btn row-play" data-play-id="' + id + '" title="Play audio">&#9654;</button>' +
                    '<button class="chevron-btn" data-fid="' + id + '">' + chevron + '</button></td>';
            } else if (id) {
                firstCell = '<td class="dual-btn-cell">' +
                    '<button class="play-btn ghost" title="No audio">&#9654;</button>' +
                    '<button class="chevron-btn" data-fid="' + id + '">' + chevron + '</button></td>';
            } else {
                firstCell = '<td class="dual-btn-cell"><button class="play-btn ghost" title="No audio">&#9654;</button></td>';
            }

            tr.innerHTML =
                firstCell +
                '<td>' + time + '</td>' +
                '<td>' + shortId + '</td>' +
                '<td>' + (vox.provider || '-') + '</td>' +
                '<td title="' + (vox.voice || '') + '">' + voice + '</td>' +
                '<td>' + dur + '</td>' +
                '<td>' + rtf + '</td>' +
                '<td>' + cost + '</td>';

            logBody.appendChild(tr);

            // Expand row (hidden by default)
            if (id) {
                var expandTr = document.createElement('tr');
                expandTr.className = 'expand-row';
                if (id === state.expandedId) expandTr.classList.add('open');
                expandTr.setAttribute('data-expand-id', id);
                expandTr.innerHTML = '<td colspan="8"></td>';
                logBody.appendChild(expandTr);

                // Bind click
                (function(vid, dataRow, expRow) {
                    dataRow.addEventListener('click', function(e) {
                        if (e.target.classList.contains('play-btn') || e.target.classList.contains('row-play')) return;
                        toggleExpand(vid, dataRow, expRow);
                    });
                    // Bind row play button
                    var rowPlayBtn = dataRow.querySelector('.row-play');
                    if (rowPlayBtn) {
                        rowPlayBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            sharedAudio.src = API + '/db/' + vid + '/audio';
                            sharedAudio.play();
                        });
                    }
                })(id, tr, expandTr);

                // If this was the expanded one, re-populate from cache
                if (id === state.expandedId && state.cache[id]) {
                    populateExpandRow(expandTr, state.cache[id]);
                }
            }
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
