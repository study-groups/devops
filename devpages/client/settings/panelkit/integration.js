/**
 * PanelKit Integration Layer
 * Connects PanelKit with the DevPages settings system.
 */

import { PanelKitRenderer } from './schema.js';

const panelRegistry = new Map();

/**
 * Registers a PanelKit panel definition.
 * @param {object} panelDefinition - The panel schema definition.
 */
export function registerPanelKitPanel(panelDefinition) {
  if (panelRegistry.has(panelDefinition.id)) {
    console.warn(`PanelKit: Panel with ID "${panelDefinition.id}" is already registered.`);
    return;
  }
  panelRegistry.set(panelDefinition.id, {
    type: 'panelkit',
    definition: panelDefinition,
  });
  console.log(`PanelKit: Registered panel "${panelDefinition.title}"`);
}

/**
 * Creates and renders a PanelKit panel.
 * @param {string} panelId - The ID of the panel to render.
 * @param {HTMLElement} container - The container element to render into.
 * @param {object} store - The Redux store.
 * @param {function} dispatch - The Redux dispatch function.
 * @returns {object|null} The renderer instance or null if not found.
 */
export function createPanelKitPanel(panelId, container, store, dispatch) {
  const panelInfo = panelRegistry.get(panelId);
  if (!panelInfo || panelInfo.type !== 'panelkit') {
    console.error(`PanelKit: Panel with ID "${panelId}" not found or is not a PanelKit panel.`);
    return null;
  }
  const renderer = new PanelKitRenderer(store, dispatch);
  return renderer.render(panelInfo.definition, container);
}

/**
 * Converts a legacy panel class into a basic PanelKit definition.
 * @param {class} LegacyPanelClass - The legacy panel class.
 * @param {object} metadata - Additional metadata (id, title, order).
 */
export function migrateLegacyPanel(LegacyPanelClass, metadata) {
  const panelDefinition = {
    ...metadata,
    layout: {
      type: 'custom',
      render: (container, context) => {
        const panelInstance = new LegacyPanelClass(container, context.store, context.dispatch);
        return panelInstance.element;
      }
    }
  };
  registerPanelKitPanel(panelDefinition);
}

// Example of registering a legacy panel
// import { SomeLegacyPanel } from './legacy/some-legacy-panel.js';
// migrateLegacyPanel(SomeLegacyPanel, {
//   id: 'legacy-panel',
//   title: 'Legacy Panel',
//   order: 100
// });

// ===== DSUI PANEL ADAPTER =====

export class DSUIPanelAdapter {
  constructor(panelDefinition) {
    this.definition = panelDefinition;
    this.renderer = null;
    this.container = null;
    this.panelInstance = null;
  }
  
  // Adapter to make DSUI panels compatible with existing panel system
  createPanelClass() {
    const definition = this.definition;
    
    return class DSUIPanel {
      constructor(containerElement) {
        this.container = containerElement;
        this.definition = definition;
        this.renderer = new DSUIRenderer(appStore, dispatch);
        
        // Register components
        new DSUIComponents(this.renderer);
        
        // Register custom action handlers
        this.registerActionHandlers();
        
        // Render the panel
        this.panelInstance = this.renderer.render(definition, containerElement);
        
        // Setup cleanup
        this.cleanup = this.panelInstance.destroy;
      }
      
      registerActionHandlers() {
        // Register action handlers from the definition
        if (this.definition.actions) {
          Object.entries(this.definition.actions).forEach(([type, handler]) => {
            this.renderer.registerActionHandler(type, handler);
          });
        }
        
        // Register common DevPages action handlers
        this.registerDevPagesActionHandlers();
      }
      
      registerDevPagesActionHandlers() {
        // Theme validation
        this.renderer.registerActionHandler('validate-theme', async (action, context) => {
          const { themeDir } = context.getState();
          if (!themeDir) {
            context.showNotification('error', 'No theme directory specified');
            return;
          }
          
          try {
            const files = ['core.css', 'light.css', 'dark.css'];
            const results = await Promise.all(
              files.map(file => this.checkFileExists(`${themeDir}/${file}`))
            );
            
            const missing = files.filter((file, index) => !results[index]);
            if (missing.length > 0) {
              context.showNotification('warning', `Missing files: ${missing.join(', ')}`);
            } else {
              context.showNotification('success', 'Theme validation successful');
            }
          } catch (error) {
            context.showNotification('error', `Validation failed: ${error.message}`);
          }
        });
        
        // Theme reload
        this.renderer.registerActionHandler('reload-theme', (action, context) => {
          if (window.pageThemeManager) {
            window.pageThemeManager.reloadTheme();
            context.showNotification('info', 'Theme reloaded');
          }
        });
        
        // Export tokens
        this.renderer.registerActionHandler('export-tokens', (action, context) => {
          const tokens = this.extractDesignTokens();
          this.downloadFile('design-tokens.json', JSON.stringify(tokens, null, 2));
          context.showNotification('success', 'Design tokens exported');
        });
        
        // Show add CSS form
        this.renderer.registerActionHandler('show-add-css-form', (action, context) => {
          // Implementation for showing CSS add form
          console.log('Show add CSS form');
        });
      }
      
      async checkFileExists(url) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          return response.ok;
        } catch {
          return false;
        }
      }
      
      extractDesignTokens() {
        const computedStyle = getComputedStyle(document.documentElement);
        const tokens = {};
        
        // Extract CSS custom properties
        const properties = [
          '--font-size-h1', '--font-size-h2', '--font-size-body',
          '--color-primary', '--color-background', '--color-foreground',
          '--space-sm', '--space-md', '--space-lg',
          '--radius-sm', '--radius-md', '--radius-lg'
        ];
        
        properties.forEach(prop => {
          const value = computedStyle.getPropertyValue(prop).trim();
          if (value) {
            tokens[prop] = value;
          }
        });
        
        return tokens;
      }
      
      downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
      }
      
      destroy() {
        if (this.cleanup) {
          this.cleanup();
        }
      }
    };
  }
}

// ===== MIGRATION UTILITIES =====

export class DSUIMigrationHelper {
  static convertExistingPanel(existingPanelClass, panelId) {
    // Analyze existing panel and generate DSUI definition
    const definition = this.analyzePanel(existingPanelClass, panelId);
    return new DSUIPanelAdapter(definition);
  }
  
  static analyzePanel(panelClass, panelId) {
    // Basic analysis - in practice this would be more sophisticated
    return {
      id: panelId,
      title: this.extractTitle(panelClass),
      layout: {
        type: 'sections',
        children: this.extractComponents(panelClass)
      }
    };
  }
  
  static extractTitle(panelClass) {
    // Extract title from class name or other metadata
    return panelClass.name.replace(/Panel$/, '').replace(/([A-Z])/g, ' $1').trim();
  }
  
  static extractComponents(panelClass) {
    // Analyze the panel's render method to extract components
    // This is a simplified example
    return [
      {
        type: 'section',
        label: 'Settings',
        children: [
          {
            type: 'description',
            props: {
              text: 'This panel has been automatically converted to DSUI format.'
            }
          }
        ]
      }
    ];
  }
}

// ===== REGISTRATION HELPERS =====

export function registerDSUIPanel(definition) {
  const adapter = new DSUIPanelAdapter(definition);
  const PanelClass = adapter.createPanelClass();
  
  panelRegistry.register({
    id: definition.id,
    title: definition.title,
    component: PanelClass,
    order: definition.order || 100,
    defaultCollapsed: definition.defaultCollapsed || false
  });
  
  return adapter;
}

export function migrateLegacyPanel(legacyPanelClass, config) {
  const adapter = DSUIMigrationHelper.convertExistingPanel(legacyPanelClass, config.id);
  
  panelRegistry.register({
    id: config.id,
    title: config.title,
    component: adapter.createPanelClass(),
    order: config.order || 100,
    defaultCollapsed: config.defaultCollapsed || false
  });
  
  return adapter;
}

// ===== ENHANCED DSUI RENDERER =====

export class EnhancedDSUIRenderer extends DSUIRenderer {
  constructor(store, actionDispatcher) {
    super(store, actionDispatcher);
    this.setupDevPagesIntegration();
  }
  
  setupDevPagesIntegration() {
    // Enhanced notification system
    this.showNotification = (type, message) => {
      if (window.showNotification) {
        window.showNotification(type, message);
      } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    };
    
    // Enhanced file checking
    this.checkFileExists = async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
      } catch {
        return false;
      }
    };
    
    // Enhanced state management
    this.updatePanelState = (panelId, updates) => {
      // Update local panel state
      const currentState = this.getPanelState(panelId) || {};
      const newState = { ...currentState, ...updates };
      
      // Store in a panel-specific namespace
      this.dispatch({
        type: 'DSUI_UPDATE_PANEL_STATE',
        payload: { panelId, state: newState }
      });
    };
    
    this.getPanelState = (panelId) => {
      const state = this.store.getState();
      return state.dsui?.[panelId] || {};
    };
  }
  
  createRenderContext(panelDefinition) {
    const baseContext = super.createRenderContext(panelDefinition);
    
    return {
      ...baseContext,
      // Enhanced DevPages-specific context
      pageThemeManager: window.pageThemeManager,
      settingsPanel: window.settingsPanel,
      logMessage: window.logMessage,
      
      // Helper methods
      reloadTheme: () => {
        if (window.pageThemeManager) {
          window.pageThemeManager.reloadTheme();
        }
      },
      
      validateTheme: async (themeDir) => {
        const files = ['core.css', 'light.css', 'dark.css'];
        const results = await Promise.all(
          files.map(file => this.checkFileExists(`${themeDir}/${file}`))
        );
        return {
          valid: results.every(Boolean),
          missing: files.filter((file, index) => !results[index])
        };
      },
      
      exportDesignTokens: () => {
        const computedStyle = getComputedStyle(document.documentElement);
        const tokens = {};
        
        // Extract all CSS custom properties
        for (let i = 0; i < computedStyle.length; i++) {
          const property = computedStyle[i];
          if (property.startsWith('--')) {
            tokens[property] = computedStyle.getPropertyValue(property).trim();
          }
        }
        
        return tokens;
      }
    };
  }
}

// ===== USAGE EXAMPLES =====

// Example 1: Register a new DSUI panel
export function createDesignTokensPanel() {
  const definition = {
    id: 'design-tokens-panel-dsui',
    title: 'Design Tokens (DSUI)',
    description: 'Modern design tokens panel built with DSUI',
    order: 15,
    
    layout: {
      type: 'sections',
      children: [
        {
          type: 'section',
          label: 'Theme Configuration',
          children: [
            {
              type: 'text',
              id: 'theme-dir',
              label: 'Theme Directory',
              description: 'Path to theme directory',
              props: {
                placeholder: '/themes/classic'
              },
              state: {
                path: 'pageTheme.themeDir',
                action: 'SETTINGS_SET_PAGE_THEME_DIR'
              },
              validation: [
                { type: 'required', message: 'Theme directory is required' }
              ]
            },
            {
              type: 'radio',
              id: 'theme-mode',
              label: 'Theme Mode',
              props: {
                options: [
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' }
                ],
                inline: true
              },
              state: {
                path: 'pageTheme.themeMode',
                action: 'SETTINGS_SET_PAGE_THEME_MODE'
              }
            }
          ]
        },
        {
          type: 'section',
          label: 'Actions',
          children: [
            {
              type: 'group',
              props: { layout: 'horizontal', gap: 'sm' },
              children: [
                {
                  type: 'button',
                  label: 'Validate Theme',
                  props: { variant: 'secondary' },
                  actions: [{ type: 'validate-theme' }]
                },
                {
                  type: 'button',
                  label: 'Export Tokens',
                  props: { variant: 'secondary' },
                  actions: [{ type: 'export-tokens' }]
                }
              ]
            }
          ]
        }
      ]
    }
  };
  
  return registerDSUIPanel(definition);
}

// Example 2: Migrate existing panel
export function migrateThemeSettingsPanel() {
  // This would migrate the existing ThemeSettingsPanel to DSUI
  return migrateLegacyPanel(null, {
    id: 'theme-settings-migrated',
    title: 'Theme Settings (Migrated)',
    order: 25
  });
}

// ===== INITIALIZATION =====

export function initializeDSUI() {
  // Replace the default renderer with enhanced version
  window.DSUIRenderer = EnhancedDSUIRenderer;
  
  // Register DSUI panels
  // createDesignTokensPanel();
  
  console.log('DSUI system initialized');
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDSUI);
  } else {
    initializeDSUI();
  }
} 