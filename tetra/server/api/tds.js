const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const router = express.Router();

/**
 * TDS (Tetra Design System) API
 * Provides color palette data for web dashboard parity with CLI
 */

const TETRA_SRC = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
const BASH = process.env.SHELL || '/bin/bash';

// Fallback colors matching shared.css defaults
const FALLBACK_COLORS = {
    paperDark: '#0a0a0a',
    paperMid: '#1a1a1a',
    paperLight: '#2a2a2a',
    ink: '#e0e0e0',
    inkMuted: '#666666',
    border: '#333333',
    one: '#ff6b6b',      // error, danger, prod
    two: '#4ecdc4',      // success, online, local
    three: '#ffe66d',    // warning, dev/staging
    four: '#6b5ce7'      // accent, active
};

// CSS variable name mapping (for generating CSS)
const CSS_VAR_MAP = {
    paperDark: '--paper-dark',
    paperMid: '--paper-mid',
    paperLight: '--paper-light',
    ink: '--ink',
    inkMuted: '--ink-muted',
    border: '--border',
    one: '--one',
    two: '--two',
    three: '--three',
    four: '--four'
};

/**
 * Get TDS colors by executing bash export
 */
function getTdsColors() {
    try {
        const cmd = `source ~/tetra/tetra.sh && tmod load tds 2>/dev/null && source ${TETRA_SRC}/bash/tds/exports/css_export.sh && tds_export_css_json`;
        const output = execSync(cmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 5000
        });
        return JSON.parse(output.trim());
    } catch (err) {
        // Return fallback colors if TDS isn't available
        return FALLBACK_COLORS;
    }
}

/**
 * GET /api/tds/colors
 * Returns current TDS color palette as JSON
 */
router.get('/colors', (req, res) => {
    const colors = getTdsColors();
    res.json({
        colors,
        source: colors === FALLBACK_COLORS ? 'fallback' : 'tds',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/tds/colors.css
 * Returns colors as CSS :root block (for direct stylesheet import)
 */
router.get('/colors.css', (req, res) => {
    const colors = getTdsColors();

    let css = `/* TDS Colors - Generated */\n`;
    css += `/* Source: /api/tds/colors.css */\n\n`;
    css += `:root {\n`;

    for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
        const value = colors[key] || FALLBACK_COLORS[key];
        css += `    ${cssVar}: ${value};\n`;
    }

    css += `}\n`;

    res.type('text/css').send(css);
});

/**
 * GET /api/tds/themes
 * List available TDS themes
 */
router.get('/themes', (req, res) => {
    try {
        const cmd = `source ~/tetra/tetra.sh && tmod load tds 2>/dev/null && ls ${TETRA_SRC}/bash/tds/themes/*.sh 2>/dev/null | xargs -n1 basename | sed 's/\\.sh$//'`;
        const output = execSync(cmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 5000
        });
        const themes = output.trim().split('\n').filter(t => t && t !== 'theme_registry');
        res.json({ themes });
    } catch (err) {
        res.json({ themes: ['default', 'warm', 'cool', 'arctic', 'neutral', 'electric'] });
    }
});

/**
 * GET /api/tds/status
 * Check TDS availability
 */
router.get('/status', (req, res) => {
    res.json({
        service: 'tds',
        status: 'active',
        message: 'Tetra Design System color API'
    });
});

module.exports = router;
