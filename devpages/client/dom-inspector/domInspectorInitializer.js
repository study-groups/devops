/**
 * client/dom-inspector/domInspectorInitializer.js
 * Initializes the DOM Inspector Panel component.
 */
import { DomInspectorPanel } from './DomInspectorPanel.js';

let domInspectorInstance = null;

export function initializeDomInspector() {
  if (domInspectorInstance) {
    return domInspectorInstance;
  }

  try {
    console.log('[DOM INSPECTOR] Initializing...');
    domInspectorInstance = new DomInspectorPanel();
    console.log('[DOM INSPECTOR] Instance created.');

    window.devPages = window.devPages || {};
    window.devPages.domInspector = domInspectorInstance;
    console.log('[DOM INSPECTOR] Attached to window.devPages.');

    console.log('[DOM INSPECTOR] Initialization complete.');
    return domInspectorInstance;
  } catch (error) {
    console.error('[DOM INSPECTOR INIT ERROR]', error);
    return null;
  }
}

export function destroyDomInspector() {
  if (domInspectorInstance) {
    domInspectorInstance.destroy();
    domInspectorInstance = null;
    if (window.devPages) {
        window.devPages.domInspector = undefined;
    }
    console.log('[DOM INSPECTOR] Instance destroyed.');
  }
} 