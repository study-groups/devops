/**
 * EditorLinkHandler.js
 *
 * Handles opening source files in external editors (VS Code, etc.).
 * Generates editor protocol links and provides fallback options.
 *
 * Features:
 * - VS Code protocol links (vscode://file/...)
 * - Configurable editor support (VS Code, Sublime, Atom, etc.)
 * - Line number support
 * - Fallback to file system paths
 * - Click-to-open integration
 * - Self-registering to window.APP.services
 *
 * Supported editors:
 * - DevPages: http://localhost:4000/?pathname=/path/to/file (default)
 * - VS Code: vscode://file/path:line:column
 * - VS Code Insiders: vscode-insiders://file/path:line:column
 * - Sublime Text: subl://open?url=file://path&line=line
 * - Atom: atom://core/open/file?filename=path&line=line
 */

export class EditorLinkHandler {
  constructor() {
    this.defaultEditor = 'devpages'; // Default to DevPages itself
    this.projectRoot = null; // Auto-detect or configure
    this.devpagesHost = 'http://localhost:4000'; // DevPages host
    this.pathnamePrefix = '/users/mike/devpages'; // Pathname prefix for files

    this.editors = {
      devpages: {
        name: 'DevPages',
        protocol: 'http',
        formatUrl: (path, line, column) => {
          // Format: http://localhost:4000/?pathname=/users/mike/devpages/client/panels/MyPanel.js
          const fullPath = this.resolvePathForDevPages(path);
          const url = `${this.devpagesHost}/?pathname=${encodeURIComponent(fullPath)}`;
          return url;
        }
      },
      vscode: {
        name: 'VS Code',
        protocol: 'vscode',
        formatUrl: (path, line, column) =>
          `vscode://file${this.resolvePath(path)}${line ? `:${line}` : ''}${column ? `:${column}` : ''}`
      },
      'vscode-insiders': {
        name: 'VS Code Insiders',
        protocol: 'vscode-insiders',
        formatUrl: (path, line, column) =>
          `vscode-insiders://file${this.resolvePath(path)}${line ? `:${line}` : ''}${column ? `:${column}` : ''}`
      },
      sublime: {
        name: 'Sublime Text',
        protocol: 'subl',
        formatUrl: (path, line) =>
          `subl://open?url=file://${this.resolvePath(path)}${line ? `&line=${line}` : ''}`
      },
      atom: {
        name: 'Atom',
        protocol: 'atom',
        formatUrl: (path, line) =>
          `atom://core/open/file?filename=${this.resolvePath(path)}${line ? `&line=${line}` : ''}`
      },
      webstorm: {
        name: 'WebStorm',
        protocol: 'webstorm',
        formatUrl: (path, line) =>
          `webstorm://open?file=${this.resolvePath(path)}${line ? `&line=${line}` : ''}`
      }
    };

    this.loadSettings();
    console.log('[EditorLinkHandler] Service created');
  }

  /**
   * Load settings from Redux or localStorage
   */
  loadSettings() {
    try {
      // Try Redux first
      const store = window.APP?.services?.store;
      if (store) {
        const state = store.getState();
        const editor = state.settings?.sourceTracker?.editor;
        const projectRoot = state.settings?.sourceTracker?.projectRoot;
        const devpagesHost = state.settings?.sourceTracker?.devpagesHost;
        const pathnamePrefix = state.settings?.sourceTracker?.pathnamePrefix;

        if (editor) this.defaultEditor = editor;
        if (projectRoot) this.projectRoot = projectRoot;
        if (devpagesHost) this.devpagesHost = devpagesHost;
        if (pathnamePrefix) this.pathnamePrefix = pathnamePrefix;
      }

      // Fallback to localStorage
      const savedEditor = localStorage.getItem('devpages_sourcetracker_editor');
      const savedRoot = localStorage.getItem('devpages_sourcetracker_projectroot');
      const savedHost = localStorage.getItem('devpages_sourcetracker_host');
      const savedPrefix = localStorage.getItem('devpages_sourcetracker_prefix');

      if (savedEditor) this.defaultEditor = savedEditor;
      if (savedRoot) this.projectRoot = savedRoot;
      if (savedHost) this.devpagesHost = savedHost;
      if (savedPrefix) this.pathnamePrefix = savedPrefix;

      console.log(`[EditorLinkHandler] Loaded settings: editor=${this.defaultEditor}, host=${this.devpagesHost}, prefix=${this.pathnamePrefix}`);
    } catch (error) {
      console.warn('[EditorLinkHandler] Failed to load settings:', error);
    }
  }

  /**
   * Set default editor
   * @param {string} editorId - Editor ID (vscode, sublime, atom, etc.)
   * @returns {boolean} Success
   */
  setEditor(editorId) {
    if (!this.editors[editorId]) {
      console.error(`[EditorLinkHandler] Unknown editor: ${editorId}`);
      return false;
    }

    this.defaultEditor = editorId;

    // Save to localStorage
    try {
      localStorage.setItem('devpages_sourcetracker_editor', editorId);
    } catch (error) {
      console.warn('[EditorLinkHandler] Failed to save editor to localStorage:', error);
    }

    // Save to Redux
    try {
      const store = window.APP?.services?.store;
      if (store) {
        store.dispatch({
          type: 'settings/setSourceTrackerEditor',
          payload: editorId
        });
      }
    } catch (error) {
      console.warn('[EditorLinkHandler] Failed to save editor to Redux:', error);
    }

    console.log(`[EditorLinkHandler] Editor set to: ${editorId}`);
    return true;
  }

  /**
   * Set project root path
   * @param {string} path - Absolute path to project root
   * @returns {boolean} Success
   */
  setProjectRoot(path) {
    this.projectRoot = path;

    // Save to localStorage
    try {
      localStorage.setItem('devpages_sourcetracker_projectroot', path);
    } catch (error) {
      console.warn('[EditorLinkHandler] Failed to save project root:', error);
    }

    console.log(`[EditorLinkHandler] Project root set to: ${path}`);
    return true;
  }

  /**
   * Set DevPages host URL
   * @param {string} host - Host URL (e.g., 'http://localhost:4000')
   * @returns {boolean} Success
   */
  setDevPagesHost(host) {
    this.devpagesHost = host;

    // Save to localStorage
    try {
      localStorage.setItem('devpages_sourcetracker_host', host);
    } catch (error) {
      console.warn('[EditorLinkHandler] Failed to save DevPages host:', error);
    }

    console.log(`[EditorLinkHandler] DevPages host set to: ${host}`);
    return true;
  }

  /**
   * Set pathname prefix for DevPages links
   * @param {string} prefix - Pathname prefix (e.g., '/users/mike/devpages')
   * @returns {boolean} Success
   */
  setPathnamePrefix(prefix) {
    this.pathnamePrefix = prefix;

    // Save to localStorage
    try {
      localStorage.setItem('devpages_sourcetracker_prefix', prefix);
    } catch (error) {
      console.warn('[EditorLinkHandler] Failed to save pathname prefix:', error);
    }

    console.log(`[EditorLinkHandler] Pathname prefix set to: ${prefix}`);
    return true;
  }

  /**
   * Resolve relative path to absolute path
   * @param {string} path - Relative path (e.g., client/panels/MyPanel.js)
   * @returns {string} Absolute path
   */
  resolvePath(path) {
    if (!path) return '';

    // If already absolute, return as-is
    if (path.startsWith('/')) return path;

    // If project root is set, use it
    if (this.projectRoot) {
      return `${this.projectRoot}/${path}`;
    }

    // Try to auto-detect project root from window.location
    // Assuming DevPages is served from /Users/username/src/devops/devpages
    // This is a heuristic and may need configuration
    const autoRoot = this.autoDetectProjectRoot();
    if (autoRoot) {
      return `${autoRoot}/${path}`;
    }

    // Last resort: return relative path as-is (may not work)
    console.warn('[EditorLinkHandler] Cannot resolve absolute path, no project root set');
    return path;
  }

  /**
   * Auto-detect project root from browser context
   * @returns {string|null} Detected project root or null
   */
  autoDetectProjectRoot() {
    // Try to get from environment or server-provided metadata
    // For now, return null and require manual configuration
    // In production, this could be provided by the server via /api/config
    return null;
  }

  /**
   * Resolve relative path for DevPages (with pathname prefix)
   * @param {string} path - Relative path (e.g., client/panels/MyPanel.js)
   * @returns {string} Full path with prefix
   */
  resolvePathForDevPages(path) {
    if (!path) return '';

    // If already starts with prefix, return as-is
    if (path.startsWith(this.pathnamePrefix)) return path;

    // Ensure no leading slash on path
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;

    // Combine prefix and path
    return `${this.pathnamePrefix}/${cleanPath}`;
  }

  /**
   * Generate editor link for a file
   * @param {string} filePath - File path
   * @param {number} [line] - Line number (optional)
   * @param {number} [column] - Column number (optional)
   * @param {string} [editorId] - Editor ID (defaults to defaultEditor)
   * @returns {string} Editor protocol URL
   */
  generateLink(filePath, line = null, column = null, editorId = null) {
    const editor = this.editors[editorId || this.defaultEditor];
    if (!editor) {
      console.error(`[EditorLinkHandler] Unknown editor: ${editorId || this.defaultEditor}`);
      return null;
    }

    return editor.formatUrl(filePath, line, column);
  }

  /**
   * Open a file in the configured editor
   * @param {string} filePath - File path
   * @param {number} [line] - Line number (optional)
   * @param {number} [column] - Column number (optional)
   * @returns {boolean} Success
   */
  open(filePath, line = null, column = null) {
    const url = this.generateLink(filePath, line, column);
    if (!url) return false;

    try {
      // For DevPages (HTTP), navigate directly in same tab
      if (this.defaultEditor === 'devpages') {
        window.location.href = url;
        console.log(`[EditorLinkHandler] Navigating to: ${url}`);
      } else {
        // For external editors (vscode://, etc.), try to trigger protocol handler
        // Use window.location for protocol handlers
        window.location.href = url;
        console.log(`[EditorLinkHandler] Opening in ${this.defaultEditor}: ${url}`);
      }
      return true;
    } catch (error) {
      console.error('[EditorLinkHandler] Failed to open file:', error);
      return false;
    }
  }

  /**
   * Create a clickable link element
   * @param {string} filePath - File path
   * @param {number} [line] - Line number (optional)
   * @param {Object} [options] - Link options
   * @param {string} [options.text] - Link text (defaults to file path)
   * @param {string} [options.className] - CSS class name
   * @param {string} [options.title] - Tooltip text
   * @returns {HTMLAnchorElement} Link element
   */
  createLink(filePath, line = null, options = {}) {
    const url = this.generateLink(filePath, line);
    const link = document.createElement('a');

    link.href = url || '#';
    link.textContent = options.text || this.formatFilePath(filePath, line);
    link.title = options.title || `Open in ${this.editors[this.defaultEditor].name}`;

    if (options.className) {
      link.className = options.className;
    }

    // Prevent default and use our open() method for better error handling
    link.addEventListener('click', (e) => {
      e.preventDefault();
      this.open(filePath, line);
    });

    return link;
  }

  /**
   * Format file path for display
   * @param {string} filePath - File path
   * @param {number} [line] - Line number (optional)
   * @returns {string} Formatted path
   */
  formatFilePath(filePath, line = null) {
    const shortPath = filePath.replace(/^client\//, '');
    return line ? `${shortPath}:${line}` : shortPath;
  }

  /**
   * Get list of available editors
   * @returns {Array<Object>} Editor list
   */
  getAvailableEditors() {
    return Object.entries(this.editors).map(([id, editor]) => ({
      id: id,
      name: editor.name,
      protocol: editor.protocol,
      isDefault: id === this.defaultEditor
    }));
  }

  /**
   * Get current editor
   * @returns {Object} Current editor info
   */
  getCurrentEditor() {
    return {
      id: this.defaultEditor,
      ...this.editors[this.defaultEditor]
    };
  }

  /**
   * Test if editor protocol is supported
   * @param {string} [editorId] - Editor ID (defaults to defaultEditor)
   * @returns {Promise<boolean>} Whether protocol is supported
   */
  async testProtocol(editorId = null) {
    const editor = this.editors[editorId || this.defaultEditor];
    if (!editor) return false;

    // Create a test link
    const testPath = '/test';
    const url = editor.formatUrl(testPath, 1);

    // Try to detect if protocol is registered
    // This is browser-dependent and may not work reliably
    try {
      // Create a hidden iframe to test the protocol
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);

      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);

      // We can't reliably detect success, so assume it works
      return true;
    } catch (error) {
      console.warn('[EditorLinkHandler] Protocol test failed:', error);
      return false;
    }
  }

  /**
   * Get help text for setting up editor integration
   * @param {string} [editorId] - Editor ID (defaults to defaultEditor)
   * @returns {string} Help text
   */
  getSetupHelp(editorId = null) {
    const id = editorId || this.defaultEditor;

    const helpText = {
      devpages: `DevPages (default) opens files within DevPages itself. Configure host and pathname prefix using:\n  editorLink.setDevPagesHost('http://localhost:4000')\n  editorLink.setPathnamePrefix('/users/mike/devpages')`,
      vscode: 'VS Code supports the vscode:// protocol by default. Make sure VS Code is installed and set as the default handler for vscode:// links.',
      'vscode-insiders': 'VS Code Insiders supports the vscode-insiders:// protocol by default. Make sure VS Code Insiders is installed.',
      sublime: 'Sublime Text requires the subl:// protocol handler to be set up manually. See: https://github.com/dhoulb/subl',
      atom: 'Atom supports the atom:// protocol by default when installed.',
      webstorm: 'WebStorm supports the webstorm:// protocol. Configure it in WebStorm settings under Tools > Web Browsers and Previews.'
    };

    return helpText[id] || 'No setup help available for this editor.';
  }

  /**
   * Get statistics about editor usage
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      defaultEditor: this.defaultEditor,
      projectRoot: this.projectRoot || 'not set',
      devpagesHost: this.devpagesHost,
      pathnamePrefix: this.pathnamePrefix,
      availableEditors: Object.keys(this.editors).length
    };
  }
}

// =============================================================================
// SELF-REGISTRATION (IIFE-style)
// =============================================================================

// Create singleton instance
const editorLinkHandler = new EditorLinkHandler();

// Self-register into window.APP.services
if (!window.APP) window.APP = {};
if (!window.APP.services) window.APP.services = {};
window.APP.services.editorLink = editorLinkHandler;

console.log('[EditorLinkHandler] Service registered to window.APP.services.editorLink');

// Export singleton instance as default
export default editorLinkHandler;
