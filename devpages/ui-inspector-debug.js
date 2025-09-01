// UI Inspector Debug Tool - Runtime CSS State Checker
(function() {
    'use strict';
    
    console.log('=== UI INSPECTOR DEBUG TOOL ===');
    
    function checkPanelState(panelId, label) {
        console.log(`\n=== ${label} ===`);
        
        // Find the panel
        const panel = document.querySelector(`#${panelId}`) || 
                     document.querySelector(`[data-panel-id="${panelId}"]`) ||
                     Array.from(document.querySelectorAll('.base-panel')).find(p => 
                         p.textContent.toLowerCase().includes(panelId.toLowerCase())
                     );
        
        if (!panel) {
            console.log('❌ Panel not found');
            return null;
        }
        
        const computed = window.getComputedStyle(panel);
        const rect = panel.getBoundingClientRect();
        
        console.log('Panel Element:', panel);
        console.log('Classes:', panel.className);
        console.log('Computed Styles:', {
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
            position: computed.position,
            zIndex: computed.zIndex,
            transform: computed.transform,
            transition: computed.transition
        });
        console.log('Rect:', {
            visible: rect.width > 0 && rect.height > 0,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left
        });
        
        // Check for is-visible class
        const hasVisibleClass = panel.classList.contains('is-visible');
        console.log('Has is-visible class:', hasVisibleClass);
        
        // Check children
        const content = panel.querySelector('.dp-panel-content');
        if (content) {
            console.log('Content element found:', content);
            console.log('Content computed display:', window.getComputedStyle(content).display);
        } else {
            console.log('❌ No .dp-panel-content found');
        }
        
        // Check for CSS loading issues
        const dpSections = panel.querySelectorAll('.dp-sections');
        const dpSectionsItems = panel.querySelectorAll('.dp-section');
        console.log(`Found ${dpSections.length} .dp-sections, ${dpSectionsItems.length} .dp-section`);
        
        return {
            panel,
            computed,
            rect,
            hasVisibleClass,
            hasContent: !!content,
            dpSectionsCount: dpSections.length,
            dpSectionItemsCount: dpSectionsItems.length
        };
    }
    
    function compareStylesheets() {
        console.log('\n=== STYLESHEET ANALYSIS ===');
        
        const sheets = Array.from(document.styleSheets);
        console.log(`Total stylesheets: ${sheets.length}`);
        
        sheets.forEach((sheet, index) => {
            try {
                const rules = Array.from(sheet.cssRules || sheet.rules || []);
                const dpRules = rules.filter(rule => 
                    rule.selectorText && rule.selectorText.includes('dp-')
                );
                const basePanelRules = rules.filter(rule =>
                    rule.selectorText && rule.selectorText.includes('base-panel')
                );
                
                if (dpRules.length > 0 || basePanelRules.length > 0) {
                    console.log(`Sheet ${index}: ${sheet.href || 'inline'}`);
                    console.log(`  dp- rules: ${dpRules.length}`);
                    console.log(`  base-panel rules: ${basePanelRules.length}`);
                    
                    dpRules.slice(0, 3).forEach(rule => {
                        console.log(`    ${rule.selectorText}`);
                    });
                }
            } catch (e) {
                console.log(`Sheet ${index}: Cannot access (CORS) - ${sheet.href}`);
            }
        });
    }
    
    function setupMonitoring() {
        console.log('\n=== SETTING UP MONITORING ===');
        
        // Monitor for panel creation/updates
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.classList && node.classList.contains('base-panel')) {
                            console.log('🔍 New panel added:', node);
                            setTimeout(() => {
                                checkPanelState(node.id || 'unknown', 'NEW PANEL');
                            }, 100);
                        }
                        
                        // Check for panels in added subtree
                        const panels = node.querySelectorAll && node.querySelectorAll('.base-panel');
                        if (panels) {
                            panels.forEach(panel => {
                                console.log('🔍 Panel found in subtree:', panel);
                                setTimeout(() => {
                                    checkPanelState(panel.id || 'unknown', 'SUBTREE PANEL');
                                }, 100);
                            });
                        }
                    }
                });
                
                // Monitor class changes
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList && target.classList.contains('base-panel')) {
                        console.log('📝 Panel class changed:', target, target.className);
                    }
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        
        console.log('✅ Monitoring active');
        window.stopPanelMonitoring = () => observer.disconnect();
    }
    
    // Initial state check
    compareStylesheets();
    
    // Check current panels
    console.log('\n=== CURRENT PANEL STATE ===');
    const allPanels = document.querySelectorAll('.base-panel');
    console.log(`Found ${allPanels.length} panels`);
    
    allPanels.forEach((panel, index) => {
        const id = panel.id || `panel-${index}`;
        checkPanelState(id, `PANEL ${index + 1} (${id})`);
    });
    
    // Setup monitoring
    setupMonitoring();
    
    // Expose helper functions
    window.debugUIInspector = {
        checkPanel: (id) => checkPanelState(id, 'MANUAL CHECK'),
        compareStylesheets,
        forceVisible: (panelId) => {
            const panel = document.querySelector(`#${panelId}`) || 
                         document.querySelector(`[data-panel-id="${panelId}"]`);
            if (panel) {
                panel.classList.add('is-visible');
                panel.style.opacity = '1';
                panel.style.transform = 'scale(1)';
                console.log('✅ Forced panel visible:', panel);
            }
        }
    };
    
    console.log('\n=== HELPER FUNCTIONS ===');
    console.log('Available functions:');
    console.log('- window.debugUIInspector.checkPanel("panel-id")');
    console.log('- window.debugUIInspector.forceVisible("panel-id")');
    console.log('- window.stopPanelMonitoring()');
    
})();