/**
 * client/settings/PluginsPanel.js
 * Manages the plugin settings within the main SettingsPanel.
 */

import { appStore } from '/client/appState.js'; // Assuming appStore path
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js'; // Assuming messageQueue path
// import { CssSettingsPanel } from './CssSettingsPanel.js'; // <<< REMOVE Import CssSettingsPanel

// Helper for logging specific to this panel
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
    this.containerElement = null; // The main element for this panel's content
    this.pluginsListElement = null; // UL element to hold plugin items
    // this.cssSettingsContainer = null; // <<< REMOVE Container for CSS Settings
    // this.cssSettingsPanelInstance = null; // <<< REMOVE Instance of CssSettingsPanel
    this.stateUnsubscribe = null;
    this.plugins = {}; // Local cache of plugin states

    if (!parentElement) {
      logPlugins('PluginsPanel requires a parent element to attach its content.', 'error');
      return;
    }

    this.createPanelContent(parentElement);
    this.subscribeToState();

    // Initial render based on store state (will be called via subscription)
    logPlugins('PluginsPanel instance created.');
  }

  createPanelContent(parentElement) {
    this.containerElement = document.createElement('div');
    this.containerElement.classList.add('plugins-panel-content');

    // --- Plugin Toggles Section ---
    const pluginsSection = document.createElement('div');
    pluginsSection.classList.add('settings-section', 'plugins-toggles');
    this.pluginsListElement = document.createElement('ul');
    this.pluginsListElement.classList.add('plugins-list'); // Use class defined in settings.css
    pluginsSection.appendChild(this.pluginsListElement);
    this.containerElement.appendChild(pluginsSection);

    // Add event listener for checkbox changes (delegated to the list)
    this.pluginsListElement.addEventListener('change', this.handlePluginToggle.bind(this));

    // --- REMOVE CSS Settings Section Instantiation ---
    /*
    // Create a dedicated container for CssSettingsPanel to render into
    this.cssSettingsContainer = document.createElement('div');
    this.cssSettingsContainer.classList.add('css-settings-panel-container'); 
    this.containerElement.appendChild(this.cssSettingsContainer);

    // Instantiate CssSettingsPanel, passing the dedicated container
    try {
        this.cssSettingsPanelInstance = new CssSettingsPanel(this.cssSettingsContainer);
    } catch (error) {
        logPlugins(`Failed to initialize CssSettingsPanel: ${error}`, 'error');
        this.cssSettingsContainer.innerHTML = '<p style="color: red;">Error loading CSS settings.</p>';
    }
    */
    // --- END REMOVE CSS SECTION ---

    // Attach the main content container to the provided parent
    parentElement.appendChild(this.containerElement);
  }

  subscribeToState() {
    this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
      // Check if the plugins part of the state has changed
      // Assumes state structure like: { plugins: { available: {...}, enabled: [...] } }
      // Or simpler: { plugins: { mermaid: { enabled: true }, ... } }
      const newPluginsState = newState.plugins; // Adjust based on actual state structure
      const oldPluginsState = prevState.plugins;

      if (newPluginsState !== oldPluginsState) {
        logPlugins('Plugin state change detected, rendering toggle list.', 'debug');
        // Pass only the relevant part of the state
        this.render(newPluginsState || {}); // Handle case where plugins state might not exist initially
      }
      // Note: CssSettingsPanel has its own subscription and handles its own re-rendering
    });

    // Perform an initial render for the plugin toggles
    this.render(appStore.getState().plugins || {});
  }

  // Render the list of plugins based on the current state (Plugin Toggles only)
  render(pluginsState) {
     if (!this.pluginsListElement) return;

     logPlugins(`Rendering plugin toggles: ${JSON.stringify(pluginsState)}`, 'debug');
     this.pluginsListElement.innerHTML = ''; // Clear existing list items

     // Assuming pluginsState is an object like: { mermaid: { name: "Mermaid Diagrams", enabled: true }, ... }
     for (const pluginId in pluginsState) {
       if (Object.hasOwnProperty.call(pluginsState, pluginId)) {
         const plugin = pluginsState[pluginId];
         const listItem = document.createElement('li');
         listItem.classList.add('plugin-item'); // Use class defined in settings.css
         listItem.dataset.pluginId = pluginId; // Store ID for event handling

         const checkbox = document.createElement('input');
         checkbox.type = 'checkbox';
         checkbox.id = `plugin-toggle-${pluginId}`;
         checkbox.checked = plugin.enabled || false; // Default to false if undefined

         const label = document.createElement('label');
         label.htmlFor = checkbox.id;
         label.textContent = plugin.name || pluginId; // Use name if available, else ID

         listItem.appendChild(checkbox);
         listItem.appendChild(label);
         this.pluginsListElement.appendChild(listItem);
       }
     }
     // Cache the current state locally
     this.plugins = { ...pluginsState };
  }

  handlePluginToggle(event) {
    if (event.target.type === 'checkbox') {
      const listItem = event.target.closest('.plugin-item');
      const pluginId = listItem?.dataset.pluginId;
      const isEnabled = event.target.checked;

      if (pluginId) {
        logPlugins(`Toggling plugin \'${pluginId}\' to enabled: ${isEnabled}. Dispatching action.`);
        // Assume an action type like PLUGIN_TOGGLE
        // The reducer would handle updating the state in the store
        dispatch({
          type: ActionTypes.PLUGIN_TOGGLE, // Replace with actual ActionType
          payload: {
             pluginId: pluginId,
             enabled: isEnabled,
          }
        });
      } else {
          logPlugins('Could not determine plugin ID from toggle event.', 'warn');
      }
    }
  }

  // Method to clean up listeners and child components
  destroy() {
    logPlugins('Destroying PluginsPanel...');
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }

    // --- REMOVE Destroying the CssSettingsPanel instance ---
    /*
    if (this.cssSettingsPanelInstance) {
        this.cssSettingsPanelInstance.destroy();
        this.cssSettingsPanelInstance = null;
    }
    */
    // ---------------------------------------------

    // Remove event listeners if necessary

    if (this.containerElement && this.containerElement.parentNode) {
        this.containerElement.parentNode.removeChild(this.containerElement);
    }
    this.containerElement = null;
    this.pluginsListElement = null;
    // this.cssSettingsContainer = null; // <<< REMOVE reference
    this.plugins = {};
    logPlugins('PluginsPanel destroyed.');
  }
}
