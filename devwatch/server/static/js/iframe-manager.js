(function(APP) {
  'use strict';

  if (!APP) {
    console.error('CRITICAL: APP namespace not found. This script must be loaded after the inline bootloader.');
    return;
  }

  /**
   * Manages the creation, loading, and lifecycle of PJA iframes within a designated container.
   * This manager is responsible for programmatically building the necessary DOM structure
   * for each iframe, including its wrapper, toolbar, and info panel, thus centralizing
   * iframe management and removing the need for boilerplate HTML.
   */
  class IframeManager {
    /**
     * @param {string} containerId The ID of the DOM element that will contain the iframes.
     */
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.error(`IframeManager Error: Container element with ID '${containerId}' not found.`);
        APP.initializationErrors.push(`IframeManager container #${containerId} not found.`);
        return;
      }

      this.iframes = {}; // Store instances of DevWatchIframer
      APP.iframes.managerInstance = this;
      APP.iframes.instances = this.iframes; // For backward compatibility/simpler access

      console.log(`IframeManager: Initialized with container #${containerId}. Ready to create iframes.`);
    }

    /**
     * Creates and appends a new iframe section to the container.
     * @param {object} config - The configuration object for the iframe.
     * @param {string} config.id - A unique ID for the iframe.
     * @param {string} config.src - The URL for the iframe's content.
     * @param {string} config.title - The title to display in the header.
     * @returns {DevWatchIframer|null} The created DevWatchIframer instance or null on failure.
     */
    createIframe(config) {
      if (!config || !config.id || !config.src) {
        console.error('IframeManager Error: Invalid configuration provided for createIframe.', config);
        return null;
      }

      if (this.iframes[config.id]) {
        console.warn(`IframeManager Warning: Iframe with ID '${config.id}' already exists.`);
        return this.iframes[config.id];
      }

      try {
        const wrapper = this._createDOM(config);
        this.container.appendChild(wrapper);

        // CRITICAL FIX: Find the newly created iframe element
        const iframeElement = wrapper.querySelector('iframe');
        if (!iframeElement) {
          throw new Error('Iframe element could not be found after DOM creation.');
        }

        // The DevWatchIframer class is expected to be defined in devwatch-iframer.js
        // and attached to the APP namespace.
        const iframerInstance = new APP.iframes.DevWatchIframer(iframeElement, config); // Pass the element, not the ID
        this.iframes[config.id] = iframerInstance;

        console.log(`IframeManager: Successfully created iframe '${config.id}'.`);
        return iframerInstance;
      } catch (error) {
        console.error(`IframeManager Error: Failed to create iframe with ID '${config.id}'.`, error);
        APP.initializationErrors.push(`Failed to create iframe '${config.id}'.`);
        return null;
      }
    }

    /**
     * Creates the full DOM structure for an iframe section.
     * @private
     */
    _createDOM(config) {
      const section = document.createElement('div');
      section.className = 'devwatch-iframe-section';
      section.id = `section-${config.id}`;

      const header = document.createElement('div');
      header.className = 'devwatch-iframe-header';
      header.innerHTML = `<h2>${config.title || 'Untitled Iframe'}</h2>`;
      section.appendChild(header);

      const wrapper = document.createElement('div');
      wrapper.className = 'devwatch-iframer';
      
      // Don't set the ID on the wrapper, but on the iframe itself for DevWatchIframer to find
      wrapper.innerHTML = `
        <iframe id="${config.id}" src="${config.src}" class="devwatch-iframe" allow="autoplay; fullscreen; gamepad; xr-spatial-tracking"></iframe>
        <div class="pja-info-panel-container"></div>
        <div class="devwatch-iframe-overlay"></div>
        <div class="devwatch-iframe-toolbar">
          <button class="devwatch-iframe-btn btn-reload" title="Reload Iframe">🔄</button>
          <button class="devwatch-iframe-btn btn-toggle-info" title="Toggle Info Panel">ℹ️</button>
        </div>
      `;
      section.appendChild(wrapper);

      return section;
    }

    /**
     * Retrieves an iframe instance by its ID.
     * @param {string} id The ID of the iframe to retrieve.
     * @returns {DevWatchIframer|undefined}
     */
    getIframeById(id) {
      return this.iframes[id];
    }
  }

  // Expose the manager class to the APP namespace
  APP.iframes.Manager = IframeManager;

})(window.APP);
