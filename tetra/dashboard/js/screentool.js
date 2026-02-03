// Screentool Panel
const CONFIG = {
    refreshInterval: 10000
};

const params = new URLSearchParams(location.search);

const state = {
    org: params.get('org') || 'tetra',
    env: params.get('env') || 'local',
    user: params.get('user') || '',
    expandedRecording: null,
    infoCache: new Map(),
    recording: false
};

let els = {};

function getApiUrl(endpoint) {
    const params = new URLSearchParams({ org: state.org, env: state.env });
    if (state.user) params.set('user', state.user);
    return `${endpoint}?${params}`;
}

async function loadRecordings() {
    try {
        const res = await fetch(getApiUrl('/api/screentool/list'));
        const data = await res.json();

        if (!data.recordings || data.recordings.length === 0) {
            els.recordings.innerHTML = '<div class="empty">(no recordings found)</div>';
            return;
        }

        let html = '<table class="rec-table"><thead><tr>';
        html += '<th></th><th>File</th><th>Date</th><th>Duration</th><th>Size</th><th></th>';
        html += '</tr></thead><tbody>';

        for (const rec of data.recordings) {
            const expanded = rec.id === state.expandedRecording;
            const audioTag = rec.hasAudio ? '<span class="badge-audio">A</span>' : '';
            const basename = rec.file ? rec.file.split('/').pop() : '';
            const fileLabel = `${rec.id}/${basename}`;
            html += `
                <tr class="rec-row${expanded ? ' expanded' : ''}" data-action="expand-recording" data-id="${rec.id}">
                    <td><span class="expand-icon">\u25B6</span></td>
                    <td>${fileLabel}</td>
                    <td>${rec.date || ''}</td>
                    <td>${rec.duration || '-'}</td>
                    <td>${rec.size || '-'}</td>
                    <td>${audioTag}</td>
                </tr>
                <tr><td colspan="6"><div class="rec-details${expanded ? ' visible' : ''}" data-id="${rec.id}">
                    ${expanded ? '<div class="loading">Loading...</div>' : ''}
                </div></td></tr>
            `;
        }

        html += '</tbody></table>';
        els.recordings.innerHTML = html;

        if (state.expandedRecording) {
            loadRecordingInfo(state.expandedRecording);
        }
    } catch (err) {
        els.recordings.innerHTML = `<div class="empty">Error: ${err.message}</div>`;
    }
}

async function loadRecordingInfo(id) {
    const detailsEl = document.querySelector(`.rec-details[data-id="${id}"]`);
    if (!detailsEl) return;

    const cached = state.infoCache.get(id);
    if (cached) {
        renderRecordingInfo(id, cached);
        return;
    }

    detailsEl.innerHTML = '<div class="loading">Loading...</div>';
    try {
        const res = await fetch(getApiUrl(`/api/screentool/info`) + `&id=${encodeURIComponent(id)}`);
        const data = await res.json();
        state.infoCache.set(id, data);
        renderRecordingInfo(id, data);
    } catch (err) {
        detailsEl.innerHTML = `<span class="error">Failed: ${err.message}</span>`;
    }
}

function renderRecordingInfo(id, data) {
    const detailsEl = document.querySelector(`.rec-details[data-id="${id}"]`);
    if (!detailsEl) return;

    const streams = data.streams || [];
    let infoHtml = '<div class="info-grid">';

    if (data.format) {
        const fmt = data.format;
        const relPath = fmt.filename ? `${id}/${fmt.filename.split('/').pop()}` : null;
        const fields = [
            ['File', relPath],
            ['Format', fmt.format_long_name || fmt.format_name],
            ['Duration', fmt.duration ? parseFloat(fmt.duration).toFixed(1) + 's' : null],
            ['Size', fmt.size ? formatBytes(parseInt(fmt.size)) : null],
            ['Bitrate', fmt.bit_rate ? Math.round(parseInt(fmt.bit_rate) / 1000) + ' kbps' : null]
        ];
        for (const [label, value] of fields) {
            if (value) {
                infoHtml += `<span class="info-label">${label}:</span><span class="info-value">${value}</span>`;
            }
        }
    }

    for (const stream of streams) {
        infoHtml += `<span class="info-label">${stream.codec_type}:</span><span class="info-value">`;
        const parts = [];
        if (stream.codec_name) parts.push(stream.codec_name);
        if (stream.width && stream.height) parts.push(`${stream.width}x${stream.height}`);
        if (stream.r_frame_rate) parts.push(stream.r_frame_rate + ' fps');
        if (stream.sample_rate) parts.push(stream.sample_rate + ' Hz');
        if (stream.channels) parts.push(stream.channels + 'ch');
        infoHtml += parts.join(', ') + '</span>';
    }

    infoHtml += '</div>';

    // Build transcode column for non-MP4 files
    const filename = data.format?.filename;
    const basename = filename ? filename.split('/').pop() : '';
    const ext = basename.split('.').pop()?.toLowerCase();
    let transcodeHtml = '';

    if (ext && ext !== 'mp4') {
        const videoStream = streams.find(s => s.codec_type === 'video');
        const audioStream = streams.find(s => s.codec_type === 'audio');
        const videoCodec = videoStream?.codec_name || 'unknown';
        const audioCodec = audioStream?.codec_name || 'none';
        const isH264 = videoCodec === 'h264';
        const isH265 = videoCodec === 'hevc' || videoCodec === 'h265';
        const isVP9 = videoCodec === 'vp9';

        let strategy, desc;
        if (isH264) {
            strategy = 'remux';
            desc = 'Stream copy (fast)';
        } else {
            strategy = 'transcode';
            desc = isH265 ? 'HEVC→H.264' : isVP9 ? 'VP9→H.264' : `${videoCodec}→H.264`;
        }

        transcodeHtml = `<div class="transcode-col">
            <div class="transcode-params">
                <div class="transcode-param"><span>Source:</span> ${videoCodec}/${audioCodec}</div>
                <div class="transcode-param"><span>Strategy:</span> ${strategy}</div>
                <div class="transcode-param"><span>Output:</span> H.264/AAC MP4</div>
                <div class="transcode-param"><span>Flags:</span> -movflags +faststart</div>
            </div>
            <button class="rec-btn" data-action="transcode" data-id="${id}" data-file="${basename}" style="margin-top:6px">Convert → MP4</button>
            <div class="transcode-result" data-id="${id}"></div>
        </div>`;
    }

    let playerHtml = '';
    if (filename) {
        const videoUrl = getApiUrl(`/api/screentool/video/${id}/${basename}`);
        playerHtml = `<div class="mini-player"><video controls preload="metadata"><source src="${videoUrl}"></video></div>`;
    }
    detailsEl.innerHTML = `<div class="rec-details-inner">${infoHtml}${transcodeHtml}${playerHtml}</div>`;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
}

function toggleExpand(id) {
    if (state.expandedRecording === id) {
        state.expandedRecording = null;
    } else {
        state.expandedRecording = id;
    }

    document.querySelectorAll('.rec-row').forEach(row => {
        row.classList.toggle('expanded', row.dataset.id === state.expandedRecording);
    });
    document.querySelectorAll('.rec-details').forEach(det => {
        const isTarget = det.dataset.id === state.expandedRecording;
        det.classList.toggle('visible', isTarget);
        if (isTarget) loadRecordingInfo(det.dataset.id);
    });
}

async function checkStatus() {
    try {
        const res = await fetch(getApiUrl('/api/screentool/status'));
        const data = await res.json();
        const statusEl = document.getElementById('rec-status');
        const btn = document.getElementById('rec-toggle-btn');
        state.recording = data.recording;

        if (data.recording) {
            let label = 'REC';
            if (data.elapsed) label += ' ' + data.elapsed;
            if (data.sessionId) label += ' [' + data.sessionId + ']';
            statusEl.className = 'status-recording';
            statusEl.textContent = label;
            btn.textContent = 'STOP';
            btn.classList.add('recording');
        } else {
            statusEl.className = 'status-idle';
            statusEl.textContent = '';
            btn.textContent = 'REC';
            btn.classList.remove('recording');
        }
    } catch (_) {}
}

async function loadConfig() {
    try {
        const res = await fetch(getApiUrl('/api/screentool/config'));
        const data = await res.json();

        // Show ST_DIR in header
        const dirEl = document.getElementById('st-dir-display');
        if (dirEl && data.ST_DIR) {
            dirEl.textContent = data.ST_DIR;
            dirEl.title = data.ST_DIR;
        }

        // Populate form fields
        const config = data.config || {};
        const form = document.getElementById('config-form');
        for (const input of form.querySelectorAll('input[name]')) {
            input.value = config[input.name] || '';
        }
    } catch (err) {
        console.error('loadConfig:', err);
    }
}

async function saveConfig() {
    const form = document.getElementById('config-form');
    const body = {};
    for (const input of form.querySelectorAll('input[name]')) {
        if (input.value.trim()) {
            body[input.name] = input.value.trim();
        }
    }

    const msgEl = document.getElementById('config-msg');
    try {
        const res = await fetch(getApiUrl('/api/screentool/config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.ok) {
            msgEl.textContent = 'Saved';
            setTimeout(() => { msgEl.textContent = ''; }, 2000);
        } else {
            msgEl.textContent = data.error || 'Error';
        }
    } catch (err) {
        msgEl.textContent = 'Failed: ' + err.message;
    }
}

async function startRecording() {
    try {
        const res = await fetch(getApiUrl('/api/screentool/record/start'), { method: 'POST' });
        const data = await res.json();
        if (data.error) {
            console.error('startRecording:', data.error);
        }
        checkStatus();
    } catch (err) {
        console.error('startRecording:', err);
    }
}

async function stopRecording() {
    try {
        const res = await fetch(getApiUrl('/api/screentool/record/stop'), { method: 'POST' });
        const data = await res.json();
        if (data.error) {
            console.error('stopRecording:', data.error);
        }
        checkStatus();
        loadRecordings();
    } catch (err) {
        console.error('stopRecording:', err);
    }
}

function toggleRecording() {
    if (state.recording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.st-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    const refreshBtn = document.querySelector('.refresh');
    if (refreshBtn) {
        refreshBtn.style.display = tabName === 'recordings' ? '' : 'none';
    }
    if (tabName === 'config') loadConfig();
}

function handleEnvChange(msg) {
    if (msg.env) state.env = msg.env;
    if (msg.org) state.org = msg.org;
    if (msg.user !== undefined) state.user = msg.user || '';
    state.expandedRecording = null;
    state.infoCache.clear();
    loadRecordings();
    checkStatus();
    loadConfig();
}

function init() {
    els = {
        recordings: document.getElementById('recordings')
    };

    Terrain.Iframe.on('expand-recording', (el, data) => toggleExpand(data.id));
    Terrain.Iframe.on('switch-tab', (el, data) => switchTab(data.tab));
    Terrain.Iframe.on('refresh', () => { loadRecordings(); checkStatus(); });
    Terrain.Iframe.on('save-config', () => saveConfig());
    Terrain.Iframe.on('config-select', (el) => {
        const target = el.dataset.target;
        const input = document.querySelector(`input[name="${target}"]`);
        if (input && el.value) input.value = el.value;
    });
    Terrain.Iframe.on('toggle-recording', () => toggleRecording());
    Terrain.Iframe.on('play-recording', (el, data) => {
        const player = document.getElementById('video-player');
        const video = document.getElementById('video-el');
        video.src = getApiUrl(`/api/screentool/video/${data.id}/${data.file}`);
        player.classList.add('visible');
        video.play();
    });
    Terrain.Iframe.on('close-player', () => {
        const player = document.getElementById('video-player');
        const video = document.getElementById('video-el');
        video.pause();
        video.src = '';
        player.classList.remove('visible');
    });
    Terrain.Iframe.on('transcode', async (el, data) => {
        const resultEl = document.querySelector(`.transcode-result[data-id="${data.id}"]`);
        if (!resultEl) return;

        el.disabled = true;
        el.textContent = 'Converting...';
        resultEl.innerHTML = '<div class="transcode-progress">Analyzing source file...</div>';

        try {
            const res = await fetch(getApiUrl(`/api/screentool/transcode/${data.id}/${data.file}`), { method: 'POST' });
            const result = await res.json();

            if (result.ok) {
                resultEl.innerHTML = `
                    <div class="transcode-success">
                        <div class="transcode-header">Conversion Complete</div>
                        <div class="transcode-detail"><span>Strategy:</span> ${result.strategy}</div>
                        <div class="transcode-detail"><span>Description:</span> ${result.description}</div>
                        <div class="transcode-detail"><span>Output:</span> ${result.output}</div>
                        <div class="transcode-detail"><span>Time:</span> ${result.result.elapsed}</div>
                        <div class="transcode-detail"><span>Size:</span> ${formatBytes(result.result.inputSize)} → ${formatBytes(result.result.outputSize)} (${result.result.compression})</div>
                        <div class="transcode-cmd"><span>Command:</span><code>${result.command}</code></div>
                    </div>`;
                el.textContent = 'Done';
                // Refresh to show new file
                setTimeout(() => { state.infoCache.delete(data.id); loadRecordings(); }, 1500);
            } else {
                resultEl.innerHTML = `<div class="transcode-error">Error: ${result.error}</div>`;
                el.textContent = '→ MP4';
                el.disabled = false;
            }
        } catch (err) {
            resultEl.innerHTML = `<div class="transcode-error">Failed: ${err.message}</div>`;
            el.textContent = '→ MP4';
            el.disabled = false;
        }
    });

    Terrain.Bus.subscribe('env-change', handleEnvChange);

    loadRecordings();
    checkStatus();
    loadConfig();
    setInterval(() => { loadRecordings(); checkStatus(); }, CONFIG.refreshInterval);
}

init();
