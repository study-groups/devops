/**
 * client/settings/PluginsPanel.js
 * Manages the plugin settings within the main SettingsPanel.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js'; // Import ActionTypes

function logPlugins(message, level = 'info') {
  const type = 'PLUGINS_PANEL';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

export class PluginsPanel {
  constructor(parentElement) {
    this.containerElement = null;
    this.controlsContainer = null; // Holds all dynamically generated plugin controls
    this.stateUnsubscribe = null;
    this.pluginControlElements = {}; // To store references: { mermaid_theme: selectElement, mermaid_enabled: checkboxElement }

    if (!parentElement) {
      logPlugins('PluginsPanel requires a parent element to attach its content.', 'error');
      return;
    }

    this.createPanelContent(parentElement);
    this.subscribeToState();
    logPlugins('PluginsPanel instance created.');
  }

  createPanelContent(parentElement) {
    this.containerElement = document.createElement('div');
    this.containerElement.classList.add('plugins-panel-content');

    // Create a section wrapper with light styling
    const pluginsSection = document.createElement('div');
    pluginsSection.classList.add('plugins-section-wrapper');

    this.controlsContainer = document.createElement('div');
    this.controlsContainer.classList.add('plugins-controls-container');
    
    pluginsSection.appendChild(this.controlsContainer);
    this.containerElement.appendChild(pluginsSection);
    parentElement.appendChild(this.containerElement);

    this.renderPluginControls(appStore.getState().plugins);

    // Event delegation for changing settings
    this.controlsContainer.addEventListener('change', this.handleSettingChange.bind(this));
  }

  renderPluginControls(pluginsState) {
    if (!this.controlsContainer) return;
    this.controlsContainer.innerHTML = '';
    this.pluginControlElements = {};

    for (const pluginId in pluginsState) {
      if (Object.prototype.hasOwnProperty.call(pluginsState, pluginId)) {
        const pluginData = pluginsState[pluginId];

        if (pluginData.settingsManifest && pluginData.settingsManifest.length > 0) {
          const pluginGroup = document.createElement('div');
          pluginGroup.classList.add('plugin-settings-group');
          pluginGroup.classList.add('collapsed');
          pluginGroup.dataset.pluginId = pluginId;
          
          const pluginHeader = document.createElement('h4');
          pluginHeader.textContent = pluginData.name || pluginId;
          pluginHeader.classList.add('plugin-group-header');
          pluginHeader.style.cursor = 'pointer';
          pluginHeader.setAttribute('aria-expanded', 'false');
          
          const indicator = document.createElement('span');
          indicator.classList.add('plugin-collapse-indicator');
          indicator.innerHTML = '&#9654;'; // Always start with right arrow - CSS will handle rotation
          indicator.style.marginRight = '6px';
          indicator.style.fontSize = '0.8em';
          
          pluginHeader.insertBefore(indicator, pluginHeader.firstChild);
          
          pluginHeader.addEventListener('click', () => {
            this.togglePluginGroup(pluginGroup, pluginHeader, indicator);
          });
          
          pluginGroup.appendChild(pluginHeader);

          // Add version info and error info for Mermaid
          if (pluginId === 'mermaid') {
            const infoContainer = this.createMermaidInfo();
            pluginGroup.appendChild(infoContainer);
          }

          const settingsContainer = document.createElement('div');
          settingsContainer.classList.add('plugin-settings-container');

          pluginData.settingsManifest.forEach(settingConfig => {
            const controlId = `${pluginId}-${settingConfig.key}`;
            let controlElement;

            switch (settingConfig.type) {
              case 'toggle':
                controlElement = document.createElement('input');
                controlElement.type = 'checkbox';
                controlElement.checked = !!pluginData.settings[settingConfig.key];
                break;
              case 'select':
                controlElement = document.createElement('select');
                settingConfig.options.forEach(opt => {
                  const option = document.createElement('option');
                  option.value = opt;
                  option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
                  if (opt === pluginData.settings[settingConfig.key]) {
                    option.selected = true;
                  }
                  controlElement.appendChild(option);
                });
                break;
              default:
                controlElement = document.createElement('span');
                controlElement.textContent = 'Unsupported control type';
            }
            
            controlElement.id = controlId;
            controlElement.dataset.pluginId = pluginId;
            controlElement.dataset.settingKey = settingConfig.key;

            const label = document.createElement('label');
            label.htmlFor = controlId;
            label.textContent = settingConfig.label || settingConfig.key;

            const settingItem = document.createElement('div');
            settingItem.classList.add('plugin-setting-item');
            
            // Add checkbox first, then label, then select (if applicable)
            settingItem.appendChild(controlElement);
            settingItem.appendChild(label);
            
            settingsContainer.appendChild(settingItem);
            this.pluginControlElements[`${pluginId}_${settingConfig.key}`] = controlElement;
          });
          
          pluginGroup.appendChild(settingsContainer);
          this.controlsContainer.appendChild(pluginGroup);
        }
      }
    }
  }

  subscribeToState() {
    this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
      const newPlugins = newState.plugins;
      const oldPlugins = prevState.plugins;

      if (newPlugins !== oldPlugins) { // Basic check for any change in plugins slice
        logPlugins('Plugin state change detected, re-rendering controls or updating values.', 'debug');
        // Iterate through all managed controls and update their values if changed
        for (const pluginId in newPlugins) {
          if (Object.prototype.hasOwnProperty.call(newPlugins, pluginId) && newPlugins[pluginId].settings) {
            const pluginSettings = newPlugins[pluginId].settings;
            for (const settingKey in pluginSettings) {
              if (Object.prototype.hasOwnProperty.call(pluginSettings, settingKey)) {
                const controlRefKey = `${pluginId}_${settingKey}`;
                const controlElement = this.pluginControlElements[controlRefKey];
                if (controlElement) {
                  const newValue = pluginSettings[settingKey];
                  if (controlElement.type === 'checkbox' && controlElement.checked !== !!newValue) {
                    controlElement.checked = !!newValue;
                  } else if (controlElement.tagName === 'SELECT' && controlElement.value !== newValue) {
                    controlElement.value = newValue;
                  }
                  // Add other control type updates here
                }
              }
            }
          }
        }
      }
    });
  }

  handleSettingChange(event) {
    const target = event.target;
    const pluginId = target.dataset.pluginId;
    const settingKey = target.dataset.settingKey;

    if (pluginId && settingKey) {
      let value;
      if (target.type === 'checkbox') {
        value = target.checked;
      } else if (target.tagName === 'SELECT') {
        value = target.value;
      } else {
        logPlugins(`Unsupported control type for event: ${target.type || target.tagName}`, 'warn');
        return;
      }
      
      logPlugins(`Setting change for plugin '${pluginId}', setting '${settingKey}' to: ${value}. Dispatching action.`);
      dispatch({
        type: ActionTypes.PLUGIN_UPDATE_SETTING,
        payload: {
          pluginId: pluginId,
          settingKey: settingKey,
          value: value,
        }
      });
    }
  }

  destroy() {
    logPlugins('Destroying PluginsPanel...');
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }
    if (this.controlsContainer) {
        this.controlsContainer.removeEventListener('change', this.handleSettingChange.bind(this));
    }
    if (this.containerElement && this.containerElement.parentNode) {
      this.containerElement.parentNode.removeChild(this.containerElement);
    }
    this.containerElement = null;
    this.controlsContainer = null;
    this.pluginControlElements = {};
    logPlugins('PluginsPanel destroyed.');
  }

  togglePluginGroup(pluginGroup, header, indicator) {
    const isCollapsed = pluginGroup.classList.contains('collapsed');
    
    if (isCollapsed) {
      pluginGroup.classList.remove('collapsed');
      header.setAttribute('aria-expanded', 'true');
    } else {
      pluginGroup.classList.add('collapsed');
      header.setAttribute('aria-expanded', 'false');
    }
  }

  createMermaidInfo() {
    const infoContainer = document.createElement('div');
    infoContainer.classList.add('plugin-info-container');
    
    // Version info
    const versionInfo = document.createElement('div');
    versionInfo.classList.add('plugin-info-item');
    versionInfo.innerHTML = `<small>Version: ${window.mermaid?.version || 'Not loaded'}</small>`;
    
    // Last error info
    const errorInfo = document.createElement('div');
    errorInfo.classList.add('plugin-info-item', 'plugin-error-info');
    errorInfo.innerHTML = `<small>Status: ${this.getMermaidStatus()}</small>`;
    
    // Add a button to reinitialize Mermaid if needed
    if (typeof window.mermaid === 'undefined') {
        const reinitButton = document.createElement('button');
        reinitButton.textContent = 'Initialize Mermaid';
        reinitButton.className = 'settings-button settings-button-small';
        reinitButton.onclick = async () => {
            try {
                const { MermaidPlugin } = await import('/client/preview/plugins/mermaid/index.js');
                const plugin = new MermaidPlugin();
                await plugin.init();
                // Refresh the info display
                location.reload(); // Simple way to refresh the status
            } catch (error) {
                console.error('Failed to initialize Mermaid:', error);
            }
        };
        infoContainer.appendChild(reinitButton);
    }
    
    infoContainer.appendChild(versionInfo);
    infoContainer.appendChild(errorInfo);
    
    return infoContainer;
  }

  getMermaidStatus() {
    if (typeof window.mermaid === 'undefined') {
      return 'Not initialized';
    }
    if (window.mermaidLastError) {
      return `Error: ${window.mermaidLastError}`;
    }
    return `Ready (v${window.mermaid.version || 'unknown'})`;
  }
}
