/**
 * timeline-editor.js - Waveform + chunk boundary editor for tut dashboard
 *
 * Creates a timeline editor component with:
 * - Waveform display (reuses VoxWaveform)
 * - Draggable boundary markers
 * - Per-chunk fx dropdown
 * - Auto-split on sentence boundaries
 * - Inline preview with animation
 */
(function() {
    'use strict';

    var EFFECTS = ['highlight', 'jiggle', 'color-pop', 'underline-draw', 'fade-in', 'glow', 'typewriter'];

    function TimelineEditorInstance(container, opts) {
        this.container = container;
        this.audioUrl = opts.audioUrl || '';
        this.text = opts.text || '';
        this.timeline = (opts.timeline || []).slice();
        this.onChange = opts.onChange || function() {};
        this.audio = null;
        this.waveform = null;
        this.audioDuration = 0;
        this._render();
        this._loadAudio();
    }

    TimelineEditorInstance.prototype._render = function() {
        this.container.innerHTML = '';
        this.container.className = 'timeline-editor';

        // Waveform area
        var waveWrap = document.createElement('div');
        waveWrap.className = 'te-waveform-wrap';

        var playBtn = document.createElement('button');
        playBtn.className = 'te-play-btn';
        playBtn.textContent = '\u25B6';
        var self = this;
        playBtn.addEventListener('click', function() {
            if (!self.audio) return;
            if (self.audio.paused) { self.audio.play(); playBtn.textContent = '\u23F8'; }
            else { self.audio.pause(); playBtn.textContent = '\u25B6'; }
        });
        waveWrap.appendChild(playBtn);

        this.waveCanvas = document.createElement('canvas');
        this.waveCanvas.className = 'te-waveform-canvas';
        this.waveCanvas.width = 500;
        this.waveCanvas.height = 60;
        waveWrap.appendChild(this.waveCanvas);

        // Click waveform to add boundary
        this.waveCanvas.addEventListener('click', function(e) {
            if (!self.audioDuration) return;
            var rect = self.waveCanvas.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var time = (x / rect.width) * self.audioDuration;
            self._addBoundary(time);
        });

        this.container.appendChild(waveWrap);

        // Chunk strip
        this.chunkStrip = document.createElement('div');
        this.chunkStrip.className = 'te-chunk-strip';
        this.container.appendChild(this.chunkStrip);

        // Buttons
        var btnRow = document.createElement('div');
        btnRow.className = 'te-btn-row';

        var autoBtn = document.createElement('button');
        autoBtn.className = 'te-btn';
        autoBtn.textContent = 'auto-split';
        autoBtn.addEventListener('click', function() { self._autoSplit(); });
        btnRow.appendChild(autoBtn);

        var clearBtn = document.createElement('button');
        clearBtn.className = 'te-btn';
        clearBtn.textContent = 'clear';
        clearBtn.addEventListener('click', function() {
            self.timeline = [];
            self._renderChunks();
            self.onChange(self.timeline);
        });
        btnRow.appendChild(clearBtn);

        this.container.appendChild(btnRow);

        // Audio element
        this.audio = document.createElement('audio');
        this.audio.preload = 'auto';
        this.container.appendChild(this.audio);

        this._renderChunks();
    };

    TimelineEditorInstance.prototype._loadAudio = function() {
        if (!this.audioUrl) return;
        var self = this;
        this.audio.src = this.audioUrl;
        this.audio.addEventListener('loadedmetadata', function() {
            self.audioDuration = self.audio.duration;
            self._drawWaveform();
            // Re-render chunks if auto-split was pending
        });
        this.audio.addEventListener('ended', function() {
            var playBtn = self.container.querySelector('.te-play-btn');
            if (playBtn) playBtn.textContent = '\u25B6';
        });

        // Draw waveform from audio data
        if (window.VoxWaveform && this.audioUrl) {
            fetch(this.audioUrl)
                .then(function(r) { return r.arrayBuffer(); })
                .then(function(buf) {
                    var ctx = new (window.AudioContext || window.webkitAudioContext)();
                    return ctx.decodeAudioData(buf);
                })
                .then(function(audioBuffer) {
                    self._audioBuffer = audioBuffer;
                    self.audioDuration = audioBuffer.duration;
                    self._drawWaveform();
                })
                .catch(function() {
                    // Fallback: just use duration from audio element
                });
        }
    };

    TimelineEditorInstance.prototype._drawWaveform = function() {
        var canvas = this.waveCanvas;
        var ctx = canvas.getContext('2d');
        var w = canvas.width;
        var h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        if (this._audioBuffer) {
            var data = this._audioBuffer.getChannelData(0);
            var step = Math.ceil(data.length / w);
            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (var i = 0; i < w; i++) {
                var start = i * step;
                var max = 0;
                for (var j = start; j < start + step && j < data.length; j++) {
                    var abs = Math.abs(data[j]);
                    if (abs > max) max = abs;
                }
                var y = (1 - max) * (h / 2);
                if (i === 0) ctx.moveTo(i, y);
                else ctx.lineTo(i, y);
            }
            // Mirror
            for (var i = w - 1; i >= 0; i--) {
                var start = i * step;
                var max = 0;
                for (var j = start; j < start + step && j < data.length; j++) {
                    var abs = Math.abs(data[j]);
                    if (abs > max) max = abs;
                }
                var y = (1 + max) * (h / 2);
                ctx.lineTo(i, y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillStyle = '#8b949e';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.audioDuration ? 'waveform' : 'loading...', w / 2, h / 2 + 3);
        }

        // Draw boundary markers
        if (this.audioDuration > 0) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 1;
            for (var i = 0; i < this.timeline.length; i++) {
                var cue = this.timeline[i];
                var x = (cue.start / this.audioDuration) * w;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
                if (i === this.timeline.length - 1) {
                    var xEnd = (cue.end / this.audioDuration) * w;
                    ctx.beginPath();
                    ctx.moveTo(xEnd, 0);
                    ctx.lineTo(xEnd, h);
                    ctx.stroke();
                }
            }
        }
    };

    TimelineEditorInstance.prototype._addBoundary = function(time) {
        if (this.timeline.length === 0) {
            // First boundary: split text at midpoint
            var words = this.text.split(/\s+/);
            var mid = Math.floor(words.length / 2);
            var t1 = words.slice(0, mid).join(' ');
            var t2 = words.slice(mid).join(' ');
            this.timeline = [
                { start: 0, end: time, text: t1, fx: 'highlight' },
                { start: time, end: this.audioDuration || time + 1, text: t2, fx: 'highlight' }
            ];
        } else {
            // Find which cue this time falls in and split it
            for (var i = 0; i < this.timeline.length; i++) {
                var cue = this.timeline[i];
                if (time > cue.start && time < cue.end) {
                    var words = cue.text.split(/\s+/);
                    var ratio = (time - cue.start) / (cue.end - cue.start);
                    var splitIdx = Math.max(1, Math.round(words.length * ratio));
                    var t1 = words.slice(0, splitIdx).join(' ');
                    var t2 = words.slice(splitIdx).join(' ');
                    if (!t1 || !t2) break;
                    var newCue = { start: time, end: cue.end, text: t2, fx: cue.fx };
                    cue.end = time;
                    cue.text = t1;
                    this.timeline.splice(i + 1, 0, newCue);
                    break;
                }
            }
        }
        this._renderChunks();
        this._drawWaveform();
        this.onChange(this.timeline);
    };

    TimelineEditorInstance.prototype._autoSplit = function() {
        if (!this.text) return;
        // Split on sentence boundaries
        var sentences = this.text.match(/[^.!?]+[.!?]+\s*/g);
        if (!sentences) sentences = [this.text];

        var totalChars = sentences.reduce(function(s, t) { return s + t.length; }, 0);
        var dur = this.audioDuration || sentences.length;
        var pos = 0;

        this.timeline = [];
        for (var i = 0; i < sentences.length; i++) {
            var chunk = sentences[i].trim();
            if (!chunk) continue;
            var fraction = chunk.length / totalChars;
            var start = pos;
            var end = pos + fraction * dur;
            this.timeline.push({
                start: Math.round(start * 100) / 100,
                end: Math.round(end * 100) / 100,
                text: chunk,
                fx: 'highlight'
            });
            pos = end;
        }

        this._renderChunks();
        this._drawWaveform();
        this.onChange(this.timeline);
    };

    TimelineEditorInstance.prototype._renderChunks = function() {
        var strip = this.chunkStrip;
        strip.innerHTML = '';
        var self = this;

        this.timeline.forEach(function(cue, i) {
            var row = document.createElement('div');
            row.className = 'te-chunk-row';

            var label = document.createElement('span');
            label.className = 'te-chunk-label';
            label.textContent = (i + 1) + ': "' + cue.text.substring(0, 40) + (cue.text.length > 40 ? '...' : '') + '"';
            label.title = cue.text;
            row.appendChild(label);

            var timeSpan = document.createElement('span');
            timeSpan.className = 'te-chunk-time';
            timeSpan.textContent = cue.start.toFixed(1) + 's - ' + cue.end.toFixed(1) + 's';
            row.appendChild(timeSpan);

            var select = document.createElement('select');
            select.className = 'te-fx-select';
            EFFECTS.forEach(function(fx) {
                var opt = document.createElement('option');
                opt.value = fx;
                opt.textContent = fx;
                if (fx === cue.fx) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', function() {
                cue.fx = select.value;
                self.onChange(self.timeline);
            });
            row.appendChild(select);

            strip.appendChild(row);
        });
    };

    TimelineEditorInstance.prototype.destroy = function() {
        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
        }
        this.container.innerHTML = '';
    };

    // Public API
    window.TimelineEditor = {
        create: function(container, opts) {
            return new TimelineEditorInstance(container, opts);
        }
    };
})();
