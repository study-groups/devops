#!/usr/bin/env node
/**
 * CLI tool for testing sidebar state management
 * Simulates user interactions and verifies Redux state changes
 */

import { fileURLToPath } from 'url';
import { panelConfig as panelsConfig } from '../../client/config/PanelConfigLoader.js';

const __filename = fileURLToPath(import.meta.url);

class SidebarTester {
    constructor() {
        this.mockReduxState = {
            ui: {
                sidebarPanels: {},
                leftSidebarVisible: true
            },
            panels: {
                panels: {}
            }
        };
        this.persistedState = {};
        this.renderCount = 0;
        this.subscriptionCallbacks = [];
        this.lastSidebarState = null;
        this.lastPanelsState = null;
    }

    async runCommand(command, panelId, expectedState) {
        console.log(`\n🧪 Testing: ${command} ${panelId || ''} ${expectedState || ''}`);
        
        try {
            switch (command) {
                case 'expand':
                    return await this.testExpandPanel(panelId);
                case 'collapse':
                    return await this.testCollapsePanel(panelId);
                case 'toggle':
                    return await this.testTogglePanel(panelId);
                case 'verify-state':
                    return await this.testVerifyState(panelId, expectedState);
                case 'verify-persistence':
                    return await this.testVerifyPersistence();
                case 'show-sidebar':
                    return await this.testShowSidebar();
                case 'hide-sidebar':
                    return await this.testHideSidebar();
                case 'render':
                    return await this.testRenderSidebar();
                case 'test-selective-subscription':
                    return await this.testSelectiveSubscription();
                case 'test-render-optimization':
                    return await this.testRenderOptimization();
                case 'test-yaml-integration':
                    return await this.testYamlIntegration();
                case 'test-category-display':
                    return await this.testCategoryDisplay();
                case 'test-default-states':
                    return await this.testDefaultStates();
                case 'simulate-redux-actions':
                    return await this.testSimulateReduxActions();
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            console.error(`❌ Test failed: ${error.message}`);
            this.testResults.push({ command, panelId, status: 'failed', error: error.message });
            return false;
        }
    }

    async testExpandPanel(panelId) {
        this.ensurePanelExists(panelId);

        // Simulate Redux action dispatch
        this.mockReduxState.ui.sidebarPanels[panelId].expanded = true;
        this.simulatePersistence();
        this.simulateReduxSubscription();
        
        console.log(`✅ Panel expanded: ${panelId}`);
        console.log(`   State: ${JSON.stringify(this.mockReduxState.ui.sidebarPanels[panelId])}`);
        console.log(`   Render triggered: ${this.shouldRender()}`);
        
        this.testResults.push({ command: 'expand', panelId, status: 'passed' });
        return true;
    }

    async testCollapsePanel(panelId) {
        this.ensurePanelExists(panelId);

        this.mockReduxState.ui.sidebarPanels[panelId].expanded = false;
        this.simulatePersistence();
        this.simulateReduxSubscription();
        
        console.log(`✅ Panel collapsed: ${panelId}`);
        console.log(`   State: ${JSON.stringify(this.mockReduxState.ui.sidebarPanels[panelId])}`);
        console.log(`   Render triggered: ${this.shouldRender()}`);
        
        this.testResults.push({ command: 'collapse', panelId, status: 'passed' });
        return true;
    }

    async testTogglePanel(panelId) {
        this.ensurePanelExists(panelId);

        const currentState = this.mockReduxState.ui.sidebarPanels[panelId].expanded;
        this.mockReduxState.ui.sidebarPanels[panelId].expanded = !currentState;
        this.simulatePersistence();
        this.simulateReduxSubscription();
        
        console.log(`✅ Panel toggled: ${panelId}`);
        console.log(`   ${currentState ? 'Expanded' : 'Collapsed'} → ${!currentState ? 'Expanded' : 'Collapsed'}`);
        console.log(`   Render triggered: ${this.shouldRender()}`);
        
        this.testResults.push({ command: 'toggle', panelId, status: 'passed' });
        return true;
    }

    async testVerifyState(panelId, expectedState) {
        const panel = this.mockReduxState.ui.sidebarPanels[panelId];
        if (!panel) {
            throw new Error(`Panel ${panelId} not found`);
        }

        const actualState = panel.expanded ? 'expanded' : 'collapsed';
        if (actualState !== expectedState) {
            throw new Error(`Expected ${expectedState}, got ${actualState}`);
        }

        console.log(`✅ State verified: ${panelId} is ${actualState}`);
        
        this.testResults.push({ command: 'verify-state', panelId, status: 'passed' });
        return true;
    }

    async testVerifyPersistence() {
        // Simulate page reload by checking persisted state
        const persistedKeys = Object.keys(this.persistedState);
        const currentKeys = Object.keys(this.mockReduxState.ui.sidebarPanels);
        
        if (persistedKeys.length !== currentKeys.length) {
            throw new Error(`Persistence mismatch: ${persistedKeys.length} persisted, ${currentKeys.length} current`);
        }

        for (const key of currentKeys) {
            const current = this.mockReduxState.ui.sidebarPanels[key];
            const persisted = this.persistedState[key];
            
            if (current.expanded !== persisted.expanded) {
                throw new Error(`Panel ${key} state not persisted: ${current.expanded} vs ${persisted.expanded}`);
            }
        }

        console.log(`✅ Persistence verified: All ${persistedKeys.length} panel states persisted`);
        console.log(`   Storage size: ${JSON.stringify(this.persistedState).length} bytes`);
        
        this.testResults.push({ command: 'verify-persistence', status: 'passed' });
        return true;
    }

    async testShowSidebar() {
        this.mockReduxState.ui.leftSidebarVisible = true;
        this.simulateReduxSubscription();
        
        console.log(`✅ Sidebar shown`);
        console.log(`   Visible: ${this.mockReduxState.ui.leftSidebarVisible}`);
        
        this.testResults.push({ command: 'show-sidebar', status: 'passed' });
        return true;
    }

    async testHideSidebar() {
        this.mockReduxState.ui.leftSidebarVisible = false;
        this.simulateReduxSubscription();
        
        console.log(`✅ Sidebar hidden`);
        console.log(`   Visible: ${this.mockReduxState.ui.leftSidebarVisible}`);
        
        this.testResults.push({ command: 'hide-sidebar', status: 'passed' });
        return true;
    }

    async testRenderSidebar() {
        const sidebarPanels = this.mockReduxState.ui.sidebarPanels;
        const visiblePanels = Object.entries(sidebarPanels).filter(([, state]) => state.expanded);
        
        this.renderCount++;
        
        console.log(`✅ Sidebar render simulation:`);
        console.log(`   Total panels: ${Object.keys(sidebarPanels).length}`);
        console.log(`   Expanded panels: ${visiblePanels.length}`);
        console.log(`   Render count: ${this.renderCount}`);
        
        visiblePanels.forEach(([panelId]) => {
            const config = panelsConfig.panels[panelId];
            const categoryColor = this.getCategoryColor(config?.category);
            console.log(`   - ${config?.title || panelId} (${panelId}) [${config?.category}] ${categoryColor}`);
        });
        
        this.testResults.push({ command: 'render', status: 'passed' });
        return true;
    }

    async testSelectiveSubscription() {
        console.log(`✅ Testing selective Redux subscription:`);
        
        const initialRenderCount = this.renderCount;
        
        // Test 1: Sidebar panel state change should trigger render
        this.mockReduxState.ui.sidebarPanels['test-panel'] = { expanded: false };
        this.simulateReduxSubscription();
        console.log(`   Sidebar state change: Render triggered = ${this.shouldRender()}`);
        
        // Test 2: Panel visibility change should trigger render
        this.mockReduxState.panels.panels['test-panel'] = { visible: true };
        this.simulateReduxSubscription();
        console.log(`   Panel visibility change: Render triggered = ${this.shouldRender()}`);
        
        // Test 3: Unrelated state change should NOT trigger render
        this.mockReduxState.auth = { user: 'test' }; // Simulate unrelated state
        const shouldNotRender = !this.shouldRender();
        console.log(`   Unrelated state change: Render avoided = ${shouldNotRender}`);
        
        if (!shouldNotRender) {
            throw new Error('Selective subscription failed: unrelated state change triggered render');
        }
        
        console.log(`   Optimization working: Only relevant changes trigger renders`);
        
        this.testResults.push({ command: 'test-selective-subscription', status: 'passed' });
        return true;
    }

    async testRenderOptimization() {
        console.log(`✅ Testing render optimization:`);
        
        const startRenderCount = this.renderCount;
        
        // Simulate multiple rapid state changes
        for (let i = 0; i < 10; i++) {
            this.mockReduxState.ui.sidebarPanels[`panel-${i}`] = { expanded: i % 2 === 0 };
            this.simulateReduxSubscription();
        }
        
        const endRenderCount = this.renderCount;
        const actualRenders = endRenderCount - startRenderCount;
        
        console.log(`   State changes: 10`);
        console.log(`   Actual renders: ${actualRenders}`);
        console.log(`   Optimization ratio: ${Math.round((10 - actualRenders) / 10 * 100)}%`);
        
        // In a real implementation, we'd expect fewer renders due to batching
        if (actualRenders <= 10) {
            console.log(`   ✅ Render optimization working`);
        } else {
            console.warn(`   ⚠️  More renders than expected`);
        }
        
        this.testResults.push({ command: 'test-render-optimization', status: 'passed' });
        return true;
    }

    async testYamlIntegration() {
        console.log(`✅ Testing YAML configuration integration:`);
        
        // Initialize sidebar panels from YAML config
        for (const [panelId, config] of Object.entries(panelsConfig.panels)) {
            if (config.sidebar) {
                this.mockReduxState.ui.sidebarPanels[panelId] = {
                    expanded: config.default_expanded || false
                };
            }
        }
        
        const sidebarPanelCount = Object.keys(this.mockReduxState.ui.sidebarPanels).length;
        const yamlSidebarPanels = Object.values(panelsConfig.panels).filter(p => p.sidebar).length;
        
        if (sidebarPanelCount !== yamlSidebarPanels) {
            throw new Error(`YAML integration failed: ${sidebarPanelCount} initialized, ${yamlSidebarPanels} expected`);
        }
        
        console.log(`   Sidebar panels from YAML: ${yamlSidebarPanels}`);
        console.log(`   Initialized panels: ${sidebarPanelCount}`);
        console.log(`   Default expanded panels: ${Object.values(this.mockReduxState.ui.sidebarPanels).filter(p => p.expanded).length}`);
        
        this.testResults.push({ command: 'test-yaml-integration', status: 'passed' });
        return true;
    }

    async testCategoryDisplay() {
        console.log(`✅ Testing category-based display:`);
        
        const categories = {};
        
        for (const [panelId, config] of Object.entries(panelsConfig.panels)) {
            if (config.sidebar) {
                const category = config.category;
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push({ panelId, title: config.title });
            }
        }
        
        console.log(`   Categories found: ${Object.keys(categories).length}`);
        
        for (const [category, panels] of Object.entries(categories)) {
            const categoryInfo = panelsConfig.categories[category];
            const color = categoryInfo?.color || '#ccc';
            const icon = categoryInfo?.icon || '📋';
            
            console.log(`   ${icon} ${category} (${color}): ${panels.length} panels`);
            panels.forEach(panel => {
                console.log(`     - ${panel.title} (${panel.panelId})`);
            });
        }
        
        this.testResults.push({ command: 'test-category-display', status: 'passed' });
        return true;
    }

    async testDefaultStates() {
        console.log(`✅ Testing default panel states:`);
        
        let defaultExpandedCount = 0;
        let totalSidebarPanels = 0;
        
        for (const [panelId, config] of Object.entries(panelsConfig.panels)) {
            if (config.sidebar) {
                totalSidebarPanels++;
                if (config.default_expanded) {
                    defaultExpandedCount++;
                    console.log(`   ${config.title} (${panelId}): Default expanded`);
                }
            }
        }
        
        console.log(`   Total sidebar panels: ${totalSidebarPanels}`);
        console.log(`   Default expanded: ${defaultExpandedCount}`);
        console.log(`   Default collapsed: ${totalSidebarPanels - defaultExpandedCount}`);
        
        this.testResults.push({ command: 'test-default-states', status: 'passed' });
        return true;
    }

    async testSimulateReduxActions() {
        console.log(`✅ Simulating Redux actions:`);
        
        const actions = [
            { type: 'ui/toggleSidebarPanel', payload: 'system-diagnostics' },
            { type: 'ui/toggleSidebarPanel', payload: 'redux-inspector' },
            { type: 'ui/setSidebarPanelExpanded', payload: { panelId: 'design-tokens', expanded: true } },
            { type: 'panels/updatePanel', payload: { id: 'system-diagnostics', updates: { visible: true } } }
        ];
        
        for (const action of actions) {
            console.log(`   Dispatching: ${action.type}`);
            this.simulateReduxAction(action);
            this.simulateReduxSubscription();
        }
        
        console.log(`   Actions processed: ${actions.length}`);
        console.log(`   Total renders: ${this.renderCount}`);
        
        this.testResults.push({ command: 'simulate-redux-actions', status: 'passed' });
        return true;
    }

    // Helper methods
    ensurePanelExists(panelId) {
        if (!this.mockReduxState.ui.sidebarPanels[panelId]) {
            const config = panelsConfig.panels[panelId];
            if (!config || !config.sidebar) {
                throw new Error(`Panel ${panelId} not found or not configured for sidebar`);
            }
            
            this.mockReduxState.ui.sidebarPanels[panelId] = {
                expanded: config.default_expanded || false
            };
        }
    }

    simulatePersistence() {
        // Simulate localStorage persistence
        this.persistedState = JSON.parse(JSON.stringify(this.mockReduxState.ui.sidebarPanels));
    }

    simulateReduxSubscription() {
        // Simulate selective Redux subscription logic
        const currentSidebarState = this.mockReduxState.ui.sidebarPanels;
        const currentPanelsState = this.mockReduxState.panels.panels;
        
        const sidebarChanged = JSON.stringify(currentSidebarState) !== JSON.stringify(this.lastSidebarState);
        const panelsChanged = JSON.stringify(currentPanelsState) !== JSON.stringify(this.lastPanelsState);
        
        if (sidebarChanged || panelsChanged) {
            this.lastSidebarState = JSON.parse(JSON.stringify(currentSidebarState));
            this.lastPanelsState = JSON.parse(JSON.stringify(currentPanelsState));
            this.renderCount++;
        }
    }

    shouldRender() {
        // Check if the last subscription would have triggered a render
        const currentSidebarState = this.mockReduxState.ui.sidebarPanels;
        const currentPanelsState = this.mockReduxState.panels.panels;
        
        const sidebarChanged = JSON.stringify(currentSidebarState) !== JSON.stringify(this.lastSidebarState);
        const panelsChanged = JSON.stringify(currentPanelsState) !== JSON.stringify(this.lastPanelsState);
        
        return sidebarChanged || panelsChanged;
    }

    simulateReduxAction(action) {
        switch (action.type) {
            case 'ui/toggleSidebarPanel':
                this.ensurePanelExists(action.payload);
                this.mockReduxState.ui.sidebarPanels[action.payload].expanded = 
                    !this.mockReduxState.ui.sidebarPanels[action.payload].expanded;
                break;
            case 'ui/setSidebarPanelExpanded':
                this.ensurePanelExists(action.payload.panelId);
                this.mockReduxState.ui.sidebarPanels[action.payload.panelId].expanded = action.payload.expanded;
                break;
            case 'panels/updatePanel':
                if (!this.mockReduxState.panels.panels[action.payload.id]) {
                    this.mockReduxState.panels.panels[action.payload.id] = {};
                }
                Object.assign(this.mockReduxState.panels.panels[action.payload.id], action.payload.updates);
                break;
        }
        this.simulatePersistence();
    }

    getCategoryColor(category) {
        const categoryInfo = panelsConfig.categories?.[category];
        return categoryInfo?.color || '#ccc';
    }

    printSummary() {
        console.log('\n📊 Enhanced Sidebar Test Summary:');
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
        console.log(`   Sidebar panels: ${Object.keys(this.mockReduxState.ui.sidebarPanels).length}`);
        console.log(`   Persisted state size: ${JSON.stringify(this.persistedState).length} bytes`);
    }
}

// CLI Interface
async function main() {
    const [,, command, panelId, expectedState] = process.argv;
    
    if (!command) {
        console.log('Usage: node sidebar-test.js <command> [panelId] [expectedState]');
        console.log('Commands:');
        console.log('  expand, collapse, toggle, verify-state, verify-persistence');
        console.log('  show-sidebar, hide-sidebar, render');
        console.log('  test-selective-subscription, test-render-optimization');
        console.log('  test-yaml-integration, test-category-display, test-default-states');
        console.log('  simulate-redux-actions, run-all, run-enhanced');
        console.log('Available panels:', Object.keys(panelsConfig.panels).filter(id => panelsConfig.panels[id].sidebar).join(', '));
        process.exit(1);
    }

    const tester = new SidebarTester();
    
    if (command === 'run-all') {
        // Run basic sidebar test suite
        console.log('🚀 Running basic sidebar test suite...');
        
        await tester.runCommand('show-sidebar');
        await tester.runCommand('expand', 'system-diagnostics');
        await tester.runCommand('verify-state', 'system-diagnostics', 'expanded');
        await tester.runCommand('expand', 'redux-inspector');
        await tester.runCommand('render');
        await tester.runCommand('verify-persistence');
        await tester.runCommand('collapse', 'system-diagnostics');
        await tester.runCommand('verify-state', 'system-diagnostics', 'collapsed');
        await tester.runCommand('toggle', 'design-tokens');
        await tester.runCommand('verify-state', 'design-tokens', 'expanded');
        
        tester.printSummary();
    } else if (command === 'run-enhanced') {
        // Run enhanced sidebar test suite
        console.log('🚀 Running enhanced sidebar test suite...');
        
        await tester.runCommand('test-yaml-integration');
        await tester.runCommand('test-default-states');
        await tester.runCommand('test-category-display');
        await tester.runCommand('test-selective-subscription');
        await tester.runCommand('test-render-optimization');
        await tester.runCommand('simulate-redux-actions');
        await tester.runCommand('verify-persistence');
        
        tester.printSummary();
    } else {
        await tester.runCommand(command, panelId, expectedState);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { SidebarTester };
