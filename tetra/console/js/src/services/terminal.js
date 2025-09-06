const { Server } = require("socket.io");
const pty = require('node-pty');

// Terminal Manager singleton
const terminalManager = {
  ptyProcess: null,

  // Creates the one and only PTY process.
  start() {
    if (this.ptyProcess) {
      return; // Already started
    }
    console.log('[PTY Manager] Starting terminal process...');
    this.ptyProcess = pty.spawn('bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
    });

    this.ptyProcess.write('PS1="\\$ "\r\n');
    this.ptyProcess.write('clear\r\n');

    this.ptyProcess.onExit(() => {
      console.log('[PTY Manager] The shared terminal process has exited.');
      this.ptyProcess = null;
    });
  },

  // Connects the PTY to the Socket.IO server.
  connect(io) {
    if (!this.ptyProcess) {
      this.start();
    }

    // Broadcast data from the PTY to all clients.
    this.ptyProcess.onData((data) => {
      io.emit('output', data);
    });

    // Handle new client connections.
    io.on('connection', (socket) => {
      console.log(`[Socket.IO] Client connected: ${socket.id}`);
      socket.emit('output', '\r\n--- 🟢 Client connected to shared terminal 🟢 ---\r\n');
      this.ptyProcess.write('\r\n');

      // Handle input from a client.
      socket.on('input', (data) => {
        if (this.ptyProcess) {
          this.ptyProcess.write(data);
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      });
    });
  },

  // A robust, Promise-based shutdown method.
  shutdown() {
    return new Promise((resolve) => {
      if (!this.ptyProcess) {
        return resolve(); // Nothing to do.
      }
      console.log('[PTY Manager] Shutdown initiated. Killing PTY process.');
      this.ptyProcess.onExit(() => {
        console.log('[PTY Manager] PTY process confirmed dead.');
        this.ptyProcess = null;
        resolve();
      });
      this.ptyProcess.kill();
    });
  },
};

module.exports = terminalManager;
