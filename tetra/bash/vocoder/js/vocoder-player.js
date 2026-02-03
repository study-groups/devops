/**
 * vocoder-player.js - Standalone browser audio player component
 *
 * Zero dependencies. Attaches to window.VocoderPlayer.
 * If window.Terrain exists, also registers there.
 *
 * Usage:
 *   VocoderPlayer.create(container, {
 *       src: '/api/vox/db/12345/audio',
 *       text: 'The quick brown fox...',
 *       codec: 'opus',
 *       voice: 'coqui:vits',
 *       voxId: '12345',
 *       words: null  // optional [{word, start, end}, ...] for precise highlight
 *   });
 */
(function() {
    'use strict';

    var CSS_LOADED = false;

    function injectCSS() {
        if (CSS_LOADED) return;
        CSS_LOADED = true;

        // Check if external stylesheet already loaded
        var sheets = document.querySelectorAll('link[href*="vocoder-player"]');
        if (sheets.length > 0) return;

        var style = document.createElement('style');
        style.textContent = [
            '.vocoder-player {',
            '    --vp-bg: var(--paper-dark, var(--bg-tertiary, #1a1a1a));',
            '    --vp-text: var(--ink, var(--text-primary, #ccc));',
            '    --vp-text-muted: var(--ink-muted, var(--text-secondary, #8b949e));',
            '    --vp-accent: var(--four, var(--accent-primary, #58a6ff));',
            '    --vp-accent-bg: var(--four-dim, rgba(88,166,255,0.15));',
            '    --vp-border: var(--border, #30363d);',
            '    background: var(--vp-bg);',
            '    border: 1px solid var(--vp-border);',
            '    border-left: 3px solid var(--vp-accent);',
            '    border-radius: 4px;',
            '    padding: 0.75rem 1rem;',
            '    margin: 1rem 0;',
            '    font-size: 0.85rem;',
            '    font-family: inherit;',
            '}',
            '.vocoder-player-text {',
            '    color: var(--vp-text);',
            '    line-height: 1.6;',
            '    margin-bottom: 0.5rem;',
            '    white-space: pre-wrap;',
            '    word-break: break-word;',
            '}',
            '.vocoder-player-text .vp-word {',
            '    cursor: pointer;',
            '    border-radius: 2px;',
            '    padding: 0 1px;',
            '    transition: background 0.1s;',
            '}',
            '.vocoder-player-text .vp-word:hover {',
            '    background: var(--vp-accent-bg);',
            '}',
            '.vocoder-player-text .vp-word.active {',
            '    background: var(--vp-accent);',
            '    color: #fff;',
            '}',
            '.vocoder-player-controls {',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 8px;',
            '    margin-bottom: 0.25rem;',
            '}',
            '.vocoder-player-controls .vp-play-btn {',
            '    background: none;',
            '    border: 1px solid var(--vp-border);',
            '    color: var(--vp-accent);',
            '    width: 28px;',
            '    height: 28px;',
            '    border-radius: 4px;',
            '    cursor: pointer;',
            '    font-size: 12px;',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '    flex-shrink: 0;',
            '}',
            '.vocoder-player-controls .vp-play-btn:hover {',
            '    background: var(--vp-accent-bg);',
            '}',
            '.vocoder-player-controls .vp-progress {',
            '    flex: 1;',
            '    height: 4px;',
            '    background: var(--vp-border);',
            '    border-radius: 2px;',
            '    cursor: pointer;',
            '    position: relative;',
            '}',
            '.vocoder-player-controls .vp-progress-fill {',
            '    height: 100%;',
            '    background: var(--vp-accent);',
            '    border-radius: 2px;',
            '    width: 0%;',
            '    transition: width 0.1s linear;',
            '}',
            '.vocoder-player-controls .vp-time {',
            '    color: var(--vp-text-muted);',
            '    font-family: monospace;',
            '    font-size: 0.75rem;',
            '    flex-shrink: 0;',
            '    min-width: 70px;',
            '    text-align: right;',
            '}',
            '.vocoder-player-meta {',
            '    color: var(--vp-text-muted);',
            '    font-size: 0.7rem;',
            '    font-family: monospace;',
            '}',
            '.vocoder-player-status {',
            '    color: var(--vp-text-muted);',
            '    font-size: 0.7rem;',
            '    margin-top: 4px;',
            '}',
            '.vocoder-player-status.ready { color: var(--success, #3fb950); }',
            '.vocoder-player-status.error { color: var(--error, #f85149); }'
        ].join('\n');
        document.head.appendChild(style);
    }

    function fmtTime(sec) {
        if (!sec || !isFinite(sec)) return '0:00';
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function fmtSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / 1048576).toFixed(1) + 'MB';
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function create(container, opts) {
        injectCSS();

        opts = opts || {};
        var src = opts.src || '';
        var text = opts.text || '';
        var codec = opts.codec || 'opus';
        var voice = opts.voice || '';
        var voxId = opts.voxId || '';
        var wordsData = opts.words || null;

        var el = document.createElement('div');
        el.className = 'vocoder-player';

        // Parse words from text
        var wordList = text.split(/\s+/).filter(function(w) { return w.length > 0; });

        // Text with word spans
        var textHtml = wordList.map(function(w, i) {
            return '<span class="vp-word" data-wi="' + i + '">' + escapeHtml(w) + '</span>';
        }).join(' ');

        // Codec2 deferred
        if (codec === 'c2') {
            el.innerHTML =
                '<div class="vocoder-player-text">' + textHtml + '</div>' +
                '<div class="vocoder-player-status">Codec2 -- requires WASM decoder (deferred)</div>' +
                '<div class="vocoder-player-meta">' +
                    'c2' + (voice ? ' \u00b7 ' + escapeHtml(voice) : '') +
                '</div>';
            container.appendChild(el);
            return el;
        }

        el.innerHTML =
            '<div class="vocoder-player-text">' + textHtml + '</div>' +
            '<div class="vocoder-player-controls">' +
                '<button class="vp-play-btn" title="Play">\u25b6</button>' +
                '<div class="vp-progress"><div class="vp-progress-fill"></div></div>' +
                '<span class="vp-time">0:00/0:00</span>' +
            '</div>' +
            '<div class="vocoder-player-meta"></div>' +
            '<div class="vocoder-player-status">loading...</div>';

        container.appendChild(el);

        var audio = new Audio();
        audio.preload = 'none';
        var playBtn = el.querySelector('.vp-play-btn');
        var progressBar = el.querySelector('.vp-progress');
        var progressFill = el.querySelector('.vp-progress-fill');
        var timeEl = el.querySelector('.vp-time');
        var metaEl = el.querySelector('.vocoder-player-meta');
        var statusEl = el.querySelector('.vocoder-player-status');
        var words = el.querySelectorAll('.vp-word');
        var lastActive = -1;

        // Probe audio
        if (!src) {
            statusEl.textContent = 'no audio source';
            statusEl.className = 'vocoder-player-status error';
            playBtn.disabled = true;
            return el;
        }

        fetch(src, { method: 'HEAD' }).then(function(r) {
            if (r.ok) {
                audio.src = src;
                var size = r.headers.get('content-length');
                var metaParts = [codec];
                if (codec === 'opus') metaParts.push('8kbps');
                if (size) metaParts.push(fmtSize(parseInt(size)));
                if (voice) metaParts.push(escapeHtml(voice));
                metaEl.innerHTML = metaParts.join(' \u00b7 ');
                statusEl.textContent = 'ready';
                statusEl.className = 'vocoder-player-status ready';
            } else {
                statusEl.textContent = 'audio not found (vox ' + voxId + ')';
                statusEl.className = 'vocoder-player-status';
                playBtn.disabled = true;
            }
        }).catch(function() {
            statusEl.textContent = 'vox API unavailable';
            statusEl.className = 'vocoder-player-status error';
            playBtn.disabled = true;
        });

        // Play/Pause
        playBtn.addEventListener('click', function() {
            if (audio.paused) {
                audio.play();
            } else {
                audio.pause();
            }
        });

        audio.addEventListener('play', function() { playBtn.textContent = '\u23f8'; });
        audio.addEventListener('pause', function() { playBtn.textContent = '\u25b6'; });
        audio.addEventListener('ended', function() {
            playBtn.textContent = '\u25b6';
            progressFill.style.width = '0%';
            if (lastActive >= 0 && lastActive < words.length) words[lastActive].classList.remove('active');
            lastActive = -1;
        });

        // Progress
        audio.addEventListener('timeupdate', function() {
            var dur = audio.duration;
            if (!dur || !isFinite(dur)) return;
            var pct = (audio.currentTime / dur) * 100;
            progressFill.style.width = pct + '%';
            timeEl.textContent = fmtTime(audio.currentTime) + '/' + fmtTime(dur);

            // Word highlight
            if (words.length === 0) return;
            var idx;
            if (wordsData && wordsData.length === words.length) {
                // Precise alignment
                idx = 0;
                for (var i = 0; i < wordsData.length; i++) {
                    if (audio.currentTime >= wordsData[i].start) idx = i;
                }
            } else {
                // Linear spread
                idx = Math.min(Math.floor((audio.currentTime / dur) * words.length), words.length - 1);
            }
            if (idx !== lastActive) {
                if (lastActive >= 0 && lastActive < words.length) words[lastActive].classList.remove('active');
                words[idx].classList.add('active');
                lastActive = idx;
            }
        });

        // Seek via progress bar
        progressBar.addEventListener('click', function(e) {
            var rect = progressBar.getBoundingClientRect();
            var pct = (e.clientX - rect.left) / rect.width;
            if (audio.duration && isFinite(audio.duration)) {
                audio.currentTime = pct * audio.duration;
            }
        });

        // Click word to seek
        el.querySelector('.vocoder-player-text').addEventListener('click', function(e) {
            var wordEl = e.target.closest('.vp-word');
            if (!wordEl) return;
            var wi = parseInt(wordEl.dataset.wi);
            var dur = audio.duration;
            if (!dur || !isFinite(dur)) return;

            if (wordsData && wordsData.length > wi) {
                audio.currentTime = wordsData[wi].start;
            } else {
                audio.currentTime = (wi / words.length) * dur;
            }
            if (audio.paused) audio.play();
        });

        return el;
    }

    var VocoderPlayer = { create: create, version: '1.0.0' };

    window.VocoderPlayer = VocoderPlayer;

    // Register with Terrain if available
    if (window.Terrain && typeof Terrain.registerComponent === 'function') {
        Terrain.registerComponent('vocoder-player', VocoderPlayer);
    }
})();
