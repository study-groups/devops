// ========================================
// GAMMA Cabinet JavaScript
// ========================================

// ========================================
// QUASAR AUDIO INIT (requires user gesture)
// ========================================
let quasarReady = false;
function initQuasar() {
  if (quasarReady) return;
  if (typeof QUASAR === 'undefined' || !QUASAR.init) {
    console.warn('[cabinet] QUASAR not loaded');
    return;
  }
  quasarReady = true; // prevent re-entry
  QUASAR.init().then((ok) => {
    if (ok) {
      QUASAR.resume();
      console.log('[cabinet] QUASAR audio ready');
    } else {
      console.warn('[cabinet] QUASAR init failed');
      quasarReady = false;
    }
  });
}
// Init on first user interaction (Web Audio API requirement)
document.addEventListener('click', () => initQuasar(), { once: true });
document.addEventListener('keydown', () => initQuasar(), { once: true });

// ========================================
// ANSI TO HTML CONVERTER
// ========================================
const ANSI_COLORS = {
  '30': '#000', '31': '#a00', '32': '#0a0', '33': '#a50',
  '34': '#00a', '35': '#a0a', '36': '#0aa', '37': '#aaa',
  '90': '#555', '91': '#f55', '92': '#5f5', '93': '#ff5',
  '94': '#55f', '95': '#f5f', '96': '#5ff', '97': '#fff',
  '40': '#000', '41': '#a00', '42': '#0a0', '43': '#a50',
  '44': '#00a', '45': '#a0a', '46': '#0aa', '47': '#aaa'
};

function ansiToHtml(text) {
  if (!text) return '';
  let html = '';
  let currentColor = null;
  let i = 0;

  while (i < text.length) {
    // Check for ANSI escape sequence
    if (text[i] === '\x1b' && text[i + 1] === '[') {
      // Find the end of the sequence
      let j = i + 2;
      while (j < text.length && text[j] !== 'm') j++;

      if (text[j] === 'm') {
        const codes = text.slice(i + 2, j).split(';');

        // Close previous span if open
        if (currentColor) {
          html += '</span>';
          currentColor = null;
        }

        // Process codes
        for (const code of codes) {
          if (code === '0' || code === '') {
            // Reset
            currentColor = null;
          } else if (ANSI_COLORS[code]) {
            // Foreground color (30-37, 90-97)
            if (parseInt(code) < 40 || parseInt(code) >= 90) {
              currentColor = ANSI_COLORS[code];
              html += `<span style="color:${currentColor}">`;
            }
          } else if (code === '1') {
            // Bold - brighten
            currentColor = currentColor || '#fff';
          } else if (code === '2') {
            // Dim
            currentColor = currentColor || '#666';
          }
        }

        i = j + 1;
        continue;
      }
    }

    // Escape HTML entities
    if (text[i] === '<') html += '&lt;';
    else if (text[i] === '>') html += '&gt;';
    else if (text[i] === '&') html += '&amp;';
    else html += text[i];

    i++;
  }

  // Close any open span
  if (currentColor) html += '</span>';

  return html;
}

// ========================================
// CABINET IDENTITY
// ========================================
const Cabinet = {
  init() {
    let data = localStorage.getItem('cabinet');
    if (data) {
      this.data = JSON.parse(data);
      this.data.visits++;
      this.data.lastSeen = Date.now();
    } else {
      this.data = {
        cid: 'cab_' + Math.random().toString(36).substr(2, 6),
        nick: 'Player' + Math.floor(Math.random() * 100),
        visits: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now()
      };
    }
    this.save();
    return this;
  },
  save() { localStorage.setItem('cabinet', JSON.stringify(this.data)); },
  setNick(nick) { this.data.nick = nick.substring(0, 12); this.save(); }
}.init();

// ========================================
// STATE
// ========================================
let ws = null;
let wsUrl = null;
let matchCode = null;
let matchExpires = null;
let timerInterval = null;
let mySlot = null;
let gameName = null;
let playerStates = { p1: 'none', p2: 'none', p3: 'none', p4: 'none' };

// Cabinet boot state machine
const CabinetState = {
  GAMMA_BOOT: 'gamma_boot',   // Showing GAMMA logo, waiting for code+START
  GAME_BOOT: 'game_boot',     // Showing game info, waiting for START
  IN_GAME: 'in_game'          // Normal gameplay
};
let cabinetState = CabinetState.GAMMA_BOOT;

// Game metadata (stored from welcome/join)
let gameMetadata = {
  name: null,
  geometry: { width: 60, height: 24 },
  engine: 'gamepak'
};

// ========================================
// DOM ELEMENTS
// ========================================
const matchCodeEl = document.getElementById('match-code');
const timeRemainingEl = document.getElementById('time-remaining');
const extendBtn = document.getElementById('extend-btn');
const gameNameEl = document.getElementById('game-name');
const consoleResetBtn = document.getElementById('console-reset-btn');
const gameResetBtn = document.getElementById('game-reset-btn');
const gameDisplayEl = document.getElementById('game-display');
const playBtn = document.getElementById('play-btn');
const dial = document.getElementById('dial');
const dialIndicator = document.getElementById('dial-indicator');
const codeInput = document.getElementById('code-input');
const connectBtn = document.getElementById('connect-btn');
const nickValueEl = document.getElementById('nick-value');
const connectionStatusEl = document.getElementById('connection-status');
const playerSlots = document.querySelectorAll('.player-slot');
const dpadBtns = document.querySelectorAll('.dpad-btn[data-dir]');
const actionBtns = document.querySelectorAll('.action-btn');

// ========================================
// TIMER
// ========================================
function updateTimer() {
  if (!matchExpires) {
    timeRemainingEl.textContent = '--:--';
    timeRemainingEl.className = '';
    return;
  }
  const remaining = Math.max(0, matchExpires - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  timeRemainingEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  if (remaining < 60000) {
    timeRemainingEl.className = 'critical';
  } else if (remaining < 120000) {
    timeRemainingEl.className = 'warning';
  } else {
    timeRemainingEl.className = '';
  }
}

function startTimer(expires) {
  matchExpires = expires;
  updateTimer();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
}

// ========================================
// PLAYER DECK
// ========================================
function updatePlayerSlot(slot, state, name) {
  const el = document.querySelector(`.player-slot[data-slot="${slot}"]`);
  if (!el) return;

  el.className = `player-slot ${state}`;
  const stateEl = el.querySelector('.player-state');

  // State display text
  const stateText = {
    'you': 'YOU',
    'human': name || 'HUMAN',
    'int': 'INT',
    'ext': 'EXT',
    'none': '---'
  };
  stateEl.textContent = stateText[state] || '---';

  playerStates[slot] = state;
}

// ========================================
// DIAL CONTROL
// ========================================
let dialAngle = 0; // -135 to +135 degrees
let dialStep = 15; // degrees per click

function updateDial(angle) {
  dialAngle = Math.max(-135, Math.min(135, angle));
  if (dialIndicator) {
    dialIndicator.style.transform = `translateX(-50%) rotate(${dialAngle}deg)`;
  }
}

function activateDial() {
  if (dial) dial.classList.add('active');
}

function deactivateDial() {
  if (dial) dial.classList.remove('active');
}

// F=CCW, H=CW, T=increase step, G=decrease step
function turnDialCCW() { updateDial(dialAngle - dialStep); }
function turnDialCW() { updateDial(dialAngle + dialStep); }
function increaseDialStep() { dialStep = Math.min(45, dialStep + 5); }
function decreaseDialStep() { dialStep = Math.max(5, dialStep - 5); }

function setDialKeyActive(key, active) {
  const el = document.querySelector(`.dial-key[data-key="${key}"]`);
  if (el) el.classList.toggle('active', active);
}

// Click cycles: NONE -> YOU -> INT -> EXT -> NONE
// HUMAN slots (other players) cannot be changed
function cyclePlayerState(slot) {
  const current = playerStates[slot];

  // Can't change another human's slot
  if (current === 'human') return;

  // Cycle order: none -> you -> int -> ext -> none
  const cycle = { 'none': 'you', 'you': 'int', 'int': 'ext', 'ext': 'none' };
  const next = cycle[current] || 'you';

  // Update local state immediately
  updatePlayerSlot(slot, next);

  // If connected, send appropriate message
  if (ws && ws.readyState === WebSocket.OPEN) {
    if (next === 'you') {
      // Take over this slot
      ws.send(JSON.stringify({
        t: 'player.claim',
        slot: slot,
        cid: Cabinet.data.cid,
        nick: Cabinet.data.nick
      }));
      mySlot = slot;
      activateDial();
    } else if (next === 'int' || next === 'ext') {
      // Set to AI mode
      ws.send(JSON.stringify({ t: 'player.ai', slot, mode: next }));
      if (current === 'you') {
        mySlot = null;
        deactivateDial();
      }
    } else {
      // Set to none (release slot)
      ws.send(JSON.stringify({ t: 'player.release', slot }));
      if (current === 'you') {
        mySlot = null;
        deactivateDial();
      }
    }
  } else {
    // Not connected - just update local UI
    if (next === 'you') {
      mySlot = slot;
      activateDial();
    } else if (current === 'you') {
      mySlot = null;
      deactivateDial();
    }
  }
}

// ========================================
// CONTROLS
// ========================================
function sendPlay() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: 'game.play' }));
  }
}

function sendReset() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: 'game.reset' }));
  }
}

async function extendMatch() {
  if (!matchCode) return;
  try {
    const resp = await fetch('/api/match/extend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: matchCode })
    });
    const result = await resp.json();
    if (result.ok && result.expires) {
      startTimer(result.expires);
    }
  } catch (e) {
    console.error('[cabinet] Extend failed:', e);
  }
}

function sendInput(key, pressed) {
  if (ws && ws.readyState === WebSocket.OPEN && mySlot) {
    ws.send(JSON.stringify({ t: 'input', key, pressed }));
  }
}

// ========================================
// CONNECTION
// ========================================
function updateConnectionStatus(status, isError = false) {
  connectionStatusEl.textContent = status;
  connectionStatusEl.className = isError ? 'error' : (status === 'CONNECTED' ? 'connected' : '');
}

function updateMatchCode(code) {
  matchCode = code;
  matchCodeEl.textContent = code || '----';
  matchCodeEl.classList.toggle('offline', !code);
}

async function joinByCode(code) {
  updateConnectionStatus('RESOLVING...');
  try {
    const resp = await fetch('/api/match/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase() })
    });

    if (!resp.ok) {
      updateConnectionStatus('NOT FOUND', true);
      return;
    }

    const data = await resp.json();
    if (data.error) {
      updateConnectionStatus(data.error, true);
      return;
    }

    if (data.host) {
      wsUrl = data.host.startsWith('ws://') ? data.host : `ws://${data.host}`;
      if (data.game) {
        gameName = data.game.toUpperCase();
        gameNameEl.textContent = gameName;
        gameMetadata.name = gameName;
      }
      // Store game metadata if provided
      if (data.geometry) {
        gameMetadata.geometry = data.geometry;
      }
      if (data.engine) {
        gameMetadata.engine = data.engine;
      }
      updateMatchCode(code.toUpperCase());

      // Get match info for timer
      try {
        const infoResp = await fetch(`/api/match/${code}`);
        if (infoResp.ok) {
          const info = await infoResp.json();
          if (info.expires) startTimer(info.expires);
        }
      } catch (e) {}

      connect();
    }
  } catch (e) {
    updateConnectionStatus('ERROR', true);
  }
}

function connect() {
  if (!wsUrl) return;
  if (ws) ws.close();

  updateConnectionStatus('CONNECTING...');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      t: 'identify',
      cid: Cabinet.data.cid,
      nick: Cabinet.data.nick,
      visits: Cabinet.data.visits,
      requestSlot: 'AUTO',
      takeover: false
    }));
  };

  ws.onmessage = (e) => {
    try {
      handleMessage(JSON.parse(e.data));
    } catch (err) {
      console.error('[cabinet] Message parse error:', err);
    }
  };

  ws.onclose = () => {
    mySlot = null;
    updateConnectionStatus('DISCONNECTED');
    deactivateDial();
    // Reset player states
    ['p1', 'p2', 'p3', 'p4'].forEach(s => updatePlayerSlot(s, 'none'));
  };

  ws.onerror = () => {
    updateConnectionStatus('ERROR', true);
  };
}

function handleMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      mySlot = msg.slot;
      updateConnectionStatus('CONNECTED');
      if (mySlot) activateDial();
      if (msg.game) {
        gameName = msg.game.toUpperCase();
        gameNameEl.textContent = gameName;
        gameMetadata.name = gameName;
      }
      // Store additional game metadata if provided
      if (msg.geometry) {
        gameMetadata.geometry = msg.geometry;
      }
      if (msg.engine) {
        gameMetadata.engine = msg.engine;
      }
      // Update player states from welcome
      if (msg.players) {
        msg.players.forEach(p => {
          const state = p.cid === Cabinet.data.cid ? 'you' : 'human';
          updatePlayerSlot(p.slot, state, p.nick);
        });
      }
      // Stay in GAMMA_BOOT - user must press START to see game boot screen
      break;

    case 'frame':
      // If we get frames while in boot states, transition to IN_GAME
      if (cabinetState === CabinetState.GAMMA_BOOT || cabinetState === CabinetState.GAME_BOOT) {
        cabinetState = CabinetState.IN_GAME;
        isPlaying = true;
        playBtn.textContent = '[PAUSE]';
      }
      if (msg.display) {
        gameDisplayEl.innerHTML = ansiToHtml(msg.display);
      }
      // Process sound via QUASAR
      if (msg.snd) {
        if (typeof QUASAR !== 'undefined' && QUASAR.processFrame) {
          QUASAR.processFrame(msg);
        }
        // Debug: log first snd frame and then every 100th
        if (!window._sndCount) window._sndCount = 0;
        if (window._sndCount === 0 || window._sndCount % 100 === 0) {
          console.log('[cabinet] snd frame #' + window._sndCount, JSON.stringify(msg.snd));
        }
        window._sndCount++;
      }
      // Update dial from game state
      if (msg.state && msg.state.paddles && mySlot) {
        const paddle = msg.state.paddles[mySlot];
        if (paddle) {
          // Convert offset to dial angle (-135 to +135)
          const angle = (paddle.offset / 0.63) * 135;
          updateDial(angle);
        }
      }
      break;

    case 'player.join':
      const joinState = msg.cid === Cabinet.data.cid ? 'you' : 'human';
      updatePlayerSlot(msg.slot, joinState, msg.nick);
      break;

    case 'player.leave':
      updatePlayerSlot(msg.slot, 'none');
      break;

    case 'slot.assigned':
      mySlot = msg.slot;
      updatePlayerSlot(msg.slot, 'you', Cabinet.data.nick);
      activateDial();
      break;
  }
}

// ========================================
// KEYBOARD INPUT
// ========================================
// Player 1: WASD, Player 2: IJKL, Dial: FTGH
const keyMap = {
  // Player 1
  'KeyW': { dir: 'up', player: 1 },
  'KeyS': { dir: 'down', player: 1 },
  'KeyA': { dir: 'left', player: 1 },
  'KeyD': { dir: 'right', player: 1 },
  // Player 2
  'KeyI': { dir: 'up', player: 2 },
  'KeyK': { dir: 'down', player: 2 },
  'KeyJ': { dir: 'left', player: 2 },
  'KeyL': { dir: 'right', player: 2 },
};

// Dial keys: F=CCW, H=CW, T=faster, G=slower
const dialKeyMap = {
  'KeyF': { action: 'ccw', key: 'f' },
  'KeyH': { action: 'cw', key: 'h' },
  'KeyT': { action: 'faster', key: 't' },
  'KeyG': { action: 'slower', key: 'g' },
};

// Direction -> game input key
const gameKeyMap = {
  'up': 'w', 'down': 's', 'left': 'a', 'right': 'd'
};

const activeKeys = new Set();

function setDpadBtnActive(dir, player, active) {
  const dpadId = player === 1 ? '#dpad-left' : '#dpad-right';
  const btn = document.querySelector(`${dpadId} .dpad-${dir}`);
  if (btn) btn.classList.toggle('active', active);
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (activeKeys.has(e.code)) return;

  // D-pad keys
  const mapping = keyMap[e.code];
  if (mapping) {
    activeKeys.add(e.code);
    setDpadBtnActive(mapping.dir, mapping.player, true);

    // Send game input
    const gameKey = gameKeyMap[mapping.dir];
    if (gameKey) sendInput(gameKey, true);

    // Turn dial on left/right (player 1 controls dial)
    if (mapping.player === 1) {
      if (mapping.dir === 'left') turnDialCCW();
      if (mapping.dir === 'right') turnDialCW();
    }

    e.preventDefault();
    return;
  }

  // Dial keys
  const dialMapping = dialKeyMap[e.code];
  if (dialMapping) {
    activeKeys.add(e.code);
    setDialKeyActive(dialMapping.key, true);

    if (dialMapping.action === 'ccw') turnDialCCW();
    if (dialMapping.action === 'cw') turnDialCW();
    if (dialMapping.action === 'faster') increaseDialStep();
    if (dialMapping.action === 'slower') decreaseDialStep();

    e.preventDefault();
  }
});

document.addEventListener('keyup', (e) => {
  if (!activeKeys.has(e.code)) return;

  const mapping = keyMap[e.code];
  if (mapping) {
    activeKeys.delete(e.code);
    setDpadBtnActive(mapping.dir, mapping.player, false);

    const gameKey = gameKeyMap[mapping.dir];
    if (gameKey) sendInput(gameKey, false);
    return;
  }

  const dialMapping = dialKeyMap[e.code];
  if (dialMapping) {
    activeKeys.delete(e.code);
    setDialKeyActive(dialMapping.key, false);
  }
});

// ========================================
// EVENT LISTENERS
// ========================================
let isPlaying = false;

playBtn.addEventListener('click', () => {
  // State-aware START button behavior
  if (cabinetState === CabinetState.GAMMA_BOOT) {
    // First START: transition to GAME_BOOT if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      cabinetState = CabinetState.GAME_BOOT;
      renderGameBootScreen();
    }
    return;
  }

  if (cabinetState === CabinetState.GAME_BOOT) {
    // Second START: begin gameplay
    cabinetState = CabinetState.IN_GAME;
    sendPlay();
    isPlaying = true;
    playBtn.textContent = '[PAUSE]';
    initQuasar();
    return;
  }

  // IN_GAME: toggle play/pause
  if (!isPlaying) {
    sendPlay();
    isPlaying = true;
    playBtn.textContent = '[PAUSE]';
  } else {
    // Send pause
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: 'game.pause' }));
    }
    isPlaying = false;
    playBtn.textContent = '[START]';
  }
});

gameResetBtn.addEventListener('click', () => {
  // Game reset - shows boot animation
  sendPlay();
  isPlaying = false;
  playBtn.textContent = '[START]';
});

consoleResetBtn.addEventListener('click', () => {
  // GAMMA console reset - full reset
  if (ws) ws.close();

  // Reset all state
  cabinetState = CabinetState.GAMMA_BOOT;
  isPlaying = false;
  matchCode = null;
  matchExpires = null;
  gameName = null;
  mySlot = null;
  gameMetadata = { name: null, geometry: { width: 60, height: 24 }, engine: 'gamepak' };

  // Reset UI
  playBtn.textContent = '[START]';
  updateMatchCode(null);
  gameNameEl.textContent = '---';
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timeRemainingEl.textContent = '--:--';
  timeRemainingEl.className = '';
  updateConnectionStatus('OFFLINE');
  ['p1', 'p2', 'p3', 'p4'].forEach(s => updatePlayerSlot(s, 'none'));
  deactivateDial();

  // Show GAMMA boot screen
  renderBootScreen();
});
extendBtn.addEventListener('click', extendMatch);

connectBtn.addEventListener('click', () => {
  const code = codeInput.value.trim();
  if (code.length === 4) {
    joinByCode(code);
  }
});

codeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const code = codeInput.value.trim();
    if (code.length === 4) {
      joinByCode(code);
    }
  }
});

// Player slot clicks - click to cycle through states
playerSlots.forEach(slot => {
  slot.addEventListener('click', () => {
    cyclePlayerState(slot.dataset.slot);
  });
});

// Nick editing
nickValueEl.textContent = Cabinet.data.nick;
nickValueEl.addEventListener('click', () => {
  const newNick = prompt('Enter nickname:', Cabinet.data.nick);
  if (newNick) {
    Cabinet.setNick(newNick);
    nickValueEl.textContent = Cabinet.data.nick;
  }
});

// ========================================
// AUTO-JOIN FROM URL
// ========================================
const pathMatch = location.pathname.match(/\/match\/([A-Z0-9]{4})\/?/i);
if (pathMatch) {
  const code = pathMatch[1].toUpperCase();
  codeInput.value = code;
  setTimeout(() => joinByCode(code), 100);
}

// ========================================
// BOOT SCREEN
// ========================================
function renderBootScreen() {
  const colors = ['#f0f', '#0ff', '#0f0', '#ff0', '#f80', '#f55'];
  const gammaArt = [
    '██████╗  █████╗ ███╗   ███╗███╗   ███╗ █████╗ ',
    '██╔════╝ ██╔══██╗████╗ ████║████╗ ████║██╔══██╗',
    '██║  ███╗███████║██╔████╔██║██╔████╔██║███████║',
    '██║   ██║██╔══██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║',
    '╚██████╔╝██║  ██║██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║',
    ' ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝'
  ];

  let html = '\n\n';

  // Color each line of GAMMA differently
  gammaArt.forEach((line, i) => {
    const color = colors[i % colors.length];
    html += `<span style="color:${color}">${line}</span>\n`;
  });

  html += '\n';
  html += '<span style="color:#0ff">A N S I</span>   <span style="color:#f0f">C A B I N E T</span>\n';
  html += '\n';
  html += '<span style="color:#888">Enter match code or wait for auto-connect...</span>\n';

  gameDisplayEl.innerHTML = html;
}

// Game boot screen - shows game info before starting
function renderGameBootScreen() {
  const name = gameMetadata.name || gameName || '???';
  const { width, height } = gameMetadata.geometry;
  const engine = gameMetadata.engine || 'gamepak';

  let html = '\n';
  html += '<span style="color:#0f0">══════════════════════════════════════════════════</span>\n';
  html += '\n';
  html += '<span style="color:#f0f">                     L O A D I N G</span>\n';
  html += '\n';
  html += '\n';
  html += `<span style="color:#0f0">    GAME:</span>     <span style="color:#fff">${name.toUpperCase()}</span>\n`;
  html += `<span style="color:#0f0">    SCREEN:</span>   <span style="color:#fff">${width} × ${height}</span>\n`;
  html += `<span style="color:#0f0">    ENGINE:</span>   <span style="color:#fff">${engine.toUpperCase()}</span>\n`;
  html += '\n';
  html += '\n';
  html += '<span style="color:#f0f">                 ▓ PRESS START ▓</span>\n';
  html += '\n';
  html += '<span style="color:#0f0">══════════════════════════════════════════════════</span>\n';

  gameDisplayEl.innerHTML = html;
}

// Always show boot screen on load (user presses START to proceed)
renderBootScreen();
