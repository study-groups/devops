/**
 * PULSAR Engine - Subprocess/FIFO management for the PULSAR renderer
 *
 * Supports two modes:
 * - subprocess: Spawns PULSAR as a child process with stdin/stdout pipes
 * - fifo: Connects to existing PULSAR via named pipe (for TSM-managed debugging)
 */

const EventEmitter = require('events');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TETRA_SRC = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');

const DEFAULT_CONFIG = {
  pulsarBin: process.env.PULSAR_BIN || path.join(TETRA_SRC, 'bash/pulsar/engine/bin/pulsar_slots'),
  pulsarMode: process.env.PULSAR_MODE || 'subprocess',
  pulsarFifo: process.env.PULSAR_FIFO || path.join(TETRA_DIR, 'tsm/runtime/pulsar.fifo'),
  verbose: false
};

class PulsarEngine extends EventEmitter {
  constructor(server, options = {}) {
    super();
    this.server = server;
    this.config = { ...DEFAULT_CONFIG, ...options };

    // Subprocess state
    this.pulsar = null;
    this.pulsarBuffer = '';
    this.pulsarFifoFd = null;

    // Frame parsing state
    this.currentFrame = undefined;
    this.currentFrameSlot = undefined;
  }

  /**
   * Spawn PULSAR subprocess or connect to FIFO
   */
  spawn() {
    if (this.config.pulsarMode === 'disabled') {
      this.server.log('PULSAR disabled - skipping spawn');
      return true;
    }

    if (this.config.pulsarMode === 'fifo') {
      return this.connectToFifo();
    }

    if (this.pulsar) return true;

    // Check if binary exists
    if (!fs.existsSync(this.config.pulsarBin)) {
      this.server.log(`PULSAR binary not found: ${this.config.pulsarBin} - skipping`);
      return false;
    }

    try {
      this.pulsar = spawn(this.config.pulsarBin, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.pulsar.stdout.on('data', (data) => {
        this.handleOutput(data.toString());
      });

      this.pulsar.stderr.on('data', (data) => {
        this.server.log(`PULSAR stderr: ${data.toString().trim()}`, 'info');
      });

      this.pulsar.on('close', (code) => {
        this.server.log(`PULSAR exited with code ${code}`, code ? 'error' : 'info');
        this.unregisterFromTSM();
        this.pulsar = null;
        this.emit('closed', { code });
      });

      this.pulsar.on('error', (err) => {
        this.server.log(`PULSAR spawn error: ${err.message}`, 'error');
        this.pulsar = null;
        this.emit('error', err);
      });

      this.server.log(`PULSAR spawned: ${this.config.pulsarBin} (PID: ${this.pulsar.pid})`);
      this.registerWithTSM();

      return true;
    } catch (err) {
      this.server.log(`Failed to spawn PULSAR: ${err.message}`, 'error');
      return false;
    }
  }

  /**
   * Connect to PULSAR via FIFO (debug mode)
   */
  connectToFifo() {
    if (this.pulsarFifoFd) return true;

    try {
      const runtimeDir = path.dirname(this.config.pulsarFifo);
      if (!fs.existsSync(runtimeDir)) {
        fs.mkdirSync(runtimeDir, { recursive: true });
      }

      if (!fs.existsSync(this.config.pulsarFifo)) {
        execSync(`mkfifo "${this.config.pulsarFifo}"`);
        this.server.log(`Created FIFO: ${this.config.pulsarFifo}`);
      }

      this.ensurePulsarRunning();

      this.pulsarFifoFd = fs.openSync(
        this.config.pulsarFifo,
        fs.constants.O_WRONLY | fs.constants.O_NONBLOCK
      );
      this.server.log(`Connected to PULSAR FIFO: ${this.config.pulsarFifo}`);

      return true;
    } catch (err) {
      this.server.log(`Failed to connect to PULSAR FIFO: ${err.message}`, 'error');
      return false;
    }
  }

  /**
   * Ensure PULSAR is running via TSM (for FIFO mode)
   */
  ensurePulsarRunning() {
    try {
      execSync('tsm info pulsar 2>/dev/null', { stdio: 'ignore' });
      this.server.log('PULSAR already running via TSM');
    } catch {
      this.server.log('Starting PULSAR via TSM...');
      try {
        execSync(`PULSAR_FIFO="${this.config.pulsarFifo}" tsm start pulsar`, { stdio: 'inherit' });
      } catch (err) {
        this.server.log(`Failed to start PULSAR via TSM: ${err.message}`, 'error');
      }
    }
  }

  /**
   * Send command to PULSAR
   */
  send(cmd) {
    if (this.config.pulsarMode === 'fifo') {
      if (!this.pulsarFifoFd) {
        if (!this.connectToFifo()) return false;
      }
      try {
        fs.writeSync(this.pulsarFifoFd, cmd + '\n');
        return true;
      } catch (err) {
        this.server.log(`FIFO write error: ${err.message}`, 'error');
        this.pulsarFifoFd = null;
        return false;
      }
    } else {
      if (!this.pulsar) {
        if (!this.spawn()) return false;
      }
      this.pulsar.stdin.write(cmd + '\n');
      return true;
    }
  }

  /**
   * Handle output from PULSAR subprocess
   */
  handleOutput(data) {
    this.pulsarBuffer += data;

    let newlineIdx;
    while ((newlineIdx = this.pulsarBuffer.indexOf('\n')) !== -1) {
      const line = this.pulsarBuffer.slice(0, newlineIdx);
      this.pulsarBuffer = this.pulsarBuffer.slice(newlineIdx + 1);
      this.handleLine(line);
    }
  }

  /**
   * Handle a single line of PULSAR output
   */
  handleLine(line) {
    if (this.currentFrame !== undefined) {
      if (line === 'END_FRAME') {
        const frameData = this.currentFrame;
        const slot = this.currentFrameSlot;
        this.currentFrame = undefined;
        this.currentFrameSlot = undefined;

        this.emit('frame', { slot, lines: frameData });
      } else {
        this.currentFrame.push(line);
      }
      return;
    }

    if (line.startsWith('|') || line.startsWith('=')) {
      this.currentFrame = [line];
      return;
    }

    if (this.config.verbose) {
      this.server.log(`PULSAR: ${line}`);
    }
  }

  /**
   * Set current frame slot (for frame capture)
   */
  setCurrentSlot(slot) {
    this.currentFrameSlot = slot;
  }

  /**
   * Register PULSAR subprocess with TSM
   */
  registerWithTSM() {
    if (!this.pulsar) return;

    const TSM_RUNTIME = path.join(TETRA_DIR, 'tsm/runtime');
    const processDir = path.join(TSM_RUNTIME, 'processes/pulsar-child');
    const pidFile = path.join(processDir, 'pulsar-child.pid');
    const metaFile = path.join(processDir, 'meta.json');

    let tsmId = 99;
    const nextIdFile = path.join(TSM_RUNTIME, 'next_id');
    try {
      if (fs.existsSync(nextIdFile)) {
        tsmId = parseInt(fs.readFileSync(nextIdFile, 'utf8').trim()) || 99;
        fs.writeFileSync(nextIdFile, String(tsmId + 1));
      }
    } catch {
      // Ignore, use default
    }

    const parentName = `quasar-${this.server.config.httpPort}`;
    let parentTsmId = null;
    try {
      const parentMetaFile = path.join(TSM_RUNTIME, `processes/${parentName}/meta.json`);
      if (fs.existsSync(parentMetaFile)) {
        const parentMeta = JSON.parse(fs.readFileSync(parentMetaFile, 'utf8'));
        parentTsmId = parentMeta.tsm_id || null;
      }
    } catch {
      // Ignore
    }

    const commType = this.config.pulsarMode === 'fifo' ? 'fifo' : 'pipe';
    const commPath = this.config.pulsarMode === 'fifo' ? this.config.pulsarFifo : null;

    const meta = {
      tsm_id: tsmId,
      org: 'tetra',
      name: 'pulsar-child',
      pid: this.pulsar.pid,
      command: this.config.pulsarBin,
      port: null,
      port_type: 'none',
      cwd: path.dirname(this.config.pulsarBin),
      interpreter: this.config.pulsarBin,
      process_type: 'binary',
      service_type: 'subprocess',
      env_file: '',
      prehook: '',
      status: 'online',
      start_time: Math.floor(Date.now() / 1000),
      restarts: 0,
      unstable_restarts: 0,
      parent: parentName,
      parent_tsm_id: parentTsmId,
      children: [],
      comm_type: commType,
      comm_path: commPath,
      git: null
    };

    try {
      fs.mkdirSync(processDir, { recursive: true });
      fs.writeFileSync(pidFile, String(this.pulsar.pid));
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
      fs.writeFileSync(path.join(processDir, 'current.out'), '');
      fs.writeFileSync(path.join(processDir, 'current.err'), '');

      this.server.log(`TSM registered: pulsar-child (TSM ID: ${tsmId}, PID: ${this.pulsar.pid})`);
    } catch (err) {
      this.server.log(`TSM registration failed: ${err.message}`, 'error');
    }
  }

  /**
   * Unregister PULSAR from TSM
   */
  unregisterFromTSM() {
    const processDir = path.join(TETRA_DIR, 'tsm/runtime/processes/pulsar-child');
    try {
      if (fs.existsSync(processDir)) {
        fs.rmSync(processDir, { recursive: true, force: true });
        this.server.log('TSM unregistered: pulsar-child');
      }
    } catch (err) {
      this.server.log(`TSM unregister failed: ${err.message}`, 'error');
    }
  }

  /**
   * Check if PULSAR is running
   */
  isRunning() {
    if (this.config.pulsarMode === 'fifo') {
      return this.pulsarFifoFd !== null;
    }
    return this.pulsar !== null;
  }

  /**
   * Stop PULSAR
   */
  stop() {
    if (this.config.pulsarMode === 'fifo') {
      if (this.pulsarFifoFd) {
        try {
          fs.closeSync(this.pulsarFifoFd);
        } catch {
          // Ignore close errors
        }
        this.pulsarFifoFd = null;
      }
    } else {
      if (this.pulsar) {
        this.pulsar.kill();
        this.pulsar = null;
      }
    }
  }

  toJSON() {
    return {
      mode: this.config.pulsarMode,
      running: this.isRunning(),
      pid: this.pulsar?.pid || null
    };
  }
}

module.exports = { PulsarEngine, DEFAULT_CONFIG };
