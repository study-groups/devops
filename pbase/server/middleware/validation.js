/**
 * Validation Middleware - Express middleware for game validation
 *
 * Provides:
 * - initializeValidation() - Startup initialization
 * - validateHook() - Middleware factory for validation hooks
 * - validateGame() - Direct validation function
 */

import { initializeEngine, getEngine } from '../lib/validation/index.js';
import { initializeRegistry, getRegistry } from '../lib/game-types/index.js';

let _initialized = false;

/**
 * Initialize the validation system (call at server startup)
 * @param {object} [options]
 * @returns {Promise<void>}
 */
export async function initializeValidation(options = {}) {
    if (_initialized) {
        console.log('[Validation] Already initialized');
        return;
    }

    console.log('[Validation] Initializing...');

    // Initialize game type registry
    await initializeRegistry(options.typesDir);
    console.log(`[Validation] Loaded game types: ${getRegistry().listTypes().join(', ')}`);

    // Initialize validation engine
    await initializeEngine({
        validatorsDir: options.validatorsDir,
        registry: getRegistry(),
    });
    console.log(`[Validation] Loaded validators: ${getEngine().listValidators().join(', ')}`);

    _initialized = true;
}

/**
 * Create validation middleware for a specific hook
 *
 * @param {string} hook - Hook name (onUpload, onSave, onPublish, onSync)
 * @param {object} [options]
 * @param {boolean} [options.failOnErrors=true] - Reject request if validation errors
 * @param {boolean} [options.failOnWarnings=false] - Reject request if warnings
 * @param {boolean} [options.attachResult=true] - Attach result to req.validation
 * @returns {Function} Express middleware
 */
export function validateHook(hook, options = {}) {
    const {
        failOnErrors = true,
        failOnWarnings = false,
        attachResult = true,
    } = options;

    return async function validationMiddleware(req, res, next) {
        try {
            // Ensure initialized
            if (!_initialized) {
                await initializeValidation();
            }

            // Get slug from params
            const slug = req.params.slug;
            if (!slug) {
                return next(); // No game to validate
            }

            // Get provider from app.locals (set by server.js)
            const provider = req.app.locals.gameProvider || req.app.locals.s3Provider;
            if (!provider) {
                console.warn('[Validation] No provider available, skipping validation');
                return next();
            }

            // Get game metadata if available
            const gameManifest = req.app.locals.gameManifest;
            let game = null;
            if (gameManifest) {
                try {
                    game = await gameManifest.getGame(slug);
                } catch { /* ignore */ }
            }

            // Run validation
            const engine = getEngine();
            const result = await engine.validate({
                slug,
                game,
                hook,
                provider,
            });

            // Attach result to request
            if (attachResult) {
                req.validation = result;
            }

            // Check if we should block the request
            const hasErrors = result.issues.length > 0;
            const hasWarnings = result.warnings.length > 0;

            if (failOnErrors && hasErrors) {
                return res.status(400).json(result.toErrorResponse());
            }

            if (failOnWarnings && hasWarnings) {
                return res.status(400).json(result.toErrorResponse());
            }

            next();
        } catch (err) {
            console.error('[Validation] Middleware error:', err);
            // Don't block on validation errors - let the route handle it
            req.validationError = err.message;
            next();
        }
    };
}

/**
 * Validate a game directly (not as middleware)
 *
 * @param {object} options
 * @param {string} options.slug - Game slug
 * @param {object} options.provider - Storage provider
 * @param {string} options.hook - Hook name
 * @param {object} [options.game] - Game metadata
 * @returns {Promise<ValidationResult>}
 */
export async function validateGame(options) {
    if (!_initialized) {
        await initializeValidation();
    }

    const engine = getEngine();
    return engine.validate(options);
}

/**
 * Get validation health status
 * @returns {object}
 */
export function getValidationHealth() {
    if (!_initialized) {
        return {
            initialized: false,
            ok: false,
            message: 'Validation system not initialized',
        };
    }

    const registry = getRegistry();
    const engine = getEngine();

    return {
        initialized: true,
        ok: true,
        gameTypes: registry.listTypes(),
        validators: engine.listValidators(),
    };
}

export default {
    initializeValidation,
    validateHook,
    validateGame,
    getValidationHealth,
};
