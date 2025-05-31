/**
 * CodeManager - Advanced code analysis and AST management for DevPages
 * Handles tree-sitter parsing, dependency graphs, and function extraction
 */

class CodeManager {
    constructor() {
        this.parsers = new Map();
        this.asts = new Map();
        this.dependencies = new Map();
        this.functions = new Map();
        this.devpagesConfig = null;
        this.projectStructure = null;
        this.init();
    }

    async init() {
        console.log('[CodeManager] Initializing...');
        
        // Initialize tree-sitter parsers (would need actual tree-sitter WASM modules)
        await this.initializeParsers();
        
        // Load project configuration
        await this.loadDevPagesConfig();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('[CodeManager] Initialized successfully');
    }

    async initializeParsers() {
        // In a real implementation, these would load tree-sitter WASM modules
        // For now, we'll create mock parsers that simulate the interface
        
        this.parsers.set('javascript', {
            language: 'javascript',
            extensions: ['.js', '.mjs', '.jsx'],
            parse: this.mockJavaScriptParser.bind(this)
        });
        
        this.parsers.set('html', {
            language: 'html',
            extensions: ['.html', '.htm'],
            parse: this.mockHTMLParser.bind(this)
        });
        
        this.parsers.set('css', {
            language: 'css',
            extensions: ['.css'],
            parse: this.mockCSSParser.bind(this)
        });
        
        this.parsers.set('bash', {
            language: 'bash',
            extensions: ['.sh', '.bash'],
            parse: this.mockBashParser.bind(this)
        });
    }

    async loadDevPagesConfig() {
        try {
            const response = await fetch('/api/files/content?pathname=devpages.json');
            if (!response.ok) {
                // Throw error for non-2xx status codes (including 404)
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
                this.devpagesConfig = await response.json();
                console.log('[CodeManager] Loaded devpages.json:', this.devpagesConfig);
                await this.analyzeProjectStructure();
        } catch (error) {
            // This will now catch 404s too
            console.warn('[CodeManager] No devpages.json found, using defaults:', error.message);
        }
    }

    async analyzeProjectStructure() {
        if (!this.devpagesConfig) return;
        
        const structure = this.devpagesConfig.structure || {};
        this.projectStructure = {
            entry: structure.entry || 'index.html',
            client: structure.client || { directory: 'client', entry: 'client.js' },
            host: structure.host || { directory: 'host', entry: 'host.js' },
            server: structure.server || { directory: 'server', entry: 'server.js' },
            common: structure.common || { directory: 'common', files: [] }
        };
        
        console.log('[CodeManager] Project structure:', this.projectStructure);
    }

    setupEventListeners() {
        if (window.eventBus) {
            window.eventBus.on('file:analyze', this.handleFileAnalysis.bind(this));
            window.eventBus.on('file:open', this.handleFileOpen.bind(this));
        }
    }

    async handleFileAnalysis(event) {
        const { filename, language } = event;
        console.log('[CodeManager] Analyzing file:', filename, 'language:', language);
        
        try {
            const ast = await this.parseFile(filename, language);
            if (ast) {
                await this.extractFunctions(filename, ast);
                await this.analyzeDependencies(filename, ast);
                this.emitAnalysisComplete(filename, ast);
            }
        } catch (error) {
            console.error('[CodeManager] Analysis failed:', error);
        }
    }

    async handleFileOpen(event) {
        const { filename } = event;
        // Automatically analyze opened files if they're parseable
        const parser = this.getParserForFile(filename);
        if (parser) {
            await this.handleFileAnalysis({ filename, language: parser.language });
        }
    }

    async parseFile(filename, language) {
        try {
            // Fetch file content
            const response = await fetch(`/api/files/content?pathname=${encodeURIComponent(filename)}`);
            if (!response.ok) {
                throw new Error(`Failed to read file: ${response.status}`);
            }
            
            const content = await response.text();
            const parser = this.parsers.get(language);
            
            if (!parser) {
                console.warn('[CodeManager] No parser for language:', language);
                return null;
            }
            
            // Parse the content
            const ast = await parser.parse(content, filename);
            this.asts.set(filename, ast);
            
            console.log('[CodeManager] Parsed file:', filename, 'AST nodes:', ast.nodes?.length || 0);
            return ast;
            
        } catch (error) {
            console.error('[CodeManager] Parse error:', error);
            return null;
        }
    }

    getParserForFile(filename) {
        const ext = '.' + filename.split('.').pop().toLowerCase();
        for (const parser of this.parsers.values()) {
            if (parser.extensions.includes(ext)) {
                return parser;
            }
        }
        return null;
    }

    async extractFunctions(filename, ast) {
        const functions = [];
        
        // Extract function definitions from AST
        if (ast.nodes) {
            for (const node of ast.nodes) {
                if (node.type === 'function_declaration' || 
                    node.type === 'method_definition' ||
                    node.type === 'arrow_function') {
                    
                    functions.push({
                        name: node.name || 'anonymous',
                        type: node.type,
                        startLine: node.startLine,
                        endLine: node.endLine,
                        parameters: node.parameters || [],
                        isAsync: node.isAsync || false,
                        isExported: node.isExported || false,
                        scope: node.scope || 'local'
                    });
                }
            }
        }
        
        this.functions.set(filename, functions);
        console.log('[CodeManager] Extracted functions from', filename, ':', functions.length);
        return functions;
    }

    async analyzeDependencies(filename, ast) {
        const deps = {
            imports: [],
            exports: [],
            requires: [],
            eventBusUsage: []
        };
        
        if (ast.nodes) {
            for (const node of ast.nodes) {
                // ES6 imports
                if (node.type === 'import_statement') {
                    deps.imports.push({
                        source: node.source,
                        specifiers: node.specifiers || [],
                        line: node.startLine
                    });
                }
                
                // CommonJS requires
                if (node.type === 'call_expression' && node.callee === 'require') {
                    deps.requires.push({
                        source: node.arguments[0],
                        line: node.startLine
                    });
                }
                
                // Exports
                if (node.type === 'export_statement') {
                    deps.exports.push({
                        name: node.name,
                        type: node.exportType,
                        line: node.startLine
                    });
                }
                
                // Event bus usage
                if (node.type === 'call_expression' && 
                    (node.callee?.includes('eventBus') || node.callee?.includes('emit'))) {
                    deps.eventBusUsage.push({
                        method: node.callee,
                        event: node.arguments[0],
                        line: node.startLine
                    });
                }
            }
        }
        
        this.dependencies.set(filename, deps);
        console.log('[CodeManager] Analyzed dependencies for', filename, ':', deps);
        return deps;
    }

    emitAnalysisComplete(filename, ast) {
        if (window.eventBus) {
            window.eventBus.emit('code:analysis-complete', {
                filename,
                ast,
                functions: this.functions.get(filename) || [],
                dependencies: this.dependencies.get(filename) || {},
                timestamp: Date.now()
            });
        }
    }

    // Mock parsers (in real implementation, these would use tree-sitter)
    async mockJavaScriptParser(content, filename) {
        // Simplified JavaScript parsing simulation
        const lines = content.split('\n');
        const nodes = [];
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            // Function declarations
            if (trimmed.match(/^(function|const|let|var)\s+\w+\s*[=\(]/)) {
                const match = trimmed.match(/^(?:function|const|let|var)\s+(\w+)/);
                if (match) {
                    nodes.push({
                        type: 'function_declaration',
                        name: match[1],
                        startLine: index + 1,
                        endLine: index + 1, // Simplified
                        isExported: trimmed.includes('export')
                    });
                }
            }
            
            // Imports
            if (trimmed.startsWith('import')) {
                const match = trimmed.match(/from\s+['"]([^'"]+)['"]/);
                if (match) {
                    nodes.push({
                        type: 'import_statement',
                        source: match[1],
                        startLine: index + 1
                    });
                }
            }
            
            // Event bus calls
            if (trimmed.includes('eventBus.emit') || trimmed.includes('eventBus.on')) {
                nodes.push({
                    type: 'call_expression',
                    callee: 'eventBus.emit',
                    startLine: index + 1
                });
            }
        });
        
        return { nodes, language: 'javascript', filename };
    }

    async mockHTMLParser(content, filename) {
        const nodes = [];
        const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
        
        scriptMatches.forEach((script, index) => {
            nodes.push({
                type: 'script_element',
                content: script,
                startLine: index + 1
            });
        });
        
        return { nodes, language: 'html', filename };
    }

    async mockCSSParser(content, filename) {
        const nodes = [];
        const ruleMatches = content.match(/[^{}]+\{[^{}]*\}/g) || [];
        
        ruleMatches.forEach((rule, index) => {
            const selector = rule.split('{')[0].trim();
            nodes.push({
                type: 'rule',
                selector,
                startLine: index + 1
            });
        });
        
        return { nodes, language: 'css', filename };
    }

    async mockBashParser(content, filename) {
        const lines = content.split('\n');
        const nodes = [];
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('function ') || trimmed.match(/^\w+\(\)/)) {
                const match = trimmed.match(/^(?:function\s+)?(\w+)/);
                if (match) {
                    nodes.push({
                        type: 'function_declaration',
                        name: match[1],
                        startLine: index + 1
                    });
                }
            }
        });
        
        return { nodes, language: 'bash', filename };
    }

    // Public API methods
    getAST(filename) {
        return this.asts.get(filename);
    }

    getFunctions(filename) {
        return this.functions.get(filename) || [];
    }

    getDependencies(filename) {
        return this.dependencies.get(filename) || {};
    }

    getAllFunctions() {
        const allFunctions = [];
        for (const [filename, functions] of this.functions.entries()) {
            functions.forEach(func => {
                allFunctions.push({ ...func, filename });
            });
        }
        return allFunctions;
    }

    getDependencyGraph() {
        const graph = { nodes: [], edges: [] };
        
        // Add file nodes
        for (const filename of this.dependencies.keys()) {
            graph.nodes.push({ id: filename, type: 'file' });
        }
        
        // Add dependency edges
        for (const [filename, deps] of this.dependencies.entries()) {
            deps.imports.forEach(imp => {
                graph.edges.push({
                    from: filename,
                    to: imp.source,
                    type: 'import'
                });
            });
        }
        
        return graph;
    }

    getProjectSummary() {
        return {
            config: this.devpagesConfig,
            structure: this.projectStructure,
            totalFiles: this.asts.size,
            totalFunctions: this.getAllFunctions().length,
            parsedLanguages: Array.from(this.parsers.keys())
        };
    }
}

// Initialize and export
window.CodeManager = CodeManager; 