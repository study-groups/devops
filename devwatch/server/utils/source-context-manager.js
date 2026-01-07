// source-context-manager.js
const path = require('path');
const { discoverModule, getModuleConfig } = require('./find-module');
const { findEnclosingAction } = require('./find-action');

class SourceContextManager {
    /**
     * Discover context for a specific source location
     * @param {string} filePath - Full path to the source file
     * @param {number} lineNumber - Specific line number of interest
     * @param {object} options - Additional discovery options
     */
    static async discoverContext(filePath, lineNumber, options = {}) {
        const {
            explicitMeta = {},
            moduleConfig = getModuleConfig(),
            includeAst = true
        } = options;

        const context = {
            filePath,
            lineNumber,
            explicitMeta,
            timestamp: new Date().toISOString()
        };

        try {
            // Discover TYPE from file path
            context.type = this._discoverType(filePath, explicitMeta);

            // Discover MODULE
            context.module = this._discoverModule(filePath, {
                ...moduleConfig,
                explicitMeta
            });

            // Discover ACTION
            context.action = await this._discoverAction(filePath, lineNumber, explicitMeta);

            // Optional AST details
            if (includeAst) {
                context.astDetails = await this._getAstDetails(filePath, lineNumber);
            }

            return context;
        } catch (error) {
            return {
                ...context,
                error: {
                    message: error.message,
                    stack: error.stack
                }
            };
        }
    }

    /**
     * Discover TYPE from file path
     * @private
     */
    static _discoverType(filePath, explicitMeta = {}) {
        // If explicit TYPE is provided, use it
        if (explicitMeta.TYPE) {
            return {
                value: explicitMeta.TYPE,
                source: 'explicit @pja.meta',
                confidence: 'high'
            };
        }

        const segments = filePath.split(/[/\\]/).filter(Boolean);
        
        // Special handling for known entry point files
        const entryPointMap = {
            'index.js': 'ENTRY_POINT',
            'server.js': 'SERVER',
            'main.js': 'MAIN',
            'app.js': 'APPLICATION',
            'index.ts': 'ENTRY_POINT',
            'server.ts': 'SERVER',
            'main.ts': 'MAIN',
            'app.ts': 'APPLICATION'
        };

        const fileName = segments[segments.length - 1];
        if (entryPointMap[fileName]) {
            return {
                value: entryPointMap[fileName],
                source: 'entry point heuristic',
                confidence: 'high',
                details: {
                    fileName: fileName,
                    path: filePath
                }
            };
        }

        // Semantic directory-based type discovery
        const semanticTypeMap = {
            'api': 'API',
            'routes': 'ROUTES',
            'controllers': 'CONTROLLER',
            'services': 'SERVICE',
            'middleware': 'MIDDLEWARE',
            'utils': 'UTILITY',
            'helpers': 'HELPER',
            'jobs': 'JOB',
            'tasks': 'TASK',
            'workers': 'WORKER',
            'config': 'CONFIG',
            'models': 'MODEL',
            'schemas': 'SCHEMA'
        };

        // Look for semantic types in directory structure
        for (const segment of segments) {
            const semanticType = semanticTypeMap[segment.toLowerCase()];
            if (semanticType) {
                return {
                    value: semanticType,
                    source: 'directory semantic heuristic',
                    confidence: 'medium',
                    details: {
                        matchedSegment: segment
                    }
                };
            }
        }

        // Fallback to root directory or last meaningful segment
        const rootType = segments[1]?.toUpperCase() || 'UNKNOWN';
        
        return {
            value: rootType,
            source: 'fallback path heuristic',
            confidence: rootType === 'UNKNOWN' ? 'low' : 'medium',
            segments: segments
        };
    }

    /**
     * Discover MODULE using find-module utility
     * @private
     */
    static _discoverModule(filePath, moduleOptions = {}) {
        const moduleAnalysis = discoverModule(filePath, moduleOptions);

        return {
            value: moduleAnalysis.module,
            source: moduleAnalysis.source,
            confidence: moduleAnalysis.confidence,
            reasoning: moduleAnalysis.reasoning,
            segments: moduleAnalysis.segments,
            filteredCount: moduleAnalysis.filteredCount
        };
    }

    /**
     * Discover ACTION using find-action utility
     * @private
     */
    static async _discoverAction(filePath, lineNumber, explicitMeta = {}) {
        if (explicitMeta.ACTION) {
            return {
                value: explicitMeta.ACTION,
                source: 'explicit @pja.meta',
                confidence: 'high'
            };
        }

        try {
            const actionAnalysis = await findEnclosingAction(filePath, lineNumber);

            if (!actionAnalysis) {
                return {
                    value: '<anonymous>',
                    source: 'no action found',
                    confidence: 'low'
                };
            }

            // Enhanced action identification with library context
            const actionDetails = {
                value: actionAnalysis.actionName,
                source: actionAnalysis.metaAction ? 'explicit @pja.meta(TYPE="ACTION")' : 'sophisticated heuristic',
                confidence: actionAnalysis.metaAction ? 'high' : 'medium',
                details: {
                    kind: actionAnalysis.kind,
                    startLine: actionAnalysis.startLine,
                    endLine: actionAnalysis.endLine
                }
            };

            // Add library context if available
            if (actionAnalysis.libraryContext) {
                actionDetails.libraryContext = {
                    type: actionAnalysis.libraryContext.type,
                    library: actionAnalysis.libraryContext.library,
                    confidence: actionAnalysis.libraryContext.confidence
                };

                // Adjust confidence and source based on library context
                if (actionAnalysis.libraryContext.type === 'LIBRARY_SETUP') {
                    actionDetails.source = 'library initialization context';
                    actionDetails.confidence = 'high';
                    actionDetails.value = `${actionAnalysis.libraryContext.library.toUpperCase()}_SETUP`;
                }
            }

            return actionDetails;
        } catch (error) {
            return {
                value: 'ERROR',
                source: 'action discovery failed',
                confidence: 'low',
                error: error.message
            };
        }
    }

    /**
     * Get detailed AST information
     * @private
     */
    static async _getAstDetails(filePath, lineNumber) {
        // This would typically involve parsing the AST and extracting detailed information
        // For now, we'll just return a placeholder
        return {
            lineNumber,
            nodeType: 'unknown',
            complexity: 'unanalyzed'
        };
    }

    /**
     * Generate a human-readable Chain of Thought narrative
     */
    static generateChainOfThought(context) {
        const { type, module, action } = context;

        return {
            narrative: [
                `Analyzing source context for ${context.filePath}:${context.lineNumber}`,
                `TYPE discovered: ${type.value} (${type.source}, confidence: ${type.confidence})`,
                `MODULE identified: ${module.value} (${module.source}, confidence: ${module.confidence})`,
                `ACTION determined: ${action.value} (${action.source}, confidence: ${action.confidence})`
            ],
            details: {
                type,
                module,
                action
            }
        };
    }
}

module.exports = SourceContextManager;

// Example usage
async function exampleUsage() {
    const context = await SourceContextManager.discoverContext(
        'server/api/users/handlers.js', 
        42, 
        { explicitMeta: { TYPE: 'API', MODULE: 'USER_MANAGEMENT' } }
    );
    
    const chainOfThought = SourceContextManager.generateChainOfThought(context);
    console.log(chainOfThought);
}
