/**
 * vox-waveform.js - Canvas zig-zag waveform renderer with VAD overlay
 *
 * Usage: VoxWaveform.create(container, opts)
 * opts: { audioUrl, duration, rms, vad, onsets, zigzag }
 */
(function() {
    'use strict';

    var DEFAULTS = {
        height: 80,
        zigzag: {
            segmentsPerSecond: 30,
            minHeight: 2,
            maxHeight: 36,
            strokeWidth: 1.5,
            color: 'var(--four, #4fc3f7)'
        },
        vadColor: 'rgba(76, 175, 80, 0.15)',
        onsetColor: 'rgba(255, 152, 0, 0.5)',
        cursorColor: 'var(--two, #ef5350)',
        bgColor: 'transparent'
    };

    function create(container, opts) {
        opts = opts || {};
        var zz = Object.assign({}, DEFAULTS.zigzag, opts.zigzag || {});
        var height = opts.height || DEFAULTS.height;
        var duration = opts.duration || 1;
        var audioUrl = opts.audioUrl;
        var rmsData = opts.rms || null;   // { values: [...] }
        var vadData = opts.vad || null;   // { segments: [{start, end}] }
        var onsetsData = opts.onsets || null; // [time, ...] or [{start,length}, ...]
        var sourceText = opts.sourceText || '';
        var words = sourceText.trim() ? sourceText.trim().split(/\s+/) : [];

        // Build DOM
        var wrapper = document.createElement('div');
        wrapper.className = 'vox-waveform-widget';

        var canvas = document.createElement('canvas');
        canvas.className = 'vox-waveform-canvas';
        canvas.height = height;
        wrapper.appendChild(canvas);

        var controls = document.createElement('div');
        controls.className = 'vox-waveform-controls';

        var playBtn = document.createElement('button');
        playBtn.className = 'vox-wf-play toolbar-btn';
        playBtn.textContent = '\u25b6';
        controls.appendChild(playBtn);

        var timeSpan = document.createElement('span');
        timeSpan.className = 'vox-wf-time';
        timeSpan.textContent = '0.0 / ' + duration.toFixed(1) + 's';
        controls.appendChild(timeSpan);

        wrapper.appendChild(controls);
        container.innerHTML = '';
        container.appendChild(wrapper);

        // Audio element (hidden)
        var audio = document.createElement('audio');
        audio.preload = 'auto';
        if (audioUrl) audio.src = audioUrl;

        var ctx = canvas.getContext('2d');
        var animId = null;
        var rmsValues = null;
        var destroyed = false;

        // Normalize onsets: accept [time,...] or [{start,length},...] → sorted time array
        function normalizeOnsets(arr) {
            if (!arr || !arr.length) return [];
            if (typeof arr[0] === 'number') return arr.slice().sort(function(a, b) { return a - b; });
            return arr.map(function(o) { return o.start; }).sort(function(a, b) { return a - b; });
        }

        // Editable onset state
        var editableOnsets = null;  // null = not yet initialized (sorted time array)
        var savedOnsets = null;     // last-saved snapshot
        var selectedIdx = -1;
        var isDragging = false;
        var dirty = false;
        var didInteract = false;    // track if mouse interaction happened (suppress seek)
        var MARKER_SNAP_PX = 5;

        // Resolve CSS variable colors
        function resolveColor(c) {
            if (c.indexOf('var(') === 0) {
                var m = c.match(/var\(--([\w-]+)/);
                if (m) {
                    var style = getComputedStyle(document.documentElement);
                    var v = style.getPropertyValue('--' + m[1]).trim();
                    if (v) return v;
                }
                var fb = c.match(/,\s*([^)]+)\)/);
                return fb ? fb[1].trim() : '#888';
            }
            return c;
        }

        // Always decode audio and run Tscale for VAD/onsets
        function ensureAnalysis(cb) {
            // Use server RMS if available as initial values
            if (!rmsValues && rmsData && rmsData.values && rmsData.values.length > 0) {
                rmsValues = rmsData.values;
            }
            if (!audioUrl) { rmsValues = rmsValues || []; cb(rmsValues); return; }
            if (typeof Tscale === 'undefined') {
                // No Tscale — use server data or basic fallback
                if (rmsValues) { cb(rmsValues); return; }
                var xhr2 = new XMLHttpRequest();
                xhr2.open('GET', audioUrl, true);
                xhr2.responseType = 'arraybuffer';
                xhr2.onload = function() {
                    var ac2 = new (window.AudioContext || window.webkitAudioContext)();
                    ac2.decodeAudioData(xhr2.response, function(buf) {
                        var raw = buf.getChannelData(0);
                        var hopSamples = Math.floor(buf.sampleRate * 0.020);
                        var vals = [];
                        for (var i = 0; i < raw.length; i += hopSamples) {
                            var sum = 0, end = Math.min(i + hopSamples, raw.length);
                            for (var j = i; j < end; j++) sum += raw[j] * raw[j];
                            vals.push(Math.sqrt(sum / (end - i)));
                        }
                        rmsValues = vals;
                        ac2.close();
                        cb(rmsValues);
                    }, function() { rmsValues = []; cb(rmsValues); });
                };
                xhr2.onerror = function() { rmsValues = []; cb(rmsValues); };
                xhr2.send();
                return;
            }
            // Tscale available — always decode and compute
            var xhr = new XMLHttpRequest();
            xhr.open('GET', audioUrl, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function() {
                var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                audioCtx.decodeAudioData(xhr.response, function(buffer) {
                    var raw = buffer.getChannelData(0);
                    var sr = buffer.sampleRate;
                    var rmsResult = Tscale.rms(raw, sr, 20);
                    rmsValues = rmsResult.values;
                    vadData = { segments: Tscale.vad(raw, sr) };
                    onsetsData = Tscale.detectOnsets(raw, sr);
                    audioCtx.close();
                    cb(rmsValues);
                }, function() {
                    rmsValues = rmsValues || [];
                    cb(rmsValues);
                });
            };
            xhr.onerror = function() { rmsValues = rmsValues || []; cb(rmsValues); };
            xhr.send();
        }

        function sampleRms(values, t) {
            if (!values || values.length === 0) return 0.5;
            var idx = (t / duration) * values.length;
            var i = Math.floor(idx);
            if (i >= values.length) i = values.length - 1;
            if (i < 0) i = 0;
            return values[i];
        }

        function draw(currentTime) {
            var w = canvas.width;
            var h = canvas.height;
            var mid = h / 2;
            ctx.clearRect(0, 0, w, h);

            var strokeColor = resolveColor(zz.color);
            var cursorClr = resolveColor(DEFAULTS.cursorColor);

            // 1. VAD regions
            if (vadData && vadData.segments) {
                ctx.fillStyle = opts.vadColor || DEFAULTS.vadColor;
                for (var s = 0; s < vadData.segments.length; s++) {
                    var seg = vadData.segments[s];
                    var x0 = (seg.start / duration) * w;
                    var x1 = (seg.end / duration) * w;
                    ctx.fillRect(x0, 0, x1 - x0, h);
                }
            }

            // 2. Zig-zag waveform
            var values = rmsValues || [];
            var peak = 0;
            for (var pi = 0; pi < values.length; pi++) {
                if (values[pi] > peak) peak = values[pi];
            }
            if (peak < 1e-8) peak = 1;

            var nSegs = Math.floor(duration * zz.segmentsPerSecond);
            if (nSegs < 2) nSegs = 2;

            ctx.beginPath();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = zz.strokeWidth;
            ctx.lineJoin = 'round';

            for (var i = 0; i <= nSegs; i++) {
                var t = (i / nSegs) * duration;
                var x = (i / nSegs) * w;
                var rms = sampleRms(values, t);
                var norm = rms / peak;
                var amp = zz.minHeight + norm * (zz.maxHeight - zz.minHeight);
                var dir = (i % 2 === 0) ? -1 : 1;
                var y = mid + dir * amp;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // 3. Onset markers (from editableOnsets if available, else onsetsData)
            var drawOnsets = editableOnsets || normalizeOnsets(onsetsData);
            if (drawOnsets && drawOnsets.length) {
                var onsetClr = opts.onsetColor || DEFAULTS.onsetColor;
                var selectedClr = 'rgba(255, 200, 0, 0.9)';
                for (var oi = 0; oi < drawOnsets.length; oi++) {
                    var ox = (drawOnsets[oi] / duration) * w;
                    if (oi === selectedIdx) {
                        ctx.setLineDash([]);
                        ctx.strokeStyle = selectedClr;
                        ctx.lineWidth = 2;
                    } else {
                        ctx.setLineDash([3, 3]);
                        ctx.strokeStyle = onsetClr;
                        ctx.lineWidth = 1;
                    }
                    ctx.beginPath();
                    ctx.moveTo(ox, 0);
                    ctx.lineTo(ox, h);
                    ctx.stroke();
                }
                ctx.setLineDash([]);

                // Word label on selected marker
                if (selectedIdx >= 0 && selectedIdx < drawOnsets.length) {
                    var word = words[selectedIdx] || ('#' + selectedIdx);
                    var lx = (drawOnsets[selectedIdx] / duration) * w;
                    ctx.font = '10px monospace';
                    ctx.fillStyle = selectedClr;
                    var tw = ctx.measureText(word).width;
                    // Keep label inside canvas
                    var labelX = lx + 3;
                    if (labelX + tw > w) labelX = lx - tw - 3;
                    ctx.fillText(word, labelX, 11);
                }
            }

            // 4. Playback cursor
            if (currentTime > 0 && currentTime <= duration) {
                var cx = (currentTime / duration) * w;
                ctx.strokeStyle = cursorClr;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(cx, 0);
                ctx.lineTo(cx, h);
                ctx.stroke();
            }
        }

        function updateTime() {
            if (destroyed) return;
            var ct = audio.currentTime || 0;
            timeSpan.textContent = ct.toFixed(1) + ' / ' + duration.toFixed(1) + 's';
            draw(ct);
            if (!audio.paused) {
                animId = requestAnimationFrame(updateTime);
            }
        }

        // Resize canvas to container width
        function resize() {
            var rect = wrapper.getBoundingClientRect();
            if (rect.width > 0) {
                canvas.width = Math.floor(rect.width);
            }
            draw(audio.currentTime || 0);
        }

        // Play/pause
        playBtn.addEventListener('click', function() {
            if (audio.paused) {
                audio.play();
                playBtn.textContent = '\u275a\u275a';
                updateTime();
            } else {
                audio.pause();
                playBtn.textContent = '\u25b6';
            }
        });

        audio.addEventListener('ended', function() {
            playBtn.textContent = '\u25b6';
            if (animId) cancelAnimationFrame(animId);
        });

        // Helper: initialize editable onsets from current data
        function initEditable() {
            if (editableOnsets) return;
            editableOnsets = normalizeOnsets(onsetsData);
            savedOnsets = editableOnsets.slice();
        }

        // Helper: pixel x → time
        function xToTime(clientX) {
            var rect = canvas.getBoundingClientRect();
            var ratio = (clientX - rect.left) / rect.width;
            if (ratio < 0) ratio = 0;
            if (ratio > 1) ratio = 1;
            return ratio * duration;
        }

        // Helper: find nearest onset index within snap distance, or -1
        function findNearOnset(clientX) {
            if (!editableOnsets || !editableOnsets.length) return -1;
            var rect = canvas.getBoundingClientRect();
            var w = rect.width;
            var px = clientX - rect.left;
            var best = -1, bestDist = Infinity;
            for (var i = 0; i < editableOnsets.length; i++) {
                var ox = (editableOnsets[i] / duration) * w;
                var d = Math.abs(ox - px);
                if (d < bestDist) { bestDist = d; best = i; }
            }
            return bestDist <= MARKER_SNAP_PX ? best : -1;
        }

        // Mousedown: select/drag existing marker or insert new one
        canvas.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            initEditable();
            didInteract = false;
            var idx = findNearOnset(e.clientX);
            if (idx >= 0) {
                selectedIdx = idx;
                isDragging = true;
                didInteract = true;
                canvas.style.cursor = 'ew-resize';
                draw(audio.currentTime || 0);
            } else {
                // Insert new marker
                var t = xToTime(e.clientX);
                editableOnsets.push(t);
                editableOnsets.sort(function(a, b) { return a - b; });
                selectedIdx = editableOnsets.indexOf(t);
                dirty = true;
                didInteract = true;
                draw(audio.currentTime || 0);
            }
        });

        canvas.addEventListener('mousemove', function(e) {
            if (!isDragging || selectedIdx < 0) return;
            var t = xToTime(e.clientX);
            editableOnsets[selectedIdx] = t;
            dirty = true;
            draw(audio.currentTime || 0);
        });

        canvas.addEventListener('mouseup', function(e) {
            if (isDragging) {
                isDragging = false;
                canvas.style.cursor = 'crosshair';
                // Re-sort after drag
                if (selectedIdx >= 0 && editableOnsets) {
                    var val = editableOnsets[selectedIdx];
                    editableOnsets.sort(function(a, b) { return a - b; });
                    selectedIdx = editableOnsets.indexOf(val);
                }
                draw(audio.currentTime || 0);
            }
        });

        // Right-click to delete selected marker
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            initEditable();
            var idx = findNearOnset(e.clientX);
            if (idx >= 0) {
                editableOnsets.splice(idx, 1);
                selectedIdx = -1;
                dirty = true;
                didInteract = true;
                draw(audio.currentTime || 0);
            }
        });

        // Click-to-seek (only if no marker interaction happened)
        canvas.addEventListener('click', function(e) {
            if (didInteract) { didInteract = false; return; }
            var ratio = xToTime(e.clientX) / duration;
            audio.currentTime = ratio * duration;
            draw(audio.currentTime);
            timeSpan.textContent = audio.currentTime.toFixed(1) + ' / ' + duration.toFixed(1) + 's';
        });

        // Init: get RMS then render
        ensureAnalysis(function() {
            resize();
        });

        // Observe resize
        if (typeof ResizeObserver !== 'undefined') {
            var ro = new ResizeObserver(function() { resize(); });
            ro.observe(wrapper);
        }

        return {
            destroy: function() {
                destroyed = true;
                if (animId) cancelAnimationFrame(animId);
                audio.pause();
                audio.src = '';
                if (ro) ro.disconnect();
            },
            setSourceText: function(text) {
                sourceText = text || '';
                words = sourceText.trim() ? sourceText.trim().split(/\s+/) : [];
            },
            setLayers: function(layers) {
                if (layers.rms) { rmsData = layers.rms; rmsValues = layers.rms.values || null; }
                if (layers.vad) vadData = layers.vad;
                if (layers.onsets) {
                    onsetsData = layers.onsets;
                    editableOnsets = normalizeOnsets(layers.onsets);
                    savedOnsets = editableOnsets.slice();
                    dirty = false;
                }
                draw(audio.currentTime || 0);
            },
            getOnsets: function() {
                var times = (editableOnsets || normalizeOnsets(onsetsData)).slice();
                times.sort(function(a, b) { return a - b; });
                var result = [];
                for (var i = 0; i < times.length; i++) {
                    var next = (i + 1 < times.length) ? times[i + 1] : duration;
                    result.push({ start: times[i], length: next - times[i] });
                }
                return result;
            },
            hasEdits: function() { return dirty; },
            clearEdits: function() {
                if (savedOnsets) {
                    editableOnsets = savedOnsets.slice();
                } else {
                    editableOnsets = null;
                }
                dirty = false;
                selectedIdx = -1;
                draw(audio.currentTime || 0);
            },
            markSaved: function() {
                savedOnsets = editableOnsets ? editableOnsets.slice() : null;
                dirty = false;
            },
            audio: audio
        };
    }

    window.VoxWaveform = { create: create };
})();
