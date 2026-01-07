/**
 * PTY Session Manager
 * One PTY per socket + org:env combination
 *
 * - Session key = socketId:org:env
 * - Remote envs spawn with SSH directly
 * - Local env spawns shell
 * - Switching = reconnect to different PTY (no keystrokes)
 * - Cleanup on socket disconnect
 */

const pty = require('node-pty');

class PtySessionManager {
    constructor(options = {}) {
        this.sessions = new Map();  // key -> { pty, sockets, buffer, ... }
        this.scrollbackLines = options.scrollbackLines || 1000;
    }

    // Build session key
    _key(socketId, org, env) {
        return `${socketId}:${org}:${env}`;
    }

    // Get or create a session for socket + org + env
    getOrCreate(socketId, org, env, options = {}) {
        const key = this._key(socketId, org, env);

        // Reuse existing session
        if (this.sessions.has(key)) {
            console.log(`[PTY] Reusing session: ${key}`);
            return this.sessions.get(key);
        }

        console.log(`[PTY] Creating session: ${key}`);

        // Determine shell/command based on env
        let shell, args;
        if (env === 'local' || !options.sshTarget) {
            // Local shell
            shell = process.env.SHELL || '/bin/bash';
            args = ['--login'];
        } else {
            // SSH to remote
            shell = 'ssh';
            args = ['-o', 'StrictHostKeyChecking=accept-new', options.sshTarget];
        }

        const cols = options.cols || 120;
        const rows = options.rows || 30;

        const ptyProcess = pty.spawn(shell, args, {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: options.cwd || process.env.HOME,
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor'
            }
        });

        const session = {
            key,
            socketId,
            org,
            env,
            sshTarget: options.sshTarget,
            pty: ptyProcess,
            sockets: new Set(),
            buffer: [],
            ready: false,
            createdAt: new Date(),
            cols,
            rows
        };

        // Handle PTY data
        ptyProcess.onData((data) => {
            this._bufferData(session, data);
            if (session.ready) {
                for (const socket of session.sockets) {
                    socket.emit('output', data);
                }
            }
        });

        // Mark ready after init
        setTimeout(() => {
            session.ready = true;
            console.log(`[PTY] Session ready: ${key}`);
        }, 100);

        // Handle PTY exit
        ptyProcess.onExit(({ exitCode }) => {
            console.log(`[PTY] Session exited: ${key} (code: ${exitCode})`);
            for (const socket of session.sockets) {
                socket.emit('session-ended', { key, exitCode });
            }
            this.sessions.delete(key);
        });

        this.sessions.set(key, session);
        return session;
    }

    // Buffer scrollback
    _bufferData(session, data) {
        const lines = data.split('\n');
        for (const line of lines) {
            session.buffer.push(line);
        }
        while (session.buffer.length > this.scrollbackLines) {
            session.buffer.shift();
        }
    }

    // Add socket to a session
    addSocket(key, socket) {
        const session = this.sessions.get(key);
        if (session) {
            session.sockets.add(socket);
            console.log(`[PTY] Socket added to ${key} (total: ${session.sockets.size})`);
            // Send scrollback
            if (session.buffer.length > 0) {
                socket.emit('output', session.buffer.join('\n'));
            }
        }
    }

    // Remove socket from a session
    removeSocket(key, socket) {
        const session = this.sessions.get(key);
        if (session) {
            session.sockets.delete(socket);
            console.log(`[PTY] Socket removed from ${key} (remaining: ${session.sockets.size})`);
        }
    }

    // Switch socket from one session to another
    switchSocket(socket, fromKey, toKey) {
        if (fromKey) {
            this.removeSocket(fromKey, socket);
        }
        if (toKey) {
            this.addSocket(toKey, socket);
        }
        console.log(`[PTY] Switched socket: ${fromKey || 'none'} -> ${toKey}`);
    }

    // Write to session
    write(key, data) {
        const session = this.sessions.get(key);
        if (session?.pty) {
            session.pty.write(data);
        }
    }

    // Resize session
    resize(key, cols, rows) {
        const session = this.sessions.get(key);
        if (session?.pty) {
            session.pty.resize(cols, rows);
            session.cols = cols;
            session.rows = rows;
        }
    }

    // Kill a specific session
    killSession(key) {
        const session = this.sessions.get(key);
        if (session) {
            console.log(`[PTY] Killing session: ${key}`);
            for (const socket of session.sockets) {
                socket.emit('session-ended', { key, reason: 'killed' });
            }
            if (session.pty) {
                session.pty.kill();
            }
            this.sessions.delete(key);
            return true;
        }
        return false;
    }

    // Cleanup all sessions for a socket (on disconnect)
    cleanupSocket(socketId) {
        const toDelete = [];
        for (const [key, session] of this.sessions) {
            if (session.socketId === socketId) {
                toDelete.push(key);
            }
        }
        for (const key of toDelete) {
            this.killSession(key);
        }
        console.log(`[PTY] Cleaned up ${toDelete.length} sessions for socket ${socketId}`);
    }

    // List all sessions
    listSessions() {
        const result = [];
        for (const [key, session] of this.sessions) {
            result.push({
                key,
                socketId: session.socketId,
                org: session.org,
                env: session.env,
                sshTarget: session.sshTarget,
                socketCount: session.sockets.size,
                created: session.createdAt
            });
        }
        return result;
    }

    // Get session
    getSession(key) {
        return this.sessions.get(key);
    }

    // Cleanup all (shutdown)
    cleanup() {
        console.log(`[PTY] Cleaning up ${this.sessions.size} sessions`);
        for (const [key] of this.sessions) {
            this.killSession(key);
        }
    }
}

module.exports = PtySessionManager;
