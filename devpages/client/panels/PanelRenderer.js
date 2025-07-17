import { appStore } from '/client/appState.js';
import { BasePanel } from './BasePanel.js';

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
        const state = appStore.getState();
        
        // Handle the actual state structure from panelsReducer
        let panelsToRender = [];
        
        if (this.group === 'sidebar') {
            // Get panels from sidebarPanels and filter by group/visibility
            const sidebarPanels = state.panels.sidebarPanels || {};
            const registry = state.panels.registry || {};
            
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
            const panelGroupState = state.panels[this.group];
            if (!panelGroupState || !panelGroupState.order) {
                return; // No panels for this group
            }
            panelsToRender = panelGroupState.order.filter(panelId => {
                const panelState = panelGroupState.panels[panelId];
                return panelState && panelState.isVisible;
            });
        }

        this.container.innerHTML = '';

        panelsToRender.forEach(panelId => {
            const panelConfig = state.panels.registry[panelId];
            if (panelConfig) {
                let panelInstance = panelConfig.instance;
                if (!panelInstance && panelConfig.panelClass) {
                    panelInstance = new panelConfig.panelClass(panelConfig);
                    panelConfig.instance = panelInstance;
                }

                if (panelInstance instanceof BasePanel) {
                    // Get the panel state for this group
                    let panelState;
                    if (this.group === 'sidebar') {
                        panelState = state.panels.sidebarPanels[panelId];
                        panelInstance.setState({
                            isVisible: panelState.visible,
                            isCollapsed: panelState.collapsed,
                            order: panelState.order,
                        });
                    } else {
                        // Legacy structure for other groups
                        const panelGroupState = state.panels[this.group];
                        panelState = panelGroupState.panels[panelId];
                        panelInstance.setState({
                            isVisible: panelState.isVisible,
                            isCollapsed: panelState.isCollapsed,
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