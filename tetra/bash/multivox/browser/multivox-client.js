// multivox-client.js - Browser WebSocket client for multivox
// Receives formant parameters and forwards to estovox-synth

export class MultivoxClient {
    constructor(url = null) {
        this.url = url || `ws://${window.location.host}`;
        this.ws = null;
        this.connected = false;
        this.reconnectDelay = 2000;
        this.reconnectTimer = null;

        // Event callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onFormant = null;      // { f1, f2, f3, f0, noise, bits, dur }
        this.onState = null;        // { jaw, lips, tongue_h, ... }
        this.onRaw = null;          // Raw string messages
        this.onError = null;
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return; // Already connected
        }

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                this.connected = true;
                console.log('[MultivoxClient] Connected to', this.url);

                // Register as synth
                this.ws.send(JSON.stringify({ t: 'register', role: 'synth' }));

                if (this.onConnect) this.onConnect();
            };

            this.ws.onmessage = (event) => {
                this._handleMessage(event.data);
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log('[MultivoxClient] Disconnected');
                if (this.onDisconnect) this.onDisconnect();
                this._scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                console.error('[MultivoxClient] WebSocket error');
                if (this.onError) this.onError(err);
            };

        } catch (err) {
            console.error('[MultivoxClient] Connection failed:', err);
            this._scheduleReconnect();
        }
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }

    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            console.log('[MultivoxClient] Attempting reconnect...');
            this.connect();
        }, this.reconnectDelay);
    }

    _handleMessage(data) {
        try {
            const msg = JSON.parse(data);

            switch (msg.t || msg.type) {
                case 'fm':
                case 'formant':
                    // Formant parameters from estovox-face
                    if (this.onFormant) {
                        this.onFormant({
                            f1: msg.f1,
                            f2: msg.f2,
                            f3: msg.f3,
                            bw1: msg.bw1,
                            bw2: msg.bw2,
                            bw3: msg.bw3,
                            f0: msg.f0,
                            noise: msg.noise,
                            bits: msg.bits,
                            dur: msg.dur
                        });
                    }
                    break;

                case 'st':
                case 'state':
                    // Facial state for visualization
                    if (this.onState) {
                        this.onState(msg);
                    }
                    break;

                case 'raw':
                    // Raw string data
                    if (this.onRaw) {
                        this.onRaw(msg.data);
                    }
                    break;

                case 'welcome':
                    console.log('[MultivoxClient] Welcome:', msg);
                    break;

                case 'test':
                    console.log('[MultivoxClient] Test:', msg.msg || msg);
                    break;

                default:
                    console.log('[MultivoxClient] Unknown message type:', msg.t || msg.type);
            }

        } catch (err) {
            // Not JSON, treat as raw
            if (this.onRaw) {
                this.onRaw(data);
            }
        }
    }

    // Send message back to server (e.g., sync feedback)
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const data = typeof message === 'string' ? message : JSON.stringify(message);
            this.ws.send(data);
        }
    }
}

// Singleton for convenience
let _defaultClient = null;

export function getMultivoxClient() {
    if (!_defaultClient) {
        _defaultClient = new MultivoxClient();
    }
    return _defaultClient;
}
