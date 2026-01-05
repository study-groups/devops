// Developer Panel - Configuration
const CONFIG = {
    maxMessages: 100,
    panelColors: {
        console: '#4ecdc4',
        tsm: '#ffe66d',
        deploy: '#ff6b6b',
        logs: '#6b5ce7',
        caddy: '#ff9f43',
        developer: '#a29bfe',
        parent: '#dfe6e9'
    }
};

// Consolidated state
const state = {
    messages: [],
    paused: false
};

// DOM elements
let els = {};

function formatTime(date) {
    return date.toTimeString().slice(0, 8);
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function getNodeColor(nodeName) {
    return CONFIG.panelColors[nodeName] || '#666';
}

function addMessage(msg) {
    if (state.paused) return;

    const entry = {
        time: new Date(),
        type: msg.type || 'unknown',
        from: msg._from || msg.source || msg.from || '?',
        to: msg._to || 'parent',
        via: msg._via || null,
        payload: msg
    };

    state.messages.unshift(entry);
    if (state.messages.length > CONFIG.maxMessages) {
        state.messages.pop();
    }

    renderMessages();
    flashArrow(entry);
}

function flashArrow(entry) {
    const from = (entry.from === 'terrain' ? 'parent' : entry.from).toLowerCase();
    const to = (entry.to === 'terrain' ? 'parent' : entry.to).toLowerCase();
    const via = entry.via ? entry.via.toLowerCase() : null;

    console.log(`[Dev] flashArrow: ${from} → ${to}` + (via ? ` via ${via}` : ''));

    if (via === 'parent' && from !== 'parent' && to !== 'parent') {
        flashSingleArrow(from, 'parent', from);
        setTimeout(() => {
            flashSingleArrow('parent', to, from);
        }, 100);
    } else {
        flashSingleArrow(from, to, from);
    }

    highlightNode(from);
    highlightNode(to);
    if (via) highlightNode(via);
}

function flashSingleArrow(from, to, colorSource) {
    const arrowId = `arrow-${from}-${to}`;
    const arrow = document.getElementById(arrowId);

    if (arrow) {
        arrow.setAttribute('marker-end', `url(#arrow-${colorSource})`);
        arrow.style.stroke = getNodeColor(colorSource);
        arrow.classList.add('active');

        setTimeout(() => {
            arrow.classList.remove('active');
        }, 500);
    } else {
        console.log(`[Dev] Arrow not found: ${arrowId}`);
    }
}

function highlightNode(nodeName) {
    const node = document.getElementById(`node-${nodeName}`);
    if (node) {
        node.classList.add('active');
        setTimeout(() => node.classList.remove('active'), 800);
    }
}

function renderMessages() {
    if (state.messages.length === 0) {
        els.messages.innerHTML = '<div class="empty">(waiting for messages...)</div>';
        return;
    }

    els.messages.innerHTML = state.messages.map((m, i) => {
        const from = m.from === 'terrain' ? 'parent' : m.from;
        const to = m.to === 'terrain' ? 'parent' : m.to;
        const fromColor = CONFIG.panelColors[from.toLowerCase()] || '#666';
        const toColor = CONFIG.panelColors[to.toLowerCase()] || '#666';
        const payloadStr = JSON.stringify(m.payload, null, 2);
        const via = m.via ? ` <span style="color:#666">via</span> <span style="color:${CONFIG.panelColors[m.via] || '#666'}">${m.via}</span>` : '';
        return `
            <div class="msg-line${i === 0 ? ' new' : ''}" data-action="toggle-payload" data-index="${i}">
                <span class="msg-time">${formatTime(m.time)}</span>
                <span class="msg-type ${m.type}">${m.type}</span>
                <span class="msg-route">[<span style="color:${fromColor}">${from}</span> &rarr; <span style="color:${toColor}">${to}</span>${via}]</span>
            </div>
            <div class="msg-payload">${escapeHtml(payloadStr)}</div>
        `;
    }).join('');
}

function togglePayload(el) {
    el.classList.toggle('expanded');
}

function toggleExample(id) {
    document.getElementById(id).classList.toggle('open');
}

function copyCode(id) {
    const codeEl = document.getElementById(id);
    const btn = codeEl.querySelector('.copy-btn');
    const text = codeEl.textContent.replace('Copy', '').trim();

    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
        }, 1500);
    });
}

function init() {
    els = {
        messages: document.getElementById('messages'),
        pauseBtn: document.getElementById('pause-btn'),
        clearBtn: document.getElementById('clear-btn')
    };

    // Register DOM actions
    Terrain.Iframe.on('toggle-payload', (el) => togglePayload(el));
    Terrain.Iframe.on('toggle-example', (el, data) => toggleExample(data.id));
    Terrain.Iframe.on('copy-code', (el, data) => copyCode(data.id));
    Terrain.Iframe.on('pause', () => {
        state.paused = !state.paused;
        els.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
        els.pauseBtn.classList.toggle('active', state.paused);
    });
    Terrain.Iframe.on('clear', () => {
        state.messages = [];
        renderMessages();
    });

    // Subscribe to ALL messages via Bus for visualization
    Terrain.Bus.subscribe('*', (msg) => {
        if (!msg || typeof msg !== 'object') return;
        console.log('[Dev] Received message:', msg.type, msg);
        addMessage(msg);
    });

    // Initialize Terrain.Iframe (for ready notification)
    Terrain.Iframe.init({ name: 'developer' });

    // Initial render
    renderMessages();
}

// Start
init();
