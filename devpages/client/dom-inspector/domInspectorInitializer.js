/**
 * client/dom-inspector/domInspectorInitializer.js
 * Initializes the DOM Inspector Panel component.
 */
import { DomInspectorPanel } from './DomInspectorPanel.js';

let domInspectorInstance = null;

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

  try {
    console.log('[DOM INSPECTOR] Initializing after explicit activation...');
    
    // DOM is already ready by the time this is called
    console.log('[DOM INSPECTOR] DOM is ready, creating DomInspectorPanel instance...');
    
    // Check if required dependencies are available
    if (typeof window !== 'undefined' && !window.appStore) {
      console.error('[DOM INSPECTOR] appStore not available on window');
      return null;
    }
    
    if (typeof window !== 'undefined' && !window.zIndexManager) {
      console.error('[DOM INSPECTOR] zIndexManager not available on window');
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
    console.log('[DOM INSPECTOR DEBUG] Window appStore available:', !!window.appStore);
    console.log('[DOM INSPECTOR DEBUG] Window zIndexManager available:', !!window.zIndexManager);
    console.log('[DOM INSPECTOR DEBUG] Window devPages available:', !!window.devPages);
    
    return null;
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