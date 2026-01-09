/**
 * astRoutes.js - API endpoints for AST parsing
 */

import express from 'express';
import { astService } from '../services/AstService.js';

const router = express.Router();

/**
 * POST /api/ast/parse
 * Parse JavaScript code and return AST outline
 *
 * Body: { code, filePath?, options?: { fullAst?: boolean, force?: boolean } }
 * Returns: { outline, dependencies, exports, errors, hash, nodeCount }
 */
router.post('/parse', express.json({ limit: '5mb' }), async (req, res) => {
    try {
        const { code, filePath, options = {} } = req.body;

        if (code === undefined || code === null) {
            return res.status(400).json({
                error: 'Missing required parameter: code'
            });
        }

        if (typeof code !== 'string') {
            return res.status(400).json({
                error: 'Parameter code must be a string'
            });
        }

        const startTime = Date.now();
        const result = astService.parse(code, filePath, options);
        const parseTime = Date.now() - startTime;

        // Return simplified outline by default, or full result if requested
        const response = {
            success: true,
            parseTime,
            hash: result.hash,
            filePath: result.filePath,
            outline: result.outline,
            dependencies: result.dependencies,
            exports: result.exports,
            errors: result.errors,
            stats: {
                nodeCount: result.nodeCount,
                functionCount: result.outline.functions.length,
                classCount: result.outline.classes.length,
                importCount: result.outline.imports.length
            }
        };

        res.json(response);

    } catch (error) {
        console.error('[AST] Parse error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/ast/stats
 * Get AST service statistics (cache info, etc.)
 */
router.get('/stats', (req, res) => {
    try {
        const cacheStats = astService.getCacheStats();
        res.json({
            success: true,
            cache: cacheStats,
            supported: ['javascript']
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ast/clear-cache
 * Clear the AST cache
 */
router.post('/clear-cache', (req, res) => {
    try {
        astService.clearCache();
        res.json({
            success: true,
            message: 'AST cache cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
