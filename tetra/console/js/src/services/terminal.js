const { Server } = require("socket.io");
const pty = require('node-pty');
const os = require('os');

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
let ptyProcess = null;

function createPtyProcess() {
    console.log('[PTY] Creating a new shared pseudo-terminal...');
    const newPty = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });
    newPty.write('PS1="\\$ "\r\n');
    newPty.write('clear\r\n');
    newPty.onExit(() => {
        console.log('[PTY] The shared terminal process has exited.');
        ptyProcess = null;
    });
    return newPty;
}

function initializeTerminal(server) {
    if (!ptyProcess) {
        ptyProcess = createPtyProcess();
    }
    const io = new Server(server);
    ptyProcess.onData((data) => {
        io.emit('output', data);
    });
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);
        socket.emit('output', '\r\n--- 🟢 Client connected to shared terminal 🟢 ---\r\n');
        if (ptyProcess) {
            ptyProcess.write('\r\n');
        }
        socket.on('input', (data) => {
            if (ptyProcess) {
                ptyProcess.write(data);
            }
        });
        socket.on('disconnect', () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
        });
    });
}

// Add this new function to kill the child process
function killTerminal() {
    if (ptyProcess) {
        console.log('[PTY] Terminating the shared terminal process.');
        ptyProcess.kill();
        ptyProcess = null;
    }
}

// Update module.exports to include the new function
module.exports = { initializeTerminal, killTerminal };

const pty = require('node-pty');
const os = require('os');

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// This is our self-contained Terminal Manager singleton.
const terminalManager = {
  ptyProcess: null,

  // Creates the one and only PTY process.
  start() {
    if (this.ptyProcess) {
      return; // Already started
    }
    console.log('[PTY Manager] Starting terminal process...');
    this.ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
    });

    this.ptyProcess.write('PS1="\\$ "\r\n');
    this.ptyProcess.write('clear\r\n');
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
    });
  },

  // A robust, Promise-based shutdown method.
  shutdown() {
    return new Promise((resolve, reject) => {
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
