const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Detect bash 5.2+ path portably
 * Priority: BASH_PATH env > common locations
 */
function detectBash() {
    // Environment override
    if (process.env.BASH_PATH) {
        return process.env.BASH_PATH;
    }

    // Common bash locations (in priority order)
    const candidates = [
        '/opt/homebrew/bin/bash',  // macOS ARM (Homebrew)
        '/usr/local/bin/bash',     // macOS Intel (Homebrew) / Linux custom
        '/bin/bash',               // Linux default
        '/usr/bin/bash'            // Some Linux distros
    ];

    for (const path of candidates) {
        if (fs.existsSync(path)) {
            // Verify it's bash 5.2+
            try {
                const version = execSync(`${path} --version 2>/dev/null | head -1`, { encoding: 'utf8' });
                const match = version.match(/version (\d+)\.(\d+)/);
                if (match) {
                    const major = parseInt(match[1]);
                    const minor = parseInt(match[2]);
                    if (major > 5 || (major === 5 && minor >= 2)) {
                        return path;
                    }
                }
            } catch (e) {
                // Skip this candidate
            }
        }
    }

    // Fallback - hope for the best
    console.warn('[bash] No bash 5.2+ found, using /bin/bash');
    return '/bin/bash';
}

const BASH = detectBash();

module.exports = { BASH, detectBash };
