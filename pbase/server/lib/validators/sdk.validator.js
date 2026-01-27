/**
 * SDK Validator - Validates PJA SDK presence and handler implementation
 *
 * Checks:
 * - SDK script is loaded in HTML
 * - Lifecycle handlers are implemented (onStart, onStop, onPause)
 * - Volume handler is implemented (warning if missing)
 *
 * Supports three integration styles:
 *   1. Callback style: PJA.onStart = function() {}
 *   2. Game API style: PJA.Game.on('start', fn)
 *   3. RT-level style: PJA.RT.on('game:control', fn)
 */

export const name = 'sdk';
export const description = 'Validates PJA SDK presence and handler implementation';
export const hooks = ['onSync', 'onPublish'];
export const categories = ['sdk'];

/**
 * Validate SDK presence and handlers
 * @param {ValidationContext} context
 * @param {object} gameType
 * @returns {Promise<{issues: Array, warnings: Array, passed: Array}>}
 */
export async function validate(context, gameType) {
    const issues = [];
    const warnings = [];
    const passed = [];

    // Check if SDK is required
    const sdkRequired = await context.sdkRequired();

    if (!sdkRequired) {
        passed.push({
            id: 'sdk-not-required',
            message: 'SDK not required for this game type (sdk.required=false)',
        });
        return { issues, warnings, passed };
    }

    // Get all content to search
    let allContent = '';

    // Read index.html
    const html = await context.getFileContent('index.html');
    if (html) {
        allContent += html;
    }

    // Read all JS files
    const files = await context.listFiles();
    const jsFiles = files.filter(f => f.name.endsWith('.js'));

    for (const file of jsFiles) {
        const content = await context.getFileContent(file.name);
        if (content) {
            allContent += '\n' + content;
        }
    }

    if (!allContent) {
        issues.push({
            id: 'no-content',
            severity: 'error',
            category: 'sdk',
            message: 'No HTML or JS files found to validate',
        });
        return { issues, warnings, passed };
    }

    // Check SDK presence
    const sdkPatterns = context.getSdkPatterns();
    let sdkFound = false;
    let sdkPattern = null;

    for (const pattern of sdkPatterns) {
        if (allContent.includes(pattern)) {
            sdkFound = true;
            sdkPattern = pattern;
            break;
        }
    }

    // Also check for inline PJA initialization
    if (!sdkFound) {
        if (/window\.PJA\s*=/.test(allContent) || /PJA\.ready\s*\(/.test(allContent)) {
            sdkFound = true;
            sdkPattern = 'inline PJA initialization';
        }
    }

    if (!sdkFound) {
        issues.push({
            id: 'sdk-not-found',
            severity: 'error',
            category: 'sdk',
            message: 'PJA SDK not found in index.html or JS files',
            patterns: sdkPatterns,
        });
    } else {
        passed.push({
            id: 'sdk-found',
            message: `PJA SDK found (${sdkPattern})`,
        });
    }

    // Check handlers using the game type module if available
    const typeModule = gameType.module;
    if (typeModule?.detectIntegrationStyle) {
        const detection = typeModule.detectIntegrationStyle(allContent);

        // Check lifecycle handlers
        const requiredHandlers = gameType.handlers?.lifecycle || ['onStart', 'onStop', 'onPause'];
        const missingLifecycle = requiredHandlers.filter(h => !detection.handlers.lifecycle.includes(h));

        if (missingLifecycle.length > 0 && !detection.rtLevel) {
            issues.push({
                id: 'missing-lifecycle-handlers',
                severity: 'error',
                category: 'sdk',
                message: `Missing lifecycle handlers: ${missingLifecycle.join(', ')}`,
                handlers: missingLifecycle,
            });
        } else {
            const style = detection.rtLevel ? 'RT-level integration' : `${detection.style} style`;
            passed.push({
                id: 'lifecycle-handlers',
                message: `Lifecycle handlers OK (${style})`,
            });
        }

        // Check volume handler (warning only)
        if (!detection.handlers.volume) {
            warnings.push({
                id: 'missing-volume-handler',
                severity: 'warning',
                category: 'sdk',
                message: 'Missing onVolumeChange handler (recommended for audio games)',
            });
        } else {
            passed.push({
                id: 'volume-handler',
                message: 'Volume handler OK',
            });
        }
    } else {
        // Fallback: basic handler detection
        const handlerResult = detectHandlersBasic(allContent, gameType);

        if (handlerResult.missing.length > 0) {
            issues.push({
                id: 'missing-lifecycle-handlers',
                severity: 'error',
                category: 'sdk',
                message: `Missing lifecycle handlers: ${handlerResult.missing.join(', ')}`,
                handlers: handlerResult.missing,
            });
        } else {
            passed.push({
                id: 'lifecycle-handlers',
                message: 'Lifecycle handlers OK',
            });
        }

        if (!handlerResult.hasVolume) {
            warnings.push({
                id: 'missing-volume-handler',
                severity: 'warning',
                category: 'sdk',
                message: 'Missing onVolumeChange handler (recommended for audio games)',
            });
        }
    }

    return { issues, warnings, passed };
}

/**
 * Basic handler detection fallback
 */
function detectHandlersBasic(content, gameType) {
    const requiredHandlers = gameType.handlers?.lifecycle || ['onStart', 'onStop', 'onPause'];
    const found = [];
    const missing = [];

    // Check for RT-level integration first
    if (/PJA\.RT\.on\(['"']game:control['"']/.test(content)) {
        return { found: requiredHandlers, missing: [], hasVolume: /PJA\.RT\.on\(['"']audio:volume['"']/.test(content) };
    }

    for (const handler of requiredHandlers) {
        const eventName = handler.replace(/^on/, '').toLowerCase();

        // Callback style: PJA.onStart =
        const callbackPattern = new RegExp(`PJA\\.${handler}\\s*=`);
        // Game API style: PJA.Game.on('start', or Game.on('start',
        const gameApiPattern = new RegExp(`(?:PJA\\.)?Game\\.on\\(['"']${eventName}['"']`);
        // Object property style: onStart: or "onStart":
        const objectPattern = new RegExp(`['"']?${handler}['"']?\\s*:`);

        if (callbackPattern.test(content) || gameApiPattern.test(content) || objectPattern.test(content)) {
            found.push(handler);
        } else {
            missing.push(handler);
        }
    }

    // Check volume
    const hasVolume =
        /PJA\.onVolumeChange\s*=/.test(content) ||
        /(?:PJA\.)?Game\.on\(['"']volumechange['"']/i.test(content) ||
        /PJA\.RT\.on\(['"']audio:volume['"']/.test(content);

    return { found, missing, hasVolume };
}

export default { name, description, hooks, categories, validate };
