/**
 * client/settings/PublishSettingsPanel.js
 * Component to manage publish settings and options.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { logMessage } from '/client/log/index.js';
import { globalFetch } from '/client/globalFetch.js';
import { panelRegistry } from './panelRegistry.js';

export class PublishSettingsPanel {
  constructor(containerElement) {
    if (!containerElement) {
      throw new Error("PublishSettingsPanel requires a container element.");
    }
    this.containerElement = containerElement;
    this.publishSettingsContainer = null;
    this.unsubscribeSettings = null;
    this.spacesConfig = null;

    this.createDOM();
    this.attachEventListeners();
    this.subscribeToState();
    this.loadSpacesConfig();

    logMessage('PublishSettingsPanel instance created.', 'debug', 'SETTINGS');
  }

  async loadSpacesConfig() {
    try {
      const response = await globalFetch('/api/spaces/config');
      if (response.ok) {
        const data = await response.json();
        this.spacesConfig = data.config;
        this.updateSpacesConfigDisplay();
      } else {
        logMessage('Failed to load Spaces configuration', 'warn', 'PUBLISH_SETTINGS');
      }
    } catch (error) {
      logMessage(`Error loading Spaces config: ${error.message}`, 'error', 'PUBLISH_SETTINGS');
    }
  }

  createDOM() {
    this.publishSettingsContainer = document.createElement('div');
    this.publishSettingsContainer.className = 'publish-settings-container';

    // Create header
    const header = document.createElement('div');
    header.className = 'section-header';
    
    const title = document.createElement('h4');
    title.textContent = 'Publish Settings';
    header.appendChild(title);

    // Create publish mode selection
    const publishModeContainer = document.createElement('div');
    publishModeContainer.className = 'publish-mode-container';
    
    const publishModeTitle = document.createElement('h5');
    publishModeTitle.textContent = 'Publish Mode';
    publishModeTitle.className = 'subsection-title';
    publishModeContainer.appendChild(publishModeTitle);

    // Local file option
    const localFileOption = document.createElement('label');
    localFileOption.className = 'publish-option';
    localFileOption.innerHTML = `
      <input type="radio" name="publish-mode" value="local" checked>
      <div class="option-content">
        <strong>Local File Download</strong>
        <p>Generate and download HTML file to your computer</p>
      </div>
    `;
    publishModeContainer.appendChild(localFileOption);

    // DO Spaces option
    const spacesOption = document.createElement('label');
    spacesOption.className = 'publish-option';
    spacesOption.innerHTML = `
      <input type="radio" name="publish-mode" value="spaces">
      <div class="option-content">
        <strong>Digital Ocean Spaces</strong>
        <p>Publish to cloud storage for public sharing</p>
      </div>
    `;
    publishModeContainer.appendChild(spacesOption);

    // DO Spaces configuration display
    const spacesConfigContainer = document.createElement('div');
    spacesConfigContainer.className = 'spaces-config-container';
    spacesConfigContainer.style.display = 'none';
    
    const spacesConfigTitle = document.createElement('h5');
    spacesConfigTitle.textContent = 'Digital Ocean Spaces Configuration';
    spacesConfigTitle.className = 'subsection-title';
    spacesConfigContainer.appendChild(spacesConfigTitle);

    const spacesConfigContent = document.createElement('div');
    spacesConfigContent.className = 'spaces-config-content';
    spacesConfigContent.innerHTML = `
      <div class="config-item">
        <label>Endpoint:</label>
        <span class="config-value" id="spaces-endpoint">Loading...</span>
      </div>
      <div class="config-item">
        <label>Region:</label>
        <span class="config-value" id="spaces-region">Loading...</span>
      </div>
      <div class="config-item">
        <label>Bucket:</label>
        <span class="config-value" id="spaces-bucket">Loading...</span>
      </div>
      <div class="config-item">
        <label>Access Key:</label>
        <span class="config-value" id="spaces-key">Loading...</span>
      </div>
      <div class="config-item">
        <label>Base URL:</label>
        <span class="config-value" id="spaces-base-url">Loading...</span>
      </div>
    `;
    spacesConfigContainer.appendChild(spacesConfigContent);

    // CSS bundling options
    const bundlingContainer = document.createElement('div');
    bundlingContainer.className = 'bundling-container';
    
    const bundlingTitle = document.createElement('h5');
    bundlingTitle.textContent = 'CSS Handling';
    bundlingTitle.className = 'subsection-title';
    bundlingContainer.appendChild(bundlingTitle);

    const bundlingOption = document.createElement('label');
    bundlingOption.className = 'bundling-option';
    bundlingOption.innerHTML = `
      <input type="checkbox" class="bundle-css-toggle" checked>
      Bundle CSS inline (recommended for sharing)
    `;
    bundlingContainer.appendChild(bundlingOption);

    const bundlingDescription = document.createElement('p');
    bundlingDescription.className = 'option-description';
    bundlingDescription.textContent = 'When enabled, CSS files are bundled directly into the HTML. When disabled, CSS files are linked externally.';
    bundlingContainer.appendChild(bundlingDescription);

    // Assemble the panel
    this.publishSettingsContainer.appendChild(header);
    this.publishSettingsContainer.appendChild(publishModeContainer);
    this.publishSettingsContainer.appendChild(spacesConfigContainer);
    this.publishSettingsContainer.appendChild(bundlingContainer);
    this.containerElement.appendChild(this.publishSettingsContainer);
  }

  attachEventListeners() {
    // Publish mode radio buttons
    const radioButtons = this.publishSettingsContainer.querySelectorAll('input[name="publish-mode"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (event) => {
        this.handlePublishModeChange(event.target.value);
      });
    });

    // CSS bundling toggle (publish-specific)
    const bundleToggle = this.publishSettingsContainer.querySelector('.bundle-css-toggle');
    if (bundleToggle) {
      bundleToggle.addEventListener('change', (event) => {
        dispatch({
          type: ActionTypes.SETTINGS_SET_PUBLISH_CSS_BUNDLING,
          payload: event.target.checked
        });
      });
    }
  }

  handlePublishModeChange(mode) {
    const spacesConfigContainer = this.publishSettingsContainer.querySelector('.spaces-config-container');
    
    if (mode === 'spaces') {
      spacesConfigContainer.style.display = 'block';
    } else {
      spacesConfigContainer.style.display = 'none';
    }

    // Dispatch the publish mode change
    dispatch({
      type: ActionTypes.SETTINGS_SET_PUBLISH_MODE,
      payload: mode
    });
  }

  updateSpacesConfigDisplay() {
    if (!this.spacesConfig) return;

    const ghostValue = (value, length = 8) => {
      if (!value || value === 'Not Set') return 'Not Set';
      return value.substring(0, 3) + '•'.repeat(Math.max(0, length - 6)) + value.substring(Math.max(3, value.length - 3));
    };

    // Update endpoint
    const endpointEl = this.publishSettingsContainer.querySelector('#spaces-endpoint');
    if (endpointEl) {
      endpointEl.textContent = this.spacesConfig.endpointValue || 'Not Set';
      endpointEl.className = `config-value ${this.spacesConfig.endpointValue !== 'Not Set' ? 'configured' : 'not-configured'}`;
    }

    // Update region
    const regionEl = this.publishSettingsContainer.querySelector('#spaces-region');
    if (regionEl) {
      regionEl.textContent = this.spacesConfig.regionValue || 'Not Set';
      regionEl.className = `config-value ${this.spacesConfig.regionValue !== 'Not Set' ? 'configured' : 'not-configured'}`;
    }

    // Update bucket
    const bucketEl = this.publishSettingsContainer.querySelector('#spaces-bucket');
    if (bucketEl) {
      bucketEl.textContent = this.spacesConfig.bucketValue || 'Not Set';
      bucketEl.className = `config-value ${this.spacesConfig.bucketValue !== 'Not Set' ? 'configured' : 'not-configured'}`;
    }

    // Update access key (ghosted)
    const keyEl = this.publishSettingsContainer.querySelector('#spaces-key');
    if (keyEl) {
      const keyValue = this.spacesConfig.endpointValue; // Using endpoint as proxy for key existence
      keyEl.textContent = keyValue !== 'Not Set' ? ghostValue('DO_SPACES_KEY', 16) : 'Not Set';
      keyEl.className = `config-value ${keyValue !== 'Not Set' ? 'configured' : 'not-configured'}`;
    }

    // Update base URL
    const baseUrlEl = this.publishSettingsContainer.querySelector('#spaces-base-url');
    if (baseUrlEl) {
      baseUrlEl.textContent = this.spacesConfig.publishBaseUrlValue || 'Auto-generated';
      baseUrlEl.className = `config-value ${this.spacesConfig.publishBaseUrlValue !== 'Not Set' ? 'configured' : 'auto'}`;
    }
  }

  subscribeToState() {
    this.unsubscribeSettings = appStore.subscribe((state) => {
      const publishSettings = state.settings?.publish;
      if (publishSettings) {
        // Update publish mode radio buttons
        const radioButtons = this.publishSettingsContainer.querySelectorAll('input[name="publish-mode"]');
        radioButtons.forEach(radio => {
          radio.checked = radio.value === publishSettings.mode;
        });

        // Update CSS bundling toggle (use publish-specific setting)
        const bundleToggle = this.publishSettingsContainer.querySelector('.bundle-css-toggle');
        if (bundleToggle) {
          bundleToggle.checked = publishSettings.bundleCss !== false; // Default to true if undefined
        }

        // Update spaces config visibility
        const spacesConfigContainer = this.publishSettingsContainer.querySelector('.spaces-config-container');
        if (spacesConfigContainer) {
          spacesConfigContainer.style.display = publishSettings.mode === 'spaces' ? 'block' : 'none';
        }
      }
    });
  }

  destroy() {
    logMessage('Destroying PublishSettingsPanel instance...', 'debug', 'SETTINGS');
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
      this.unsubscribeSettings = null;
    }

    this.containerElement.innerHTML = '';
    this.publishSettingsContainer = null;
  }
}

// Register this panel with the registry
panelRegistry.register({
  id: 'publish-settings-container',
  title: 'Publish Settings',
  component: PublishSettingsPanel,
  order: 40,
  defaultCollapsed: true
}); 