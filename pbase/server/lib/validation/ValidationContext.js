/**
 * ValidationContext - Immutable context for validators
 *
 * Provides cached access to game files and metadata.
 * Validators receive this context to perform checks.
 */

export class ValidationContext {
    /**
     * @param {object} options
     * @param {string} options.slug - Game slug
     * @param {object} [options.game] - Game metadata from manifest
     * @param {object} options.gameType - Resolved game type
     * @param {object} [options.gameConfig] - Parsed game.toml
     * @param {object} options.provider - Storage provider (S3 or Local)
     * @param {string} options.hook - Hook triggering validation
     * @param {object} options.registry - GameTypeRegistry instance
     */
    constructor(options) {
        this.slug = options.slug;
        this.game = options.game || {};
        this.gameType = options.gameType;
        this.gameConfig = options.gameConfig || null;
        this.provider = options.provider;
        this.hook = options.hook;
        this.registry = options.registry;

        // File content cache
        this._fileCache = new Map();
        this._filesListCache = null;

        // Prefix for game files in storage
        this.gamesPrefix = 'games/';
    }

    /**
     * Get the full key/path for a game file
     * @param {string} filename - Relative filename
     * @returns {string}
     */
    getKey(filename) {
        return `${this.gamesPrefix}${this.slug}/${filename}`;
    }

    /**
     * Get file content (cached)
     * @param {string} filename - Relative filename
     * @returns {Promise<string|null>}
     */
    async getFileContent(filename) {
        const key = this.getKey(filename);

        if (this._fileCache.has(key)) {
            return this._fileCache.get(key);
        }

        try {
            const content = await this.provider.getObjectString(key);
            this._fileCache.set(key, content);
            return content;
        } catch (err) {
            if (err.code === 'ENOENT' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                this._fileCache.set(key, null);
                return null;
            }
            throw err;
        }
    }

    /**
     * Check if a file exists
     * @param {string} filename - Relative filename
     * @returns {Promise<boolean>}
     */
    async fileExists(filename) {
        const key = this.getKey(filename);

        try {
            const result = await this.provider.headObject(key);
            return result.exists !== false;
        } catch (err) {
            if (err.code === 'ENOENT' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw err;
        }
    }

    /**
     * List all files for the game (cached)
     * @returns {Promise<Array<{name: string, key: string, size?: number}>>}
     */
    async listFiles() {
        if (this._filesListCache) {
            return this._filesListCache;
        }

        const prefix = this.getKey('');

        try {
            const result = await this.provider.listObjects(prefix);
            const objects = result.objects || result;

            this._filesListCache = (Array.isArray(objects) ? objects : []).map(obj => ({
                name: obj.key?.replace(prefix, '') || obj.name,
                key: obj.key,
                size: obj.size,
            }));

            return this._filesListCache;
        } catch (err) {
            console.warn(`[ValidationContext] Failed to list files for ${this.slug}:`, err.message);
            this._filesListCache = [];
            return this._filesListCache;
        }
    }

    /**
     * Get game.toml config (cached)
     * @returns {Promise<object|null>}
     */
    async getGameConfig() {
        if (this.gameConfig) {
            return this.gameConfig;
        }

        const content = await this.getFileContent('game.toml');
        if (!content) {
            return null;
        }

        try {
            // Dynamic import TOML parser
            const TOML = (await import('@iarna/toml')).default;
            this.gameConfig = TOML.parse(content);
            return this.gameConfig;
        } catch (err) {
            console.warn(`[ValidationContext] Failed to parse game.toml for ${this.slug}:`, err.message);
            return null;
        }
    }

    /**
     * Check if SDK is required for this game
     * Takes into account game-level overrides
     * @returns {Promise<boolean>}
     */
    async sdkRequired() {
        const config = await this.getGameConfig();
        return this.registry.sdkRequired(this.gameType, config);
    }

    /**
     * Get SDK patterns for detection
     * @returns {string[]}
     */
    getSdkPatterns() {
        return this.registry.getSdkPatterns(this.gameType);
    }

    /**
     * Get required files for this game type
     * @returns {string[]}
     */
    getRequiredFiles() {
        return this.gameType.files?.required || ['index.html'];
    }

    /**
     * Get recommended files for this game type
     * @returns {string[]}
     */
    getRecommendedFiles() {
        return this.gameType.files?.recommended || ['game.toml'];
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this._fileCache.clear();
        this._filesListCache = null;
    }
}

export default ValidationContext;
