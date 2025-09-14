const { Client } = require('ssh2');
const jwt = require('jsonwebtoken');

/**
 * SSH Bridge WebSocket handler
 * Provides secure SSH connections through WebSocket for terminal access
 * @param {WebSocketServer} wss - WebSocket server instance
 */
module.exports = function(wss, sshKeyStore, JWT_SECRET) {
    console.log('🔗 Initializing SSH Bridge WebSocket server');

    wss.on('connection', function connection(ws, req) {
        console.log('📡 New WebSocket connection from:', req.socket.remoteAddress);

        let sshClient = null;
        let sshStream = null;

        ws.on('message', function message(data) {
            try {
                const msg = JSON.parse(data);

                switch (msg.type) {
                    case 'auth':
                        handleAuth(msg);
                        break;
                    case 'input':
                        handleInput(msg);
                        break;
                    case 'resize':
                        handleResize(msg);
                        break;
                    case 'disconnect':
                        handleDisconnect();
                        break;
                    default:
                        console.warn('⚠️ Unknown message type:', msg.type);
                }
            } catch (err) {
                console.error('❌ Error parsing WebSocket message:', err);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format'
                }));
            }
        });

        /**
         * Handle SSH authentication and connection setup
         * @param {Object} msg - Authentication message with connection details
         */
        function handleAuth(msg) {
            const { host, username, privateKey, passphrase, token, port = 22 } = msg;

            let sshCredentials = { host, username, privateKey, passphrase };

            // If token is provided, validate and retrieve credentials
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    const storedData = sshKeyStore.get(decoded.sessionId);
                    
                    if (!storedData) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Session expired. Please re-authenticate.'
                        }));
                        return;
                    }
                    
                    sshCredentials = storedData;
                    console.log(`🔐 Using token authentication for ${sshCredentials.username}@${sshCredentials.host}:${port}`);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid or expired token. Please re-authenticate.'
                    }));
                    return;
                }
            } else {
                console.log(`🔐 Using direct key authentication for ${username}@${host}:${port}`);
            }

            const { host: finalHost, username: finalUsername, privateKey: finalPrivateKey, passphrase: finalPassphrase } = sshCredentials;

            sshClient = new Client();

            sshClient.on('ready', () => {
                console.log('✅ SSH connection established');

                sshClient.shell((err, stream) => {
                    if (err) {
                        console.error('❌ SSH shell error:', err);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Failed to create shell session'
                        }));
                        return;
                    }

                    sshStream = stream;

                    // Send success message
                    ws.send(JSON.stringify({
                        type: 'connected',
                        message: `Connected to ${finalUsername}@${finalHost}`
                    }));

                    // Forward SSH output to WebSocket
                    stream.on('data', (data) => {
                        ws.send(JSON.stringify({
                            type: 'output',
                            data: data.toString('utf8')
                        }));
                    });

                    stream.on('close', () => {
                        console.log('🔌 SSH stream closed');
                        ws.send(JSON.stringify({
                            type: 'disconnected',
                            message: 'SSH session ended'
                        }));
                    });

                    stream.stderr.on('data', (data) => {
                        ws.send(JSON.stringify({
                            type: 'output',
                            data: data.toString('utf8')
                        }));
                    });
                });
            });

            sshClient.on('error', (err) => {
                console.error('❌ SSH connection error:', err);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Connection failed: ${err.message}`
                }));
            });

            sshClient.on('end', () => {
                console.log('🔌 SSH connection ended');
            });

            // Connect to SSH server
            const connectOptions = {
                host: finalHost,
                port,
                username: finalUsername,
                keepaliveInterval: 30000,
                keepaliveCountMax: 3
            };
            if (finalPrivateKey) {
                connectOptions.privateKey = finalPrivateKey;
            }
            if (finalPassphrase) {
                connectOptions.passphrase = finalPassphrase;
            }
            
            sshClient.connect(connectOptions);
        }

        /**
         * Handle terminal input from WebSocket client
         * @param {Object} msg - Input message containing data to send to SSH
         */
        function handleInput(msg) {
            if (sshStream && !sshStream.destroyed) {
                sshStream.write(msg.data);
            }
        }

        /**
         * Handle terminal resize events
         * @param {Object} msg - Resize message with rows and cols
         */
        function handleResize(msg) {
            if (sshStream && !sshStream.destroyed) {
                sshStream.setWindow(msg.rows, msg.cols);
            }
        }

        /**
         * Clean up SSH connections and streams
         */
        function handleDisconnect() {
            if (sshStream) {
                sshStream.close();
            }
            if (sshClient) {
                sshClient.end();
            }
        }

        // Clean up on WebSocket close
        ws.on('close', () => {
            console.log('📡 WebSocket connection closed');
            handleDisconnect();
        });

        ws.on('error', (err) => {
            console.error('❌ WebSocket error:', err);
            handleDisconnect();
        });

        // Send initial ready message
        ws.send(JSON.stringify({
            type: 'ready',
            message: 'SSH Bridge ready for connections'
        }));
    });
};