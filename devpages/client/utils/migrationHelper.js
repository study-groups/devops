/**
 * Migration Helper Utilities
 * Provides tools to check and manage the window library migration
 */

// Migration helper functions available in console
window.migrationHelper = {
    
    /**
     * Check current migration status
     */
    status() {
        if (!window.devpages || !window.devpages._internal || !window.devpages._internal.consolidator) {
            console.error('Migration system not initialized');
            return null;
        }
        
        const status = window.devpages._internal.consolidator.getMigrationStatus();
        
        console.group('🔄 DevPages Migration Status');
        console.log(`📊 Total mappings: ${status.totalMappings}`);
        console.log(`✅ Migrated: ${status.migratedCount}`);
        console.log(`⏳ Pending: ${status.pendingMigrations.length}`);
        console.log(`⚠️  Deprecation warnings shown: ${status.deprecationWarnings.length}`);
        
        if (status.pendingMigrations.length > 0) {
            console.group('⏳ Pending Migrations:');
            status.pendingMigrations.forEach(({ oldName, newPath }) => {
                console.log(`  ${oldName} → ${newPath}`);
            });
            console.groupEnd();
        }
        
        if (status.deprecationWarnings.length > 0) {
            console.group('⚠️  Deprecation Warnings:');
            status.deprecationWarnings.forEach(warning => {
                console.log(`  ${warning}`);
            });
            console.groupEnd();
        }
        
        console.groupEnd();
        
        return status;
    },
    
    /**
     * Show the current devpages structure
     */
    structure() {
        if (!window.devpages) {
            console.error('window.devpages not initialized');
            return;
        }
        
        console.group('🏗️  DevPages Structure');
        
        Object.keys(window.devpages).forEach(category => {
            if (category.startsWith('_')) return; // Skip internal
            
            const section = window.devpages[category];
            if (typeof section === 'object' && section !== null) {
                const count = Object.keys(section).length;
                console.log(`📁 ${category}: ${count} items`);
                
                Object.keys(section).forEach(item => {
                    const value = section[item];
                    const type = typeof value;
                    const hasValue = value !== null && value !== undefined;
                    console.log(`  ${hasValue ? '✅' : '❌'} ${item} (${type})`);
                });
            } else {
                console.log(`📄 ${category}: ${typeof section}`);
            }
        });
        
        console.groupEnd();
    },
    
    /**
     * Test backward compatibility
     */
    testCompatibility() {
        if (!window.devpages || !window.devpages._internal || !window.devpages._internal.consolidator) {
            console.error('Migration system not initialized');
            return false;
        }
        
        console.group('🧪 Testing Backward Compatibility');
        
        const migrationMap = window.devpages._internal.consolidator.migrationMap;
        let passedTests = 0;
        let totalTests = 0;
        
        migrationMap.forEach((newPath, oldName) => {
            totalTests++;
            
            try {
                // Test if old name still works
                const oldValue = window[oldName];
                const newValue = window.devpages._internal.consolidator.getNestedProperty(window, newPath);
                
                if (oldValue === newValue) {
                    console.log(`✅ ${oldName} → ${newPath}`);
                    passedTests++;
                } else {
                    console.warn(`❌ ${oldName} → ${newPath} (values don't match)`);
                }
            } catch (error) {
                console.error(`❌ ${oldName} → ${newPath} (error: ${error.message})`);
            }
        });
        
        console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed`);
        console.groupEnd();
        
        return passedTests === totalTests;
    },
    
    /**
     * Clean up old globals (WARNING: This breaks backward compatibility)
     */
    cleanup() {
        if (!window.devpages || !window.devpages._internal || !window.devpages._internal.consolidator) {
            console.error('Migration system not initialized');
            return false;
        }
        
        const confirmed = confirm(
            '⚠️ WARNING: This will remove all old window.* globals and break backward compatibility.\n\n' +
            'Make sure all code has been updated to use window.devpages.*\n\n' +
            'Continue with cleanup?'
        );
        
        if (confirmed) {
            window.devpages._internal.consolidator.cleanupOldGlobals();
            console.log('✅ Cleanup complete. Old globals removed.');
            return true;
        } else {
            console.log('❌ Cleanup cancelled.');
            return false;
        }
    },
    
    /**
     * Generate migration guide
     */
    guide() {
        if (!window.devpages || !window.devpages._internal || !window.devpages._internal.consolidator) {
            console.error('Migration system not initialized');
            return;
        }
        
        console.group('📖 Migration Guide');
        console.log('Replace old window.* references with new window.devpages.* structure:');
        console.log('');
        
        const migrationMap = window.devpages._internal.consolidator.migrationMap;
        const categories = {};
        
        // Group by category
        migrationMap.forEach((newPath, oldName) => {
            const category = newPath.split('.')[1]; // Get category from devpages.category.item
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({ oldName, newPath: `window.${newPath}` });
        });
        
        // Display by category
        Object.keys(categories).sort().forEach(category => {
            console.group(`📁 ${category.toUpperCase()}`);
            categories[category].forEach(({ oldName, newPath }) => {
                console.log(`  window.${oldName} → ${newPath}`);
            });
            console.groupEnd();
        });
        
        console.log('\n💡 TIP: Use migrationHelper.testCompatibility() to verify your changes');
        console.groupEnd();
    },
    
    /**
     * Show available utilities
     */
    help() {
        console.group('🔧 Migration Helper Commands');
        console.log('migrationHelper.status()           - Check migration status');
        console.log('migrationHelper.structure()        - Show devpages structure');
        console.log('migrationHelper.testCompatibility() - Test backward compatibility');
        console.log('migrationHelper.guide()            - Show migration guide');
        console.log('migrationHelper.cleanup()          - Remove old globals (WARNING!)');
        console.log('migrationHelper.help()             - Show this help');
        console.groupEnd();
    }
};

// Show initial status when loaded
console.log('🔄 DevPages Migration Helper loaded. Type migrationHelper.help() for commands.');

// Auto-show status if migration system is ready
if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
    setTimeout(() => {
        console.log('📊 Initial migration status:');
        window.migrationHelper.status();
    }, 1000);
} 