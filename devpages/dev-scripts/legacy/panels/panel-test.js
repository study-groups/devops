#!/usr/bin/env node
/**
 * CLI Panel Testing Tool
 * Tests panel lifecycle and state management
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load panel configuration
const panelsConfigPath = path.join(__dirname, '../../../panels.yaml');
const panelsConfig = yaml.load(fs.readFileSync(panelsConfigPath, 'utf8'));

class PanelTester {
    constructor() {
        this.testResults = [];
        this.mockReduxState = {
            panels: { panels: {} },
            ui: { sidebarPanels: {} }
        };
    }

    async runCommand(command, panelId) {
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

        // Simulate panel creation
        const mockPanel = {
            id: panelId,
            title: panelConfig.title,
            type: panelId,
            visible: false,
            mounted: false,
            position: { x: 100, y: 100 },
            size: { width: 400, height: 300 },
            zIndex: 1000,
            config: panelConfig
        };

        this.mockReduxState.panels.panels[panelId] = mockPanel;
        
        console.log(`✅ Panel created: ${panelConfig.title}`);
        console.log(`   Category: ${panelConfig.category}`);
        console.log(`   Sidebar: ${panelConfig.sidebar ? 'Yes' : 'No'}`);
        console.log(`   Floating: ${panelConfig.floating ? 'Yes' : 'No'}`);
        
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
        
        console.log(`✅ Panel shown: ${panel.title}`);
        console.log(`   Visible: ${panel.visible}`);
        console.log(`   Mounted: ${panel.mounted}`);
        
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
        
        console.log(`✅ Panel destroyed: ${panelId}`);
        
        this.testResults.push({ command: 'destroy', panelId, status: 'passed' });
        return true;
    }

    async testListPanels() {
        const panels = Object.values(this.mockReduxState.panels.panels);
        
        console.log(`✅ Active panels: ${panels.length}`);
        panels.forEach(panel => {
            console.log(`   - ${panel.title} (${panel.id}): ${panel.visible ? 'visible' : 'hidden'}`);
        });
        
        this.testResults.push({ command: 'list', status: 'passed' });
        return true;
    }

    async testValidateConfig() {
        const requiredFields = ['title', 'description', 'category', 'sidebar'];
        let valid = true;
        
        for (const [panelId, config] of Object.entries(panelsConfig.panels)) {
            for (const field of requiredFields) {
                if (!(field in config)) {
                    console.error(`❌ Panel ${panelId} missing required field: ${field}`);
                    valid = false;
                }
            }
        }
        
        if (valid) {
            console.log(`✅ All ${Object.keys(panelsConfig.panels).length} panel configurations are valid`);
        }
        
        this.testResults.push({ command: 'validate-config', status: valid ? 'passed' : 'failed' });
        return valid;
    }

    printSummary() {
        console.log('\n📊 Test Summary:');
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
    const [,, command, panelId] = process.argv;
    
    if (!command) {
        console.log('Usage: node panel-test.js <command> [panelId]');
        console.log('Commands: create, show, hide, destroy, list, validate-config');
        console.log('Available panels:', Object.keys(panelsConfig.panels).join(', '));
        process.exit(1);
    }

    const tester = new PanelTester();
    
    if (command === 'run-all') {
        // Run full test suite
        console.log('🚀 Running full panel test suite...');
        
        await tester.runCommand('validate-config');
        await tester.runCommand('create', 'system-diagnostics');
        await tester.runCommand('create', 'redux-inspector');
        await tester.runCommand('show', 'system-diagnostics');
        await tester.runCommand('list');
        await tester.runCommand('hide', 'system-diagnostics');
        await tester.runCommand('destroy', 'system-diagnostics');
        await tester.runCommand('list');
        
        tester.printSummary();
    } else {
        await tester.runCommand(command, panelId);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { PanelTester };
