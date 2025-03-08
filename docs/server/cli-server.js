/**
 * Standalone CLI Server
 * 
 * This file creates a simple Express server that provides the CLI functionality.
 * It can be run separately from the main server if needed.
 * 
 * Usage: node cli-server.js
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');

// Create Express app
const app = express();
const PORT = process.env.CLI_PORT || 3001;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[CLI SERVER] ${req.method} ${req.url}`);
    next();
});

// CLI endpoint
app.post('/api/cli', (req, res) => {
    try {
        const { command } = req.body;
        const username = req.headers.authorization ? 'authenticated-user' : 'anonymous';
        
        console.log(`[CLI SERVER] Received command from ${username}: ${command}`);
        
        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }
        
        // Execute the command
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`[CLI SERVER ERROR] Command execution failed: ${error.message}`);
                return res.status(500).json({ 
                    output: `Error: ${error.message}`,
                    error: true 
                });
            }
            
            // Combine stdout and stderr for the response
            const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
            console.log(`[CLI SERVER] Command output: ${output}`);
            
            res.json({ output });
        });
    } catch (error) {
        console.error(`[CLI SERVER ERROR] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint
app.get('/api/cli', (req, res) => {
    res.json({ message: 'CLI Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`[CLI SERVER] Running on port ${PORT}`);
    console.log(`[CLI SERVER] CLI endpoint available at http://localhost:${PORT}/api/cli`);
}); 