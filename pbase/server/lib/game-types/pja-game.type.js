/**
 * PJA Game Type - Complex validation logic for PJA SDK games
 *
 * This module extends the TOML config with JavaScript validation
 * that's too complex for declarative config (e.g., 3-style handler detection)
 */

export default {
    name: 'pja-game',
    extends: null,

    /**
     * Detect SDK handler integration style
     * Games can integrate with the PJA SDK in three ways:
     *   1. Callback style: PJA.onStart = function() {}
     *   2. Game API style: PJA.Game.on('start', fn)
     *   3. RT-level style: PJA.RT.on('game:control', fn)
     *
     * @param {string} jsContent - Combined JS/HTML content
     * @returns {object} Detection result with style and found handlers
     */
    detectIntegrationStyle(jsContent) {
        const result = {
            style: null,
            handlers: {
                lifecycle: [],
                volume: null,
            },
            rtLevel: false,
        };

        // Check for RT-level integration (covers all lifecycle handlers)
        if (/PJA\.RT\.on\(['"']game:control['"']/.test(jsContent)) {
            result.style = 'rt-level';
            result.rtLevel = true;
            result.handlers.lifecycle = ['onStart', 'onStop', 'onPause'];
        }

        // Check for RT-level volume handling
        if (/PJA\.RT\.on\(['"']audio:volume['"']/.test(jsContent)) {
            result.handlers.volume = 'rt-level';
        }

        // If not RT-level, check individual handlers
        if (!result.rtLevel) {
            const handlers = ['onStart', 'onStop', 'onPause'];

            for (const handler of handlers) {
                const eventName = handler.replace(/^on/, '').toLowerCase();

                // Callback style: PJA.onStart =
                const callbackPattern = new RegExp(`PJA\\.${handler}\\s*=`);
                // Game API style: PJA.Game.on('start', or Game.on('start',
                const gameApiPattern = new RegExp(`(?:PJA\\.)?Game\\.on\\(['"']${eventName}['"']`);
                // Object property style: onStart: or "onStart":
                const objectPattern = new RegExp(`['"']?${handler}['"']?\\s*:`);

                if (callbackPattern.test(jsContent)) {
                    result.style = result.style || 'callback';
                    result.handlers.lifecycle.push(handler);
                } else if (gameApiPattern.test(jsContent)) {
                    result.style = result.style || 'game-api';
                    result.handlers.lifecycle.push(handler);
                } else if (objectPattern.test(jsContent)) {
                    result.style = result.style || 'object';
                    result.handlers.lifecycle.push(handler);
                }
            }

            // Check volume handler separately
            if (!result.handlers.volume) {
                const volumeCallbackPattern = /PJA\.onVolumeChange\s*=/;
                const volumeGameApiPattern = /(?:PJA\.)?Game\.on\(['"']volumechange['"']/i;

                if (volumeCallbackPattern.test(jsContent) || volumeGameApiPattern.test(jsContent)) {
                    result.handlers.volume = result.style || 'callback';
                }
            }
        }

        return result;
    },

    /**
     * Validate handlers for a PJA game
     * @param {object} context - Validation context
     * @param {object} typeConfig - Type config from TOML
     * @returns {Promise<object>} Validation result with issues/warnings
     */
    async validateHandlers(context, typeConfig) {
        const issues = [];
        const warnings = [];
        const passed = [];

        // Get all JS content from game files
        let jsContent = '';

        // Read index.html (contains inline scripts)
        try {
            const html = await context.getFileContent('index.html');
            jsContent += html || '';
        } catch { /* ignore */ }

        // Read all .js files
        const files = await context.listFiles();
        const jsFiles = files.filter(f => f.name.endsWith('.js'));

        for (const file of jsFiles) {
            try {
                const content = await context.getFileContent(file.name);
                jsContent += content || '';
            } catch { /* ignore */ }
        }

        // Detect integration style
        const detection = this.detectIntegrationStyle(jsContent);

        // Validate required lifecycle handlers
        const requiredHandlers = typeConfig.handlers?.lifecycle || ['onStart', 'onStop', 'onPause'];
        const missingLifecycle = requiredHandlers.filter(h => !detection.handlers.lifecycle.includes(h));

        if (missingLifecycle.length > 0) {
            issues.push({
                id: 'missing-lifecycle-handlers',
                severity: 'error',
                category: 'sdk',
                message: `Missing lifecycle handlers: ${missingLifecycle.join(', ')}`,
                handlers: missingLifecycle,
            });
        } else {
            passed.push({
                id: 'lifecycle-handlers',
                message: detection.rtLevel
                    ? 'Lifecycle handlers OK (RT-level integration)'
                    : `Lifecycle handlers OK (${detection.style} style)`,
            });
        }

        // Check volume handler (warning only)
        const optionalHandlers = typeConfig.handlers?.optional || ['onVolumeChange'];
        if (optionalHandlers.includes('onVolumeChange') && !detection.handlers.volume) {
            warnings.push({
                id: 'missing-volume-handler',
                severity: 'warning',
                category: 'sdk',
                message: 'Missing onVolumeChange handler (recommended for audio games)',
            });
        } else if (detection.handlers.volume) {
            passed.push({
                id: 'volume-handler',
                message: 'Volume handler OK',
            });
        }

        return { issues, warnings, passed, detection };
    },
};
