/**
 * client/settings/PluginsPanel.js
 * Manages the plugin settings within the main SettingsPanel.
 */

import { appStore } from '/client/appState.js'; // Assuming appStore path
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js'; // Assuming messageQueue path

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
    this.containerElement.innerHTML = '<h4>Available Plugins</h4>'; // Add a title

    this.pluginsListElement = document.createElement('ul');
    this.pluginsListElement.classList.add('plugins-list'); // Use class defined in settings.css
    this.containerElement.appendChild(this.pluginsListElement);

    // Attach the content to the provided parent (e.g., SettingsPanel's content area)
    parentElement.appendChild(this.containerElement);

    // Add event listener for checkbox changes (delegated to the list)
    this.pluginsListElement.addEventListener('change', this.handlePluginToggle.bind(this));
  }

  subscribeToState() {
    this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
      // Check if the plugins part of the state has changed
      // Assumes state structure like: { plugins: { available: {...}, enabled: [...] } }
      // Or simpler: { plugins: { mermaid: { enabled: true }, ... } }
      const newPluginsState = newState.plugins; // Adjust based on actual state structure
      const oldPluginsState = prevState.plugins;

      if (newPluginsState !== oldPluginsState) {
        logPlugins('Plugin state change detected, rendering.', 'debug');
        // Pass only the relevant part of the state
        this.render(newPluginsState || {}); // Handle case where plugins state might not exist initially
      }
    });

    // Perform an initial render with the current state
    this.render(appStore.getState().plugins || {});
  }

  // Render the list of plugins based on the current state
  render(pluginsState) {
     if (!this.pluginsListElement) return;

     logPlugins(`Rendering plugins: ${JSON.stringify(pluginsState)}`, 'debug');
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
        logPlugins(`Toggling plugin '${pluginId}' to enabled: ${isEnabled}. Dispatching action.`);
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

  // Method to clean up listeners
  destroy() {
    logPlugins('Destroying PluginsPanel...');
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }

    // Remove event listeners if necessary (though delegated listener on pluginsListElement is removed when container is removed)

    if (this.containerElement && this.containerElement.parentNode) {
        this.containerElement.parentNode.removeChild(this.containerElement);
    }
    this.containerElement = null;
    this.pluginsListElement = null;
    this.plugins = {};
    logPlugins('PluginsPanel destroyed.');
  }
}
