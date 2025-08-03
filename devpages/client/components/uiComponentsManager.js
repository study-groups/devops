import { createPathManagerComponent } from './PathManagerComponent.js';
import { initializeAuthDisplay } from './AuthDisplay.js';
import { createContextSettingsPopupComponent } from './ContextSettingsPopupComponent.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('uiComponentsManager');

export function initializeUIComponents() {
    log.info('UI_COMPONENTS', 'INIT_START', 'Initializing UI components...');

    try {
        const settingsPopup = createContextSettingsPopupComponent('path-settings-popup');
        
        if (settingsPopup) {
            settingsPopup.mount();
        }

        log.info('UI_COMPONENTS', 'INIT_SUCCESS', 'Secondary UI components initialized successfully.');

        // Return the public API for this service
        return {
            showPopup: (popupId, props) => {
                if (popupId === 'contextSettings' && settingsPopup) {
                    settingsPopup.show(props);
                    return true;
                }
                return false;
            }
        };

    } catch (error) {
        log.error('UI_COMPONENTS', 'INIT_ERROR', 'Error during secondary UI component initialization', error);
        throw error;
    }
}
