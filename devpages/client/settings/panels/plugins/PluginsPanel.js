/**
 * client/settings/PluginsPanel.js
 * Manages the plugin settings within the main SettingsPanel.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js'; // Import ActionTypes
import { panelRegistry } from '../../core/panelRegistry.js';

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
    // The parentElement is now the content wrapper created by SettingsPanel
    // We don't need to create additional containers, just use it directly
    this.containerElement = parentElement;
    this.containerElement.classList.add('plugins-panel-content');

    this.controlsContainer = document.createElement('div');
    this.controlsContainer.classList.add('plugins-controls-container');
    
    this.containerElement.appendChild(this.controlsContainer);

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
          pluginGroup.dataset.pluginId = pluginId;
          
          const pluginHeader = document.createElement('h5');
          pluginHeader.textContent = pluginData.name || pluginId;
          pluginHeader.classList.add('plugin-group-header');
          
          pluginGroup.appendChild(pluginHeader);



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
      
      // The reactive system will handle the update automatically
      
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
    // Clear the container content but don't remove the container itself
    // since it's managed by the SettingsPanel
    if (this.containerElement) {
      this.containerElement.innerHTML = '';
    }
    this.containerElement = null;
    this.controlsContainer = null;
    this.pluginControlElements = {};
    logPlugins('PluginsPanel destroyed.');
  }


}

// Register this panel with the registry
panelRegistry.register({
  id: 'plugins-settings-container',
  title: 'Plugins',
  component: PluginsPanel,
  order: 20,
  defaultCollapsed: true
});
