const { Server } = require("socket.io");
const pty = require('node-pty');
const os = require('os');

// Determine the shell to use based on the OS
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

function initializeTerminal(server) {
  const io = new Server(server);

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Spawn a new pseudo-terminal for each client
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env
    });

    // Pipe PTY output to the client's terminal
    ptyProcess.onData((data) => {
      socket.emit('output', data);
    });

    // Handle input from the client and write it to the PTY
    socket.on('input', (data) => {
      ptyProcess.write(data);
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      ptyProcess.kill();
    });
  });
}

module.exports = { initializeTerminal };
