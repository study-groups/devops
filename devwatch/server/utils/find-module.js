// find-module.js
const path = require('path');

/**
 * Module Discovery Heuristics:
 * - Parse file path to extract meaningful module segments
 * - Apply ignore patterns to filter out non-semantic parts
 * - Support explicit @pja.meta(MODULE="...") overrides
 * - Use semantic naming conventions to identify true modules
 * - Handle nested module structures intelligently
 */

// Default ignore patterns - these segments are typically not meaningful modules
const DEFAULT_IGNORE_PATTERNS = [
    'index',        // index.js files are usually entry points, not modules
    'js',           // file extensions
    'ts',
    'jsx',
    'tsx',
    'logging',      // utility/infrastructure concerns
    'logger',
    'log',
    'utils',        // generic utility directories
    'util',
    'helpers',
    'helper',
    'lib',
    'libs',
    'common',
    'shared',
    'config',       // configuration files
    'configs',
    'constants',
    'const',
    'types',        // type definitions
    'interfaces',
    'models',       // unless they're domain models
    'schemas',
    'test',         // test-related
    'tests',
    'spec',
    'specs',
    '__tests__',
    'fixtures',
    'mocks',
    'mock'
];

// Semantic module indicators - these suggest meaningful business modules
const SEMANTIC_INDICATORS = [
    'api',
    'routes',
    'controllers',
    'services',
    'handlers',
    'processors',
    'managers',
    'repositories',
    'stores',
    'actions',
    'commands',
    'queries',
    'jobs',
    'tasks',
    'workers',
    'middleware',
    'plugins',
    'components',
    'features',
    'domains',
    'modules'
];

// Enhanced semantic module patterns for infrastructure and entry point files
const INFRASTRUCTURE_MODULE_PATTERNS = [
    {
        pattern: /index\.js$/,
        modules: [
            {
                name: 'ENTRY_POINT',
                confidence: 'high',
                description: 'Primary application entry point'
            },
            {
                name: 'SERVER_INITIALIZATION',
                confidence: 'high',
                description: 'Application bootstrap and configuration'
            }
        ]
    },
    {
        pattern: /server\.js$/,
        modules: [
            {
                name: 'SERVER_CONFIGURATION',
                confidence: 'high',
                description: 'Server setup and configuration'
            },
            {
                name: 'APPLICATION_BOOTSTRAP',
                confidence: 'high',
                description: 'Main application initialization'
            }
        ]
    },
    {
        pattern: /main\.js$/,
        modules: [
            {
                name: 'APPLICATION_ENTRY',
                confidence: 'high',
                description: 'Primary application entry point'
            }
        ]
    }
];

// Contextual module discovery for specific project structures
const PROJECT_SPECIFIC_MODULES = {
    'playwright': {
        patterns: [
            {
                regex: /server\/index\.js$/,
                module: {
                    name: 'PLAYWRIGHT.SERVER_SETUP',
                    confidence: 'high',
                    description: 'Playwright server initialization and configuration'
                }
            }
        ]
    }
};

/**
 * Discovers the most meaningful module name from a file path
 * @param {string} filePath - The file path to analyze
 * @param {object} options - Configuration options
 * @param {string[]} options.ignorePatterns - Additional patterns to ignore
 * @param {string[]} options.semanticIndicators - Additional semantic indicators
 * @param {object} options.explicitMeta - Explicit metadata from @pja.meta comments
 * @returns {object} Module discovery result
 */
function discoverInfrastructureModule(filePath) {
    const fileName = path.basename(filePath);
    
    // Check infrastructure module patterns
    for (const pattern of INFRASTRUCTURE_MODULE_PATTERNS) {
        if (pattern.pattern.test(fileName)) {
            return pattern.modules[0];  // Return first match
        }
    }

    // Check project-specific modules
    const projectName = filePath.split('/')[1] || 'unknown';
    const projectModules = PROJECT_SPECIFIC_MODULES[projectName];
    
    if (projectModules) {
        for (const modulePattern of projectModules.patterns) {
            if (modulePattern.regex.test(filePath)) {
                return modulePattern.module;
            }
        }
    }

    return null;
}

function discoverModule(filePath, options = {}) {
    const {
        ignorePatterns = [],
        semanticIndicators = [],
        explicitMeta = {}
    } = options;

    // If explicit module is provided, use it
    if (explicitMeta.MODULE) {
        return {
            module: explicitMeta.MODULE,
            source: 'explicit @pja.meta',
            confidence: 'high',
            segments: [],
            reasoning: 'Explicitly specified in @pja.meta comment'
        };
    }

    // Check for infrastructure/entry point modules first
    const infrastructureModule = discoverInfrastructureModule(filePath);
    if (infrastructureModule) {
        return {
            module: infrastructureModule.name,
            source: 'infrastructure module pattern',
            confidence: infrastructureModule.confidence,
            details: {
                description: infrastructureModule.description
            }
        };
    }

    // Normalize path and split into segments
    const normalizedPath = filePath.replace(/\\/g, '/');
    const segments = normalizedPath.split('/').filter(Boolean);
    
    // Remove file extension from the last segment
    if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        const withoutExt = lastSegment.replace(/\.[^.]+$/, '');
        segments[segments.length - 1] = withoutExt;
    }

    // Combine default and custom ignore patterns
    const allIgnorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];
    const allSemanticIndicators = [...SEMANTIC_INDICATORS, ...semanticIndicators];

    // Filter out ignored segments
    const filteredSegments = segments.filter(segment => {
        const lowerSegment = segment.toLowerCase();
        return !allIgnorePatterns.some(pattern => 
            lowerSegment === pattern.toLowerCase() || 
            lowerSegment.includes(pattern.toLowerCase())
        );
    });

    // Find semantic segments
    const semanticSegments = filteredSegments.filter(segment => {
        const lowerSegment = segment.toLowerCase();
        return allSemanticIndicators.some(indicator => 
            lowerSegment.includes(indicator.toLowerCase())
        );
    });

    let module, source, confidence, reasoning;

    if (semanticSegments.length > 0) {
        // Use the last semantic segment as it's likely the most specific
        module = semanticSegments[semanticSegments.length - 1];
        source = 'semantic heuristic';
        confidence = 'high';
        reasoning = `Found semantic indicator: ${module}`;
    } else if (filteredSegments.length > 0) {
        // Use the most specific non-ignored segment
        if (filteredSegments.length === 1) {
            module = filteredSegments[0];
            source = 'path heuristic';
            confidence = 'medium';
            reasoning = 'Single meaningful segment after filtering';
        } else {
            // For multiple segments, prefer the last one (most specific)
            // but combine with parent if it adds context
            const lastSegment = filteredSegments[filteredSegments.length - 1];
            const parentSegment = filteredSegments[filteredSegments.length - 2];
            
            if (parentSegment && isContextualParent(parentSegment, lastSegment)) {
                module = `${parentSegment}.${lastSegment}`;
                source = 'contextual heuristic';
                confidence = 'high';
                reasoning = `Combined contextual segments: ${parentSegment} + ${lastSegment}`;
            } else {
                module = lastSegment;
                source = 'path heuristic';
                confidence = 'medium';
                reasoning = 'Most specific segment after filtering';
            }
        }
    } else {
        // Fallback to the original logic
        const pathSegments = segments.slice(1, -1); // Remove first (usually 'server') and last (filename)
        module = pathSegments.length > 0 ? pathSegments.join('.') : segments[segments.length - 1] || 'UNKNOWN';
        source = 'fallback heuristic';
        confidence = 'low';
        reasoning = 'All segments were filtered out, using fallback';
    }

    return {
        module: module.toUpperCase(),
        source,
        confidence,
        segments: filteredSegments,
        reasoning,
        originalSegments: segments,
        filteredCount: segments.length - filteredSegments.length
    };
}

/**
 * Determines if a parent segment provides meaningful context to a child segment
 */
function isContextualParent(parent, child) {
    const contextualPairs = [
        ['api', 'auth'],
        ['api', 'users'],
        ['api', 'orders'],
        ['routes', 'admin'],
        ['routes', 'public'],
        ['services', 'payment'],
        ['services', 'notification'],
        ['handlers', 'webhook'],
        ['handlers', 'event'],
        ['jobs', 'cleanup'],
        ['jobs', 'sync'],
        ['middleware', 'auth'],
        ['middleware', 'validation']
    ];

    const parentLower = parent.toLowerCase();
    const childLower = child.toLowerCase();

    // Check if this is a known contextual pair
    return contextualPairs.some(([p, c]) => 
        parentLower.includes(p) && childLower.includes(c)
    );
}

/**
 * Gets module discovery configuration from environment or defaults
 */
function getModuleConfig() {
    const envIgnorePatterns = process.env.PJA_MODULE_IGNORE_PATTERNS;
    const envSemanticIndicators = process.env.PJA_MODULE_SEMANTIC_INDICATORS;

    return {
        ignorePatterns: envIgnorePatterns ? envIgnorePatterns.split(',').map(s => s.trim()) : [],
        semanticIndicators: envSemanticIndicators ? envSemanticIndicators.split(',').map(s => s.trim()) : []
    };
}

module.exports = {
    discoverModule,
    getModuleConfig,
    DEFAULT_IGNORE_PATTERNS,
    SEMANTIC_INDICATORS
};

/* Example usage:
const { discoverModule } = require('./find-module');

// Basic usage
console.log(discoverModule('server/api/auth/handlers.js'));
// { module: 'AUTH', source: 'semantic heuristic', confidence: 'high', ... }

// With explicit metadata
console.log(discoverModule('server/utils/index.js', {
    explicitMeta: { MODULE: 'CUSTOM_MODULE' }
}));
// { module: 'CUSTOM_MODULE', source: 'explicit @pja.meta', confidence: 'high', ... }

// With custom ignore patterns
console.log(discoverModule('server/features/user-management/service.js', {
    ignorePatterns: ['features'],
    semanticIndicators: ['user-management']
}));
*/
