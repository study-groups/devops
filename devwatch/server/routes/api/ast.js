const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../../utils/logging');
const babelParser = require('@babel/parser');
const { default: traverse } = require('@babel/traverse');
const SourceContextManager = require('../../utils/source-context-manager');

const router = express.Router();

// Determine the project root dynamically
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

router.get('/', async (req, res) => {
    const { file, line } = req.query;
    const lineNumber = parseInt(line, 10);

    if (!file || !lineNumber) {
        return res.status(400).json({ success: false, error: 'File path and line number are required' });
    }

    // Extensive logging for debugging
    logger.info('AST Request Received', { 
        originalFile: file, 
        line: lineNumber,
        projectRoot: PROJECT_ROOT 
    });

    // Multiple path resolution attempts
    const pathAttempts = [
        path.resolve(PROJECT_ROOT, file),  // Direct resolution
        path.resolve(PROJECT_ROOT, 'server', file),  // Prepend server/
        path.resolve(PROJECT_ROOT, file.replace(/^server\//, '')),  // Remove server/ prefix
        path.resolve(PROJECT_ROOT, 'server', file.replace(/^server\//, ''))  // Combine both
    ];

    let requestedPath = null;
    for (const attempt of pathAttempts) {
        try {
            await fs.access(attempt);
            requestedPath = attempt;
            break;
        } catch (err) {
            logger.info(`Path attempt failed: ${attempt}`, { error: err.message });
        }
    }

    if (!requestedPath) {
        // Log all attempted paths for debugging
        logger.error('File not found in any attempted paths', { 
            attempts: pathAttempts,
            originalFile: file 
        });

        return res.status(404).json({ 
            success: false, 
            error: 'File not found',
            details: {
                originalFile: file,
                attemptedPaths: pathAttempts
            }
        });
    }

    try {
        const content = await fs.readFile(requestedPath, 'utf8');
        const ast = babelParser.parse(content, {
            sourceType: 'module',
            plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
            errorRecovery: true,
            attachComment: true // Ensure comments are attached to nodes
        });

        let smallestNode = null;
        let lastTraversedNode = null;
        let explicitMeta = {};
        const findingProcess = [];
        const chainOfThought = [];

        const parseMetaComment = (comment) => {
            const metaRegex = /@pja\.meta\((.*?)\)/;
            const match = comment.match(metaRegex);
            if (!match) return null;

            const meta = {};
            const pairsRegex = /(\w+)\s*=\s*"([^"]*)"/g;
            let pairMatch;
            while ((pairMatch = pairsRegex.exec(match[1])) !== null) {
                meta[pairMatch[1].toUpperCase()] = pairMatch[2];
            }
            return meta;
        };

        // Use the sophisticated context discovery
        let sourceContext = null;
        try {
            sourceContext = await SourceContextManager.discoverContext(requestedPath, lineNumber, {
                explicitMeta: explicitMeta
            });
        } catch (err) {
            logger.warn('Source context discovery failed', { 
                error: err.message, 
                file: requestedPath, 
                line: lineNumber 
            });
        }

        // Existing AST traversal logic remains the same
        traverse(ast, {
            enter(path) {
                const node = path.node;
                if (node.loc && node.loc.start.line <= lineNumber && node.loc.end.line >= lineNumber) {
                    lastTraversedNode = node; // Keep track of the last matching node

                    // Check for @pja.meta comments on this node or its parents
                    if (node.leadingComments) {
                        for (const comment of node.leadingComments) {
                            const parsed = parseMetaComment(comment.value);
                            if (parsed) {
                                explicitMeta = { ...explicitMeta, ...parsed };
                            }
                        }
                    }

                    // Capture traversal path
                    const nodeInfo = {
                        type: node.type,
                        start: node.loc.start.line,
                        end: node.loc.end.line,
                    };
                    findingProcess.push(nodeInfo);

                    // Generate Chain of Thought (CoT) for reasoning
                    const reasoning = `Exploring ${node.type} node from line ${node.loc.start.line} to ${node.loc.end.line}`;
                    chainOfThought.push(reasoning);

                    const isFunctionNode = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassMethod', 'ObjectMethod'].includes(node.type);
                    
                    if (isFunctionNode) {
                        if (!smallestNode || 
                            ((node.loc.end.line - node.loc.start.line) < (smallestNode.loc.end.line - smallestNode.loc.start.line))) 
                        {
                            smallestNode = node;
                        }
                    }
                }
            }
        });

        const targetNode = smallestNode || lastTraversedNode;

        if (targetNode) {
            res.json({
                success: true,
                astObject: targetNode,
                findingProcess: findingProcess,
                chainOfThought: chainOfThought,
                explicitMeta: explicitMeta,
                sourceContext: sourceContext,
                fileDetails: {
                    resolvedPath: requestedPath,
                    originalFile: file
                }
            });
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'No AST node found at the specified line',
                details: {
                    file: requestedPath,
                    line: lineNumber
                }
            });
        }

    } catch (error) {
        logger.error('AST Parsing Error', { 
            file: requestedPath, 
            error: error.message, 
            stack: error.stack 
        });

        res.status(500).json({ 
            success: false, 
            error: 'Failed to parse file for AST',
            details: {
                file: requestedPath,
                originalFile: file,
                errorMessage: error.message
            }
        });
    }
});

module.exports = router;
