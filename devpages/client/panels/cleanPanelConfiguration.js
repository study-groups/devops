/**
 * client/panels/cleanPanelConfiguration.js
 * CLEAN, MINIMAL panel configuration that only includes panels that actually exist
 * Building with confidence - no more 404 errors!
 */

// =================================================================
// CLEAN PANEL CONFIGURATION - ONLY WORKING PANELS
// =================================================================

export const CLEAN_PANEL_CONFIGURATION = {
    // =================================================================
    // SETTINGS DOCK PANELS (WORKING PANELS ONLY)
    // =================================================================
    
    'design-tokens': {
        id: 'design-tokens',
        title: 'Design Tokens',
        group: 'settings',
        component: () => import('/client/settings/panels/css-design/DesignTokensPanel.js').then(m => m.DesignTokensPanel),
        order: 1,
        defaultCollapsed: false,
        icon: '🎨',
        description: 'Manage CSS design tokens and variables',
        keywords: ['css', 'tokens', 'variables', 'design'],
        metadata: {
            category: 'styling',
            features: ['design-tokens', 'css-variables', 'theming'],
            dependencies: ['appStore']
        }
    },

    'theme-selector': {
        id: 'theme-selector',
        title: 'Theme Selector',
        group: 'settings',
        component: () => import('/client/settings/panels/themes/ThemeSelectorPanel.js').then(m => m.ThemeSelectorPanel),
        order: 2,
        defaultCollapsed: false,
        icon: '🌙',
        description: 'Switch between light/dark themes and custom themes',
        keywords: ['theme', 'dark', 'light', 'appearance'],
        metadata: {
            category: 'appearance',
            features: ['theme-switching', 'dark-mode', 'light-mode'],
            dependencies: ['appStore', 'panelRegistry']
        }
    },

    // =================================================================
    // PLACEHOLDER PANELS (Simple HTML panels that work immediately)
    // =================================================================
    
    'workspace-info': {
        id: 'workspace-info',
        title: 'Workspace Info',
        group: 'settings',
        component: () => Promise.resolve({
            WorkspaceInfoPanel: class {
                constructor(container) {
                    container.innerHTML = `
                        <div class="panel-content">
                            <h4>🏗️ Workspace Information</h4>
                            <p><strong>Architecture:</strong> Clean Sidebar Dock Manager</p>
                            <p><strong>Version:</strong> 2.0</p>
                            <p><strong>Status:</strong> ✅ Working</p>
                            <div class="workspace-stats">
                                <div><strong>Zones:</strong> sidebar, editor, preview</div>
                                <div><strong>Docks:</strong> settings-dock</div>
                                <div><strong>API:</strong> window.APP.sidebar</div>
                            </div>
                        </div>
                    `;
                }
                destroy() {}
            }
        }).then(m => m.WorkspaceInfoPanel),
        order: 3,
        defaultCollapsed: true,
        icon: 'ℹ️',
        description: 'System information and architecture details',
        keywords: ['workspace', 'info', 'system', 'architecture']
    },

    'quick-actions': {
        id: 'quick-actions',
        title: 'Quick Actions',
        group: 'settings',
        component: () => Promise.resolve({
            QuickActionsPanel: class {
                constructor(container) {
                    container.innerHTML = `
                        <div class="panel-content">
                            <h4>⚡ Quick Actions</h4>
                            <div class="action-buttons">
                                <button onclick="window.APP.sidebar.listDocks()" class="action-btn">
                                    📋 List Docks
                                </button>
                                <button onclick="window.APP.sidebar.getSystemInfo()" class="action-btn">
                                    📊 System Info
                                </button>
                                <button onclick="console.clear()" class="action-btn">
                                    🧹 Clear Console
                                </button>
                                <button onclick="window.APP.sidebar.toggleDock('settings-dock')" class="action-btn">
                                    🔄 Toggle Settings
                                </button>
                            </div>
                        </div>
                    `;
                }
                destroy() {}
            }
        }).then(m => m.QuickActionsPanel),
        order: 4,
        defaultCollapsed: true,
        icon: '⚡',
        description: 'Quick actions and debugging tools',
        keywords: ['actions', 'debug', 'tools', 'quick']
    }
};

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

/**
 * Get all panels for a specific group
 */
export function getCleanPanelsByGroup(group) {
    return Object.values(CLEAN_PANEL_CONFIGURATION)
        .filter(panel => panel.group === group)
        .sort((a, b) => a.order - b.order);
}

/**
 * Get all available groups
 */
export function getCleanGroups() {
    const groups = new Set();
    Object.values(CLEAN_PANEL_CONFIGURATION).forEach(panel => {
        groups.add(panel.group);
    });
    return Array.from(groups);
}

/**
 * Search panels by title, description, or keywords
 */
export function searchCleanPanels(query) {
    const searchTerm = query.toLowerCase();
    return Object.values(CLEAN_PANEL_CONFIGURATION).filter(panel => {
        return panel.title.toLowerCase().includes(searchTerm) ||
               panel.description.toLowerCase().includes(searchTerm) ||
               panel.keywords.some(keyword => keyword.includes(searchTerm));
    });
}

/**
 * Register all working panels with the panel registry
 */
export async function registerWorkingPanels(panelRegistry) {
    const panelIds = Object.keys(CLEAN_PANEL_CONFIGURATION);
    let successCount = 0;
    
    console.log(`[CleanPanelConfiguration] Registering ${panelIds.length} WORKING panels...`);
    
    for (const [panelId, config] of Object.entries(CLEAN_PANEL_CONFIGURATION)) {
        try {
            // Load the component
            const component = await config.component();
            
            // Create registration config for panelRegistry
            const registrationConfig = {
                ...config,
                component: component
            };
            
            panelRegistry.register(registrationConfig);
            successCount++;
            
            console.log(`[CleanPanelConfiguration] ✅ Registered panel: ${panelId} (${config.group})`);
        } catch (error) {
            console.error(`[CleanPanelConfiguration] ❌ Failed to register panel ${panelId}:`, error);
        }
    }
    
    console.log(`[CleanPanelConfiguration] SUCCESS: ${successCount}/${panelIds.length} panels registered`);
    return successCount;
}

// Add some basic CSS for our placeholder panels
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        .panel-content {
            padding: 16px;
            line-height: 1.5;
        }
        
        .workspace-stats {
            margin-top: 12px;
            padding: 8px;
            background: var(--color-bg-alt, #f5f5f5);
            border-radius: 4px;
            font-size: 0.9em;
        }
        
        .workspace-stats div {
            margin: 4px 0;
        }
        
        .action-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
        }
        
        .action-btn {
            padding: 6px 12px;
            border: 1px solid var(--color-border, #ddd);
            background: var(--color-bg, white);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
            transition: background-color 0.2s;
        }
        
        .action-btn:hover {
            background: var(--color-bg-alt, #f5f5f5);
        }
    `;
    document.head.appendChild(style);
}