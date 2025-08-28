import { BasePanel } from '../BasePanel.js';

/**
 * Example demonstrating the new BasePanel features:
 * - Parent-child relationships
 * - Multi-width states (full/resized)
 * - Open all/close all functionality
 * - Enhanced headers with info text and buttons
 */

// Create a parent panel with children
const parentPanel = new BasePanel({
    id: 'parent-panel',
    title: 'Parent Panel',
    headerInfo: '3 items',
    widthState: 'full',
    headerButtons: [
        {
            id: 'refresh',
            text: '↻',
            title: 'Refresh',
            onClick: (panel) => {
                console.log('Refreshing panel:', panel.id);
                panel.setHeaderInfo(`${panel.children.size} items (refreshed)`);
            }
        },
        {
            id: 'settings',
            text: '⚙',
            title: 'Settings',
            onClick: (panel) => {
                console.log('Opening settings for:', panel.id);
            }
        }
    ]
});

// Create child panels
const child1 = new BasePanel({
    id: 'child-1',
    title: 'Child Panel 1',
    parent: parentPanel,
    widthState: 'resized',
    headerInfo: 'Active'
});

const child2 = new BasePanel({
    id: 'child-2', 
    title: 'Child Panel 2',
    parent: parentPanel,
    widthState: 'resized',
    isCollapsed: true,
    headerInfo: 'Collapsed'
});

const child3 = new BasePanel({
    id: 'child-3',
    title: 'Child Panel 3', 
    parent: parentPanel,
    widthState: 'resized',
    headerButtons: [
        {
            id: 'delete',
            text: '×',
            title: 'Delete',
            className: 'danger',
            onClick: (panel) => {
                if (confirm(`Delete ${panel.title}?`)) {
                    panel.parent?.removeChild(panel.id);
                    panel.element?.remove();
                }
            }
        }
    ]
});

// Example usage function
export function createPanelExample(container) {
    // Render the parent panel (which will render its children)
    const panelElement = parentPanel.render();
    container.appendChild(panelElement);
    
    // Demonstrate programmatic control
    setTimeout(() => {
        console.log('Demo: Opening all panels');
        parentPanel.openAll();
    }, 2000);
    
    setTimeout(() => {
        console.log('Demo: Closing all panels');
        parentPanel.closeAll();
    }, 4000);
    
    setTimeout(() => {
        console.log('Demo: Switching parent to resized width');
        parentPanel.setWidthState('resized');
    }, 6000);
    
    return {
        parentPanel,
        children: [child1, child2, child3]
    };
}

// Export for testing
export { parentPanel, child1, child2, child3 };
