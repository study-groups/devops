import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

const logContextSettings = (message, level = 'debug', subtype = 'RENDER') => {
    const type = "CTX_SETTINGS";
    const fullType = `${type}${subtype ? `_${subtype}` : ''}`;
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, fullType);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : (level === 'info' ? console.info : console.log));
        logFunc(`[${fullType}] ${message}`);
    }
};

export function createContextSettingsPopupComponent(popupId = 'context-settings-popup') {
    let popupElement = null;
    let isVisible = false;

    // Simple props
    let currentSelectedOrg = 'pixeljam-arcade';
    let currentDisplayPathname = '';

    const render = () => {
        if (!popupElement) {
            logContextSettings('Render skipped: popupElement is null', 'warn');
            return;
        }
        
        logContextSettings('Render START for popup', 'VISIBILITY_DETAIL');

        // Simple org selector options
        const orgOptionsHTML = `
            <option value="pixeljam-arcade" ${currentSelectedOrg === 'pixeljam-arcade' ? 'selected' : ''}>pixeljam-arcade</option>
            <option value="nodeholder" ${currentSelectedOrg === 'nodeholder' ? 'selected' : ''}>nodeholder</option>
        `;

        popupElement.innerHTML = `
            <div class="context-settings-popup-content">
                <div class="context-settings-popup-header">
                    <h2>Context Manager Settings</h2>
                    <button class="close-btn" title="Close Settings">&times;</button>
                </div>
                <div class="context-settings-popup-body">
                    <section class="settings-section org-selection">
                        <label for="org-select">Organization:</label>
                        <select id="org-select" class="settings-select">
                            ${orgOptionsHTML}
                        </select>
                        <p class="settings-hint">Select your organization (placeholder only).</p>
                    </section>

                    <section class="settings-section context-info">
                        <h3>Current Context</h3>
                        <ul>
                            <li><strong>Selected Org:</strong> <code>${currentSelectedOrg}</code></li>
                            <li><strong>Current Path:</strong> <code>${currentDisplayPathname || '(Root)'}</code></li>
                        </ul>
                        <p class="settings-hint">This is a UI placeholder. No server functionality yet.</p>
                    </section>
                </div>
                <div class="context-settings-popup-footer">
                    <button class="close-btn-footer">Close</button>
                </div>
            </div>
        `;

        // Attach event listeners
        popupElement.querySelector('.close-btn').addEventListener('click', hide);
        popupElement.querySelector('.close-btn-footer').addEventListener('click', hide);
        popupElement.querySelector('#org-select').addEventListener('change', handleOrgChange);

        // Stop propagation for clicks inside popup content
        const contentElement = popupElement.querySelector('.context-settings-popup-content');
        if (contentElement) {
            contentElement.addEventListener('click', (event) => event.stopPropagation());
        }
         
        // Handle background click to close
        popupElement.addEventListener('click', (event) => {
            if (event.target === popupElement) {
                logContextSettings('Background overlay clicked, hiding popup.', 'EVENT');
                hide();
            }
        });

        logContextSettings('Render END for popup', 'VISIBILITY_DETAIL');
    };

    const handleOrgChange = (event) => {
        const newSelectedOrg = event.target.value;
        logContextSettings(`Org selection changed to: ${newSelectedOrg}`, 'EVENT');
        
        if (newSelectedOrg && newSelectedOrg !== currentSelectedOrg) {
            // Use the proper dispatch function from messageQueue
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_SELECTED_ORG, 
                payload: newSelectedOrg 
            });
            
            // Update local state for immediate UI feedback
            currentSelectedOrg = newSelectedOrg;
            render();
        }
    };

    const show = (props = {}) => {
        if (!popupElement) {
            logContextSettings('Cannot show popup: popupElement is null', 'error');
            return;
        }
        
        // Update props from app state
        const currentState = appStore.getState();
        currentSelectedOrg = currentState.settings?.selectedOrg || 'pixeljam-arcade';
        currentDisplayPathname = props.displayPathname || currentState.file?.currentPathname || '';

        logContextSettings(`Show popup with org: ${currentSelectedOrg}`, 'VISIBILITY');
        
        render();
        popupElement.style.display = 'flex';
        isVisible = true;
        logContextSettings('Popup is now visible', 'VISIBILITY');
    };

    const hide = () => {
        if (!popupElement) return;
        logContextSettings('Hiding popup', 'VISIBILITY');
        popupElement.style.display = 'none';
        isVisible = false;
    };

    const mount = (targetBody = document.body) => {
        console.log(`[CTX POPUP MOUNT] >>>>> Popup mount CALLED. popupId: ${popupId} <<<<<`);
        logContextSettings(`Mount_Popup: Initializing. popupId: ${popupId}. Target DOM body: ${targetBody ? 'Exists' : 'NULL'}`, 'MOUNT');

        if (document.getElementById(popupId)) {
            popupElement = document.getElementById(popupId);
            logContextSettings(`Mount_Popup: Element with ID ${popupId} ALREADY EXISTS in DOM. Re-using.`, 'MOUNT_DETAIL');
            console.log(`[CTX POPUP MOUNT] Re-using existing element:`, popupElement);
        } else {
            logContextSettings(`Mount_Popup: Element with ID ${popupId} NOT found. Creating new div.`, 'MOUNT_DETAIL');
            popupElement = document.createElement('div');
            popupElement.id = popupId;
            popupElement.className = 'context-settings-popup-overlay'; 
            popupElement.style.display = 'none'; 
            
            if (targetBody && typeof targetBody.appendChild === 'function') {
                targetBody.appendChild(popupElement);
                logContextSettings(`Mount_Popup: New div for ${popupId} APPENDED to targetBody.`, 'MOUNT_DETAIL');
                console.log(`[CTX POPUP MOUNT] New div appended:`, popupElement);
                console.log(`[CTX POPUP MOUNT] Parent of new div:`, popupElement.parentElement);
            } else {
                logContextSettings(`Mount_Popup CRITICAL FAILURE: targetBody is invalid or has no appendChild method. Cannot append ${popupId}.`, 'ERROR_LIFECYCLE');
                console.error(`[CTX POPUP MOUNT] CRITICAL: targetBody invalid for appendChild. targetBody:`, targetBody);
                popupElement = null; // Don't use an unappended element
                return { show: ()=>{}, hide: ()=>{}, isVisible: ()=>false }; // Return dummy object
            }
        }
        // Ensure render is called if popupElement is valid
        if (popupElement) {
            logContextSettings(`Mount_Popup: Calling initial render for ${popupId}.`, 'MOUNT_DETAIL');
            render();
        } else {
            logContextSettings(`Mount_Popup: popupElement is null for ${popupId} after creation/check, skipping initial render.`, 'WARN_LIFECYCLE');
        }
        return { show, hide, isVisible: () => isVisible };
    };

    const destroy = () => {
        if (popupElement && popupElement.parentNode) {
            popupElement.parentNode.removeChild(popupElement);
            logContextSettings(`Popup element #${popupId} removed.`, 'DESTROY');
        }
        popupElement = null;
        isVisible = false;
    };

    return { show, hide, isVisible: () => isVisible, mount, destroy };
}

// Basic CSS would be needed for .context-settings-popup-overlay, .context-settings-popup-content, etc.
// For example:
// .context-settings-popup-overlay {
//   position: fixed; top: 0; left: 0; width: 100%; height: 100%;
//   background-color: rgba(0,0,0,0.5); display: flex;
//   align-items: center; justify-content: center; z-index: 1000;
// }
// .context-settings-popup-content {
//   background-color: white; padding: 20px; border-radius: 8px;
//   min-width: 500px; max-width: 80%; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
// }
// .context-settings-popup-header { display: flex; justify-content: space-between; align-items: center; }
// .settings-section { margin-bottom: 15px; }
// .settings-hint { font-size: 0.9em; color: #666; }
