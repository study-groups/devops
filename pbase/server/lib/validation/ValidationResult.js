/**
 * ValidationResult - Aggregates results from multiple validators
 *
 * Computes overall success, counts, and provides formatted output
 * for both JSON API responses and terminal display.
 */

export class ValidationResult {
    /**
     * @param {object} options
     * @param {string} options.slug - Game slug
     * @param {string} options.gameType - Game type name
     * @param {string} options.hook - Hook that triggered validation
     */
    constructor(options) {
        this.slug = options.slug;
        this.gameType = options.gameType;
        this.hook = options.hook;

        this.validators = [];
        this.issues = [];
        this.warnings = [];
        this.passed = [];
    }

    /**
     * Add results from a single validator
     * @param {object} result - Validator result
     */
    addValidatorResult(result) {
        this.validators.push({
            validator: result.validator,
            success: result.success,
            duration: result.duration,
            error: result.error || null,
            issues: result.issues || [],
            warnings: result.warnings || [],
            passed: result.passed || [],
        });

        // Aggregate into top-level arrays
        if (result.issues) {
            for (const issue of result.issues) {
                this.issues.push({
                    ...issue,
                    validator: result.validator,
                });
            }
        }

        if (result.warnings) {
            for (const warning of result.warnings) {
                this.warnings.push({
                    ...warning,
                    validator: result.validator,
                });
            }
        }

        if (result.passed) {
            for (const pass of result.passed) {
                this.passed.push(typeof pass === 'string' ? { id: pass, validator: result.validator } : { ...pass, validator: result.validator });
            }
        }
    }

    /**
     * Check if validation passed (no errors)
     * @returns {boolean}
     */
    get success() {
        return this.issues.length === 0;
    }

    /**
     * Get counts summary
     * @returns {object}
     */
    get counts() {
        return {
            validators: this.validators.length,
            passed: this.passed.length,
            errors: this.issues.length,
            warnings: this.warnings.length,
        };
    }

    /**
     * Convert to JSON-serializable object for API response
     * @param {object} [options]
     * @param {boolean} [options.includeValidators=true] - Include per-validator details
     * @returns {object}
     */
    toJSON(options = {}) {
        const includeValidators = options.includeValidators !== false;

        const result = {
            hook: this.hook,
            success: this.success,
            counts: this.counts,
        };

        if (includeValidators) {
            result.validators = this.validators;
        }

        // Only include issues/warnings if there are any
        if (this.issues.length > 0) {
            result.issues = this.issues;
        }

        if (this.warnings.length > 0) {
            result.warnings = this.warnings;
        }

        return result;
    }

    /**
     * Format for terminal output
     * @returns {string}
     */
    formatText() {
        const lines = [];

        lines.push(`Validate: ${this.slug} (${this.gameType})`);
        lines.push('═'.repeat(50));
        lines.push('');

        // Group by validator
        for (const v of this.validators) {
            const status = v.success && v.issues.length === 0 ? '✓' : '✗';
            const duration = v.duration ? ` (${v.duration}ms)` : '';
            lines.push(`[${status}] ${v.validator}${duration}`);

            // Show passed checks
            for (const p of v.passed) {
                const msg = typeof p === 'string' ? p : (p.message || p.id);
                lines.push(`    ✓ ${msg}`);
            }

            // Show issues
            for (const issue of v.issues) {
                lines.push(`    ✗ ${issue.message}`);
            }

            // Show warnings
            for (const warn of v.warnings) {
                lines.push(`    ⚠ ${warn.message}`);
            }

            if (v.error) {
                lines.push(`    ✗ Error: ${v.error}`);
            }

            lines.push('');
        }

        // Summary
        lines.push('───');
        const { errors, warnings, passed } = this.counts;

        if (errors === 0 && warnings === 0) {
            lines.push(`✓ All ${passed} checks passed`);
        } else if (errors === 0) {
            lines.push(`✓ Passed with ${warnings} warning(s)`);
        } else {
            lines.push(`✗ ${errors} error(s), ${warnings} warning(s)`);
        }

        return lines.join('\n');
    }

    /**
     * Create a failure response object for API errors
     * @returns {object}
     */
    toErrorResponse() {
        return {
            error: 'Validation Failed',
            message: `${this.issues.length} validation error(s)`,
            gameType: this.gameType,
            validation: this.toJSON(),
        };
    }

    /**
     * Create a success response object for API
     * @param {object} [extra] - Additional fields to include
     * @returns {object}
     */
    toSuccessResponse(extra = {}) {
        return {
            success: true,
            slug: this.slug,
            gameType: this.gameType,
            validation: this.toJSON(),
            ...extra,
        };
    }

    /**
     * Static factory: create from error
     * @param {string} slug
     * @param {string} gameType
     * @param {string} hook
     * @param {Error} error
     * @returns {ValidationResult}
     */
    static fromError(slug, gameType, hook, error) {
        const result = new ValidationResult({ slug, gameType, hook });
        result.addValidatorResult({
            validator: 'system',
            success: false,
            error: error.message,
            issues: [{
                id: 'validation-error',
                severity: 'error',
                category: 'system',
                message: error.message,
            }],
            warnings: [],
            passed: [],
        });
        return result;
    }
}

export default ValidationResult;
