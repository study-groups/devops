import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Define Paths ---
const QA_DIR = process.env.QA_DIR || path.resolve(__dirname, '../../qa'); // Base QA dir
const QA_SCRIPT_PATH = '/root/src/bash/qa/qa.sh';
// --- End Paths ---

// --- Helper: Find Bash ---
function findBash() {
    const bashPaths = ['/usr/bin/bash', '/bin/bash'];
    for (const p of bashPaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}
// --- End Helper ---

// --- Execute Command via SPAWN / Stdin pipe ---
function executeCommandViaStdin(commandName, encodedData, environment, username) {
    return new Promise((resolve, reject) => {
        console.log(`[CLI Spawn] User ${username} executing '${commandName}' via spawn/stdin.`);
        if (environment && Object.keys(environment).length > 0) {
            console.log(`[CLI Spawn] With environment overrides:`, Object.keys(environment));
        }

        const bashPath = findBash();
        if (!bashPath) return reject(new Error('Bash executable not found.'));
        console.log(`[CLI Spawn] Using bash: ${bashPath}`);

        try { fs.accessSync(QA_SCRIPT_PATH); } catch (e) { return reject(new Error(`Core qa.sh script not found at ${QA_SCRIPT_PATH}`)); }

        let decodedData;
        try {
            // Decode the data that will be written to stdin
            decodedData = Buffer.from(encodedData || '', 'base64').toString('utf8');
            console.log(`[CLI Spawn] Decoded data length for stdin: ${decodedData.length}`);
            console.log(`[CLI Spawn] Decoded data preview: "${decodedData.substring(0, 100)}${decodedData.length > 100 ? '...' : ''}"`);
        } catch (e) {
            console.error('[CLI Spawn] Base64 decode failed:', e);
            return reject(new Error('Invalid Base64 data received.'));
        }

        // Environment for the spawned process (No QA_INPUT_B64 needed now)
        const executionEnv = {
            ...process.env,
            ...environment
        };

        // Command to execute within the shell
        // Script will read stdin provided by spawn
        const commandString = `source "${QA_SCRIPT_PATH}"; ${commandName}`;
        console.log(`[CLI Spawn] Command string for bash -c: ${commandString}`);

        // --- Spawn Logic ---
        const child = spawn(bashPath, ['-c', commandString], {
            env: executionEnv,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let stdoutClosed = false;
        let stderrClosed = false;
        let processExited = false;
        let exitCode = null;

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            console.log('[CLI Spawn STDOUT Chunk]:', chunk.substring(0, 200) + (chunk.length > 200 ? '...' : '')); // Log chunks
            stdout += chunk;
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            console.error('[CLI Spawn STDERR Chunk]:', chunk.substring(0, 200) + (chunk.length > 200 ? '...' : '')); // Log chunks
            stderr += chunk;
        });

        child.on('error', (error) => {
            console.error('[CLI Spawn ON ERROR RAW]', error);
            reject(new Error(`'${commandName}' spawn failed: ${error.message}`));
        });

        child.on('exit', (code) => {
             console.log(`[CLI Spawn] Process exited with code: ${code}`);
             processExited = true;
             exitCode = code;
             checkCompletion();
        });

        child.stdout.on('close', () => {
             console.log('[CLI Spawn] stdout stream closed.');
             stdoutClosed = true;
             checkCompletion();
        });
        child.stderr.on('close', () => {
             console.log('[CLI Spawn] stderr stream closed.');
             stderrClosed = true;
             checkCompletion();
        });

        const checkCompletion = () => {
             if (stdoutClosed && stderrClosed && processExited) {
                  console.log(`[CLI Spawn] All conditions met. Final Exit Code: ${exitCode}`);
                  if (exitCode !== 0) {
                       const errorOutput = stderr || stdout;
                       reject(new Error(`'${commandName}' execution failed (Exit Code: ${exitCode})\n${errorOutput.trim()}`));
                  } else {
                       const combinedOutput = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
                       resolve(combinedOutput.trim());
                  }
             } else {
                 // Optional: Log which condition is still pending
                 // console.log(`[CLI Spawn] Waiting for completion: stdout=${stdoutClosed}, stderr=${stderrClosed}, exit=${processExited}`);
             }
        };

        child.stdin.write(decodedData, (err) => {
             if (err) {
                  console.error('[CLI Spawn] Error writing to stdin:', err);
                  // Optionally try to kill the process or handle the error
             }
             child.stdin.end();
             console.log('[CLI Spawn] stdin closed after writing.');
        });

    });
}

// --- CLI Route Handler (Simplified for single execution path) ---
router.post('/', authMiddleware, async (req, res) => {
    try {
        console.log('[CLI Route] Received POST request.');
        console.log('[CLI Route] Request Body RAW:', req.body);

        // Expect the simplified payload { command, encoded_data, environment? }
        const { command, encoded_data, environment } = req.body;
        const username = req.user?.username || 'anonymous';
        const envOrDefault = environment || {}; // Accept optional environment

        console.log(`[CLI Route] Extracted command: ${command}`);
        // No need to log encoded_data here anymore if it's large
        console.log(`[CLI Route] Type of encoded_data: ${typeof encoded_data}`);

        // Validate required fields for this simplified flow
        if (!command || typeof encoded_data === 'undefined') {
             console.log('[CLI Route] Validation FAILED. command value:', command, 'encoded_data value:', encoded_data);
             console.log('[CLI Route] Invalid payload: missing command or encoded_data');
             return res.status(400).json({ error: 'Invalid request: missing command or encoded_data' });
        }

        console.log(`[CLI Route] Validation PASSED. Routing to executeCommandViaStdin for command '${command}'`);
        try {
             // Call the updated execution function
             const output = await executeCommandViaStdin(command, encoded_data, envOrDefault, username);
             res.json({ output });
        } catch (error) {
             // Log the specific error caught from the promise rejection
             console.error(`[CLI Route Spawn CATCH ERROR] Command '${command}' failed:`, error);
             // Send a generic error message, but include the detailed one from the Error object
             res.status(500).json({ error: 'Command execution failed', output: `${error.message}` });
        }
    } catch (error) {
        console.error(`[CLI Route UNEXPECTED ERROR] ${error.message}`);
        res.status(500).json({ error: 'Internal server error processing CLI request' });
    }
});

// Test endpoint to check if CLI API is working
router.get('/', (req, res) => {
    res.json({
        status: 'CLI API is operational',
        // Updated usage reflects the simplified POST format
        usage: 'POST /api/cli with {"command": "cmd_name", "encoded_data":"base64_of_args_and_data", "environment":{...} }'
    });
});

// Get available commands (safe ones)
router.get('/commands', authMiddleware, (req, res) => {
    // Note: While listed, only commands that read stdin correctly will function as expected via POST.
    const safeCommands = [
        { command: 'qq', description: 'Query OpenAI (Default)' },
        { command: 'q1', description: 'Query GPT-3.5 Turbo' },
        { command: 'q2', description: 'Query GPT-4 Turbo' },
        { command: 'q3', description: 'Query GPT-4o Mini' },
        { command: 'q4', description: 'Query ChatGPT 4o Latest' },
        { command: 'a', description: 'Show last answer (Likely broken via web)'},
        { command: 'fa', description: 'Show formatted answer (Likely broken via web)'},
        { command: 'ls', description: 'List directory contents (Likely broken via web if args needed)' },
        { command: 'pwd', description: 'Print working directory' },
        { command: 'date', description: 'Show current date and time' },
        { command: 'echo', description: 'Display text (Reads stdin)' },
        { command: 'cat', description: 'Concatenate files (Reads stdin)' },
        // ... other commands ...
    ];
    res.json({ commands: safeCommands });
});

export default router; 
