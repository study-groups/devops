/**
 * GameManifest - On-demand games.json generation from S3
 * Scans S3 bucket for game directories and parses game.toml files
 */

import TOML from '@iarna/toml';

export class GameManifest {
    constructor(s3Provider) {
        this.s3 = s3Provider;
        this.cache = null;
        this.cacheTime = 0;
        this.TTL = 60000; // 1 minute cache
        this.gamesPrefix = 'games/'; // Games are stored under games/ prefix
    }

    /**
     * Generate games manifest from S3
     * @param {boolean} force - Force regeneration, ignore cache
     */
    async generate(force = false) {
        // Return cached if valid
        if (!force && this.cache && (Date.now() - this.cacheTime) < this.TTL) {
            return this.cache;
        }

        console.log('[GameManifest] Generating manifest from S3...');

        // List all game directories
        const gameDirs = await this.s3.listDirectories(this.gamesPrefix);
        console.log(`[GameManifest] Found ${gameDirs.length} game directories`);

        const games = [];

        for (const slug of gameDirs) {
            try {
                const game = await this._loadGame(slug);
                if (game) {
                    games.push(game);
                }
            } catch (err) {
                console.warn(`[GameManifest] Error loading game '${slug}':`, err.message);
            }
        }

        // Sort by name
        games.sort((a, b) => a.name.localeCompare(b.name));

        const manifest = {
            version: '1.0.0',
            generated: new Date().toISOString(),
            count: games.length,
            games,
        };

        // Cache the result
        this.cache = manifest;
        this.cacheTime = Date.now();

        console.log(`[GameManifest] Generated manifest with ${games.length} games`);
        return manifest;
    }

    /**
     * Load a single game's metadata
     */
    async _loadGame(slug) {
        const tomlKey = `${this.gamesPrefix}${slug}/game.toml`;
        const { exists } = await this.s3.headObject(tomlKey);

        if (!exists) {
            // No game.toml, create basic entry from directory
            return this._createBasicEntry(slug);
        }

        try {
            const tomlContent = await this.s3.getObjectString(tomlKey);
            const config = TOML.parse(tomlContent);

            return {
                slug,
                id: config.game?.id || slug,
                name: config.game?.name || slug,
                description: config.game?.description || '',
                version: config.game?.version || '1.0.0',
                author: config.game?.author || 'Unknown',
                entry: config.files?.entry || 'index.html',
                thumbnail: config.files?.thumbnail
                    ? `${this.gamesPrefix}${slug}/${config.files.thumbnail}`
                    : null,
                tags: config.metadata?.tags || [],
                created: config.metadata?.created || null,
                updated: config.metadata?.updated || null,
                requires_auth: config.permissions?.requires_auth || false,
                min_role: config.permissions?.min_role || 'guest',
            };
        } catch (err) {
            console.warn(`[GameManifest] Error parsing game.toml for '${slug}':`, err.message);
            return this._createBasicEntry(slug);
        }
    }

    /**
     * Create a basic entry for games without game.toml
     */
    _createBasicEntry(slug) {
        return {
            slug,
            id: slug,
            name: this._slugToName(slug),
            description: '',
            version: '1.0.0',
            author: 'Unknown',
            entry: 'index.html',
            thumbnail: null,
            tags: [],
            created: null,
            updated: null,
            requires_auth: false,
            min_role: 'guest',
        };
    }

    /**
     * Convert slug to readable name
     */
    _slugToName(slug) {
        return slug
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Get single game metadata
     */
    async getGame(slug) {
        const manifest = await this.generate();
        return manifest.games.find(g => g.slug === slug) || null;
    }

    /**
     * List files for a game
     */
    async listGameFiles(slug) {
        const prefix = `${this.gamesPrefix}${slug}/`;
        const { objects } = await this.s3.listObjects(prefix);

        return objects.map(obj => ({
            key: obj.key,
            name: obj.key.replace(prefix, ''),
            size: obj.size,
            lastModified: obj.lastModified,
        }));
    }

    /**
     * Invalidate cache
     */
    invalidate() {
        this.cache = null;
        this.cacheTime = 0;
    }
}
