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