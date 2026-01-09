#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

class AppNamespaceMigrator {
    constructor(rootDir = process.cwd()) {
        this.rootDir = rootDir;
        this.migrationLog = {
            filesScanned: 0,
            filesModified: 0,
            modifications: []
        };
    }

    async migrate() {
        console.log('🔄 Starting APP Namespace Migration...');
        
        // Find all JavaScript files
        const files = this.findJSFiles(this.rootDir);
        
        // Process each file
        for (const file of files) {
            this.processFile(file);
        }
        
        this.generateReport();
    }

    findJSFiles(dir) {
        const jsFiles = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // Skip certain directories
                if (['node_modules', '.git', 'backup', 'dist', 'build'].includes(item)) continue;
                
                // Recursively search subdirectories
                jsFiles.push(...this.findJSFiles(itemPath));
            } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.mjs') || item.endsWith('.cjs'))) {
                jsFiles.push(itemPath);
            }
        }
        
        return jsFiles;
    }

    processFile(filePath) {
        this.migrationLog.filesScanned++;
        
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Patterns to detect and migrate window.APP assignments
            const patterns = [
                // Direct window.APP assignments
                {
                    regex: /window\.APP\s*=\s*{[^}]*}/g,
                    replacement: (match) => {
                        return `import appInitializer from '../client/core/AppInitializer.js';\n// Migrated from direct window.APP assignment\n// ${match}`;
                    }
                },
                // Specific property assignments
                {
                    regex: /window\.APP\.([\w]+)\s*=\s*([^;]+);/g,
                    replacement: (match, prop, value) => {
                        return `import appInitializer from '../client/core/AppInitializer.js';\n// Migrated from direct window.APP property assignment\nappInitializer.setAppProperty('${prop}', ${value});`;
                    }
                }
            ];
            
            // Apply migrations
            let modified = false;
            patterns.forEach(pattern => {
                const newContent = content.replace(pattern.regex, (match, ...args) => {
                    modified = true;
                    return pattern.replacement(match, ...args);
                });
                
                if (modified) content = newContent;
            });
            
            // If modified, write back to file
            if (modified) {
                fs.writeFileSync(filePath, content);
                this.migrationLog.filesModified++;
                this.migrationLog.modifications.push({
                    file: filePath,
                    details: 'Migrated window.APP assignments'
                });
                
                console.log(`✅ Migrated: ${filePath}`);
            }
        } catch (error) {
            console.error(`❌ Error processing ${filePath}:`, error);
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 APP NAMESPACE MIGRATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`\nFiles Scanned: ${this.migrationLog.filesScanned}`);
        console.log(`Files Modified: ${this.migrationLog.filesModified}`);
        
        if (this.migrationLog.modifications.length > 0) {
            console.log('\nModified Files:');
            this.migrationLog.modifications.forEach((mod, index) => {
                console.log(`${index + 1}. ${mod.file}`);
            });
        }
        
        // Write detailed report
        const reportPath = path.join(this.rootDir, 'app-namespace-migration-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.migrationLog, null, 2));
        
        console.log(`\n📄 Detailed report written to: ${reportPath}`);
    }
}

// Run the migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const migrator = new AppNamespaceMigrator();
    migrator.migrate().catch(console.error);
}

export default AppNamespaceMigrator;
