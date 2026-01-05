// Capture Panel - Configuration
const CONFIG = {
    org: new URLSearchParams(window.location.search).get('org') || 'tetra'
};

// Consolidated state
const state = {
    currentCapture: null,
    currentTab: 'text'
};

// DOM elements
let els = {};

async function captureUrl(url, mode) {
    setStatus('capturing', `Capturing (${mode})...`);
    els.captureBtn.disabled = true;

    try {
        const res = await fetch('/api/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, org: CONFIG.org, mode })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            setStatus('success', `Captured: ${data.id}`);
            loadCaptures();
            loadCapture(data.id, mode);
        } else {
            setStatus('error', `Error: ${data.error || 'Unknown error'}`);
        }
    } catch (e) {
        setStatus('error', `Error: ${e.message}`);
    } finally {
        els.captureBtn.disabled = false;
    }
}

async function loadCaptures() {
    try {
        const res = await fetch(`/api/capture/list?org=${CONFIG.org}`);
        if (!res.ok) throw new Error('Failed to load');

        const captures = await res.json();
        renderCapturesList(captures);
    } catch (e) {
        console.error('[Capture] Failed to load captures:', e);
    }
}

async function loadCapture(id, mode) {
    els.captureId.textContent = `${mode}/${id}`;

    els.preview.innerHTML = `<img src="/api/capture/${CONFIG.org}/${mode}/${id}/screenshot" alt="Screenshot" onerror="this.parentNode.innerHTML='<div class=placeholder>No screenshot</div>'">`;

    try {
        const res = await fetch(`/api/capture/${CONFIG.org}/${mode}/${id}`);
        if (res.ok) {
            state.currentCapture = await res.json();
            state.currentCapture._mode = mode;
            state.currentCapture._id = id;
            renderDetails(state.currentCapture);
        }
    } catch (e) {
        els.detailsContent.textContent = 'Failed to load details';
    }

    document.querySelectorAll('.capture-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === id && item.dataset.mode === mode);
    });
}

function renderDetails(capture) {
    switch (state.currentTab) {
        case 'text':
            els.detailsTitle.textContent = 'Text Content';
            els.detailsContent.innerHTML = `<pre>${capture.textContent || 'No text content'}</pre>`;
            break;

        case 'structure':
            els.detailsTitle.textContent = 'Page Structure';
            if (capture.interactions) {
                let html = '<div class="structure-grid">';
                html += '<div class="structure-section"><h4>Clickable</h4><ul>';
                (capture.interactions.clickable || []).slice(0, 10).forEach(el => {
                    html += `<li>${el.text || el.selector}</li>`;
                });
                html += '</ul></div>';
                html += '<div class="structure-section"><h4>Fillable</h4><ul>';
                (capture.interactions.fillable || []).slice(0, 10).forEach(el => {
                    html += `<li>${el.label || el.name || el.selector}</li>`;
                });
                html += '</ul></div>';
                html += '</div>';
                if (capture.semantic) {
                    html += `<div style="margin-top:8px"><h4>Hints</h4><pre>${JSON.stringify(capture.semantic, null, 2)}</pre></div>`;
                }
                els.detailsContent.innerHTML = html;
            } else if (capture.structureFile) {
                els.detailsContent.innerHTML = '<pre>Structure available in full capture</pre>';
            } else {
                els.detailsContent.innerHTML = '<pre>No structure data (use Full or Extract mode)</pre>';
            }
            break;

        case 'meta':
            els.detailsTitle.textContent = 'Metadata';
            const meta = {
                id: capture.id,
                mode: capture.mode || capture._mode,
                url: capture.url,
                finalUrl: capture.finalUrl,
                title: capture.title,
                timestamp: capture.timestamp,
                duration: capture.duration + 'ms',
                status: capture.status
            };
            if (capture.performance) {
                meta.performance = capture.performance;
            }
            els.detailsContent.innerHTML = `<pre>${JSON.stringify(meta, null, 2)}</pre>`;
            break;
    }
}

function renderCapturesList(captures) {
    if (!captures.length) {
        els.capturesList.innerHTML = '<div class="capture-item"><div class="url">No captures yet</div></div>';
        return;
    }

    els.capturesList.innerHTML = captures.map(c => `
        <div class="capture-item" data-id="${c.id}" data-mode="${c.mode}">
            <div class="url">${c.url || c.title || c.id}</div>
            <div class="meta">
                <span class="mode-badge">${c.mode}</span>
                <span>${new Date(c.timestamp).toLocaleString()}</span>
            </div>
        </div>
    `).join('');

    els.capturesList.querySelectorAll('.capture-item').forEach(item => {
        item.addEventListener('click', () => loadCapture(item.dataset.id, item.dataset.mode));
    });
}

function setStatus(type, message) {
    els.status.className = 'status ' + type;
    els.status.textContent = message;
}

function init() {
    els = {
        urlInput: document.getElementById('url-input'),
        modeSelect: document.getElementById('mode-select'),
        captureBtn: document.getElementById('capture-btn'),
        preview: document.getElementById('preview'),
        captureId: document.getElementById('capture-id'),
        capturesList: document.getElementById('captures-list'),
        detailsContent: document.getElementById('details-content'),
        detailsTitle: document.getElementById('details-title'),
        copyBtn: document.getElementById('copy-content'),
        refreshListBtn: document.getElementById('refresh-list'),
        status: document.getElementById('status')
    };

    const tabs = document.querySelectorAll('.tab');

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentTab = tab.dataset.tab;
            if (state.currentCapture) renderDetails(state.currentCapture);
        });
    });

    // Event handlers
    els.captureBtn.addEventListener('click', () => {
        const url = els.urlInput.value.trim();
        const mode = els.modeSelect.value;
        if (url) captureUrl(url, mode);
    });

    els.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const url = els.urlInput.value.trim();
            const mode = els.modeSelect.value;
            if (url) captureUrl(url, mode);
        }
    });

    els.refreshListBtn.addEventListener('click', loadCaptures);

    els.copyBtn.addEventListener('click', () => {
        const text = els.detailsContent.innerText;
        navigator.clipboard.writeText(text)
            .then(() => setStatus('success', 'Copied to clipboard'))
            .catch(() => setStatus('error', 'Failed to copy'));
    });

    // Terrain integration
    window.parent.postMessage({
        type: 'ready',
        from: 'capture',
        source: 'terrain'
    }, '*');

    loadCaptures();
}

// Start
init();
