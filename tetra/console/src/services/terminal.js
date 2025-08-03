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

