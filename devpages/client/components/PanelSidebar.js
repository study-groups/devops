/**
 * Panel Sidebar Component
 * Implements tag-based filtering system for panels
 */

import { appStore } from '../appState.js';
import { 
    setSidebarActiveTab, 
    setSidebarVisible, 
    dockPanel, 
    undockPanel,
    selectSidebar,
    selectPanelsByTag,
    selectVisiblePanels
} from '../store/slices/panelSlice.js';

export function createPanelSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'panel-sidebar';
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-tabs">
                <button class="tab-button active" data-tag="settings">Settings</button>
                <button class="tab-button" data-tag="debug">Debug</button>
                <button class="tab-button" data-tag="publish">Publish</button>
            </div>
            <button class="sidebar-toggle" title="Toggle Sidebar">
                <span class="toggle-icon">◀</span>
            </button>
        </div>
        <div class="sidebar-content">
            <div class="panel-search">
                <input type="text" placeholder="Search panels..." class="search-input">
            </div>
            <div class="panel-list">
                <!-- Panels will be rendered here -->
            </div>
        </div>
        <div class="sidebar-resize-handle"></div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .panel-sidebar {
            position: fixed;
            left: 0;
            top: 60px;
            width: 300px;
            height: calc(100vh - 60px);
            background: var(--bg-secondary, #f8f9fa);
            border-right: 1px solid var(--border-color, #e0e0e0);
            display: flex;
            flex-direction: column;
            z-index: 1000;
            transition: transform 0.3s ease;
        }
        
        .panel-sidebar.hidden {
            transform: translateX(-100%);
        }
        
        .sidebar-header {
            padding: 12px;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .sidebar-tabs {
            display: flex;
            gap: 4px;
        }
        
        .tab-button {
            padding: 6px 12px;
            border: 1px solid var(--border-color, #e0e0e0);
            background: var(--bg-primary, #ffffff);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }
        
        .tab-button:hover {
            background: var(--bg-hover, #f0f0f0);
        }
        
        .tab-button.active {
            background: var(--primary-color, #007bff);
            color: white;
            border-color: var(--primary-color, #007bff);
        }
        
        .sidebar-toggle {
            padding: 4px 8px;
            border: 1px solid var(--border-color, #e0e0e0);
            background: var(--bg-primary, #ffffff);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .sidebar-content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .panel-search {
            padding: 12px;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        
        .search-input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 4px;
            font-size: 12px;
        }
        
        .panel-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }
        
        .panel-item {
            padding: 8px 12px;
            margin-bottom: 4px;
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 4px;
            background: var(--bg-primary, #ffffff);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .panel-item:hover {
            background: var(--bg-hover, #f0f0f0);
            border-color: var(--primary-color, #007bff);
        }
        
        .panel-item.mounted {
            border-color: var(--success-color, #28a745);
            background: var(--success-bg, #d4edda);
        }
        
        .panel-name {
            font-weight: 500;
            font-size: 13px;
            margin-bottom: 2px;
        }
        
        .panel-description {
            font-size: 11px;
            color: var(--text-secondary, #666);
            line-height: 1.3;
        }
        
        .panel-tags {
            display: flex;
            gap: 4px;
            margin-top: 4px;
        }
        
        .panel-tag {
            padding: 2px 6px;
            background: var(--tag-bg, #e9ecef);
            border-radius: 10px;
            font-size: 10px;
            color: var(--text-secondary, #666);
        }
        
        .sidebar-resize-handle {
            position: absolute;
            right: -3px;
            top: 0;
            width: 6px;
            height: 100%;
            cursor: ew-resize;
            background: transparent;
        }
        
        .sidebar-resize-handle:hover {
            background: var(--primary-color, #007bff);
            opacity: 0.3;
        }
    `;
    document.head.appendChild(style);

    // State management
    let currentTag = 'settings';
    let searchTerm = '';
    let isVisible = true;

    // DOM elements
    const tabButtons = sidebar.querySelectorAll('.tab-button');
    const toggleButton = sidebar.querySelector('.sidebar-toggle');
    const searchInput = sidebar.querySelector('.search-input');
    const panelList = sidebar.querySelector('.panel-list');
    const resizeHandle = sidebar.querySelector('.sidebar-resize-handle');

    // Event handlers
    function handleTabClick(event) {
        const tag = event.target.dataset.tag;
        if (tag && tag !== currentTag) {
            // Update UI
            tabButtons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            // Update state
            currentTag = tag;
            appStore.dispatch(setSidebarActiveTab(tag));
            
            // Re-render panels
            renderPanels();
        }
    }

    function handleToggle() {
        isVisible = !isVisible;
        sidebar.classList.toggle('hidden', !isVisible);
        toggleButton.querySelector('.toggle-icon').textContent = isVisible ? '◀' : '▶';
        appStore.dispatch(setSidebarVisible(isVisible));
    }

    function handleSearch(event) {
        searchTerm = event.target.value;
        renderPanels();
    }

    function handlePanelClick(panelId) {
        const state = appStore.getState();
        const mountedPanels = state.panels.mountedPanels;
        
        if (mountedPanels[panelId]) {
            // Panel is mounted, toggle visibility or focus
            console.log(`Focusing panel: ${panelId}`);
        } else {
            // Mount the panel
            console.log(`Mounting panel: ${panelId}`);
            // In a real implementation, you'd dispatch mountPanel thunk
        }
    }

    // Render functions
    function renderPanels() {
        const state = appStore.getState();
        const allPanels = state.panels.panels || {};
        const mountedPanels = state.panels.mountedPanels || {};
        
        // Filter panels by current tag and search term
        const filteredPanels = Object.values(allPanels).filter(panel => {
            // Tag filter
            if (!panel.tags || !panel.tags.includes(currentTag)) {
                return false;
            }
            
            // Search filter
            if (searchTerm && !panel.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            
            return true;
        });

        // Render panel items
        panelList.innerHTML = filteredPanels.map(panel => {
            const isMounted = mountedPanels[panel.id];
            const tags = (panel.tags || []).map(tag => 
                `<span class="panel-tag">${tag}</span>`
            ).join('');
            
            return `
                <div class="panel-item ${isMounted ? 'mounted' : ''}" data-panel-id="${panel.id}">
                    <div class="panel-name">${panel.name || panel.id}</div>
                    <div class="panel-description">${panel.description || ''}</div>
                    <div class="panel-tags">${tags}</div>
                </div>
            `;
        }).join('');

        // Add click handlers to panel items
        panelList.querySelectorAll('.panel-item').forEach(item => {
            item.addEventListener('click', () => {
                const panelId = item.dataset.panelId;
                handlePanelClick(panelId);
            });
        });
    }

    // Resize functionality
    let isResizing = false;
    let startX = 0;
    let startWidth = 300;

    function handleResizeStart(event) {
        isResizing = true;
        startX = event.clientX;
        startWidth = sidebar.offsetWidth;
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
        event.preventDefault();
    }

    function handleResizeMove(event) {
        if (!isResizing) return;
        
        const deltaX = event.clientX - startX;
        const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));
        
        sidebar.style.width = `${newWidth}px`;
        appStore.dispatch(setSidebarWidth(newWidth));
    }

    function handleResizeEnd() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
    }

    // Event listeners
    tabButtons.forEach(button => {
        button.addEventListener('click', handleTabClick);
    });
    
    toggleButton.addEventListener('click', handleToggle);
    searchInput.addEventListener('input', handleSearch);
    resizeHandle.addEventListener('mousedown', handleResizeStart);

    // Subscribe to Redux store changes
    appStore.subscribe(() => {
        renderPanels();
    });

    // Initial render
    renderPanels();

    return {
        element: sidebar,
        destroy: () => {
            document.head.removeChild(style);
            sidebar.remove();
        }
    };
}
