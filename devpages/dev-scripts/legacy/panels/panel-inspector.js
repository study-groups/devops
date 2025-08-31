#!/usr/bin/env node

/**
 * Panel Inspector - Debug script for panel system
 * Usage: node debug-scripts/panels/panel-inspector.js [command] [args...]
 * 
 * Commands:
 *   list                    - List all panels
 *   show <id>              - Show panel details
 *   create <type> [config] - Create a new panel
 *   destroy <id>           - Destroy a panel
 *   status                 - Show panel system status
 *   export                 - Export panel configurations
 *   import <file>          - Import panel configurations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Panel system interface for CLI
class PanelInspector {
    constructor() {
        this.configFile = path.join(__dirname, '../../client/panels/panel-configs.json');
        this.loadConfigs();
    }

    loadConfigs() {
        try {
            if (fs.existsSync(this.configFile)) {
                this.configs = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
            } else {
                this.configs = { panels: {}, types: {} };
            }
        } catch (error) {
            console.error('Failed to load panel configs:', error.message);
            this.configs = { panels: {}, types: {} };
        }
    }

    saveConfigs() {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(this.configs, null, 2));
        } catch (error) {
            console.error('Failed to save panel configs:', error.message);
        }
    }

    listPanels() {
        console.log('📋 Panel System Status');
        console.log('='.repeat(50));
        
        const panels = Object.values(this.configs.panels);
        if (panels.length === 0) {
            console.log('No panels configured');
            return;
        }

        panels.forEach(panel => {
            console.log(`🔹 ${panel.id} (${panel.type})`);
            console.log(`   Title: ${panel.title}`);
            console.log(`   Position: ${panel.position.x}, ${panel.position.y}`);
            console.log(`   Size: ${panel.size.width}x${panel.size.height}`);
            console.log(`   Visible: ${panel.visible ? '✅' : '❌'}`);
            console.log(`   Created: ${new Date(panel.createdAt).toLocaleString()}`);
            console.log('');
        });
    }

    showPanel(id) {
        const panel = this.configs.panels[id];
        if (!panel) {
            console.error(`❌ Panel '${id}' not found`);
            return;
        }

        console.log(`🔍 Panel Details: ${id}`);
        console.log('='.repeat(50));
        console.log(JSON.stringify(panel, null, 2));
    }

    createPanel(type, configStr = '{}') {
        try {
            const config = JSON.parse(configStr);
            const id = config.id || `${type}-${Date.now()}`;
            
            const panel = {
                id,
                type,
                title: config.title || `${type} Panel`,
                position: config.position || { x: 100, y: 100 },
                size: config.size || { width: 400, height: 300 },
                visible: config.visible || false,
                collapsed: config.collapsed || false,
                config: config.config || {},
                createdAt: Date.now(),
                lastUpdated: Date.now()
            };

            this.configs.panels[id] = panel;
            this.saveConfigs();
            
            console.log(`✅ Created panel: ${id}`);
            console.log(JSON.stringify(panel, null, 2));
            
        } catch (error) {
            console.error('❌ Failed to create panel:', error.message);
        }
    }

    destroyPanel(id) {
        if (!this.configs.panels[id]) {
            console.error(`❌ Panel '${id}' not found`);
            return;
        }

        delete this.configs.panels[id];
        this.saveConfigs();
        console.log(`✅ Destroyed panel: ${id}`);
    }

    showStatus() {
        const panels = Object.values(this.configs.panels);
        const types = [...new Set(panels.map(p => p.type))];
        const visible = panels.filter(p => p.visible).length;
        const collapsed = panels.filter(p => p.collapsed).length;

        console.log('📊 Panel System Status');
        console.log('='.repeat(50));
        console.log(`Total Panels: ${panels.length}`);
        console.log(`Visible Panels: ${visible}`);
        console.log(`Collapsed Panels: ${collapsed}`);
        console.log(`Panel Types: ${types.join(', ')}`);
        console.log(`Config File: ${this.configFile}`);
        console.log(`Last Modified: ${fs.existsSync(this.configFile) ? 
            new Date(fs.statSync(this.configFile).mtime).toLocaleString() : 'Never'}`);
    }

    exportPanels(filename = 'panel-export.json') {
        try {
            const exportData = {
                exported: new Date().toISOString(),
                panels: this.configs.panels,
                types: this.configs.types
            };
            
            fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
            console.log(`✅ Exported panels to: ${filename}`);
        } catch (error) {
            console.error('❌ Failed to export panels:', error.message);
        }
    }

    importPanels(filename) {
        try {
            if (!fs.existsSync(filename)) {
                console.error(`❌ File not found: ${filename}`);
                return;
            }

            const importData = JSON.parse(fs.readFileSync(filename, 'utf8'));
            
            if (importData.panels) {
                Object.assign(this.configs.panels, importData.panels);
            }
            if (importData.types) {
                Object.assign(this.configs.types, importData.types);
            }

            this.saveConfigs();
            console.log(`✅ Imported panels from: ${filename}`);
            console.log(`Imported ${Object.keys(importData.panels || {}).length} panels`);
        } catch (error) {
            console.error('❌ Failed to import panels:', error.message);
        }
    }
}

// CLI Interface
function main() {
    const inspector = new PanelInspector();
    const [,, command, ...args] = process.argv;

    switch (command) {
        case 'list':
            inspector.listPanels();
            break;
        case 'show':
            if (!args[0]) {
                console.error('❌ Usage: show <panel-id>');
                process.exit(1);
            }
            inspector.showPanel(args[0]);
            break;
        case 'create':
            if (!args[0]) {
                console.error('❌ Usage: create <type> [config-json]');
                process.exit(1);
            }
            inspector.createPanel(args[0], args[1]);
            break;
        case 'destroy':
            if (!args[0]) {
                console.error('❌ Usage: destroy <panel-id>');
                process.exit(1);
            }
            inspector.destroyPanel(args[0]);
            break;
        case 'status':
            inspector.showStatus();
            break;
        case 'export':
            inspector.exportPanels(args[0]);
            break;
        case 'import':
            if (!args[0]) {
                console.error('❌ Usage: import <filename>');
                process.exit(1);
            }
            inspector.importPanels(args[0]);
            break;
        default:
            console.log('Panel Inspector - Debug tool for panel system');
            console.log('');
            console.log('Commands:');
            console.log('  list                    - List all panels');
            console.log('  show <id>              - Show panel details');
            console.log('  create <type> [config] - Create a new panel');
            console.log('  destroy <id>           - Destroy a panel');
            console.log('  status                 - Show panel system status');
            console.log('  export [file]          - Export panel configurations');
            console.log('  import <file>          - Import panel configurations');
            console.log('');
            console.log('Examples:');
            console.log('  node panel-inspector.js list');
            console.log('  node panel-inspector.js create diagnostic \'{"title":"Debug Panel"}\'');
            console.log('  node panel-inspector.js show diagnostic-123456');
            break;
    }
}

// Run main function if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default PanelInspector;
