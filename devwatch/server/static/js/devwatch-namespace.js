(function() {
    'use strict';

    // Idempotent check: if the namespace has already been set up, don't do it again.
    if (window.APP && window.APP.bootloaderRan) {
        return;
    }

    console.log('🚀 PJA Namespace: Creating APP namespace...');

    window.APP = {
      // Core Systems
      events: null,
      log: null,
      
      // Iframe and SDK related namespaces
      sdk: { instance: null, assets: null },
      PJA_Iframe: null,

      // Host/Dashboard specific namespaces
      theme: { Manager: null, managerInstance: null, current: 'matrix', themes: {} },
      iframes: { Manager: null, DevWatchIframer: null, managerInstance: null, instances: {} },
      dashboard: { dashboardClient: null },
      
      // Utilities
      utils: { logger: null, PJA: null },
      
      // State and Environment
      env: null,
      initialized: false,
      config: { logLevel: 'INFO' },

      // A flag to indicate that a bootloader has run.
      bootloaderRan: true
    };
    
    console.log('✅ PJA Namespace: Ready.');
})();
