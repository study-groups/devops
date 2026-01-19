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

    return router;
}
