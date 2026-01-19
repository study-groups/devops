/**
 * LocalGameProvider - Filesystem-based provider for local development
 * Implements same interface as S3Provider methods used by GameManifest
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
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
     * Read file contents as Buffer (for binary files)
     * @param {string} key - e.g., 'games/cheap-golf/assets/sprite.png'
     * @returns {Promise<Buffer>}
     */
    async getObjectBuffer(key) {
        const filePath = this._keyToPath(key);
        return readFile(filePath);
    }

    /**
     * Write file contents
     * @param {string} key - e.g., 'games/cheap-golf/game.toml'
     * @param {string} content - file content to write
     * @returns {Promise<void>}
     */
    async putObjectString(key, content) {
        const filePath = this._keyToPath(key);
        await writeFile(filePath, content, 'utf-8');
    }

    /**
     * List all files under a prefix (recursively)
     * @param {string} prefix - e.g., 'games/cheap-golf/'
     * @returns {Promise<{objects: Array}>}
     */
    async listObjects(prefix) {
        const dirPath = this._keyToPath(prefix);
        const objects = [];

        try {
            await this._listFilesRecursive(dirPath, prefix, objects);
            return { objects };
        } catch (err) {
            console.error(`[LocalGameProvider] Error listing objects:`, err.message);
            return { objects: [] };
        }
    }

    /**
     * Recursively list files in a directory
     * @param {string} dirPath - Filesystem path to scan
     * @param {string} keyPrefix - S3-style key prefix for results
     * @param {Array} objects - Array to collect results into
     */
    async _listFilesRecursive(dirPath, keyPrefix, objects) {
        const entries = await readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            // Skip hidden files/directories
            if (entry.name.startsWith('.')) continue;

            const filePath = join(dirPath, entry.name);
            const key = `${keyPrefix}${entry.name}`;

            if (entry.isFile()) {
                const stats = await stat(filePath);
                objects.push({
                    key,
                    name: entry.name,
                    size: stats.size,
                    lastModified: stats.mtime,
                });
            } else if (entry.isDirectory()) {
                // Recurse into subdirectory
                await this._listFilesRecursive(filePath, `${key}/`, objects);
            }
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
