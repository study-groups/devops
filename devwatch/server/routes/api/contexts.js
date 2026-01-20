/**
 * Context API - Manages Playwright browser contexts (storageState)
 *
 * Contexts store:
 * - storageState (cookies, localStorage, sessionStorage)
 * - viewport settings
 * - userAgent overrides
 * - extraHTTPHeaders
 *
 * Stored in: PW_DIR/contexts/
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Get PW_DIR from environment
const getPwDir = () => {
    const pwDir = process.env.PW_DIR;
    if (!pwDir) {
        throw new Error('PW_DIR environment variable is not set');
    }
    return pwDir;
};

// Ensure contexts directory exists
const ensureContextsDir = async () => {
    const contextsDir = path.join(getPwDir(), 'contexts');
    await fs.mkdir(contextsDir, { recursive: true });
    return contextsDir;
};

// Create default context if it doesn't exist
const ensureDefaultContext = async () => {
    const contextsDir = await ensureContextsDir();
    const defaultPath = path.join(contextsDir, 'default.json');

    try {
        await fs.access(defaultPath);
    } catch {
        // Create default context
        const defaultContext = {
            id: 'default',
            name: 'Default Context',
            storageState: {
                cookies: [],
                origins: []
            },
            viewport: { width: 1280, height: 720 },
            userAgent: null,
            extraHTTPHeaders: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await fs.writeFile(defaultPath, JSON.stringify(defaultContext, null, 2));
    }
};

/**
 * GET /api/contexts
 * List all available contexts
 */
router.get('/', async (req, res) => {
    try {
        await ensureDefaultContext();
        const contextsDir = await ensureContextsDir();

        const files = await fs.readdir(contextsDir);
        const contexts = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(contextsDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                try {
                    const context = JSON.parse(content);
                    // Return summary without full storageState for list view
                    contexts.push({
                        id: context.id,
                        name: context.name,
                        viewport: context.viewport,
                        hasCookies: (context.storageState?.cookies?.length || 0) > 0,
                        hasOrigins: (context.storageState?.origins?.length || 0) > 0,
                        createdAt: context.createdAt,
                        updatedAt: context.updatedAt
                    });
                } catch (parseError) {
                    console.error(`Failed to parse context file: ${file}`, parseError);
                }
            }
        }

        res.json(contexts);
    } catch (error) {
        console.error('Error listing contexts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/contexts/:id
 * Get a specific context by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const contextsDir = await ensureContextsDir();
        const filePath = path.join(contextsDir, `${req.params.id}.json`);

        const content = await fs.readFile(filePath, 'utf8');
        const context = JSON.parse(content);

        res.json(context);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Context not found' });
        } else {
            console.error('Error reading context:', error);
            res.status(500).json({ error: error.message });
        }
    }
});

/**
 * GET /api/contexts/:id/storageState
 * Get just the storageState for use with Playwright
 */
router.get('/:id/storageState', async (req, res) => {
    try {
        const contextsDir = await ensureContextsDir();
        const filePath = path.join(contextsDir, `${req.params.id}.json`);

        const content = await fs.readFile(filePath, 'utf8');
        const context = JSON.parse(content);

        // Return just the storageState in Playwright format
        res.json(context.storageState || { cookies: [], origins: [] });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Context not found' });
        } else {
            console.error('Error reading context storageState:', error);
            res.status(500).json({ error: error.message });
        }
    }
});

/**
 * POST /api/contexts
 * Create a new context
 */
router.post('/', async (req, res) => {
    try {
        const { name, viewport, userAgent, extraHTTPHeaders } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Context name is required' });
        }

        // Generate ID from name
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const contextsDir = await ensureContextsDir();
        const filePath = path.join(contextsDir, `${id}.json`);

        // Check if context already exists
        try {
            await fs.access(filePath);
            return res.status(409).json({ error: 'Context with this name already exists' });
        } catch {
            // File doesn't exist, we can create it
        }

        const context = {
            id,
            name,
            storageState: {
                cookies: [],
                origins: []
            },
            viewport: viewport || { width: 1280, height: 720 },
            userAgent: userAgent || null,
            extraHTTPHeaders: extraHTTPHeaders || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await fs.writeFile(filePath, JSON.stringify(context, null, 2));

        res.status(201).json(context);
    } catch (error) {
        console.error('Error creating context:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/contexts/:id
 * Update an existing context
 */
router.put('/:id', async (req, res) => {
    try {
        const contextsDir = await ensureContextsDir();
        const filePath = path.join(contextsDir, `${req.params.id}.json`);

        // Read existing context
        let context;
        try {
            const content = await fs.readFile(filePath, 'utf8');
            context = JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return res.status(404).json({ error: 'Context not found' });
            }
            throw error;
        }

        // Update allowed fields
        const { name, viewport, userAgent, extraHTTPHeaders, storageState } = req.body;

        if (name) context.name = name;
        if (viewport) context.viewport = viewport;
        if (userAgent !== undefined) context.userAgent = userAgent;
        if (extraHTTPHeaders) context.extraHTTPHeaders = extraHTTPHeaders;
        if (storageState) context.storageState = storageState;

        context.updatedAt = new Date().toISOString();

        await fs.writeFile(filePath, JSON.stringify(context, null, 2));

        res.json(context);
    } catch (error) {
        console.error('Error updating context:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/contexts/:id/storageState
 * Update just the storageState (e.g., after auth capture)
 */
router.put('/:id/storageState', async (req, res) => {
    try {
        const contextsDir = await ensureContextsDir();
        const filePath = path.join(contextsDir, `${req.params.id}.json`);

        // Read existing context
        let context;
        try {
            const content = await fs.readFile(filePath, 'utf8');
            context = JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return res.status(404).json({ error: 'Context not found' });
            }
            throw error;
        }

        // Update storageState
        context.storageState = req.body;
        context.updatedAt = new Date().toISOString();

        await fs.writeFile(filePath, JSON.stringify(context, null, 2));

        res.json({ success: true, id: context.id, updatedAt: context.updatedAt });
    } catch (error) {
        console.error('Error updating storageState:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/contexts/:id
 * Delete a context (cannot delete 'default')
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (id === 'default') {
            return res.status(400).json({ error: 'Cannot delete the default context' });
        }

        const contextsDir = await ensureContextsDir();
        const filePath = path.join(contextsDir, `${id}.json`);

        try {
            await fs.unlink(filePath);
            res.json({ success: true, deleted: id });
        } catch (error) {
            if (error.code === 'ENOENT') {
                return res.status(404).json({ error: 'Context not found' });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error deleting context:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/contexts/:id/import
 * Import storageState from uploaded file
 */
router.post('/:id/import', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const contextsDir = await ensureContextsDir();
        const filePath = path.join(contextsDir, `${req.params.id}.json`);

        // Read existing context
        let context;
        try {
            const content = await fs.readFile(filePath, 'utf8');
            context = JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return res.status(404).json({ error: 'Context not found' });
            }
            throw error;
        }

        // Import storageState from request body
        const { storageState } = req.body;
        if (!storageState) {
            return res.status(400).json({ error: 'storageState is required' });
        }

        context.storageState = storageState;
        context.updatedAt = new Date().toISOString();

        await fs.writeFile(filePath, JSON.stringify(context, null, 2));

        res.json({
            success: true,
            id: context.id,
            cookieCount: context.storageState.cookies?.length || 0,
            originCount: context.storageState.origins?.length || 0
        });
    } catch (error) {
        console.error('Error importing storageState:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
