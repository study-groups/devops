#!/usr/bin/env node
/**
 * tut-server.js - Interactive Tutorial Server
 *
 * Provides real terminal execution for TUT guides via:
 * - Express HTTP server for guide content
 * - Socket.IO for real-time terminal
 * - API for hydration and validation
 *
 * Usage: node tut-server.js [options]
 *   --port <port>     Port to listen on (default: 4446)
 *   --guide <name>    Guide to serve (optional)
 *   --org <name>      Organization for hydration (optional)
 *
 * TSM Service: tut-interactive
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const { TerminalBridge, createTerminalServer, executeCommand } = require('../../../server/lib/terminal-bridge');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
};

// Configuration
const PORT = parseInt(getArg('port', process.env.TUT_PORT || '4446'));
const GUIDE_NAME = getArg('guide', null);
const ORG_NAME = getArg('org', process.env.TETRA_ORG || null);
const TETRA_SRC = process.env.TETRA_SRC;
const TETRA_DIR = process.env.TETRA_DIR;
const TUT_SRC = path.join(TETRA_SRC, 'bash/tut');
const TUT_DIR = path.join(TETRA_DIR, 'tut');

console.log(`🎓 TUT Interactive Server starting...`);
console.log(`   Port: ${PORT}`);
console.log(`   TUT_SRC: ${TUT_SRC}`);
console.log(`   TUT_DIR: ${TUT_DIR}`);
if (GUIDE_NAME) console.log(`   Guide: ${GUIDE_NAME}`);
if (ORG_NAME) console.log(`   Org: ${ORG_NAME}`);

// Express app
const app = express();
const server = http.createServer(app);

// Socket.IO for terminal
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(TUT_SRC, 'templates')));

// Terminal bridge for real command execution
const terminalBridge = createTerminalServer(io, {
    welcomeMessage: '\r\n--- 🎓 TUT Interactive Terminal ---\r\n\r\n',
    initCommands: [
        'PS1="tut$ "',
        'clear'
    ],
    cwd: process.env.HOME
});

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * GET /health - Health check
 */
app.get('/health', (req, res) => {
    res.json({
        service: 'tut-interactive',
        status: 'healthy',
        port: PORT,
        clients: terminalBridge.clientCount(),
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/guides - List available guides
 */
app.get('/api/guides', (req, res) => {
    const availableDir = path.join(TUT_SRC, 'available');
    try {
        const files = fs.readdirSync(availableDir)
            .filter(f => f.endsWith('.json'))
            .map(f => ({
                name: f.replace('.json', ''),
                path: path.join(availableDir, f),
                isTemplate: f.includes('.template.')
            }));
        res.json({ guides: files });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list guides', details: err.message });
    }
});

/**
 * GET /api/guide/:name - Get guide JSON
 */
app.get('/api/guide/:name', (req, res) => {
    const name = req.params.name.replace('.json', '');
    const availableDir = path.join(TUT_SRC, 'available');

    // Try exact name, then with .template suffix
    const candidates = [
        path.join(availableDir, `${name}.json`),
        path.join(availableDir, `${name}.template.json`)
    ];

    for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const guide = JSON.parse(content);
                res.json({ guide, path: filePath });
                return;
            } catch (err) {
                res.status(500).json({ error: 'Failed to parse guide', details: err.message });
                return;
            }
        }
    }

    res.status(404).json({ error: `Guide not found: ${name}` });
});

/**
 * POST /api/hydrate - Substitute template variables
 */
app.post('/api/hydrate', async (req, res) => {
    const { guide, org } = req.body;

    if (!guide) {
        return res.status(400).json({ error: 'Guide content required' });
    }

    const orgName = org || ORG_NAME || 'pixeljam-arcade';

    try {
        // Get variables from tetra.toml via bash
        const variables = await getOrgVariables(orgName);

        // Substitute variables in guide JSON
        let guideStr = JSON.stringify(guide);
        for (const [key, value] of Object.entries(variables)) {
            const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            guideStr = guideStr.replace(pattern, value);
        }

        const hydratedGuide = JSON.parse(guideStr);
        res.json({
            guide: hydratedGuide,
            variables,
            org: orgName
        });
    } catch (err) {
        res.status(500).json({ error: 'Hydration failed', details: err.message });
    }
});

/**
 * POST /api/validate - Validate command output
 */
app.post('/api/validate', async (req, res) => {
    const { type, check, expected } = req.body;

    try {
        let result = { valid: false, actual: null };

        switch (type) {
            case 'command':
                const { output, exitCode } = await executeCommand(check);
                result.actual = output.trim();
                result.exitCode = exitCode;
                result.valid = expected ?
                    output.includes(expected) :
                    exitCode === 0;
                break;

            case 'file-exists':
                const expandedPath = check.replace(/^~/, process.env.HOME);
                result.valid = fs.existsSync(expandedPath);
                result.actual = result.valid ? 'exists' : 'not found';
                break;

            case 'env-var':
                result.actual = process.env[check] || null;
                result.valid = expected ?
                    result.actual === expected :
                    result.actual !== null;
                break;

            default:
                return res.status(400).json({ error: `Unknown validation type: ${type}` });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Validation failed', details: err.message });
    }
});

/**
 * POST /api/execute - Execute a command and return output
 */
app.post('/api/execute', async (req, res) => {
    const { command, cwd } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Command required' });
    }

    try {
        const result = await executeCommand(command, {
            cwd: cwd || process.env.HOME,
            timeout: 30000
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Execution failed', details: err.message });
    }
});

// =============================================================================
// GUIDE SERVING
// =============================================================================

/**
 * GET /guide/:name - Serve interactive guide HTML
 */
app.get('/guide/:name', (req, res) => {
    const name = req.params.name.replace('.html', '').replace('.json', '');
    const generatedDir = path.join(TUT_DIR, 'generated');

    // Check for pre-generated HTML
    const htmlPath = path.join(generatedDir, `${name}.html`);
    if (fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
    }

    // Fall back to dynamic generation (TODO: implement)
    res.status(404).send(`
        <h1>Guide not found: ${name}</h1>
        <p>Generate it first with: <code>tut build ${name}</code></p>
        <p>Or use interactive mode: <code>tut run ${name} --org pixeljam-arcade</code></p>
    `);
});

/**
 * GET / - Index page
 */
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>TUT Interactive Server</title>
    <style>
        body { font-family: system-ui; max-width: 800px; margin: 2em auto; padding: 1em; }
        code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; }
        pre { background: #1e1e1e; color: #d4d4d4; padding: 1em; border-radius: 5px; overflow-x: auto; }
        .status { color: #0a0; }
        a { color: #0066cc; }
    </style>
</head>
<body>
    <h1>🎓 TUT Interactive Server</h1>
    <p class="status">Status: Running on port ${PORT}</p>

    <h2>API Endpoints</h2>
    <ul>
        <li><a href="/health">/health</a> - Health check</li>
        <li><a href="/api/guides">/api/guides</a> - List available guides</li>
        <li>/api/guide/:name - Get guide JSON</li>
        <li>POST /api/hydrate - Substitute template variables</li>
        <li>POST /api/validate - Validate command output</li>
        <li>POST /api/execute - Execute command</li>
    </ul>

    <h2>Guides</h2>
    <ul>
        <li><a href="/guide/tkm-guide">/guide/tkm-guide</a> - TKM Key Manager Guide</li>
    </ul>

    <h2>Usage</h2>
    <pre>
# Start server
tsm start tut-interactive

# Or directly
node tut-server.js --port 4446 --org pixeljam-arcade

# Run interactive guide
tut run tkm-guide --org pixeljam-arcade
    </pre>
</body>
</html>
    `);
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get org variables from tetra.toml
 */
async function getOrgVariables(orgName) {
    const variables = {
        org: orgName,
        ssh_dir: `~/.ssh/${orgName}/`
    };

    // Try to get values from tetra.toml via org module
    const commands = {
        dev_host: `source ~/tetra/tetra.sh && org switch ${orgName} &>/dev/null && _org_get_host dev`,
        staging_host: `source ~/tetra/tetra.sh && org switch ${orgName} &>/dev/null && _org_get_host staging`,
        prod_host: `source ~/tetra/tetra.sh && org switch ${orgName} &>/dev/null && _org_get_host prod`,
        work_user: `source ~/tetra/tetra.sh && org switch ${orgName} &>/dev/null && _org_get_work_user dev`
    };

    for (const [key, cmd] of Object.entries(commands)) {
        try {
            const { output, exitCode } = await executeCommand(cmd, { timeout: 5000 });
            if (exitCode === 0 && output.trim()) {
                variables[key] = output.trim();
            }
        } catch (err) {
            // Silently skip failed lookups
        }
    }

    return variables;
}

// =============================================================================
// START SERVER
// =============================================================================

server.listen(PORT, '127.0.0.1', () => {
    console.log(`✅ TUT Interactive Server running on http://127.0.0.1:${PORT}`);
    console.log(`   Terminal clients: ${terminalBridge.clientCount()}`);
    console.log(`   API: http://127.0.0.1:${PORT}/api/guides`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down TUT server...');
    terminalBridge.stop();
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down TUT server...');
    terminalBridge.stop();
    server.close(() => process.exit(0));
});
