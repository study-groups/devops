#!/usr/bin/env node
/**
 * Enhanced CLI Panel Testing Tool
 * Tests panel lifecycle, state management, and YAML configuration integration
 */
import { fileURLToPath } from 'url';
import { panelConfig as panelsConfig } from '../../client/config/PanelConfigLoader.js';

const __filename = fileURLToPath(import.meta.url);

class EnhancedPanelTester {
    constructor() {
        this.testResults = [];
        this.mockReduxState = {
            panels: { panels: {} },
            ui: { sidebarPanels: {} }
        };
        this.mockPanelRegistry = new Map();
        this.renderCount = 0;
    }

    async runCommand(command, panelId, options = {}) {
        console.log(`\n🧪 Testing: ${command} ${panelId || ''}`);
        
        try {
            switch (command) {
                case 'create':
                    return await this.testCreatePanel(panelId);
                case 'show':
                    return await this.testShowPanel(panelId);
                case 'hide':
                    return await this.testHidePanel(panelId);
                case 'destroy':
                    return await this.testDestroyPanel(panelId);
                case 'list':
                    return await this.testListPanels();
                case 'validate-config':
                    return await this.testValidateConfig();
                case 'test-floating':
                    return await this.testFloatingPanel(panelId);
                case 'test-sidebar-integration':
                    return await this.testSidebarIntegration(panelId);
                case 'test-category-filtering':
                    return await this.testCategoryFiltering(options.category);
                case 'test-data-sources':
                    return await this.testDataSources(panelId);
                case 'test-performance':
                    return await this.testPerformance();
                case 'test-yaml-loading':
                    return await this.testYamlLoading();
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            console.error(`❌ Test failed: ${error.message}`);
            this.testResults.push({ command, panelId, status: 'failed', error: error.message });
            return false;
        }
    }

    async testCreatePanel(panelId) {
        const panelConfig = panelsConfig.panels[panelId];
        if (!panelConfig) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        // Validate required fields
        const validation = this.validatePanelConfig(panelConfig);
        if (!validation.valid) {
            throw new Error(`Invalid panel configuration: ${validation.errors.join(', ')}`);
        }

        // Simulate panel creation with enhanced properties
        const mockPanel = {
            id: panelId,
            title: panelConfig.title,
            type: panelId,
            visible: false,
            mounted: false,
            position: { x: 100, y: 100 },
            size: { width: 400, height: 300 },
            zIndex: 1000,
            config: panelConfig,
            // Enhanced properties
            category: panelConfig.category,
            dataSourcesConnected: false,
            renderCount: 0,
            lastUpdate: Date.now()
        };

        this.mockReduxState.panels.panels[panelId] = mockPanel;
        this.mockPanelRegistry.set(panelId, mockPanel);
        
        // Initialize sidebar state if it's a sidebar panel
        if (panelConfig.sidebar) {
            this.mockReduxState.ui.sidebarPanels[panelId] = {
                expanded: panelConfig.default_expanded || false
            };
        }
        
        console.log(`✅ Panel created: ${panelConfig.title}`);
        console.log(`   Category: ${panelConfig.category}`);
        console.log(`   Sidebar: ${panelConfig.sidebar ? 'Yes' : 'No'}`);
        console.log(`   Floating: ${panelConfig.floating ? 'Yes' : 'No'}`);
        console.log(`   Content Type: ${panelConfig.content_type}`);
        console.log(`   Data Sources: ${panelConfig.data_sources?.join(', ') || 'None'}`);
        
        this.testResults.push({ command: 'create', panelId, status: 'passed' });
        return true;
    }

    async testShowPanel(panelId) {
        const panel = this.mockReduxState.panels.panels[panelId];
        if (!panel) {
            throw new Error(`Panel ${panelId} not created yet`);
        }

        panel.visible = true;
        panel.mounted = true;
        panel.renderCount++;
        this.renderCount++;
        
        // Simulate data source connection
        if (panel.config.data_sources) {
            panel.dataSourcesConnected = true;
            console.log(`   📡 Connected to data sources: ${panel.config.data_sources.join(', ')}`);
        }
        
        console.log(`✅ Panel shown: ${panel.title}`);
        console.log(`   Visible: ${panel.visible}`);
        console.log(`   Mounted: ${panel.mounted}`);
        console.log(`   Render count: ${panel.renderCount}`);
        
        this.testResults.push({ command: 'show', panelId, status: 'passed' });
        return true;
    }

    async testHidePanel(panelId) {
        const panel = this.mockReduxState.panels.panels[panelId];
        if (!panel) {
            throw new Error(`Panel ${panelId} not created yet`);
        }

        panel.visible = false;
        
        console.log(`✅ Panel hidden: ${panel.title}`);
        console.log(`   Visible: ${panel.visible}`);
        
        this.testResults.push({ command: 'hide', panelId, status: 'passed' });
        return true;
    }

    async testDestroyPanel(panelId) {
        const panel = this.mockReduxState.panels.panels[panelId];
        if (!panel) {
            throw new Error(`Panel ${panelId} not created yet`);
        }

        delete this.mockReduxState.panels.panels[panelId];
        delete this.mockReduxState.ui.sidebarPanels[panelId];
        this.mockPanelRegistry.delete(panelId);
        
        console.log(`✅ Panel destroyed: ${panelId}`);
        console.log(`   Registry size: ${this.mockPanelRegistry.size}`);
        
        this.testResults.push({ command: 'destroy', panelId, status: 'passed' });
        return true;
    }

    async testListPanels() {
        const panels = Object.values(this.mockReduxState.panels.panels);
        const sidebarPanels = Object.keys(this.mockReduxState.ui.sidebarPanels);
        
        console.log(`✅ Panel inventory:`);
        console.log(`   Active panels: ${panels.length}`);
        console.log(`   Sidebar panels: ${sidebarPanels.length}`);
        console.log(`   Registry size: ${this.mockPanelRegistry.size}`);
        
        panels.forEach(panel => {
            const sidebarState = this.mockReduxState.ui.sidebarPanels[panel.id];
            console.log(`   - ${panel.title} (${panel.id}): ${panel.visible ? 'visible' : 'hidden'}${sidebarState ? `, sidebar: ${sidebarState.expanded ? 'expanded' : 'collapsed'}` : ''}`);
        });
        
        this.testResults.push({ command: 'list', status: 'passed' });
        return true;
    }

    async testFloatingPanel(panelId) {
        const panelConfig = panelsConfig.panels[panelId];
        if (!panelConfig) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        if (!panelConfig.floating) {
            throw new Error(`Panel ${panelId} is not configured as floating`);
        }

        // Test floating panel specific features
        await this.testCreatePanel(panelId);
        const panel = this.mockReduxState.panels.panels[panelId];
        
        // Test positioning
        panel.position = { x: 200, y: 150 };
        panel.size = { width: 500, height: 400 };
        panel.zIndex = 1001;
        
        console.log(`✅ Floating panel tested: ${panel.title}`);
        console.log(`   Position: (${panel.position.x}, ${panel.position.y})`);
        console.log(`   Size: ${panel.size.width}x${panel.size.height}`);
        console.log(`   Z-Index: ${panel.zIndex}`);
        
        this.testResults.push({ command: 'test-floating', panelId, status: 'passed' });
        return true;
    }

    async testSidebarIntegration(panelId) {
        const panelConfig = panelsConfig.panels[panelId];
        if (!panelConfig) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        if (!panelConfig.sidebar) {
            throw new Error(`Panel ${panelId} is not configured for sidebar`);
        }

        await this.testCreatePanel(panelId);
        
        // Test sidebar state management
        const sidebarState = this.mockReduxState.ui.sidebarPanels[panelId];
        if (!sidebarState) {
            throw new Error(`Sidebar state not initialized for ${panelId}`);
        }

        // Test expand/collapse
        sidebarState.expanded = true;
        console.log(`   Expanded: ${sidebarState.expanded}`);
        
        sidebarState.expanded = false;
        console.log(`   Collapsed: ${sidebarState.expanded}`);
        
        console.log(`✅ Sidebar integration tested: ${panelConfig.title}`);
        console.log(`   Default expanded: ${panelConfig.default_expanded}`);
        
        this.testResults.push({ command: 'test-sidebar-integration', panelId, status: 'passed' });
        return true;
    }

    async testCategoryFiltering(category) {
        const categoryPanels = Object.entries(panelsConfig.panels)
            .filter(([, config]) => config.category === category);
        
        if (categoryPanels.length === 0) {
            throw new Error(`No panels found for category: ${category}`);
        }

        console.log(`✅ Category filtering tested: ${category}`);
        console.log(`   Panels in category: ${categoryPanels.length}`);
        
        categoryPanels.forEach(([panelId, config]) => {
            console.log(`   - ${config.title} (${panelId})`);
        });
        
        this.testResults.push({ command: 'test-category-filtering', status: 'passed' });
        return true;
    }

    async testDataSources(panelId) {
        const panelConfig = panelsConfig.panels[panelId];
        if (!panelConfig) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        const dataSources = panelConfig.data_sources || [];
        if (dataSources.length === 0) {
            console.log(`⚠️  Panel ${panelId} has no data sources configured`);
        }

        console.log(`✅ Data sources tested: ${panelConfig.title}`);
        console.log(`   Data sources: ${dataSources.length}`);
        
        dataSources.forEach(source => {
            console.log(`   - ${source}: ${this.mockDataSourceConnection(source) ? 'connected' : 'disconnected'}`);
        });
        
        this.testResults.push({ command: 'test-data-sources', panelId, status: 'passed' });
        return true;
    }

    async testPerformance() {
        const startTime = Date.now();
        
        // Create multiple panels
        const panelIds = Object.keys(panelsConfig.panels);
        for (const panelId of panelIds) {
            await this.testCreatePanel(panelId);
            await this.testShowPanel(panelId);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Performance test completed:`);
        console.log(`   Panels created: ${panelIds.length}`);
        console.log(`   Total time: ${duration}ms`);
        console.log(`   Average time per panel: ${Math.round(duration / panelIds.length)}ms`);
        console.log(`   Total renders: ${this.renderCount}`);
        
        // Performance thresholds
        const avgTimePerPanel = duration / panelIds.length;
        if (avgTimePerPanel > 100) {
            console.warn(`⚠️  Performance warning: Average time per panel (${avgTimePerPanel}ms) exceeds threshold (100ms)`);
        }
        
        this.testResults.push({ command: 'test-performance', status: 'passed' });
        return true;
    }

    async testYamlLoading() {
        // Test YAML configuration loading and parsing
        const requiredSections = ['panels', 'test_scenarios', 'categories'];
        
        for (const section of requiredSections) {
            if (!panelsConfig[section]) {
                throw new Error(`Missing required YAML section: ${section}`);
            }
        }

        console.log(`✅ YAML configuration loaded successfully:`);
        console.log(`   Panels: ${Object.keys(panelsConfig.panels).length}`);
        console.log(`   Test scenarios: ${Object.keys(panelsConfig.test_scenarios).length}`);
        console.log(`   Categories: ${Object.keys(panelsConfig.categories).length}`);
        
        this.testResults.push({ command: 'test-yaml-loading', status: 'passed' });
        return true;
    }

    validatePanelConfig(config) {
        const errors = [];
        const warnings = [];

        const requiredFields = ['title', 'category'];
        for (const field of requiredFields) {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        const validCategories = Object.keys(panelsConfig.categories || {});
        if (config.category && !validCategories.includes(config.category)) {
            warnings.push(`Unknown category: ${config.category}`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    async testValidateConfig() {
        let valid = true;
        let totalWarnings = 0;
        
        for (const [panelId, config] of Object.entries(panelsConfig.panels)) {
            const validation = this.validatePanelConfig(config);
            
            if (!validation.valid) {
                console.error(`❌ Panel ${panelId}: ${validation.errors.join(', ')}`);
                valid = false;
            }
            
            if (validation.warnings.length > 0) {
                console.warn(`⚠️  Panel ${panelId}: ${validation.warnings.join(', ')}`);
                totalWarnings += validation.warnings.length;
            }
        }
        
        if (valid) {
            console.log(`✅ All ${Object.keys(panelsConfig.panels).length} panel configurations are valid`);
            if (totalWarnings > 0) {
                console.log(`   ${totalWarnings} warnings found`);
            }
        }
        
        this.testResults.push({ command: 'validate-config', status: valid ? 'passed' : 'failed' });
        return valid;
    }

    mockDataSourceConnection(source) {
        // Mock data source connections
        const mockConnections = {
            'redux_state': true,
            'system_metrics': true,
            'action_history': true,
            'css_variables': true,
            'theme_config': true,
            'file_system': false // Simulate disconnected source
        };
        
        return mockConnections[source] !== false;
    }

    printSummary() {
        console.log('\n📊 Enhanced Panel Test Summary:');
        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        
        console.log(`   Passed: ${passed}`);
        console.log(`   Failed: ${failed}`);
        console.log(`   Total: ${this.testResults.length}`);
        console.log(`   Success rate: ${Math.round((passed / this.testResults.length) * 100)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed tests:');
            this.testResults
                .filter(r => r.status === 'failed')
                .forEach(r => console.log(`   - ${r.command} ${r.panelId || ''}: ${r.error}`));
        }

        // Performance metrics
        console.log(`\n📈 Performance Metrics:`);
        console.log(`   Total renders: ${this.renderCount}`);
        console.log(`   Registry size: ${this.mockPanelRegistry.size}`);
    }

    getTestScenarios() {
        const scenarioNames = Object.keys(panelsConfig.test_scenarios || {});
        console.log(scenarioNames.join(' '));
    }
}

// CLI Interface
async function main() {
    const [,, command, panelId, ...options] = process.argv;
    
    if (!command) {
        console.log('Usage: node panel-test.js <command> [panelId] [options]');
        console.log('Commands:');
        console.log('  create, show, hide, destroy, list, validate-config');
        console.log('  test-floating, test-sidebar-integration, test-category-filtering');
        console.log('  test-data-sources, test-performance, test-yaml-loading');
        console.log('  run-all, run-enhanced');
        console.log('Available panels:', Object.keys(panelsConfig.panels).join(', '));
        process.exit(1);
    }

    const tester = new EnhancedPanelTester();
    
    if (command === 'run-all') {
        // Run basic test suite
        console.log('🚀 Running basic panel test suite...');
        
        await tester.runCommand('test-yaml-loading');
        await tester.runCommand('validate-config');
        await tester.runCommand('create', 'system-diagnostics');
        await tester.runCommand('create', 'redux-inspector');
        await tester.runCommand('show', 'system-diagnostics');
        await tester.runCommand('list');
        await tester.runCommand('hide', 'system-diagnostics');
        await tester.runCommand('destroy', 'system-diagnostics');
        await tester.runCommand('list');
        
        tester.printSummary();
    } else if (command === 'run-enhanced') {
        // Run enhanced test suite
        console.log('🚀 Running enhanced panel test suite...');
        
        await tester.runCommand('test-yaml-loading');
        await tester.runCommand('validate-config');
        await tester.runCommand('test-category-filtering', null, { category: 'debug' });
        await tester.runCommand('test-floating', 'system-diagnostics');
        await tester.runCommand('test-sidebar-integration', 'redux-inspector');
        await tester.runCommand('test-data-sources', 'system-diagnostics');
        await tester.runCommand('test-performance');
        
        tester.printSummary();
    } else {
        const opts = {};
        if (options.includes('--category')) {
            const categoryIndex = options.indexOf('--category');
            opts.category = options[categoryIndex + 1];
        }
        
        await tester.runCommand(command, panelId, opts);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { EnhancedPanelTester };
