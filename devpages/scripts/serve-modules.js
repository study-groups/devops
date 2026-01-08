#!/usr/bin/env node

/**
 * serve-modules.js - Simple middleware to serve ES modules for no-bundler development
 * 
 * Ensures that npm modules are correctly served during development
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function createModuleMiddleware() {
    const router = express.Router();

    // Serve node_modules as static files with correct MIME types
    router.use('/node_modules', express.static(path.join(PROJECT_ROOT, 'node_modules'), {
        setHeaders: (res, filePath) => {
            // Ensure correct MIME types for ES modules
            if (filePath.endsWith('.mjs') || filePath.endsWith('.esm.js')) {
                res.setHeader('Content-Type', 'application/javascript');
            }
        }
    }));

    // Fallback handler for module resolution
    router.get('/node_modules/*', (req, res) => {
        const modulePath = path.join(PROJECT_ROOT, req.path);
        
        if (fs.existsSync(modulePath)) {
            res.sendFile(modulePath);
        } else {
            res.status(404).send('Module not found');
        }
    });

    return router;
}

function startDevServer(port = 4000) {
    const app = express();

    // CORS and other development-friendly headers
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        next();
    });

    // Module serving middleware
    app.use(createModuleMiddleware());

    // Serve the client directory at /client path
    app.use('/client', express.static(path.join(PROJECT_ROOT, 'client')));

    // Also serve css directory
    app.use('/css', express.static(path.join(PROJECT_ROOT, 'client/css')));

    // Serve tetra.js from tetra source (TETRA_SRC or relative path)
    const tetraSrc = process.env.TETRA_SRC || path.resolve(PROJECT_ROOT, '../tetra');
    app.use('/tetra', express.static(tetraSrc));

    // API stubs - return empty responses to prevent client errors
    app.get('/api/spaces/config', (req, res) => res.json({}));
    app.get('/api/tetra/config/publishing', (req, res) => res.json({}));
    app.get('/api/config', (req, res) => res.json({}));
    app.get('/env', (req, res) => res.json({}));

    // Auth API stubs
    app.get('/api/auth/user', (req, res) => res.json({ user: null }));
    app.post('/api/auth/login', (req, res) => res.json({ success: false, message: 'Auth not configured' }));
    app.post('/api/auth/logout', (req, res) => res.json({ success: true }));
    app.post('/api/auth/token/generate', (req, res) => res.json({ token: null }));

    // Fallback to index.html for SPA-like routing
    app.get('*', (req, res) => {
        res.sendFile(path.join(PROJECT_ROOT, 'client', 'index.html'));
    });

    app.listen(port, () => {
        console.log(`🚀 DevPages Module Server running on http://localhost:${port}`);
        console.log(`📂 Serving modules from: ${PROJECT_ROOT}/node_modules`);
    });
}

// Allow running as a script or importing
if (import.meta.url === `file://${__filename}`) {
    startDevServer();
}

export { createModuleMiddleware, startDevServer };
