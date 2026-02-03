/**
 * waveform-editor.js - Reusable waveform editor with VAD and onset annotation
 *
 * Usage:
 *   const editor = WaveformEditor.create(container, {
 *     audioUrl: '/path/to/audio.mp3',
 *     duration: 10.5,
 *     height: 120,
 *     mode: 'seek',  // 'seek' or 'edit'
 *     vad: { enabled: true, threshold: 0.02, minDuration: 0.1 },
 *     onSeek: (time) => {},
 *     onOnsetsChange: (onsets) => {}
 *   });
 *
 * Modes:
 *   - seek: click seeks playhead, no onset editing
 *   - edit: click adds onset, drag moves onset, shift+click deletes
 */
(function() {
    'use strict';

    const DEFAULTS = {
        height: 100,
        mode: 'seek',
        colors: {
            waveform: 'var(--four, #4fc3f7)',
            vad: 'rgba(76, 175, 80, 0.2)',
            onset: 'rgba(255, 152, 0, 0.7)',
            onsetSelected: 'rgba(255, 200, 0, 0.9)',
            cursor: 'var(--one, #ef5350)',
            bg: 'transparent'
        },
        waveform: {
            segmentsPerSecond: 40,
            minHeight: 2,
            maxHeight: 40,
            strokeWidth: 1.5
        },
        vad: {
            enabled: true,
            threshold: 0.015,      // RMS threshold for voice activity
            minDuration: 0.08,     // minimum segment duration (seconds)
            padding: 0.02          // padding around segments (seconds)
        }
    };

    function create(container, opts) {
        opts = opts || {};
        const config = {
            height: opts.height || DEFAULTS.height,
            mode: opts.mode || DEFAULTS.mode,
            colors: { ...DEFAULTS.colors, ...opts.colors },
            waveform: { ...DEFAULTS.waveform, ...opts.waveform },
            vad: { ...DEFAULTS.vad, ...opts.vad }
        };

        let duration = opts.duration || 1;
        let audioUrl = opts.audioUrl || null;
        let rmsValues = null;
        let vadSegments = [];
        let onsets = [];
        let selectedOnsetIdx = -1;
        let isDragging = false;
        let destroyed = false;
        let animId = null;

        // Callbacks
        const onSeek = opts.onSeek || (() => {});
        const onOnsetsChange = opts.onOnsetsChange || (() => {});
        const onVadChange = opts.onVadChange || (() => {});

        // Build DOM
        const wrapper = document.createElement('div');
        wrapper.className = 'wf-editor';

        const canvas = document.createElement('canvas');
        canvas.className = 'wf-editor-canvas';
        canvas.height = config.height;
        wrapper.appendChild(canvas);

        const controls = document.createElement('div');
        controls.className = 'wf-editor-controls';

        // Play button
        const playBtn = document.createElement('button');
        playBtn.className = 'wf-editor-btn wf-play-btn';
        playBtn.innerHTML = '&#9654;';
        playBtn.title = 'Play/Pause';
        controls.appendChild(playBtn);

        // Time display
        const timeSpan = document.createElement('span');
        timeSpan.className = 'wf-editor-time';
        timeSpan.textContent = formatTime(0) + ' / ' + formatTime(duration);
        controls.appendChild(timeSpan);

        // Spacer
        const spacer = document.createElement('span');
        spacer.style.flex = '1';
        controls.appendChild(spacer);

        // Mode toggle
        const modeBtn = document.createElement('button');
        modeBtn.className = 'wf-editor-btn wf-mode-btn';
        modeBtn.textContent = config.mode === 'edit' ? 'Edit' : 'Seek';
        modeBtn.title = 'Toggle seek/edit mode';
        controls.appendChild(modeBtn);

        // VAD toggle
        const vadBtn = document.createElement('button');
        vadBtn.className = 'wf-editor-btn wf-vad-btn' + (config.vad.enabled ? ' active' : '');
        vadBtn.textContent = 'VAD';
        vadBtn.title = 'Toggle voice activity detection';
        controls.appendChild(vadBtn);

        wrapper.appendChild(controls);

        // VAD parameters panel (hidden by default)
        const vadPanel = document.createElement('div');
        vadPanel.className = 'wf-editor-vad-panel';
        vadPanel.style.display = 'none';
        vadPanel.innerHTML = `
            <div class="wf-vad-param">
                <label>Threshold</label>
                <input type="range" class="wf-vad-threshold" min="0.005" max="0.1" step="0.005" value="${config.vad.threshold}">
                <span class="wf-vad-value">${config.vad.threshold}</span>
            </div>
            <div class="wf-vad-param">
                <label>Min Duration</label>
                <input type="range" class="wf-vad-mindur" min="0.02" max="0.3" step="0.01" value="${config.vad.minDuration}">
                <span class="wf-vad-value">${config.vad.minDuration}s</span>
            </div>
            <div class="wf-vad-actions">
                <button class="wf-editor-btn wf-vad-apply">Recompute VAD</button>
                <button class="wf-editor-btn wf-vad-to-onsets">VAD → Onsets</button>
            </div>
        `;
        wrapper.appendChild(vadPanel);

        container.innerHTML = '';
        container.appendChild(wrapper);

        // Audio element
        const audio = document.createElement('audio');
        audio.preload = 'auto';
        if (audioUrl) audio.src = audioUrl;

        const ctx = canvas.getContext('2d');

        // --- Utility functions ---

        function formatTime(t) {
            const m = Math.floor(t / 60);
            const s = (t % 60).toFixed(1);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }

        function resolveColor(c) {
            if (c.indexOf('var(') === 0) {
                const m = c.match(/var\(--([\w-]+)/);
                if (m) {
                    const v = getComputedStyle(document.documentElement).getPropertyValue('--' + m[1]).trim();
                    if (v) return v;
                }
                const fb = c.match(/,\s*([^)]+)\)/);
                return fb ? fb[1].trim() : '#888';
            }
            return c;
        }

        function xToTime(clientX) {
            const rect = canvas.getBoundingClientRect();
            let ratio = (clientX - rect.left) / rect.width;
            ratio = Math.max(0, Math.min(1, ratio));
            return ratio * duration;
        }

        function timeToX(t) {
            return (t / duration) * canvas.width;
        }

        function findNearestOnset(clientX, snapPx = 8) {
            const rect = canvas.getBoundingClientRect();
            const px = clientX - rect.left;
            let best = -1, bestDist = Infinity;
            for (let i = 0; i < onsets.length; i++) {
                const ox = timeToX(onsets[i]);
                const d = Math.abs(ox - px);
                if (d < bestDist) { bestDist = d; best = i; }
            }
            return bestDist <= snapPx ? best : -1;
        }

        // --- Audio analysis ---

        function computeRMS(samples, sampleRate, hopMs = 20) {
            const hopSamples = Math.floor(sampleRate * hopMs / 1000);
            const values = [];
            for (let i = 0; i < samples.length; i += hopSamples) {
                let sum = 0;
                const end = Math.min(i + hopSamples, samples.length);
                for (let j = i; j < end; j++) sum += samples[j] * samples[j];
                values.push(Math.sqrt(sum / (end - i)));
            }
            return values;
        }

        function computeVAD(rms, hopMs = 20) {
            const threshold = config.vad.threshold;
            const minDur = config.vad.minDuration;
            const padding = config.vad.padding;
            const hopSec = hopMs / 1000;

            const segments = [];
            let inSpeech = false;
            let segStart = 0;

            for (let i = 0; i < rms.length; i++) {
                const t = i * hopSec;
                if (rms[i] > threshold) {
                    if (!inSpeech) {
                        inSpeech = true;
                        segStart = Math.max(0, t - padding);
                    }
                } else {
                    if (inSpeech) {
                        const segEnd = Math.min(duration, t + padding);
                        if (segEnd - segStart >= minDur) {
                            segments.push({ start: segStart, end: segEnd });
                        }
                        inSpeech = false;
                    }
                }
            }
            // Handle segment at end
            if (inSpeech) {
                const segEnd = duration;
                if (segEnd - segStart >= minDur) {
                    segments.push({ start: segStart, end: segEnd });
                }
            }

            // Merge overlapping segments
            const merged = [];
            for (const seg of segments) {
                if (merged.length && seg.start <= merged[merged.length - 1].end) {
                    merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, seg.end);
                } else {
                    merged.push({ ...seg });
                }
            }

            return merged;
        }

        function analyzeAudio(callback) {
            if (!audioUrl) { callback(); return; }

            const xhr = new XMLHttpRequest();
            xhr.open('GET', audioUrl, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function() {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                audioCtx.decodeAudioData(xhr.response, function(buffer) {
                    const samples = buffer.getChannelData(0);
                    const sr = buffer.sampleRate;
                    duration = buffer.duration;

                    rmsValues = computeRMS(samples, sr, 20);
                    if (config.vad.enabled) {
                        vadSegments = computeVAD(rmsValues, 20);
                        onVadChange(vadSegments);
                    }

                    audioCtx.close();
                    timeSpan.textContent = formatTime(0) + ' / ' + formatTime(duration);
                    callback();
                }, function() { callback(); });
            };
            xhr.onerror = function() { callback(); };
            xhr.send();
        }

        // --- Drawing ---

        function sampleRMS(t) {
            if (!rmsValues || !rmsValues.length) return 0.3;
            const idx = Math.floor((t / duration) * rmsValues.length);
            return rmsValues[Math.max(0, Math.min(idx, rmsValues.length - 1))];
        }

        function draw(currentTime) {
            if (destroyed) return;
            const w = canvas.width;
            const h = canvas.height;
            const mid = h / 2;

            ctx.clearRect(0, 0, w, h);

            // 1. VAD regions
            if (config.vad.enabled && vadSegments.length) {
                ctx.fillStyle = resolveColor(config.colors.vad);
                for (const seg of vadSegments) {
                    const x0 = timeToX(seg.start);
                    const x1 = timeToX(seg.end);
                    ctx.fillRect(x0, 0, x1 - x0, h);
                }
            }

            // 2. Waveform
            const wf = config.waveform;
            let peak = 0;
            if (rmsValues) {
                for (const v of rmsValues) if (v > peak) peak = v;
            }
            if (peak < 1e-8) peak = 1;

            const nSegs = Math.max(2, Math.floor(duration * wf.segmentsPerSecond));
            ctx.beginPath();
            ctx.strokeStyle = resolveColor(config.colors.waveform);
            ctx.lineWidth = wf.strokeWidth;
            ctx.lineJoin = 'round';

            for (let i = 0; i <= nSegs; i++) {
                const t = (i / nSegs) * duration;
                const x = (i / nSegs) * w;
                const rms = sampleRMS(t);
                const norm = rms / peak;
                const amp = wf.minHeight + norm * (wf.maxHeight - wf.minHeight);
                const dir = (i % 2 === 0) ? -1 : 1;
                const y = mid + dir * amp;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // 3. Onset markers
            if (onsets.length) {
                for (let i = 0; i < onsets.length; i++) {
                    const ox = timeToX(onsets[i]);
                    const isSelected = i === selectedOnsetIdx;
                    ctx.strokeStyle = resolveColor(isSelected ? config.colors.onsetSelected : config.colors.onset);
                    ctx.lineWidth = isSelected ? 2 : 1;
                    ctx.setLineDash(isSelected ? [] : [3, 3]);
                    ctx.beginPath();
                    ctx.moveTo(ox, 0);
                    ctx.lineTo(ox, h);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
            }

            // 4. Playback cursor
            if (currentTime > 0 && currentTime <= duration) {
                const cx = timeToX(currentTime);
                ctx.strokeStyle = resolveColor(config.colors.cursor);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, 0);
                ctx.lineTo(cx, h);
                ctx.stroke();
            }
        }

        function updateTime() {
            if (destroyed) return;
            const ct = audio.currentTime || 0;
            timeSpan.textContent = formatTime(ct) + ' / ' + formatTime(duration);
            draw(ct);
            if (!audio.paused) {
                animId = requestAnimationFrame(updateTime);
            }
        }

        function resize() {
            const rect = wrapper.getBoundingClientRect();
            if (rect.width > 0) {
                canvas.width = Math.floor(rect.width);
            }
            draw(audio.currentTime || 0);
        }

        // --- Event handlers ---

        playBtn.addEventListener('click', function() {
            if (audio.paused) {
                audio.play();
                playBtn.innerHTML = '&#10074;&#10074;';
                updateTime();
            } else {
                audio.pause();
                playBtn.innerHTML = '&#9654;';
            }
        });

        audio.addEventListener('ended', function() {
            playBtn.innerHTML = '&#9654;';
            if (animId) cancelAnimationFrame(animId);
        });

        modeBtn.addEventListener('click', function() {
            config.mode = config.mode === 'seek' ? 'edit' : 'seek';
            modeBtn.textContent = config.mode === 'edit' ? 'Edit' : 'Seek';
            modeBtn.classList.toggle('active', config.mode === 'edit');
            canvas.style.cursor = config.mode === 'edit' ? 'crosshair' : 'pointer';
        });

        vadBtn.addEventListener('click', function() {
            vadPanel.style.display = vadPanel.style.display === 'none' ? 'flex' : 'none';
        });

        // VAD parameter controls
        const thresholdInput = vadPanel.querySelector('.wf-vad-threshold');
        const minDurInput = vadPanel.querySelector('.wf-vad-mindur');
        const thresholdValue = vadPanel.querySelectorAll('.wf-vad-value')[0];
        const minDurValue = vadPanel.querySelectorAll('.wf-vad-value')[1];

        thresholdInput.addEventListener('input', function() {
            config.vad.threshold = parseFloat(this.value);
            thresholdValue.textContent = config.vad.threshold.toFixed(3);
        });

        minDurInput.addEventListener('input', function() {
            config.vad.minDuration = parseFloat(this.value);
            minDurValue.textContent = config.vad.minDuration + 's';
        });

        vadPanel.querySelector('.wf-vad-apply').addEventListener('click', function() {
            if (rmsValues) {
                vadSegments = computeVAD(rmsValues, 20);
                onVadChange(vadSegments);
                draw(audio.currentTime || 0);
            }
        });

        vadPanel.querySelector('.wf-vad-to-onsets').addEventListener('click', function() {
            // Convert VAD segments to onsets (start of each segment)
            onsets = vadSegments.map(s => s.start);
            onOnsetsChange(onsets.slice());
            draw(audio.currentTime || 0);
        });

        // Canvas interactions
        canvas.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;

            if (config.mode === 'seek') {
                // Seek mode: just seek
                const t = xToTime(e.clientX);
                audio.currentTime = t;
                onSeek(t);
                draw(t);
                timeSpan.textContent = formatTime(t) + ' / ' + formatTime(duration);
            } else {
                // Edit mode
                if (e.shiftKey) {
                    // Shift+click: delete nearest onset
                    const idx = findNearestOnset(e.clientX);
                    if (idx >= 0) {
                        onsets.splice(idx, 1);
                        selectedOnsetIdx = -1;
                        onOnsetsChange(onsets.slice());
                        draw(audio.currentTime || 0);
                    }
                } else {
                    // Check if clicking on existing onset
                    const idx = findNearestOnset(e.clientX);
                    if (idx >= 0) {
                        selectedOnsetIdx = idx;
                        isDragging = true;
                        canvas.style.cursor = 'ew-resize';
                    } else {
                        // Add new onset
                        const t = xToTime(e.clientX);
                        onsets.push(t);
                        onsets.sort((a, b) => a - b);
                        selectedOnsetIdx = onsets.indexOf(t);
                        onOnsetsChange(onsets.slice());
                    }
                    draw(audio.currentTime || 0);
                }
            }
        });

        canvas.addEventListener('mousemove', function(e) {
            if (!isDragging || selectedOnsetIdx < 0) return;
            const t = xToTime(e.clientX);
            onsets[selectedOnsetIdx] = t;
            draw(audio.currentTime || 0);
        });

        canvas.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                canvas.style.cursor = config.mode === 'edit' ? 'crosshair' : 'pointer';
                // Re-sort after drag
                if (selectedOnsetIdx >= 0) {
                    const val = onsets[selectedOnsetIdx];
                    onsets.sort((a, b) => a - b);
                    selectedOnsetIdx = onsets.indexOf(val);
                    onOnsetsChange(onsets.slice());
                }
                draw(audio.currentTime || 0);
            }
        });

        canvas.addEventListener('mouseleave', function() {
            if (isDragging) {
                isDragging = false;
                canvas.style.cursor = config.mode === 'edit' ? 'crosshair' : 'pointer';
            }
        });

        // Initialize
        canvas.style.cursor = config.mode === 'edit' ? 'crosshair' : 'pointer';
        modeBtn.classList.toggle('active', config.mode === 'edit');

        analyzeAudio(function() {
            resize();
        });

        // Resize observer
        let ro = null;
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(resize);
            ro.observe(wrapper);
        }

        // Public API
        return {
            destroy: function() {
                destroyed = true;
                if (animId) cancelAnimationFrame(animId);
                audio.pause();
                audio.src = '';
                if (ro) ro.disconnect();
            },

            setAudioUrl: function(url) {
                audioUrl = url;
                audio.src = url;
                analyzeAudio(function() { resize(); });
            },

            setDuration: function(d) {
                duration = d;
                timeSpan.textContent = formatTime(audio.currentTime || 0) + ' / ' + formatTime(duration);
                draw(audio.currentTime || 0);
            },

            setMode: function(mode) {
                config.mode = mode;
                modeBtn.textContent = mode === 'edit' ? 'Edit' : 'Seek';
                modeBtn.classList.toggle('active', mode === 'edit');
                canvas.style.cursor = mode === 'edit' ? 'crosshair' : 'pointer';
            },

            setOnsets: function(arr) {
                onsets = (arr || []).slice().sort((a, b) => a - b);
                selectedOnsetIdx = -1;
                draw(audio.currentTime || 0);
            },

            getOnsets: function() {
                return onsets.slice();
            },

            getVadSegments: function() {
                return vadSegments.slice();
            },

            setVadParams: function(params) {
                Object.assign(config.vad, params);
                thresholdInput.value = config.vad.threshold;
                minDurInput.value = config.vad.minDuration;
                thresholdValue.textContent = config.vad.threshold.toFixed(3);
                minDurValue.textContent = config.vad.minDuration + 's';
            },

            recomputeVad: function() {
                if (rmsValues) {
                    vadSegments = computeVAD(rmsValues, 20);
                    onVadChange(vadSegments);
                    draw(audio.currentTime || 0);
                }
            },

            seek: function(t) {
                audio.currentTime = t;
                draw(t);
                timeSpan.textContent = formatTime(t) + ' / ' + formatTime(duration);
            },

            play: function() {
                audio.play();
                playBtn.innerHTML = '&#10074;&#10074;';
                updateTime();
            },

            pause: function() {
                audio.pause();
                playBtn.innerHTML = '&#9654;';
            },

            markSaved: function() {
                // Reset any "has edits" visual indicator
                // This is called after onsets are successfully saved to server
            },

            get audio() { return audio; },
            get duration() { return duration; }
        };
    }

    window.WaveformEditor = { create };
})();
