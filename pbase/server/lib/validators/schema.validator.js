/**
 * Schema Validator - Validates game.toml structure and required fields
 *
 * Checks:
 * - game.toml exists
 * - Required fields present based on game type
 * - Field value formats are valid
 */

export const name = 'schema';
export const description = 'Validates game.toml structure and required fields';
export const hooks = ['onSave', 'onSync', 'onPublish'];
export const categories = ['manifest', 'config'];

/**
 * Validate game.toml schema
 * @param {ValidationContext} context
 * @param {object} gameType
 * @returns {Promise<{issues: Array, warnings: Array, passed: Array}>}
 */
export async function validate(context, gameType) {
    const issues = [];
    const warnings = [];
    const passed = [];

    // Get game.toml content
    const config = await context.getGameConfig();

    if (!config) {
        // Check if file exists but couldn't be parsed
        const exists = await context.fileExists('game.toml');

        if (!exists) {
            warnings.push({
                id: 'missing-game-toml',
                severity: 'warning',
                category: 'manifest',
                message: 'game.toml not found (recommended for game metadata)',
            });
        } else {
            issues.push({
                id: 'invalid-game-toml',
                severity: 'error',
                category: 'manifest',
                message: 'game.toml exists but could not be parsed (invalid TOML)',
            });
        }

        return { issues, warnings, passed };
    }

    passed.push({ id: 'game-toml-exists', message: 'game.toml exists and is valid TOML' });

    // Check [game] section
    if (!config.game) {
        warnings.push({
            id: 'missing-game-section',
            severity: 'warning',
            category: 'manifest',
            message: 'Missing [game] section in game.toml',
        });
    } else {
        passed.push({ id: 'game-section', message: '[game] section present' });

        // Required fields in [game]
        const requiredFields = ['name'];
        const recommendedFields = ['id', 'summary', 'author'];

        for (const field of requiredFields) {
            if (!config.game[field]) {
                issues.push({
                    id: `missing-${field}`,
                    severity: 'error',
                    category: 'manifest',
                    message: `Missing required field: game.${field}`,
                });
            } else {
                passed.push({ id: `game-${field}`, message: `game.${field} present` });
            }
        }

        for (const field of recommendedFields) {
            if (!config.game[field]) {
                warnings.push({
                    id: `missing-${field}`,
                    severity: 'warning',
                    category: 'manifest',
                    message: `Missing recommended field: game.${field}`,
                });
            }
        }
    }

    // Check [version] section
    if (!config.version?.current) {
        warnings.push({
            id: 'missing-version',
            severity: 'warning',
            category: 'manifest',
            message: 'Missing version.current field',
        });
    } else {
        // Validate semver format
        const version = config.version.current;
        if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
            warnings.push({
                id: 'invalid-version-format',
                severity: 'warning',
                category: 'manifest',
                message: `Invalid version format: ${version} (expected semver like 1.0.0)`,
            });
        } else {
            passed.push({ id: 'version-format', message: `Version ${version} is valid semver` });
        }
    }

    // Check [files] section
    if (config.files) {
        if (config.files.entry) {
            passed.push({ id: 'entry-defined', message: `Entry file: ${config.files.entry}` });
        }
        if (config.files.thumbnail) {
            passed.push({ id: 'thumbnail-defined', message: `Thumbnail: ${config.files.thumbnail}` });
        }
    }

    // Check [permissions] section if game requires auth
    if (config.permissions?.requires_auth) {
        if (!config.permissions.min_role) {
            warnings.push({
                id: 'missing-min-role',
                severity: 'warning',
                category: 'manifest',
                message: 'requires_auth is true but min_role not specified',
            });
        } else {
            const validRoles = ['guest', 'user', 'dev', 'admin'];
            if (!validRoles.includes(config.permissions.min_role)) {
                warnings.push({
                    id: 'invalid-min-role',
                    severity: 'warning',
                    category: 'manifest',
                    message: `Invalid min_role: ${config.permissions.min_role} (expected: ${validRoles.join(', ')})`,
                });
            }
        }
    }

    // Check game type declaration
    if (config.game?.type) {
        if (config.game.type !== gameType.name) {
            warnings.push({
                id: 'type-mismatch',
                severity: 'warning',
                category: 'manifest',
                message: `Declared type "${config.game.type}" differs from resolved type "${gameType.name}"`,
            });
        }
    }

    return { issues, warnings, passed };
}

export default { name, description, hooks, categories, validate };
