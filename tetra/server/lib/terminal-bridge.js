/**
 * terminal-bridge.js - Shared terminal management for tetra servers
 *
 * Provides PTY process management and Socket.IO terminal handling
 * Used by: tetra-4444 server, tut-interactive server
 */

const pty = require('node-pty');

class TerminalBridge {
    constructor(options = {}) {
        this.options = {
            shell: options.shell || 'bash',
            name: options.name || 'xterm-color',
            cols: options.cols || 80,
            rows: options.rows || 30,
            cwd: options.cwd || process.env.HOME,
            env: options.env || process.env,
            welcomeMessage: options.welcomeMessage || null,
            initCommands: options.initCommands || [],
            onExit: options.onExit || null
        };

        this.ptyProcess = null;
        this.clients = new Set();
    }

    /**
     * Start the PTY process
     * @returns {object} The PTY process
     */
    start() {
        if (this.ptyProcess) {
            return this.ptyProcess;
        }

        this.ptyProcess = pty.spawn(this.options.shell, [], {
            name: this.options.name,
            cols: this.options.cols,
            rows: this.options.rows,
            cwd: this.options.cwd,
            env: this.options.env
        });

        // Run initialization commands
        for (const cmd of this.options.initCommands) {
            this.ptyProcess.write(cmd + '\r\n');
        }

        // Handle process exit
        this.ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`[TerminalBridge] PTY exited (code=${exitCode}, signal=${signal})`);
            this.ptyProcess = null;

            if (this.options.onExit) {
                this.options.onExit(exitCode, signal);
            }
        });

        return this.ptyProcess;
    }

    /**
     * Stop the PTY process
     */
    stop() {
        if (this.ptyProcess) {
            this.ptyProcess.kill();
            this.ptyProcess = null;
        }
    }

    /**
     * Write data to the terminal
     * @param {string} data - Data to write
     */
    write(data) {
        if (this.ptyProcess) {
            this.ptyProcess.write(data);
        }
    }

    /**
     * Resize the terminal
     * @param {number} cols - Number of columns
     * @param {number} rows - Number of rows
     */
    resize(cols, rows) {
        if (this.ptyProcess) {
            this.ptyProcess.resize(cols, rows);
        }
    }

    /**
     * Attach a Socket.IO socket to the terminal
     * @param {object} socket - Socket.IO socket
     * @param {object} io - Socket.IO server instance (optional, for broadcasting)
     */
    attachSocket(socket, io = null) {
        const terminal = this.start();

        // Track this client
        this.clients.add(socket.id);

        // Send welcome message
        if (this.options.welcomeMessage) {
            socket.emit('output', this.options.welcomeMessage);
        }

        // Forward terminal output to client
        const outputHandler = (data) => {
            socket.emit('output', data);
        };
        terminal.onData(outputHandler);

        // Handle input from client
        socket.on('input', (data) => {
            this.write(data);
        });

        // Handle resize from client
        socket.on('resize', ({ cols, rows }) => {
            this.resize(cols, rows);
        });

        // Cleanup on disconnect
        socket.on('disconnect', () => {
            this.clients.delete(socket.id);
            console.log(`[TerminalBridge] Client disconnected: ${socket.id}`);
        });

        console.log(`[TerminalBridge] Client attached: ${socket.id}`);
    }

    /**
     * Get the number of connected clients
     * @returns {number}
     */
    clientCount() {
        return this.clients.size;
    }

    /**
     * Check if the terminal is running
     * @returns {boolean}
     */
    isRunning() {
        return this.ptyProcess !== null;
    }
}

/**
 * Create a terminal bridge with Socket.IO integration
 * @param {object} io - Socket.IO server instance
 * @param {object} options - Terminal options
 * @returns {TerminalBridge}
 */
function createTerminalServer(io, options = {}) {
    const bridge = new TerminalBridge(options);

    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);
        bridge.attachSocket(socket, io);
    });

    return bridge;
}

/**
 * Execute a command and capture output
 * Useful for validation in interactive guides
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @returns {Promise<{output: string, exitCode: number}>}
 */
async function executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        const opts = {
            shell: options.shell || 'bash',
            cwd: options.cwd || process.env.HOME,
            env: options.env || process.env,
            timeout: options.timeout || 30000
        };

        const proc = pty.spawn(opts.shell, ['-c', command], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: opts.cwd,
            env: opts.env
        });

        let output = '';
        let exitCode = null;

        const timer = setTimeout(() => {
            proc.kill();
            reject(new Error(`Command timed out after ${opts.timeout}ms`));
        }, opts.timeout);

        proc.onData((data) => {
            output += data;
        });

        proc.onExit(({ exitCode: code }) => {
            clearTimeout(timer);
            exitCode = code;
            resolve({ output, exitCode });
        });
    });
}

module.exports = {
    TerminalBridge,
    createTerminalServer,
    executeCommand
};
