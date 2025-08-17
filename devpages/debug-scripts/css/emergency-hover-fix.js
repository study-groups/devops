/**
 * Emergency Hover Fix - Inject CSS directly into page
 * Since ui-system.css isn't loading in the bundle, inject the styles directly
 */

console.log('🚨 EMERGENCY HOVER FIX - INJECTING CSS DIRECTLY');
console.log('===============================================');

function injectHoverCSS() {
    // Remove any existing emergency fix
    const existingFix = document.getElementById('emergency-hover-fix');
    if (existingFix) existingFix.remove();
    
    // Create and inject the CSS directly
    const emergencyStyle = document.createElement('style');
    emergencyStyle.id = 'emergency-hover-fix';
    emergencyStyle.textContent = `
        /* EMERGENCY HOVER FIX - INJECTED DIRECTLY */
        
        /* Base ghost button styles */
        button.btn-ghost,
        .btn.btn-ghost,
        button#preview-toggle.btn-ghost,
        button#edit-toggle.btn-ghost,
        button#log-toggle-btn.btn-ghost {
            background-color: transparent !important;
            border: 1px solid transparent !important;
            color: rgba(0, 0, 0, 0.7) !important;
            transition: all 0.15s ease !important;
        }
        
        /* Hover states */
        button.btn-ghost:hover,
        .btn.btn-ghost:hover,
        button#preview-toggle.btn-ghost:hover,
        button#edit-toggle.btn-ghost:hover,
        button#log-toggle-btn.btn-ghost:hover {
            background-color: rgba(0, 0, 0, 0.05) !important;
            border: 1px solid rgba(0, 0, 0, 0.2) !important;
            border-color: rgba(0, 0, 0, 0.2) !important;
            color: rgba(0, 0, 0, 0.9) !important;
            transform: translateY(-1px) !important;
        }
        
        /* Active states with distinct colors */
        button#edit-toggle.btn.active {
            background-color: #22c55e !important;
            border-color: #22c55e !important;
            color: white !important;
        }
        
        button#edit-toggle.btn.active:hover {
            background-color: #16a34a !important;
            border-color: #16a34a !important;
        }
        
        button#preview-toggle.btn.active {
            background-color: #3b82f6 !important;
            border-color: #3b82f6 !important;
            color: white !important;
        }
        
        button#preview-toggle.btn.active:hover {
            background-color: #2563eb !important;
            border-color: #2563eb !important;
        }
        
        button#log-toggle-btn.btn.active {
            background-color: #f59e0b !important;
            border-color: #f59e0b !important;
            color: white !important;
        }
        
        button#log-toggle-btn.btn.active:hover {
            background-color: #d97706 !important;
            border-color: #d97706 !important;
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            button.btn-ghost,
            .btn.btn-ghost,
            button#preview-toggle.btn-ghost,
            button#edit-toggle.btn-ghost,
            button#log-toggle-btn.btn-ghost {
                color: rgba(255, 255, 255, 0.7) !important;
            }
            
            button.btn-ghost:hover,
            .btn.btn-ghost:hover,
            button#preview-toggle.btn-ghost:hover,
            button#edit-toggle.btn-ghost:hover,
            button#log-toggle-btn.btn-ghost:hover {
                background-color: rgba(255, 255, 255, 0.05) !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                border-color: rgba(255, 255, 255, 0.2) !important;
                color: rgba(255, 255, 255, 0.9) !important;
            }
        }
    `;
    
    document.head.appendChild(emergencyStyle);
    
    console.log('✅ Emergency hover CSS injected directly into page');
    console.log('🎯 Hover borders should now work!');
    
    // Test it
    setTimeout(() => {
        const previewBtn = document.getElementById('preview-toggle');
        if (previewBtn) {
            const styles = getComputedStyle(previewBtn);
            console.log('Preview button styles after injection:', {
                backgroundColor: styles.backgroundColor,
                borderColor: styles.borderColor,
                border: styles.border
            });
        }
    }, 100);
}

// Also provide a function to check why the bundle isn't working
function diagnoseBundleIssue() {
    console.log('\n🔍 DIAGNOSING BUNDLE ISSUE...');
    
    // Check if core bundle loaded
    const coreBundle = document.querySelector('link[href*="core.bundle.css"]');
    console.log('Core bundle link element:', coreBundle);
    
    if (coreBundle) {
        console.log('Core bundle href:', coreBundle.href);
        console.log('Core bundle loaded:', coreBundle.sheet ? 'Yes' : 'No');
        
        if (coreBundle.sheet) {
            try {
                const rules = coreBundle.sheet.cssRules || coreBundle.sheet.rules;
                console.log('Core bundle rules count:', rules ? rules.length : 'Cannot access');
                
                // Look for ui-system content
                if (rules) {
                    let uiSystemRules = 0;
                    for (let rule of rules) {
                        if (rule.cssText && rule.cssText.includes('btn-ghost')) {
                            uiSystemRules++;
                        }
                    }
                    console.log('btn-ghost rules found in bundle:', uiSystemRules);
                }
            } catch (e) {
                console.log('Cannot access stylesheet rules:', e.message);
            }
        }
    } else {
        console.log('❌ Core bundle link element not found');
    }
    
    // Check all stylesheets
    const allSheets = Array.from(document.styleSheets);
    console.log('\nAll stylesheets:');
    allSheets.forEach((sheet, i) => {
        const href = sheet.href || 'inline';
        console.log(`${i}: ${href.split('/').pop()}`);
    });
}

// Run the emergency fix
injectHoverCSS();
diagnoseBundleIssue();

// Make functions available
window.injectHoverCSS = injectHoverCSS;
window.diagnoseBundleIssue = diagnoseBundleIssue;

console.log('\n💡 Available functions:');
console.log('- injectHoverCSS() (inject emergency CSS fix)');
console.log('- diagnoseBundleIssue() (diagnose bundle loading)');
