/**
 * mount.js - API routes for data mount point management
 *
 * Provides endpoints for:
 * - Getting default mount info (PD_DATA path)
 * - Validating and adding mount points
 * - Reading pdata.json metadata from mount points
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Helper functions to replace fs-extra methods
async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function readJson(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}

/**
 * GET /api/mount/info
 * Returns information about the default data mount point
 *
 * Mount path = PD_DIR (the project directory)
 * Default subdir = 'data' (PD_DATA = $PD_DIR/data)
 */
router.get('/info', async (req, res) => {
    try {
        const pdDir = process.env.PD_DIR;

        if (!pdDir) {
            return res.status(500).json({
                success: false,
                error: 'PD_DIR environment variable not configured'
            });
        }

        // Mount is PD_DIR, default subdir is 'data'
        const defaultSubdir = 'data';
        const defaultDataPath = path.join(pdDir, defaultSubdir);

        // Check if PD_DIR exists
        const mountExists = await pathExists(pdDir);
        // Check if default data subdir exists
        const defaultSubdirExists = await pathExists(defaultDataPath);

        // Try to read pdata.json from the data directory if it exists
        let metadata = null;
        let publishConfigs = [];

        const pdataJsonPath = path.join(defaultDataPath, 'pdata.json');
        if (await pathExists(pdataJsonPath)) {
            try {
                const pdataContent = await readJson(pdataJsonPath);
                metadata = pdataContent.metadata || pdataContent;
                publishConfigs = pdataContent.publishConfigs || pdataContent.publish || [];
            } catch (parseError) {
                console.warn('[mount/info] Failed to parse pdata.json:', parseError.message);
            }
        }

        res.json({
            success: true,
            pdDir,
            // Mount path is PD_DIR itself
            defaultMountPath: pdDir,
            // Default subdirectory within the mount
            defaultSubdir,
            // Full path to default data directory (for backwards compat)
            defaultDataPath,
            mountExists,
            defaultSubdirExists,
            metadata,
            publishConfigs
        });
    } catch (error) {
        console.error('[mount/info] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mount/validate
 * Validates a directory path and returns its metadata
 */
router.post('/validate', async (req, res) => {
    try {
        const { path: mountPath } = req.body;

        if (!mountPath) {
            return res.status(400).json({
                success: false,
                error: 'Path is required'
            });
        }

        // Resolve to absolute path
        const resolvedPath = path.isAbsolute(mountPath)
            ? mountPath
            : path.resolve(process.cwd(), mountPath);

        // Check if path exists and is a directory
        const stats = await fs.stat(resolvedPath).catch(() => null);

        if (!stats) {
            return res.status(400).json({
                success: false,
                error: 'Path does not exist'
            });
        }

        if (!stats.isDirectory()) {
            return res.status(400).json({
                success: false,
                error: 'Path is not a directory'
            });
        }

        // Try to read pdata.json if it exists
        let metadata = null;
        let publishConfigs = [];

        const pdataJsonPath = path.join(resolvedPath, 'pdata.json');
        if (await pathExists(pdataJsonPath)) {
            try {
                const pdataContent = await readJson(pdataJsonPath);
                metadata = pdataContent.metadata || pdataContent;
                publishConfigs = pdataContent.publishConfigs || pdataContent.publish || [];
            } catch (parseError) {
                console.warn('[mount/validate] Failed to parse pdata.json:', parseError.message);
            }
        }

        // Suggest a name based on the directory name or metadata
        const suggestedName = metadata?.name || path.basename(resolvedPath);

        res.json({
            success: true,
            resolvedPath,
            suggestedName,
            metadata,
            publishConfigs,
            hasPdataJson: metadata !== null
        });
    } catch (error) {
        console.error('[mount/validate] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mount/metadata
 * Reads/refreshes metadata from a mount point's pdata.json
 */
router.post('/metadata', async (req, res) => {
    try {
        const { path: mountPath } = req.body;

        if (!mountPath) {
            return res.status(400).json({
                success: false,
                error: 'Path is required'
            });
        }

        // Resolve to absolute path
        const resolvedPath = path.isAbsolute(mountPath)
            ? mountPath
            : path.resolve(process.cwd(), mountPath);

        // Check if path exists
        if (!await pathExists(resolvedPath)) {
            return res.status(400).json({
                success: false,
                error: 'Path does not exist'
            });
        }

        // Try to read pdata.json
        const pdataJsonPath = path.join(resolvedPath, 'pdata.json');

        if (!await pathExists(pdataJsonPath)) {
            return res.json({
                success: true,
                metadata: null,
                publishConfigs: [],
                hasPdataJson: false
            });
        }

        try {
            const pdataContent = await readJson(pdataJsonPath);
            const metadata = pdataContent.metadata || pdataContent;
            const publishConfigs = pdataContent.publishConfigs || pdataContent.publish || [];

            res.json({
                success: true,
                metadata,
                publishConfigs,
                hasPdataJson: true
            });
        } catch (parseError) {
            res.status(400).json({
                success: false,
                error: `Failed to parse pdata.json: ${parseError.message}`
            });
        }
    } catch (error) {
        console.error('[mount/metadata] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mount/list
 * Lists available mount points (directories) under a base path
 */
router.get('/list', async (req, res) => {
    try {
        const basePath = req.query.basePath || process.env.PD_DIR;

        if (!basePath) {
            return res.status(400).json({
                success: false,
                error: 'basePath is required or PD_DIR must be set'
            });
        }

        const resolvedPath = path.isAbsolute(basePath)
            ? basePath
            : path.resolve(process.cwd(), basePath);

        if (!await pathExists(resolvedPath)) {
            return res.status(400).json({
                success: false,
                error: 'Base path does not exist'
            });
        }

        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const directories = entries
            .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
            .map(entry => ({
                name: entry.name,
                path: path.join(resolvedPath, entry.name)
            }));

        // Check which directories have pdata.json
        const directoriesWithInfo = await Promise.all(
            directories.map(async (dir) => {
                const pdataJsonPath = path.join(dir.path, 'pdata.json');
                const hasPdataJson = await pathExists(pdataJsonPath);
                return {
                    ...dir,
                    hasPdataJson
                };
            })
        );

        res.json({
            success: true,
            basePath: resolvedPath,
            directories: directoriesWithInfo
        });
    } catch (error) {
        console.error('[mount/list] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
