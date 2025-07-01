/**
 * AppInitializer.js - A staged, event-driven application initializer.
 */
import { logMessage } from '/client/log/index.js';
import { eventBus } from '/client/eventBus.js';
import { ConsoleLogManager } from '/client/log/ConsoleLogManager.js';
import { mainReducer } from '/client/store/reducer.js';
import { setReducer, dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { triggerActions } from '/client/actions.js';

export class AppInitializer {
    constructor() {
        this.log('Initializer created.');
    }

    log(message, level = 'info') {
        logMessage(message, level, 'BOOTSTRAP');
    }

    async start() {
        try {
            this.log('Starting application initialization...');
            
            await this.initCoreServices();
            eventBus.emit('core:initialized');
            
            await this.initUIInfrastructure();
            eventBus.emit('ui:initialized');

            await this.initFeatures();
            eventBus.emit('features:initialized');

            this.log('All initialization stages complete.');
            eventBus.emit('app:ready');

        } catch (error) {
            this.log(`Critical initialization failure: ${error.message}`, 'error');
            console.error('Application initialization failed:', error);
            eventBus.emit('app:failed', error);
        }
    }

    async initCoreServices() {
        this.log('Stage 1: Initializing Core Services...');
        new ConsoleLogManager().initialize().exposeToWindow();
        window.eventBus = eventBus;
        setReducer(mainReducer);
        window.triggerActions = triggerActions;
        this.log('Core Services (Logging, EventBus, Reducer, Actions) initialized.');
    }

    async initUIInfrastructure() {
        this.log('Stage 2: Initializing UI Infrastructure...');
        const { initializeUIComponents } = await import('/client/components/uiComponentsManager.js');
        await initializeUIComponents();

        const { workspacePanelManager } = await import('/client/layout/WorkspacePanelManager.js');
        window.workspacePanelManager = workspacePanelManager;
        workspacePanelManager.initialize();
        
        const { PanelUIManager } = await import('/client/panels/layout/PanelUIManager.js');
        const panelUIManager = new PanelUIManager();
        await panelUIManager.initialize();
        window.panelUIManager = panelUIManager;

        // Initialize sidebar panel manager
        const { sidebarPanelManager } = await import('/client/sidebar/SidebarPanelManager.js');
        window.sidebarPanelManager = sidebarPanelManager;
        const sidebarContainer = document.querySelector('.panel-manager');
        if (sidebarContainer) {
            sidebarPanelManager.setContainer(sidebarContainer);
            sidebarPanelManager.initializeDefaultPanels();
            sidebarPanelManager.renderAllPanels();
        }

        // Mount static components that don't depend on feature data
        const { createAuthDisplayComponent } = await import('/client/components/AuthDisplay.js');
        const { createContextManagerComponent } = await import('/client/components/ContextManagerComponent.js');
        const { createViewControlsComponent } = await import('/client/components/ViewControls.js');
        
        createAuthDisplayComponent('auth-component-container').mount();
        createContextManagerComponent('context-manager-container').mount();
        createViewControlsComponent('view-controls-container').mount();
        
        this.log('UI Infrastructure (Managers, Static Components) initialized.');
    }

    async initFeatures() {
        this.log('Stage 3: Initializing Feature Modules...');
        
        // Initialize auth system first
        const { initAuth } = await import('/client/auth.js');
        initAuth();
        
        // Initialize file manager
        const { initializeFileManager } = await import('/client/filesystem/fileManager.js');
        initializeFileManager();
        
        // These modules will now have internal listeners for 'ui:initialized'
        await import('/client/settings/core/settingsInitializer.js');
        await import('/client/dom-inspector/domInspectorInitializer.js');
        await import('/client/keyboardShortcuts.js');
        await import('/client/cli/index.js');
        
        // Initialize LogPanel
        const { LogPanel } = await import('/client/log/LogPanel.js');
        const logPanel = new LogPanel('log-container');
        await logPanel.initialize();
        
        // This mounts the main content view, which should happen after UI infra is ready
        const { createContentViewComponent } = await import('/client/components/ContentView.js');
        const previewContainer = document.querySelector('.preview-container');
        if (!previewContainer) throw new Error('Preview container not found');
        const contentView = createContentViewComponent(previewContainer);
        contentView.mount();
        window.APP = { contentView };
        
        this.log('Feature modules loaded. They will self-initialize on events.');
    }
} 