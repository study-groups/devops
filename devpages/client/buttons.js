/**
 * buttons.js
 * Handles button registration and event handling
 */
import { eventBus } from '/client/eventBus.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('Buttons');

// Maintain a registry of button handlers
const buttonHandlers = new Map();

/**
 * Safely register a button handler, replacing any existing handler
 * @param {string} buttonId - The ID of the button
 * @param {Function} handler - The event handler function
 * @param {string} description - Description of what the button does
 */
export function registerButtonHandler(buttonId, handler, description = '') {
    if (!buttonId || typeof handler !== 'function') {
        log.error('BUTTONS', 'INVALID_REGISTRATION', `Invalid button registration: ${buttonId}`);
        return false;
    }
    
    // Store handler information
    buttonHandlers.set(buttonId, {
        handler,
        description,
        registered: Date.now()
    });
    
    // Find the button
    const button = document.getElementById(buttonId);
    if (!button) {
        log.warn('BUTTONS', 'BUTTON_NOT_FOUND', `Warning: Button #${buttonId} not found in DOM but handler registered`);
        return false;
    }
    
    // Replace the button to clear existing event listeners
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    // Add the new handler
    newButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Log button click
        log.info('BUTTONS', 'BUTTON_CLICKED', `Button clicked: ${buttonId}`);
        
        // Dispatch button event
        eventBus.emit('button:clicked', {
            buttonId,
            description
        });
        
        // Call the handler
        try {
            handler(event);
        } catch (error) {
            log.error('BUTTONS', 'HANDLER_ERROR', `Error in handler for ${buttonId}:`, error);
        }
    });
    
    log.info('BUTTONS', 'HANDLER_REGISTERED', `Registered handler for ${buttonId}${description ? ': ' + description : ''}`);
    return true;
}

/**
 * Register multiple button handlers at once
 * @param {Object} handlersMap - Map of buttonId -> {handler, description}
 */
export function registerButtons(handlersMap) {
    if (!handlersMap || typeof handlersMap !== 'object') {
        log.error('BUTTONS', 'INVALID_HANDLERS_MAP', 'Invalid handlers map');
        return false;
    }
    
    let successCount = 0;
    
    for (const [buttonId, config] of Object.entries(handlersMap)) {
        if (typeof config === 'function') {
            // Simple form: { buttonId: handlerFunction }
            if (registerButtonHandler(buttonId, config)) {
                successCount++;
            }
        } else if (typeof config === 'object' && config.handler) {
            // Object form: { buttonId: { handler, description } }
            if (registerButtonHandler(buttonId, config.handler, config.description)) {
                successCount++;
            }
        } else {
            log.error('BUTTONS', 'INVALID_HANDLER_CONFIG', `Invalid handler config for ${buttonId}`);
        }
    }
    
    log.info('BUTTONS', 'HANDLERS_REGISTERED', `Registered ${successCount} button handlers`);
    return successCount > 0;
}

/**
 * Remove a button handler
 * @param {string} buttonId - The ID of the button
 */
export function unregisterButton(buttonId) {
    if (!buttonHandlers.has(buttonId)) {
        return false;
    }
    
    // Remove from registry
    buttonHandlers.delete(buttonId);
    
    // Find the button
    const button = document.getElementById(buttonId);
    if (button) {
        // Replace with a clone to remove event listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        log.info('BUTTONS', 'HANDLER_UNREGISTERED', `Unregistered handler for ${buttonId}`);
        return true;
    }
    
    log.warn('BUTTONS', 'BUTTON_NOT_FOUND', `Removed registry entry for ${buttonId} but button not found in DOM`);
    return true;
}

/**
 * Get information about a registered button
 * @param {string} buttonId - The ID of the button
 */
export function getButtonInfo(buttonId) {
    return buttonHandlers.get(buttonId) || null;
}

/**
 * Get all registered buttons
 */
export function getAllButtons() {
    const result = {};
    buttonHandlers.forEach((info, id) => {
        result[id] = {
            description: info.description,
            registered: info.registered
        };
    });
    return result;
}

/**
 * Create a simple delegation handler for a group of buttons
 * @param {string} containerId - The container element ID
 * @param {Object} handlers - Map of button IDs or classes to handlers
 */
export function setupButtonGroup(containerId, handlers) {
    const container = document.getElementById(containerId);
    if (!container) {
        log.error('BUTTONS', 'CONTAINER_NOT_FOUND', `Container #${containerId} not found`);
        return false;
    }
    
    // Clear existing handlers by cloning
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);
    
    // Set up delegation
    newContainer.addEventListener('click', (event) => {
        const target = event.target;
        // Delegate based on button ID found within the container
        const button = target.closest('button');
        if (!button) return;
        
        const buttonId = button.id;
        if (buttonId && handlers[buttonId]) {
            event.preventDefault();
            event.stopPropagation();
            log.info('BUTTONS', 'GROUP_BUTTON_CLICKED', `Group button clicked: ${buttonId}`);
            try {
                handlers[buttonId](event);
            } catch (error) {
                log.error('BUTTONS', 'GROUP_HANDLER_ERROR', `Error in group handler for ${buttonId}:`, error);
            }
        }
    });
    
    log.info('BUTTONS', 'BUTTON_GROUP_SETUP', `Set up button group for ${containerId} with ${Object.keys(handlers).length} handlers`);
    return true;
}

/**
 * Enable or disable a button
 * @param {string} buttonId - The ID of the button
 * @param {boolean} enabled - Whether the button should be enabled
 */
export function setButtonEnabled(buttonId, enabled = true) {
    const button = document.getElementById(buttonId);
    if (!button) {
        log.warn('BUTTONS', 'BUTTON_NOT_FOUND', `Button #${buttonId} not found`);
        return false;
    }
    
    button.disabled = !enabled;
    
    if (enabled) {
        button.classList.remove('disabled');
    } else {
        button.classList.add('disabled');
    }
    
    return true;
}

// Consider if initialization is needed or if this module is just utility functions.
log.info('BUTTONS', 'MODULE_LOADED', 'Button utilities module loaded.');

// Export all functions
export default {
    registerButtonHandler,
    registerButtons,
    unregisterButton,
    getButtonInfo,
    getAllButtons,
    setupButtonGroup,
    setButtonEnabled
}; 