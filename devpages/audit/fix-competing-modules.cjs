#!/usr/bin/env node

/**
 * Quick Fix Script for Critical Competing Modules
 * Addresses the most severe conflicts found in the audit
 */

const fs = require('fs');
const path = require('path');

class CompetingModulesFixer {
    constructor() {
        this.fixes = [];
        this.backups = [];
    }

    async fix() {
        console.log('🔧 Fixing Critical Competing Modules...\n');
        
        await this.fixKeyboardShortcutManager();
        await this.fixZIndexManager();
        await this.fixPDataPanel();
        await this.consolidateGlobalAPP();
        
        this.generateReport();
    }

    async fixKeyboardShortcutManager() {
        console.log('⌨️ Fixing KeyboardShortcutManager conflicts...');
        
        const oldFile = 'client/keyboard/KeyboardShortcutManager.js';
        const newFile = 'client/utils/KeyboardShortcutManager.js';
        
        if (fs.existsSync(oldFile) && fs.existsSync(newFile)) {
            // Check which one is more complete
            const oldContent = fs.readFileSync(oldFile, 'utf8');
            const newContent = fs.readFileSync(newFile, 'utf8');
            
            if (oldContent.length < 100 && newContent.length > 500) {
                // Old file is likely a stub, remove it
                this.backupAndRemove(oldFile, 'Stub KeyboardShortcutManager removed');
                this.fixes.push({
                    type: 'REMOVED_DUPLICATE',
                    file: oldFile,
                    reason: 'Stub file, main implementation in utils/'
                });
            } else {
                console.log(`   ⚠️ Both files are substantial. Manual review needed.`);
                this.fixes.push({
                    type: 'MANUAL_REVIEW_NEEDED',
                    files: [oldFile, newFile],
                    reason: 'Both files contain substantial code'
                });
            }
        }
    }

    async fixZIndexManager() {
        console.log('📐 Fixing ZIndexManager conflicts...');
        
        const clientFile = 'client/utils/ZIndexManager.js';
        const reduxFile = 'redux/utils/ZIndexManager.js';
        
        if (fs.existsSync(clientFile) && fs.existsSync(reduxFile)) {
            const clientContent = fs.readFileSync(clientFile, 'utf8');
            const reduxContent = fs.readFileSync(reduxFile, 'utf8');
            
            // Check if redux version is newer/better
            if (reduxContent.includes('Redux') && clientContent.length < reduxContent.length) {
                this.backupAndRemove(clientFile, 'Older ZIndexManager replaced by Redux version');
                this.fixes.push({
                    type: 'CONSOLIDATED',
                    removed: clientFile,
                    kept: reduxFile,
                    reason: 'Redux version is more complete'
                });
            } else {
                console.log(`   ⚠️ Manual review needed for ZIndexManager`);
                this.fixes.push({
                    type: 'MANUAL_REVIEW_NEEDED',
                    files: [clientFile, reduxFile],
                    reason: 'Both implementations are substantial'
                });
            }
        }
    }

    async fixPDataPanel() {
        console.log('🔐 Fixing PDataPanel conflicts...');
        
        const debugFile = 'packages/devpages-debug/panels/PDataPanel.js';
        const reduxFile = 'redux/components/PDataPanel.js';
        
        if (fs.existsSync(debugFile) && fs.existsSync(reduxFile)) {
            // The debug version is likely the active one
            console.log(`   ℹ️ Keeping debug version, marking redux version as deprecated`);
            
            const reduxContent = fs.readFileSync(reduxFile, 'utf8');
            const deprecatedContent = `// DEPRECATED: This PDataPanel has been moved to packages/devpages-debug/panels/PDataPanel.js
// This file is kept for reference but should not be used.

${reduxContent}`;
            
            this.backupFile(reduxFile);
            fs.writeFileSync(reduxFile, deprecatedContent);
            
            this.fixes.push({
                type: 'DEPRECATED',
                file: reduxFile,
                reason: 'Moved to debug package, marked as deprecated'
            });
        }
    }

    async consolidateGlobalAPP() {
        console.log('🌐 Analyzing global APP conflicts...');
        
        // This is complex and needs manual review
        this.fixes.push({
            type: 'MANUAL_REVIEW_NEEDED',
            issue: 'Global APP conflicts',
            reason: '32 files setting window.APP - needs centralized initialization strategy',
            recommendation: 'Create single APP initialization in bootloader.js'
        });
    }

    backupAndRemove(filePath, reason) {
        if (fs.existsSync(filePath)) {
            const backupPath = `${filePath}.backup-${Date.now()}`;
            fs.copyFileSync(filePath, backupPath);
            fs.unlinkSync(filePath);
            
            this.backups.push({ original: filePath, backup: backupPath, reason });
            console.log(`   ✅ Backed up and removed: ${filePath}`);
        }
    }

    backupFile(filePath) {
        if (fs.existsSync(filePath)) {
            const backupPath = `${filePath}.backup-${Date.now()}`;
            fs.copyFileSync(filePath, backupPath);
            
            this.backups.push({ original: filePath, backup: backupPath, reason: 'Modified' });
            console.log(`   💾 Backed up: ${filePath}`);
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPETING MODULES FIX REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n✅ Fixes Applied: ${this.fixes.length}`);
        console.log(`💾 Backups Created: ${this.backups.length}`);
        
        console.log('\n📋 Fix Details:');
        this.fixes.forEach((fix, index) => {
            console.log(`\n${index + 1}. ${fix.type}`);
            if (fix.file) console.log(`   File: ${fix.file}`);
            if (fix.files) console.log(`   Files: ${fix.files.join(', ')}`);
            if (fix.removed) console.log(`   Removed: ${fix.removed}`);
            if (fix.kept) console.log(`   Kept: ${fix.kept}`);
            console.log(`   Reason: ${fix.reason}`);
            if (fix.recommendation) console.log(`   Recommendation: ${fix.recommendation}`);
        });
        
        if (this.backups.length > 0) {
            console.log('\n💾 Backup Files Created:');
            this.backups.forEach((backup, index) => {
                console.log(`${index + 1}. ${backup.backup} (${backup.reason})`);
            });
        }
        
        console.log('\n💡 Next Steps:');
        console.log('1. Test the application to ensure fixes work correctly');
        console.log('2. Review manual review items and resolve conflicts');
        console.log('3. Implement centralized APP initialization strategy');
        console.log('4. Consider running the audit again to verify fixes');
        
        // Write detailed report
        const reportPath = 'competing-modules-fixes-report.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            fixes: this.fixes,
            backups: this.backups
        }, null, 2));
        
        console.log(`\n📄 Detailed report written to: ${reportPath}`);
    }
}

// Run the fixer
if (require.main === module) {
    const fixer = new CompetingModulesFixer();
    fixer.fix().catch(console.error);
}

module.exports = CompetingModulesFixer;
