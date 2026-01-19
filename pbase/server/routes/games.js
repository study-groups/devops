/**
 * Games Routes - Games manifest and metadata endpoints
 * Now accepts workspace object to support dynamic org switching
 */

import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';

export function createGamesRoutes(workspace, csvAuth) {
    const router = Router();

    // Check if game manifest is available - access dynamically
    const checkManifest = (req, res, next) => {
        if (!workspace.gameManifest) {
            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'Game manifest not configured (S3 not available)',
            });
        }
        next();
    };

    /**
     * GET /api/games
     * Get full games manifest
     */
    router.get('/', optionalAuth(csvAuth), checkManifest, async (req, res) => {
        try {
            const force = req.query.refresh === 'true';
            const manifest = await workspace.gameManifest.generate(force);

            // Filter games based on user permissions
            const userRole = req.user?.role || 'guest';
            const roleRank = { admin: 4, dev: 3, user: 2, guest: 1 };
            const userRank = roleRank[userRole] || 1;

            const filteredGames = manifest.games.filter(game => {
                if (!game.requires_auth) return true;
                const minRank = roleRank[game.min_role] || 1;
                return userRank >= minRank;
            });

            res.json({
                ...manifest,
                count: filteredGames.length,
                games: filteredGames,
            });
        } catch (err) {
            console.error('[Games] Manifest error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/games/:slug
     * Get single game metadata
     */
    router.get('/:slug', optionalAuth(csvAuth), checkManifest, async (req, res) => {
        try {
            const { slug } = req.params;
            const game = await workspace.gameManifest.getGame(slug);

            if (!game) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: `Game '${slug}' not found`,
                });
            }

            // Check permission
            if (game.requires_auth) {
                const userRole = req.user?.role || 'guest';
                const roleRank = { admin: 4, dev: 3, user: 2, guest: 1 };
                const userRank = roleRank[userRole] || 1;
                const minRank = roleRank[game.min_role] || 1;

                if (userRank < minRank) {
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: `Role '${game.min_role}' or higher required`,
                    });
                }
            }

            res.json(game);
        } catch (err) {
            console.error('[Games] Get game error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * POST /api/games/:slug/refresh
     * Force refresh game metadata from S3
     */
    router.post('/:slug/refresh', optionalAuth(csvAuth), checkManifest, async (req, res) => {
        try {
            // Invalidate cache and regenerate
            workspace.gameManifest.invalidate();
            const manifest = await workspace.gameManifest.generate(true);

            const game = manifest.games.find(g => g.slug === req.params.slug);

            if (!game) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: `Game '${req.params.slug}' not found`,
                });
            }

            res.json({
                success: true,
                message: 'Game metadata refreshed',
                game,
            });
        } catch (err) {
            console.error('[Games] Refresh error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/games/:slug/files
     * List files for a game
     */
    router.get('/:slug/files', optionalAuth(csvAuth), checkManifest, async (req, res) => {
        try {
            const { slug } = req.params;
            const files = await workspace.gameManifest.listGameFiles(slug);

            res.json({
                slug,
                count: files.length,
                files,
            });
        } catch (err) {
            console.error('[Games] List files error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/games/:slug/file/:filename
     * Get file content from local workspace
     */
    router.get('/:slug/file/:filename', optionalAuth(csvAuth), checkManifest, async (req, res) => {
        try {
            const { slug, filename } = req.params;
            const key = `games/${slug}/${filename}`;
            const content = await workspace.gameManifest.s3.getObjectString(key);

            res.type('text/plain').send(content);
        } catch (err) {
            console.error('[Games] Get file error:', err);
            res.status(err.code === 'ENOENT' ? 404 : 500).json({
                error: err.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/games/:slug/play/:filepath(*)
     * Serve game files with proper MIME types for iframe loading
     */
    router.get('/:slug/play/:filepath(*)', optionalAuth(csvAuth), checkManifest, async (req, res) => {
        try {
            const { slug, filepath } = req.params;
            const file = filepath || 'index.html';
            const key = `games/${slug}/${file}`;

            // Determine MIME type
            const ext = file.split('.').pop()?.toLowerCase();
            const mimeTypes = {
                // Text types
                html: { type: 'text/html', binary: false },
                htm: { type: 'text/html', binary: false },
                js: { type: 'application/javascript', binary: false },
                mjs: { type: 'application/javascript', binary: false },
                css: { type: 'text/css', binary: false },
                json: { type: 'application/json', binary: false },
                xml: { type: 'application/xml', binary: false },
                svg: { type: 'image/svg+xml', binary: false },
                txt: { type: 'text/plain', binary: false },
                toml: { type: 'text/plain', binary: false },
                // Binary types
                png: { type: 'image/png', binary: true },
                jpg: { type: 'image/jpeg', binary: true },
                jpeg: { type: 'image/jpeg', binary: true },
                gif: { type: 'image/gif', binary: true },
                webp: { type: 'image/webp', binary: true },
                ico: { type: 'image/x-icon', binary: true },
                woff: { type: 'font/woff', binary: true },
                woff2: { type: 'font/woff2', binary: true },
                ttf: { type: 'font/ttf', binary: true },
                otf: { type: 'font/otf', binary: true },
                eot: { type: 'application/vnd.ms-fontobject', binary: true },
                mp3: { type: 'audio/mpeg', binary: true },
                wav: { type: 'audio/wav', binary: true },
                ogg: { type: 'audio/ogg', binary: true },
                mp4: { type: 'video/mp4', binary: true },
                webm: { type: 'video/webm', binary: true },
                wasm: { type: 'application/wasm', binary: true },
                swf: { type: 'application/x-shockwave-flash', binary: true },
                zip: { type: 'application/zip', binary: true },
            };

            const mime = mimeTypes[ext] || { type: 'application/octet-stream', binary: true };
            const provider = workspace.gameManifest.s3;

            // Use appropriate read method based on file type
            let content;
            if (mime.binary && provider.getObjectBuffer) {
                content = await provider.getObjectBuffer(key);
            } else {
                content = await provider.getObjectString(key);
            }

            res.type(mime.type).send(content);
        } catch (err) {
            console.error('[Games] Play file error:', err.message);
            res.status(err.code === 'ENOENT' ? 404 : 500).json({
                error: err.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * PUT /api/games/:slug/file/:filename
     * Save file content to local workspace
     */
    router.put('/:slug/file/:filename', optionalAuth(csvAuth), checkManifest, async (req, res) => {
        try {
            const { slug, filename } = req.params;
            const key = `games/${slug}/${filename}`;

            // Check if provider supports writing
            if (!workspace.gameManifest.s3.putObjectString) {
                return res.status(501).json({
                    error: 'Not Implemented',
                    message: 'File editing not supported for this storage provider',
                });
            }

            // Get content from request body
            const content = req.body.content;
            if (typeof content !== 'string') {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Request body must include content string',
                });
            }

            await workspace.gameManifest.s3.putObjectString(key, content);

            res.json({
                success: true,
                message: `File ${filename} saved`,
                key,
            });
        } catch (err) {
            console.error('[Games] Save file error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    return router;
}
