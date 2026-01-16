/**
 * Capture API - Helper Functions
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

function getCaptureDir(org) {
    return path.join(ORGS_DIR, org, 'captures');
}

function getSessionDir(org, name) {
    return path.join(ORGS_DIR, org, 'captures', 'sessions', name);
}

function getSessionsDir(org) {
    return path.join(ORGS_DIR, org, 'captures', 'sessions');
}

function getJourneysDir(org) {
    return path.join(ORGS_DIR, org, 'captures', 'journeys');
}

function getJourneyPath(org, name) {
    return path.join(getJourneysDir(org), `${name}.json`);
}

function getSessionPath(org, name) {
    return path.join(getSessionDir(org, name), 'session.json');
}

function getSessionStatePath(org, name) {
    return path.join(getSessionDir(org, name), 'state.json');
}

/**
 * Load a session with all its data (session.json + state.json)
 * Falls back to legacy meta.json if session.json doesn't exist
 */
function loadSession(org, name) {
    const sessionDir = getSessionDir(org, name);
    const sessionPath = path.join(sessionDir, 'session.json');
    const legacyMetaPath = path.join(sessionDir, 'meta.json');
    const statePath = path.join(sessionDir, 'state.json');

    let session = null;

    // Try new format first
    if (fs.existsSync(sessionPath)) {
        session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } else if (fs.existsSync(legacyMetaPath)) {
        // Fall back to legacy format, convert on read
        const meta = JSON.parse(fs.readFileSync(legacyMetaPath, 'utf-8'));
        session = {
            name: meta.name || name,
            description: '',
            baseUrl: meta.targetUrl || '',
            credentials: {},
            variables: {},
            auth: {},
            source: 'legacy',
            created: meta.created,
            lastUsed: meta.lastUsed
        };
    }

    if (!session) return null;

    // Attach browser state if exists
    if (fs.existsSync(statePath)) {
        session.hasState = true;
    }

    return session;
}

/**
 * Save a session (writes session.json, optionally state.json)
 */
function saveSession(org, name, sessionData, browserState = null) {
    const sessionDir = getSessionDir(org, name);
    ensureDir(sessionDir);

    const now = new Date().toISOString();
    const sessionPath = path.join(sessionDir, 'session.json');
    const statePath = path.join(sessionDir, 'state.json');

    // Check if updating existing
    const isNew = !fs.existsSync(sessionPath);
    let existingSession = null;
    if (!isNew) {
        try {
            existingSession = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        } catch {}
    }

    const session = {
        name,
        description: sessionData.description || '',
        baseUrl: sessionData.baseUrl || '',
        credentials: sessionData.credentials || {},
        variables: sessionData.variables || {},
        auth: sessionData.auth || {},
        source: sessionData.source || 'manual',
        created: existingSession?.created || now,
        lastUsed: now
    };

    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));

    // Write browser state if provided
    if (browserState) {
        fs.writeFileSync(statePath, JSON.stringify(browserState, null, 2));
    }

    // Also write legacy meta.json for backward compatibility with existing code
    const legacyMeta = {
        name,
        targetUrl: session.baseUrl,
        created: session.created,
        lastUsed: session.lastUsed
    };
    fs.writeFileSync(path.join(sessionDir, 'meta.json'), JSON.stringify(legacyMeta, null, 2));

    return { session, isNew };
}

/**
 * Get all variables for a session (credentials + variables + auth)
 * Used for variable interpolation in journeys
 */
function getSessionVariables(session) {
    const vars = { ...session.variables };

    // Add credentials as variables
    if (session.credentials) {
        if (session.credentials.username) vars.username = session.credentials.username;
        if (session.credentials.password) vars.password = session.credentials.password;
    }

    // Add baseUrl
    if (session.baseUrl) vars.baseUrl = session.baseUrl;

    // Add JWT if present
    if (session.auth?.jwt) vars.jwt = session.auth.jwt;

    return vars;
}

/**
 * Interpolate {{variables}} in a string
 */
function interpolate(str, vars) {
    if (typeof str !== 'string') return str;
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return vars.hasOwnProperty(key) ? vars[key] : match;
    });
}

/**
 * Interpolate variables in steps array
 */
function interpolateSteps(steps, vars) {
    return steps.map(step => {
        const newStep = { ...step };
        // Interpolate common string fields
        if (newStep.url) newStep.url = interpolate(newStep.url, vars);
        if (newStep.value) newStep.value = interpolate(newStep.value, vars);
        if (newStep.selector) newStep.selector = interpolate(newStep.selector, vars);
        if (newStep.script) newStep.script = interpolate(newStep.script, vars);
        if (newStep.name) newStep.name = interpolate(newStep.name, vars);  // for saveSession
        return newStep;
    });
}

function generateId() {
    const now = new Date();
    const date = now.toISOString().replace(/[-:]/g, '').split('.')[0];
    const rand = Math.random().toString(36).substring(2, 6);
    return `${date}-${rand}`;
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

/**
 * Run a Playwright script and return parsed JSON result
 * Uses async spawn to avoid blocking the server (deadlock when capturing localhost)
 */
function runPlaywrightScript(script, outputDir, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(outputDir, '_capture-script.js');
        const serverDir = path.join(__dirname, '../..');

        // Write script to temp file
        fs.writeFileSync(scriptPath, script);

        console.log('[capture] Running script:', scriptPath);

        const proc = spawn('node', [scriptPath], {
            cwd: serverDir,
            env: { ...process.env, NODE_PATH: path.join(serverDir, 'node_modules') }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        const timer = setTimeout(() => {
            proc.kill();
            reject(new Error('Script timeout'));
        }, timeout);

        proc.on('close', (code) => {
            clearTimeout(timer);

            // Clean up script
            try { fs.unlinkSync(scriptPath); } catch {}

            if (code !== 0) {
                console.log('[capture] Script failed:', stderr || stdout);
                reject(new Error(stderr || stdout || `Exit code ${code}`));
                return;
            }

            // Parse JSON from output
            try {
                const lines = stdout.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                resolve(JSON.parse(jsonLine));
            } catch (e) {
                reject(new Error(`Failed to parse output: ${stdout}`));
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

module.exports = {
    TETRA_DIR,
    ORGS_DIR,
    getCaptureDir,
    getSessionDir,
    getSessionsDir,
    getSessionPath,
    getSessionStatePath,
    getJourneysDir,
    getJourneyPath,
    generateId,
    ensureDir,
    runPlaywrightScript,
    loadSession,
    saveSession,
    getSessionVariables,
    interpolate,
    interpolateSteps
};
