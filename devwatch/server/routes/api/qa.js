/**
 * QA API Routes
 * Integration with tetra/bash/qa system
 */

const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();

// POST /api/qa/query
// Send context + prompt to tetra QA system
router.post('/query', async (req, res) => {
    const { context, prompt, channel = 'db' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // Build full prompt with context
    let fullPrompt = prompt;
    if (context && context.trim()) {
        fullPrompt = `Given this context:\n\n${context}\n\n${prompt}`;
    }

    // Sanitize prompt - escape special characters for shell
    const sanitizedPrompt = fullPrompt
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`');

    // Build the qq command
    // qq :channel "prompt" - use channel prefix if not 'db'
    const channelArg = channel !== 'db' ? `:${channel} ` : '';

    const command = `source ~/tetra/tetra.sh && qq ${channelArg}"${sanitizedPrompt}"`;

    console.log('[QA] Executing query:', { channel, promptLength: prompt.length, hasContext: !!context });

    try {
        const result = await new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const proc = spawn('bash', ['-c', command], {
                env: { ...process.env, HOME: process.env.HOME },
                timeout: 120000 // 2 minute timeout
            });

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('error', (error) => {
                reject(new Error(`Process error: ${error.message}`));
            });

            proc.on('close', (code) => {
                if (code !== 0 && !stdout) {
                    reject(new Error(stderr || `Process exited with code ${code}`));
                } else {
                    resolve({ stdout, stderr, code });
                }
            });
        });

        // Parse QA_ID from stderr if present
        let qaId = null;
        const qaIdMatch = result.stderr.match(/QA_ID=(\S+)/);
        if (qaIdMatch) {
            qaId = qaIdMatch[1];
        }

        // Also try to get QA_ID from stdout (some versions output it there)
        if (!qaId) {
            const stdoutQaIdMatch = result.stdout.match(/QA_ID[=:]?\s*(\S+)/i);
            if (stdoutQaIdMatch) {
                qaId = stdoutQaIdMatch[1];
            }
        }

        res.json({
            answer: result.stdout.trim(),
            qaId: qaId || `qa_${Date.now()}`,
            channel,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[QA] Query failed:', error.message);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/qa/channels
// List available QA channels
router.get('/channels', async (req, res) => {
    // Default channels available in tetra QA system
    const defaultChannels = [
        { id: 'db', name: 'Main Database', description: 'Default QA channel' },
        { id: '1', name: 'Channel 1', description: 'Custom channel 1' },
        { id: '2', name: 'Channel 2', description: 'Custom channel 2' },
        { id: '3', name: 'Channel 3', description: 'Custom channel 3' },
        { id: '4', name: 'Channel 4', description: 'Custom channel 4' }
    ];

    // Try to get additional channels from tetra
    try {
        const result = await new Promise((resolve, reject) => {
            let stdout = '';

            const proc = spawn('bash', ['-c', 'source ~/tetra/tetra.sh && qq_channels 2>/dev/null || echo ""'], {
                env: { ...process.env, HOME: process.env.HOME },
                timeout: 5000
            });

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.on('error', () => resolve({ stdout: '' }));
            proc.on('close', () => resolve({ stdout }));
        });

        // Parse additional channels if the command returned any
        if (result.stdout.trim()) {
            const extraChannels = result.stdout.trim().split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.split(/\s+/);
                    return {
                        id: parts[0],
                        name: parts.slice(1).join(' ') || parts[0],
                        description: 'Custom channel'
                    };
                });

            // Merge with defaults, avoiding duplicates
            const channelIds = new Set(defaultChannels.map(c => c.id));
            for (const ch of extraChannels) {
                if (!channelIds.has(ch.id)) {
                    defaultChannels.push(ch);
                }
            }
        }
    } catch (e) {
        // Ignore errors, just return default channels
        console.log('[QA] Could not fetch additional channels:', e.message);
    }

    res.json(defaultChannels);
});

// GET /api/qa/history
// Get recent QA history (if available)
router.get('/history', async (req, res) => {
    const { channel = 'db', limit = 20 } = req.query;

    try {
        const result = await new Promise((resolve, reject) => {
            let stdout = '';

            const channelArg = channel !== 'db' ? `:${channel}` : '';
            const proc = spawn('bash', ['-c', `source ~/tetra/tetra.sh && qq_history ${channelArg} ${limit} 2>/dev/null || echo ""`], {
                env: { ...process.env, HOME: process.env.HOME },
                timeout: 10000
            });

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.on('error', () => resolve({ stdout: '' }));
            proc.on('close', () => resolve({ stdout }));
        });

        // Try to parse as JSON, otherwise return as text
        try {
            const history = JSON.parse(result.stdout);
            res.json(history);
        } catch {
            res.json({
                channel,
                entries: result.stdout.trim() ? result.stdout.trim().split('\n') : [],
                format: 'text'
            });
        }
    } catch (error) {
        res.json({ channel, entries: [], error: error.message });
    }
});

module.exports = router;
