/**
 * client/settings/PublishSettingsPanel.js
 * Component to manage publish settings and options.
 */

import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { e } from '/client/components/elements.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';

export class PublishSettingsPanel {
  constructor(containerElement) {
    if (!containerElement) {
      throw new Error("PublishSettingsPanel requires a container element.");
    }
    this.containerElement = containerElement;
    this.publishSettingsContainer = null;
    this.unsubscribeSettings = null;
    this.spacesConfig = null;

    this.render();
    this.attachEventListeners();
    this.subscribeToState();
    this.loadSpacesConfig();

    logMessage('PublishSettingsPanel instance created.', 'debug', 'SETTINGS');
  }

  async loadSpacesConfig() {
    try {
      const response = await window.APP.services.globalFetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        this.spacesConfig = data;
        this.updateSpacesConfigDisplay();
      } else {
        logMessage('Failed to load Spaces configuration', 'warn', 'PUBLISH_SETTINGS');
      }
    } catch (error) {
      logMessage(`Error loading Spaces config: ${error.message}`, 'error', 'PUBLISH_SETTINGS');
    }
  }

  render() {
    this.containerElement.innerHTML = `
      <div class="settings-section-container">
        <h2 class="settings-section-header" tabindex="0"><span class="collapse-indicator">▼</span>Publish Mode</h2>
        <div class="settings-section-content">
          <p class="settings-text--muted">Choose how to generate the final HTML file.</p>
          <div id="publish-mode-options" class="settings-flex--column" style="gap: var(--density-space-sm);">
            <label class="settings-flex" style="padding: var(--density-space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-md);">
              <input type="radio" name="publish-mode" value="local" style="margin-right: var(--density-space-sm);">
              <div>
                <strong>Local File Download</strong>
                <p class="settings-text--muted" style="margin: 0;">Generate and download HTML file to your computer</p>
              </div>
            </label>
            <label class="settings-flex" style="padding: var(--density-space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-md);">
              <input type="radio" name="publish-mode" value="spaces" style="margin-right: var(--density-space-sm);">
              <div>
                <strong>DigitalOcean Spaces</strong>
                <p class="settings-text--muted" style="margin: 0;">Publish to cloud storage for public sharing</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div id="spaces-config-section" class="settings-section-container collapsed">
        <h2 class="settings-section-header" tabindex="0"><span class="collapse-indicator">►</span>DigitalOcean Spaces Configuration</h2>
        <div class="settings-section-content">
           <div id="spaces-config-content" class="settings-flex--column" style="gap: var(--density-space-sm);">
              <div class="settings-flex" style="justify-content: space-between;">
                <label class="settings-label">Endpoint:</label>
                <span id="spaces-endpoint" class="settings-text--muted">Loading...</span>
              </div>
              <div class="settings-flex" style="justify-content: space-between;">
                <label class="settings-label">Region:</label>
                <span id="spaces-region" class="settings-text--muted">Loading...</span>
              </div>
              <div class="settings-flex" style="justify-content: space-between;">
                <label class="settings-label">Bucket:</label>
                <span id="spaces-bucket" class="settings-text--muted">Loading...</span>
              </div>
              <div class="settings-flex" style="justify-content: space-between;">
                <label class="settings-label">Access Key:</label>
                <span id="spaces-key" class="settings-text--muted">Loading...</span>
              </div>
              <div class="settings-flex" style="justify-content: space-between;">
                <label class="settings-label">Base URL:</label>
                <span id="spaces-base-url" class="settings-text--muted">Loading...</span>
              </div>
           </div>
        </div>
      </div>

      <div class="settings-section-container">
        <h2 class="settings-section-header" tabindex="0"><span class="collapse-indicator">▼</span>CSS Handling</h2>
        <div class="settings-section-content">
            <label class="settings-toggle">
                <input type="checkbox" class="settings-toggle-input" id="bundle-css-toggle">
                <span class="settings-toggle-slider"></span>
                <span class="settings-toggle-label">Bundle CSS inline (recommended for sharing)</span>
            </label>
            <p class="settings-text--muted" style="margin-top: var(--density-space-sm);">
                When enabled, CSS files are bundled directly into the HTML. When disabled, CSS files are linked externally.
            </p>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Collapsible sections
    this.containerElement.querySelectorAll('.settings-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const container = header.closest('.settings-section-container');
            container.classList.toggle('collapsed');
            const indicator = header.querySelector('.collapse-indicator');
            if (indicator) {
                indicator.textContent = container.classList.contains('collapsed') ? '►' : '▼';
            }
        });
    });

    // Publish mode radio buttons
    const radioButtons = this.containerElement.querySelectorAll('input[name="publish-mode"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (event) => {
        dispatch({
          type: ActionTypes.SETTINGS_SET_PUBLISH_MODE,
          payload: event.target.value
        });
      });
    });

    // CSS bundling toggle (publish-specific)
    const bundleToggle = this.containerElement.querySelector('#bundle-css-toggle');
    if (bundleToggle) {
      bundleToggle.addEventListener('change', (event) => {
        dispatch({
          type: ActionTypes.SETTINGS_SET_PUBLISH_CSS_BUNDLING,
          payload: event.target.checked
        });
      });
    }
  }

  updateUI(publishSettings) {
    if (!publishSettings) return;

    // Update radio buttons
    const radioButtons = this.containerElement.querySelectorAll('input[name="publish-mode"]');
    radioButtons.forEach(radio => {
      radio.checked = radio.value === publishSettings.mode;
    });

    // Update CSS bundling toggle
    const bundleToggle = this.containerElement.querySelector('#bundle-css-toggle');
    if (bundleToggle) {
      bundleToggle.checked = publishSettings.bundleCss;
    }
    
    // Update visibility of Spaces config section
    const spacesConfigSection = this.containerElement.querySelector('#spaces-config-section');
    if (spacesConfigSection) {
        const isSpacesMode = publishSettings.mode === 'spaces';
        const isCollapsed = spacesConfigSection.classList.contains('collapsed');

        if (isSpacesMode && isCollapsed) {
            spacesConfigSection.classList.remove('collapsed');
            const indicator = spacesConfigSection.querySelector('.collapse-indicator');
            if (indicator) indicator.textContent = '▼';
        } else if (!isSpacesMode && !isCollapsed) {
            spacesConfigSection.classList.add('collapsed');
            const indicator = spacesConfigSection.querySelector('.collapse-indicator');
            if (indicator) indicator.textContent = '►';
        }
    }
  }

  updateSpacesConfigDisplay() {
    if (!this.spacesConfig) return;

    // Update endpoint
    const endpointEl = this.containerElement.querySelector('#spaces-endpoint');
    if (endpointEl) {
      endpointEl.textContent = this.spacesConfig.DO_SPACES_ENDPOINT || 'Not Set';
      endpointEl.className = `settings-text--muted ${this.spacesConfig.DO_SPACES_ENDPOINT ? 'configured' : 'not-configured'}`;
    }

    // Update region
    const regionEl = this.containerElement.querySelector('#spaces-region');
    if (regionEl) {
      regionEl.textContent = this.spacesConfig.DO_SPACES_REGION || 'Not Set';
      regionEl.className = `settings-text--muted ${this.spacesConfig.DO_SPACES_REGION ? 'configured' : 'not-configured'}`;
    }

    // Update bucket
    const bucketEl = this.containerElement.querySelector('#spaces-bucket');
    if (bucketEl) {
      bucketEl.textContent = this.spacesConfig.DO_SPACES_BUCKET || 'Not Set';
      bucketEl.className = `settings-text--muted ${this.spacesConfig.DO_SPACES_BUCKET ? 'configured' : 'not-configured'}`;
    }

    // Update access key
    const keyEl = this.containerElement.querySelector('#spaces-key');
    if (keyEl) {
      keyEl.textContent = this.spacesConfig.DO_SPACES_KEY || 'Not Set';
      keyEl.className = `settings-text--muted ${this.spacesConfig.DO_SPACES_KEY ? 'configured' : 'not-configured'}`;
    }

    // Update base URL
    const baseUrlEl = this.containerElement.querySelector('#spaces-base-url');
    if (baseUrlEl) {
      baseUrlEl.textContent = this.spacesConfig.PUBLISH_BASE_URL || 'Auto-generated';
      baseUrlEl.className = `settings-text--muted ${this.spacesConfig.PUBLISH_BASE_URL ? 'configured' : 'auto'}`;
    }
  }

  subscribeToState() {
    this.unsubscribeSettings = appStore.subscribe((state) => {
      const publishSettings = state.settings?.publish;
      this.updateUI(publishSettings);
    });
  }

  destroy() {
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
    }
    logMessage('PublishSettingsPanel instance destroyed.', 'debug', 'SETTINGS');
  }
}

// Register this panel with the registry
panelRegistry.register({
    id: 'publish-settings',
    title: 'Publishing',
    component: PublishSettingsPanel,
    icon: 'upload-cloud', // Example icon
    level: 1, // Core setting
}); 