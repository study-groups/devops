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
        var onsetsData = opts.onsets || null; // [time, ...]

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

        // Get or compute RMS values
        function ensureRms(cb) {
            if (rmsValues) { cb(rmsValues); return; }
            if (rmsData && rmsData.values && rmsData.values.length > 0) {
                rmsValues = rmsData.values;
                cb(rmsValues);
                return;
            }
            // Fallback: decode audio client-side
            if (!audioUrl) { rmsValues = []; cb(rmsValues); return; }
            var xhr = new XMLHttpRequest();
            xhr.open('GET', audioUrl, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function() {
                var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                audioCtx.decodeAudioData(xhr.response, function(buffer) {
                    var raw = buffer.getChannelData(0);
                    var sr = buffer.sampleRate;
                    var hopSamples = Math.floor(sr * 0.020); // 20ms hop
                    var vals = [];
                    for (var i = 0; i < raw.length; i += hopSamples) {
                        var sum = 0;
                        var end = Math.min(i + hopSamples, raw.length);
                        for (var j = i; j < end; j++) sum += raw[j] * raw[j];
                        vals.push(Math.sqrt(sum / (end - i)));
                    }
                    rmsValues = vals;
                    audioCtx.close();
                    cb(rmsValues);
                }, function() {
                    rmsValues = [];
                    cb(rmsValues);
                });
            };
            xhr.onerror = function() { rmsValues = []; cb(rmsValues); };
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

            // 3. Onset markers
            if (onsetsData && onsetsData.length) {
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = opts.onsetColor || DEFAULTS.onsetColor;
                ctx.lineWidth = 1;
                for (var oi = 0; oi < onsetsData.length; oi++) {
                    var ox = (onsetsData[oi] / duration) * w;
                    ctx.beginPath();
                    ctx.moveTo(ox, 0);
                    ctx.lineTo(ox, h);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
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

        // Click-to-seek
        canvas.addEventListener('click', function(e) {
            var rect = canvas.getBoundingClientRect();
            var ratio = (e.clientX - rect.left) / rect.width;
            if (ratio < 0) ratio = 0;
            if (ratio > 1) ratio = 1;
            audio.currentTime = ratio * duration;
            draw(audio.currentTime);
            timeSpan.textContent = audio.currentTime.toFixed(1) + ' / ' + duration.toFixed(1) + 's';
        });

        // Init: get RMS then render
        ensureRms(function() {
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
            setLayers: function(layers) {
                if (layers.rms) { rmsData = layers.rms; rmsValues = layers.rms.values || null; }
                if (layers.vad) vadData = layers.vad;
                if (layers.onsets) onsetsData = layers.onsets;
                draw(audio.currentTime || 0);
            },
            audio: audio
        };
    }

    window.VoxWaveform = { create: create };
})();
