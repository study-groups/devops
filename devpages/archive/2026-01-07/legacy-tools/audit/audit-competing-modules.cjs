#!/usr/bin/env node

/**
 * Competing Modules Audit Script
 * Identifies potential conflicts between multiple implementations of similar functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CompetingModulesAuditor {
    constructor(rootDir = process.cwd()) {
        this.results = {
            duplicateClasses: [],
            competingManagers: [],
            multipleInitializers: [],
            conflictingGlobalExports: [],
            duplicateEventHandlers: [],
            overlappingFunctionality: []
        };
        this.rootDir = path.resolve(rootDir);
    }

    async audit() {
        console.log('🔍 Starting Competing Modules Audit...\n');
        
        await this.findDuplicateClasses();
        await this.findCompetingManagers();
        await this.findMultipleInitializers();
        await this.findConflictingGlobalExports();
        await this.findDuplicateEventHandlers();
        await this.findOverlappingFunctionality();
        
        this.generateReport();
    }

    async findDuplicateClasses() {
        console.log('📋 Checking for duplicate class names...');
        
        const classPattern = /class\s+(\w+)/g;
        const classes = new Map();
        
        this.walkDirectory('.', (filePath, content) => {
            if (!filePath.endsWith('.js')) return;
            
            let match;
            while ((match = classPattern.exec(content)) !== null) {
                const className = match[1];
                if (!classes.has(className)) {
                    classes.set(className, []);
                }
                classes.get(className).push(filePath);
            }
        });
        
        // Find duplicates
        for (const [className, files] of classes.entries()) {
            if (files.length > 1) {
                this.results.duplicateClasses.push({
                    className,
                    files,
                    severity: this.assessSeverity(files, className)
                });
            }
        }
        
        console.log(`   Found ${this.results.duplicateClasses.length} duplicate class names\n`);
    }

    async findCompetingManagers() {
        console.log('🏗️ Checking for competing manager classes...');
        
        const managerPatterns = [
            /class\s+(\w*Manager\w*)/g,
            /class\s+(\w*Controller\w*)/g,
            /class\s+(\w*Handler\w*)/g,
            /class\s+(\w*Service\w*)/g
        ];
        
        const managers = new Map();
        
        this.walkDirectory('.', (filePath, content) => {
            if (!filePath.endsWith('.js')) return;
            
            managerPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const managerName = match[1];
                    const baseName = this.extractBaseName(managerName);
                    
                    if (!managers.has(baseName)) {
                        managers.set(baseName, []);
                    }
                    managers.get(baseName).push({
                        className: managerName,
                        file: filePath,
                        type: this.getManagerType(managerName)
                    });
                }
            });
        });
        
        // Find competing managers
        for (const [baseName, implementations] of managers.entries()) {
            if (implementations.length > 1) {
                this.results.competingManagers.push({
                    baseName,
                    implementations,
                    severity: this.assessManagerSeverity(implementations)
                });
            }
        }
        
        console.log(`   Found ${this.results.competingManagers.length} competing manager patterns\n`);
    }

    async findMultipleInitializers() {
        console.log('🚀 Checking for multiple initializers...');
        
        const initPatterns = [
            /function\s+initialize\w*/g,
            /initialize\s*[:=]\s*function/g,
            /\.initialize\s*\(/g,
            /new\s+\w+\(\)/g
        ];
        
        const initializers = new Map();
        
        this.walkDirectory('.', (filePath, content) => {
            if (!filePath.endsWith('.js')) return;
            
            // Look for initialization patterns
            if (content.includes('initialize') || content.includes('init')) {
                const domain = this.extractDomain(filePath);
                if (!initializers.has(domain)) {
                    initializers.set(domain, []);
                }
                initializers.get(domain).push({
                    file: filePath,
                    patterns: this.findInitPatterns(content)
                });
            }
        });
        
        // Find domains with multiple initializers
        for (const [domain, files] of initializers.entries()) {
            if (files.length > 1) {
                this.results.multipleInitializers.push({
                    domain,
                    files,
                    severity: 'medium'
                });
            }
        }
        
        console.log(`   Found ${this.results.multipleInitializers.length} domains with multiple initializers\n`);
    }

    async findConflictingGlobalExports() {
        console.log('🌐 Checking for conflicting global exports...');
        
        const globalExports = new Map();
        
        this.walkDirectory('.', (filePath, content) => {
            if (!filePath.endsWith('.js')) return;
            
            // Find window assignments
            const windowPattern = /window\.(\w+)\s*=/g;
            let match;
            while ((match = windowPattern.exec(content)) !== null) {
                const globalName = match[1];
                if (!globalExports.has(globalName)) {
                    globalExports.set(globalName, []);
                }
                globalExports.get(globalName).push(filePath);
            }
            
            // Find global variable assignments
            const globalPattern = /(?:^|\n)\s*(\w+)\s*=\s*(?:new\s+\w+|{|\[)/gm;
            while ((match = globalPattern.exec(content)) !== null) {
                const varName = match[1];
                if (this.isLikelyGlobal(varName, content)) {
                    if (!globalExports.has(varName)) {
                        globalExports.set(varName, []);
                    }
                    globalExports.get(varName).push(filePath);
                }
            }
        });
        
        // Find conflicts
        for (const [globalName, files] of globalExports.entries()) {
            if (files.length > 1) {
                this.results.conflictingGlobalExports.push({
                    globalName,
                    files,
                    severity: this.assessGlobalSeverity(globalName, files)
                });
            }
        }
        
        console.log(`   Found ${this.results.conflictingGlobalExports.length} conflicting global exports\n`);
    }

    async findDuplicateEventHandlers() {
        console.log('⚡ Checking for duplicate event handlers...');
        
        const eventHandlers = new Map();
        
        this.walkDirectory('.', (filePath, content) => {
            if (!filePath.endsWith('.js')) return;
            
            // Find event listeners
            const eventPattern = /addEventListener\s*\(\s*['"`](\w+)['"`]/g;
            let match;
            while ((match = eventPattern.exec(content)) !== null) {
                const eventType = match[1];
                if (!eventHandlers.has(eventType)) {
                    eventHandlers.set(eventType, []);
                }
                eventHandlers.get(eventType).push(filePath);
            }
        });
        
        // Find potential conflicts (same event type in multiple files)
        for (const [eventType, files] of eventHandlers.entries()) {
            if (files.length > 3) { // More than 3 files handling same event
                this.results.duplicateEventHandlers.push({
                    eventType,
                    files,
                    count: files.length,
                    severity: files.length > 5 ? 'high' : 'medium'
                });
            }
        }
        
        console.log(`   Found ${this.results.duplicateEventHandlers.length} potentially conflicting event handlers\n`);
    }

    async findOverlappingFunctionality() {
        console.log('🔄 Checking for overlapping functionality...');
        
        const functionalityMap = {
            'debug': ['debug', 'Debug', 'debugger', 'console'],
            'panel': ['panel', 'Panel', 'dock', 'Dock'],
            'modal': ['modal', 'Modal', 'dialog', 'Dialog'],
            'storage': ['storage', 'Storage', 'persist', 'save', 'load'],
            'auth': ['auth', 'Auth', 'login', 'session', 'user'],
            'ui': ['ui', 'UI', 'interface', 'component'],
            'keyboard': ['keyboard', 'shortcut', 'hotkey', 'key'],
            'drag': ['drag', 'drop', 'draggable', 'sortable']
        };
        
        const functionalityFiles = new Map();
        
        this.walkDirectory('.', (filePath, content) => {
            if (!filePath.endsWith('.js')) return;
            
            for (const [category, keywords] of Object.entries(functionalityMap)) {
                const score = keywords.reduce((sum, keyword) => {
                    const regex = new RegExp(keyword, 'gi');
                    const matches = content.match(regex);
                    return sum + (matches ? matches.length : 0);
                }, 0);
                
                if (score > 5) { // Threshold for significant functionality
                    if (!functionalityFiles.has(category)) {
                        functionalityFiles.set(category, []);
                    }
                    functionalityFiles.get(category).push({
                        file: filePath,
                        score
                    });
                }
            }
        });
        
        // Find overlapping functionality
        for (const [category, files] of functionalityFiles.entries()) {
            if (files.length > 2) {
                this.results.overlappingFunctionality.push({
                    category,
                    files: files.sort((a, b) => b.score - a.score),
                    severity: files.length > 4 ? 'high' : 'medium'
                });
            }
        }
        
        console.log(`   Found ${this.results.overlappingFunctionality.length} areas with overlapping functionality\n`);
    }

    // Helper methods
    walkDirectory(dir, callback) {
        const fullPath = path.join(this.rootDir, dir);
        if (!fs.existsSync(fullPath)) return;
        
        const items = fs.readdirSync(fullPath);
        
        for (const item of items) {
            const itemPath = path.join(fullPath, item);
            const relativePath = path.relative(this.rootDir, itemPath);
            
            // Skip node_modules, .git, etc.
            if (this.shouldSkip(relativePath)) continue;
            
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                this.walkDirectory(relativePath, callback);
            } else if (stat.isFile()) {
                try {
                    const content = fs.readFileSync(itemPath, 'utf8');
                    callback(relativePath, content);
                } catch (error) {
                    // Skip files that can't be read
                }
            }
        }
    }

    shouldSkip(path) {
        const skipPatterns = [
            'node_modules',
            '.git',
            '.vscode',
            'dist',
            'build',
            '.DS_Store',
            'package-lock.json',
            'backup',  // Add this line to skip entire backup directory
            'backup/modules'  // Explicitly skip backup/modules
        ];
        
        return skipPatterns.some(pattern => path.includes(pattern));
    }

    extractBaseName(managerName) {
        return managerName
            .replace(/Manager$/, '')
            .replace(/Controller$/, '')
            .replace(/Handler$/, '')
            .replace(/Service$/, '')
            .toLowerCase();
    }

    getManagerType(managerName) {
        if (managerName.includes('Manager')) return 'Manager';
        if (managerName.includes('Controller')) return 'Controller';
        if (managerName.includes('Handler')) return 'Handler';
        if (managerName.includes('Service')) return 'Service';
        return 'Unknown';
    }

    extractDomain(filePath) {
        const parts = filePath.split('/');
        if (parts.includes('debug')) return 'debug';
        if (parts.includes('panel')) return 'panel';
        if (parts.includes('auth')) return 'auth';
        if (parts.includes('ui')) return 'ui';
        return parts[parts.length - 2] || 'root';
    }

    findInitPatterns(content) {
        const patterns = [];
        if (content.includes('initialize(')) patterns.push('initialize()');
        if (content.includes('init(')) patterns.push('init()');
        if (content.includes('new ')) patterns.push('constructor');
        return patterns;
    }

    isLikelyGlobal(varName, content) {
        // Check if variable is likely to be global based on context
        return varName.length > 3 && 
               !varName.startsWith('_') && 
               content.includes(`window.${varName}`) ||
               content.includes(`global.${varName}`);
    }

    assessSeverity(files, className) {
        if (className.includes('Manager') || className.includes('Controller')) return 'high';
        if (files.length > 3) return 'high';
        if (files.length > 2) return 'medium';
        return 'low';
    }

    assessManagerSeverity(implementations) {
        if (implementations.length > 3) return 'high';
        if (implementations.some(impl => impl.type === 'Manager')) return 'high';
        return 'medium';
    }

    assessGlobalSeverity(globalName, files) {
        const criticalGlobals = ['debugDock', 'debugPanel', 'panelManager', 'authManager'];
        if (criticalGlobals.some(name => globalName.toLowerCase().includes(name.toLowerCase()))) {
            return 'critical';
        }
        if (files.length > 2) return 'high';
        return 'medium';
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPETING MODULES AUDIT REPORT');
        console.log('='.repeat(80));
        
        this.reportSection('🔄 Duplicate Classes', this.results.duplicateClasses);
        this.reportSection('🏗️ Competing Managers', this.results.competingManagers);
        this.reportSection('🚀 Multiple Initializers', this.results.multipleInitializers);
        this.reportSection('🌐 Conflicting Global Exports', this.results.conflictingGlobalExports);
        this.reportSection('⚡ Duplicate Event Handlers', this.results.duplicateEventHandlers);
        this.reportSection('🔄 Overlapping Functionality', this.results.overlappingFunctionality);
        
        this.generateSummary();
        this.generateRecommendations();
        
        // Write detailed report to file
        this.writeDetailedReport();
    }

    reportSection(title, items) {
        console.log(`\n${title}`);
        console.log('-'.repeat(50));
        
        if (items.length === 0) {
            console.log('✅ No issues found');
            return;
        }
        
        items.forEach((item, index) => {
            console.log(`\n${index + 1}. ${this.formatItem(item)}`);
        });
    }

    formatItem(item) {
        if (item.className) {
            return `Class "${item.className}" (${item.severity})\n   Files: ${item.files.join(', ')}`;
        }
        if (item.baseName) {
            return `Manager "${item.baseName}" (${item.severity})\n   Implementations: ${item.implementations.map(i => `${i.className} (${i.file})`).join(', ')}`;
        }
        if (item.domain) {
            return `Domain "${item.domain}"\n   Files: ${item.files.map(f => f.file).join(', ')}`;
        }
        if (item.globalName) {
            return `Global "${item.globalName}" (${item.severity})\n   Files: ${item.files.join(', ')}`;
        }
        if (item.eventType) {
            return `Event "${item.eventType}" (${item.count} handlers)\n   Files: ${item.files.slice(0, 5).join(', ')}${item.files.length > 5 ? '...' : ''}`;
        }
        if (item.category) {
            return `Functionality "${item.category}" (${item.severity})\n   Top files: ${item.files.slice(0, 3).map(f => `${f.file} (${f.score})`).join(', ')}`;
        }
        return JSON.stringify(item);
    }

    generateSummary() {
        console.log('\n' + '='.repeat(80));
        console.log('📈 SUMMARY');
        console.log('='.repeat(80));
        
        const totalIssues = Object.values(this.results).reduce((sum, arr) => sum + arr.length, 0);
        const criticalIssues = this.countBySeverity('critical');
        const highIssues = this.countBySeverity('high');
        const mediumIssues = this.countBySeverity('medium');
        
        console.log(`Total Issues Found: ${totalIssues}`);
        console.log(`Critical: ${criticalIssues} | High: ${highIssues} | Medium: ${mediumIssues}`);
    }

    generateRecommendations() {
        console.log('\n' + '='.repeat(80));
        console.log('💡 RECOMMENDATIONS');
        console.log('='.repeat(80));
        
        const recommendations = [
            '1. Consolidate duplicate classes with similar functionality',
            '2. Create a single manager per domain (e.g., one DebugManager)',
            '3. Use a centralized initialization system',
            '4. Implement a global namespace strategy (e.g., window.APP)',
            '5. Create event delegation patterns to reduce duplicate handlers',
            '6. Establish clear module boundaries and responsibilities'
        ];
        
        recommendations.forEach(rec => console.log(rec));
    }

    countBySeverity(severity) {
        return Object.values(this.results).reduce((count, items) => {
            return count + items.filter(item => item.severity === severity).length;
        }, 0);
    }

    writeDetailedReport() {
        const reportPath = path.join(this.rootDir, 'competing-modules-audit-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Detailed report written to: ${reportPath}`);
    }
}

// Run the audit
if (require.main === module) {
    const rootDir = process.env.ROOT_DIR || process.cwd();
    const auditor = new CompetingModulesAuditor(rootDir);
    auditor.audit().catch(console.error);
}

module.exports = CompetingModulesAuditor;
