// bootstrap.js - Simple application initialization
import { logInfo, logError } from '/client/log/index.js';
import '/client/log/LogCore.js'; // Ensure global window.logMessage is available early
import { ConsoleLogManager } from '/client/log/ConsoleLogManager.js'; // Add ConsoleLogManager import
import { createContentViewComponent } from '/client/components/ContentView.js';
import { createViewControlsComponent } from '/client/components/ViewControls.js';
import { createAuthDisplayComponent } from '/client/components/AuthDisplay.js';
import { createContextManagerComponent } from '/client/components/ContextManagerComponent.js';
import { LogPanel } from '/client/log/LogPanel.js';
import { PreviewManager } from '/client/preview/index.js';
import { LayoutManager } from '/client/layout/LayoutManager.js'; // IMPORT THE CLASS
import { initAuth } from '/client/auth.js';
import { mainReducer } from '/client/store/reducer.js';
import { setReducer } from '/client/messaging/messageQueue.js';
import { initializeUIComponents } from '/client/components/uiComponentsManager.js';
import { initializeFileManager } from '/client/filesystem/fileManager.js';
import { initializePreviewManager } from '/client/previewManager.js'; // Add this import
import { initializeSettingsPanel } from '/client/settings/settingsInitializer.js'; // Add settings panel import
import { initKeyboardShortcuts } from '/client/keyboardShortcuts.js'; // Add keyboard shortcuts import

// Simple console logging for bootstrap
function logBootstrap(message, level = 'info') {
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, 'BOOTSTRAP');
  } else {
    console.log(`[BOOTSTRAP] ${message}`);
  }
}

// Main application initialization function
async function initializeApp() {
  try {
    logBootstrap('Starting application initialization...');
    
    // Initialize ConsoleLogManager first (needed for console logging)
    try {
      const consoleLogManager = new ConsoleLogManager();
      consoleLogManager.initialize().exposeToWindow();
      logBootstrap('Console logging initialized');
    } catch (error) {
      console.error('Console logging initialization failed:', error);
    }
    
    // Initialize EventBus first
    try {
      const { eventBus } = await import('/client/eventBus.js');
      window.eventBus = eventBus;
      logBootstrap('EventBus ready');
    } catch (error) {
      console.error('EventBus initialization failed:', error);
    }

    // Initialize the reducer system
    setReducer(mainReducer);
    logBootstrap('Reducer system initialized');

    // Initialize UI components (popups, modals, etc.)
    try {
      await initializeUIComponents();
      logBootstrap('UI components initialized');
    } catch (error) {
      console.error('UI components initialization failed:', error);
    }

    // Initialize settings panel
    try {
      initializeSettingsPanel();
      logBootstrap('Settings panel initialized');
    } catch (error) {
      console.error('Settings panel initialization failed:', error);
    }

    // Initialize keyboard shortcuts
    try {
      initKeyboardShortcuts();
      logBootstrap('Keyboard shortcuts initialized');
    } catch (error) {
      console.error('Keyboard shortcuts initialization failed:', error);
    }

    // Initialize layout manager first (needed by view controls)
    const layoutManager = new LayoutManager(); // CREATE INSTANCE
    window.layoutManager = layoutManager; // EXPOSE TO GLOBAL
    logBootstrap('Layout manager initialized');
    
    // Initialize topbar components
    const viewControls = createViewControlsComponent('view-controls-container', layoutManager);
    viewControls.mount();
    
    const authDisplay = createAuthDisplayComponent('auth-component-container');
    authDisplay.mount();
    
    const contextManager = createContextManagerComponent('context-manager-container');
    contextManager.mount();

    // Initialize main content
    const contentView = createContentViewComponent('content-view-wrapper');
    contentView.mount();

    // Wait a frame for DOM updates
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Initialize preview system
    const previewManager = new PreviewManager();
    await previewManager.init();

    // Initialize the preview manager integration
    await initializePreviewManager();

    // Initialize log panel
    const logPanel = new LogPanel();
    await logPanel.initialize();

    // Test the logging system
    logBootstrap('Log panel initialized - testing logging system...');
    if (typeof window.logMessage === 'function') {
      window.logMessage('Logging system is working!', 'info', 'SYSTEM_TEST');
      window.logMessage('This is a test debug message', 'debug', 'SYSTEM_TEST');
      window.logMessage('This is a test warning message', 'warn', 'SYSTEM_TEST');
    }

    // Load enhanced sidebars
    await import('/client/enhancedSidebars.js');

    // Initialize auth system
    initAuth();

    // Initialize file manager (loads base directories)
    try {
      await initializeFileManager();
      logBootstrap('File manager initialized');
    } catch (error) {
      console.error('File manager initialization failed:', error);
    }

    logBootstrap('Application initialization complete');
    
  } catch (error) {
    console.error('Application initialization failed:', error);
    logBootstrap(`Initialization failed: ${error.message}`, 'error');
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
} 