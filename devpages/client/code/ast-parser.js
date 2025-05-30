/**
 * Uses @babel/parser to parse JavaScript code and extract information about functions and objects.
 */

const MAX_PARSER_WAIT_ATTEMPTS = 5;
const PARSER_WAIT_DELAY_MS = 200;

async function ensureBabelParserIsReady() {
    for (let i = 0; i < MAX_PARSER_WAIT_ATTEMPTS; i++) {
        if (typeof window.Babel !== 'undefined' && typeof window.Babel.transform === 'function') {
            return true;
        }
        console.warn(`[ASTParser] Babel not ready, attempt ${i + 1}. Waiting ${PARSER_WAIT_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, PARSER_WAIT_DELAY_MS));
    }
    console.error('[ASTParser] @babel/standalone (Babel.transform) failed to load after multiple attempts.');
    return false;
}

async function parseJS(code) {
    const parserReady = await ensureBabelParserIsReady();
    if (!parserReady) {
        return null;
    }

    try {
        // @babel/standalone uses Babel.transform with a different API
        // We can access the AST from the transform result
        const result = window.Babel.transform(code, {
            presets: [],  // No transformation, just parsing
            plugins: [],
            parserOpts: {
                sourceType: "module",
                allowImportExportEverywhere: true,
                plugins: [
                    "optionalChaining",
                    "nullishCoalescingOperator",
                    "classProperties",
                    "decorators-legacy"
                ]
            },
            ast: true,  // Include the AST in the result
            code: false // We don't need the transformed code
        });
        
        return result.ast.program; 
    } catch (e) {
        console.error('[ASTParser] Error parsing JavaScript code with @babel/standalone:', e);
        return null;
    }
}

function extractInfoFromAST(ast) {
    const functions = [];
    const objects = [];

    if (!ast || ast.type !== 'Program') {
        console.warn('[ASTParser] Invalid AST provided to extractInfoFromAST.');
        return { functions, objects };
    }

    // Simple visitor function for AST traversal
    function visit(node, parent = null) {
        if (!node || typeof node !== 'object') return;

        // Set parent for context (but don't make it enumerable to avoid circular traversal)
        if (parent) {
            Object.defineProperty(node, 'parent', {
                value: parent,
                writable: false,
                enumerable: false,
                configurable: true
            });
        }

        // Identify functions
        if (node.type === 'FunctionDeclaration') {
            functions.push({
                name: node.id ? node.id.name : 'anonymous',
                type: 'FunctionDeclaration',
                loc: node.loc,
                params: node.params ? node.params.map(p => p.name || p.type).join(', ') : ''
            });
        } else if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
            let name = 'anonymous';
            // Try to infer name if it's assigned to a variable or part of an object property
            if (node.id) {
                name = node.id.name;
            } else if (parent && parent.type === 'VariableDeclarator' && parent.id && parent.id.name) {
                name = parent.id.name;
            } else if (parent && parent.type === 'Property' && parent.key && parent.key.name) {
                name = parent.key.name;
            }
            functions.push({
                name: name,
                type: node.type,
                loc: node.loc,
                params: node.params ? node.params.map(p => p.name || (p.type === 'RestElement' && p.argument ? `...${p.argument.name}` : '?')).join(', ') : ''
            });
        } else if (node.type === 'MethodDefinition') {
            functions.push({
                name: node.key ? node.key.name : 'unknown',
                type: 'MethodDefinition',
                kind: node.kind, // constructor, method, get, set
                loc: node.loc,
                params: node.value && node.value.params ? node.value.params.map(p => p.name || p.type).join(', ') : ''
            });
        }

        // Identify object literals (very basic identification for now)
        if (node.type === 'ObjectExpression') {
            let objectName = 'anonymousObject';
            if (parent && parent.type === 'VariableDeclarator' && parent.id && parent.id.name) {
                objectName = parent.id.name;
            }
            objects.push({
                name: objectName,
                type: 'ObjectLiteral',
                loc: node.loc,
                propertyCount: node.properties ? node.properties.length : 0
            });
        }

        // Traverse children - only traverse known AST node properties to avoid cycles
        const traversableKeys = ['body', 'declarations', 'init', 'left', 'right', 'test', 'consequent', 'alternate', 
                                'callee', 'arguments', 'object', 'property', 'elements', 'properties', 'key', 'value',
                                'params', 'id', 'expression', 'block', 'handler', 'finalizer', 'discriminant', 'cases',
                                'update', 'source', 'specifiers', 'declaration'];

        for (const key of traversableKeys) {
            if (node.hasOwnProperty(key)) {
                const child = node[key];
                if (Array.isArray(child)) {
                    child.forEach(subChild => {
                        if (subChild && typeof subChild === 'object' && subChild.type) {
                            visit(subChild, node);
                        }
                    });
                } else if (child && typeof child === 'object' && child.type) {
                    visit(child, node);
                }
            }
        }
    }

    visit(ast);
    return { functions, objects };
}

// Main function to be exported and used
async function analyzeJavaScript(code) {
    const ast = await parseJS(code);
    if (!ast) {
        return { functions: [], objects: [] };
    }
    return extractInfoFromAST(ast);
}

// Example usage (can be removed or kept for testing):
/*
const sampleCode = `
    function hello(name) {
        console.log("Hello, " + name);
    }

    const add = (a, b) => a + b;

    const myObj = {
        value: 42,
        greet: function() {
            return "Hi";
        }
    };

    class Calculator {
        constructor() {
            this.total = 0;
        }
        sum(val) {
            this.total += val;
            return this.total;
        }
    }
`;

const analysis = analyzeJavaScript(sampleCode);
console.log('[ASTParser] Analysis Results:');
console.log('Functions:', analysis.functions);
console.log('Objects:', analysis.objects);
*/

// Export the main analysis function
// If not using modules, you might attach this to a global object like window.AstTools = { analyzeJavaScript };
window.DevPagesAstParser = {
    analyzeJavaScript: analyzeJavaScript,
    parseJS: parseJS,
    extractInfoFromAST: extractInfoFromAST
}; 