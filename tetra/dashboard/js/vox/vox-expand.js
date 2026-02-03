/**
 * vox-expand.js - Expand row content builder and event bindings
 */
window.Vox = window.Vox || {};

Vox.buildExpandContent = function(data) {
    var html = '<div class="expand-content">';

    // Source section
    html += '<div class="expand-section">';
    html += '<div class="expand-section-title">Source</div>';
    html += '<div class="expand-source">' + Vox.escapeHtml(data.source || '-') + '</div>';
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
            if (a.size) html += '<br>' + Vox.formatBytes(a.size);
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
                    '<td>' + Vox.escapeHtml(l.file || key) + '</td>' +
                    '<td>' + Vox.formatBytes(l.size) + '</td>' +
                    '<td>' + Vox.formatDate(l.modified) + '</td>' +
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
                Vox.escapeHtml(JSON.stringify(d, null, 2)) + '</div>';
        });
        html += '</div>';
    }

    // Actions
    html += '<div class="expand-actions">';
    html += '<button class="toolbar-btn expand-save-onsets-btn">Save Onsets</button>';
    html += '<button class="toolbar-btn expand-analyze-btn">Analyze</button>';
    html += '<button class="toolbar-btn expand-link-tut-btn">Link to Tut</button>';
    html += '<button class="toolbar-btn expand-trash-btn">Trash</button>';
    html += '</div>';

    html += '</div>';
    return html;
};

Vox.toggleExpand = function(id, dataRow, expandRow) {
    var state = Vox.state;
    var dom = Vox.dom;

    // Collapse previous
    if (state.expandedId && state.expandedId !== id) {
        var prevPlayer = state.cache['_wf_' + state.expandedId];
        if (prevPlayer && prevPlayer.destroy) prevPlayer.destroy();
        delete state.cache['_wf_' + state.expandedId];
        var prev = dom.logBody.querySelector('tr.expand-row.open');
        if (prev) prev.classList.remove('open');
        var prevData = dom.logBody.querySelector('tr.expanded');
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
        Vox.populateExpandRow(expandRow, state.cache[id]);
        return;
    }

    // Loading state
    expandRow.querySelector('td').innerHTML = '<div class="expand-content" style="color:var(--ink-muted);font-size:9px;">Loading...</div>';

    fetch(Vox.API + '/db/' + id).then(function(r) { return r.json(); }).then(function(data) {
        state.cache[id] = data;
        Vox.populateExpandRow(expandRow, data);
    }).catch(function() {
        expandRow.querySelector('td').innerHTML = '<div class="expand-content" style="color:var(--one);">Error loading vox</div>';
    });
};

Vox.populateExpandRow = function(expandRow, data) {
    var state = Vox.state;

    // Ensure data.id is set — fall back to expand row attribute
    if (!data.id) {
        data.id = expandRow.getAttribute('data-expand-id');
    }
    var td = expandRow.querySelector('td');
    td.innerHTML = Vox.buildExpandContent(data);

    // Initialize waveform player
    var wfContainer = td.querySelector('.vox-waveform-container');
    if (wfContainer && window.VoxWaveform && data.id) {
        var wfOpts = {
            audioUrl: Vox.API + '/db/' + data.id + '/audio',
            duration: (data.audio && data.audio.duration) || data.duration || 1,
            sourceText: data.source || ''
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
            fetch(Vox.API + '/db/' + voxId + '/analyze', { method: 'POST' })
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
                        var dataRow = Vox.dom.logBody.querySelector('tr[data-vox-id="' + vid + '"]');
                        if (dataRow) {
                            Vox.toggleExpand(vid, dataRow, expandRow);
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
            fetch(Vox.API + '/db/' + voxId + '/layers/onsets', {
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

    // Bind trash (soft delete)
    var trashBtn = td.querySelector('.expand-trash-btn');
    if (trashBtn) {
        trashBtn.addEventListener('click', function() {
            trashBtn.textContent = '...';
            trashBtn.disabled = true;
            fetch(Vox.API + '/db/' + data.id, { method: 'DELETE' })
                .then(function(r) { return r.json(); })
                .then(function(result) {
                    if (result.ok) {
                        delete state.cache[data.id];
                        state.expandedId = null;
                        Vox.loadDb();
                    }
                })
                .catch(function() {
                    trashBtn.textContent = 'Trash';
                    trashBtn.disabled = false;
                });
        });
    }
};
