/**
 * AstService.js - Server-side AST parsing using tree-sitter
 * Provides fast, accurate parsing for JavaScript/TypeScript files
 */

import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import crypto from 'crypto';

class AstService {
    constructor() {
        this.parser = new Parser();
        this.parser.setLanguage(JavaScript);
        this.cache = new Map();
        this.maxCacheSize = 100;
    }

    /**
     * Generate content hash for caching
     */
    hashCode(code) {
        return crypto.createHash('sha256').update(code).digest('hex').slice(0, 16);
    }

    /**
     * Parse JavaScript code and return structured AST
     * @param {string} code - Source code
     * @param {string} filePath - File path for context
     * @param {Object} options - Parsing options
     * @returns {Object} Parsed AST with outline
     */
    parse(code, filePath = null, options = {}) {
        const cacheKey = this.hashCode(code);

        // Check cache unless forced
        if (!options.force && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const tree = this.parser.parse(code);

        const result = {
            hash: cacheKey,
            filePath,
            outline: this.extractOutline(tree.rootNode, code),
            dependencies: this.extractDependencies(tree.rootNode, code),
            exports: this.extractExports(tree.rootNode, code),
            errors: tree.rootNode.hasError ? this.findErrors(tree.rootNode) : [],
            nodeCount: this.countNodes(tree.rootNode)
        };

        // Cache with LRU eviction
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, result);

        return result;
    }

    /**
     * Extract code outline (functions, classes, variables)
     */
    extractOutline(node, code) {
        const outline = {
            functions: [],
            classes: [],
            variables: [],
            imports: []
        };

        this.traverse(node, (child) => {
            switch (child.type) {
                case 'function_declaration':
                    outline.functions.push(this.extractFunction(child, code));
                    break;

                case 'class_declaration':
                    outline.classes.push(this.extractClass(child, code));
                    break;

                case 'lexical_declaration':
                case 'variable_declaration':
                    this.extractVariables(child, code).forEach(v => {
                        // Check if it's a function expression
                        if (v.kind === 'arrow_function' || v.kind === 'function') {
                            outline.functions.push(v);
                        } else {
                            outline.variables.push(v);
                        }
                    });
                    break;

                case 'import_statement':
                    outline.imports.push(this.extractImport(child, code));
                    break;

                case 'export_statement':
                    // Handle exported declarations
                    const declaration = child.childForFieldName('declaration');
                    if (declaration) {
                        if (declaration.type === 'function_declaration') {
                            const fn = this.extractFunction(declaration, code);
                            fn.exported = true;
                            outline.functions.push(fn);
                        } else if (declaration.type === 'class_declaration') {
                            const cls = this.extractClass(declaration, code);
                            cls.exported = true;
                            outline.classes.push(cls);
                        }
                    }
                    break;
            }
        });

        return outline;
    }

    /**
     * Extract function details
     */
    extractFunction(node, code) {
        const nameNode = node.childForFieldName('name');
        const paramsNode = node.childForFieldName('parameters');

        return {
            name: nameNode ? this.getText(nameNode, code) : 'anonymous',
            type: 'function',
            kind: node.type,
            params: paramsNode ? this.getText(paramsNode, code) : '()',
            loc: {
                start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            exported: false,
            async: this.hasChild(node, 'async')
        };
    }

    /**
     * Extract class details with methods
     */
    extractClass(node, code) {
        const nameNode = node.childForFieldName('name');
        const bodyNode = node.childForFieldName('body');
        const methods = [];

        if (bodyNode) {
            this.traverse(bodyNode, (child) => {
                if (child.type === 'method_definition') {
                    const methodName = child.childForFieldName('name');
                    const params = child.childForFieldName('parameters');
                    methods.push({
                        name: methodName ? this.getText(methodName, code) : 'unknown',
                        kind: this.getMethodKind(child),
                        params: params ? this.getText(params, code) : '()',
                        loc: {
                            start: { line: child.startPosition.row + 1, column: child.startPosition.column },
                            end: { line: child.endPosition.row + 1, column: child.endPosition.column }
                        }
                    });
                }
            }, false); // Don't recurse into nested classes
        }

        return {
            name: nameNode ? this.getText(nameNode, code) : 'anonymous',
            type: 'class',
            methods,
            loc: {
                start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            },
            exported: false
        };
    }

    /**
     * Extract variables from declarations
     */
    extractVariables(node, code) {
        const variables = [];
        const kind = node.type === 'lexical_declaration' ?
            (this.hasChild(node, 'const') ? 'const' : 'let') : 'var';

        this.traverse(node, (child) => {
            if (child.type === 'variable_declarator') {
                const nameNode = child.childForFieldName('name');
                const valueNode = child.childForFieldName('value');

                let valueKind = 'value';
                if (valueNode) {
                    if (valueNode.type === 'arrow_function') valueKind = 'arrow_function';
                    else if (valueNode.type === 'function') valueKind = 'function';
                    else if (valueNode.type === 'object') valueKind = 'object';
                    else if (valueNode.type === 'array') valueKind = 'array';
                }

                const varInfo = {
                    name: nameNode ? this.getText(nameNode, code) : 'unknown',
                    type: 'variable',
                    declaration: kind,
                    kind: valueKind,
                    loc: {
                        start: { line: child.startPosition.row + 1, column: child.startPosition.column },
                        end: { line: child.endPosition.row + 1, column: child.endPosition.column }
                    }
                };

                // If it's a function, extract params
                if (valueKind === 'arrow_function' || valueKind === 'function') {
                    const params = valueNode.childForFieldName('parameters');
                    varInfo.params = params ? this.getText(params, code) : '()';
                    varInfo.type = 'function';
                }

                variables.push(varInfo);
            }
        }, false);

        return variables;
    }

    /**
     * Extract import statement details
     */
    extractImport(node, code) {
        const sourceNode = node.childForFieldName('source');
        const specifiers = [];

        this.traverse(node, (child) => {
            if (child.type === 'import_specifier') {
                const name = child.childForFieldName('name');
                const alias = child.childForFieldName('alias');
                specifiers.push({
                    type: 'named',
                    imported: name ? this.getText(name, code) : '',
                    local: alias ? this.getText(alias, code) : (name ? this.getText(name, code) : '')
                });
            } else if (child.type === 'namespace_import') {
                const name = child.children.find(c => c.type === 'identifier');
                specifiers.push({
                    type: 'namespace',
                    local: name ? this.getText(name, code) : '*'
                });
            } else if (child.type === 'import_clause') {
                // Default import
                const defaultImport = child.children.find(c => c.type === 'identifier');
                if (defaultImport) {
                    specifiers.push({
                        type: 'default',
                        local: this.getText(defaultImport, code)
                    });
                }
            }
        }, false);

        return {
            source: sourceNode ? this.getText(sourceNode, code).replace(/['"]/g, '') : '',
            specifiers,
            loc: {
                start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                end: { line: node.endPosition.row + 1, column: node.endPosition.column }
            }
        };
    }

    /**
     * Extract dependencies (import sources)
     */
    extractDependencies(node, code) {
        const deps = [];

        this.traverse(node, (child) => {
            if (child.type === 'import_statement') {
                const sourceNode = child.childForFieldName('source');
                if (sourceNode) {
                    const source = this.getText(sourceNode, code).replace(/['"]/g, '');
                    deps.push({
                        source,
                        external: !source.startsWith('.') && !source.startsWith('/'),
                        loc: {
                            line: child.startPosition.row + 1,
                            column: child.startPosition.column
                        }
                    });
                }
            }
        });

        return deps;
    }

    /**
     * Extract exports
     */
    extractExports(node, code) {
        const exports = [];

        this.traverse(node, (child) => {
            if (child.type === 'export_statement') {
                const declaration = child.childForFieldName('declaration');

                if (declaration) {
                    if (declaration.type === 'function_declaration') {
                        const name = declaration.childForFieldName('name');
                        exports.push({
                            type: 'named',
                            name: name ? this.getText(name, code) : 'default',
                            kind: 'function'
                        });
                    } else if (declaration.type === 'class_declaration') {
                        const name = declaration.childForFieldName('name');
                        exports.push({
                            type: 'named',
                            name: name ? this.getText(name, code) : 'default',
                            kind: 'class'
                        });
                    } else if (declaration.type === 'lexical_declaration') {
                        this.traverse(declaration, (d) => {
                            if (d.type === 'variable_declarator') {
                                const name = d.childForFieldName('name');
                                exports.push({
                                    type: 'named',
                                    name: name ? this.getText(name, code) : 'unknown',
                                    kind: 'variable'
                                });
                            }
                        }, false);
                    }
                }

                // Check for default export
                if (this.hasChild(child, 'default')) {
                    exports.push({ type: 'default', name: 'default' });
                }

                // Export specifiers (export { a, b })
                this.traverse(child, (spec) => {
                    if (spec.type === 'export_specifier') {
                        const name = spec.childForFieldName('name');
                        const alias = spec.childForFieldName('alias');
                        exports.push({
                            type: 'named',
                            name: name ? this.getText(name, code) : '',
                            alias: alias ? this.getText(alias, code) : null
                        });
                    }
                }, false);
            }
        });

        return exports;
    }

    /**
     * Find syntax errors in the tree
     */
    findErrors(node) {
        const errors = [];

        this.traverse(node, (child) => {
            if (child.type === 'ERROR' || child.isMissing) {
                errors.push({
                    type: child.isMissing ? 'missing' : 'error',
                    loc: {
                        start: { line: child.startPosition.row + 1, column: child.startPosition.column },
                        end: { line: child.endPosition.row + 1, column: child.endPosition.column }
                    }
                });
            }
        });

        return errors;
    }

    /**
     * Count total nodes in tree (for stats)
     */
    countNodes(node) {
        let count = 1;
        for (let i = 0; i < node.childCount; i++) {
            count += this.countNodes(node.child(i));
        }
        return count;
    }

    /**
     * Traverse AST with callback
     */
    traverse(node, callback, recurse = true) {
        callback(node);
        if (recurse) {
            for (let i = 0; i < node.childCount; i++) {
                this.traverse(node.child(i), callback, recurse);
            }
        } else {
            // Only immediate children
            for (let i = 0; i < node.childCount; i++) {
                callback(node.child(i));
            }
        }
    }

    /**
     * Get text content of a node
     */
    getText(node, code) {
        return code.slice(node.startIndex, node.endIndex);
    }

    /**
     * Check if node has a child of specific type
     */
    hasChild(node, type) {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i).type === type) return true;
        }
        return false;
    }

    /**
     * Get method kind (constructor, get, set, method)
     */
    getMethodKind(node) {
        if (this.hasChild(node, 'get')) return 'getter';
        if (this.hasChild(node, 'set')) return 'setter';
        const name = node.childForFieldName('name');
        if (name && this.getText(name, '') === 'constructor') return 'constructor';
        return 'method';
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize
        };
    }
}

// Singleton instance
export const astService = new AstService();
export default AstService;
