/**
 * anim-engine.js - Animation playback engine for guide.html
 *
 * Wraps text chunks in spans, syncs CSS animations to audio timeupdate.
 * Controlled via direct API or postMessage from parent (director).
 */
(function() {
    'use strict';

    var instances = [];

    function AnimInstance(containerEl, timelineCues, audioElement) {
        this.container = containerEl;
        this.cues = timelineCues || [];
        this.audio = audioElement;
        this.chunks = [];
        this._onTimeUpdate = this._handleTimeUpdate.bind(this);
        this._setup();
    }

    AnimInstance.prototype._setup = function() {
        var text = this.container.textContent;
        var html = '';
        var pos = 0;

        // Sort cues by start time
        var sorted = this.cues.slice().sort(function(a, b) { return a.start - b.start; });

        for (var i = 0; i < sorted.length; i++) {
            var cue = sorted[i];
            var idx = text.indexOf(cue.text, pos);
            if (idx === -1) continue;

            // Plain text before this chunk
            if (idx > pos) {
                html += escapeHtml(text.substring(pos, idx));
            }

            var dur = (cue.end - cue.start).toFixed(2);
            html += '<span class="anim-chunk anim-fx-' + escapeAttr(cue.fx || 'highlight') + '"' +
                ' data-start="' + cue.start + '"' +
                ' data-end="' + cue.end + '"' +
                ' style="--anim-dur:' + dur + 's">' +
                escapeHtml(cue.text) + '</span>';

            pos = idx + cue.text.length;
        }

        // Remaining text
        if (pos < text.length) {
            html += escapeHtml(text.substring(pos));
        }

        this.container.innerHTML = html;
        this.chunks = Array.prototype.slice.call(this.container.querySelectorAll('.anim-chunk'));

        if (this.audio) {
            this.audio.addEventListener('timeupdate', this._onTimeUpdate);
        }
    };

    AnimInstance.prototype._handleTimeUpdate = function() {
        var t = this.audio.currentTime;
        for (var i = 0; i < this.chunks.length; i++) {
            var el = this.chunks[i];
            var start = parseFloat(el.dataset.start);
            var end = parseFloat(el.dataset.end);
            if (t >= start && t < end) {
                el.classList.add('anim-active');
            } else {
                el.classList.remove('anim-active');
            }
        }
    };

    AnimInstance.prototype.play = function() {
        if (this.audio) this.audio.play();
    };

    AnimInstance.prototype.pause = function() {
        if (this.audio) this.audio.pause();
    };

    AnimInstance.prototype.seek = function(time) {
        if (this.audio) {
            this.audio.currentTime = time;
            this._handleTimeUpdate();
        }
    };

    AnimInstance.prototype.destroy = function() {
        if (this.audio) {
            this.audio.removeEventListener('timeupdate', this._onTimeUpdate);
        }
        // Restore plain text
        this.container.textContent = this.container.textContent;
        var idx = instances.indexOf(this);
        if (idx !== -1) instances.splice(idx, 1);
    };

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeAttr(str) {
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    // Public API
    window.AnimEngine = {
        init: function(containerEl, timelineCues, audioElement) {
            var inst = new AnimInstance(containerEl, timelineCues, audioElement);
            instances.push(inst);
            return inst;
        },
        play: function() {
            instances.forEach(function(i) { i.play(); });
        },
        pause: function() {
            instances.forEach(function(i) { i.pause(); });
        },
        seek: function(time) {
            instances.forEach(function(i) { i.seek(time); });
        },
        destroy: function() {
            instances.slice().forEach(function(i) { i.destroy(); });
            instances = [];
        },
        instances: instances
    };

    // Director audio element for injected playback
    var _directorAudio = null;

    function getDirectorAudio(src) {
        if (!_directorAudio) {
            _directorAudio = document.createElement('audio');
            _directorAudio.style.display = 'none';
            document.body.appendChild(_directorAudio);
        }
        if (src && _directorAudio.getAttribute('src') !== src) {
            _directorAudio.src = src;
        }
        return _directorAudio;
    }

    // PostMessage listener for director control
    window.addEventListener('message', function(e) {
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'anim-init') {
            // Director sends cues + optional narration text to match a paragraph
            AnimEngine.destroy();
            var cues = msg.cues || [];
            var narration = msg.narration || '';
            var audioSrc = msg.audioSrc || '';
            var audioEl = audioSrc ? getDirectorAudio(audioSrc) : null;

            // Find the paragraph element matching the narration text
            var target = null;
            if (narration) {
                var paras = document.querySelectorAll('p');
                for (var i = 0; i < paras.length; i++) {
                    if (paras[i].textContent.trim() === narration.trim()) {
                        target = paras[i];
                        break;
                    }
                }
            }
            if (!target) {
                target = document.querySelector('.step.active p') || document.querySelector('p');
            }
            if (target && cues.length > 0) {
                AnimEngine.init(target, cues, audioEl);
            }
        }
        else if (msg.type === 'anim-play') {
            if (msg.audioSrc) {
                var audio = getDirectorAudio(msg.audioSrc);
                if (instances.length > 0 && !instances[0].audio) {
                    instances[0].audio = audio;
                    audio.addEventListener('timeupdate', instances[0]._onTimeUpdate);
                }
                audio.currentTime = 0;
                audio.play();
            }
            AnimEngine.play();
        }
        else if (msg.type === 'anim-pause') AnimEngine.pause();
        else if (msg.type === 'anim-seek' && typeof msg.time === 'number') AnimEngine.seek(msg.time);
    });
})();
