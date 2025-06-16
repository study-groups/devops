/**
 * DevPages Settings UI Layout Language (DSUI)
 * Comprehensive schema and runtime for declarative settings panels
 */

// ===== CORE SCHEMA DEFINITIONS =====

export const ComponentTypes = {
  // Layout Components
  SECTION: 'section',
  SUBSECTION: 'subsection', 
  GROUP: 'group',
  GRID: 'grid',
  FLEX: 'flex',
  TABS: 'tabs',
  ACCORDION: 'accordion',
  
  // Input Components
  TEXT: 'text',
  NUMBER: 'number',
  EMAIL: 'email',
  URL: 'url',
  PASSWORD: 'password',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  TOGGLE: 'toggle',
  SLIDER: 'slider',
  COLOR: 'color',
  FILE: 'file',
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime',
  
  // Display Components
  LABEL: 'label',
  DESCRIPTION: 'description',
  CODE: 'code',
  PREVIEW: 'preview',
  STATUS: 'status',
  BADGE: 'badge',
  PROGRESS: 'progress',
  
  // Action Components
  BUTTON: 'button',
  LINK: 'link',
  DROPDOWN: 'dropdown',
  MENU: 'menu',
  
  // Advanced Components
  THEME_EDITOR: 'theme-editor',
  CSS_EDITOR: 'css-editor',
  TOKEN_GRID: 'token-grid',
  COLOR_PALETTE: 'color-palette',
  FONT_PICKER: 'font-picker',
  
  // Custom Components
  CUSTOM: 'custom'
};

export const LayoutTypes = {
  SECTIONS: 'sections',
  TABS: 'tabs', 
  WIZARD: 'wizard',
  GRID: 'grid',
  FLEX: 'flex'
};

export const ValidationTypes = {
  REQUIRED: 'required',
  MIN_LENGTH: 'minLength',
  MAX_LENGTH: 'maxLength',
  PATTERN: 'pattern',
  MIN: 'min',
  MAX: 'max',
  EMAIL: 'email',
  URL: 'url',
  CUSTOM: 'custom'
};

// ===== EXAMPLE PANEL DEFINITIONS =====

export const DesignTokensPanelDefinition = {
  id: 'design-tokens-panel',
  title: 'Design Tokens',
  description: 'Manage page themes and design tokens',
  order: 10,
  defaultCollapsed: false,
  icon: '🎨',
  category: 'theming',
  
  layout: {
    type: LayoutTypes.SECTIONS,
    responsive: {
      breakpoints: {
        mobile: 768,
        tablet: 1024
      },
      behavior: 'stack'
    },
    children: [
      {
        type: ComponentTypes.SECTION,
        id: 'theme-config',
        label: 'Theme Configuration',
        children: [
          {
            type: ComponentTypes.GROUP,
            id: 'theme-directory-group',
            children: [
              {
                type: ComponentTypes.TEXT,
                id: 'theme-dir-input',
                label: 'Theme Directory',
                description: 'Path to theme directory containing core.css, light.css, and dark.css',
                props: {
                  placeholder: '/themes/classic',
                  pattern: '^/.*',
                },
                validation: [
                  { type: ValidationTypes.REQUIRED, message: 'Theme directory is required' },
                  { type: ValidationTypes.PATTERN, pattern: '^/.*', message: 'Must start with /' }
                ],
                state: {
                  path: 'pageTheme.themeDir',
                  action: 'SETTINGS_SET_PAGE_THEME_DIR'
                }
              },
              {
                type: ComponentTypes.RADIO,
                id: 'theme-mode-switcher',
                label: 'Active Theme Mode',
                props: {
                  options: [
                    { value: 'light', label: 'Light', icon: '☀️' },
                    { value: 'dark', label: 'Dark', icon: '🌙' }
                  ],
                  inline: true
                },
                state: {
                  path: 'pageTheme.themeMode',
                  action: 'SETTINGS_SET_PAGE_THEME_MODE'
                }
              }
            ]
          }
        ]
      },
      
      {
        type: ComponentTypes.SECTION,
        id: 'responsive-design',
        label: 'Responsive Design',
        children: [
          {
            type: ComponentTypes.NUMBER,
            id: 'mobile-breakpoint',
            label: 'Mobile Breakpoint',
            description: 'Breakpoint in pixels for mobile/desktop switch',
            props: {
              min: 320,
              max: 1440,
              step: 1,
              unit: 'px',
              defaultValue: 1024
            },
            validation: [
              { type: ValidationTypes.MIN, value: 320, message: 'Minimum breakpoint is 320px' },
              { type: ValidationTypes.MAX, value: 1440, message: 'Maximum breakpoint is 1440px' }
            ]
          },
          {
            type: ComponentTypes.RADIO,
            id: 'preview-mode',
            label: 'Preview Mode',
            props: {
              options: [
                { value: 'desktop', label: 'Desktop' },
                { value: 'mobile', label: 'Mobile (1024px)' }
              ],
              inline: true
            }
          }
        ]
      },
      
      {
        type: ComponentTypes.SECTION,
        id: 'theme-presets',
        label: 'Quick Presets',
        children: [
          {
            type: ComponentTypes.GROUP,
            id: 'preset-buttons',
            props: {
              layout: 'horizontal',
              gap: 'sm'
            },
            children: [
              {
                type: ComponentTypes.BUTTON,
                id: 'preset-classic',
                label: 'Classic',
                props: {
                  variant: 'secondary',
                  preset: 'classic'
                },
                actions: [
                  { type: 'apply-preset', preset: 'classic' }
                ]
              },
              {
                type: ComponentTypes.BUTTON,
                id: 'preset-modern',
                label: 'Modern',
                props: {
                  variant: 'secondary',
                  preset: 'modern'
                },
                actions: [
                  { type: 'apply-preset', preset: 'modern' }
                ]
              },
              {
                type: ComponentTypes.BUTTON,
                id: 'preset-minimal',
                label: 'Minimal',
                props: {
                  variant: 'secondary',
                  preset: 'minimal'
                },
                actions: [
                  { type: 'apply-preset', preset: 'minimal' }
                ]
              }
            ]
          }
        ]
      },
      
      {
        type: ComponentTypes.SECTION,
        id: 'theme-status',
        label: 'Theme Status',
        children: [
          {
            type: ComponentTypes.STATUS,
            id: 'current-theme-status',
            props: {
              items: [
                {
                  label: 'Current',
                  value: { path: 'pageTheme.currentTheme', fallback: 'None' },
                  type: 'text'
                },
                {
                  label: 'Files Loaded',
                  value: { path: 'pageTheme.loadedFiles', fallback: 0 },
                  type: 'number'
                }
              ]
            }
          }
        ]
      },
      
      {
        type: ComponentTypes.SECTION,
        id: 'theme-actions',
        label: 'Actions',
        children: [
          {
            type: ComponentTypes.GROUP,
            id: 'action-buttons',
            props: {
              layout: 'horizontal',
              gap: 'sm',
              wrap: true
            },
            children: [
              {
                type: ComponentTypes.BUTTON,
                id: 'validate-theme',
                label: 'Validate Theme',
                props: {
                  variant: 'secondary'
                },
                actions: [
                  { type: 'validate-theme' }
                ]
              },
              {
                type: ComponentTypes.BUTTON,
                id: 'reload-theme',
                label: 'Reload Theme',
                props: {
                  variant: 'secondary'
                },
                actions: [
                  { type: 'reload-theme' }
                ]
              },
              {
                type: ComponentTypes.BUTTON,
                id: 'export-tokens',
                label: 'Export Tokens',
                props: {
                  variant: 'secondary'
                },
                actions: [
                  { type: 'export-tokens' }
                ]
              },
              {
                type: ComponentTypes.BUTTON,
                id: 'edit-theme',
                label: 'Edit Theme',
                props: {
                  variant: 'secondary',
                  toggle: true
                },
                actions: [
                  { type: 'toggle-theme-editor' }
                ]
              }
            ]
          }
        ]
      },
      
      {
        type: ComponentTypes.SECTION,
        id: 'theme-editor',
        label: 'Theme Editor',
        props: {
          collapsible: true,
          defaultCollapsed: true
        },
        conditions: [
          { path: 'ui.themeEditorVisible', operator: 'equals', value: true }
        ],
        children: [
          {
            type: ComponentTypes.THEME_EDITOR,
            id: 'advanced-theme-editor',
            props: {
              sections: ['typography', 'colors', 'spacing', 'preview'],
              livePreview: true,
              exportFormats: ['css', 'json', 'scss']
            }
          }
        ]
      }
    ]
  },
  
  state: {
    namespace: 'designTokens',
    initialState: {
      themeDir: '',
      themeMode: 'light',
      mobileBreakpoint: 1024,
      previewMode: 'desktop',
      themeEditorVisible: false
    },
    computed: {
      isThemeValid: (state) => state.themeDir && state.themeDir.length > 0,
      currentBreakpoint: (state) => `${state.mobileBreakpoint}px`
    }
  },
  
  actions: {
    'apply-preset': async (preset, context) => {
      const presets = {
        classic: { themeDir: '/themes/classic', colors: { primary: '#2563eb' } },
        modern: { themeDir: '/themes/modern', colors: { primary: '#7c3aed' } },
        minimal: { themeDir: '/themes/minimal', colors: { primary: '#059669' } }
      };
      
      const presetConfig = presets[preset];
      if (presetConfig) {
        context.dispatch('SETTINGS_SET_PAGE_THEME_DIR', presetConfig.themeDir);
        context.updateState({ preset: preset });
      }
    },
    
    'validate-theme': async (payload, context) => {
      const { themeDir } = context.getState();
      if (!themeDir) {
        context.showNotification('error', 'No theme directory specified');
        return;
      }
      
      try {
        const files = ['core.css', 'light.css', 'dark.css'];
        const results = await Promise.all(
          files.map(file => context.checkFileExists(`${themeDir}/${file}`))
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
    },
    
    'toggle-theme-editor': (payload, context) => {
      const { themeEditorVisible } = context.getState();
      context.updateState({ themeEditorVisible: !themeEditorVisible });
    }
  },
  
  validation: {
    rules: {
      themeDirectory: {
        required: true,
        pattern: '^/.*',
        custom: async (value) => {
          // Custom validation logic
          return value.startsWith('/themes/');
        }
      }
    },
    messages: {
      themeDirectory: {
        required: 'Theme directory is required',
        pattern: 'Theme directory must start with /',
        custom: 'Theme directory should be under /themes/'
      }
    }
  }
};

// ===== CSS SETTINGS PANEL DEFINITION =====

export const CssSettingsPanelDefinition = {
  id: 'css-settings-panel',
  title: 'CSS Settings',
  description: 'Manage CSS files and rendering options',
  order: 20,
  
  layout: {
    type: LayoutTypes.SECTIONS,
    children: [
      {
        type: ComponentTypes.SECTION,
        id: 'rendering-mode',
        label: 'Rendering Mode',
        children: [
          {
            type: ComponentTypes.RADIO,
            id: 'preview-mode-select',
            props: {
              options: [
                {
                  value: 'direct',
                  label: 'Direct Attachment',
                  description: 'Render content directly in the preview container (faster, may have CSS conflicts)'
                },
                {
                  value: 'iframe',
                  label: 'Iframe Isolation', 
                  description: 'Render content in an isolated iframe (better CSS isolation, slightly slower)'
                }
              ]
            },
            state: {
              path: 'settings.preview.renderMode',
              action: 'SETTINGS_SET_PREVIEW_MODE'
            }
          }
        ]
      },
      
      {
        type: ComponentTypes.SECTION,
        id: 'css-files',
        label: 'CSS Files',
        children: [
          {
            type: ComponentTypes.GROUP,
            id: 'css-files-header',
            children: [
              {
                type: ComponentTypes.BUTTON,
                id: 'add-css-file',
                label: '+ Add File',
                props: {
                  variant: 'primary',
                  size: 'sm'
                },
                actions: [
                  { type: 'show-add-css-form' }
                ]
              }
            ]
          },
          {
            type: ComponentTypes.CSS_EDITOR,
            id: 'css-file-manager',
            props: {
              showDefaultFile: true,
              allowReorder: true,
              validation: {
                pathPattern: '^(@[a-z]+/|/|https?://)',
                extensions: ['.css']
              }
            },
            state: {
              path: 'settings.preview.cssFiles',
              actions: {
                add: 'SETTINGS_ADD_PREVIEW_CSS',
                remove: 'SETTINGS_REMOVE_PREVIEW_CSS',
                toggle: 'SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED'
              }
            }
          }
        ]
      },
      
      {
        type: ComponentTypes.SECTION,
        id: 'css-options',
        label: 'CSS Options',
        children: [
          {
            type: ComponentTypes.CHECKBOX,
            id: 'bundle-css',
            label: 'Bundle CSS for publishing',
            state: {
              path: 'settings.preview.bundleCss',
              action: 'SETTINGS_SET_CSS_BUNDLING_ENABLED'
            }
          },
          {
            type: ComponentTypes.TEXT,
            id: 'css-prefix',
            label: 'CSS URL Prefix',
            description: 'Used when CSS bundling is disabled',
            props: {
              placeholder: 'https://cdn.example.com/css/'
            },
            conditions: [
              { path: 'settings.preview.bundleCss', operator: 'equals', value: false }
            ],
            state: {
              path: 'settings.preview.cssPrefix',
              action: 'SETTINGS_SET_CSS_PREFIX'
            }
          }
        ]
      }
    ]
  }
};

// ===== RUNTIME SYSTEM =====

export class DSUIRenderer {
  constructor(store, actionDispatcher) {
    this.store = store;
    this.dispatch = actionDispatcher;
    this.componentRegistry = new Map();
    this.validators = new Map();
    this.actionHandlers = new Map();
    
    this.registerDefaultComponents();
    this.registerDefaultValidators();
  }
  
  registerComponent(type, renderer) {
    this.componentRegistry.set(type, renderer);
  }
  
  registerValidator(type, validator) {
    this.validators.set(type, validator);
  }
  
  registerActionHandler(type, handler) {
    this.actionHandlers.set(type, handler);
  }
  
  render(panelDefinition, containerElement) {
    const context = this.createRenderContext(panelDefinition);
    const element = this.renderLayout(panelDefinition.layout, context);
    containerElement.appendChild(element);
    
    // Setup state subscriptions
    this.setupStateSubscriptions(panelDefinition, element, context);
    
    return {
      element,
      context,
      destroy: () => this.destroyPanel(element, context)
    };
  }
  
  createRenderContext(panelDefinition) {
    return {
      panelId: panelDefinition.id,
      state: this.store.getState(),
      dispatch: this.dispatch,
      validators: this.validators,
      actionHandlers: this.actionHandlers,
      updateState: (updates) => this.updatePanelState(panelDefinition.id, updates),
      getState: () => this.getPanelState(panelDefinition.id),
      showNotification: (type, message) => this.showNotification(type, message),
      checkFileExists: (url) => this.checkFileExists(url)
    };
  }
  
  renderLayout(layout, context) {
    const container = document.createElement('div');
    container.className = `dsui-layout dsui-layout--${layout.type}`;
    
    if (layout.responsive) {
      this.applyResponsiveLayout(container, layout.responsive);
    }
    
    layout.children.forEach(child => {
      const childElement = this.renderComponent(child, context);
      if (childElement) {
        container.appendChild(childElement);
      }
    });
    
    return container;
  }
  
  renderComponent(component, context) {
    // Check conditions
    if (component.conditions && !this.evaluateConditions(component.conditions, context)) {
      return null;
    }
    
    const renderer = this.componentRegistry.get(component.type);
    if (!renderer) {
      console.warn(`No renderer found for component type: ${component.type}`);
      return null;
    }
    
    return renderer(component, context);
  }
  
  evaluateConditions(conditions, context) {
    return conditions.every(condition => {
      const value = this.getValueByPath(context.state, condition.path);
      switch (condition.operator) {
        case 'equals': return value === condition.value;
        case 'not-equals': return value !== condition.value;
        case 'greater-than': return value > condition.value;
        case 'less-than': return value < condition.value;
        case 'contains': return Array.isArray(value) && value.includes(condition.value);
        case 'exists': return value !== undefined && value !== null;
        default: return true;
      }
    });
  }
  
  getValueByPath(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  setValueByPath(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
  
  registerDefaultComponents() {
    // Register all default component renderers
    this.registerComponent(ComponentTypes.SECTION, this.renderSection.bind(this));
    this.registerComponent(ComponentTypes.GROUP, this.renderGroup.bind(this));
    this.registerComponent(ComponentTypes.TEXT, this.renderTextInput.bind(this));
    this.registerComponent(ComponentTypes.NUMBER, this.renderNumberInput.bind(this));
    this.registerComponent(ComponentTypes.RADIO, this.renderRadioGroup.bind(this));
    this.registerComponent(ComponentTypes.CHECKBOX, this.renderCheckbox.bind(this));
    this.registerComponent(ComponentTypes.BUTTON, this.renderButton.bind(this));
    this.registerComponent(ComponentTypes.STATUS, this.renderStatus.bind(this));
    // ... more component renderers
  }
  
  renderSection(component, context) {
    const section = document.createElement('div');
    section.className = 'dsui-section';
    section.id = component.id;
    
    if (component.label) {
      const header = document.createElement('h4');
      header.className = 'dsui-section-header';
      header.textContent = component.label;
      section.appendChild(header);
    }
    
    const content = document.createElement('div');
    content.className = 'dsui-section-content';
    
    if (component.children) {
      component.children.forEach(child => {
        const childElement = this.renderComponent(child, context);
        if (childElement) {
          content.appendChild(childElement);
        }
      });
    }
    
    section.appendChild(content);
    return section;
  }
  
  renderTextInput(component, context) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dsui-input-group';
    
    if (component.label) {
      const label = document.createElement('label');
      label.className = 'dsui-label';
      label.textContent = component.label;
      label.setAttribute('for', component.id);
      wrapper.appendChild(label);
    }
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = component.id;
    input.className = 'dsui-input dsui-input--text';
    
    if (component.props) {
      Object.entries(component.props).forEach(([key, value]) => {
        if (key === 'placeholder') input.placeholder = value;
        if (key === 'pattern') input.pattern = value;
      });
    }
    
    // Setup state binding
    if (component.state) {
      const currentValue = this.getValueByPath(context.state, component.state.path);
      if (currentValue !== undefined) {
        input.value = currentValue;
      }
      
      input.addEventListener('change', (e) => {
        context.dispatch({
          type: component.state.action,
          payload: e.target.value
        });
      });
    }
    
    wrapper.appendChild(input);
    
    if (component.description) {
      const desc = document.createElement('small');
      desc.className = 'dsui-description';
      desc.textContent = component.description;
      wrapper.appendChild(desc);
    }
    
    return wrapper;
  }
  
  // ... more component renderers
  
  registerDefaultValidators() {
    this.registerValidator(ValidationTypes.REQUIRED, (value) => {
      return value !== undefined && value !== null && value !== '';
    });
    
    this.registerValidator(ValidationTypes.PATTERN, (value, rule) => {
      const regex = new RegExp(rule.pattern);
      return regex.test(value);
    });
    
    this.registerValidator(ValidationTypes.MIN_LENGTH, (value, rule) => {
      return value && value.length >= rule.value;
    });
    
    // ... more validators
  }
}

// ===== USAGE EXAMPLE =====

export function createDesignTokensPanel(container, store, dispatch) {
  const renderer = new DSUIRenderer(store, dispatch);
  return renderer.render(DesignTokensPanelDefinition, container);
} 