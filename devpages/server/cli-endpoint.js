/**
 * CLI Endpoint Setup
 * 
 * This file provides a simple way to add the CLI endpoint to an Express app.
 * Usage: require('./cli-endpoint')(app);
 */

const { exec } = require('child_process');

/**
 * Set up the CLI endpoint on the given Express app
 * @param {Object} app - Express app instance
 */
function setupCliEndpoint(app) {
    console.log('[SERVER] Setting up CLI endpoint at /api/cli');
    
    // Register the POST endpoint
    app.post('/api/cli', (req, res) => {
        try {
            const { command } = req.body;
            const username = req.auth?.name || 'anonymous';  // Get authenticated username
            
            if (!command) {
                return res.status(400).json({ error: 'Command is required' });
            }
            
            console.log(`[CLI] User ${username} executing command: ${command}`);
            
            // Execute the command
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[CLI ERROR] Command execution failed: ${error.message}`);
                    return res.status(500).json({ 
                        output: `Error: ${error.message}`,
                        error: true 
                    });
                }
                
                // Combine stdout and stderr for the response
                const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
                console.log(`[CLI] Command executed successfully by user ${username}`);
                
                res.json({ output });
            });
        } catch (error) {
            console.error(`[CLI ERROR] ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });
    
    console.log('[SERVER] CLI endpoint setup complete');
    return app;
}

module.exports = setupCliEndpoint; 