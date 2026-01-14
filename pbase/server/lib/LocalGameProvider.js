/**
 * LocalGameProvider - Filesystem-based provider for local development
 * Implements same interface as S3Provider methods used by GameManifest
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

export class LocalGameProvider {
    constructor(gamesDir) {
        this.gamesDir = gamesDir;
        console.log(`[LocalGameProvider] Using local games directory: ${gamesDir}`);
    }

    /**
     * List directories under a prefix (game slugs)
     * @param {string} prefix - e.g., 'games/'
     * @returns {Promise<string[]>} - array of directory names
     */
    async listDirectories(prefix) {
        // For local, we ignore prefix since gamesDir is already the games root
        try {
            const entries = await readdir(this.gamesDir, { withFileTypes: true });
            const dirs = entries
                .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
                .map(entry => entry.name);
            return dirs;
        } catch (err) {
            console.error(`[LocalGameProvider] Error listing directories:`, err.message);
            return [];
        }
    }

    /**
     * Check if a file exists
     * @param {string} key - e.g., 'games/cheap-golf/game.toml'
     * @returns {Promise<{exists: boolean}>}
     */
    async headObject(key) {
        const filePath = this._keyToPath(key);
        try {
            await stat(filePath);
            return { exists: true };
        } catch {
            return { exists: false };
        }
    }

    /**
     * Read file contents as string
     * @param {string} key - e.g., 'games/cheap-golf/game.toml'
     * @returns {Promise<string>}
     */
    async getObjectString(key) {
        const filePath = this._keyToPath(key);
        return readFile(filePath, 'utf-8');
    }

    /**
     * List all files under a prefix
     * @param {string} prefix - e.g., 'games/cheap-golf/'
     * @returns {Promise<{objects: Array}>}
     */
    async listObjects(prefix) {
        const dirPath = this._keyToPath(prefix);
        try {
            const entries = await readdir(dirPath, { withFileTypes: true });
            const objects = [];

            for (const entry of entries) {
                if (entry.isFile()) {
                    const filePath = join(dirPath, entry.name);
                    const stats = await stat(filePath);
                    objects.push({
                        key: `${prefix}${entry.name}`,
                        size: stats.size,
                        lastModified: stats.mtime,
                    });
                }
            }

            return { objects };
        } catch (err) {
            console.error(`[LocalGameProvider] Error listing objects:`, err.message);
            return { objects: [] };
        }
    }

    /**
     * Convert S3-style key to local filesystem path
     * @param {string} key - e.g., 'games/cheap-golf/game.toml'
     * @returns {string} - local path
     */
    _keyToPath(key) {
        // Strip 'games/' prefix since gamesDir is already the games root
        const relativePath = key.replace(/^games\//, '');
        return join(this.gamesDir, relativePath);
    }
}
