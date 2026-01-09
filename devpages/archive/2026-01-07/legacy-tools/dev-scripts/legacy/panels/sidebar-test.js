#!/usr/bin/env node
/**
 * CLI Sidebar Testing Tool
 * Tests sidebar state persistence and panel management
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load panel configuration
const panelsConfigPath = path.join(__dirname, '../../../panels.yaml');
const panelsConfig = yaml.load(fs.readFileSync(panelsConfigPath, 'utf8'));

class SidebarTester {
    constructor() {
        this.testResults = [];
        this.mockReduxState = {
            ui: {
                sidebarPanels: {
                    'system-diagnostics': { expanded: false },
                    'redux-inspector': { expanded: false },
                    'design-tokens': { expanded: false }
                },
                leftSidebarVisible: true
            }
        };
        this.persistedState = {};
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
        if (!this.mockReduxState.ui.sidebarPanels[panelId]) {
            throw new Error(`Panel ${panelId} not found in sidebar configuration`);
        }

        // Simulate Redux action dispatch
        this.mockReduxState.ui.sidebarPanels[panelId].expanded = true;
        this.simulatePersistence();
        
        console.log(`✅ Panel expanded: ${panelId}`);
        console.log(`   State: ${JSON.stringify(this.mockReduxState.ui.sidebarPanels[panelId])}`);
        
        this.testResults.push({ command: 'expand', panelId, status: 'passed' });
        return true;
    }

    async testCollapsePanel(panelId) {
        if (!this.mockReduxState.ui.sidebarPanels[panelId]) {
            throw new Error(`Panel ${panelId} not found in sidebar configuration`);
        }

        this.mockReduxState.ui.sidebarPanels[panelId].expanded = false;
        this.simulatePersistence();
        
        console.log(`✅ Panel collapsed: ${panelId}`);
        console.log(`   State: ${JSON.stringify(this.mockReduxState.ui.sidebarPanels[panelId])}`);
        
        this.testResults.push({ command: 'collapse', panelId, status: 'passed' });
        return true;
    }

    async testTogglePanel(panelId) {
        if (!this.mockReduxState.ui.sidebarPanels[panelId]) {
            throw new Error(`Panel ${panelId} not found in sidebar configuration`);
        }

        const currentState = this.mockReduxState.ui.sidebarPanels[panelId].expanded;
        this.mockReduxState.ui.sidebarPanels[panelId].expanded = !currentState;
        this.simulatePersistence();
        
        console.log(`✅ Panel toggled: ${panelId}`);
        console.log(`   ${currentState ? 'Expanded' : 'Collapsed'} → ${!currentState ? 'Expanded' : 'Collapsed'}`);
        
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
        
        this.testResults.push({ command: 'verify-persistence', status: 'passed' });
        return true;
    }

    async testShowSidebar() {
        this.mockReduxState.ui.leftSidebarVisible = true;
        
        console.log(`✅ Sidebar shown`);
        console.log(`   Visible: ${this.mockReduxState.ui.leftSidebarVisible}`);
        
        this.testResults.push({ command: 'show-sidebar', status: 'passed' });
        return true;
    }

    async testHideSidebar() {
        this.mockReduxState.ui.leftSidebarVisible = false;
        
        console.log(`✅ Sidebar hidden`);
        console.log(`   Visible: ${this.mockReduxState.ui.leftSidebarVisible}`);
        
        this.testResults.push({ command: 'hide-sidebar', status: 'passed' });
        return true;
    }

    async testRenderSidebar() {
        const sidebarPanels = this.mockReduxState.ui.sidebarPanels;
        const visiblePanels = Object.entries(sidebarPanels).filter(([, state]) => state.expanded);
        
        console.log(`✅ Sidebar render simulation:`);
        console.log(`   Total panels: ${Object.keys(sidebarPanels).length}`);
        console.log(`   Expanded panels: ${visiblePanels.length}`);
        
        visiblePanels.forEach(([panelId]) => {
            const config = panelsConfig.panels[panelId];
            console.log(`   - ${config?.title || panelId} (${panelId})`);
        });
        
        this.testResults.push({ command: 'render', status: 'passed' });
        return true;
    }

    simulatePersistence() {
        // Simulate localStorage persistence
        this.persistedState = JSON.parse(JSON.stringify(this.mockReduxState.ui.sidebarPanels));
    }

    printSummary() {
        console.log('\n📊 Sidebar Test Summary:');
        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        
        console.log(`   Passed: ${passed}`);
        console.log(`   Failed: ${failed}`);
        console.log(`   Total: ${this.testResults.length}`);
        
        if (failed > 0) {
            console.log('\n❌ Failed tests:');
            this.testResults
                .filter(r => r.status === 'failed')
                .forEach(r => console.log(`   - ${r.command} ${r.panelId || ''}: ${r.error}`));
        }
    }
}

// CLI Interface
async function main() {
    const [,, command, panelId, expectedState] = process.argv;
    
    if (!command) {
        console.log('Usage: node sidebar-test.js <command> [panelId] [expectedState]');
        console.log('Commands: expand, collapse, toggle, verify-state, verify-persistence, show-sidebar, hide-sidebar, render');
        console.log('Available panels:', Object.keys(panelsConfig.panels).join(', '));
        process.exit(1);
    }

    const tester = new SidebarTester();
    
    if (command === 'run-all') {
        // Run full sidebar test suite
        console.log('🚀 Running full sidebar test suite...');
        
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
    } else {
        await tester.runCommand(command, panelId, expectedState);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { SidebarTester };
