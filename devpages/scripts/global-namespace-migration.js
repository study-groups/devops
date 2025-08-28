#!/usr/bin/env node

/**
 * Global Namespace Migration Script
 * 
 * This script consolidates all conflicting global variables into the unified window.APP namespace.
 * It addresses the 31 conflicting global exports found in the audit.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GlobalNamespaceMigrator {
    constructor(rootDir = process.cwd()) {
        this.rootDir = rootDir;
        this.migrations = new Map();
        this.results = {
            filesProcessed: 0,
            replacementsMade: 0,
            conflicts: [],
            errors: []
        };
        
        this.setupMigrations();
    }

    setupMigrations() {
        // Define migration patterns for conflicting globals
        this.migrations.set('devPages', {
            from: /window\.devPages\s*=/g,
            to: 'import appInitializer from '../client/core/AppInitializer.js';
// Migrated from direct window.APP property assignment
appInitializer.setAppProperty('devPages', ',
            description: 'Migrate devPages to APP.devPages'
        }));

        this.migrations.set('devpages', {
            from: /window\.devpages\s*=/g,
            to: 'import appInitializer from '../client/core/AppInitializer.js';
// Migrated from direct window.APP property assignment
appInitializer.setAppProperty('devpages', ',
            description: 'Migrate devpages to APP.devpages'
        }));

        // Game client globals
        this.migrations.set('gameClient', {
            from: /window\.gameClient\s*=/g,
            to: 'window.APP.services.gameClient =',
            description: 'Migrate gameClient to APP.services.gameClient'
        });

        this.migrations.set('PJA', {
            from: /window\.PJA\s*=/g,
            to: 'window.APP.services.PJA =',
            description: 'Migrate PJA to APP.services.PJA'
        });

        this.migrations.set('initializeGameClient', {
            from: /window\.initializeGameClient\s*=/g,
            to: 'window.APP.services.initializeGameClient =',
            description: 'Migrate initializeGameClient to APP.services'
        });

        // Markdown globals
        this.migrations.set('markdownit', {
            from: /window\.markdownit\s*=/g,
            to: 'window.APP.services.markdownit =',
            description: 'Migrate markdownit to APP.services.markdownit'
        });

        // Console logging globals
        this.migrations.set('logManager', {
            from: /window\.logManager\s*=/g,
            to: 'window.APP.services.logManager =',
            description: 'Migrate logManager to APP.services.logManager'
        });

        this.migrations.set('isConsoleLoggingEnabled', {
            from: /window\.isConsoleLoggingEnabled\s*=/g,
            to: 'window.APP.services.isConsoleLoggingEnabled =',
            description: 'Migrate isConsoleLoggingEnabled to APP.services'
        });

        this.migrations.set('enableConsoleLogging', {
            from: /window\.enableConsoleLogging\s*=/g,
            to: 'window.APP.services.enableConsoleLogging =',
            description: 'Migrate enableConsoleLogging to APP.services'
        });

        this.migrations.set('disableConsoleLogging', {
            from: /window\.disableConsoleLogging\s*=/g,
            to: 'window.APP.services.disableConsoleLogging =',
            description: 'Migrate disableConsoleLogging to APP.services'
        });

        this.migrations.set('getLogBuffer', {
            from: /window\.getLogBuffer\s*=/g,
            to: 'window.APP.services.getLogBuffer =',
            description: 'Migrate getLogBuffer to APP.services'
        });

        this.migrations.set('clearLogBuffer', {
            from: /window\.clearLogBuffer\s*=/g,
            to: 'window.APP.services.clearLogBuffer =',
            description: 'Migrate clearLogBuffer to APP.services'
        });

        // Settings globals
        this.migrations.set('settingsRegistry', {
            from: /window\.settingsRegistry\s*=/g,
            to: 'window.APP.services.settingsRegistry =',
            description: 'Migrate settingsRegistry to APP.services'
        });

        // Mermaid globals
        this.migrations.set('_mermaidActivePanSvg', {
            from: /window\._mermaidActivePanSvg\s*=/g,
            to: 'window.APP.services._mermaidActivePanSvg =',
            description: 'Migrate _mermaidActivePanSvg to APP.services'
        });

        this.migrations.set('_mermaidPanData', {
            from: /window\._mermaidPanData\s*=/g,
            to: 'window.APP.services._mermaidPanData =',
            description: 'Migrate _mermaidPanData to APP.services'
        });

        // Image handling
        this.migrations.set('handleImageDelete', {
            from: /window\.handleImageDelete\s*=/g,
            to: 'window.APP.services.handleImageDelete =',
            description: 'Migrate handleImageDelete to APP.services'
        });

        // Icons panel
        this.migrations.set('iconsPanel', {
            from: /window\.iconsPanel\s*=/g,
            to: 'window.APP.components.iconsPanel =',
            description: 'Migrate iconsPanel to APP.components'
        });
    }

    async migrate() {
        console.log('🔄 Starting Global Namespace Migration...\n');
        
        await this.processDirectory(this.rootDir);
        
        this.generateReport();
        this.writeReport();
    }

    async processDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const relativePath = path.relative(this.rootDir, itemPath);
            
            // Skip certain directories
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

            // Apply each migration pattern
            for (const [name, migration] of this.migrations.entries()) {
                const matches = content.match(migration.from);
                if (matches) {
                    modifiedContent = modifiedContent.replace(migration.from, migration.to);
                    fileChanged = true;
                    fileReplacements.push({
                        name,
                        count: matches.length,
                        description: migration.description
                    });
                    this.results.replacementsMade += matches.length;
                }
            }

            // Write back if changed
            if (fileChanged) {
                // Create backup
                const backupPath = `${filePath}.backup-global-migration-${Date.now()}`;
                fs.copyFileSync(filePath, backupPath);
                
                // Write modified content
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                
                console.log(`✅ Migrated: ${path.relative(this.rootDir, filePath)}`);
                fileReplacements.forEach(replacement => {
                    console.log(`   - ${replacement.description} (${replacement.count} replacements)`);
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
            'audit',
            'scripts/global-namespace-migration.js' // Don't process self
        ];
        
        return skipPatterns.some(pattern => relativePath.includes(pattern));
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 GLOBAL NAMESPACE MIGRATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`Files Processed: ${this.results.filesProcessed}`);
        console.log(`Total Replacements: ${this.results.replacementsMade}`);
        console.log(`Errors: ${this.results.errors.length}`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach(error => {
                console.log(`   - ${error.file}: ${error.error}`);
            });
        }
        
        console.log('\n💡 Next Steps:');
        console.log('1. Update code that references the old global variables');
        console.log('2. Test the application to ensure everything works');
        console.log('3. Remove backup files once migration is verified');
        console.log('4. Update documentation to reflect new namespace structure');
    }

    writeReport() {
        const reportPath = path.join(this.rootDir, 'global-namespace-migration-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                filesProcessed: this.results.filesProcessed,
                replacementsMade: this.results.replacementsMade,
                errorsCount: this.results.errors.length
            },
            migrations: Array.from(this.migrations.entries()).map(([name, migration]) => ({
                name,
                description: migration.description,
                pattern: migration.from.toString()
            })),
            errors: this.results.errors
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report written to: ${reportPath}`);
    }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const rootDir = process.env.ROOT_DIR || process.cwd();
    const migrator = new GlobalNamespaceMigrator(rootDir);
    migrator.migrate().catch(console.error);
}

export default GlobalNamespaceMigrator;
