/**
 * Tetra Exec - Shared bash execution utilities
 * Standardizes how server APIs invoke tetra bash commands
 */
const { execSync, exec, spawn } = require('child_process');
const path = require('path');
const { BASH } = require('./bash');

const TETRA_SRC = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');

/**
 * Execute a tetra command synchronously
 * @param {string|string[]} modules - Module(s) to load (e.g., 'deploy' or ['nh_bridge', 'org'])
 * @param {string} cmd - Command to run after loading modules
 * @param {Object} opts - Options
 * @param {number} opts.timeout - Timeout in ms (default: 30000)
 * @param {boolean} opts.json - Parse output as JSON (default: false)
 * @param {Object} opts.env - Additional environment variables
 * @returns {string|Object} Command output (or parsed JSON if opts.json)
 */
function tetraExec(modules, cmd, opts = {}) {
    const moduleList = Array.isArray(modules) ? modules : [modules];
    const loadModules = moduleList.map(m => `tmod load ${m}`).join(' && ');

    const fullCmd = `source ~/tetra/tetra.sh && ${loadModules} && ${cmd}`;

    const result = execSync(fullCmd, {
        shell: BASH,
        encoding: 'utf8',
        timeout: opts.timeout || 30000,
        env: { ...process.env, TETRA_SRC, TETRA_DIR, ...opts.env }
    });

    if (opts.json) {
        try {
            return JSON.parse(result.trim());
        } catch (e) {
            return { error: 'Failed to parse JSON', raw: result };
        }
    }

    return result;
}

/**
 * Execute a tetra command asynchronously
 * @param {string|string[]} modules - Module(s) to load
 * @param {string} cmd - Command to run
 * @param {Function} callback - (err, stdout, stderr) callback
 * @param {Object} opts - Options (timeout, env)
 */
function tetraExecAsync(modules, cmd, callback, opts = {}) {
    const moduleList = Array.isArray(modules) ? modules : [modules];
    const loadModules = moduleList.map(m => `tmod load ${m}`).join(' && ');

    const fullCmd = `source ~/tetra/tetra.sh && ${loadModules} && ${cmd}`;

    exec(fullCmd, {
        shell: BASH,
        timeout: opts.timeout || 30000,
        env: { ...process.env, TETRA_SRC, TETRA_DIR, ...opts.env }
    }, callback);
}

/**
 * Spawn a tetra command for streaming output
 * @param {string|string[]} modules - Module(s) to load
 * @param {string} cmd - Command to run
 * @param {Object} opts - Spawn options
 * @returns {ChildProcess} Spawned process
 */
function tetraSpawn(modules, cmd, opts = {}) {
    const moduleList = Array.isArray(modules) ? modules : [modules];
    const loadModules = moduleList.map(m => `tmod load ${m}`).join(' && ');

    const fullCmd = `source ~/tetra/tetra.sh && ${loadModules} && ${cmd}`;

    return spawn(BASH, ['-c', fullCmd], {
        env: { ...process.env, TETRA_SRC, TETRA_DIR, TERM: 'dumb', ...opts.env },
        ...opts
    });
}

/**
 * Execute a raw bash command (no module loading)
 * @param {string} cmd - Command to run
 * @param {Object} opts - Options
 */
function bashExec(cmd, opts = {}) {
    const fullCmd = `source ~/tetra/tetra.sh && ${cmd}`;

    return execSync(fullCmd, {
        shell: BASH,
        encoding: 'utf8',
        timeout: opts.timeout || 30000,
        env: { ...process.env, TETRA_SRC, TETRA_DIR, ...opts.env }
    });
}

/**
 * Execute with SSH support (for remote environments)
 * @param {string} ssh - SSH target (user@host) or null for local
 * @param {string} cmd - Command to run
 * @param {Object} opts - Options
 */
function sshExec(ssh, cmd, opts = {}) {
    if (!ssh) {
        return bashExec(cmd, opts);
    }

    const remoteCmd = `source ~/tetra/tetra.sh 2>/dev/null && ${cmd}`;
    const sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${ssh} '${remoteCmd.replace(/'/g, "'\\''")}'`;

    return execSync(sshCmd, {
        shell: BASH,
        encoding: 'utf8',
        timeout: opts.timeout || 30000
    });
}

/**
 * Async SSH execution
 */
function sshExecAsync(ssh, cmd, callback, opts = {}) {
    if (!ssh) {
        const fullCmd = `source ~/tetra/tetra.sh && ${cmd}`;
        exec(fullCmd, { shell: BASH, timeout: opts.timeout || 30000 }, callback);
        return;
    }

    const remoteCmd = `source ~/tetra/tetra.sh 2>/dev/null && ${cmd}`;
    const sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${ssh} '${remoteCmd.replace(/'/g, "'\\''")}'`;

    exec(sshCmd, { shell: BASH, timeout: opts.timeout || 30000 }, callback);
}

module.exports = {
    tetraExec,
    tetraExecAsync,
    tetraSpawn,
    bashExec,
    sshExec,
    sshExecAsync,
    TETRA_SRC,
    TETRA_DIR,
    BASH
};
