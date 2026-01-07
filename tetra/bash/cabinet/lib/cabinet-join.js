/**
 * Cabinet Join - ANSI game viewer client
 */

// ========================================
// LOCAL DEBUG CODES (bypass Gamma, all 4 chars)
// ========================================
const LOCAL_CODES = {
  'LOCL': { mode: 'local', players: 1, description: 'Single player, no network' },
  'DBUG': { mode: 'local', debug: true, description: 'Debug overlay enabled' },
  'SOLO': { mode: 'local', ai: true, description: 'Solo mode with AI opponents' },
  'TEST': { mode: 'local', test: true, description: 'Test mode, all features unlocked' },
  'DEVS': { mode: 'local', devMode: true, description: 'Developer mode, input capture toggle' }
};

// Current local mode state
let localMode = null;

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
        nick: '',
        visits: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        slots: []
      };
    }
    this.save();
    return this;
  },
  save() { localStorage.setItem('cabinet', JSON.stringify(this.data)); },
  setNick(nick) { this.data.nick = nick.substring(0, 12); this.save(); },
  recordSlot(slot) {
    if (!this.data.slots.includes(slot)) {
      this.data.slots.push(slot);
      this.save();
    }
  }
}.init();

// ========================================
// CONTROLDECK BRIDGE (BroadcastChannel)
// ========================================
const ControlDeckBridge = {
  enabled: false,
  stateChannel: null,
  gameChannel: null,
  inputChannel: null,
  gameInputChannel: null,

  init(gameType) {
    if (!window.BroadcastChannel) {
      console.log('[bridge] BroadcastChannel not supported');
      return this;
    }
    this.stateChannel = new BroadcastChannel('controldeck-game-state');
    this.inputChannel = new BroadcastChannel('controldeck-game-input');
    this.inputChannel.onmessage = (e) => this.handleAiOutput(e.data);
    if (gameType) this.setGame(gameType);
    this.enabled = true;
    console.log('[bridge] ControlDeck bridge enabled');
    return this;
  },

  setGame(gameType) {
    if (this.gameChannel) this.gameChannel.close();
    if (this.gameInputChannel) this.gameInputChannel.close();
    const stateName = `controldeck-${gameType.toLowerCase()}-state`;
    const inputName = `controldeck-${gameType.toLowerCase()}-input`;
    this.gameChannel = new BroadcastChannel(stateName);
    this.gameInputChannel = new BroadcastChannel(inputName);
    this.gameInputChannel.onmessage = (e) => this.handleAiOutput(e.data);
    console.log('[bridge] Game channels:', stateName, inputName);
  },

  broadcastState(state, gameName) {
    if (!this.enabled) return;
    const msg = { t: 'state', ts: Date.now(), game: gameName, state };
    if (this.stateChannel) this.stateChannel.postMessage(msg);
    if (this.gameChannel) this.gameChannel.postMessage(msg);
  },

  handleAiOutput(data) {
    if (!data || !data.axes) return;
    const slots = ['p1', 'p2', 'p3', 'p4'];
    for (let i = 0; i < Math.min(4, data.axes.length); i++) {
      const slot = slots[i];
      if (LocalAI.players[slot].mode !== 'external') continue;
      const axis = data.axes[i];
      if (Math.abs(axis) > 0.01) {
        sendInput({
          t: 'input',
          src: 'ai',
          slot: slot,
          axis: axis,
          key: axis > 0 ? 'cw' : 'ccw',
          val: Math.abs(axis),
          pressed: true
        });
      }
    }
  }
};

// ========================================
// LOCAL AI CONTROLLER
// ========================================
const LocalAI = {
  running: false,
  intervalId: null,
  state: {},
  TWO_PI: Math.PI * 2,
  MODES: ['off', 'internal', 'external'],
  selectedSlot: null,

  players: {
    p1: { mode: 'off', skill: 0.7 },
    p2: { mode: 'off', skill: 0.7 },
    p3: { mode: 'off', skill: 0.7 },
    p4: { mode: 'off', skill: 0.7 }
  },

  init() {
    this.load();
    ['p1', 'p2', 'p3', 'p4'].forEach(slot => this.updateButtonUI(slot));
    this.running = true;
    this.intervalId = setInterval(() => this.tick(), 33);
  },

  save() {
    localStorage.setItem('cabinet-ai', JSON.stringify(this.players));
  },

  load() {
    const saved = localStorage.getItem('cabinet-ai');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        for (const slot of ['p1', 'p2', 'p3', 'p4']) {
          if (data[slot]) {
            this.players[slot].mode = data[slot].mode || 'off';
            this.players[slot].skill = data[slot].skill ?? 0.7;
          }
        }
      } catch (e) {}
    }
  },

  cycleMode(slot) {
    const player = this.players[slot];
    const idx = this.MODES.indexOf(player.mode);
    player.mode = this.MODES[(idx + 1) % this.MODES.length];
    this.updateButtonUI(slot);
    this.selectPlayer(slot);
    this.save();
    return player.mode;
  },

  setSkill(slot, skill) {
    this.players[slot].skill = skill;
    this.save();
  },

  selectPlayer(slot) {
    this.selectedSlot = slot;
    const player = this.players[slot];
    const paramsEl = document.getElementById('ai-params');
    const slotEl = document.getElementById('param-slot');
    const modeEl = document.getElementById('param-mode');
    const skillEl = document.getElementById('ai-skill');
    const skillValEl = document.getElementById('ai-skill-val');

    if (player.mode === 'off') {
      paramsEl.classList.remove('visible');
    } else {
      paramsEl.classList.add('visible');
      slotEl.textContent = slot.toUpperCase();
      modeEl.textContent = player.mode.charAt(0).toUpperCase() + player.mode.slice(1);
      modeEl.className = 'param-mode ' + player.mode;
      skillEl.value = player.skill;
      skillValEl.textContent = player.skill.toFixed(1);
    }
  },

  updateButtonUI(slot) {
    const btn = document.getElementById(`ai-${slot}`);
    const player = this.players[slot];
    btn.classList.remove('off', 'internal', 'external');
    btn.classList.add(player.mode);
  },

  updateState(newState) {
    this.state = newState;
  },

  hasActiveAI() {
    return Object.values(this.players).some(p => p.mode !== 'off');
  },

  tick() {
    const state = this.state;
    if (!state.ball || !state.paddles || state.gameOver) return;

    const axes = [0, 0, 0, 0];
    const slots = ['p1', 'p2', 'p3', 'p4'];
    const HALF_PI = Math.PI / 2;

    const angleDiff = (a, b) => {
      let diff = a - b;
      while (diff > Math.PI) diff -= this.TWO_PI;
      while (diff < -Math.PI) diff += this.TWO_PI;
      return diff;
    };

    const predictIntersection = (slot, skill) => {
      const paddle = state.paddles[slot];
      if (!paddle) return null;
      const ball = state.ball;
      const bx = ball.x || ball.r * Math.cos(ball.theta);
      const by = ball.y || ball.r * Math.sin(ball.theta);
      const vx = ball.vr * Math.cos(ball.theta) - ball.r * (ball.vtheta || 0) * Math.sin(ball.theta);
      const vy = ball.vr * Math.sin(ball.theta) + ball.r * (ball.vtheta || 0) * Math.cos(ball.theta);

      for (let t = 1; t <= 40; t++) {
        const px = bx + vx * t * 1.5;
        const py = by + vy * t * 1.5;
        const pr = Math.sqrt(px * px + py * py);
        let pTheta = Math.atan2(py, px);
        if (pTheta < 0) pTheta += this.TWO_PI;
        if (Math.abs(angleDiff(pTheta, paddle.angle)) < HALF_PI / 2 && pr >= 0.7) {
          return pTheta + (Math.random() - 0.5) * 0.2 * (1 - skill);
        }
      }
      return paddle.angle;
    };

    for (let i = 0; i < 4; i++) {
      const slot = slots[i];
      const player = this.players[slot];
      if (player.mode !== 'internal') continue;

      const paddle = state.paddles[slot];
      if (!paddle) continue;

      const targetAngle = predictIntersection(slot, player.skill);
      if (targetAngle === null) continue;

      let desiredOffset = angleDiff(targetAngle, paddle.angle);
      const maxOffset = Math.PI / 5;
      desiredOffset = Math.max(-maxOffset, Math.min(maxOffset, desiredOffset));

      const currentOffset = paddle.offset || 0;
      const diff = desiredOffset - currentOffset;
      const threshold = 0.05 * (1 - player.skill);

      if (Math.abs(diff) > threshold) {
        axes[i] = Math.sign(diff) * Math.min(1, Math.abs(diff) * 3) * player.skill;
      }

      const btn = document.getElementById(`ai-${slot}`);
      if (btn && Math.abs(axes[i]) > 0.1) {
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 100);
      }
    }

    for (let i = 0; i < 4; i++) {
      if (this.players[slots[i]].mode === 'internal' && Math.abs(axes[i]) > 0.01) {
        sendInput({
          t: 'input', src: 'ai', slot: slots[i],
          axis: axes[i], key: axes[i] > 0 ? 'cw' : 'ccw',
          val: Math.abs(axes[i]), pressed: true
        });
      }
    }
  }
};

// ========================================
// GAMMA DETECTION
// ========================================
const Gamma = {
  available: false,
  async detect() {
    try {
      const resp = await fetch('/api/status', {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      this.available = resp.ok;
    } catch (e) {
      this.available = false;
    }
    return this.available;
  }
};

// ========================================
// ANSI PARSER
// ========================================
const ANSI = {
  colors: {
    30: '#000', 31: '#a00', 32: '#0a0', 33: '#a50',
    34: '#00a', 35: '#a0a', 36: '#0aa', 37: '#aaa',
    90: '#555', 91: '#f55', 92: '#5f5', 93: '#ff5',
    94: '#55f', 95: '#f5f', 96: '#5ff', 97: '#fff'
  },
  toHtml(text) {
    if (!text) return '';
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/\x1b\[([0-9;]+)m/g, (match, codes) => {
      const parts = codes.split(';');
      let style = [], close = false;
      for (const code of parts) {
        const n = parseInt(code);
        if (n === 0) close = true;
        else if (n === 1) style.push('font-weight:bold');
        else if ((n >= 30 && n <= 37) || (n >= 90 && n <= 97))
          style.push('color:' + (this.colors[n] || '#fff'));
        else if (n >= 40 && n <= 47)
          style.push('background:' + (this.colors[n - 10] || '#000'));
      }
      if (close) return '</span>';
      if (style.length) return '<span style="' + style.join(';') + '">';
      return '';
    });
    return html;
  }
};

// ========================================
// STUN FINGERPRINTING
// ========================================
const stunFingerprint = new STUNFingerprint({
  enabled: CabinetConfig.flags.stun
});

// ========================================
// STATE
// ========================================
let ws = null;
let slot = null;
let gameName = null;
let matchCode = null;
let matchExpires = null;
let timerInterval = null;
let wsUrl = null;

const displayEl = document.getElementById('game-display');
const gameNameEl = document.getElementById('game-name');
const slotDisplayEl = document.getElementById('slot-display');
const playersDisplayEl = document.getElementById('players-display');
const timeRemainingEl = document.getElementById('time-remaining');
const joinTargetEl = document.getElementById('join-target');
const slotSelectEl = document.getElementById('slot-select');
const nickInputEl = document.getElementById('nick-input');
const joinBtn = document.getElementById('join-btn');
const takeoverBtn = document.getElementById('takeover-btn');
const resetBtn = document.getElementById('reset-btn');
const extendBtn = document.getElementById('extend-btn');
const playBtn = document.getElementById('play-btn');

// ========================================
// TIMER
// ========================================
function formatTime(ms) {
  if (ms <= 0) return '00:00';
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  return `${mins.toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
}

function updateTimer() {
  if (!matchExpires) {
    timeRemainingEl.textContent = '--:--';
    timeRemainingEl.className = 'hw-value';
    return;
  }
  const remaining = matchExpires - Date.now();
  timeRemainingEl.textContent = formatTime(remaining);
  if (remaining <= 0) {
    timeRemainingEl.className = 'hw-value critical';
  } else if (remaining < 60000) {
    timeRemainingEl.className = 'hw-value critical';
  } else if (remaining < 180000) {
    timeRemainingEl.className = 'hw-value warning';
  } else {
    timeRemainingEl.className = 'hw-value';
  }
}

function startTimer(expires) {
  matchExpires = expires;
  updateTimer();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  matchExpires = null;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  updateTimer();
}

// ========================================
// CONTROLS
// ========================================
function sendPlay() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: 'game.play' }));
    if (playBtn) playBtn.disabled = true;
  }
}

async function extendMatch() {
  if (!matchCode || !Gamma.available) return;
  try {
    const resp = await fetch(`/api/match/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: matchCode })
    });
    const result = await resp.json();
    if (result.ok) {
      matchExpires = result.expires;
      updateTimer();
    }
  } catch (e) {
    console.error('[cabinet] Failed to extend:', e);
  }
}

function sendReset() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: 'game.reset' }));
  }
}

function sendTakeover() {
  const requestSlot = slotSelectEl.value;
  if (!requestSlot || !ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    t: 'identify',
    cid: Cabinet.data.cid,
    nick: Cabinet.data.nick || undefined,
    visits: Cabinet.data.visits,
    requestSlot: requestSlot,
    takeover: true
  }));
}

// ========================================
// CONNECTION
// ========================================
function updateSlotDisplay() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    slotDisplayEl.textContent = 'OFFLINE';
    slotDisplayEl.style.color = '#666';
  } else if (slot) {
    const label = slot === 'spectator' ? 'SPECTATOR' : slot.toUpperCase();
    slotDisplayEl.textContent = label + (matchCode ? ` [${matchCode}]` : '');
    slotDisplayEl.style.color = slot === 'spectator' ? '#666' : '#0ff';
  }
}

function updatePlayersDisplay(players) {
  if (!players || players.length === 0) {
    playersDisplayEl.textContent = '';
    return;
  }
  playersDisplayEl.innerHTML = players.map(p => {
    const isMe = p.cid === Cabinet.data.cid;
    const color = isMe ? '#0ff' : '#050';
    const name = p.nick || p.cid?.substring(0, 6) || 'anon';
    return `<span style="color:${color}">${p.slot.toUpperCase()}:${name}</span>`;
  }).join(' ');
}

function updateGameName(name) {
  gameName = name;
  gameNameEl.textContent = name || '---';
  document.title = name ? `${name} | ANSI Cabinet` : 'ANSI Cabinet';
  if (name && ControlDeckBridge.enabled) {
    ControlDeckBridge.setGame(name);
  }
}

async function smartJoin() {
  const input = joinTargetEl.value.trim();
  if (!input) return;

  const code = input.toUpperCase();

  // Check for local debug codes (LOCL, DBUG, SOLO, TEST, DEVS)
  if (LOCAL_CODES[code]) {
    localMode = LOCAL_CODES[code];
    wsUrl = `ws://${location.host}/ws`;
    updateGameName(code);
    console.log(`[cabinet] Local mode: ${code} - ${localMode.description}`);

    // Enable developer mode UI if DEVS
    if (localMode.devMode) {
      enableDevModeUI();
    }

    connect();
    return;
  }

  // Also accept 'LOCAL' as alias for 'LOCL'
  if (code === 'LOCAL') {
    localMode = LOCAL_CODES['LOCL'];
    wsUrl = `ws://${location.host}/ws`;
    updateGameName('LOCL');
    connect();
    return;
  }

  if (input.startsWith('ws://') || input.startsWith('wss://')) {
    wsUrl = input;
    connect();
  } else if (input.includes(':') && /:\d+$/.test(input)) {
    wsUrl = `ws://${input}`;
    connect();
  } else {
    await joinByCode(code);
  }
}

// Enable developer mode UI toggle
function enableDevModeUI() {
  let devToggle = document.getElementById('dev-mode-toggle');
  if (!devToggle) {
    devToggle = document.createElement('button');
    devToggle.id = 'dev-mode-toggle';
    devToggle.className = 'dev-toggle';
    devToggle.textContent = 'Input: iframe';
    devToggle.onclick = toggleInputCapture;
    document.body.appendChild(devToggle);
  }
  devToggle.style.display = 'block';
}

// Toggle input capture mode (iframe vs parent)
let inputCaptureMode = 'iframe';
function toggleInputCapture() {
  inputCaptureMode = inputCaptureMode === 'iframe' ? 'parent' : 'iframe';
  const toggle = document.getElementById('dev-mode-toggle');
  if (toggle) toggle.textContent = `Input: ${inputCaptureMode}`;
  console.log(`[cabinet] Input capture: ${inputCaptureMode}`);
}

async function joinByCode(code) {
  if (!Gamma.available) {
    slotDisplayEl.textContent = 'NO GAMMA';
    return;
  }

  matchCode = code;
  slotDisplayEl.textContent = 'RESOLVING...';

  try {
    const resp = await fetch(`/api/match/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!resp.ok) {
      slotDisplayEl.textContent = 'NOT FOUND';
      return;
    }

    const data = await resp.json();
    if (data.host) {
      wsUrl = data.host.startsWith('ws://') ? data.host : `ws://${data.host}`;
      if (data.game) updateGameName(data.game.toUpperCase());

      try {
        const matchResp = await fetch(`/api/match/${code}`);
        if (matchResp.ok) {
          const info = await matchResp.json();
          if (info.expires) startTimer(info.expires);
        }
      } catch (e) {}

      connect();
    }
  } catch (e) {
    slotDisplayEl.textContent = 'ERROR';
  }
}

function connect() {
  if (!wsUrl) return;
  if (ws) ws.close();

  slotDisplayEl.textContent = 'CONNECTING...';
  ws = new WebSocket(wsUrl);

  ws.onopen = async () => {
    const nickVal = nickInputEl.value.trim();
    if (nickVal) Cabinet.setNick(nickVal);

    const stunInfo = await stunFingerprint.getPublicAddress();

    const requestSlot = slotSelectEl.value;
    ws.send(JSON.stringify({
      t: 'identify',
      cid: Cabinet.data.cid,
      nick: Cabinet.data.nick || undefined,
      visits: Cabinet.data.visits,
      requestSlot: requestSlot,
      takeover: ['p1', 'p2', 'p3', 'p4'].includes(requestSlot),
      stun: stunInfo
    }));
  };

  ws.onmessage = (e) => {
    try {
      handleMessage(JSON.parse(e.data));
    } catch (err) {}
  };

  ws.onclose = () => {
    slot = null;
    updateSlotDisplay();
    updatePlayersDisplay([]);
    stopTimer();
    takeoverBtn.disabled = true;
  };

  ws.onerror = () => {
    slotDisplayEl.textContent = 'ERROR';
  };
}

function handleMessage(data) {
  if (data.t === 'welcome') {
    slot = data.slot;
    Cabinet.recordSlot(slot);
    updateSlotDisplay();
    if (data.game) updateGameName(data.game.toUpperCase());
    if (data.players) updatePlayersDisplay(data.players);
    takeoverBtn.disabled = false;
  } else if (data.t === 'players') {
    updatePlayersDisplay(data.players || []);
  } else if (data.t === 'takeover') {
    if (data.oldCid === Cabinet.data.cid) {
      slot = 'spectator';
      updateSlotDisplay();
    }
  } else if (data.t === 'frame') {
    displayEl.innerHTML = ANSI.toHtml(data.display || '');
    if (data.game && !gameName) updateGameName(data.game.toUpperCase());
    if (data.state && ControlDeckBridge.enabled) {
      ControlDeckBridge.broadcastState(data.state, gameName);
    }
    if (data.state) {
      LocalAI.updateState(data.state);
      // Enable PLAY button when game is waiting for start
      if (playBtn) {
        playBtn.disabled = !data.state.waitingForStart;
      }
    }
  }
}

// ========================================
// INPUT
// ========================================
function sendInput(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  sendInput({ t: 'input', src: 'keyboard', key: e.key, ctrl: e.code, val: 1, pressed: true });
});

document.addEventListener('keyup', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  sendInput({ t: 'input', src: 'keyboard', key: e.key, ctrl: e.code, val: 0, pressed: false });
});

// Gamepad
let gamepadPollId = null;
const lastGamepadState = {};

function pollGamepads() {
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;
    const last = lastGamepadState[gp.index] || { axes: [], buttons: [] };

    for (let i = 0; i < gp.axes.length; i++) {
      const val = gp.axes[i];
      if (Math.abs(val - (last.axes[i] || 0)) > 0.01) {
        const ctrl = ['left-x', 'left-y', 'right-x', 'right-y'][i] || `axis-${i}`;
        sendInput({ t: 'input', src: 'gamepad', ctrl, val });
      }
      last.axes[i] = val;
    }

    for (let i = 0; i < gp.buttons.length; i++) {
      const btn = gp.buttons[i];
      const wasPressed = last.buttons[i] || false;
      if (btn.pressed !== wasPressed) {
        const ctrl = ['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2',
          'select', 'start', 'l3', 'r3',
          'dpad-up', 'dpad-down', 'dpad-left', 'dpad-right', 'home'][i] || `button-${i}`;
        sendInput({ t: 'input', src: 'gamepad', ctrl, val: btn.pressed ? 1 : 0, pressed: btn.pressed });
      }
      last.buttons[i] = btn.pressed;
    }
    lastGamepadState[gp.index] = last;
  }
  gamepadPollId = requestAnimationFrame(pollGamepads);
}

window.addEventListener('gamepadconnected', () => {
  if (!gamepadPollId) pollGamepads();
});

// ========================================
// EVENT BINDINGS
// ========================================
joinBtn.addEventListener('click', smartJoin);
joinTargetEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') smartJoin(); });
resetBtn.addEventListener('click', sendReset);
extendBtn.addEventListener('click', extendMatch);
takeoverBtn.addEventListener('click', sendTakeover);
if (playBtn) playBtn.addEventListener('click', sendPlay);

slotSelectEl.addEventListener('change', () => {
  const val = slotSelectEl.value;
  takeoverBtn.disabled = !val || !ws || ws.readyState !== WebSocket.OPEN;
});

['p1', 'p2', 'p3', 'p4'].forEach(slot => {
  document.getElementById(`ai-${slot}`).addEventListener('click', () => {
    LocalAI.cycleMode(slot);
  });
});

document.getElementById('ai-skill').addEventListener('input', (e) => {
  const skill = parseFloat(e.target.value);
  document.getElementById('ai-skill-val').textContent = skill.toFixed(1);
  if (LocalAI.selectedSlot) {
    LocalAI.setSkill(LocalAI.selectedSlot, skill);
  }
});

// ========================================
// INIT
// ========================================
async function init() {
  ControlDeckBridge.init();
  LocalAI.init();
  await Gamma.detect();

  if (Cabinet.data.nick) {
    nickInputEl.value = Cabinet.data.nick;
  }

  const params = new URLSearchParams(location.search);
  const game = params.get('game');
  const code = params.get('code');

  // Handle ?game=X parameter
  if (game) {
    updateGameName(game.toUpperCase());
    ControlDeckBridge.setGame(game);
  }

  if (params.has('host')) {
    const host = params.get('host');
    joinTargetEl.value = host;
    wsUrl = host.startsWith('ws://') ? host : `ws://${host}`;
    setTimeout(connect, 100);
  } else if (code) {
    // Check if code is a local debug code
    const upperCode = code.toUpperCase();
    if (LOCAL_CODES[upperCode] || upperCode === 'LOCAL') {
      joinTargetEl.value = upperCode;
      setTimeout(smartJoin, 100);
    } else {
      // Gamma match code
      joinTargetEl.value = upperCode;
      setTimeout(() => joinByCode(upperCode), 100);
    }
  } else if (game) {
    // ?game=X without code → auto-LOCL
    console.log(`[cabinet] Auto-LOCAL mode for game: ${game}`);
    localMode = LOCAL_CODES['LOCL'];
    joinTargetEl.value = 'LOCL';
    wsUrl = `ws://${location.host}/ws`;
    setTimeout(connect, 100);
  } else {
    // Check URL path for match code
    const pathMatch = location.pathname.match(/\/match\/([A-Z0-9]+)/i);
    if (pathMatch) {
      const pathCode = pathMatch[1].toUpperCase();
      joinTargetEl.value = pathCode;
    }
  }
}

init();
