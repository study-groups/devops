/**
 * voxlab.js - Lab tab panel for ML experiment tracking
 *
 * Fetches from /api/voxlab endpoints and renders:
 * - Experiment list with status/loss/steps
 * - Experiment detail with config, loss curve, logs
 * - Sidebar: pipelines, golden refs, triggers, events
 */
(function() {
    'use strict';

    var API = '/api/voxlab';

    var els = {
        body: document.getElementById('lab-exp-body'),
        empty: document.getElementById('lab-empty'),
        count: document.getElementById('lab-exp-count'),
        detail: document.getElementById('lab-detail'),
        detailTitle: document.getElementById('lab-detail-title'),
        detailConfig: document.getElementById('lab-detail-config'),
        detailLogs: document.getElementById('lab-detail-logs'),
        lossCanvas: document.getElementById('lab-loss-canvas'),
        pipelines: document.getElementById('lab-pipelines'),
        golden: document.getElementById('lab-golden'),
        triggers: document.getElementById('lab-triggers'),
        events: document.getElementById('lab-events'),
        statusBar: document.getElementById('lab-status-bar'),
        refreshBtn: document.getElementById('lab-refresh-btn')
    };

    var sampleEls = {
        before: {
            card: document.getElementById('lab-sample-before'),
            canvas: document.getElementById('lab-wf-before'),
            play: document.getElementById('lab-play-before')
        },
        during: {
            card: document.getElementById('lab-sample-during'),
            canvas: document.getElementById('lab-wf-during'),
            play: document.getElementById('lab-play-during')
        },
        after: {
            card: document.getElementById('lab-sample-after'),
            canvas: document.getElementById('lab-wf-after'),
            play: document.getElementById('lab-play-after')
        }
    };

    var state = {
        experiments: [],
        selectedExp: null,
        audioCtx: null,
        currentAudio: null,
        sampleBuffers: {}
    };

    // ------------------------------------------------------------------
    // Fetch helpers
    // ------------------------------------------------------------------

    function fetchJson(url) {
        return fetch(url).then(function(r) { return r.json(); }).catch(function() { return []; });
    }

    // ------------------------------------------------------------------
    // Experiments
    // ------------------------------------------------------------------

    function loadExperiments() {
        fetchJson(API + '/experiments').then(function(data) {
            state.experiments = data || [];
            renderExperiments();
            els.count.textContent = state.experiments.length + ' experiment' + (state.experiments.length !== 1 ? 's' : '');
        });
    }

    function renderExperiments() {
        els.body.innerHTML = '';
        if (state.experiments.length === 0) {
            els.empty.style.display = '';
            return;
        }
        els.empty.style.display = 'none';

        state.experiments.forEach(function(exp) {
            var tr = document.createElement('tr');
            if (state.selectedExp === exp.name) tr.classList.add('selected');

            var pipeline = (exp.config && exp.config.pipeline) || '-';
            var status = exp.status || '-';
            var loss = '-';
            var steps = '-';
            var created = '-';

            if (exp.summary) {
                loss = exp.summary.best_loss;
                steps = exp.summary.total_steps;
            } else if (exp.lastEntry) {
                loss = exp.lastEntry.loss;
                steps = exp.lastEntry.step;
            }
            if (exp.config && exp.config.created) {
                created = exp.config.created.substring(0, 16).replace('T', ' ');
            }

            if (typeof loss === 'number') loss = loss.toFixed(4);

            tr.innerHTML =
                '<td title="' + escapeAttr(exp.name) + '">' + truncate(exp.name, 28) + '</td>' +
                '<td>' + escapeHtml(pipeline) + '</td>' +
                '<td>' + escapeHtml(status) + '</td>' +
                '<td style="font-family:monospace;">' + loss + '</td>' +
                '<td>' + steps + '</td>' +
                '<td>' + created + '</td>';

            tr.addEventListener('click', function() { selectExperiment(exp.name); });
            els.body.appendChild(tr);
        });
    }

    function selectExperiment(name) {
        state.selectedExp = name;
        stopAllAudio();
        renderExperiments();

        els.detail.classList.remove('hidden');
        els.detailTitle.textContent = name;
        els.detailConfig.textContent = 'Loading...';
        els.detailLogs.textContent = '';

        // Reset sample cards
        resetSampleCards();

        // Fetch detail (includes samples URLs)
        fetchJson(API + '/experiments/' + encodeURIComponent(name)).then(function(data) {
            if (data.config) {
                els.detailConfig.textContent = JSON.stringify(data.config, null, 2);
            } else {
                els.detailConfig.textContent = '-';
            }
            if (data.summary) {
                els.detailConfig.textContent += '\n\n--- Summary ---\n' + JSON.stringify(data.summary, null, 2);
            }
            // Load voice samples
            if (data.samples) {
                loadSamples(data.samples);
            }
        });

        // Fetch logs for loss curve
        fetchJson(API + '/experiments/' + encodeURIComponent(name) + '/logs?tail=500').then(function(entries) {
            if (entries.length > 0) {
                var recent = entries.slice(-10);
                els.detailLogs.textContent = recent.map(function(e) {
                    return JSON.stringify(e);
                }).join('\n');
                drawLossCurve(entries);
            } else {
                els.detailLogs.textContent = 'No logs yet.';
                clearCanvas();
            }
        });
    }

    // ------------------------------------------------------------------
    // Voice samples: load, draw waveform, play
    // ------------------------------------------------------------------

    function getAudioCtx() {
        if (!state.audioCtx) {
            state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return state.audioCtx;
    }

    function resetSampleCards() {
        ['before', 'during', 'after'].forEach(function(phase) {
            var s = sampleEls[phase];
            s.card.classList.remove('has-audio');
            s.play.disabled = true;
            s.play.innerHTML = '&#9654; Play';
            s.play.classList.remove('playing');
            clearSampleCanvas(s.canvas);
        });
        state.sampleBuffers = {};
    }

    function loadSamples(samples) {
        ['before', 'during', 'after'].forEach(function(phase) {
            if (!samples[phase]) return;
            var s = sampleEls[phase];
            s.card.classList.add('has-audio');
            s.play.disabled = false;

            // Fetch and decode audio for waveform drawing
            fetch(samples[phase])
                .then(function(r) { return r.arrayBuffer(); })
                .then(function(buf) { return getAudioCtx().decodeAudioData(buf); })
                .then(function(audioBuffer) {
                    state.sampleBuffers[phase] = { url: samples[phase], buffer: audioBuffer };
                    drawSampleWaveform(s.canvas, audioBuffer, phase);
                })
                .catch(function() {
                    // Still playable via Audio element even if decode fails
                    state.sampleBuffers[phase] = { url: samples[phase], buffer: null };
                });
        });
    }

    function drawSampleWaveform(canvas, audioBuffer, phase) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width = canvas.offsetWidth || 120;
        var h = canvas.height = canvas.offsetHeight || 32;
        ctx.clearRect(0, 0, w, h);

        var data = audioBuffer.getChannelData(0);
        var step = Math.max(1, Math.floor(data.length / w));
        var mid = h / 2;

        // Color per phase
        var colors = { before: '#ff6b6b', during: '#ffaa33', after: '#4a9eff' };
        var color = colors[phase] || '#4a9eff';

        // Draw waveform bars
        ctx.fillStyle = color;
        for (var i = 0; i < w; i++) {
            var idx = i * step;
            var min = 0, max = 0;
            for (var j = 0; j < step && idx + j < data.length; j++) {
                var v = data[idx + j];
                if (v < min) min = v;
                if (v > max) max = v;
            }
            var y1 = mid + min * mid;
            var y2 = mid + max * mid;
            var barH = Math.max(1, y2 - y1);
            ctx.fillRect(i, y1, 1, barH);
        }

        // Center line
        ctx.strokeStyle = 'rgba(128,128,128,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
    }

    function clearSampleCanvas(canvas) {
        var ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth || 120;
        canvas.height = canvas.offsetHeight || 32;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function stopAllAudio() {
        if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio = null;
        }
        ['before', 'during', 'after'].forEach(function(phase) {
            sampleEls[phase].play.innerHTML = '&#9654; Play';
            sampleEls[phase].play.classList.remove('playing');
        });
    }

    function playSample(phase) {
        var entry = state.sampleBuffers[phase];
        if (!entry) return;

        var btn = sampleEls[phase].play;
        var wasPlaying = btn.classList.contains('playing');

        stopAllAudio();

        if (wasPlaying) return; // was toggle-off

        btn.innerHTML = '&#9632; Stop';
        btn.classList.add('playing');

        var audio = new Audio(entry.url);
        state.currentAudio = audio;
        audio.play();
        audio.addEventListener('ended', function() {
            btn.innerHTML = '&#9654; Play';
            btn.classList.remove('playing');
            state.currentAudio = null;
        });
    }

    // Bind play buttons
    ['before', 'during', 'after'].forEach(function(phase) {
        sampleEls[phase].play.addEventListener('click', function() {
            playSample(phase);
        });
    });

    // ------------------------------------------------------------------
    // Loss curve (canvas)
    // ------------------------------------------------------------------

    function drawLossCurve(entries) {
        var canvas = els.lossCanvas;
        var ctx = canvas.getContext('2d');
        var w = canvas.width = canvas.offsetWidth;
        var h = canvas.height = canvas.offsetHeight || 80;
        ctx.clearRect(0, 0, w, h);

        var losses = entries.map(function(e) { return e.loss; }).filter(function(l) { return l != null; });
        var valLosses = entries.map(function(e) { return e.val_loss; }).filter(function(l) { return l != null; });
        if (losses.length < 2) return;

        var all = losses.concat(valLosses);
        var maxLoss = Math.max.apply(null, all);
        var minLoss = Math.min.apply(null, all);
        var range = maxLoss - minLoss || 1;

        var pad = 4;
        var plotW = w - pad * 2;
        var plotH = h - pad * 2;

        function toX(i, arr) { return pad + (i / (arr.length - 1)) * plotW; }
        function toY(v) { return pad + (1 - (v - minLoss) / range) * plotH; }

        // Grid lines
        ctx.strokeStyle = 'rgba(128,128,128,0.15)';
        ctx.lineWidth = 0.5;
        for (var g = 0; g <= 4; g++) {
            var gy = pad + (g / 4) * plotH;
            ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - pad, gy); ctx.stroke();
        }

        // Train loss line
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var i = 0; i < losses.length; i++) {
            var x = toX(i, losses);
            var y = toY(losses[i]);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Val loss line
        if (valLosses.length > 1) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            for (var j = 0; j < valLosses.length; j++) {
                var vx = toX(j, valLosses);
                var vy = toY(valLosses[j]);
                if (j === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Labels
        ctx.fillStyle = 'rgba(128,128,128,0.6)';
        ctx.font = '8px monospace';
        ctx.fillText(maxLoss.toFixed(3), pad + 2, pad + 8);
        ctx.fillText(minLoss.toFixed(3), pad + 2, h - pad);
        ctx.fillText('loss', w - 30, pad + 8);
    }

    function clearCanvas() {
        var canvas = els.lossCanvas;
        var ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight || 80;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // ------------------------------------------------------------------
    // Sidebar
    // ------------------------------------------------------------------

    function loadPipelines() {
        fetchJson(API + '/pipelines').then(function(data) {
            if (!data || data.length === 0) {
                els.pipelines.textContent = 'None defined';
                return;
            }
            els.pipelines.innerHTML = data.map(function(p) {
                var stages = (p.stages || []).join(' \u2192 ');
                return '<div class="lab-sidebar-item"><span>' + escapeHtml(p.name) + '</span></div>' +
                       '<div style="font-size:8px;color:var(--ink-muted);padding:0 4px 4px;">' + escapeHtml(stages) + '</div>';
            }).join('');
        });
    }

    function loadGolden() {
        fetchJson(API + '/golden').then(function(data) {
            if (!data || data.length === 0) {
                els.golden.textContent = 'None created';
                return;
            }
            els.golden.innerHTML = data.map(function(g) {
                var text = (g.text || '').substring(0, 30);
                if ((g.text || '').length > 30) text += '...';
                var voice = g.voice_spec || '-';
                return '<div class="lab-sidebar-item">' +
                    '<span title="' + escapeAttr(g.text || '') + '">golden:' + (g.epoch || '?') + '</span>' +
                    '<span style="color:var(--ink-muted);">' + escapeHtml(voice) + '</span>' +
                    '</div>';
            }).join('');
        });
    }

    function loadTriggers() {
        fetchJson(API + '/triggers').then(function(data) {
            if (!data || data.length === 0) {
                els.triggers.textContent = 'None set';
                return;
            }
            els.triggers.innerHTML = data.map(function(t) {
                return '<div class="lab-sidebar-item">' +
                    '<span>' + escapeHtml(t.name) + '</span>' +
                    '<span style="color:var(--ink-muted);">' + t.type + ' &lt;' + t.value + ' \u2192 ' + t.action + '</span>' +
                    '</div>';
            }).join('');
        });
    }

    function loadEvents() {
        fetchJson(API + '/events?tail=20').then(function(data) {
            if (!data || data.length === 0) {
                els.events.textContent = 'No events';
                return;
            }
            els.events.innerHTML = data.reverse().map(function(e) {
                var ts = (e.ts || '').substring(11, 19);
                var args = (e.args || []).join(' ');
                return '<div style="font-size:8px;padding:1px 0;color:var(--ink-muted);">' +
                    '<span style="color:var(--four);">' + escapeHtml(e.event || '') + '</span> ' +
                    truncate(args, 24) +
                    ' <span style="opacity:0.5;">' + ts + '</span></div>';
            }).join('');
        });
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }

    function escapeAttr(s) {
        return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function truncate(s, n) {
        if (!s) return '-';
        return s.length > n ? s.substring(0, n - 2) + '..' : s;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    function refresh() {
        loadExperiments();
        loadPipelines();
        loadGolden();
        loadTriggers();
        loadEvents();
        els.statusBar.textContent = 'Refreshed ' + new Date().toLocaleTimeString();
    }

    els.refreshBtn.addEventListener('click', refresh);

    window.VoxlabPanel = { refresh: refresh };

})();
