#!/usr/bin/env node

/**
 * Migration Script for Centralized APP Initialization
 * 
 * This script migrates all files that directly set window.APP properties
 * to use the new centralized AppInitializer system.
 */

const fs = require('fs');
const path = require('path');

class AppInitializationMigrator {
    constructor() {
        this.migrations = [];
        this.backups = [];
        this.errors = [];
    }

    async migrate() {
        console.log('🔄 Starting APP initialization migration...\n');
        
        // Define migration patterns
        const migrationPatterns = [
            {
                file: 'client/bootloader.js',
                changes: [
                    {
                        pattern: /window\.APP = window\.APP \|\| \{\};/g,
                        replacement: `// APP initialization now handled by AppInitializer
import appInitializer from './core/AppInitializer.js';
await appInitializer.initialize();`,
                        description: 'Replace direct APP initialization with AppInitializer'
                    },
                    {
                        pattern: /window\.APP\.services = window\.APP\.services \|\| \{\};/g,
                        replacement: '// Services now registered via appInitializer.registerService()',
                        description: 'Remove direct services initialization'
                    },
                    {
                        pattern: /window\.APP\.eventBus = eventBus;/g,
                        replacement: 'appInitializer.setAppProperty("eventBus", eventBus);',
                        description: 'Use AppInitializer for eventBus'
                    },
                    {
                        pattern: /window\.APP\.bootloader = \{/g,
                        replacement: 'appInitializer.setAppProperty("bootloader", {',
                        description: 'Use AppInitializer for bootloader'
                    }
                ]
            },
            {
                file: 'client/appState.js',
                changes: [
                    {
                        pattern: /window\.APP = window\.APP \|\| \{\};[\s\n]*window\.APP\.store = appStore;/g,
                        replacement: `import appInitializer from './core/AppInitializer.js';
appInitializer.setAppProperty("store", appStore);`,
                        description: 'Use AppInitializer for store'
                    }
                ]
            },
            {
                file: 'packages/devpages-debug/DebugDock.js',
                changes: [
                    {
                        pattern: /window\.APP\.debugDock = debugDock;/g,
                        replacement: `import appInitializer from '../../client/core/AppInitializer.js';
appInitializer.registerComponent("debugDock", debugDock, { global: true });`,
                        description: 'Use AppInitializer for debugDock'
                    }
                ]
            },
            {
                file: 'redux/components/PDataPanel.js',
                changes: [
                    {
                        pattern: /window\.APP\.pdataPanel = this;/g,
                        replacement: `import appInitializer from '../../client/core/AppInitializer.js';
appInitializer.registerComponent("pdataPanel", this, { global: true });`,
                        description: 'Use AppInitializer for pdataPanel'
                    }
                ]
            },
            {
                file: 'client/utils/KeyboardShortcutManager.js',
                changes: [
                    {
                        pattern: /if \(!window\.APP\) window\.APP = \{\};[\s\S]*?window\.APP\.debug = \{/g,
                        replacement: `import appInitializer from '../core/AppInitializer.js';
        
        appInitializer.registerDebugUtility("debug", {`,
                        description: 'Use AppInitializer for debug utilities'
                    }
                ]
            }
        ];

        // Apply migrations
        for (const migration of migrationPatterns) {
            await this.applyMigration(migration);
        }

        // Generate report
        this.generateReport();
    }

    async applyMigration(migration) {
        const filePath = path.join(process.cwd(), migration.file);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ File not found: ${migration.file}`);
            return;
        }

        try {
            // Read original content
            const originalContent = fs.readFileSync(filePath, 'utf8');
            let newContent = originalContent;
            let hasChanges = false;

            // Apply each change
            for (const change of migration.changes) {
                if (change.pattern.test(newContent)) {
                    newContent = newContent.replace(change.pattern, change.replacement);
                    hasChanges = true;
                    console.log(`✅ Applied: ${change.description} in ${migration.file}`);
                }
            }

            if (hasChanges) {
                // Create backup
                const backupPath = `${filePath}.backup-app-migration-${Date.now()}`;
                fs.writeFileSync(backupPath, originalContent);
                this.backups.push({ original: filePath, backup: backupPath });

                // Write migrated content
                fs.writeFileSync(filePath, newContent);
                
                this.migrations.push({
                    file: migration.file,
                    changes: migration.changes.length,
                    backup: backupPath
                });
            } else {
                console.log(`ℹ️ No changes needed for ${migration.file}`);
            }

        } catch (error) {
            console.error(`❌ Error migrating ${migration.file}:`, error.message);
            this.errors.push({ file: migration.file, error: error.message });
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 APP INITIALIZATION MIGRATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n✅ Files Migrated: ${this.migrations.length}`);
        console.log(`💾 Backups Created: ${this.backups.length}`);
        console.log(`❌ Errors: ${this.errors.length}`);

        if (this.migrations.length > 0) {
            console.log('\n📋 Migration Details:');
            this.migrations.forEach((migration, index) => {
                console.log(`${index + 1}. ${migration.file} (${migration.changes} changes)`);
                console.log(`   Backup: ${migration.backup}`);
            });
        }

        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.file}: ${error.error}`);
            });
        }

        console.log('\n💡 Next Steps:');
        console.log('1. Import AppInitializer in your main bootloader');
        console.log('2. Test all functionality to ensure migrations work');
        console.log('3. Update any remaining direct window.APP assignments');
        console.log('4. Run the audit again to verify conflicts are resolved');

        // Write detailed report
        const reportPath = 'app-initialization-migration-report.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            migrations: this.migrations,
            backups: this.backups,
            errors: this.errors
        }, null, 2));

        console.log(`\n📄 Detailed report written to: ${reportPath}`);
    }
}

// Run the migration
if (require.main === module) {
    const migrator = new AppInitializationMigrator();
    migrator.migrate().catch(console.error);
}

module.exports = AppInitializationMigrator;
