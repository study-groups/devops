/**
 * PanelConfigLoader.js - In-code panel configuration
 *
 * This file is the single source of truth for all panel definitions.
 * It directly exports the configuration object, eliminating the need for
 * external files like YAML and removing any asynchronous loading.
 */

const panelConfig = {
    panels: {
        'system-diagnostics': {
            title: 'System Diagnostics',
            description: 'System status and health monitoring',
            category: 'dev',
            sidebar: true,
            floating: true,
            default_expanded: false,
            content_type: 'dynamic',
            data_sources: ['redux_state', 'system_metrics']
        },
        'ui-inspector': {
            title: 'UI Inspector',
            description: 'Component and Redux state inspection',
            category: 'dev',
            sidebar: true,
            floating: true,
            default_expanded: false,
            content_type: 'dynamic',
            data_sources: ['redux_state', 'component_tree']
        },
        'file-browser': {
            title: 'Files',
            description: 'Compact file navigator',
            category: 'dev',
            sidebar: true,
            floating: true,
            default_expanded: false,
            content_type: 'tree',
            data_sources: ['file_system']
        },
        'design-tokens': {
            title: 'Design Tokens',
            description: 'Design system tokens and theming',
            category: 'settings',
            sidebar: true,
            floating: false,
            default_expanded: false,
            content_type: 'interactive',
            data_sources: ['css_variables', 'theme_config']
        },
        'theme-editor': {
            title: 'Theme Editor',
            description: 'Live theme customization',
            category: 'settings',
            sidebar: true,
            floating: true,
            default_expanded: false,
            content_type: 'form',
            data_sources: ['theme_config', 'css_variables']
        },
        'publish-manager': {
            title: 'Publish Manager',
            description: 'Deploy and publish content',
            category: 'publish',
            sidebar: true,
            floating: true,
            default_expanded: false,
            content_type: 'form',
            data_sources: ['deployment_config', 'publish_history']
        }
    },
    test_scenarios: {
        basic_panel_lifecycle: {
            description: 'Test panel creation, show, hide, destroy',
            commands: [
                'node test/cli/panel-test.js create system-diagnostics',
                'node test/cli/panel-test.js show system-diagnostics',
                'node test/cli/panel-test.js hide system-diagnostics',
                'node test/cli/panel-test.js destroy system-diagnostics'
            ]
        },
        sidebar_state_persistence: {
            description: 'Test sidebar panel state persistence',
            commands: [
                'node test/cli/sidebar-test.js expand ui-inspector',
                'node test/cli/sidebar-test.js verify-state ui-inspector expanded',
                'node test/cli/sidebar-test.js collapse ui-inspector',
                'node test/cli/sidebar-test.js verify-state ui-inspector collapsed'
            ]
        }
    },
    categories: {
        dev: {
            color: '#ff6b6b',
            icon: '🔧',
            description: 'Development and debugging tools'
        },
        settings: {
            color: '#4ecdc4',
            icon: '⚙️',
            description: 'Configuration and system settings'
        },
        publish: {
            color: '#45b7d1',
            icon: '🚀',
            description: 'Publishing and deployment tools'
        }
    }
};

class PanelConfigLoader {
    constructor() {
        this.config = panelConfig;
    }

    async loadConfig() {
        return this.config;
    }

    async getPanels(filters = {}) {
        let panels = { ...this.config.panels };

        if (filters.sidebar !== undefined) {
            panels = Object.fromEntries(
                Object.entries(panels).filter(([, panel]) =>
                    panel.sidebar === filters.sidebar
                )
            );
        }

        if (filters.category) {
            panels = Object.fromEntries(
                Object.entries(panels).filter(([, panel]) =>
                    panel.category === filters.category
                )
            );
        }

        if (filters.floating !== undefined) {
            panels = Object.fromEntries(
                Object.entries(panels).filter(([, panel]) =>
                    panel.floating === filters.floating
                )
            );
        }

        return panels;
    }

    async getSidebarPanels() {
        return this.getPanels({ sidebar: true });
    }

    async getTestScenarios() {
        return this.config.test_scenarios || {};
    }

    async getCategories() {
        return this.config.categories || {};
    }

    async getPanel(panelId) {
        return this.config.panels?.[panelId] || null;
    }

    validatePanelConfig(panelConfigToValidate) {
        const errors = [];
        const warnings = [];

        const requiredFields = ['title', 'category'];
        for (const field of requiredFields) {
            if (!panelConfigToValidate[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        const validCategories = ['dev', 'settings', 'publish'];
        if (panelConfigToValidate.category && !validCategories.includes(panelConfigToValidate.category)) {
            warnings.push(`Unknown category: ${panelConfigToValidate.category}`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    clearCache() {
        // No-op, as there is no cache to clear
    }
}

export const panelConfigLoader = new PanelConfigLoader();
export { PanelConfigLoader, panelConfig };

export async function loadPanelConfig() {
    return panelConfigLoader.loadConfig();
}
