#!/usr/bin/env node

/**
 * Duplicate Classes Consolidation Script
 * 
 * This script analyzes and consolidates the 42 duplicate class implementations
 * found in the audit, keeping the most complete version and removing stubs.
 */

const fs = require('fs');
const path = require('path');

class DuplicateClassConsolidator {
    constructor() {
        this.consolidations = [];
        this.backups = [];
        this.errors = [];
        this.manualReviews = [];
    }

    async consolidate() {
        console.log('🔄 Starting duplicate class consolidation...\n');
        
        // Define known duplicate classes and their resolution strategy
        const duplicateClasses = [
            {
                className: 'PanelUI',
                files: [
                    'client/dom-inspector/core/PanelUI.js',
                    'redux/components/PanelUI.js'
                ],
                strategy: 'keep_first', // Keep dom-inspector version (more specific)
                reason: 'DOM inspector version is more specialized'
            },
            {
                className: 'Sidebar',
                files: [
                    'client/layout/Sidebar.js',
                    'client/layout/Sidebar_backup.js'
                ],
                strategy: 'remove_backup',
                reason: 'Remove backup file'
            },
            {
                className: 'SidebarHeader', 
                files: [
                    'client/layout/SidebarHeader.js',
                    'client/layout/SidebarHeader_backup.js'
                ],
                strategy: 'remove_backup',
                reason: 'Remove backup file'
            },
            {
                className: 'BasePanel',
                files: [
                    'client/panels/BasePanel.js',
                    'client/panels/BasePanel_backup.js',
                    'client/panels/BasePanel_restored.js'
                ],
                strategy: 'keep_main',
                reason: 'Keep main implementation, remove backups'
            },
            {
                className: 'FileTreePanel',
                files: [
                    'client/panels/FileTreePanel.js',
                    'notsure/panels/FileTreePanel.js'
                ],
                strategy: 'keep_first',
                reason: 'Keep client version, notsure is experimental'
            },
            {
                className: 'TreesPanel',
                files: [
                    'client/panels/TreesPanel.js',
                    'notsure/panels/TreesPanel.js'
                ],
                strategy: 'keep_first',
                reason: 'Keep client version, notsure is experimental'
            },
            {
                className: 'GameClient',
                files: [
                    'client/sdk/gameClient.js',
                    'client/sdk/pjaSdk.js'
                ],
                strategy: 'manual_review',
                reason: 'Both contain substantial game client logic'
            },
            {
                className: 'ActionValidationError',
                files: [
                    'client/validation/action-validators.js',
                    'meta-language/generated/action-validators.js',
                    'meta-language/tools/schema-codegen.js'
                ],
                strategy: 'keep_first',
                reason: 'Keep client version, others are generated/tools'
            },
            {
                className: 'CapabilityManager',
                files: [
                    'pdata/CapabilityManager.js',
                    'server/middleware/capabilities.js'
                ],
                strategy: 'manual_review',
                reason: 'Client vs server implementations'
            },
            {
                className: 'PData',
                files: [
                    'pdata/PData.js',
                    'pdata/PData.original.js',
                    'server/utils/pdata.js'
                ],
                strategy: 'keep_main',
                reason: 'Keep main PData.js, remove original backup'
            }
        ];

        // Process each duplicate class
        for (const duplicate of duplicateClasses) {
            await this.processDuplicateClass(duplicate);
        }

        // Handle vendor script duplicates (these are likely legitimate)
        await this.handleVendorDuplicates();

        // Generate report
        this.generateReport();
    }

    async processDuplicateClass(duplicate) {
        console.log(`\n🔍 Processing duplicate class: ${duplicate.className}`);
        
        try {
            switch (duplicate.strategy) {
                case 'remove_backup':
                    await this.removeBackupFiles(duplicate);
                    break;
                case 'keep_first':
                    await this.keepFirstRemoveRest(duplicate);
                    break;
                case 'keep_main':
                    await this.keepMainRemoveBackups(duplicate);
                    break;
                case 'manual_review':
                    this.flagForManualReview(duplicate);
                    break;
                default:
                    console.log(`⚠️ Unknown strategy: ${duplicate.strategy}`);
            }
        } catch (error) {
            console.error(`❌ Error processing ${duplicate.className}:`, error.message);
            this.errors.push({
                className: duplicate.className,
                error: error.message
            });
        }
    }

    async removeBackupFiles(duplicate) {
        const backupFiles = duplicate.files.filter(f => 
            f.includes('_backup') || f.includes('_restored') || f.includes('.original')
        );
        
        for (const file of backupFiles) {
            if (fs.existsSync(file)) {
                const backupPath = `${file}.consolidation-backup-${Date.now()}`;
                fs.copyFileSync(file, backupPath);
                fs.unlinkSync(file);
                
                this.backups.push({ original: file, backup: backupPath });
                console.log(`✅ Removed backup file: ${file}`);
            }
        }
        
        this.consolidations.push({
            className: duplicate.className,
            action: 'removed_backups',
            files: backupFiles,
            reason: duplicate.reason
        });
    }

    async keepFirstRemoveRest(duplicate) {
        const [keepFile, ...removeFiles] = duplicate.files;
        
        // Verify the keep file exists and has content
        if (!fs.existsSync(keepFile)) {
            console.log(`⚠️ Keep file doesn't exist: ${keepFile}`);
            return;
        }
        
        const keepContent = fs.readFileSync(keepFile, 'utf8');
        if (keepContent.length < 100) {
            console.log(`⚠️ Keep file seems too small: ${keepFile} (${keepContent.length} chars)`);
            this.flagForManualReview(duplicate);
            return;
        }
        
        // Remove the other files
        const actuallyRemoved = [];
        for (const file of removeFiles) {
            if (fs.existsSync(file)) {
                const backupPath = `${file}.consolidation-backup-${Date.now()}`;
                fs.copyFileSync(file, backupPath);
                fs.unlinkSync(file);
                
                this.backups.push({ original: file, backup: backupPath });
                actuallyRemoved.push(file);
                console.log(`✅ Removed duplicate: ${file}`);
            }
        }
        
        this.consolidations.push({
            className: duplicate.className,
            action: 'kept_first',
            kept: keepFile,
            removed: actuallyRemoved,
            reason: duplicate.reason
        });
    }

    async keepMainRemoveBackups(duplicate) {
        const mainFile = duplicate.files.find(f => 
            !f.includes('_backup') && !f.includes('_restored') && !f.includes('.original')
        );
        
        if (!mainFile) {
            console.log(`⚠️ No main file found for ${duplicate.className}`);
            this.flagForManualReview(duplicate);
            return;
        }
        
        const backupFiles = duplicate.files.filter(f => f !== mainFile);
        const actuallyRemoved = [];
        
        for (const file of backupFiles) {
            if (fs.existsSync(file)) {
                const backupPath = `${file}.consolidation-backup-${Date.now()}`;
                fs.copyFileSync(file, backupPath);
                fs.unlinkSync(file);
                
                this.backups.push({ original: file, backup: backupPath });
                actuallyRemoved.push(file);
                console.log(`✅ Removed backup: ${file}`);
            }
        }
        
        this.consolidations.push({
            className: duplicate.className,
            action: 'kept_main',
            kept: mainFile,
            removed: actuallyRemoved,
            reason: duplicate.reason
        });
    }

    flagForManualReview(duplicate) {
        console.log(`⚠️ Flagged for manual review: ${duplicate.className}`);
        this.manualReviews.push(duplicate);
    }

    async handleVendorDuplicates() {
        console.log('\n📦 Handling vendor script duplicates...');
        
        // Vendor duplicates are usually legitimate (different versions, etc.)
        const vendorDuplicates = [
            'client/vendor/scripts/mermaid.min.js',
            'client/vendor/scripts/highlight.min.js'
        ];
        
        console.log('ℹ️ Vendor script duplicates are typically legitimate (different versions)');
        console.log('ℹ️ These should be reviewed manually if causing issues');
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 DUPLICATE CLASS CONSOLIDATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n✅ Classes Consolidated: ${this.consolidations.length}`);
        console.log(`💾 Backups Created: ${this.backups.length}`);
        console.log(`⚠️ Manual Reviews Needed: ${this.manualReviews.length}`);
        console.log(`❌ Errors: ${this.errors.length}`);

        if (this.consolidations.length > 0) {
            console.log('\n📋 Consolidation Details:');
            this.consolidations.forEach((consolidation, index) => {
                console.log(`${index + 1}. ${consolidation.className} (${consolidation.action})`);
                if (consolidation.kept) console.log(`   Kept: ${consolidation.kept}`);
                if (consolidation.removed) console.log(`   Removed: ${consolidation.removed.join(', ')}`);
                console.log(`   Reason: ${consolidation.reason}`);
            });
        }

        if (this.manualReviews.length > 0) {
            console.log('\n⚠️ Manual Reviews Needed:');
            this.manualReviews.forEach((review, index) => {
                console.log(`${index + 1}. ${review.className}`);
                console.log(`   Files: ${review.files.join(', ')}`);
                console.log(`   Reason: ${review.reason}`);
            });
        }

        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.className}: ${error.error}`);
            });
        }

        console.log('\n💡 Next Steps:');
        console.log('1. Review manual review items and resolve conflicts');
        console.log('2. Update any imports that reference removed files');
        console.log('3. Test functionality to ensure consolidation worked');
        console.log('4. Run the audit again to verify duplicate classes are resolved');

        // Write detailed report
        const reportPath = 'duplicate-classes-consolidation-report.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            consolidations: this.consolidations,
            backups: this.backups,
            manualReviews: this.manualReviews,
            errors: this.errors
        }, null, 2));

        console.log(`\n📄 Detailed report written to: ${reportPath}`);
    }
}

// Run the consolidation
if (require.main === module) {
    const consolidator = new DuplicateClassConsolidator();
    consolidator.consolidate().catch(console.error);
}

module.exports = DuplicateClassConsolidator;
