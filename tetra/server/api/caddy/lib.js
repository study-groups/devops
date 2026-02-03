// Caddy API - Shared helpers, constants, and utilities

const { execSync, execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const fs = require('fs');
const path = require('path');
const http = require('http');
const { BASH } = require('../../lib/bash');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');
const CADDY_ADMIN_PORT = process.env.CADDY_ADMIN_PORT || 2019;

// Simple TTL cache for expensive operations
const cache = new Map();
const CACHE_TTL = 15000; // 15 seconds — prevents cache misses during slow SSH calls

function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.time < CACHE_TTL) {
        return entry.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, time: Date.now() });
}

function caddyApiGet(endpoint) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: CADDY_ADMIN_PORT,
            path: '/' + endpoint,
            method: 'GET',
            timeout: 3000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.end();
    });
}

function caddyApiPost(endpoint, data) {
    return new Promise((resolve) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: CADDY_ADMIN_PORT,
            path: '/' + endpoint,
            method: 'POST',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ success: res.statusCode >= 200 && res.statusCode < 300, data });
            });
        });

        req.on('error', (e) => resolve({ success: false, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
        req.write(postData);
        req.end();
    });
}

async function isCaddyApiAvailable() {
    const config = await caddyApiGet('config/');
    return config !== null;
}

function getCaddyPaths(org, env) {
    if (env === 'local') {
        const caddyDir = path.join(ORGS_DIR, org, 'caddy');
        const logDir = path.join(TETRA_DIR, 'run', 'logs');
        const targetEnv = 'dev';
        const envCaddyfile = path.join(caddyDir, `${targetEnv}.Caddyfile`);
        const fallbackCaddyfile = path.join(caddyDir, 'Caddyfile');
        return {
            caddyDir,
            caddyfile: fs.existsSync(envCaddyfile) ? envCaddyfile : fallbackCaddyfile,
            modulesDir: path.join(caddyDir, 'modules', targetEnv),
            logDir: logDir,
            logFile: path.join(logDir, 'caddy.log'),
            isLocal: true,
            targetEnv
        };
    } else {
        return {
            caddyDir: '/etc/caddy',
            caddyfile: '/etc/caddy/Caddyfile',
            modulesDir: `/etc/caddy/modules/${env}`,
            logDir: '/var/log/caddy',
            logFile: null,
            isLocal: false,
            targetEnv: env
        };
    }
}

function parseToml(content) {
    const result = {};
    let currentSection = null;
    let currentSubsection = null;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            const parts = sectionMatch[1].split('.');
            currentSection = parts[0];
            currentSubsection = parts.length > 1 ? parts[1] : null;
            if (!result[currentSection]) result[currentSection] = {};
            if (currentSubsection && !result[currentSection][currentSubsection]) {
                result[currentSection][currentSubsection] = {};
            }
            continue;
        }

        const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (kvMatch && currentSection) {
            let value = kvMatch[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (value === 'true') value = true;
            else if (value === 'false') value = false;

            if (currentSubsection) {
                result[currentSection][currentSubsection][kvMatch[1]] = value;
            } else {
                result[currentSection][kvMatch[1]] = value;
            }
        }
    }
    return result;
}

function getSSHConfig(org, env) {
    if (env === 'local') return null;

    const tomlPath = path.join(ORGS_DIR, org, 'tetra.toml');

    if (fs.existsSync(tomlPath)) {
        try {
            const content = fs.readFileSync(tomlPath, 'utf-8');
            const config = parseToml(content);
            const envConfig = config.env?.[env];

            if (envConfig?.host) {
                if (envConfig.host === 'localhost' || envConfig.host === '127.0.0.1') {
                    return null;
                }
                const user = envConfig.auth_user || envConfig.user || 'root';
                return `${user}@${envConfig.host}`;
            }
        } catch (e) {
            console.warn(`[Caddy] Failed to parse ${tomlPath}:`, e.message);
        }
    }

    const legacyDirs = ['targets/tetra', 'targets/tsm', 'targets'];
    for (const targetDir of legacyDirs) {
        const legacyPath = path.join(ORGS_DIR, org, targetDir, 'tetra-deploy.toml');
        if (fs.existsSync(legacyPath)) {
            try {
                const content = fs.readFileSync(legacyPath, 'utf-8');
                const config = parseToml(content);
                return config.env?.[env]?.ssh || null;
            } catch (e) {
                // ignore
            }
        }
    }

    return null;
}

// Extended SSH info including droplet name, IPs, and floating IP warning
function getSSHInfo(org, env) {
    if (env === 'local') {
        return { ssh: null, host: 'localhost', isLocal: true };
    }

    const tomlPath = path.join(ORGS_DIR, org, 'tetra.toml');
    const result = {
        ssh: null,
        host: null,
        privateIp: null,
        dropletName: null,
        description: null,
        domain: null,
        isLocal: false,
        isFloatingIp: false
    };

    if (fs.existsSync(tomlPath)) {
        try {
            const content = fs.readFileSync(tomlPath, 'utf-8');
            const config = parseToml(content);
            const envConfig = config.env?.[env];

            if (envConfig?.host) {
                if (envConfig.host === 'localhost' || envConfig.host === '127.0.0.1') {
                    return { ssh: null, host: 'localhost', isLocal: true };
                }

                const user = envConfig.auth_user || envConfig.user || 'root';
                result.ssh = `${user}@${envConfig.host}`;
                result.host = envConfig.host;
                result.privateIp = envConfig.private_ip || null;
                result.domain = envConfig.domain || null;
                result.description = envConfig.description || null;

                // Extract droplet name from description like "Dev server (pxjam-arcade-dev01)"
                const nameMatch = envConfig.description?.match(/\(([^)]+)\)/);
                result.dropletName = nameMatch ? nameMatch[1] : null;

                // Check for floating IP indicator (typically 159.x.x.x or reserved_ip field)
                // DigitalOcean floating IPs are in specific ranges; also check if explicitly marked
                if (envConfig.floating_ip || envConfig.reserved_ip) {
                    result.isFloatingIp = true;
                    result.floatingIp = envConfig.floating_ip || envConfig.reserved_ip;
                }
            }
        } catch (e) {
            console.warn(`[Caddy] Failed to parse ${tomlPath}:`, e.message);
        }
    }

    return result;
}

const SSH_MUX_OPTS = '-o ControlMaster=auto -o ControlPath=/tmp/tetra-ssh-%r@%h:%p -o ControlPersist=300';

function runCmd(cmd, org = 'tetra', env = 'local') {
    const ssh = getSSHConfig(org, env);

    if (ssh) {
        const sshCmd = `ssh ${SSH_MUX_OPTS} -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${ssh} '${cmd.replace(/'/g, "'\\''")}'`;
        return execSync(sshCmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 30000
        });
    } else {
        return execSync(cmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 10000
        });
    }
}

// Async version — does NOT block the event loop
async function runCmdAsync(cmd, org = 'tetra', env = 'local') {
    const ssh = getSSHConfig(org, env);

    if (ssh) {
        const sshCmd = `ssh ${SSH_MUX_OPTS} -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${ssh} '${cmd.replace(/'/g, "'\\''")}'`;
        const { stdout } = await execFileAsync(BASH, ['-c', sshCmd], {
            encoding: 'utf8',
            timeout: 30000
        });
        return stdout;
    } else {
        const { stdout } = await execFileAsync(BASH, ['-c', cmd], {
            encoding: 'utf8',
            timeout: 10000
        });
        return stdout;
    }
}

function parseRoutes(content, modulesDir, isLocal) {
    const routes = [];

    const lines = content.split('\n');
    let fullContent = '';

    for (const line of lines) {
        const importMatch = line.trim().match(/^import\s+(.+)$/);
        if (importMatch && isLocal) {
            const importPath = importMatch[1];
            const modulePath = path.join(path.dirname(modulesDir), importPath);
            try {
                if (fs.existsSync(modulePath)) {
                    fullContent += '\n# ' + importPath + '\n';
                    fullContent += fs.readFileSync(modulePath, 'utf-8');
                }
            } catch (e) {
                // Ignore import errors
            }
        } else {
            fullContent += line + '\n';
        }
    }

    const handleRegex = /handle\s+([^\{]+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = handleRegex.exec(fullContent)) !== null) {
        const routePath = match[1].trim();
        const block = match[2];

        const proxyMatch = block.match(/reverse_proxy\s+(\S+)/);
        if (proxyMatch) {
            routes.push({
                path: routePath,
                upstream: proxyMatch[1],
                type: 'reverse_proxy'
            });
        }
    }

    const defaultHandle = fullContent.match(/handle\s*\{([^}]+)\}/);
    if (defaultHandle) {
        const proxyMatch = defaultHandle[1].match(/reverse_proxy\s+(\S+)/);
        if (proxyMatch) {
            routes.push({
                path: '/*',
                upstream: proxyMatch[1],
                type: 'reverse_proxy (default)'
            });
        }
    }

    return routes;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = {
    TETRA_DIR, ORGS_DIR, CADDY_ADMIN_PORT, BASH,
    getCached, setCache,
    caddyApiGet, caddyApiPost, isCaddyApiAvailable,
    getCaddyPaths, getSSHConfig, getSSHInfo, runCmd, runCmdAsync,
    parseToml, parseRoutes, formatFileSize
};
