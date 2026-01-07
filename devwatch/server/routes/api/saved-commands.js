const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { info, warn, error } = require('../../utils/logging');

const router = express.Router();

// Get saved commands by type
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { PW_DIR } = req.app.locals;
        
        if (!PW_DIR) {
            return res.status(500).json({ error: 'PW_DIR not configured' });
        }

        const commandsDir = path.join(PW_DIR, 'data', 'saved-commands', type);
        
        try {
            const files = await fs.readdir(commandsDir);
            const commandFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json');
            
            const commands = [];
            for (const file of commandFiles) {
                try {
                    const filePath = path.join(commandsDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const command = JSON.parse(content);
                    commands.push(command);
                } catch (fileError) {
                    warn(`Failed to read command file ${file}:`, fileError);
                }
            }
            
            // Sort by updatedAt or createdAt
            commands.sort((a, b) => 
                new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
            );
            
            res.json(commands);
        } catch (dirError) {
            if (dirError.code === 'ENOENT') {
                // Directory doesn't exist, return empty array
                res.json([]);
            } else {
                throw dirError;
            }
        }
    } catch (err) {
        error('Failed to get saved commands:', err);
        res.status(500).json({ error: 'Failed to get saved commands', details: err.message });
    }
});

// Save a command
router.post('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { PW_DIR } = req.app.locals;
        
        if (!PW_DIR) {
            return res.status(500).json({ error: 'PW_DIR not configured' });
        }

        const command = req.body;
        const now = new Date().toISOString();
        
        // Ensure command has required fields
        if (!command.id) {
            command.id = command.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        }
        
        const commandToSave = {
            id: command.id,
            name: command.name,
            command: command.command,
            description: command.description,
            type: type,
            environment: command.environment,
            project: command.project,
            files: command.files,
            options: command.options,
            auth: command.auth,
            har: command.har,
            json: command.json, // for compatibility
            createdAt: command.createdAt || now,
            updatedAt: now
        };

        const commandsDir = path.join(PW_DIR, 'data', 'saved-commands', type);
        await fs.mkdir(commandsDir, { recursive: true });
        
        const filePath = path.join(commandsDir, `${commandToSave.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(commandToSave, null, 2));
        
        info(`Saved ${type} command: ${commandToSave.id}`);
        res.status(201).json(commandToSave);
        
    } catch (err) {
        error('Failed to save command:', err);
        res.status(500).json({ error: 'Failed to save command', details: err.message });
    }
});

// Get specific command
router.get('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { PW_DIR } = req.app.locals;
        
        const filePath = path.join(PW_DIR, 'data', 'saved-commands', type, `${id}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        const command = JSON.parse(content);
        
        res.json(command);
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Command not found' });
        } else {
            error('Failed to get command:', err);
            res.status(500).json({ error: 'Failed to get command', details: err.message });
        }
    }
});

// Delete command
router.delete('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { PW_DIR } = req.app.locals;
        
        const filePath = path.join(PW_DIR, 'data', 'saved-commands', type, `${id}.json`);
        await fs.unlink(filePath);
        
        info(`Deleted ${type} command: ${id}`);
        res.json({ success: true, message: `Command ${id} deleted` });
        
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Command not found' });
        } else {
            error('Failed to delete command:', err);
            res.status(500).json({ error: 'Failed to delete command', details: err.message });
        }
    }
});

module.exports = router;
