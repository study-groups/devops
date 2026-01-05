// Playwright Panel - Configuration
const CONFIG = {
    org: new URLSearchParams(window.location.search).get('org') || 'tetra'
};

// Consolidated state
const state = {
    currentCapture: null
};

// DOM elements
let els = {};

async function captureUrl(url, extractDom = true) {
    setStatus('capturing', 'Capturing...');
    els.captureBtn.disabled = true;

    try {
        const res = await fetch('/api/playwright/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, org: CONFIG.org, extractDom })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            setStatus('success', `Captured: ${data.screenshotPath}`);
            loadCaptures();

            const id = data.screenshotPath.split('/').pop().replace('.png', '');
            loadCapture(id);
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
        const res = await fetch(`/api/playwright/list?org=${CONFIG.org}`);
        if (!res.ok) throw new Error('Failed to load');

        const captures = await res.json();
        renderCapturesList(captures);
    } catch (e) {
        console.error('[Playwright] Failed to load captures:', e);
    }
}

async function loadCapture(id) {
    state.currentCapture = id;
    els.captureId.textContent = id;

    els.preview.innerHTML = `<img src="/api/playwright/screenshot/${CONFIG.org}/${id}" alt="Screenshot">`;

    try {
        const res = await fetch(`/api/playwright/combined/${CONFIG.org}/${id}`);
        if (res.ok) {
            const data = await res.json();
            els.domContent.textContent = data.textContent || 'No text content';
        }
    } catch (e) {
        els.domContent.textContent = 'Failed to load DOM content';
    }

    document.querySelectorAll('.capture-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === id);
    });
}

function renderCapturesList(captures) {
    if (!captures.length) {
        els.capturesList.innerHTML = '<div class="capture-item"><div class="url">No captures yet</div></div>';
        return;
    }

    els.capturesList.innerHTML = captures.map(c => `
        <div class="capture-item" data-action="load-capture" data-id="${c.id}">
            <div class="url">${c.url}</div>
            <div class="meta">${new Date(c.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}

function setStatus(type, message) {
    els.status.className = 'status ' + type;
    els.status.textContent = message;
}

function init() {
    els = {
        urlInput: document.getElementById('url-input'),
        captureBtn: document.getElementById('capture-btn'),
        domOnlyBtn: document.getElementById('dom-only-btn'),
        preview: document.getElementById('preview'),
        captureId: document.getElementById('capture-id'),
        capturesList: document.getElementById('captures-list'),
        domContent: document.getElementById('dom-content'),
        copyDomBtn: document.getElementById('copy-dom'),
        refreshListBtn: document.getElementById('refresh-list'),
        status: document.getElementById('status')
    };

    // Register actions
    Terrain.Iframe.on('capture', () => {
        const url = els.urlInput.value.trim();
        if (url) captureUrl(url, true);
    });

    Terrain.Iframe.on('capture-dom-only', () => {
        const url = els.urlInput.value.trim();
        if (url) captureUrl(url, false);
    });

    Terrain.Iframe.on('load-capture', (el, data) => loadCapture(data.id));
    Terrain.Iframe.on('refresh', () => loadCaptures());
    Terrain.Iframe.on('copy-dom', () => {
        navigator.clipboard.writeText(els.domContent.textContent)
            .then(() => setStatus('success', 'Copied to clipboard'))
            .catch(() => setStatus('error', 'Failed to copy'));
    });

    // Enter key handler for URL input
    els.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const url = els.urlInput.value.trim();
            if (url) captureUrl(url, true);
        }
    });

    // Notify parent we're ready
    Terrain.Iframe.send({ type: 'ready', from: 'playwright' });

    // Load initial captures
    loadCaptures();
}

// Start
init();
