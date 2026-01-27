/**
 * GameTypeRegistry - Load and manage game type definitions
 *
 * Game types define validation rules for different kinds of games:
 * - pja-game: Games integrated with PJA SDK
 * - static-game: Simple HTML games without SDK
 *
 * Types are defined via TOML config files and optional JS modules
 * for complex validation logic.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import TOML from '@iarna/toml';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export class GameTypeRegistry {
    constructor() {
        this.types = new Map();
        this.typesDir = null;
    }

    /**
     * Load all game types from the types directory
     * @param {string} [typesDir] - Override types directory
     */
    async load(typesDir = null) {
        this.typesDir = typesDir || __dirname;

        if (!existsSync(this.typesDir)) {
            throw new Error(`Game types directory not found: ${this.typesDir}`);
        }

        const files = readdirSync(this.typesDir);
        const tomlFiles = files.filter(f => f.endsWith('.toml'));

        for (const tomlFile of tomlFiles) {
            const typeName = basename(tomlFile, '.toml');
            await this.loadType(typeName);
        }

        return this;
    }

    /**
     * Load a single game type by name
     * @param {string} typeName - Type name (e.g., 'pja-game')
     */
    async loadType(typeName) {
        const tomlPath = join(this.typesDir, `${typeName}.toml`);

        if (!existsSync(tomlPath)) {
            throw new Error(`Game type config not found: ${tomlPath}`);
        }

        // Load TOML config
        const tomlContent = readFileSync(tomlPath, 'utf-8');
        const config = TOML.parse(tomlContent);

        // Merge with type name
        const type = {
            name: typeName,
            ...config.type,
            requirements: config.requirements || {},
            files: config.files || { required: [], recommended: [] },
            validators: config.validators || { required: [] },
            sdk: config.sdk || null,
            handlers: config.handlers || null,
        };

        // Try to load optional JS module for complex logic
        const jsPath = join(this.typesDir, `${typeName}.type.js`);
        if (existsSync(jsPath)) {
            try {
                const module = await import(jsPath);
                type.module = module.default || module;
            } catch (err) {
                console.warn(`Warning: Failed to load type module ${jsPath}: ${err.message}`);
            }
        }

        this.types.set(typeName, type);
        return type;
    }

    /**
     * Get a game type by name
     * @param {string} typeName - Type name
     * @returns {object|null} Game type definition
     */
    getType(typeName) {
        return this.types.get(typeName) || null;
    }

    /**
     * Get the default type for games without explicit type
     * @returns {object} Default game type (static-game)
     */
    getDefaultType() {
        return this.types.get('static-game') || {
            name: 'static-game',
            description: 'Basic HTML game',
            requirements: { sdk: false },
            files: { required: ['index.html'], recommended: ['game.toml'] },
            validators: { required: ['html', 'assets'] },
        };
    }

    /**
     * Resolve game type from game manifest/config
     * @param {object} game - Game object with optional type field
     * @returns {object} Resolved game type
     */
    resolveType(game) {
        // Explicit type in game.toml
        if (game.type) {
            const type = this.getType(game.type);
            if (type) return type;
            console.warn(`Unknown game type "${game.type}", using default`);
        }

        // Check for SDK override in game config
        if (game.sdk?.required === false) {
            return this.getDefaultType();
        }

        // Default to pja-game for org games (they usually need SDK)
        return this.getType('pja-game') || this.getDefaultType();
    }

    /**
     * List all registered type names
     * @returns {string[]}
     */
    listTypes() {
        return Array.from(this.types.keys());
    }

    /**
     * Check if SDK is required for a game type
     * @param {object} gameType - Game type definition
     * @param {object} [gameConfig] - Optional game-specific config overrides
     * @returns {boolean}
     */
    sdkRequired(gameType, gameConfig = null) {
        // Game-level override takes precedence
        if (gameConfig?.sdk?.required === false) {
            return false;
        }

        // Type-level requirement
        return gameType.requirements?.sdk !== false;
    }

    /**
     * Get SDK patterns for a game type
     * @param {object} gameType - Game type definition
     * @returns {string[]}
     */
    getSdkPatterns(gameType) {
        return gameType.sdk?.patterns || [];
    }

    /**
     * Get required validators for a game type
     * @param {object} gameType - Game type definition
     * @returns {string[]}
     */
    getRequiredValidators(gameType) {
        return gameType.validators?.required || [];
    }
}

// Singleton instance
let _registry = null;

/**
 * Get the global GameTypeRegistry instance
 * @returns {GameTypeRegistry}
 */
export function getRegistry() {
    if (!_registry) {
        _registry = new GameTypeRegistry();
    }
    return _registry;
}

/**
 * Initialize the global registry (call at startup)
 * @param {string} [typesDir] - Override types directory
 * @returns {Promise<GameTypeRegistry>}
 */
export async function initializeRegistry(typesDir = null) {
    _registry = new GameTypeRegistry();
    await _registry.load(typesDir);
    return _registry;
}

export default GameTypeRegistry;
