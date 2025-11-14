/**
 * Cymatica Browser Client
 * WebGL-based cymatics visualization with WebSocket control
 */

// WebSocket connection
let ws = null;
let reconnectTimer = null;

// Canvas and WebGL context
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

// Cymatics parameters
const params = {
  frequency: 440,
  amplitude: 0.5,
  pattern: 0,
  particle_density: 5000,
  damping: 0.5,
  phase: 0,
  resonance: 0.5,
  waveform: 0
};

// Particle system
let particles = [];
let particleBuffer = null;

// Animation
let lastFrame = 0;
let frameCount = 0;
let fpsInterval = null;

// Waveform names
const waveformNames = ['Sine', 'Square', 'Sawtooth', 'Triangle', 'Noise'];

/**
 * Initialize WebSocket connection
 */
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;

  console.log('Connecting to:', wsUrl);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateStatus(true);

    // Request initial state
    ws.send(JSON.stringify({ type: 'ping' }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (err) {
      console.error('Invalid message:', err);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateStatus(false);

    // Attempt reconnection
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initWebSocket();
      }, 2000);
    }
  };
}

/**
 * Handle messages from server
 */
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'state':
      // Initial state received
      Object.assign(params, msg.data);
      updateAllControls();
      break;

    case 'parameter':
      // Parameter update from MIDI
      const { parameter, value } = msg.data;
      params[parameter] = value;
      updateControl(parameter, value);
      break;

    case 'pong':
      // Heartbeat response
      break;

    default:
      console.log('Unknown message type:', msg.type);
  }
}

/**
 * Send control message to server
 */
function sendControl(parameter, value) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'control',
      data: { parameter, value }
    }));
  }
}

/**
 * Load preset
 */
function loadPreset(presetId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'preset',
      data: { presetId }
    }));
  }
}

/**
 * Update WebSocket status indicator
 */
function updateStatus(connected) {
  const indicator = document.getElementById('ws-indicator');
  const status = document.getElementById('ws-status');

  if (connected) {
    indicator.className = 'status-indicator connected';
    status.textContent = 'Connected';
  } else {
    indicator.className = 'status-indicator disconnected';
    status.textContent = 'Disconnected';
  }
}

/**
 * Update single control UI
 */
function updateControl(parameter, value) {
  const input = document.getElementById(parameter);
  const valueDisplay = document.getElementById(`${parameter.replace('_', '-')}-value`);

  if (input) {
    input.value = value;
  }

  if (valueDisplay) {
    let displayValue;
    switch (parameter) {
      case 'frequency':
        displayValue = `${Math.round(value)} Hz`;
        break;
      case 'particle_density':
        displayValue = Math.round(value);
        break;
      case 'phase':
        displayValue = `${value.toFixed(2)} rad`;
        break;
      case 'waveform':
        displayValue = waveformNames[Math.floor(value)] || 'Sine';
        break;
      default:
        displayValue = value.toFixed(2);
    }
    valueDisplay.textContent = displayValue;
  }
}

/**
 * Update all controls from current params
 */
function updateAllControls() {
  Object.keys(params).forEach(param => {
    updateControl(param, params[param]);
  });
}

/**
 * Initialize control event listeners
 */
function initControls() {
  Object.keys(params).forEach(param => {
    const input = document.getElementById(param);
    if (input) {
      input.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        params[param] = value;
        updateControl(param, value);
      });

      input.addEventListener('change', (e) => {
        const value = parseFloat(e.target.value);
        sendControl(param, value);
      });
    }
  });
}

/**
 * Initialize WebGL
 */
function initWebGL() {
  if (!gl) {
    alert('WebGL not supported');
    return false;
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Create shader program
  const vertexShader = createShader(gl.VERTEX_SHADER, `
    attribute vec2 position;
    varying vec2 vPosition;
    void main() {
      vPosition = position;
      gl_Position = vec4(position, 0.0, 1.0);
      gl_PointSize = 2.0;
    }
  `);

  const fragmentShader = createShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec2 vPosition;
    uniform float time;
    uniform float frequency;
    uniform float amplitude;
    uniform float pattern;
    uniform float damping;
    uniform float phase;
    uniform float resonance;
    uniform int waveform;

    void main() {
      float r = length(vPosition);
      float theta = atan(vPosition.y, vPosition.x);

      // Compute cymatics pattern
      float wave = 0.0;
      if (waveform == 0) {
        wave = sin(frequency * r * 0.05 + phase + time * 0.001);
      } else if (waveform == 1) {
        wave = sign(sin(frequency * r * 0.05 + phase + time * 0.001));
      } else if (waveform == 2) {
        wave = mod(frequency * r * 0.05 + phase + time * 0.001, 6.28318) / 3.14159 - 1.0;
      } else if (waveform == 3) {
        wave = abs(mod(frequency * r * 0.05 + phase + time * 0.001, 6.28318) / 3.14159 - 1.0) * 2.0 - 1.0;
      } else {
        wave = fract(sin(dot(vPosition, vec2(12.9898, 78.233)) + time * 0.001) * 43758.5453) * 2.0 - 1.0;
      }

      // Add radial component
      wave += sin(theta * pattern * 10.0 + phase) * resonance;

      // Apply amplitude and damping
      float intensity = wave * amplitude * exp(-r * damping);

      // Color based on intensity
      vec3 color = vec3(0.0, abs(intensity), 0.0);
      if (intensity < 0.0) {
        color = vec3(0.0, abs(intensity) * 0.5, abs(intensity));
      }

      gl_FragColor = vec4(color, 0.8);
    }
  `);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link failed:', gl.getProgramInfoLog(program));
    return false;
  }

  gl.useProgram(program);

  // Store program reference
  gl.program = program;

  // Initialize particles
  initParticles();

  return true;
}

/**
 * Create shader
 */
function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Initialize particle system
 */
function initParticles() {
  updateParticles();
}

/**
 * Update particle positions based on density
 */
function updateParticles() {
  const density = Math.floor(params.particle_density);
  particles = [];

  for (let i = 0; i < density; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    particles.push(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    );
  }

  // Update buffer
  if (particleBuffer) {
    gl.deleteBuffer(particleBuffer);
  }

  particleBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particles), gl.STATIC_DRAW);
}

/**
 * Render frame
 */
function render(timestamp) {
  // Calculate FPS
  frameCount++;
  const elapsed = timestamp - lastFrame;

  if (elapsed >= 16.67) { // ~60 FPS
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set uniforms
    const program = gl.program;
    gl.uniform1f(gl.getUniformLocation(program, 'time'), timestamp);
    gl.uniform1f(gl.getUniformLocation(program, 'frequency'), params.frequency);
    gl.uniform1f(gl.getUniformLocation(program, 'amplitude'), params.amplitude);
    gl.uniform1f(gl.getUniformLocation(program, 'pattern'), params.pattern);
    gl.uniform1f(gl.getUniformLocation(program, 'damping'), params.damping);
    gl.uniform1f(gl.getUniformLocation(program, 'phase'), params.phase);
    gl.uniform1f(gl.getUniformLocation(program, 'resonance'), params.resonance);
    gl.uniform1i(gl.getUniformLocation(program, 'waveform'), Math.floor(params.waveform));

    // Bind particle buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Draw particles
    gl.drawArrays(gl.POINTS, 0, particles.length / 2);

    lastFrame = timestamp;
  }

  requestAnimationFrame(render);
}

/**
 * Update FPS display
 */
function updateFPS() {
  const fps = document.getElementById('fps');
  fps.textContent = `FPS: ${frameCount}`;
  frameCount = 0;
}

/**
 * Initialize application
 */
function init() {
  // Initialize WebSocket
  initWebSocket();

  // Initialize controls
  initControls();
  updateAllControls();

  // Initialize WebGL
  if (initWebGL()) {
    // Start render loop
    requestAnimationFrame(render);

    // Update FPS counter
    fpsInterval = setInterval(updateFPS, 1000);

    console.log('Cymatica initialized');
  } else {
    console.error('WebGL initialization failed');
  }

  // Update particles when density changes
  let lastDensity = params.particle_density;
  setInterval(() => {
    if (Math.abs(params.particle_density - lastDensity) > 100) {
      updateParticles();
      lastDensity = params.particle_density;
    }
  }, 100);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Make loadPreset available globally for button onclick
window.loadPreset = loadPreset;
