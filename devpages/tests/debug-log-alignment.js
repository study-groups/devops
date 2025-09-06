/**
 * Debug script to inspect log display alignment
 * Run this in browser console to see actual DOM structure and CSS
 */

function debugLogAlignment() {
    console.log('=== LOG ALIGNMENT DEBUG ===');
    
    // Find log container
    const logContainer = document.getElementById('log-container');
    if (!logContainer) {
        console.error('❌ No log container found');
        return;
    }
    
    console.log('✅ Log container found:', logContainer);
    console.log('Container classes:', logContainer.className);
    console.log('Container visibility:', window.getComputedStyle(logContainer).visibility);
    
    // Find log entries
    const logEntries = document.querySelectorAll('.log-entry');
    console.log(`📊 Found ${logEntries.length} log entries`);
    
    if (logEntries.length === 0) {
        console.warn('⚠️ No log entries found - adding test entry');
        
        // Try to add a test entry via LogDisplay API
        if (window.APP?.log?.display?.testLog) {
            window.APP.log.display.testLog('DEBUG: Test alignment entry', 'INFO', 'DEBUG');
            setTimeout(() => debugLogAlignment(), 500);
            return;
        }
    }
    
    // Analyze first few entries
    logEntries.slice(0, 3).forEach((entry, i) => {
        console.log(`\n--- LOG ENTRY ${i + 1} ---`);
        console.log('Entry element:', entry);
        console.log('Entry classes:', entry.className);
        
        // Check each column
        const columns = [
            'log-entry-timestamp',
            'log-entry-level', 
            'log-entry-type',
            'log-entry-module',
            'log-entry-action',
            'log-entry-from',
            'log-entry-message'
        ];
        
        columns.forEach(columnClass => {
            const element = entry.querySelector(`.${columnClass}`);
            if (element) {
                const styles = window.getComputedStyle(element);
                console.log(`${columnClass}:`, {
                    textAlign: styles.textAlign,
                    justifyContent: styles.justifyContent,
                    width: styles.width,
                    content: element.textContent?.substring(0, 20) + '...'
                });
            } else {
                console.log(`${columnClass}: NOT FOUND`);
            }
        });
    });
    
    // Check header alignment
    const header = document.getElementById('log-column-header');
    if (header) {
        console.log('\n--- HEADER COLUMNS ---');
        const headerColumns = header.querySelectorAll('span[class*="log-header-"]');
        headerColumns.forEach(col => {
            const styles = window.getComputedStyle(col);
            console.log(`${col.className}:`, {
                justifyContent: styles.justifyContent,
                textAlign: styles.textAlign,
                width: styles.width,
                content: col.textContent
            });
        });
    }
    
    // Check CSS variables
    console.log('\n--- CSS VARIABLES ---');
    const root = document.documentElement;
    const columnWidths = [
        '--log-column-width-timestamp',
        '--log-column-width-level',
        '--log-column-width-type',
        '--log-column-width-module',
        '--log-column-width-action',
        '--log-column-width-from'
    ];
    
    columnWidths.forEach(varName => {
        const value = getComputedStyle(root).getPropertyValue(varName);
        console.log(`${varName}: ${value || 'NOT SET'}`);
    });
    
    console.log('\n=== DEBUG COMPLETE ===');
}

// Auto-run when loaded
if (typeof window !== 'undefined') {
    // Wait for DOM and log system
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(debugLogAlignment, 1000);
        });
    } else {
        setTimeout(debugLogAlignment, 1000);
    }
    
    // Expose globally for manual testing
    window.debugLogAlignment = debugLogAlignment;
    console.log('🔧 Debug function available as window.debugLogAlignment()');
}

export { debugLogAlignment };
