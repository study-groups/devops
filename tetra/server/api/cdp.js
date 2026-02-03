/**
 * CDP Agent REST API
 *
 * Connects to Chrome via CDP WebSocket and exposes debugging endpoints.
 * Buffers network requests and console messages for later querying.
 *
 * Endpoints:
 *   GET  /status      - Chrome/CDP connection status
 *   GET  /screenshot  - Screenshot current tab (returns PNG)
 *   POST /navigate    - Navigate to URL
 *   POST /eval        - Execute JS in page context
 *   GET  /network     - Recent network requests (buffered)
 *   GET  /dom         - Query DOM by selector
 *   GET  /console     - Recent console messages (buffered)
 *   POST /connect     - Connect to Chrome on specified port
 */

const express = require('express');
const WebSocket = require('ws');
const router = express.Router();

// CDP connection state
let cdpWs = null;
let cdpConnected = false;
let chromePort = process.env.CDP_PORT || 9222;
let messageId = 1;
let pendingCallbacks = new Map();

// Buffered data (ring buffers with max size)
const MAX_BUFFER = 100;
let networkRequests = [];
let consoleMessages = [];

// CDP message handling
function sendCdpCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
        if (!cdpWs || cdpWs.readyState !== WebSocket.OPEN) {
            reject(new Error('Not connected to CDP'));
            return;
        }

        const id = messageId++;
        const message = JSON.stringify({ id, method, params });

        pendingCallbacks.set(id, { resolve, reject, timeout: setTimeout(() => {
            pendingCallbacks.delete(id);
            reject(new Error(`CDP command timeout: ${method}`));
        }, 30000) });

        cdpWs.send(message);
    });
}

function handleCdpMessage(data) {
    try {
        const msg = JSON.parse(data);

        // Response to a command
        if (msg.id !== undefined) {
            const callback = pendingCallbacks.get(msg.id);
            if (callback) {
                clearTimeout(callback.timeout);
                pendingCallbacks.delete(msg.id);
                if (msg.error) {
                    callback.reject(new Error(msg.error.message));
                } else {
                    callback.resolve(msg.result);
                }
            }
            return;
        }

        // Event from CDP
        if (msg.method) {
            handleCdpEvent(msg.method, msg.params);
        }
    } catch (err) {
        console.error('CDP message parse error:', err);
    }
}

function handleCdpEvent(method, params) {
    switch (method) {
        case 'Network.requestWillBeSent':
            networkRequests.push({
                type: 'request',
                timestamp: Date.now(),
                requestId: params.requestId,
                url: params.request.url,
                method: params.request.method,
                headers: params.request.headers
            });
            if (networkRequests.length > MAX_BUFFER) networkRequests.shift();
            break;

        case 'Network.responseReceived':
            networkRequests.push({
                type: 'response',
                timestamp: Date.now(),
                requestId: params.requestId,
                url: params.response.url,
                status: params.response.status,
                mimeType: params.response.mimeType,
                headers: params.response.headers
            });
            if (networkRequests.length > MAX_BUFFER) networkRequests.shift();
            break;

        case 'Runtime.consoleAPICalled':
            consoleMessages.push({
                timestamp: Date.now(),
                type: params.type,
                args: params.args.map(a => a.value || a.description || a.type)
            });
            if (consoleMessages.length > MAX_BUFFER) consoleMessages.shift();
            break;

        case 'Runtime.exceptionThrown':
            consoleMessages.push({
                timestamp: Date.now(),
                type: 'error',
                exception: params.exceptionDetails.text,
                stack: params.exceptionDetails.stackTrace
            });
            if (consoleMessages.length > MAX_BUFFER) consoleMessages.shift();
            break;
    }
}

// Connect to Chrome CDP (connects to first page target)
async function connectToCDP(port = chromePort) {
    chromePort = port;

    // Get first page target from Chrome (not browser-level connection)
    const http = require('http');
    const wsUrl = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/json/list`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const targets = JSON.parse(data);
                    // Find first page target (not iframe or other types)
                    const page = targets.find(t => t.type === 'page');
                    if (page && page.webSocketDebuggerUrl) {
                        resolve(page.webSocketDebuggerUrl);
                    } else {
                        reject(new Error('No page target found'));
                    }
                } catch (e) {
                    reject(new Error('Failed to parse Chrome targets'));
                }
            });
        }).on('error', reject);
    });

    if (!wsUrl) {
        throw new Error('No WebSocket URL from Chrome');
    }

    // Close existing connection
    if (cdpWs) {
        cdpWs.close();
    }

    // Connect WebSocket
    cdpWs = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
        cdpWs.on('open', resolve);
        cdpWs.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
    });

    cdpWs.on('message', handleCdpMessage);
    cdpWs.on('close', () => {
        cdpConnected = false;
        console.log('CDP WebSocket closed');
    });
    cdpWs.on('error', (err) => {
        console.error('CDP WebSocket error:', err);
    });

    cdpConnected = true;

    // Enable domains we care about
    await sendCdpCommand('Network.enable');
    await sendCdpCommand('Runtime.enable');
    await sendCdpCommand('Page.enable');

    console.log(`Connected to Chrome CDP on port ${port}`);
    return true;
}

// Check if Chrome is running
async function checkChrome(port = chromePort) {
    const http = require('http');
    return new Promise((resolve) => {
        http.get(`http://localhost:${port}/json/version`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

// --- REST API Routes ---

// GET /status - Connection status
router.get('/status', async (req, res) => {
    const chromeInfo = await checkChrome();
    res.json({
        chrome: {
            running: !!chromeInfo,
            port: chromePort,
            version: chromeInfo?.Browser || null
        },
        cdp: {
            connected: cdpConnected,
            wsReady: cdpWs?.readyState === WebSocket.OPEN
        },
        buffers: {
            networkRequests: networkRequests.length,
            consoleMessages: consoleMessages.length
        }
    });
});

// POST /connect - Connect to Chrome
router.post('/connect', async (req, res) => {
    try {
        const port = req.body.port || chromePort;
        await connectToCDP(port);
        res.json({ success: true, port });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /screenshot - Take screenshot
router.get('/screenshot', async (req, res) => {
    try {
        if (!cdpConnected) {
            return res.status(503).json({ error: 'Not connected to CDP' });
        }

        const result = await sendCdpCommand('Page.captureScreenshot', {
            format: 'png'
        });

        const buffer = Buffer.from(result.data, 'base64');
        res.set('Content-Type', 'image/png');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /navigate - Navigate to URL
router.post('/navigate', async (req, res) => {
    try {
        if (!cdpConnected) {
            return res.status(503).json({ error: 'Not connected to CDP' });
        }

        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL required' });
        }

        const result = await sendCdpCommand('Page.navigate', { url });
        res.json({ success: true, frameId: result.frameId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /eval - Execute JavaScript
router.post('/eval', async (req, res) => {
    try {
        if (!cdpConnected) {
            return res.status(503).json({ error: 'Not connected to CDP' });
        }

        const { expr, expression } = req.body;
        const code = expr || expression;
        if (!code) {
            return res.status(400).json({ error: 'Expression required (expr or expression)' });
        }

        const result = await sendCdpCommand('Runtime.evaluate', {
            expression: code,
            returnByValue: true
        });

        res.json({
            value: result.result?.value,
            type: result.result?.type,
            description: result.result?.description
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /network - Recent network requests
router.get('/network', (req, res) => {
    const { url, method, limit } = req.query;
    let filtered = networkRequests;

    if (url) {
        filtered = filtered.filter(r => r.url?.includes(url));
    }
    if (method) {
        filtered = filtered.filter(r => r.method === method.toUpperCase());
    }
    if (limit) {
        filtered = filtered.slice(-parseInt(limit));
    }

    res.json(filtered);
});

// GET /console - Recent console messages
router.get('/console', (req, res) => {
    const { type, limit } = req.query;
    let filtered = consoleMessages;

    if (type) {
        filtered = filtered.filter(m => m.type === type);
    }
    if (limit) {
        filtered = filtered.slice(-parseInt(limit));
    }

    res.json(filtered);
});

// GET /dom - Query DOM by selector
router.get('/dom', async (req, res) => {
    try {
        if (!cdpConnected) {
            return res.status(503).json({ error: 'Not connected to CDP' });
        }

        const { selector } = req.query;
        if (!selector) {
            return res.status(400).json({ error: 'Selector required' });
        }

        // Use Runtime.evaluate to query DOM
        const result = await sendCdpCommand('Runtime.evaluate', {
            expression: `(() => {
                const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
                if (!el) return null;
                return {
                    tagName: el.tagName,
                    id: el.id,
                    className: el.className,
                    outerHTML: el.outerHTML.substring(0, 5000),
                    textContent: el.textContent?.substring(0, 1000)
                };
            })()`,
            returnByValue: true
        });

        if (!result.result?.value) {
            return res.status(404).json({ error: 'Element not found' });
        }

        res.json(result.result.value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /clear - Clear buffers
router.post('/clear', (req, res) => {
    networkRequests = [];
    consoleMessages = [];
    res.json({ success: true });
});

// Auto-connect on module load if Chrome is running
(async () => {
    const chromeInfo = await checkChrome();
    if (chromeInfo) {
        try {
            await connectToCDP();
        } catch (err) {
            console.log('CDP auto-connect failed (will retry on /connect):', err.message);
        }
    }
})();

module.exports = router;
