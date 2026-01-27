/**
 * Assets Validator - Validates required and recommended files exist
 *
 * Checks:
 * - Required files (index.html)
 * - Recommended files (game.toml, thumb.png)
 * - Entry file defined in game.toml exists
 * - Thumbnail file exists if defined
 */

export const name = 'assets';
export const description = 'Validates required and recommended files exist';
export const hooks = ['onSave', 'onSync', 'onPublish'];
export const categories = ['files', 'assets'];

/**
 * Validate file existence
 * @param {ValidationContext} context
 * @param {object} gameType
 * @returns {Promise<{issues: Array, warnings: Array, passed: Array}>}
 */
export async function validate(context, gameType) {
    const issues = [];
    const warnings = [];
    const passed = [];

    // Get file lists from game type
    const requiredFiles = context.getRequiredFiles();
    const recommendedFiles = context.getRecommendedFiles();

    // Check required files
    for (const file of requiredFiles) {
        const exists = await context.fileExists(file);

        if (!exists) {
            issues.push({
                id: `missing-required-${file.replace(/[^a-z0-9]/gi, '-')}`,
                severity: 'error',
                category: 'files',
                message: `Missing required file: ${file}`,
            });
        } else {
            passed.push({
                id: `required-${file.replace(/[^a-z0-9]/gi, '-')}`,
                message: `Required file exists: ${file}`,
            });
        }
    }

    // Check recommended files
    for (const file of recommendedFiles) {
        const exists = await context.fileExists(file);

        if (!exists) {
            warnings.push({
                id: `missing-recommended-${file.replace(/[^a-z0-9]/gi, '-')}`,
                severity: 'warning',
                category: 'files',
                message: `Missing recommended file: ${file}`,
            });
        } else {
            passed.push({
                id: `recommended-${file.replace(/[^a-z0-9]/gi, '-')}`,
                message: `Recommended file exists: ${file}`,
            });
        }
    }

    // Check custom entry file from game.toml
    const config = await context.getGameConfig();
    if (config?.files?.entry) {
        const entryFile = config.files.entry;

        // Skip if it's already checked as required
        if (!requiredFiles.includes(entryFile)) {
            const exists = await context.fileExists(entryFile);

            if (!exists) {
                issues.push({
                    id: 'missing-entry-file',
                    severity: 'error',
                    category: 'files',
                    message: `Entry file not found: ${entryFile} (defined in game.toml)`,
                });
            } else {
                passed.push({
                    id: 'entry-file',
                    message: `Entry file exists: ${entryFile}`,
                });
            }
        }
    }

    // Check thumbnail if defined
    if (config?.files?.thumbnail) {
        const thumbnailFile = config.files.thumbnail;
        const exists = await context.fileExists(thumbnailFile);

        if (!exists) {
            // Try common extensions
            const extensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
            let foundWithExt = false;

            for (const ext of extensions) {
                if (await context.fileExists(thumbnailFile + ext)) {
                    foundWithExt = true;
                    break;
                }
            }

            if (!foundWithExt) {
                warnings.push({
                    id: 'missing-thumbnail',
                    severity: 'warning',
                    category: 'files',
                    message: `Thumbnail file not found: ${thumbnailFile}`,
                });
            } else {
                passed.push({
                    id: 'thumbnail',
                    message: `Thumbnail found (with extension): ${thumbnailFile}`,
                });
            }
        } else {
            passed.push({
                id: 'thumbnail',
                message: `Thumbnail exists: ${thumbnailFile}`,
            });
        }
    } else if (context.game?.thumbnail) {
        // Thumbnail in manifest but not in game.toml
        passed.push({
            id: 'thumbnail-in-manifest',
            message: 'Thumbnail defined in manifest',
        });
    } else {
        // No thumbnail defined anywhere
        warnings.push({
            id: 'no-thumbnail-defined',
            severity: 'warning',
            category: 'files',
            message: 'No thumbnail defined (recommended for game listings)',
        });
    }

    // Count total files
    const files = await context.listFiles();
    passed.push({
        id: 'file-count',
        message: `Game has ${files.length} files`,
    });

    return { issues, warnings, passed };
}

export default { name, description, hooks, categories, validate };
