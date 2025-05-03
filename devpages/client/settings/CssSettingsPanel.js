/**
 * client/settings/CssSettingsPanel.js
 * Component to manage preview CSS file settings.
 */

import { appStore } from '/client/appState.js';
// Assuming ActionTypes are defined and exported from messaging/messageQueue or similar
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { logMessage } from '/client/log/index.js';
// --- Import function to trigger CSS update ---
// import { applyCssStyles } from '/client/preview/plugins/index.js';

export class CssSettingsPanel {
  /**
   * Creates an instance of CssSettingsPanel.
   * @param {HTMLElement} containerElement - The DOM element to render this panel into.
   */
  constructor(containerElement) {
    if (!containerElement) {
      throw new Error("CssSettingsPanel requires a container element.");
    }
    this.containerElement = containerElement;
    this.cssSettingsContainer = null;
    this.cssFileInput = null;
    this.addCssFileButton = null;
    this.cssFileList = null;
    this.unsubscribeSettings = null;

    this.createDOM();
    this.attachEventListeners();
    this.subscribeToState();

    // Initial render based on current state
    this.renderCssFileList(
        appStore.getState().settings?.preview?.cssFiles || [],
        appStore.getState().settings?.preview?.activeCssFiles || [] // Pass initial active files
    );

    logMessage('CssSettingsPanel instance created.', 'debug', 'SETTINGS');
  }

  createDOM() {
    this.cssSettingsContainer = document.createElement('div');
    this.cssSettingsContainer.classList.add('settings-section', 'css-settings');
    this.cssSettingsContainer.innerHTML = `
        <h3 class="settings-section-title">Preview CSS Files</h3>
        <p class="settings-description">
            Paths relative to MD_DIR (e.g., themes/dark.css). Toggle to enable/disable.
        </p>
        <div class="settings-input-group">
            <input type="text" id="css-file-input" class="settings-input" placeholder="e.g., themes/dark.css" aria-label="CSS file path relative to MD_DIR">
            <button id="add-css-file-btn" class="settings-button">Add File</button>
        </div>
        <ul id="css-file-list" class="settings-list" aria-live="polite" aria-label="Configured Preview CSS Files"></ul>
    `;
    this.containerElement.appendChild(this.cssSettingsContainer);

    // Store references to interactive elements
    this.cssFileInput = this.cssSettingsContainer.querySelector('#css-file-input');
    this.addCssFileButton = this.cssSettingsContainer.querySelector('#add-css-file-btn');
    this.cssFileList = this.cssSettingsContainer.querySelector('#css-file-list');
  }

  attachEventListeners() {
    this.addCssFileButton.addEventListener('click', this.handleAddCssFile.bind(this));
    // Listen for both 'click' on remove buttons and 'change' on checkboxes
    this.cssFileList.addEventListener('click', this.handleListClick.bind(this));
    this.cssFileList.addEventListener('change', this.handleCheckboxToggle.bind(this)); // <<< NEW LISTENER
  }

  subscribeToState() {
    this.unsubscribeSettings = appStore.subscribe((newState, prevState) => {
      const newPreviewSettings = newState.settings?.preview;
      const oldPreviewSettings = prevState.settings?.preview;

      // Re-render if configured files (structure/enabled flag) OR active files change
      if (JSON.stringify(newPreviewSettings?.cssFiles) !== JSON.stringify(oldPreviewSettings?.cssFiles) ||
          JSON.stringify(newPreviewSettings?.activeCssFiles) !== JSON.stringify(oldPreviewSettings?.activeCssFiles))
      {
        logMessage('Preview CSS settings changed in state, re-rendering list.', 'debug', 'SETTINGS');
        this.renderCssFileList(
            newPreviewSettings?.cssFiles || [],      // Pass array of {path, enabled} objects
            newPreviewSettings?.activeCssFiles || [] // Pass array of active path strings
        );
      }
    });
  }

  /**
   * Renders the list of configured CSS files.
   * @param {Array<{path: string, enabled: boolean}>} configuredItems - Configured CSS items.
   * @param {string[]} activePaths - Array of currently active CSS file paths.
   */
  renderCssFileList(configuredItems = [], activePaths = []) {
    logMessage(`Rendering CSS list. Configured: ${configuredItems.length}, Active: ${activePaths.length}`, 'debug', 'SETTINGS');
    this.cssFileList.innerHTML = '';
    const activeSet = new Set(activePaths);
    const rootCssPath = 'styles.css';
    const state = appStore.getState(); // Get current state to check enableRootCss
    const isRootEnabledByUser = state.settings?.preview?.enableRootCss ?? true; // Get user's setting
    const isRootActuallyActive = activeSet.has(rootCssPath); // Get actual load status

    // --- Render Implicit Root CSS Entry ---
    const rootListItem = document.createElement('li');
    rootListItem.classList.add('settings-list-item', 'css-list-item', 'css-item-root');
    // Style based on enabled setting, not active status
    rootListItem.classList.toggle('css-item-disabled', !isRootEnabledByUser);

    rootListItem.innerHTML = `
        <input
            type="checkbox"
            id="css-toggle-root"
            class="css-enable-toggle"
            data-path="${rootCssPath}"
            ${isRootEnabledByUser ? 'checked' : ''}
            aria-labelledby="css-toggle-root-label"
        >
        <label id="css-toggle-root-label" for="css-toggle-root" class="css-file-path">MD_DIR/styles.css</label>
        <span class="css-item-status">${isRootActuallyActive ? '(Active)' : '(Inactive)'}</span>
        <span class="remove-css-placeholder"></span>
    `;
    this.cssFileList.appendChild(rootListItem);
    // --------------------------------------

    // --- Render User-Configured Files ---
    if (Array.isArray(configuredItems) && configuredItems.length > 0) {
        configuredItems.forEach(item => {
          const listItem = document.createElement('li');
          listItem.classList.add('settings-list-item', 'css-list-item');
          listItem.classList.toggle('css-item-disabled', !item.enabled);

          const displayPath = `MD_DIR/${item.path.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
          const isActive = activeSet.has(item.path); // Actual load status
          const checkboxId = `css-toggle-${item.path.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

          listItem.innerHTML = `
              <input
                  type="checkbox"
                  id="${checkboxId}"
                  class="css-enable-toggle"
                  data-path="${item.path}"
                  ${item.enabled ? 'checked' : ''}
                  aria-labelledby="${checkboxId}-label"
              >
              <label id="${checkboxId}-label" for="${checkboxId}" class="css-file-path" title="Toggle enabled state">${displayPath}</label>
              <span class="css-item-status">${isActive ? '(Active)' : '(Inactive)'}</span>
              <button class="remove-css-btn settings-button settings-button-small" data-path="${item.path}" aria-label="Remove ${displayPath} from configuration">Remove</button>
          `;
          this.cssFileList.appendChild(listItem);
        });
    }
  }

  // --- Event Handlers ---

  handleAddCssFile() {
    const filePath = this.cssFileInput.value.trim();
    if (filePath) {
      dispatch({ type: ActionTypes.SETTINGS_ADD_PREVIEW_CSS, payload: filePath });
      this.cssFileInput.value = '';
      this.cssFileInput.focus();
    }
  }

  handleListClick(event) {
    if (event.target.classList.contains('remove-css-btn') && event.target.dataset.path) {
      const filePath = event.target.dataset.path;
      dispatch({ type: ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS, payload: filePath });
    }
  }

  handleCheckboxToggle(event) {
    if (event.target.classList.contains('css-enable-toggle') && event.target.dataset.path) {
        const filePath = event.target.dataset.path;
        const rootCssPath = 'styles.css';

        if (filePath === rootCssPath) {
            dispatch({ type: ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED });
        } else {
            dispatch({ type: ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED, payload: filePath });
        }
    }
  }

  /**
   * Cleans up event listeners and subscriptions.
   */
  destroy() {
    logMessage('Destroying CssSettingsPanel instance...', 'debug', 'SETTINGS');
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
      this.unsubscribeSettings = null;
    }

    // Remove listeners from elements (important if panel is re-created)
    if (this.addCssFileButton) {
        this.addCssFileButton.removeEventListener('click', this.handleAddCssFile);
    }
     if (this.cssFileList) {
        this.cssFileList.removeEventListener('click', this.handleListClick);
        this.cssFileList.removeEventListener('change', this.handleCheckboxToggle); // <<< REMOVE NEW LISTENER
    }

    // Remove the container from the DOM (optional, depends on parent's lifecycle)
    // if (this.cssSettingsContainer && this.cssSettingsContainer.parentNode) {
    //     this.cssSettingsContainer.parentNode.removeChild(this.cssSettingsContainer);
    // }

    this.containerElement = null;
    this.cssSettingsContainer = null;
    this.cssFileInput = null;
    this.addCssFileButton = null;
    this.cssFileList = null;
  }
}
