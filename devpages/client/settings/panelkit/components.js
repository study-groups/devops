/**
 * PanelKit Component Library
 * Component renderers for the PanelKit declarative UI system.
 */

import { ComponentTypes } from './schema.js';

// ===== COMPONENT RENDERERS =====

export class PanelKitComponents {
  constructor(renderer) {
    this.renderer = renderer;
    this.registerAllComponents();
  }
  
  registerAllComponents() {
    // Layout components
    this.renderer.registerComponent(LayoutTypes.SECTIONS, this.renderSection.bind(this));
    this.renderer.registerComponent(LayoutTypes.TABS, this.renderTabs.bind(this));
    this.renderer.registerComponent(LayoutTypes.WIZARD, this.renderWizard.bind(this));
    this.renderer.registerComponent(LayoutTypes.GRID, this.renderGrid.bind(this));
    this.renderer.registerComponent(LayoutTypes.FLEX, this.renderFlex.bind(this));
    
    // Basic components
    this.renderer.registerComponent(ComponentTypes.SECTION, this.renderSection.bind(this));
    this.renderer.registerComponent(ComponentTypes.GROUP, this.renderGroup.bind(this));
    this.renderer.registerComponent(ComponentTypes.TEXT, this.renderTextInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.NUMBER, this.renderNumberInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.RADIO, this.renderRadioGroup.bind(this));
    this.renderer.registerComponent(ComponentTypes.CHECKBOX, this.renderCheckbox.bind(this));
    this.renderer.registerComponent(ComponentTypes.SLIDER, this.renderSlider.bind(this));
    this.renderer.registerComponent(ComponentTypes.COLOR, this.renderColorInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.STATUS, this.renderStatus.bind(this));
    this.renderer.registerComponent(ComponentTypes.BADGE, this.renderBadge.bind(this));
    this.renderer.registerComponent(ComponentTypes.BUTTON, this.renderButton.bind(this));
    
    // Theme editor specific components
    this.renderer.registerComponent(ComponentTypes.THEME_EDITOR, this.renderThemeEditor.bind(this));
    this.renderer.registerComponent(ComponentTypes.CSS_EDITOR, this.renderCssEditor.bind(this));
    this.renderer.registerComponent(ComponentTypes.TOKEN_GRID, this.renderTokenGrid.bind(this));
    this.renderer.registerComponent(ComponentTypes.COLOR_PALETTE, this.renderColorPalette.bind(this));
    this.renderer.registerComponent(ComponentTypes.FONT_PICKER, this.renderFontPicker.bind(this));
    this.renderer.registerComponent('theme-preview', this.renderThemePreview.bind(this));
    
    // Enhanced Theme Editor Components
    this.renderer.registerComponent('preset-selector', this.renderPresetSelector.bind(this));
    this.renderer.registerComponent('design-token-category', this.renderDesignTokenCategory.bind(this));
    this.renderer.registerComponent('advanced-theme-preview', this.renderAdvancedThemePreview.bind(this));
    this.renderer.registerComponent('theme-export-controls', this.renderThemeExportControls.bind(this));
  }
  
  // ===== LAYOUT COMPONENTS =====
  
  renderSection(component, context) {
    const section = document.createElement('div');
    section.className = 'panelkit-section';
    if (component.id) section.id = component.id;
    
    if (component.label) {
      const header = document.createElement('h4');
      header.className = 'panelkit-section-header';
      header.textContent = component.label;
      section.appendChild(header);
    }
    
    if (component.description) {
      const desc = document.createElement('p');
      desc.className = 'panelkit-section-description';
      desc.textContent = component.description;
      section.appendChild(desc);
    }
    
    const content = document.createElement('div');
    content.className = 'panelkit-section-content';
    
    if (component.children) {
      component.children.forEach(child => {
        const childElement = this.renderer.renderComponent(child, context);
        if (childElement) {
          content.appendChild(childElement);
        }
      });
    }
    section.appendChild(content);
    
    return section;
  }
  
  renderGroup(component, context) {
    const group = document.createElement('div');
    group.className = 'panelkit-group';
    if (component.id) group.id = component.id;
    
    // Apply layout props
    if (component.props?.layout === 'horizontal') {
      group.classList.add('panelkit-group--horizontal');
    }
    if (component.props?.gap) {
      group.classList.add(`panelkit-group--gap-${component.props.gap}`);
    }
    if (component.props?.wrap) {
      group.classList.add('panelkit-group--wrap');
    }
    
    if (component.children) {
      component.children.forEach(child => {
        const childElement = this.renderer.renderComponent(child, context);
        if (childElement) {
          group.appendChild(childElement);
        }
      });
    }
    
    return group;
  }
  
  renderGrid(component, context) {
    const grid = document.createElement('div');
    grid.className = 'panelkit-grid';
    if (component.id) grid.id = component.id;
    
    if (component.props?.columns) {
      grid.style.gridTemplateColumns = `repeat(${component.props.columns}, 1fr)`;
    }
    if (component.props?.gap) {
      grid.style.gap = `var(--space-${component.props.gap})`;
    }
    
    if (component.children) {
      component.children.forEach(child => {
        const childElement = this.renderer.renderComponent(child, context);
        if (childElement) {
          grid.appendChild(childElement);
        }
      });
    }
    
    return grid;
  }
  
  // ===== INPUT COMPONENTS =====
  
  renderTextInput(component, context) {
    const wrapper = this.createInputWrapper(component);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = component.id;
    input.className = 'panelkit-input panelkit-input--text';
    
    // Apply props
    if (component.props) {
      if (component.props.placeholder) input.placeholder = component.props.placeholder;
      if (component.props.pattern) input.pattern = component.props.pattern;
      if (component.props.maxLength) input.maxLength = component.props.maxLength;
      if (component.props.readonly) input.readOnly = true;
      if (component.props.disabled) input.disabled = true;
    }
    
    // Setup state binding
    this.setupStateBinding(input, component, context, 'value');
    
    wrapper.appendChild(input);
    this.appendDescription(wrapper, component.description);
    return wrapper;
  }
  
  renderNumberInput(component, context) {
    const wrapper = this.createInputWrapper(component);
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'panelkit-input-wrapper';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = component.id;
    input.className = 'panelkit-input panelkit-input--number';
    
    // Apply props
    if (component.props) {
      if (component.props.min !== undefined) input.min = component.props.min;
      if (component.props.max !== undefined) input.max = component.props.max;
      if (component.props.step !== undefined) input.step = component.props.step;
      if (component.props.defaultValue !== undefined) input.value = component.props.defaultValue;
    }
    
    inputWrapper.appendChild(input);
    
    // Add unit display if specified
    if (component.props?.unit) {
      const unit = document.createElement('span');
      unit.className = 'panelkit-unit';
      unit.textContent = component.props.unit;
      inputWrapper.appendChild(unit);
    }
    
    // Setup state binding
    this.setupStateBinding(input, component, context, 'value', 'number');
    
    wrapper.appendChild(inputWrapper);
    this.appendDescription(wrapper, component.description);
    return wrapper;
  }
  
  renderRadioGroup(component, context) {
    const wrapper = this.createInputWrapper(component);
    
    const radioGroup = document.createElement('div');
    radioGroup.className = component.props?.inline ? 'panelkit-radio-group panelkit-radio-group--inline' : 'panelkit-radio-group';
    
    if (component.props?.options) {
      component.props.options.forEach((option, index) => {
        const radioWrapper = document.createElement('label');
        radioWrapper.className = 'panelkit-radio-option';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = component.id;
        radio.value = option.value;
        radio.id = `${component.id}-${index}`;
        
        const radioLabel = document.createElement('span');
        radioLabel.textContent = option.label;
        
        if (option.icon) {
          const icon = document.createElement('span');
          icon.className = 'panelkit-radio-icon';
          icon.textContent = option.icon;
          radioWrapper.appendChild(icon);
        }
        
        radioWrapper.appendChild(radio);
        radioWrapper.appendChild(radioLabel);
        
        if (option.description) {
          const desc = document.createElement('small');
          desc.className = 'panelkit-radio-description';
          desc.textContent = option.description;
          radioWrapper.appendChild(desc);
        }
        
        radioGroup.appendChild(radioWrapper);
      });
    }
    
    // Setup state binding for radio group
    this.setupRadioGroupBinding(radioGroup, component, context);
    
    wrapper.appendChild(radioGroup);
    
    return wrapper;
  }
  
  renderCheckbox(component, context) {
    const wrapper = document.createElement('div');
    wrapper.className = 'panelkit-input-group';
    
    const checkboxWrapper = document.createElement('label');
    checkboxWrapper.className = 'panelkit-checkbox-wrapper';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = component.id;
    checkbox.className = 'panelkit-checkbox';
    
    const checkboxLabel = document.createElement('span');
    checkboxLabel.textContent = component.label;
    
    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(checkboxLabel);
    
    // Setup state binding
    this.setupStateBinding(checkbox, component, context, 'checked', 'boolean');
    
    wrapper.appendChild(checkboxWrapper);
    
    if (component.description) {
      const desc = document.createElement('small');
      desc.className = 'panelkit-description';
      desc.textContent = component.description;
      wrapper.appendChild(desc);
    }
    
    return wrapper;
  }
  
  renderSlider(component, context) {
    const wrapper = document.createElement('div');
    wrapper.className = 'panelkit-input-group';
    
    if (component.label) {
      const label = document.createElement('label');
      label.textContent = component.label;
      label.setAttribute('for', component.id);
      wrapper.appendChild(label);
    }
    
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'panelkit-slider-wrapper';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = component.id;
    slider.className = 'panelkit-slider';
    
    // Apply props
    if (component.props) {
      if (component.props.min !== undefined) slider.min = component.props.min;
      if (component.props.max !== undefined) slider.max = component.props.max;
      if (component.props.step !== undefined) slider.step = component.props.step;
      if (component.props.defaultValue !== undefined) slider.value = component.props.defaultValue;
    }
    
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'panelkit-value-display';
    valueDisplay.textContent = slider.value + (component.props?.unit || '');
    
    // Update value display on change
    slider.addEventListener('input', () => {
      valueDisplay.textContent = slider.value + (component.props?.unit || '');
    });
    
    sliderWrapper.appendChild(slider);
    sliderWrapper.appendChild(valueDisplay);
    
    // Setup state binding
    this.setupStateBinding(slider, component, context, 'value', 'number');
    
    wrapper.appendChild(sliderWrapper);
    
    return wrapper;
  }
  
  renderColorInput(component, context) {
    const wrapper = document.createElement('div');
    wrapper.className = 'panelkit-input-group';
    
    if (component.label) {
      const label = document.createElement('label');
      label.textContent = component.label;
      wrapper.appendChild(label);
    }
    
    const colorWrapper = document.createElement('div');
    colorWrapper.className = 'panelkit-color-input-wrapper';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.id = component.id;
    colorInput.className = 'panelkit-color-input';
    
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'panelkit-color-hex-input';
    hexInput.pattern = '^#[0-9A-Fa-f]{6}$';
    hexInput.placeholder = '#000000';
    
    // Sync color and hex inputs
    colorInput.addEventListener('input', () => {
      hexInput.value = colorInput.value;
    });
    
    hexInput.addEventListener('input', () => {
      if (hexInput.validity.valid) {
        colorInput.value = hexInput.value;
      }
    });
    
    colorWrapper.appendChild(colorInput);
    colorWrapper.appendChild(hexInput);
    
    // Setup state binding
    this.setupStateBinding(colorInput, component, context, 'value');
    
    wrapper.appendChild(colorWrapper);
    
    return wrapper;
  }
  
  // ===== DISPLAY COMPONENTS =====
  
  renderStatus(component, context) {
    const wrapper = document.createElement('div');
    wrapper.className = 'panelkit-status-display';
    
    if (component.props?.items) {
      component.props.items.forEach(item => {
        const statusItem = document.createElement('div');
        statusItem.className = 'panelkit-status-item';
        
        const label = document.createElement('span');
        label.className = 'panelkit-status-label';
        label.textContent = item.label + ':';
        
        const value = document.createElement('span');
        value.className = 'panelkit-status-value';
        
        // Handle dynamic values
        if (typeof item.value === 'object' && item.value.path) {
          const currentValue = this.renderer.getValueByPath(context.state, item.value.path);
          value.textContent = currentValue || item.value.fallback || '';
        } else {
          value.textContent = item.value;
        }
        
        statusItem.appendChild(label);
        statusItem.appendChild(value);
        wrapper.appendChild(statusItem);
      });
    }
    
    return wrapper;
  }
  
  renderBadge(component, context) {
    const badge = document.createElement('span');
    badge.className = `panelkit-badge panelkit-badge--${component.props?.variant || 'default'}`;
    badge.textContent = component.props?.text || '';
    
    if (component.props?.icon) {
      const icon = document.createElement('span');
      icon.className = 'panelkit-badge-icon';
      icon.textContent = component.props.icon;
      badge.insertBefore(icon, badge.firstChild);
    }
    
    return badge;
  }
  
  // ===== ACTION COMPONENTS =====
  
  renderButton(component, context) {
    const button = document.createElement('button');
    button.className = `panelkit-action-btn panelkit-action-btn--${component.props?.variant || 'secondary'}`;
    button.textContent = component.label;
    if (component.id) button.id = component.id;
    
    // Apply props
    if (component.props) {
      if (component.props.disabled) button.disabled = true;
      if (component.props.size) button.classList.add(`panelkit-action-btn--${component.props.size}`);
      if (component.props.icon) {
        const icon = document.createElement('span');
        icon.className = 'panelkit-button-icon';
        icon.textContent = component.props.icon;
        button.insertBefore(icon, button.firstChild);
      }
    }
    
    // Setup action handlers
    if (component.actions) {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        for (const action of component.actions) {
          await this.executeAction(action, context);
        }
      });
    }
    
    return button;
  }
  
  // ===== ADVANCED COMPONENTS =====
  
  renderThemeEditor(component, context) {
    const editor = document.createElement('div');
    editor.className = 'panelkit-theme-editor';
    editor.id = component.id;
    
    const sections = component.props?.sections || ['typography', 'colors', 'spacing', 'preview'];
    
    sections.forEach(sectionType => {
      const section = this.createThemeEditorSection(sectionType, component, context);
      if (section) editor.appendChild(section);
    });
    
    return editor;
  }
  
  renderColorPalette(component, context) {
    const palette = document.createElement('div');
    palette.className = 'panelkit-color-palette';
    // This is a placeholder. A full implementation would create color inputs
    // for each color in the theme state (context.state.theme.colors).
    palette.innerHTML = `<p>Color Palette Component for state path: <code>${component.state.path}</code></p>`;
    return palette;
  }
  
  renderFontPicker(component, context) {
    const picker = document.createElement('div');
    picker.className = 'panelkit-font-picker';
    // Placeholder implementation
    picker.innerHTML = `<label>${component.label}</label><select><option>Sans Serif</option><option>Serif</option></select>`;
    return picker;
  }
  
  renderTokenGrid(component, context) {
    const grid = document.createElement('div');
    grid.className = 'panelkit-token-grid';
    grid.innerHTML = `<p>Token Grid Component</p>`;
    return grid;
  }
  
  renderCssEditor(component, context) {
    const editor = document.createElement('div');
    editor.className = 'panelkit-css-file-editor';
    editor.innerHTML = `<p>CSS Editor Component</p>`;
    return editor;
  }
  
  renderThemePreview(component, context) {
    const preview = document.createElement('div');
    preview.className = 'panelkit-theme-preview';
    preview.id = component.id;
    preview.innerHTML = `
        <h1>Heading 1 Sample</h1>
        <h2>Heading 2 Sample</h2>
        <p>This is body text that shows how your theme will look.</p>
        <code>console.log('Code sample');</code>
        <button class="panelkit-preview-button">Button Sample</button>
    `;
    // In a real implementation, this would subscribe to theme state changes
    // and apply them via CSS custom properties to this component's scope.
    return preview;
  }
  
  // ===== HELPER METHODS =====
  
  setupStateBinding(element, component, context, property = 'value', type = 'string') {
    if (!component.state) return;
    
    // Set initial value
    const currentValue = this.renderer.getValueByPath(context.state, component.state.path);
    if (currentValue !== undefined) {
      if (type === 'boolean') {
        element[property] = Boolean(currentValue);
      } else if (type === 'number') {
        element[property] = Number(currentValue);
      } else {
        element[property] = String(currentValue);
      }
    }
    
    // Setup change listener
    const eventType = element.type === 'checkbox' ? 'change' : 'input';
    element.addEventListener(eventType, (e) => {
      let value = e.target[property];
      
      if (type === 'number') {
        value = Number(value);
      } else if (type === 'boolean') {
        value = Boolean(value);
      }
      
      context.dispatch({
        type: component.state.action,
        payload: value
      });
    });
  }
  
  setupRadioGroupBinding(radioGroup, component, context) {
    if (!component.state) return;
    
    const radios = radioGroup.querySelectorAll('input[type="radio"]');
    
    // Set initial value
    const currentValue = this.renderer.getValueByPath(context.state, component.state.path);
    if (currentValue !== undefined) {
      radios.forEach(radio => {
        radio.checked = radio.value === currentValue;
      });
    }
    
    // Setup change listeners
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          context.dispatch({
            type: component.state.action,
            payload: e.target.value
          });
        }
      });
    });
  }
  
  setupValidation(element, component, context) {
    if (!component.validation) return;
    
    const validateField = () => {
      const value = element.value;
      const errors = [];
      
      component.validation.forEach(rule => {
        const validator = this.renderer.validators.get(rule.type);
        if (validator && !validator(value, rule)) {
          errors.push(rule.message || `Validation failed for ${rule.type}`);
        }
      });
      
      // Update UI based on validation
      element.classList.toggle('panelkit-invalid', errors.length > 0);
      
      // Show/hide error messages
      let errorElement = element.parentNode.querySelector('.panelkit-validation-error');
      if (errors.length > 0) {
        if (!errorElement) {
          errorElement = document.createElement('div');
          errorElement.className = 'panelkit-validation-error';
          element.parentNode.appendChild(errorElement);
        }
        errorElement.textContent = errors[0];
      } else if (errorElement) {
        errorElement.remove();
      }
      
      return errors.length === 0;
    };
    
    element.addEventListener('blur', validateField);
    element.addEventListener('input', () => {
      // Clear errors on input
      element.classList.remove('panelkit-invalid');
      const errorElement = element.parentNode.querySelector('.panelkit-validation-error');
      if (errorElement) {
        errorElement.remove();
      }
    });
  }
  
  async executeAction(action, context) {
    const handler = this.renderer.actionHandlers.get(action.type);
    if (handler) {
      await handler(action, context);
    } else {
      console.warn(`No action handler found for: ${action.type}`);
    }
  }
  
  createFileRow(file, component, context) {
    const row = document.createElement('div');
    row.className = file.isDefault ? 'panelkit-css-list-item panelkit-css-list-item-default' : 'panelkit-css-list-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'panelkit-css-enable-toggle';
    checkbox.checked = file.enabled;
    
    const path = document.createElement('span');
    path.className = 'panelkit-css-file-path';
    path.textContent = file.path;
    
    const actions = document.createElement('div');
    actions.className = 'panelkit-css-file-actions';
    
    if (file.isDefault) {
      const badge = document.createElement('span');
      badge.className = 'panelkit-css-file-default-badge';
      badge.textContent = 'default';
      actions.appendChild(badge);
    } else {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'panelkit-remove-css-btn';
      removeBtn.textContent = '×';
      removeBtn.title = `Remove ${file.path}`;
      actions.appendChild(removeBtn);
      
      // Setup remove handler
      removeBtn.addEventListener('click', () => {
        context.dispatch({
          type: component.state.actions.remove,
          payload: file.path
        });
      });
    }
    
    // Setup toggle handler
    checkbox.addEventListener('change', (e) => {
      const actionType = file.isDefault ? 
        'SETTINGS_TOGGLE_ROOT_CSS_ENABLED' : 
        component.state.actions.toggle;
      
      context.dispatch({
        type: actionType,
        payload: file.path
      });
    });
    
    row.appendChild(checkbox);
    row.appendChild(path);
    row.appendChild(actions);
    
    return row;
  }
  
  createThemeEditorSection(sectionType, component, context) {
    const section = document.createElement('div');
    section.className = 'panelkit-editor-subsection';
    
    const header = document.createElement('h5');
    header.textContent = sectionType.charAt(0).toUpperCase() + sectionType.slice(1);
    section.appendChild(header);
    
    const content = document.createElement('div');
    content.className = 'panelkit-token-grid';
    
    // Add section-specific controls based on type
    switch (sectionType) {
      case 'typography':
        content.appendChild(this.createTypographyControls(context));
        break;
      case 'colors':
        content.appendChild(this.createColorControls(context));
        break;
      case 'spacing':
        content.appendChild(this.createSpacingControls(context));
        break;
    }
    
    section.appendChild(content);
    return section;
  }
  
  createLivePreview(component, context) {
    const preview = document.createElement('div');
    preview.className = 'panelkit-editor-subsection';
    
    const header = document.createElement('h5');
    header.textContent = 'Live Preview';
    preview.appendChild(header);
    
    const previewContent = document.createElement('div');
    previewContent.className = 'panelkit-theme-preview';
    previewContent.innerHTML = `
      <h1>Heading 1 Sample</h1>
      <h2>Heading 2 Sample</h2>
      <p>This is body text that shows how your theme will look. It includes <strong>bold text</strong> and <em>italic text</em>.</p>
      <code>console.log('Code sample');</code>
      <button class="panelkit-preview-button">Button Sample</button>
    `;
    
    preview.appendChild(previewContent);
    return preview;
  }
  
  createTypographyControls(context) {
    // Implementation for typography controls
    const controls = document.createElement('div');
    // Add font family, size, weight controls
    return controls;
  }
  
  createColorControls(context) {
    // Implementation for color controls
    const controls = document.createElement('div');
    // Add color picker controls
    return controls;
  }
  
  createSpacingControls(context) {
    // Implementation for spacing controls
    const controls = document.createElement('div');
    // Add spacing slider controls
    return controls;
  }
  
  createInputWrapper(component) {
    const wrapper = document.createElement('div');
    wrapper.className = 'panelkit-input-group';
    
    if (component.id) wrapper.id = component.id;
    
    return wrapper;
  }
  
  appendDescription(wrapper, description) {
    if (description) {
      const desc = document.createElement('p');
      desc.className = 'panelkit-description';
      desc.textContent = description;
      wrapper.appendChild(desc);
    }
  }
  
  // ===== ENHANCED THEME EDITOR COMPONENTS =====
  
  renderPresetSelector(component, context) {
    const container = document.createElement('div');
    container.className = 'theme-preset-selector';
    container.id = component.id;
    
    const grid = document.createElement('div');
    grid.className = 'preset-grid';
    
    Object.entries(component.presets || {}).forEach(([key, preset]) => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.setAttribute('data-preset', key);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Apply ${preset.name} preset`);
      
      // Create preview with brand color
      const previewColor = preset.colors?.brand?.primary || '#ccc';
      card.style.setProperty('--preset-color', previewColor);
      
      card.innerHTML = `
        <div class="preset-preview" style="background: linear-gradient(135deg, ${previewColor} 0%, ${this.darkenColor(previewColor, 20)} 100%)"></div>
        <h4>${preset.name}</h4>
        <p>${preset.description}</p>
      `;
      
      // Add click handler
      const handleSelect = () => {
        // Remove previous selection
        grid.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
        // Mark as selected
        card.classList.add('selected');
        
        // Execute action
        if (component.actions && component.actions[0]) {
          this.executeAction({ type: component.actions[0].type, payload: key }, context);
        }
      };
      
      card.addEventListener('click', handleSelect);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      });
      
      grid.appendChild(card);
    });
    
    container.appendChild(grid);
    return container;
  }
  
  renderDesignTokenCategory(component, context) {
    const container = document.createElement('div');
    container.className = 'design-token-category';
    
    // Category header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
      <div>
        <h3 class="category-title">${component.label || 'Design Tokens'}</h3>
        <p class="category-description">${component.description || ''}</p>
      </div>
    `;
    
    // Token groups
    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'token-groups';
    
    if (component.tokens) {
      Object.entries(component.tokens).forEach(([groupKey, group]) => {
        const groupElement = document.createElement('div');
        groupElement.className = 'token-group';
        
        const groupTitle = document.createElement('h4');
        groupTitle.className = 'group-title';
        groupTitle.textContent = this.capitalize(groupKey);
        groupElement.appendChild(groupTitle);
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'token-controls';
        
        Object.entries(group).forEach(([tokenKey, token]) => {
          const control = this.createTokenControl(tokenKey, token, `${component.category}.${groupKey}.${tokenKey}`);
          controlsContainer.appendChild(control);
        });
        
        groupElement.appendChild(controlsContainer);
        groupsContainer.appendChild(groupElement);
      });
    }
    
    container.appendChild(header);
    container.appendChild(groupsContainer);
    
    return container;
  }
  
  renderAdvancedThemePreview(component, context) {
    const container = document.createElement('div');
    container.className = 'advanced-theme-preview';
    container.id = component.id;
    
    // Preview controls
    if (component.showThemeToggle || component.showResponsiveToggle) {
      const controls = document.createElement('div');
      controls.className = 'preview-controls';
      
      if (component.showThemeToggle) {
        const modeToggle = document.createElement('button');
        modeToggle.className = 'preview-toggle';
        modeToggle.setAttribute('data-toggle', 'theme');
        modeToggle.innerHTML = '🌙 Dark Mode';
        
        modeToggle.addEventListener('click', () => {
          const isLight = modeToggle.textContent.includes('Dark');
          modeToggle.innerHTML = isLight ? '☀️ Light Mode' : '🌙 Dark Mode';
          modeToggle.classList.toggle('active');
          
          this.executeAction({ type: 'toggle-preview-mode' }, context);
        });
        
        controls.appendChild(modeToggle);
      }
      
      if (component.showResponsiveToggle) {
        const deviceToggle = document.createElement('button');
        deviceToggle.className = 'preview-toggle';
        deviceToggle.setAttribute('data-toggle', 'device');
        deviceToggle.innerHTML = '📱 Mobile';
        
        deviceToggle.addEventListener('click', () => {
          const isDesktop = deviceToggle.textContent.includes('Mobile');
          deviceToggle.innerHTML = isDesktop ? '🖥️ Desktop' : '📱 Mobile';
          deviceToggle.classList.toggle('active');
          
          this.executeAction({ type: 'toggle-preview-device' }, context);
        });
        
        controls.appendChild(deviceToggle);
      }
      
      container.appendChild(controls);
    }
    
    // Preview content
    const preview = document.createElement('div');
    preview.className = 'theme-preview-content';
    preview.innerHTML = `
      <div class="preview-navigation">
        <h3>Navigation Example</h3>
        <nav>
          <a href="#" aria-label="Navigate to home">Home</a>
          <a href="#" aria-label="Navigate to about">About</a>
          <a href="#" aria-label="Navigate to contact">Contact</a>
        </nav>
      </div>
      
      <div class="preview-main">
        <h1>Main Heading</h1>
        <h2>Secondary Heading</h2>
        <p>This is a paragraph showing how your typography system looks in practice. It demonstrates text color, font family, and spacing relationships in your design system.</p>
        
        <div class="preview-cards">
          <div class="preview-card">
            <h4>Primary Card</h4>
            <p>This card demonstrates your spacing and color system in action.</p>
            <button class="preview-button primary">Primary Action</button>
          </div>
          <div class="preview-card">
            <h4>Secondary Card</h4>
            <p>Cards show layout patterns and visual hierarchy.</p>
            <button class="preview-button secondary">Secondary Action</button>
          </div>
        </div>
        
        <div class="preview-form">
          <h3>Form Elements</h3>
          <input type="text" placeholder="Text input example" aria-label="Sample text input" />
          <textarea placeholder="Textarea example" aria-label="Sample textarea"></textarea>
          <select aria-label="Sample select">
            <option>Select an option</option>
            <option>Option 1</option>
            <option>Option 2</option>
          </select>
        </div>
      </div>
    `;
    
    container.appendChild(preview);
    return container;
  }
  
  renderThemeExportControls(component, context) {
    const container = document.createElement('div');
    container.className = 'export-controls';
    container.id = component.id;
    
    const buttonGrid = document.createElement('div');
    buttonGrid.className = 'export-button-grid';
    
    component.actions?.forEach(action => {
      const button = document.createElement('button');
      button.className = `export-button ${action.variant || 'secondary'}`;
      button.setAttribute('data-action', action.type);
      button.setAttribute('aria-label', action.label);
      
      const icon = action.icon ? `<span class="button-icon">${action.icon}</span>` : '';
      button.innerHTML = `${icon}<span>${action.label}</span>`;
      
      button.addEventListener('click', () => {
        button.classList.add('loading');
        button.disabled = true;
        
        this.executeAction({ type: action.type }, context).finally(() => {
          button.classList.remove('loading');
          button.disabled = false;
        });
      });
      
      buttonGrid.appendChild(button);
    });
    
    container.appendChild(buttonGrid);
    return container;
  }
  
  // ===== HELPER METHODS FOR ENHANCED COMPONENTS =====
  
  createTokenControl(tokenKey, token, variableName) {
    const control = document.createElement('div');
    
    switch (token.type) {
      case 'color':
        control.className = 'color-token-control';
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'color-swatch';
        colorSwatch.style.backgroundColor = token.default;
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'color-input';
        colorInput.value = token.default;
        colorInput.addEventListener('change', (e) => {
          colorSwatch.style.backgroundColor = e.target.value;
          hexCode.textContent = e.target.value.toUpperCase();
          this.updateCSSVariable(variableName, e.target.value);
        });
        
        const colorInfo = document.createElement('div');
        colorInfo.className = 'color-info';
        
        const colorLabel = document.createElement('div');
        colorLabel.className = 'color-label';
        colorLabel.textContent = token.label;
        
        const hexCode = document.createElement('div');
        hexCode.className = 'color-value';
        hexCode.textContent = token.default.toUpperCase();
        
        colorInfo.appendChild(colorLabel);
        colorInfo.appendChild(hexCode);
        
        colorSwatch.addEventListener('click', () => colorInput.click());
        
        control.appendChild(colorSwatch);
        control.appendChild(colorInfo);
        control.appendChild(colorInput);
        break;
        
      case 'size':
        control.className = 'size-token-control';
        const sizeLabel = document.createElement('div');
        sizeLabel.className = 'size-label';
        sizeLabel.textContent = token.label;
        
        const sizeInput = document.createElement('input');
        sizeInput.className = 'size-input';
        sizeInput.type = 'text';
        sizeInput.value = token.default;
        sizeInput.addEventListener('change', (e) => {
          this.updateCSSVariable(variableName, e.target.value);
        });
        
        control.appendChild(sizeLabel);
        control.appendChild(sizeInput);
        break;
        
      case 'font-family':
        control.className = 'font-token-control';
        const fontLabel = document.createElement('div');
        fontLabel.className = 'font-label';
        fontLabel.textContent = token.label;
        
        const fontInput = document.createElement('input');
        fontInput.className = 'font-input';
        fontInput.type = 'text';
        fontInput.value = token.default;
        fontInput.addEventListener('change', (e) => {
          this.updateCSSVariable(variableName, e.target.value);
        });
        
        control.appendChild(fontLabel);
        control.appendChild(fontInput);
        break;
        
      case 'weight':
        control.className = 'size-token-control';
        const weightLabel = document.createElement('div');
        weightLabel.className = 'size-label';
        weightLabel.textContent = token.label;
        
        const weightSelect = document.createElement('select');
        weightSelect.className = 'size-input';
        const weights = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
        weights.forEach(weight => {
          const option = document.createElement('option');
          option.value = weight;
          option.textContent = weight;
          option.selected = weight === token.default;
          weightSelect.appendChild(option);
        });
        
        weightSelect.addEventListener('change', (e) => {
          this.updateCSSVariable(variableName, e.target.value);
        });
        
        control.appendChild(weightLabel);
        control.appendChild(weightSelect);
        break;
        
      case 'shadow':
        control.className = 'shadow-token-control';
        const shadowPreview = document.createElement('div');
        shadowPreview.className = 'shadow-preview';
        shadowPreview.style.boxShadow = token.default;
        
        const shadowInfo = document.createElement('div');
        shadowInfo.className = 'shadow-info';
        
        const shadowLabel = document.createElement('div');
        shadowLabel.className = 'shadow-label';
        shadowLabel.textContent = token.label;
        
        const shadowValue = document.createElement('div');
        shadowValue.className = 'shadow-value';
        shadowValue.textContent = token.default;
        
        shadowInfo.appendChild(shadowLabel);
        shadowInfo.appendChild(shadowValue);
        
        control.appendChild(shadowPreview);
        control.appendChild(shadowInfo);
        break;
        
      default:
        control.className = 'size-token-control';
        const defaultLabel = document.createElement('div');
        defaultLabel.className = 'size-label';
        defaultLabel.textContent = token.label;
        
        const defaultInput = document.createElement('input');
        defaultInput.className = 'size-input';
        defaultInput.type = 'text';
        defaultInput.value = token.default;
        defaultInput.addEventListener('change', (e) => {
          this.updateCSSVariable(variableName, e.target.value);
        });
        
        control.appendChild(defaultLabel);
        control.appendChild(defaultInput);
        break;
    }
    
    return control;
  }
  
  updateCSSVariable(variableName, value) {
    const cssVarName = `--${variableName.replace(/\./g, '-')}`;
    document.documentElement.style.setProperty(cssVarName, value);
    
    // Dispatch event for other components to listen
    window.dispatchEvent(new CustomEvent('themeTokenUpdated', {
      detail: { variable: cssVarName, value: value }
    }));
  }
  
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  darkenColor(color, percent) {
    // Simple color darkening utility
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }
} 