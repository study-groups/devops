/**
 * DSUI Component Library
 * Visual component renderers for the DevPages Settings UI system
 */

import { ComponentTypes } from './dsui-schema.js';

// ===== COMPONENT RENDERERS =====

export class DSUIComponents {
  constructor(renderer) {
    this.renderer = renderer;
    this.registerAllComponents();
  }
  
  registerAllComponents() {
    // Layout Components
    this.renderer.registerComponent(ComponentTypes.SECTION, this.renderSection.bind(this));
    this.renderer.registerComponent(ComponentTypes.SUBSECTION, this.renderSubsection.bind(this));
    this.renderer.registerComponent(ComponentTypes.GROUP, this.renderGroup.bind(this));
    this.renderer.registerComponent(ComponentTypes.GRID, this.renderGrid.bind(this));
    this.renderer.registerComponent(ComponentTypes.FLEX, this.renderFlex.bind(this));
    this.renderer.registerComponent(ComponentTypes.TABS, this.renderTabs.bind(this));
    this.renderer.registerComponent(ComponentTypes.ACCORDION, this.renderAccordion.bind(this));
    
    // Input Components
    this.renderer.registerComponent(ComponentTypes.TEXT, this.renderTextInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.NUMBER, this.renderNumberInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.EMAIL, this.renderEmailInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.URL, this.renderUrlInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.PASSWORD, this.renderPasswordInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.TEXTAREA, this.renderTextarea.bind(this));
    this.renderer.registerComponent(ComponentTypes.SELECT, this.renderSelect.bind(this));
    this.renderer.registerComponent(ComponentTypes.MULTISELECT, this.renderMultiselect.bind(this));
    this.renderer.registerComponent(ComponentTypes.RADIO, this.renderRadioGroup.bind(this));
    this.renderer.registerComponent(ComponentTypes.CHECKBOX, this.renderCheckbox.bind(this));
    this.renderer.registerComponent(ComponentTypes.TOGGLE, this.renderToggle.bind(this));
    this.renderer.registerComponent(ComponentTypes.SLIDER, this.renderSlider.bind(this));
    this.renderer.registerComponent(ComponentTypes.COLOR, this.renderColorInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.FILE, this.renderFileInput.bind(this));
    this.renderer.registerComponent(ComponentTypes.DATE, this.renderDateInput.bind(this));
    
    // Display Components
    this.renderer.registerComponent(ComponentTypes.LABEL, this.renderLabel.bind(this));
    this.renderer.registerComponent(ComponentTypes.DESCRIPTION, this.renderDescription.bind(this));
    this.renderer.registerComponent(ComponentTypes.CODE, this.renderCode.bind(this));
    this.renderer.registerComponent(ComponentTypes.PREVIEW, this.renderPreview.bind(this));
    this.renderer.registerComponent(ComponentTypes.STATUS, this.renderStatus.bind(this));
    this.renderer.registerComponent(ComponentTypes.BADGE, this.renderBadge.bind(this));
    this.renderer.registerComponent(ComponentTypes.PROGRESS, this.renderProgress.bind(this));
    
    // Action Components
    this.renderer.registerComponent(ComponentTypes.BUTTON, this.renderButton.bind(this));
    this.renderer.registerComponent(ComponentTypes.LINK, this.renderLink.bind(this));
    this.renderer.registerComponent(ComponentTypes.DROPDOWN, this.renderDropdown.bind(this));
    this.renderer.registerComponent(ComponentTypes.MENU, this.renderMenu.bind(this));
    
    // Advanced Components
    this.renderer.registerComponent(ComponentTypes.THEME_EDITOR, this.renderThemeEditor.bind(this));
    this.renderer.registerComponent(ComponentTypes.CSS_EDITOR, this.renderCssEditor.bind(this));
    this.renderer.registerComponent(ComponentTypes.TOKEN_GRID, this.renderTokenGrid.bind(this));
    this.renderer.registerComponent(ComponentTypes.COLOR_PALETTE, this.renderColorPalette.bind(this));
    this.renderer.registerComponent(ComponentTypes.FONT_PICKER, this.renderFontPicker.bind(this));
  }
  
  // ===== LAYOUT COMPONENTS =====
  
  renderSection(component, context) {
    const section = document.createElement('div');
    section.className = 'setting-section';
    if (component.id) section.id = component.id;
    
    if (component.label) {
      const header = document.createElement('h4');
      header.textContent = component.label;
      section.appendChild(header);
    }
    
    if (component.description) {
      const desc = document.createElement('p');
      desc.className = 'section-description';
      desc.textContent = component.description;
      section.appendChild(desc);
    }
    
    if (component.children) {
      component.children.forEach(child => {
        const childElement = this.renderer.renderComponent(child, context);
        if (childElement) {
          section.appendChild(childElement);
        }
      });
    }
    
    return section;
  }
  
  renderGroup(component, context) {
    const group = document.createElement('div');
    group.className = 'setting-group';
    if (component.id) group.id = component.id;
    
    // Apply layout props
    if (component.props?.layout === 'horizontal') {
      group.classList.add('setting-group--horizontal');
    }
    if (component.props?.gap) {
      group.classList.add(`setting-group--gap-${component.props.gap}`);
    }
    if (component.props?.wrap) {
      group.classList.add('setting-group--wrap');
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
    grid.className = 'setting-grid';
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
    const wrapper = document.createElement('div');
    wrapper.className = 'setting-row';
    
    if (component.label) {
      const label = document.createElement('label');
      label.textContent = component.label;
      label.setAttribute('for', component.id);
      wrapper.appendChild(label);
    }
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = component.id;
    input.className = 'setting-input';
    
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
    
    // Setup validation
    this.setupValidation(input, component, context);
    
    wrapper.appendChild(input);
    
    if (component.description) {
      const desc = document.createElement('small');
      desc.className = 'setting-description';
      desc.textContent = component.description;
      wrapper.appendChild(desc);
    }
    
    return wrapper;
  }
  
  renderNumberInput(component, context) {
    const wrapper = document.createElement('div');
    wrapper.className = 'setting-row';
    
    if (component.label) {
      const label = document.createElement('label');
      label.textContent = component.label;
      label.setAttribute('for', component.id);
      wrapper.appendChild(label);
    }
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'number-input-wrapper';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = component.id;
    input.className = 'setting-input setting-input--number';
    
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
      unit.className = 'unit';
      unit.textContent = component.props.unit;
      inputWrapper.appendChild(unit);
    }
    
    // Setup state binding
    this.setupStateBinding(input, component, context, 'value', 'number');
    
    wrapper.appendChild(inputWrapper);
    
    if (component.description) {
      const desc = document.createElement('small');
      desc.className = 'setting-description';
      desc.textContent = component.description;
      wrapper.appendChild(desc);
    }
    
    return wrapper;
  }
  
  renderRadioGroup(component, context) {
    const wrapper = document.createElement('div');
    wrapper.className = 'setting-row';
    
    if (component.label) {
      const label = document.createElement('div');
      label.className = 'setting-label';
      label.textContent = component.label;
      wrapper.appendChild(label);
    }
    
    const radioGroup = document.createElement('div');
    radioGroup.className = component.props?.inline ? 'radio-group radio-group--inline' : 'radio-group';
    
    if (component.props?.options) {
      component.props.options.forEach((option, index) => {
        const radioWrapper = document.createElement('label');
        radioWrapper.className = 'radio-option';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = component.id;
        radio.value = option.value;
        radio.id = `${component.id}-${index}`;
        
        const radioLabel = document.createElement('span');
        radioLabel.textContent = option.label;
        
        if (option.icon) {
          const icon = document.createElement('span');
          icon.className = 'radio-icon';
          icon.textContent = option.icon;
          radioWrapper.appendChild(icon);
        }
        
        radioWrapper.appendChild(radio);
        radioWrapper.appendChild(radioLabel);
        
        if (option.description) {
          const desc = document.createElement('small');
          desc.className = 'radio-description';
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
    wrapper.className = 'setting-row';
    
    const checkboxWrapper = document.createElement('label');
    checkboxWrapper.className = 'checkbox-wrapper';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = component.id;
    checkbox.className = 'setting-checkbox';
    
    const checkboxLabel = document.createElement('span');
    checkboxLabel.textContent = component.label;
    
    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(checkboxLabel);
    
    // Setup state binding
    this.setupStateBinding(checkbox, component, context, 'checked', 'boolean');
    
    wrapper.appendChild(checkboxWrapper);
    
    if (component.description) {
      const desc = document.createElement('small');
      desc.className = 'setting-description';
      desc.textContent = component.description;
      wrapper.appendChild(desc);
    }
    
    return wrapper;
  }
  
  renderSlider(component, context) {
    const wrapper = document.createElement('div');
    wrapper.className = 'setting-row';
    
    if (component.label) {
      const label = document.createElement('label');
      label.textContent = component.label;
      label.setAttribute('for', component.id);
      wrapper.appendChild(label);
    }
    
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'slider-wrapper';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = component.id;
    slider.className = 'setting-slider';
    
    // Apply props
    if (component.props) {
      if (component.props.min !== undefined) slider.min = component.props.min;
      if (component.props.max !== undefined) slider.max = component.props.max;
      if (component.props.step !== undefined) slider.step = component.props.step;
      if (component.props.defaultValue !== undefined) slider.value = component.props.defaultValue;
    }
    
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'value-display';
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
    wrapper.className = 'setting-row';
    
    if (component.label) {
      const label = document.createElement('label');
      label.textContent = component.label;
      wrapper.appendChild(label);
    }
    
    const colorWrapper = document.createElement('div');
    colorWrapper.className = 'color-input-wrapper';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.id = component.id;
    colorInput.className = 'setting-color-input';
    
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'color-hex-input';
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
    wrapper.className = 'status-display';
    
    if (component.props?.items) {
      component.props.items.forEach(item => {
        const statusItem = document.createElement('div');
        statusItem.className = 'status-item';
        
        const label = document.createElement('span');
        label.className = 'status-label';
        label.textContent = item.label + ':';
        
        const value = document.createElement('span');
        value.className = 'status-value';
        
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
    badge.className = `badge badge--${component.props?.variant || 'default'}`;
    badge.textContent = component.props?.text || '';
    
    if (component.props?.icon) {
      const icon = document.createElement('span');
      icon.className = 'badge-icon';
      icon.textContent = component.props.icon;
      badge.insertBefore(icon, badge.firstChild);
    }
    
    return badge;
  }
  
  // ===== ACTION COMPONENTS =====
  
  renderButton(component, context) {
    const button = document.createElement('button');
    button.className = `action-btn action-btn--${component.props?.variant || 'secondary'}`;
    button.textContent = component.label;
    if (component.id) button.id = component.id;
    
    // Apply props
    if (component.props) {
      if (component.props.disabled) button.disabled = true;
      if (component.props.size) button.classList.add(`action-btn--${component.props.size}`);
      if (component.props.icon) {
        const icon = document.createElement('span');
        icon.className = 'button-icon';
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
    editor.className = 'theme-editor';
    editor.id = component.id;
    
    const sections = component.props?.sections || ['typography', 'colors', 'spacing'];
    
    sections.forEach(sectionType => {
      const section = this.createThemeEditorSection(sectionType, component, context);
      editor.appendChild(section);
    });
    
    if (component.props?.livePreview) {
      const preview = this.createLivePreview(component, context);
      editor.appendChild(preview);
    }
    
    return editor;
  }
  
  renderCssEditor(component, context) {
    const editor = document.createElement('div');
    editor.className = 'css-file-editor';
    editor.id = component.id;
    
    // Create file list
    const fileList = document.createElement('div');
    fileList.className = 'css-file-list';
    
    // Get current files from state
    const files = this.renderer.getValueByPath(context.state, component.state.path) || [];
    
    // Add default file if specified
    if (component.props?.showDefaultFile) {
      const defaultFile = this.createFileRow({
        path: 'styles.css',
        enabled: true,
        isDefault: true
      }, component, context);
      fileList.appendChild(defaultFile);
    }
    
    // Add user files
    files.forEach(file => {
      const fileRow = this.createFileRow(file, component, context);
      fileList.appendChild(fileRow);
    });
    
    editor.appendChild(fileList);
    
    return editor;
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
      element.classList.toggle('invalid', errors.length > 0);
      
      // Show/hide error messages
      let errorElement = element.parentNode.querySelector('.validation-error');
      if (errors.length > 0) {
        if (!errorElement) {
          errorElement = document.createElement('div');
          errorElement.className = 'validation-error';
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
      element.classList.remove('invalid');
      const errorElement = element.parentNode.querySelector('.validation-error');
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
    row.className = file.isDefault ? 'css-list-item css-list-item-default' : 'css-list-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'css-enable-toggle';
    checkbox.checked = file.enabled;
    
    const path = document.createElement('span');
    path.className = 'css-file-path';
    path.textContent = file.path;
    
    const actions = document.createElement('div');
    actions.className = 'css-file-actions';
    
    if (file.isDefault) {
      const badge = document.createElement('span');
      badge.className = 'css-file-default-badge';
      badge.textContent = 'default';
      actions.appendChild(badge);
    } else {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-css-btn';
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
    section.className = 'editor-subsection';
    
    const header = document.createElement('h5');
    header.textContent = sectionType.charAt(0).toUpperCase() + sectionType.slice(1);
    section.appendChild(header);
    
    const content = document.createElement('div');
    content.className = 'token-grid';
    
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
    preview.className = 'editor-subsection';
    
    const header = document.createElement('h5');
    header.textContent = 'Live Preview';
    preview.appendChild(header);
    
    const previewContent = document.createElement('div');
    previewContent.className = 'theme-preview';
    previewContent.innerHTML = `
      <h1>Heading 1 Sample</h1>
      <h2>Heading 2 Sample</h2>
      <p>This is body text that shows how your theme will look. It includes <strong>bold text</strong> and <em>italic text</em>.</p>
      <code>console.log('Code sample');</code>
      <button class="preview-button">Button Sample</button>
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
} 