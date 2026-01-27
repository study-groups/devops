/**
 * ValidationEngine - Core validation orchestration
 *
 * Auto-discovers validators from lib/validators/ directory and
 * runs them based on hooks (onUpload, onSave, onPublish, onSync).
 * Validators run in parallel with results aggregated.
 */

import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { ValidationContext } from './ValidationContext.js';
import { ValidationResult } from './ValidationResult.js';
import { getRegistry } from '../game-types/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export class ValidationEngine {
    constructor(options = {}) {
        this.validators = new Map();
        this.validatorsDir = options.validatorsDir || join(__dirname, '..', 'validators');
        this.registry = options.registry || null;
        this.initialized = false;
    }

    /**
     * Initialize the engine by loading all validators
     * @param {object} [options]
     * @param {string} [options.validatorsDir] - Override validators directory
     */
    async initialize(options = {}) {
        if (options.validatorsDir) {
            this.validatorsDir = options.validatorsDir;
        }

        // Get or initialize the game type registry
        this.registry = options.registry || getRegistry();

        // Load validators from directory
        await this.loadValidators();

        this.initialized = true;
        return this;
    }

    /**
     * Load all validators from the validators directory
     */
    async loadValidators() {
        if (!existsSync(this.validatorsDir)) {
            console.warn(`Validators directory not found: ${this.validatorsDir}`);
            return;
        }

        const files = readdirSync(this.validatorsDir);
        const validatorFiles = files.filter(f => f.endsWith('.validator.js'));

        for (const file of validatorFiles) {
            const name = basename(file, '.validator.js');
            const filePath = join(this.validatorsDir, file);

            try {
                const module = await import(filePath);
                const validator = module.default || module;

                if (typeof validator.validate !== 'function') {
                    console.warn(`Validator ${name} missing validate() function, skipping`);
                    continue;
                }

                this.validators.set(name, {
                    name,
                    ...validator,
                });

                console.log(`[ValidationEngine] Loaded validator: ${name}`);
            } catch (err) {
                console.error(`[ValidationEngine] Failed to load validator ${file}:`, err.message);
            }
        }
    }

    /**
     * Get validators for a specific hook
     * @param {string} hook - Hook name (onUpload, onSave, onPublish, onSync)
     * @param {object} gameType - Game type definition
     * @returns {Array} Validators that should run for this hook
     */
    getValidatorsForHook(hook, gameType) {
        const requiredValidators = gameType?.validators?.required || [];
        const result = [];

        for (const [name, validator] of this.validators) {
            // Check if validator declares hooks it runs on
            const validatorHooks = validator.hooks || ['onPublish', 'onSync'];

            if (!validatorHooks.includes(hook)) {
                continue;
            }

            // Check if this validator is required for the game type
            // All validators run for publish/sync, but only required ones for save/upload
            if (hook === 'onSave' || hook === 'onUpload') {
                if (!requiredValidators.includes(name)) {
                    continue;
                }
            }

            result.push(validator);
        }

        return result;
    }

    /**
     * Validate a game
     * @param {object} options
     * @param {string} options.slug - Game slug
     * @param {object} options.game - Game metadata object
     * @param {string} options.hook - Hook triggering validation
     * @param {object} options.provider - Storage provider (S3 or Local)
     * @param {object} [options.gameConfig] - Parsed game.toml config
     * @returns {Promise<ValidationResult>}
     */
    async validate(options) {
        const { slug, game, hook, provider, gameConfig } = options;

        if (!this.initialized) {
            await this.initialize();
        }

        // Resolve game type
        const gameType = this.registry.resolveType(game || gameConfig || {});

        // Create validation context
        const context = new ValidationContext({
            slug,
            game,
            gameType,
            gameConfig,
            provider,
            hook,
            registry: this.registry,
        });

        // Get validators for this hook
        const validators = this.getValidatorsForHook(hook, gameType);

        // Create result aggregator
        const result = new ValidationResult({
            slug,
            gameType: gameType.name,
            hook,
        });

        // Run validators in parallel
        const validatorPromises = validators.map(async (validator) => {
            const startTime = Date.now();

            try {
                const validatorResult = await validator.validate(context, gameType);
                const duration = Date.now() - startTime;

                return {
                    validator: validator.name,
                    success: true,
                    duration,
                    ...validatorResult,
                };
            } catch (err) {
                const duration = Date.now() - startTime;

                return {
                    validator: validator.name,
                    success: false,
                    duration,
                    error: err.message,
                    issues: [{
                        id: `${validator.name}-error`,
                        severity: 'error',
                        category: validator.name,
                        message: `Validator error: ${err.message}`,
                    }],
                    warnings: [],
                    passed: [],
                };
            }
        });

        const validatorResults = await Promise.allSettled(validatorPromises);

        // Aggregate results
        for (const settled of validatorResults) {
            if (settled.status === 'fulfilled') {
                result.addValidatorResult(settled.value);
            } else {
                result.addValidatorResult({
                    validator: 'unknown',
                    success: false,
                    error: settled.reason?.message || 'Unknown error',
                    issues: [{
                        id: 'validator-failed',
                        severity: 'error',
                        category: 'system',
                        message: settled.reason?.message || 'Validator failed',
                    }],
                    warnings: [],
                    passed: [],
                });
            }
        }

        return result;
    }

    /**
     * Quick validation check for a single validator
     * Useful for targeted validation (e.g., just check SDK)
     */
    async validateSingle(validatorName, context) {
        const validator = this.validators.get(validatorName);

        if (!validator) {
            throw new Error(`Validator not found: ${validatorName}`);
        }

        return validator.validate(context, context.gameType);
    }

    /**
     * List available validators
     * @returns {string[]}
     */
    listValidators() {
        return Array.from(this.validators.keys());
    }

    /**
     * Get validator info
     * @param {string} name - Validator name
     * @returns {object|null}
     */
    getValidator(name) {
        const validator = this.validators.get(name);
        if (!validator) return null;

        return {
            name: validator.name,
            description: validator.description || '',
            hooks: validator.hooks || ['onPublish', 'onSync'],
            categories: validator.categories || [],
        };
    }
}

// Singleton instance
let _engine = null;

/**
 * Get the global ValidationEngine instance
 * @returns {ValidationEngine}
 */
export function getEngine() {
    if (!_engine) {
        _engine = new ValidationEngine();
    }
    return _engine;
}

/**
 * Initialize the global engine (call at startup)
 * @param {object} [options]
 * @returns {Promise<ValidationEngine>}
 */
export async function initializeEngine(options = {}) {
    _engine = new ValidationEngine(options);
    await _engine.initialize(options);
    return _engine;
}

export default ValidationEngine;
