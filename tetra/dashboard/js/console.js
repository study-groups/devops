// Console Terminal - Configuration
const CONFIG = {
    theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#4ecdc4',
        cursorAccent: '#0a0a0a',
        selection: 'rgba(78, 205, 196, 0.3)'
    },
    font: {
        family: "'SF Mono', 'Monaco', 'Consolas', monospace",
        size: 13
    },
    socket: {
        transports: ['websocket', 'polling'],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
    },
    debounceMs: {
        resize: 100,
        envChange: 100
    }
};

// Consolidated state
const state = {
    socket: null,
    term: null,
    fitAddon: null,
    env: 'local',
    org: 'tetra',
    user: '',
    envCache: {},
    timeouts: {
        resize: null,
        envChange: null
    }
};

// Utility: debounce function
function debounce(fn, ms, timeoutKey) {
    return (...args) => {
        if (state.timeouts[timeoutKey]) {
            clearTimeout(state.timeouts[timeoutKey]);
        }
        state.timeouts[timeoutKey] = setTimeout(() => fn(...args), ms);
    };
}

// Get SSH target for an environment
async function getSshTarget(org, env) {
    if (env === 'local') return null;

    const cacheKey = `${org}:${env}`;
    if (state.envCache[cacheKey]) {
        return state.envCache[cacheKey];
    }

    try {
        const res = await fetch(`/api/environments?org=${encodeURIComponent(org)}`);
        const envs = await res.json();
        if (envs[env]?.ssh) {
            state.envCache[cacheKey] = envs[env].ssh;
            return envs[env].ssh;
        }
        if (envs[env]?.host) {
            const target = `root@${envs[env].host}`;
            state.envCache[cacheKey] = target;
            return target;
        }
    } catch (e) {
        console.error('[Console] Failed to fetch env config:', e);
    }
    return null;
}

// Switch to environment
async function switchEnv(org, env, user) {
    if (!state.socket?.connected) {
        console.log('[Console] Socket not connected, cannot switch env');
        return;
    }

    const sshTarget = await getSshTarget(org, env);

    state.term.clear();
    state.term.writeln(`\x1b[33m[Switching to ${org}:${env}${sshTarget ? ' (' + sshTarget + ')' : ''}]\x1b[0m`);

    state.socket.emit('env-change', { org, env, sshTarget });
}

// Emit current terminal size to server
function emitResize() {
    if (state.socket?.connected && state.term) {
        state.socket.emit('resize', { cols: state.term.cols, rows: state.term.rows });
    }
}

// Fit terminal and notify server (debounced for resize events)
function fitAndResize() {
    state.fitAddon.fit();
    emitResize();
}

const debouncedFitAndResize = debounce(fitAndResize, CONFIG.debounceMs.resize, 'resize');

// Debounced env switch for rapid clicks
const debouncedSwitchEnv = debounce(
    () => switchEnv(state.org, state.env, state.user),
    CONFIG.debounceMs.envChange,
    'envChange'
);

// Socket connection setup
function connect() {
    const serverUrl = window.location.origin || 'http://localhost:4444';

    state.socket = io(serverUrl, CONFIG.socket);

    state.socket.on('connect', () => {
        const transport = state.socket.io.engine.transport.name;
        console.log('[Console] Connected via:', transport);
        Terrain.Iframe.send({ type: 'status', connected: true, transport });

        // Emit initial size so server knows terminal dimensions
        emitResize();

        // Switch to initial env if not local
        if (state.env !== 'local') {
            switchEnv(state.org, state.env, state.user);
        }
    });

    state.socket.io.engine.on('upgrade', () => {
        console.log('[Console] Upgraded to:', state.socket.io.engine.transport.name);
    });

    state.socket.on('output', (data) => {
        state.term.write(data);
    });

    state.socket.on('session-ended', ({ key, exitCode, reason }) => {
        state.term.writeln(`\r\n\x1b[33m[Session ended: ${reason || 'exit ' + exitCode}]\x1b[0m`);
    });

    state.socket.on('disconnect', () => {
        state.term.writeln('\r\n\x1b[31m[Disconnected]\x1b[0m\r\n');
        Terrain.Iframe.send({ type: 'status', connected: false });
    });

    state.socket.on('connect_error', (err) => {
        state.term.writeln('\x1b[31m[Connection error: ' + err.message + ']\x1b[0m');
    });

    // Restore session on reconnect
    state.socket.on('reconnect', () => {
        console.log('[Console] Reconnected, restoring session');
        emitResize();
        if (state.env !== 'local') {
            switchEnv(state.org, state.env, state.user);
        }
    });

    // Send input to server
    state.term.onData((data) => {
        if (state.socket?.connected) {
            state.socket.emit('input', data);
        }
    });
}

// Initialize terminal
function initTerminal() {
    state.term = new Terminal({
        theme: CONFIG.theme,
        fontFamily: CONFIG.font.family,
        fontSize: CONFIG.font.size,
        cursorBlink: true
    });

    state.fitAddon = new FitAddon.FitAddon();
    state.term.loadAddon(state.fitAddon);

    const container = document.getElementById('terminal');
    state.term.open(container);
    state.fitAddon.fit();
}

// Parse URL params into state
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    state.env = urlParams.get('env') || 'local';
    state.org = urlParams.get('org') || 'tetra';
    state.user = urlParams.get('user') || '';
}

// Main initialization
function init() {
    initTerminal();
    parseUrlParams();

    // Debounced resize handler
    window.addEventListener('resize', debouncedFitAndResize);

    // Initialize iframe communication
    Terrain.Iframe.init({
        name: 'console',
        onMessage: async function(msg) {
            if (msg.type === 'env-change') {
                state.org = msg.org || state.org;
                state.env = msg.env || state.env;
                state.user = msg.user ?? state.user;
                debouncedSwitchEnv();
            }
        },
        onReady: function() {
            connect();
        }
    });
}

// Start
init();
