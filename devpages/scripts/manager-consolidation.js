#!/usr/bin/env node

/**
 * Manager Consolidation Script
 * 
 * This script consolidates competing manager classes into the unified system:
 * - CapabilityManager (2 implementations) -> UnifiedCapabilityManager
 * - KeyboardShortcutManager vs KeyboardShortcutHandler -> UnifiedKeyboardShortcutManager
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ManagerConsolidator {
    constructor(rootDir = process.cwd()) {
        this.rootDir = rootDir;
        this.results = {
            filesProcessed: 0,
            replacementsMade: 0,
            managersConsolidated: [],
            errors: []
        };
        
        this.setupConsolidations();
    }

    setupConsolidations() {
        this.consolidations = [
            {
                name: 'CapabilityManager',
                oldImports: [
                    /import.*CapabilityManager.*from.*['"`].*\/backup\/modules\/CapabilityManager\.js['"`]/g,
                    /import.*CapabilityManager.*from.*['"`].*\/backup\/modules\/capabilities\.js['"`]/g
                ],
                newImport: "import { UnifiedCapabilityManager } from '/managers/UnifiedManagerSystem.js';",
                oldUsage: /new\s+CapabilityManager\s*\(/g,
                newUsage: 'new UnifiedCapabilityManager(',
                description: 'Consolidate CapabilityManager implementations'
            },
            {
                name: 'KeyboardShortcutManager',
                oldImports: [
                    /import.*KeyboardShortcutManager.*from.*['"`].*\/client\/utils\/KeyboardShortcutManager\.js['"`]/g,
                    /import.*KeyboardShortcutHandler.*from.*['"`].*\/redux\/components\/KeyboardShortcutHandler\.js['"`]/g
                ],
                newImport: "import { UnifiedKeyboardShortcutManager } from '/managers/UnifiedManagerSystem.js';",
                oldUsage: /new\s+(KeyboardShortcutManager|KeyboardShortcutHandler)\s*\(/g,
                newUsage: 'new UnifiedKeyboardShortcutManager(',
                description: 'Consolidate keyboard shortcut managers'
            }
        ];
    }

    async consolidate() {
        console.log('🔄 Starting Manager Consolidation...\n');
        
        await this.processDirectory(this.rootDir);
        
        this.generateReport();
        this.writeReport();
    }

    async processDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const relativePath = path.relative(this.rootDir, itemPath);
            
            if (this.shouldSkip(relativePath)) continue;
            
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                await this.processDirectory(itemPath);
            } else if (stat.isFile() && itemPath.endsWith('.js')) {
                await this.processFile(itemPath);
            }
        }
    }

    async processFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            let modifiedContent = content;
            let fileChanged = false;
            const fileReplacements = [];

            // Apply each consolidation
            for (const consolidation of this.consolidations) {
                let consolidationApplied = false;

                // Replace imports
                for (const oldImportPattern of consolidation.oldImports) {
                    if (oldImportPattern.test(content)) {
                        modifiedContent = modifiedContent.replace(oldImportPattern, consolidation.newImport);
                        consolidationApplied = true;
                        fileChanged = true;
                    }
                }

                // Replace usage
                const usageMatches = content.match(consolidation.oldUsage);
                if (usageMatches) {
                    modifiedContent = modifiedContent.replace(consolidation.oldUsage, consolidation.newUsage);
                    consolidationApplied = true;
                    fileChanged = true;
                }

                if (consolidationApplied) {
                    fileReplacements.push({
                        name: consolidation.name,
                        description: consolidation.description,
                        importReplacements: consolidation.oldImports.reduce((count, pattern) => {
                            return count + (content.match(pattern) || []).length;
                        }, 0),
                        usageReplacements: (usageMatches || []).length
                    });

                    if (!this.results.managersConsolidated.includes(consolidation.name)) {
                        this.results.managersConsolidated.push(consolidation.name);
                    }
                }
            }

            // Write back if changed
            if (fileChanged) {
                // Create backup
                const backupPath = `${filePath}.backup-manager-consolidation-${Date.now()}`;
                fs.copyFileSync(filePath, backupPath);
                
                // Write modified content
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                
                console.log(`✅ Consolidated: ${path.relative(this.rootDir, filePath)}`);
                fileReplacements.forEach(replacement => {
                    console.log(`   - ${replacement.description}`);
                    if (replacement.importReplacements > 0) {
                        console.log(`     • Import replacements: ${replacement.importReplacements}`);
                    }
                    if (replacement.usageReplacements > 0) {
                        console.log(`     • Usage replacements: ${replacement.usageReplacements}`);
                    }
                    this.results.replacementsMade += replacement.importReplacements + replacement.usageReplacements;
                });
                console.log(`   - Backup: ${path.relative(this.rootDir, backupPath)}\n`);
            }

            this.results.filesProcessed++;

        } catch (error) {
            this.results.errors.push({
                file: filePath,
                error: error.message
            });
            console.error(`❌ Error processing ${filePath}:`, error.message);
        }
    }

    shouldSkip(relativePath) {
        const skipPatterns = [
            'node_modules',
            '.git',
            '.vscode',
            'dist',
            'build',
            '.DS_Store',
            'package-lock.json',
            'scripts/manager-consolidation.js', // Don't process self
            'client/managers/UnifiedManagerSystem.js' // Don't process the new system
        ];
        
        return skipPatterns.some(pattern => relativePath.includes(pattern));
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 MANAGER CONSOLIDATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`Files Processed: ${this.results.filesProcessed}`);
        console.log(`Total Replacements: ${this.results.replacementsMade}`);
        console.log(`Managers Consolidated: ${this.results.managersConsolidated.length}`);
        console.log(`Errors: ${this.results.errors.length}`);
        
        if (this.results.managersConsolidated.length > 0) {
            console.log('\n✅ Consolidated Managers:');
            this.results.managersConsolidated.forEach(manager => {
                console.log(`   - ${manager}`);
            });
        }
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach(error => {
                console.log(`   - ${error.file}: ${error.error}`);
            });
        }
        
        console.log('\n💡 Next Steps:');
        console.log('1. Test the application with unified managers');
        console.log('2. Update any remaining references to old managers');
        console.log('3. Remove old manager files once consolidation is verified');
        console.log('4. Update documentation to reflect new manager system');
    }

    writeReport() {
        const reportPath = path.join(this.rootDir, 'manager-consolidation-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                filesProcessed: this.results.filesProcessed,
                replacementsMade: this.results.replacementsMade,
                managersConsolidated: this.results.managersConsolidated,
                errorsCount: this.results.errors.length
            },
            consolidations: this.consolidations.map(c => ({
                name: c.name,
                description: c.description
            })),
            errors: this.results.errors
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report written to: ${reportPath}`);
    }
}

// Run consolidation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const rootDir = process.env.ROOT_DIR || process.cwd();
    const consolidator = new ManagerConsolidator(rootDir);
    consolidator.consolidate().catch(console.error);
}

export default ManagerConsolidator;
