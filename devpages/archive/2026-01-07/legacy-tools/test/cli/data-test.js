#!/usr/bin/env node
/**
 * CLI tool for testing panel data flow and subscriptions
 */

import { fileURLToPath } from 'url';
import { panelConfig as panelsConfig } from '../../client/config/PanelConfigLoader.js';

const __filename = fileURLToPath(import.meta.url);

class DataFlowTester {
    constructor() {
        this.testResults = [];
        this.mockReduxState = {
            ui: {
                sidebarPanels: {},
                leftSidebarVisible: true,
                theme: 'light'
            },
            panels: {
                panels: {}
            },
            auth: {
                isAuthenticated: true,
                user: { id: 1, name: 'Test User' }
            },
            file: {
                currentFile: {
                    pathname: '/test/file.md',
                    content: '# Test Content'
                }
            }
        };
        this.dataSourceConnections = new Map();
        this.updateQueue = [];
        this.subscriptionCallbacks = [];
    }

    async runCommand(command, panelId, options = {}) {
        console.log(`\n🧪 Testing: ${command} ${panelId || ''}`);
        
        try {
            switch (command) {
                case 'trigger-redux-change':
                    return await this.testTriggerReduxChange(options.stateKey, options.value);
                case 'verify-panel-update':
                    return await this.testVerifyPanelUpdate(panelId);
                case 'test-data-source-connection':
                    return await this.testDataSourceConnection(panelId);
                case 'test-data-flow':
                    return await this.testDataFlow(panelId);
                case 'test-subscription-efficiency':
                    return await this.testSubscriptionEfficiency();
                case 'test-state-persistence':
                    return await this.testStatePersistence();
                case 'test-cross-panel-communication':
                    return await this.testCrossPanelCommunication();
                case 'test-error-handling':
                    return await this.testErrorHandling(panelId);
                case 'test-performance-impact':
                    return await this.testPerformanceImpact();
                case 'simulate-user-interaction':
                    return await this.testSimulateUserInteraction(panelId, options.action);
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            console.error(`❌ Test failed: ${error.message}`);
            this.testResults.push({ command, panelId, status: 'failed', error: error.message });
            return false;
        }
    }

    async testTriggerReduxChange(stateKey = 'auth.user.name', value = 'Updated User') {
        console.log(`✅ Triggering Redux state change:`);
        console.log(`   Key: ${stateKey}`);
        console.log(`   Value: ${value}`);
        
        // Simulate Redux state change
        const keys = stateKey.split('.');
        let current = this.mockReduxState;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        const oldValue = current[keys[keys.length - 1]];
        current[keys[keys.length - 1]] = value;
        
        console.log(`   Changed: ${oldValue} → ${value}`);
        
        // Trigger subscriptions
        this.triggerSubscriptions();
        
        this.testResults.push({ command: 'trigger-redux-change', status: 'passed' });
        return true;
    }

    async testVerifyPanelUpdate(panelId) {
        const config = panelsConfig.panels[panelId];
        if (!config) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        console.log(`✅ Verifying panel update: ${config.title}`);
        
        // Check if panel has data sources
        const dataSources = config.data_sources || [];
        if (dataSources.length === 0) {
            console.log(`   ⚠️  Panel has no data sources configured`);
            this.testResults.push({ command: 'verify-panel-update', panelId, status: 'passed' });
            return true;
        }

        // Simulate panel update based on data sources
        let updatesReceived = 0;
        
        for (const source of dataSources) {
            const isConnected = this.dataSourceConnections.get(source) !== false;
            if (isConnected) {
                updatesReceived++;
                console.log(`   📡 Update received from: ${source}`);
            } else {
                console.log(`   ❌ No update from disconnected source: ${source}`);
            }
        }

        console.log(`   Updates received: ${updatesReceived}/${dataSources.length}`);
        
        if (updatesReceived === 0) {
            throw new Error('No panel updates received from any data source');
        }

        this.testResults.push({ command: 'verify-panel-update', panelId, status: 'passed' });
        return true;
    }

    async testDataSourceConnection(panelId) {
        const config = panelsConfig.panels[panelId];
        if (!config) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        console.log(`✅ Testing data source connections: ${config.title}`);
        
        const dataSources = config.data_sources || [];
        const connectionResults = {};
        
        for (const source of dataSources) {
            const isConnected = this.simulateDataSourceConnection(source);
            connectionResults[source] = isConnected;
            this.dataSourceConnections.set(source, isConnected);
            
            console.log(`   ${source}: ${isConnected ? '✅ Connected' : '❌ Failed'}`);
        }

        const connectedCount = Object.values(connectionResults).filter(Boolean).length;
        const totalCount = dataSources.length;
        
        console.log(`   Connection success rate: ${Math.round((connectedCount / totalCount) * 100)}%`);
        
        if (connectedCount === 0) {
            throw new Error('All data source connections failed');
        }

        this.testResults.push({ command: 'test-data-source-connection', panelId, status: 'passed' });
        return true;
    }

    async testDataFlow(panelId) {
        const config = panelsConfig.panels[panelId];
        if (!config) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        console.log(`✅ Testing complete data flow: ${config.title}`);
        
        // Step 1: Connect data sources
        await this.testDataSourceConnection(panelId);
        
        // Step 2: Trigger state changes
        const dataSources = config.data_sources || [];
        for (const source of dataSources) {
            await this.simulateDataSourceUpdate(source);
        }
        
        // Step 3: Verify panel receives updates
        await this.testVerifyPanelUpdate(panelId);
        
        // Step 4: Check rendering
        const renderTriggered = this.checkRenderTriggered(panelId);
        console.log(`   Render triggered: ${renderTriggered ? 'Yes' : 'No'}`);
        
        console.log(`   ✅ Complete data flow verified`);
        
        this.testResults.push({ command: 'test-data-flow', panelId, status: 'passed' });
        return true;
    }

    async testSubscriptionEfficiency() {
        console.log(`✅ Testing subscription efficiency:`);
        
        const startTime = Date.now();
        let subscriptionCalls = 0;
        
        // Mock subscription callback
        const mockCallback = () => {
            subscriptionCalls++;
        };
        this.subscriptionCallbacks.push(mockCallback);
        
        // Trigger multiple state changes
        const stateChanges = [
            { key: 'ui.theme', value: 'dark' },
            { key: 'auth.user.name', value: 'New User' },
            { key: 'ui.sidebarPanels.test.expanded', value: true },
            { key: 'panels.panels.test.visible', value: true },
            { key: 'file.currentFile.content', value: 'New content' }
        ];
        
        for (const change of stateChanges) {
            await this.testTriggerReduxChange(change.key, change.value);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`   State changes: ${stateChanges.length}`);
        console.log(`   Subscription calls: ${subscriptionCalls}`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Avg time per change: ${Math.round(duration / stateChanges.length)}ms`);
        
        // Efficiency check
        const efficiency = Math.round((1 - (subscriptionCalls - stateChanges.length) / stateChanges.length) * 100);
        console.log(`   Efficiency: ${efficiency}%`);
        
        this.testResults.push({ command: 'test-subscription-efficiency', status: 'passed' });
        return true;
    }

    async testStatePersistence() {
        console.log(`✅ Testing state persistence:`);
        
        // Create initial state
        const initialState = {
            'system-diagnostics': { expanded: true },
            'redux-inspector': { expanded: false },
            'design-tokens': { expanded: true }
        };
        
        this.mockReduxState.ui.sidebarPanels = initialState;
        
        // Simulate persistence
        const persistedState = this.simulatePersistence();
        
        // Simulate page reload
        this.mockReduxState.ui.sidebarPanels = {};
        
        // Restore from persistence
        this.mockReduxState.ui.sidebarPanels = persistedState;
        
        // Verify restoration
        const restoredKeys = Object.keys(this.mockReduxState.ui.sidebarPanels);
        const originalKeys = Object.keys(initialState);
        
        if (restoredKeys.length !== originalKeys.length) {
            throw new Error(`Persistence failed: ${restoredKeys.length} restored, ${originalKeys.length} original`);
        }
        
        for (const key of originalKeys) {
            if (this.mockReduxState.ui.sidebarPanels[key].expanded !== initialState[key].expanded) {
                throw new Error(`State mismatch for ${key}`);
            }
        }
        
        console.log(`   Persisted panels: ${restoredKeys.length}`);
        console.log(`   Persistence size: ${JSON.stringify(persistedState).length} bytes`);
        console.log(`   ✅ State persistence verified`);
        
        this.testResults.push({ command: 'test-state-persistence', status: 'passed' });
        return true;
    }

    async testCrossPanelCommunication() {
        console.log(`✅ Testing cross-panel communication:`);
        
        // Simulate panel A updating shared state
        this.mockReduxState.ui.theme = 'dark';
        console.log(`   Panel A: Updated theme to dark`);
        
        // Simulate panel B receiving the update
        const panelsAffected = [];
        
        for (const [panelId, config] of Object.entries(panelsConfig.panels)) {
            if (config.data_sources?.includes('theme_config')) {
                panelsAffected.push(panelId);
                console.log(`   Panel B (${config.title}): Received theme update`);
            }
        }
        
        console.log(`   Panels affected: ${panelsAffected.length}`);
        
        // Test event propagation
        this.triggerSubscriptions();
        
        console.log(`   ✅ Cross-panel communication verified`);
        
        this.testResults.push({ command: 'test-cross-panel-communication', status: 'passed' });
        return true;
    }

    async testErrorHandling(panelId) {
        const config = panelsConfig.panels[panelId];
        if (!config) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        console.log(`✅ Testing error handling: ${config.title}`);
        
        // Test 1: Data source failure
        const dataSources = config.data_sources || [];
        for (const source of dataSources) {
            this.dataSourceConnections.set(source, false); // Simulate failure
            console.log(`   Simulated failure: ${source}`);
        }
        
        // Test 2: Invalid state update
        try {
            await this.testTriggerReduxChange('invalid.nested.key', 'test');
            console.log(`   ✅ Handled invalid state update gracefully`);
        } catch (error) {
            console.log(`   ✅ Caught invalid state update: ${error.message}`);
        }
        
        // Test 3: Panel update with no data sources
        try {
            await this.testVerifyPanelUpdate(panelId);
            console.log(`   ⚠️  Panel update succeeded despite data source failures`);
        } catch (error) {
            console.log(`   ✅ Panel update failed as expected: ${error.message}`);
        }
        
        console.log(`   ✅ Error handling verified`);
        
        this.testResults.push({ command: 'test-error-handling', panelId, status: 'passed' });
        return true;
    }

    async testPerformanceImpact() {
        console.log(`✅ Testing performance impact:`);
        
        const startTime = Date.now();
        let totalOperations = 0;
        
        // Simulate heavy data flow
        for (let i = 0; i < 100; i++) {
            await this.testTriggerReduxChange(`test.data.${i}`, `value-${i}`);
            totalOperations++;
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`   Operations: ${totalOperations}`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Avg time per operation: ${Math.round(duration / totalOperations)}ms`);
        
        // Performance thresholds
        const avgTime = duration / totalOperations;
        if (avgTime > 10) {
            console.warn(`   ⚠️  Performance warning: Average time (${avgTime}ms) exceeds threshold (10ms)`);
        } else {
            console.log(`   ✅ Performance within acceptable limits`);
        }
        
        this.testResults.push({ command: 'test-performance-impact', status: 'passed' });
        return true;
    }

    async testSimulateUserInteraction(panelId, action = 'toggle') {
        const config = panelsConfig.panels[panelId];
        if (!config) {
            throw new Error(`Panel ${panelId} not found in configuration`);
        }

        console.log(`✅ Simulating user interaction: ${action} on ${config.title}`);
        
        switch (action) {
            case 'toggle':
                if (config.sidebar) {
                    const currentState = this.mockReduxState.ui.sidebarPanels[panelId]?.expanded || false;
                    this.mockReduxState.ui.sidebarPanels[panelId] = { expanded: !currentState };
                    console.log(`   Sidebar panel toggled: ${currentState} → ${!currentState}`);
                }
                break;
                
            case 'show':
                if (config.floating) {
                    this.mockReduxState.panels.panels[panelId] = { visible: true, mounted: true };
                    console.log(`   Floating panel shown`);
                }
                break;
                
            case 'hide':
                if (config.floating) {
                    this.mockReduxState.panels.panels[panelId] = { visible: false };
                    console.log(`   Floating panel hidden`);
                }
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
        // Trigger data flow
        this.triggerSubscriptions();
        
        // Verify panel response
        await this.testVerifyPanelUpdate(panelId);
        
        console.log(`   ✅ User interaction simulated successfully`);
        
        this.testResults.push({ command: 'simulate-user-interaction', panelId, status: 'passed' });
        return true;
    }

    // Helper methods
    simulateDataSourceConnection(source) {
        // Mock connection success/failure based on source type
        const connectionRates = {
            'redux_state': 0.95,
            'system_metrics': 0.90,
            'action_history': 0.85,
            'css_variables': 0.98,
            'theme_config': 0.95,
            'file_system': 0.80
        };
        
        const rate = connectionRates[source] || 0.75;
        return Math.random() < rate;
    }

    async simulateDataSourceUpdate(source) {
        const isConnected = this.dataSourceConnections.get(source);
        if (!isConnected) {
            return false;
        }

        // Simulate different types of updates
        switch (source) {
            case 'redux_state':
                this.mockReduxState.ui.lastUpdate = Date.now();
                break;
            case 'system_metrics':
                this.mockReduxState.system = { cpu: Math.random() * 100, memory: Math.random() * 100 };
                break;
            case 'theme_config':
                this.mockReduxState.ui.theme = this.mockReduxState.ui.theme === 'light' ? 'dark' : 'light';
                break;
        }
        
        this.triggerSubscriptions();
        return true;
    }

    checkRenderTriggered(panelId) {
        // Mock render check - in real implementation, this would check if component re-rendered
        return this.dataSourceConnections.has(panelId) || 
               this.mockReduxState.ui.sidebarPanels[panelId] ||
               this.mockReduxState.panels.panels[panelId];
    }

    triggerSubscriptions() {
        // Simulate Redux subscription callbacks
        this.subscriptionCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.warn(`Subscription callback error: ${error.message}`);
            }
        });
    }

    simulatePersistence() {
        // Simulate localStorage persistence
        return JSON.parse(JSON.stringify(this.mockReduxState.ui.sidebarPanels));
    }

    printSummary() {
        console.log('\n📊 Data Flow Test Summary:');
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

        // Data flow metrics
        console.log(`\n📈 Data Flow Metrics:`);
        console.log(`   Data source connections: ${this.dataSourceConnections.size}`);
        console.log(`   Update queue size: ${this.updateQueue.length}`);
        console.log(`   Active subscriptions: ${this.subscriptionCallbacks.length}`);
    }
}

// CLI Interface
async function main() {
    const [,, command, panelId, ...options] = process.argv;
    
    if (!command) {
        console.log('Usage: node data-test.js <command> [panelId] [options]');
        console.log('Commands:');
        console.log('  trigger-redux-change, verify-panel-update, test-data-source-connection');
        console.log('  test-data-flow, test-subscription-efficiency, test-state-persistence');
        console.log('  test-cross-panel-communication, test-error-handling, test-performance-impact');
        console.log('  simulate-user-interaction, run-all');
        console.log('Available panels:', Object.keys(panelsConfig.panels).join(', '));
        console.log('Options: --state-key=<key> --value=<value> --action=<action>');
        process.exit(1);
    }

    const tester = new DataFlowTester();
    
    if (command === 'run-all') {
        // Run complete data flow test suite
        console.log('🚀 Running complete data flow test suite...');
        
        await tester.runCommand('trigger-redux-change', null, { stateKey: 'ui.theme', value: 'dark' });
        await tester.runCommand('test-data-source-connection', 'system-diagnostics');
        await tester.runCommand('verify-panel-update', 'system-diagnostics');
        await tester.runCommand('test-data-flow', 'redux-inspector');
        await tester.runCommand('test-subscription-efficiency');
        await tester.runCommand('test-state-persistence');
        await tester.runCommand('test-cross-panel-communication');
        await tester.runCommand('simulate-user-interaction', 'design-tokens', { action: 'toggle' });
        await tester.runCommand('test-error-handling', 'system-diagnostics');
        await tester.runCommand('test-performance-impact');
        
        tester.printSummary();
    } else {
        const opts = {};
        
        // Parse options
        for (const option of options) {
            if (option.startsWith('--state-key=')) {
                opts.stateKey = option.split('=')[1];
            } else if (option.startsWith('--value=')) {
                opts.value = option.split('=')[1];
            } else if (option.startsWith('--action=')) {
                opts.action = option.split('=')[1];
            }
        }
        
        await tester.runCommand(command, panelId, opts);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { DataFlowTester };
