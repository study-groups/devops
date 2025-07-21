import { createPathManagerComponent } from './PathManagerComponent.js';
import { initializeAuthDisplay } from './AuthDisplay.js';
import { createContextSettingsPopupComponent } from './ContextSettingsPopupComponent.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('uiComponentsManager');

export function initializeUIComponents() {
    log.info('UI_COMPONENTS', 'INIT_START', 'Initializing UI components...');

    try {
        // This manager is now only responsible for non-primary components
        // like popups and modals, which are not managed directly by the bootloader.

        // Create a settings popup for the path manager
        log.debug('UI_COMPONENTS', 'CREATE_CONTEXT_SETTINGS_POPUP', 'Creating ContextSettingsPopupComponent...');
        const settingsPopup = createContextSettingsPopupComponent('path-settings-popup');
        
        if (settingsPopup) {
            settingsPopup.mount();
        }

        // The AuthDisplay and PathManager are now handled by the main bootloader.
        // We no longer initialize them here.

        log.info('UI_COMPONENTS', 'INIT_SUCCESS', 'Secondary UI components initialized successfully.');

    } catch (error) {
        log.error('UI_COMPONENTS', 'INIT_ERROR', 'Error during secondary UI component initialization', error);
        // Re-throw the error to be caught by the main bootloader's error handler
        throw error;
    }
}
