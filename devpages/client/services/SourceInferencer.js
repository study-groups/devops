/**
 * SourceInferencer.js
 *
 * Infers source code origins for DOM elements using heuristics.
 * Used when elements don't have explicit source metadata.
 *
 * Inference strategies:
 * - Class name patterns (devpages-*, panel-*, etc.)
 * - Data attributes (data-panel-type, data-component, etc.)
 * - Element IDs
 * - Parent hierarchy analysis
 * - Known DevPages component patterns
 * - File naming conventions
 *
 * Self-registering to window.APP.services
 */

export class SourceInferencer {
  constructor() {
    // Known component patterns and their likely source files
    this.patterns = {
      // Panels
      panelTypes: {
        'debug-logging': { file: 'client/panels/DebugLoggingPanel.js', component: 'DebugLoggingPanel' },
        'dom-inspector': { file: 'client/panels/DOMInspectorPanel.js', component: 'DOMInspectorPanel' },
        'css-inspector': { file: 'client/panels/CSSInspectorPanel.js', component: 'CSSInspectorPanel' },
        'ui-inspector': { file: 'client/panels/UIInspectorPanel.js', component: 'UIInspectorPanel' },
        'inspector-utilities': { file: 'client/panels/InspectorUtilitiesPanel.js', component: 'InspectorUtilitiesPanel' },
        'design-tokens': { file: 'client/panels/DesignTokensPanel.js', component: 'DesignTokensPanel' },
        'theme-management': { file: 'client/panels/ThemeManagementPanel.js', component: 'ThemeManagementPanel' },
        'publish': { file: 'client/panels/publish/PublishPanel.js', component: 'PublishPanel' },
        'diagnostic': { file: 'client/panels/DiagnosticPanel.js', component: 'DiagnosticPanel' },
        'system-diagnostics': { file: 'client/panels/DiagnosticPanel.js', component: 'DiagnosticPanel' }
      },

      // Components by class prefix
      classPrefix: {
        'devpages-panel': { file: 'client/panels/*.js', component: 'Panel', type: 'panel' },
        'devpages-sidebar': { file: 'client/layout/SidebarManager.js', component: 'SidebarManager', type: 'layout' },
        'devpages-workspace': { file: 'client/components/WorkspaceManager.js', component: 'WorkspaceManager', type: 'layout' },
        'file-browser': { file: 'client/file-browser/FileBrowser.js', component: 'FileBrowser', type: 'component' },
        'log-display': { file: 'client/log/LogDisplay.js', component: 'LogDisplay', type: 'component' },
        'log-': { file: 'client/log/*.js', component: 'Log', type: 'component' },
        'auth-display': { file: 'client/components/AuthDisplay.js', component: 'AuthDisplay', type: 'component' },
        'path-manager': { file: 'client/components/PathManagerComponent.js', component: 'PathManagerComponent', type: 'component' },
        'context-': { file: 'client/components/*Context*.js', component: 'Context', type: 'component' },
        'publish-modal': { file: 'client/components/publish/PublishModal.js', component: 'PublishModal', type: 'component' }
      },

      // Components by ID
      idPatterns: {
        'log-container': { file: 'client/log/LogDisplay.js', component: 'LogDisplay' },
        'file-browser': { file: 'client/file-browser/FileBrowser.js', component: 'FileBrowser' },
        'editor-container': { file: 'client/layout/workspace-layout.css', component: 'Editor', type: 'layout' },
        'preview-container': { file: 'client/preview/preview.js', component: 'Preview' },
        'sidebar-container': { file: 'client/layout/SidebarManager.js', component: 'SidebarManager' },
        'top-bar': { file: 'client/components/TopBarController.js', component: 'TopBarController' },
        'auth-component-container': { file: 'client/components/AuthDisplay.js', component: 'AuthDisplay' },
        'context-manager-container': { file: 'client/components/PathManagerComponent.js', component: 'PathManagerComponent' }
      }
    };

    console.log('[SourceInferencer] Service created');
  }

  /**
   * Infer source information for an element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object} Inferred source info
   */
  infer(element) {
    if (!element) {
      return { componentName: 'Unknown', filePath: null, inferred: true };
    }

    // Try multiple inference strategies in order of confidence

    // 1. Data attributes (highest confidence)
    const dataAttrResult = this.inferFromDataAttributes(element);
    if (dataAttrResult.confidence === 'high') {
      return dataAttrResult;
    }

    // 2. Element ID
    const idResult = this.inferFromId(element);
    if (idResult.confidence === 'high') {
      return idResult;
    }

    // 3. Class names
    const classResult = this.inferFromClasses(element);
    if (classResult.confidence !== 'none') {
      return classResult;
    }

    // 4. Parent hierarchy
    const parentResult = this.inferFromParent(element);
    if (parentResult.confidence !== 'none') {
      return parentResult;
    }

    // 5. Element type and context
    const contextResult = this.inferFromContext(element);
    return contextResult;
  }

  /**
   * Infer from data attributes
   * @param {HTMLElement} element
   * @returns {Object} Inference result
   */
  inferFromDataAttributes(element) {
    // Check for panel type
    const panelType = element.dataset?.panelType;
    if (panelType && this.patterns.panelTypes[panelType]) {
      const pattern = this.patterns.panelTypes[panelType];
      return {
        componentName: pattern.component,
        filePath: pattern.file,
        type: 'panel',
        confidence: 'high',
        inferredFrom: `data-panel-type="${panelType}"`,
        inferred: true
      };
    }

    // Check for component marker
    const componentType = element.dataset?.component;
    if (componentType) {
      return {
        componentName: componentType,
        filePath: this.guessFilePathFromComponent(componentType),
        type: 'component',
        confidence: 'medium',
        inferredFrom: `data-component="${componentType}"`,
        inferred: true
      };
    }

    // Check for panel ID in data attributes
    const panelId = element.dataset?.panelId;
    if (panelId) {
      return {
        componentName: panelId,
        filePath: `client/panels/${this.capitalize(panelId)}Panel.js`,
        type: 'panel',
        confidence: 'medium',
        inferredFrom: `data-panel-id="${panelId}"`,
        inferred: true
      };
    }

    return { confidence: 'none', inferred: true };
  }

  /**
   * Infer from element ID
   * @param {HTMLElement} element
   * @returns {Object} Inference result
   */
  inferFromId(element) {
    const id = element.id;
    if (!id) return { confidence: 'none', inferred: true };

    // Check known ID patterns
    if (this.patterns.idPatterns[id]) {
      const pattern = this.patterns.idPatterns[id];
      return {
        componentName: pattern.component,
        filePath: pattern.file,
        type: pattern.type || 'component',
        confidence: 'high',
        inferredFrom: `id="${id}"`,
        inferred: true
      };
    }

    // Try to infer from ID structure
    // e.g., "my-component-container" → "MyComponent"
    if (id.includes('-')) {
      const parts = id.split('-');
      const componentName = parts.map(p => this.capitalize(p)).join('');
      return {
        componentName: componentName,
        filePath: this.guessFilePathFromComponent(componentName),
        type: 'component',
        confidence: 'low',
        inferredFrom: `id="${id}"`,
        inferred: true
      };
    }

    return { confidence: 'none', inferred: true };
  }

  /**
   * Infer from class names
   * @param {HTMLElement} element
   * @returns {Object} Inference result
   */
  inferFromClasses(element) {
    const classes = Array.from(element.classList || []);
    if (classes.length === 0) return { confidence: 'none', inferred: true };

    // Check each class against known prefixes
    for (const className of classes) {
      for (const [prefix, pattern] of Object.entries(this.patterns.classPrefix)) {
        if (className.startsWith(prefix)) {
          return {
            componentName: pattern.component,
            filePath: pattern.file,
            type: pattern.type || 'component',
            confidence: 'medium',
            inferredFrom: `class="${className}"`,
            inferred: true
          };
        }
      }
    }

    // Try to infer from first meaningful class
    const meaningfulClass = classes.find(c => !c.match(/^(is-|has-|active|visible|hidden)/));
    if (meaningfulClass) {
      const componentName = meaningfulClass.split('-').map(p => this.capitalize(p)).join('');
      return {
        componentName: componentName,
        filePath: this.guessFilePathFromComponent(componentName),
        type: 'component',
        confidence: 'low',
        inferredFrom: `class="${meaningfulClass}"`,
        inferred: true
      };
    }

    return { confidence: 'none', inferred: true };
  }

  /**
   * Infer from parent element hierarchy
   * @param {HTMLElement} element
   * @returns {Object} Inference result
   */
  inferFromParent(element) {
    let current = element.parentElement;
    let depth = 0;
    const maxDepth = 5; // Don't traverse too far

    while (current && depth < maxDepth) {
      // Check if parent has source metadata
      const sourceId = current.getAttribute('data-source-id');
      if (sourceId) {
        const sourceTracker = window.APP?.services?.sourceTracker;
        if (sourceTracker) {
          const metadata = sourceTracker.getMetadata(sourceId);
          if (metadata) {
            return {
              componentName: `${metadata.componentName} (child)`,
              filePath: metadata.filePath,
              type: metadata.type || 'component',
              confidence: 'medium',
              inferredFrom: `parent with source-id="${sourceId}"`,
              inferred: true,
              parentMetadata: metadata
            };
          }
        }
      }

      // Try to infer from parent
      const parentInferred = this.inferFromDataAttributes(current);
      if (parentInferred.confidence !== 'none') {
        return {
          ...parentInferred,
          componentName: `${parentInferred.componentName} (child)`,
          confidence: 'low',
          inferredFrom: `parent ${parentInferred.inferredFrom}`
        };
      }

      current = current.parentElement;
      depth++;
    }

    return { confidence: 'none', inferred: true };
  }

  /**
   * Infer from element context (tag name, role, etc.)
   * @param {HTMLElement} element
   * @returns {Object} Inference result
   */
  inferFromContext(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');

    // Special case for buttons
    if (tagName === 'button' || role === 'button') {
      const text = element.textContent?.trim().substring(0, 20);
      return {
        componentName: `Button${text ? ` (${text})` : ''}`,
        filePath: 'client/styles/tags-and-buttons.css',
        type: 'element',
        confidence: 'low',
        inferredFrom: `<${tagName}>`,
        inferred: true
      };
    }

    // Default fallback
    return {
      componentName: tagName,
      filePath: null,
      type: 'element',
      confidence: 'low',
      inferredFrom: `<${tagName}>`,
      inferred: true
    };
  }

  /**
   * Guess file path from component name
   * @param {string} componentName - Component name
   * @returns {string} Guessed file path
   */
  guessFilePathFromComponent(componentName) {
    // Common patterns
    if (componentName.endsWith('Panel')) {
      return `client/panels/${componentName}.js`;
    }
    if (componentName.endsWith('Manager')) {
      return `client/components/${componentName}.js`;
    }
    if (componentName.endsWith('Component')) {
      return `client/components/${componentName}.js`;
    }
    if (componentName.endsWith('Service')) {
      return `client/services/${componentName}.js`;
    }

    // Generic fallback
    return `client/components/${componentName}.js`;
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Add custom pattern for inference
   * @param {string} type - Pattern type (panelType, classPrefix, id)
   * @param {string} key - Pattern key
   * @param {Object} value - Pattern value (file, component, type)
   */
  addPattern(type, key, value) {
    if (!this.patterns[type]) {
      console.warn(`[SourceInferencer] Unknown pattern type: ${type}`);
      return false;
    }

    this.patterns[type][key] = value;
    console.log(`[SourceInferencer] Added pattern: ${type}.${key}`);
    return true;
  }

  /**
   * Get all known patterns
   * @returns {Object} All patterns
   */
  getPatterns() {
    return this.patterns;
  }

  /**
   * Get statistics about inference confidence
   * @param {Array<HTMLElement>} elements - Elements to analyze
   * @returns {Object} Statistics
   */
  analyzeConfidence(elements) {
    const stats = {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
      total: elements.length
    };

    for (const element of elements) {
      const result = this.infer(element);
      const confidence = result.confidence || 'none';
      stats[confidence]++;
    }

    return stats;
  }
}

// =============================================================================
// SELF-REGISTRATION (IIFE-style)
// =============================================================================

// Create singleton instance
const sourceInferencer = new SourceInferencer();

// Self-register into window.APP.services
if (!window.APP) window.APP = {};
if (!window.APP.services) window.APP.services = {};
window.APP.services.sourceInferencer = sourceInferencer;

console.log('[SourceInferencer] Service registered to window.APP.services.sourceInferencer');

// Export singleton instance as default
export default sourceInferencer;
