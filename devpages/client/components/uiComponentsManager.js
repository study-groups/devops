import { appStore } from '/client/appState.js';
import { createContextSettingsPopupComponent } from './ContextSettingsPopupComponent.js';

const registeredComponents = new Map();

const logUIComponents = (message, level = 'debug') => {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, 'UI_COMPONENTS');
    } else {
        console.log(`[UI_COMPONENTS] ${message}`);
    }
};

export async function initializeUIComponents() {
    logUIComponents('Starting UI Components initialization...', 'info');
    
    try {
        // Register popup components
        logUIComponents('Creating ContextSettingsPopupComponent...', 'debug');
        const settingsPopup = createContextSettingsPopupComponent('ctx-settings-popup');
        
        // Mount the popup (creates DOM element and appends to body)
        const popupInterface = settingsPopup.mount(document.body);
        
        // Store both the component and its interface
        registeredComponents.set('contextSettings', {
            component: settingsPopup,
            interface: popupInterface
        });
        
        logUIComponents('ContextSettingsPopupComponent created and mounted successfully.', 'debug');
        
        // Create uiComponents object
        const uiComponents = {
            getComponent: (name) => {
                const comp = registeredComponents.get(name);
                return comp ? comp.component : null;
            },
            showPopup: (name, props = {}) => {
                const comp = registeredComponents.get(name);
                if (comp?.interface?.show) {
                    logUIComponents(`Showing popup: ${name}`, 'debug');
                    comp.interface.show(props);
                    return true;
                } else {
                    logUIComponents(`Failed to show popup: ${name} - component not found or no show method`, 'error');
                    return false;
                }
            },
            hidePopup: (name) => {
                const comp = registeredComponents.get(name);
                if (comp?.interface?.hide) {
                    logUIComponents(`Hiding popup: ${name}`, 'debug');
                    comp.interface.hide();
                    return true;
                } else {
                    logUIComponents(`Failed to hide popup: ${name} - component not found or no hide method`, 'error');
                    return false;
                }
            },
            isPopupVisible: (name) => {
                const comp = registeredComponents.get(name);
                if (comp?.interface?.isVisible) {
                    return comp.interface.isVisible();
                }
                return false;
            }
        };

        // Register with consolidation system
        if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
            window.devpages._internal.consolidator.migrate('uiComponents', uiComponents);
        } else {
            // Fallback for legacy support
            window.uiComponents = uiComponents;
        }
        
        logUIComponents('UI Components system initialized successfully. Available components:', 'info');
        logUIComponents(`- contextSettings: ${registeredComponents.has('contextSettings') ? 'ready' : 'failed'}`, 'info');
        
    } catch (error) {
        logUIComponents(`Error during UI Components initialization: ${error.message}`, 'error');
        console.error('[UI_COMPONENTS] Initialization error:', error);
        
        // Provide fallback implementation
        const fallbackUiComponents = {
            getComponent: () => null,
            showPopup: () => false,
            hidePopup: () => false,
            isPopupVisible: () => false
        };

        // Register fallback with consolidation system
        if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
            window.devpages._internal.consolidator.migrate('uiComponents', fallbackUiComponents);
        } else {
            window.uiComponents = fallbackUiComponents;
        }
        
        throw error; // Re-throw so bootstrap can handle it
    }
}
