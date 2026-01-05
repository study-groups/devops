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
    generateId,
    ensureDir,
    runPlaywrightScript
};
