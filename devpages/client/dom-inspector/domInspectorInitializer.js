/**
 * client/dom-inspector/domInspectorInitializer.js
 * Initializes the DOM Inspector Panel component.
 */
import { DomInspectorPanel } from './DomInspectorPanel.js';
import { appStore } from '/client/appState.js';
import { eventBus } from '/client/eventBus.js';
import { showFatalError } from '/client/utils/uiError.js';

let domInspectorInstance = null;
let isActivating = false;

export async function initializeDomInspector() {
  if (domInspectorInstance) {
    console.log('[DOM INSPECTOR] Instance already exists, returning existing instance');
    return domInspectorInstance;
  }

  // CRITICAL: Don't initialize until explicitly activated
  console.log('[DOM INSPECTOR] Initialization blocked - waiting for explicit activation');
  return null;
}

// New function to explicitly activate DOM inspector
export async function activateDomInspector() {
  console.log('[DOM INSPECTOR] Explicit activation requested');
  
  if (domInspectorInstance) {
    console.log('[DOM INSPECTOR] Instance already exists, returning existing instance');
    return domInspectorInstance;
  }

  if (isActivating) {
      console.warn('[DOM INSPECTOR] Activation already in progress.');
      return;
  }
  isActivating = true;

  try {
    console.log('[DOM INSPECTOR] Initializing after explicit activation...');
    
    // DOM is already ready by the time this is called
    console.log('[DOM INSPECTOR] DOM is ready, creating DomInspectorPanel instance...');
    
    // Check if required dependencies are available
    if (!appStore) {
      console.error('[DOM INSPECTOR] appStore not available');
      return null;
    }
    
    console.log('[DOM INSPECTOR] Dependencies check passed, creating instance...');
    domInspectorInstance = new DomInspectorPanel();
    console.log('[DOM INSPECTOR] Instance created successfully.');

    window.devPages = window.devPages || {};
    window.devPages.domInspector = domInspectorInstance;
    console.log('[DOM INSPECTOR] Attached to window.devPages.');

    console.log('[DOM INSPECTOR] Activation complete.');
    return domInspectorInstance;
  } catch (error) {
    console.error('[DOM INSPECTOR ACTIVATION ERROR]', error);
    console.error('[DOM INSPECTOR ACTIVATION ERROR] Stack trace:', error.stack);
    
    // Log additional debugging information
    console.log('[DOM INSPECTOR DEBUG] Document ready state:', document.readyState);
    console.log('[DOM INSPECTOR DEBUG] appStore available:', !!appStore);
    console.log('[DOM INSPECTOR DEBUG] Window devPages available:', !!window.devPages);
    showFatalError(error, 'DOM Inspector Activation');
  } finally {
    isActivating = false;
  }
}

// Add a test function for debugging
export function testDomInspector() {
  console.log('[DOM INSPECTOR TEST] Testing DOM Inspector...');
  console.log('[DOM INSPECTOR TEST] Instance exists:', !!domInspectorInstance);
  console.log('[DOM INSPECTOR TEST] Window devPages exists:', !!window.devPages);
  console.log('[DOM INSPECTOR TEST] Window devPages.domInspector exists:', !!(window.devPages && window.devPages.domInspector));
  
  if (window.devPages && window.devPages.domInspector) {
    try {
      console.log('[DOM INSPECTOR TEST] Calling toggle()...');
      window.devPages.domInspector.toggle();
      console.log('[DOM INSPECTOR TEST] toggle() called successfully');
      return true;
    } catch (error) {
      console.error('[DOM INSPECTOR TEST] Error calling toggle():', error);
      return false;
    }
  } else {
    console.warn('[DOM INSPECTOR TEST] DOM Inspector not available!');
    return false;
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