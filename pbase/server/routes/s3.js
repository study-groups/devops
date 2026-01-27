/**
 * S3 Routes - S3 browser endpoints
 */

import { Router } from 'express';
import { requirePermission, optionalAuth } from '../middleware/auth.js';
import { validateGame } from '../middleware/validation.js';

export function createS3Routes(s3Provider, csvAuth, manifestTools = null) {
    const router = Router();

    // Check if S3 is configured
    const checkS3 = (req, res, next) => {
        if (!s3Provider) {
            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'S3 not configured',
            });
        }
        next();
    };

    /**
     * GET /api/s3/list
     * List objects with optional prefix
     */
    router.get('/list', optionalAuth(csvAuth), checkS3, async (req, res) => {
        try {
            const prefix = req.query.prefix || '';
            const delimiter = req.query.delimiter === 'true' ? '/' : null;

            const result = await s3Provider.listObjects(prefix, delimiter);

            res.json({
                prefix,
                ...result,
            });
        } catch (err) {
            console.error('[S3] List error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/s3/get
     * Get object content (proxied)
     */
    router.get('/get', optionalAuth(csvAuth), checkS3, async (req, res) => {
        try {
            const key = req.query.key;

            if (!key) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'key parameter required',
                });
            }

            const { body, contentType, contentLength } = await s3Provider.getObject(key);

            res.setHeader('Content-Type', contentType);
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
            }

            body.pipe(res);
        } catch (err) {
            if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Object not found',
                });
            }
            console.error('[S3] Get error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/s3/url
     * Get signed URL for direct access
     */
    router.get('/url', optionalAuth(csvAuth), checkS3, async (req, res) => {
        try {
            const key = req.query.key;
            const expiresIn = parseInt(req.query.expires) || 7200;

            if (!key) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'key parameter required',
                });
            }

            const url = await s3Provider.getSignedUrl(key, expiresIn);

            res.json({ key, url, expiresIn });
        } catch (err) {
            console.error('[S3] URL error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/s3/head
     * Check if object exists and get metadata
     */
    router.get('/head', optionalAuth(csvAuth), checkS3, async (req, res) => {
        try {
            const key = req.query.key;

            if (!key) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'key parameter required',
                });
            }

            const result = await s3Provider.headObject(key);
            res.json({ key, ...result });
        } catch (err) {
            console.error('[S3] Head error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * POST /api/s3/upload
     * Upload file (admin/dev only)
     */
    router.post('/upload', requirePermission(csvAuth, 'can_upload'), checkS3, async (req, res) => {
        try {
            const { key, content, contentType } = req.body;

            if (!key || !content) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'key and content required',
                });
            }

            await s3Provider.putObject(key, content, { contentType });

            res.json({
                success: true,
                key,
                message: 'Object uploaded successfully',
            });
        } catch (err) {
            console.error('[S3] Upload error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * DELETE /api/s3/delete
     * Delete object (admin only)
     */
    router.delete('/delete', requirePermission(csvAuth, 'can_delete'), checkS3, async (req, res) => {
        try {
            const key = req.query.key || req.body.key;

            if (!key) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'key parameter required',
                });
            }

            await s3Provider.deleteObject(key);

            res.json({
                success: true,
                key,
                message: 'Object deleted successfully',
            });
        } catch (err) {
            console.error('[S3] Delete error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    // ============================================
    // Manifest Tools Endpoints
    // ============================================

    // Check if ManifestTools is available
    const checkManifestTools = (req, res, next) => {
        if (!manifestTools) {
            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'ManifestTools not configured',
            });
        }
        next();
    };

    /**
     * POST /api/s3/manifest/dissect
     * Split games.json into individual game.toml files
     */
    router.post('/manifest/dissect', requirePermission(csvAuth, 'can_upload'), checkS3, checkManifestTools, async (req, res) => {
        try {
            const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;
            const backup = req.query.backup !== 'false' && req.body.backup !== false;

            const result = await manifestTools.dissect({ backup, dryRun });

            res.json(result);
        } catch (err) {
            console.error('[S3] Manifest dissect error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * POST /api/s3/manifest/build
     * Generate games.json from game.toml files
     * Optionally validates all games before building (onPublish hook)
     */
    router.post('/manifest/build', requirePermission(csvAuth, 'can_upload'), checkS3, checkManifestTools, async (req, res) => {
        try {
            const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;
            const validate = req.query.validate === 'true' || req.body.validate === true;

            // Optionally validate all games before building
            let validationResults = null;
            if (validate) {
                const gameManifest = req.app.locals.gameManifest;
                if (gameManifest) {
                    const manifest = await gameManifest.generate();
                    validationResults = [];

                    for (const game of manifest.games) {
                        try {
                            const result = await validateGame({
                                slug: game.slug,
                                game,
                                hook: 'onPublish',
                                provider: s3Provider,
                            });
                            validationResults.push({
                                slug: game.slug,
                                success: result.success,
                                counts: result.counts,
                            });
                        } catch (err) {
                            validationResults.push({
                                slug: game.slug,
                                success: false,
                                error: err.message,
                            });
                        }
                    }
                }
            }

            const result = await manifestTools.build({ dryRun });

            res.json({
                ...result,
                validation: validationResults,
            });
        } catch (err) {
            console.error('[S3] Manifest build error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/s3/manifest/diff
     * Show diff between current games.json and what would be generated
     */
    router.get('/manifest/diff', optionalAuth(csvAuth), checkS3, checkManifestTools, async (req, res) => {
        try {
            const result = await manifestTools.diff();

            res.json(result);
        } catch (err) {
            console.error('[S3] Manifest diff error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    return router;
}
