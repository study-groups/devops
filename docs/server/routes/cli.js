const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { authMiddleware } = require('../middleware/auth');
const fs = require('fs');

/**
 * Execute a command and return the result
 * @param {string} command - The command to execute
 * @param {string} username - The username of the authenticated user
 * @returns {Promise<string>} - The command output
 */
function executeCommand(command, username) {
    return new Promise((resolve, reject) => {
        console.log(`[CLI] User ${username} executing command: ${command}`);

        // Determine the bash path.  This is the *most* crucial part for your use case.
        const bashPaths = ['/usr/bin/bash', '/bin/bash'];
        let shell = '/bin/sh'; // Fallback
        for (const bashPath of bashPaths) {
            if (fs.existsSync(bashPath)) {
                shell = bashPath;
                break;
            }
        }
        console.log(`[CLI] Using shell: ${shell}`);

        // Source ONLY api-env.sh, using the FULL, CORRECTED PATH.
        //  *** REPLACE THIS WITH THE ACTUAL ABSOLUTE PATH TO api-env.sh ***
        const fullCommand = `source  /root/src/devops/docs/api-env.sh; ${command}`;

        exec(`${shell} -c "${fullCommand}"`, (error, stdout, stderr) => {
            if (error) {
                // Combine stdout, stderr, and the error message for a complete error report.
                const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
                reject(new Error(`Command failed: ${error.message}\n${output}`));
                return;
            }

            const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
            resolve(output);
        });
    });
}

// CLI command execution endpoint
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { command } = req.body;
        const username = req.auth?.name || 'anonymous';
        
        console.log(`[CLI] Received command request from ${username}: ${command}`);
        
        if (!command) {
            console.log('[CLI] Missing command in request');
            return res.status(400).json({ error: 'Command is required' });
        }
        
        try {
            const output = await executeCommand(command, username);
            res.json({ output });
        } catch (error) {
            console.error(`[CLI ERROR] ${error.message}`);
            res.status(500).json({ 
                error: 'Command execution failed',
                output: `Error: ${error.message}`
            });
        }
    } catch (error) {
        console.error(`[CLI ERROR] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint to check if CLI API is working
router.get('/', (req, res) => {
    res.json({ 
        status: 'CLI API is operational',
        usage: 'POST /api/cli with {"command": "your command here"}'
    });
});

// Get available commands (safe ones)
router.get('/commands', authMiddleware, (req, res) => {
    const safeCommands = [
        { command: 'ls', description: 'List directory contents' },
        { command: 'pwd', description: 'Print working directory' },
        { command: 'date', description: 'Show current date and time' },
        { command: 'echo', description: 'Display a line of text' },
        { command: 'cat', description: 'Concatenate files and print on the standard output' },
        { command: 'find', description: 'Search for files in a directory hierarchy' },
        { command: 'grep', description: 'Print lines that match patterns' },
        { command: 'wc', description: 'Print newline, word, and byte counts for each file' },
        { command: 'df', description: 'Report file system disk space usage' },
        { command: 'qa_help', description: 'QAv' },
        { command: 'du', description: 'Estimate file space usage' }
    ];
    
    res.json({ commands: safeCommands });
});

module.exports = router; 