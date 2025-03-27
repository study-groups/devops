const { exec } = require('child_process');

/**
 * CLI command execution endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports = function(req, res) {
    try {
        console.log('[CLI API] Received request:', req.method, req.url);
        console.log('[CLI API] Request body:', req.body);
        
        const { command } = req.body;
        // Make username optional to avoid auth issues
        const username = req.auth?.name || req.user?.username || 'anonymous';
        
        console.log(`[CLI API] Received command request from ${username}: ${command}`);
        
        if (!command) {
            console.log('[CLI API] Missing command in request');
            return res.status(400).json({ error: 'Command is required' });
        }
        
        console.log(`[CLI API] User ${username} executing command: ${command}`);
        
        // Execute the command
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`[CLI API ERROR] Command execution failed: ${error.message}`);
                return res.status(500).json({ 
                    output: `Error: ${error.message}`,
                    error: true 
                });
            }
            
            // Combine stdout and stderr for the response
            const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
            console.log(`[CLI API] Command executed successfully by user ${username}`);
            console.log(`[CLI API] Command output: ${output}`);
            
            res.json({ output });
        });
    } catch (error) {
        console.error(`[CLI API ERROR] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
}; 