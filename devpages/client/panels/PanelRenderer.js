import { appStore } from '/client/appState.js';
import { BasePanel } from './BasePanel.js';
import { getPanelState } from '/client/store/enhancedSelectors.js';

class PanelRenderer {
    constructor(container, group) {
        this.container = container;
        this.group = group;
        this.unsubscribe = null;
    }

    start() {
        this.unsubscribe = appStore.subscribe(this.render.bind(this));
        this.render(); // Initial render
    }

    stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    render() {
        // ✅ MODERNIZED: Use enhanced selector instead of direct state access
        const panelState = getPanelState(appStore.getState());
        
        // Handle the actual state structure from panelsReducer
        let panelsToRender = [];
        
        if (this.group === 'sidebar') {
            // Get panels from sidebarPanels and filter by group/visibility
            const sidebarPanels = panelState.sidebarPanels || {};
            const registry = panelState.registry || {};
            
            // Convert to array format expected by rest of method
            panelsToRender = Object.keys(sidebarPanels)
                .filter(panelId => {
                    const panelState = sidebarPanels[panelId];
                    const panelConfig = registry[panelId];
                    // Filter by group and visibility
                    return panelState && panelState.visible && 
                           panelConfig && (panelConfig.group === 'sidebar' || !panelConfig.group);
                })
                .sort((a, b) => {
                    // Sort by order property
                    const orderA = sidebarPanels[a].order || 99;
                    const orderB = sidebarPanels[b].order || 99;
                    return orderA - orderB;
                });
        } else {
            // For other groups, check if the old structure exists
            const panelGroupState = panelState[this.group];
            if (!panelGroupState || !panelGroupState.order) {
                return; // No panels for this group
            }
            panelsToRender = panelGroupState.order.filter(panelId => {
                const panelStateItem = panelGroupState.panels[panelId];
                return panelStateItem && panelStateItem.isVisible;
            });
        }

        this.container.innerHTML = '';

        panelsToRender.forEach(panelId => {
            const panelConfig = panelState.registry[panelId];
            if (panelConfig) {
                let panelInstance = panelConfig.instance;
                if (!panelInstance && panelConfig.panelClass) {
                    panelInstance = new panelConfig.panelClass(panelConfig);
                    panelConfig.instance = panelInstance;
                }

                if (panelInstance instanceof BasePanel) {
                    // Get the panel state for this group
                    let panelStateItem;
                    if (this.group === 'sidebar') {
                        panelStateItem = panelState.sidebarPanels[panelId];
                        panelInstance.setState({
                            isVisible: panelStateItem.visible,
                            isCollapsed: panelStateItem.collapsed,
                            order: panelStateItem.order,
                        });
                    } else {
                        // Legacy structure for other groups
                        const panelGroupState = panelState[this.group];
                        panelStateItem = panelGroupState.panels[panelId];
                        panelInstance.setState({
                            isVisible: panelStateItem.isVisible,
                            isCollapsed: panelStateItem.isCollapsed,
                            order: panelGroupState.order.indexOf(panelId),
                        });
                    }
                    
                    this.container.appendChild(panelInstance.render());
                }
            }
        });
    }
}

export { PanelRenderer }; 