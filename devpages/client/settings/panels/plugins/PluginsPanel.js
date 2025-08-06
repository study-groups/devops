/**
 * @file client/settings/panels/plugins/PluginsPanel.js
 * @description Manages the plugin settings within the main SettingsPanel.
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { e,
    renderApp,
    createElement,
    mount
} from '/client/components/elements.js';
import { appStore } from '/client/appState.js';
import { pluginThunks } from '/client/store/slices/pluginSlice.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';

const log = window.APP.services.log.createLogger('PluginsPanel');

export class PluginsPanel extends BasePanel {
  constructor(options) {
    super(options);
    this.controlsContainer = null; // Holds all dynamically generated plugin controls
    this.stateUnsubscribe = null;
    this.pluginControlElements = {}; // To store references: { mermaid_theme: selectElement, mermaid_enabled: checkboxElement }
  }

  render() {
    if (!this.element) {
      this.element = document.createElement('div');
      this.element.className = 'plugins-panel';
    }
    
    this.element.classList.add('plugins-panel-content');

    this.controlsContainer = document.createElement('div');
    this.controlsContainer.classList.add('plugins-controls-container');
    
    this.element.appendChild(this.controlsContainer);

    this.renderPluginControls(appStore.getState().plugins);
    
    return this.element;
  }

  onMount(container) {
    // Event delegation for changing settings
    this.controlsContainer.addEventListener('change', this.handleSettingChange.bind(this));
    this.subscribeToState();
    this.log('PLUGINS_PANEL', 'INSTANCE_CREATED', 'PluginsPanel instance created.');
  }

  onUnmount() {
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }
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
    let prevState = appStore.getState(); // Initialize previous state
    this.stateUnsubscribe = appStore.subscribe(() => {
      const newState = appStore.getState();
      this.handleStateChange(newState, prevState);
      prevState = newState; // Update previous state
    });
  }

  handleStateChange(newState, prevState) {
    if (newState.plugins !== prevState.plugins) {
      this.renderPluginControls(newState.plugins);
    }
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
        log.warn('PLUGINS_PANEL', 'UNSUPPORTED_CONTROL_TYPE', `Unsupported control type for event: ${target.type || target.tagName}`);
        return;
      }
      
      // The reactive system will handle the update automatically
      
      log.info('PLUGINS_PANEL', 'SETTING_CHANGE', `Setting change for plugin '${pluginId}', setting '${settingKey}' to: ${value}. Dispatching action.`);
      appStore.dispatch(pluginThunks.updatePluginSettings({ pluginId, settingKey, value }));
    }
  }






}

// Register this panel with the registry
panelRegistry.register({
    id: 'plugins',
    title: 'Plugins',
    component: PluginsPanel,
    defaultCollapsed: true,
});
