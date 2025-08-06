
// Add this to bootloader.js in the appropriate initialization section

// Import the panel registration fix
import { registerMissingPanels } from '/client/panels/panelRegistrationFix.js';

// Add this call after Redux store is initialized but before WorkspaceManager
console.log('[Bootloader] Registering missing panels...');
registerMissingPanels();
