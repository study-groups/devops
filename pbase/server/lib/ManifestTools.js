/**
 * ManifestTools - S3 Browser tools for manifest management
 * Handles dissect/build operations for games.json <-> game.toml
 */

import TOML from '@iarna/toml';

export class ManifestTools {
    constructor(s3Provider, gameManifest) {
        this.s3 = s3Provider;
        this.gameManifest = gameManifest;
        this.gamesPrefix = 'games/';
    }

    /**
     * Dissect existing games.json into individual game.toml files
     * @param {object} options
     * @param {boolean} options.backup - Backup existing game.toml files first
     * @param {boolean} options.dryRun - Don't write, just return what would be created
     */
    async dissect(options = { backup: true, dryRun: false }) {
        const results = {
            success: true,
            dryRun: options.dryRun,
            games: [],
            errors: [],
            backups: [],
        };

        try {
            // Try to get existing games.json from S3
            let gamesJson;
            try {
                gamesJson = await this.s3.getObjectJson('games.json');
            } catch (err) {
                // If no games.json, generate from current manifest
                gamesJson = await this.gameManifest.generate(true);
            }

            const games = gamesJson.games || [];

            for (const game of games) {
                try {
                    const tomlKey = `${this.gamesPrefix}${game.slug}/game.toml`;

                    // Backup existing game.toml if requested
                    if (options.backup && !options.dryRun) {
                        const { exists } = await this.s3.headObject(tomlKey);
                        if (exists) {
                            const backupKey = `${this.gamesPrefix}${game.slug}/game.toml.backup`;
                            const content = await this.s3.getObjectString(tomlKey);
                            await this.s3.putObject(backupKey, content);
                            results.backups.push({ slug: game.slug, key: backupKey });
                        }
                    }

                    // Convert game metadata to TOML structure
                    const tomlData = this._gameToToml(game);
                    const tomlString = TOML.stringify(tomlData);

                    if (!options.dryRun) {
                        await this.s3.putObject(tomlKey, tomlString, {
                            contentType: 'application/toml',
                        });
                    }

                    results.games.push({
                        slug: game.slug,
                        key: tomlKey,
                        toml: tomlString,
                    });
                } catch (err) {
                    results.errors.push({
                        slug: game.slug,
                        error: err.message,
                    });
                }
            }

            if (results.errors.length > 0) {
                results.success = false;
            }
        } catch (err) {
            results.success = false;
            results.errors.push({ error: err.message });
        }

        return results;
    }

    /**
     * Build games.json from individual game.toml files
     * @param {object} options
     * @param {boolean} options.dryRun - Don't write, just return the generated manifest
     */
    async build(options = { dryRun: false }) {
        const results = {
            success: true,
            dryRun: options.dryRun,
            manifest: null,
            errors: [],
        };

        try {
            // Force regenerate from S3 game.toml files
            const manifest = await this.gameManifest.generate(true);

            // Add build metadata
            manifest.built = new Date().toISOString();
            manifest.source = 'game.toml files';

            if (!options.dryRun) {
                await this.s3.putObjectJson('games.json', manifest);
            }

            results.manifest = manifest;
        } catch (err) {
            results.success = false;
            results.errors.push({ error: err.message });
        }

        return results;
    }

    /**
     * Get diff between current games.json and what would be generated
     */
    async diff() {
        const results = {
            hasChanges: false,
            games: {
                added: [],
                removed: [],
                modified: [],
                unchanged: [],
            },
        };

        try {
            // Get current games.json
            let currentJson;
            try {
                currentJson = await this.s3.getObjectJson('games.json');
            } catch (err) {
                // No existing games.json
                currentJson = { games: [] };
            }

            // Generate fresh from game.toml files
            const generatedManifest = await this.gameManifest.generate(true);

            // Handle both array and object formats for games
            const normalizeGames = (games) => {
                if (!games) return new Map();
                if (Array.isArray(games)) {
                    return new Map(games.map(g => [g.slug, g]));
                }
                // Object format: { slug: gameData, ... }
                return new Map(Object.entries(games).map(([slug, g]) => [slug, { slug, ...g }]));
            };

            const currentGames = normalizeGames(currentJson.games);
            const generatedGames = normalizeGames(generatedManifest.games);

            // Find added/modified/removed
            for (const [slug, game] of generatedGames) {
                const current = currentGames.get(slug);
                if (!current) {
                    results.games.added.push(slug);
                    results.hasChanges = true;
                } else {
                    // Compare key fields
                    const changes = this._compareGames(current, game);
                    if (changes.length > 0) {
                        results.games.modified.push({ slug, changes });
                        results.hasChanges = true;
                    } else {
                        results.games.unchanged.push(slug);
                    }
                }
            }

            // Find removed
            for (const slug of currentGames.keys()) {
                if (!generatedGames.has(slug)) {
                    results.games.removed.push(slug);
                    results.hasChanges = true;
                }
            }
        } catch (err) {
            results.error = err.message;
        }

        return results;
    }

    /**
     * Bump version in a game.toml file
     * @param {string} slug - Game slug
     * @param {string} type - "patch" | "minor" | "major"
     */
    async bumpVersion(slug, type = 'patch') {
        const tomlKey = `${this.gamesPrefix}${slug}/game.toml`;
        const results = {
            success: true,
            slug,
            previousVersion: null,
            newVersion: null,
        };

        try {
            // Read current game.toml
            const content = await this.s3.getObjectString(tomlKey);
            const config = TOML.parse(content);

            // Get current version
            const currentVersion = config.version?.current
                || config.game?.version
                || '1.0.0';
            results.previousVersion = currentVersion;

            // Parse and bump version
            const [major, minor, patch] = currentVersion.split('.').map(Number);
            let newVersion;
            switch (type) {
                case 'major':
                    newVersion = `${major + 1}.0.0`;
                    break;
                case 'minor':
                    newVersion = `${major}.${minor + 1}.0`;
                    break;
                case 'patch':
                default:
                    newVersion = `${major}.${minor}.${patch + 1}`;
                    break;
            }
            results.newVersion = newVersion;

            // Update config
            if (!config.version) {
                config.version = {};
            }
            config.version.current = newVersion;

            // Update metadata.updated timestamp
            if (!config.metadata) {
                config.metadata = {};
            }
            config.metadata.updated = new Date().toISOString().split('T')[0];

            // Write back
            const newContent = TOML.stringify(config);
            await this.s3.putObject(tomlKey, newContent, {
                contentType: 'application/toml',
            });
        } catch (err) {
            results.success = false;
            results.error = err.message;
        }

        return results;
    }

    /**
     * Convert game object to TOML structure
     */
    _gameToToml(game) {
        const now = new Date().toISOString().split('T')[0];

        return {
            game: {
                id: game.id || game.slug,
                name: game.name || game.slug,
                summary: game.summary || game.description || '',
                author: game.author || 'Unknown',
            },
            version: {
                current: game.version || '1.0.0',
                auto_increment: 'patch',
                released: now,
            },
            files: {
                entry: game.entry || 'index.html',
                thumbnail: game.thumbnail
                    ? game.thumbnail.split('/').pop()
                    : 'thumb.png',
            },
            metadata: {
                tags: game.tags || [],
                created: game.created || now,
                updated: game.updated || now,
            },
            permissions: {
                requires_auth: game.requires_auth || false,
                min_role: game.min_role || 'guest',
            },
        };
    }

    /**
     * Compare two game objects and return list of changed fields
     */
    _compareGames(a, b) {
        const changes = [];
        const fieldsToCompare = [
            'name', 'summary', 'description', 'version', 'author',
            'entry', 'requires_auth', 'min_role',
        ];

        for (const field of fieldsToCompare) {
            const valA = a[field];
            const valB = b[field];
            if (JSON.stringify(valA) !== JSON.stringify(valB)) {
                changes.push({
                    field,
                    from: valA,
                    to: valB,
                });
            }
        }

        // Compare tags array
        const tagsA = JSON.stringify(a.tags || []);
        const tagsB = JSON.stringify(b.tags || []);
        if (tagsA !== tagsB) {
            changes.push({
                field: 'tags',
                from: a.tags,
                to: b.tags,
            });
        }

        return changes;
    }
}
