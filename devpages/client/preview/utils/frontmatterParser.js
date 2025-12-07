// Get a dedicated logger for this module
const log = window.APP?.services?.log?.createLogger('FrontmatterParser') || console;

/**
 * Enhanced frontmatter parser with better error handling and type coercion
 * @param {string} markdownContent - Raw markdown content
 * @returns {{frontMatter: object, body: string}}
 */
export function parseFrontmatter(markdownContent) {
    log.info('FRONTMATTER', 'PARSE_START', 'Parsing frontmatter (enhanced version)...');
    
    if (!markdownContent || typeof markdownContent !== 'string') {
        log.warn('FRONTMATTER', 'PARSE_INVALID_CONTENT', 'Invalid markdown content provided');
        return { frontMatter: {}, body: markdownContent || '' };
    }

    const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
    const match = markdownContent.match(fmRegex);

    let frontMatterData = {};
    let markdownBody = markdownContent;

    if (!match || !match[1]) {
        log.info('FRONTMATTER', 'PARSE_NO_FRONTMATTER', 'No frontmatter block found');
        return { frontMatter: frontMatterData, body: markdownBody };
    }

    const yamlContent = match[1];
    markdownBody = markdownContent.substring(match[0].length);
    log.info('FRONTMATTER', 'PARSE_FRONTMATTER_FOUND', `Found frontmatter block (${yamlContent.length} chars)`);

    try {
        frontMatterData = parseYamlContent(yamlContent);
        log.info('FRONTMATTER', 'PARSE_SUCCESS', `Successfully parsed ${Object.keys(frontMatterData).length} frontmatter keys`);
    } catch (error) {
        log.error('FRONTMATTER', 'PARSE_FAILED', `Error parsing frontmatter: ${error.message}`, error);
        frontMatterData = {};
        markdownBody = markdownContent; // Fallback to original content
    }

    return { frontMatter: frontMatterData, body: markdownBody };
}

/**
 * Parse YAML content with enhanced support for arrays, block scalars, and proper type coercion
 * @param {string} yamlContent - Raw YAML content
 * @returns {object} Parsed data object
 */
function parseYamlContent(yamlContent) {
    const lines = yamlContent.split('\n');
    const result = {};
    
    let currentKey = null;
    let currentValue = [];
    let baseIndent = -1;
    let parsingState = 'none'; // 'none', 'array', 'block_scalar'
    let arrayValues = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const currentIndent = line.search(/\S/);

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        // Handle array items
        if (parsingState === 'array' && trimmedLine.startsWith('-')) {
            const itemValue = trimmedLine.substring(1).trim();
            arrayValues.push(parseValue(itemValue));
            continue;
        }

        // Handle block scalar content
        if (parsingState === 'block_scalar' && currentIndent >= baseIndent) {
            if (baseIndent === -1) {
                baseIndent = currentIndent;
            }
            currentValue.push(line.substring(baseIndent));
            continue;
        }

        // Finalize previous parsing state
        if (currentKey) {
            if (parsingState === 'array') {
                result[currentKey] = arrayValues;
                log.debug('FRONTMATTER', 'PARSE_ARRAY_COMPLETE', `Completed array '${currentKey}' with ${arrayValues.length} items`);
            } else if (parsingState === 'block_scalar') {
                result[currentKey] = currentValue.join('\n').trim();
                log.debug('FRONTMATTER', 'PARSE_BLOCK_SCALAR_COMPLETE', `Completed block scalar '${currentKey}'`);
            }
            
            // Reset state
            currentKey = null;
            currentValue = [];
            arrayValues = [];
            baseIndent = -1;
            parsingState = 'none';
        }

        // Parse new key-value pair
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const valueStr = line.substring(colonIndex + 1).trim();

            // Detect array start
            if (isArrayKey(key) && valueStr === '') {
                currentKey = key;
                parsingState = 'array';
                arrayValues = [];
                baseIndent = currentIndent + 2; // Expect items to be indented
                log.debug('FRONTMATTER', 'PARSE_ARRAY_START', `Starting array parsing for '${key}'`);
                continue;
            }

            // Detect block scalar start
            if (isBlockScalarKey(key) && (valueStr === '|' || valueStr === '>')) {
                currentKey = key;
                parsingState = 'block_scalar';
                currentValue = [];
                baseIndent = -1; // Will be determined by first content line
                log.debug('FRONTMATTER', 'PARSE_BLOCK_SCALAR_START', `Starting block scalar parsing for '${key}'`);
                continue;
            }

            // Simple key-value pair
            result[key] = parseValue(valueStr);
            log.debug('FRONTMATTER', 'PARSE_KEY_VALUE', `Parsed simple key-value: ${key} = ${JSON.stringify(result[key])}`);
        }
    }

    // Finalize any remaining parsing state
    if (currentKey) {
        if (parsingState === 'array') {
            result[currentKey] = arrayValues;
        } else if (parsingState === 'block_scalar') {
            result[currentKey] = currentValue.join('\n').trim();
        }
    }

    return result;
}

/**
 * Parse and coerce a YAML value to the appropriate JavaScript type
 * @param {string} valueStr - Raw value string
 * @returns {any} Parsed value
 */
function parseValue(valueStr) {
    if (!valueStr || valueStr === '') {
        return '';
    }

    // Handle quoted strings
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || 
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
        return valueStr.substring(1, valueStr.length - 1);
    }

    // Handle booleans
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;
    if (valueStr === 'null') return null;

    // Handle numbers
    if (/^-?\d+$/.test(valueStr)) {
        return parseInt(valueStr, 10);
    }
    if (/^-?\d*\.\d+$/.test(valueStr)) {
        return parseFloat(valueStr);
    }

    // Handle dates (basic ISO format)
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(valueStr)) {
        const date = new Date(valueStr);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Return as string if no other type matches
    return valueStr;
}

/**
 * Check if a key typically contains array values
 * @param {string} key - The key name
 * @returns {boolean} True if key is expected to contain arrays
 */
function isArrayKey(key) {
    const arrayKeys = [
        'js_includes', 'css_includes', 'tags', 'categories', 
        'authors', 'keywords', 'images', 'scripts', 'styles',
        'dependencies', 'plugins', 'includes'
    ];
    return arrayKeys.includes(key) || key.endsWith('_list') || key.endsWith('_array');
}

/**
 * Check if a key typically contains block scalar content
 * @param {string} key - The key name
 * @returns {boolean} True if key is expected to contain block scalars
 */
function isBlockScalarKey(key) {
    const blockScalarKeys = [
        'css', 'script', 'description', 'content', 'body', 
        'summary', 'excerpt', 'notes', 'code', 'style'
    ];
    return blockScalarKeys.includes(key) || key.endsWith('_content') || key.endsWith('_text');
}

/**
 * Validate frontmatter data and provide warnings for common issues
 * @param {object} frontMatter - Parsed frontmatter object
 * @returns {object} Validation result with warnings
 */
export function validateFrontmatter(frontMatter) {
    const warnings = [];
    const suggestions = [];

    // Check for common typos
    const commonTypos = {
        'js_include': 'js_includes',
        'css_include': 'css_includes',
        'javascript': 'js_includes',
        'stylesheet': 'css_includes'
    };

    Object.keys(frontMatter).forEach(key => {
        if (commonTypos[key]) {
            warnings.push(`Found '${key}', did you mean '${commonTypos[key]}'?`);
        }
    });

    // Check for empty arrays
    Object.entries(frontMatter).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length === 0) {
            suggestions.push(`Array '${key}' is empty - consider removing it`);
        }
    });

    // Check for missing title
    if (!frontMatter.title) {
        suggestions.push('Consider adding a title field');
    }

    // Check for CSS/JS includes without proper paths
    ['css_includes', 'js_includes'].forEach(key => {
        if (frontMatter[key] && Array.isArray(frontMatter[key])) {
            frontMatter[key].forEach((path, index) => {
                if (!path || typeof path !== 'string') {
                    warnings.push(`Invalid path in ${key}[${index}]: ${path}`);
                }
            });
        }
    });

    return {
        isValid: warnings.length === 0,
        warnings,
        suggestions
    };
}

/**
 * Convert frontmatter object back to YAML string
 * @param {object} frontMatter - Frontmatter object
 * @returns {string} YAML string
 */
export function stringifyFrontmatter(frontMatter) {
    if (!frontMatter || typeof frontMatter !== 'object') {
        return '';
    }

    const lines = ['---'];
    
    Object.entries(frontMatter).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            lines.push(`${key}:`);
            value.forEach(item => {
                lines.push(`  - ${stringifyValue(item)}`);
            });
        } else if (typeof value === 'string' && value.includes('\n')) {
            lines.push(`${key}: |`);
            value.split('\n').forEach(line => {
                lines.push(`  ${line}`);
            });
        } else {
            lines.push(`${key}: ${stringifyValue(value)}`);
        }
    });
    
    lines.push('---');
    return lines.join('\n');
}

/**
 * Convert a JavaScript value to YAML string representation
 * @param {any} value - Value to stringify
 * @returns {string} YAML string representation
 */
function stringifyValue(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
        // Quote strings that contain special characters
        if (/[:\[\]{}|>]/.test(value) || value.includes('\n')) {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        return value;
    }
    return String(value);
} 