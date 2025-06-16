/**
 * Debug utility to check what panels are currently registered
 * Run this in the browser console to see all registered panels
 */

export function debugPanels() {
    if (typeof window !== 'undefined' && window.panelRegistry) {
        const panels = window.panelRegistry.getPanels();
        console.log('=== REGISTERED PANELS DEBUG ===');
        console.log(`Total panels: ${panels.length}`);
        
        panels.forEach((panel, index) => {
            console.log(`${index + 1}. ${panel.id} - "${panel.title}" (order: ${panel.order})`);
        });
        
        // Check for duplicates
        const titles = panels.map(p => p.title);
        const duplicateTitles = titles.filter((title, index) => titles.indexOf(title) !== index);
        
        if (duplicateTitles.length > 0) {
            console.warn('DUPLICATE PANEL TITLES FOUND:', duplicateTitles);
            duplicateTitles.forEach(title => {
                const duplicates = panels.filter(p => p.title === title);
                console.warn(`"${title}" appears ${duplicates.length} times:`, duplicates);
            });
        } else {
            console.log('✅ No duplicate panel titles found');
        }
        
        return panels;
    } else {
        console.error('panelRegistry not available');
        return null;
    }
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.debugPanels = debugPanels;
}

// Also check for any CSS & Design panels specifically
export function debugCssDesignPanels() {
    if (typeof window !== 'undefined' && window.panelRegistry) {
        const panels = window.panelRegistry.getPanels();
        const cssDesignPanels = panels.filter(p => 
            p.title.toLowerCase().includes('css') && p.title.toLowerCase().includes('design')
        );
        
        console.log('=== CSS & DESIGN PANELS DEBUG ===');
        console.log(`Found ${cssDesignPanels.length} CSS & Design panels:`);
        
        cssDesignPanels.forEach((panel, index) => {
            console.log(`${index + 1}. ID: ${panel.id}, Title: "${panel.title}", Order: ${panel.order}`);
            console.log(`   Component:`, panel.component);
        });
        
        return cssDesignPanels;
    } else {
        console.error('panelRegistry not available');
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.debugCssDesignPanels = debugCssDesignPanels;
}

// Function to check and clear problematic localStorage values
export function debugLocalStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        console.log('=== LOCALSTORAGE DEBUG ===');
        
        // Check for design tokens directory setting
        const designTokensDir = localStorage.getItem('devpages_design_tokens_dir');
        console.log('Design Tokens Directory:', designTokensDir);
        
        // Check for settings panel state
        const settingsPanelState = localStorage.getItem('devpages_settings_panel_state');
        if (settingsPanelState) {
            try {
                const parsed = JSON.parse(settingsPanelState);
                console.log('Settings Panel State:', parsed);
            } catch (e) {
                console.log('Settings Panel State (raw):', settingsPanelState);
            }
        }
        
        // Check for any keys containing MD_DIR
        const allKeys = Object.keys(localStorage);
        const mdDirKeys = allKeys.filter(key => {
            const value = localStorage.getItem(key);
            return value && value.includes('MD_DIR');
        });
        
        if (mdDirKeys.length > 0) {
            console.warn('Found localStorage keys with MD_DIR values:');
            mdDirKeys.forEach(key => {
                console.warn(`  ${key}:`, localStorage.getItem(key));
            });
        }
        
        return {
            designTokensDir,
            settingsPanelState,
            mdDirKeys
        };
    } else {
        console.error('localStorage not available');
        return null;
    }
}

// Function to clear problematic localStorage values
export function clearProblematicLocalStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
        console.log('=== CLEARING PROBLEMATIC LOCALSTORAGE ===');
        
        // Clear design tokens directory if it contains MD_DIR
        const designTokensDir = localStorage.getItem('devpages_design_tokens_dir');
        if (designTokensDir && designTokensDir.includes('MD_DIR')) {
            console.log('Clearing design tokens directory:', designTokensDir);
            localStorage.removeItem('devpages_design_tokens_dir');
        }
        
        // Check and fix settings panel state
        const settingsPanelState = localStorage.getItem('devpages_settings_panel_state');
        if (settingsPanelState) {
            try {
                const parsed = JSON.parse(settingsPanelState);
                let modified = false;
                
                // Check if designTokens.tokensDirectory contains MD_DIR
                if (parsed.designTokens && parsed.designTokens.tokensDirectory && 
                    parsed.designTokens.tokensDirectory.includes('MD_DIR')) {
                    console.log('Fixing tokensDirectory in settings panel state');
                    parsed.designTokens.tokensDirectory = '/root/pj/md/themes';
                    modified = true;
                }
                
                if (modified) {
                    localStorage.setItem('devpages_settings_panel_state', JSON.stringify(parsed));
                    console.log('Updated settings panel state');
                }
            } catch (e) {
                console.error('Error parsing settings panel state:', e);
            }
        }
        
        console.log('✅ Cleanup complete. Please reload the page.');
        return true;
    } else {
        console.error('localStorage not available');
        return false;
    }
}

if (typeof window !== 'undefined') {
    window.debugLocalStorage = debugLocalStorage;
    window.clearProblematicLocalStorage = clearProblematicLocalStorage;
} 