/**
 * @file client/panels/panel-modernization-demo.js
 * @description Demonstration script for the modernized panel system
 */

import { ModernBasePanel } from './ModernBasePanel.js';
import { ModernContextPanel } from './ModernContextPanel.js';
import { PanelMigrationHelper } from './PanelMigrationHelper.js';
import { BasePanel } from './BasePanel.js';
import { ContextPanel } from './ContextPanel.js';

// Load CSS for modern panels
const modernPanelCSS = document.createElement('link');
modernPanelCSS.rel = 'stylesheet';
modernPanelCSS.href = '/client/panels/modern-panels.css';
document.head.appendChild(modernPanelCSS);

const modernContextCSS = document.createElement('link');
modernContextCSS.rel = 'stylesheet';
modernContextCSS.href = '/client/panels/modern-context-panel.css';
document.head.appendChild(modernContextCSS);

/**
 * Demo: Create a simple modern panel
 */
export function createSimpleModernPanel() {
    class DemoPanel extends ModernBasePanel {
        constructor(options) {
            super({
                id: 'demo-panel',
                title: '🚀 Modern Demo Panel',
                collapsible: true,
                resizable: true,
                ...options
            });
        }
        
        renderContent() {
            const content = document.createElement('div');
            content.innerHTML = `
                <div style="padding: 16px;">
                    <h4>Modern Panel Features:</h4>
                    <ul>
                        <li>✅ Redux Integration</li>
                        <li>✅ Performance Optimized</li>
                        <li>✅ Standardized Lifecycle</li>
                        <li>✅ Beautiful Styling</li>
                        <li>✅ Error Handling</li>
                    </ul>
                    <button onclick="this.closest('.panel').querySelector('.panel-collapse-btn').click()">
                        Toggle Collapse
                    </button>
                </div>
            `;
            return content;
        }
        
        async onMountComplete() {
            this.log('Demo panel mounted and ready!');
        }
    }
    
    return new DemoPanel();
}

/**
 * Demo: Migrate existing panel to modern system
 */
export function demonstratePanelMigration() {
    const migrationHelper = new PanelMigrationHelper();
    
    // Create migration configuration for ContextPanel
    const migrationConfig = PanelMigrationHelper.createMigrationConfig('context');
    
    // Migrate the legacy ContextPanel
    const ModernizedContextPanel = migrationHelper.migratePanel(ContextPanel, {
        ...migrationConfig,
        defaultOptions: {
            title: 'Migrated Context Panel',
            collapsible: true,
            order: 2
        },
        forwardMethods: ['init', 'getTitle', 'setupEventListeners'],
        compatibilityShims: {
            // Custom shims for ContextPanel
            log: function(message, level = 'info') {
                console.log(`[${level.toUpperCase()}] ${this.id}:`, message);
            }
        }
    });
    
    return new ModernizedContextPanel({ id: 'migrated-context' });
}

/**
 * Demo: Compare old vs new panel performance
 */
export async function performanceComparison() {
    console.log('🔬 Panel Performance Comparison');
    console.log('================================');
    
    // Test old panel
    const startOld = performance.now();
    const oldPanel = new ContextPanel();
    const oldRenderTime = performance.now() - startOld;
    
    // Test new panel
    const startNew = performance.now();
    const newPanel = new ModernContextPanel();
    await newPanel.initialize();
    const newRenderTime = performance.now() - startNew;
    
    console.log(`Legacy Panel: ${oldRenderTime.toFixed(2)}ms`);
    console.log(`Modern Panel: ${newRenderTime.toFixed(2)}ms`);
    console.log(`Improvement: ${((oldRenderTime - newRenderTime) / oldRenderTime * 100).toFixed(1)}%`);
    
    return { oldRenderTime, newRenderTime, improvement: (oldRenderTime - newRenderTime) / oldRenderTime };
}

/**
 * Demo: Show modern panel lifecycle
 */
export function demonstrateLifecycle() {
    class LifecycleDemo extends ModernBasePanel {
        constructor() {
            super({
                id: 'lifecycle-demo',
                title: '🔄 Lifecycle Demo',
                collapsible: true
            });
        }
        
        async onInit() {
            this.log('🚀 Panel initialized');
        }
        
        async onMountComplete() {
            this.log('📌 Panel mounted');
            this.startHeartbeat();
        }
        
        onStateChange(newState) {
            this.log('🔄 State changed:', newState);
        }
        
        onVisibilityChange(isVisible) {
            this.log(`👁️ Visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
        }
        
        onUnmountStart() {
            this.log('🧹 Panel unmounting');
            this.stopHeartbeat();
        }
        
        startHeartbeat() {
            this.heartbeat = setInterval(() => {
                this.log('💓 Heartbeat');
            }, 5000);
        }
        
        stopHeartbeat() {
            if (this.heartbeat) {
                clearInterval(this.heartbeat);
                this.heartbeat = null;
            }
        }
        
        renderContent() {
            const content = document.createElement('div');
            content.innerHTML = `
                <div style="padding: 16px;">
                    <h4>Lifecycle Events:</h4>
                    <p>Check console for lifecycle events</p>
                    <button onclick="this.toggleVisibility()">Toggle Visibility</button>
                    <button onclick="this.destroy()">Destroy Panel</button>
                </div>
            `;
            
            // Add event listeners
            const toggleBtn = content.querySelector('button');
            toggleBtn.addEventListener('click', () => {
                this.setVisible(!this.getState().visible);
            });
            
            const destroyBtn = content.querySelectorAll('button')[1];
            destroyBtn.addEventListener('click', () => {
                this.destroy();
            });
            
            return content;
        }
    }
    
    return new LifecycleDemo();
}

/**
 * Demo: Batch migration of multiple panels
 */
export function demonstrateBatchMigration() {
    const migrationHelper = new PanelMigrationHelper();
    
    // Mock legacy panel classes for demo
    class LegacyFilePanel extends BasePanel {
        constructor(options) {
            super({ id: 'legacy-file', ...options });
        }
        render() {
            const div = document.createElement('div');
            div.innerHTML = '<p>Legacy File Panel</p>';
            return div;
        }
    }
    
    class LegacySettingsPanel extends BasePanel {
        constructor(options) {
            super({ id: 'legacy-settings', ...options });
        }
        render() {
            const div = document.createElement('div');
            div.innerHTML = '<p>Legacy Settings Panel</p>';
            return div;
        }
    }
    
    // Batch migrate
    const panelsToMigrate = [
        {
            panelClass: LegacyFilePanel,
            config: PanelMigrationHelper.createMigrationConfig('file-browser')
        },
        {
            panelClass: LegacySettingsPanel,
            config: PanelMigrationHelper.createMigrationConfig('settings')
        },
        {
            panelClass: ContextPanel,
            config: PanelMigrationHelper.createMigrationConfig('context')
        }
    ];
    
    const results = migrationHelper.batchMigrate(panelsToMigrate);
    
    console.log('📦 Batch Migration Results:');
    console.log('===========================');
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.id}: ${result.success ? 'Success' : result.error.message}`);
    });
    
    // Generate migration report
    const report = migrationHelper.generateMigrationReport();
    console.log('\n📊 Migration Report:', report);
    
    return results;
}

/**
 * Demo: Test panel with Redux integration
 */
export function demonstrateReduxIntegration() {
    class ReduxDemo extends ModernBasePanel {
        constructor() {
            super({
                id: 'redux-demo',
                title: '🔗 Redux Integration Demo',
                collapsible: true,
                persistent: true
            });
        }
        
        renderContent() {
            const content = document.createElement('div');
            content.innerHTML = `
                <div style="padding: 16px;">
                    <h4>Redux State:</h4>
                    <div id="state-display">Loading...</div>
                    <button id="update-state">Update State</button>
                    <button id="toggle-collapse">Toggle Collapse</button>
                </div>
            `;
            
            // Display current state
            this.updateStateDisplay(content);
            
            // Add event listeners
            content.querySelector('#update-state').addEventListener('click', () => {
                this.updatePanelState();
            });
            
            content.querySelector('#toggle-collapse').addEventListener('click', () => {
                this.toggleCollapse();
            });
            
            return content;
        }
        
        updateStateDisplay(container) {
            const stateDisplay = container.querySelector('#state-display');
            const currentState = this.getState();
            stateDisplay.innerHTML = `<pre>${JSON.stringify(currentState, null, 2)}</pre>`;
        }
        
        updatePanelState() {
            // Update panel state in Redux
            const randomOrder = Math.floor(Math.random() * 100);
            this.store.dispatch({
                type: 'panels/updatePanel',
                payload: {
                    id: this.id,
                    order: randomOrder,
                    lastUpdated: Date.now()
                }
            });
        }
        
        onStateChange(newState) {
            super.onStateChange(newState);
            
            // Update display when state changes
            if (this.element) {
                const container = this.element.querySelector('.panel-content');
                if (container) {
                    this.updateStateDisplay(container);
                }
            }
        }
    }
    
    return new ReduxDemo();
}

/**
 * Main demo function - runs all demonstrations
 */
export async function runPanelModernizationDemo() {
    console.log('🎯 Panel System Modernization Demo');
    console.log('===================================');
    
    try {
        // 1. Simple modern panel
        console.log('\n1️⃣ Creating simple modern panel...');
        const simplePanel = createSimpleModernPanel();
        await simplePanel.initialize();
        console.log('✅ Simple panel created');
        
        // 2. Panel migration
        console.log('\n2️⃣ Demonstrating panel migration...');
        const migratedPanel = demonstratePanelMigration();
        console.log('✅ Panel migration completed');
        
        // 3. Performance comparison
        console.log('\n3️⃣ Running performance comparison...');
        const perfResults = await performanceComparison();
        console.log('✅ Performance comparison completed');
        
        // 4. Lifecycle demonstration
        console.log('\n4️⃣ Creating lifecycle demo panel...');
        const lifecyclePanel = demonstrateLifecycle();
        await lifecyclePanel.initialize();
        console.log('✅ Lifecycle demo created');
        
        // 5. Batch migration
        console.log('\n5️⃣ Running batch migration...');
        const batchResults = demonstrateBatchMigration();
        console.log('✅ Batch migration completed');
        
        // 6. Redux integration
        console.log('\n6️⃣ Creating Redux integration demo...');
        const reduxPanel = demonstrateReduxIntegration();
        await reduxPanel.initialize();
        console.log('✅ Redux integration demo created');
        
        console.log('\n🎉 All demonstrations completed successfully!');
        console.log('\nCreated panels:');
        console.log('- Simple Modern Panel:', simplePanel.id);
        console.log('- Migrated Panel:', migratedPanel.id);
        console.log('- Lifecycle Demo:', lifecyclePanel.id);
        console.log('- Redux Demo:', reduxPanel.id);
        
        // Return all created panels for testing
        return {
            simplePanel,
            migratedPanel,
            lifecyclePanel,
            reduxPanel,
            perfResults,
            batchResults
        };
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
        throw error;
    }
}

// Expose demo functions to global scope for easy testing
if (typeof window !== 'undefined') {
    window.panelModernizationDemo = {
        runPanelModernizationDemo,
        createSimpleModernPanel,
        demonstratePanelMigration,
        performanceComparison,
        demonstrateLifecycle,
        demonstrateBatchMigration,
        demonstrateReduxIntegration
    };
    
    console.log('🔧 Panel modernization demo functions available at window.panelModernizationDemo');
}
