import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { settingsStateManager } from '../settings/SettingsStateManager.js';

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
    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };

    // Load initial state
    let currentState = settingsStateManager.loadState();

    // Simple props
    let currentSelectedOrg = 'pixeljam-arcade';
    let currentDisplayPathname = '';

    // Heartbeat state
    let heartbeatIntervalMs = 5000;
    let heartbeatTimer = null;
    let heartbeatRunning = false;
    let heartbeatRefreshFileList = false;
    let heartbeatCheckServer = false;

    const applyPositionAndSize = () => {
        if (!popupElement) return;
        
        const { position, size, collapsed } = currentState;
        
        popupElement.style.left = `${position.x}px`;
        popupElement.style.top = `${position.y}px`;
        popupElement.style.width = `${size.width}px`;
        
        if (collapsed) {
            popupElement.style.height = '40px'; // Just header height
            popupElement.classList.add('collapsed');
        } else {
            popupElement.style.height = `${size.height}px`;
            popupElement.classList.remove('collapsed');
        }
    };

    // --- Heartbeat logic ---
    function startHeartbeat() {
        stopHeartbeat(); // Ensure no double interval
        heartbeatRunning = true;
        logContextSettings(`Heartbeat started. Interval: ${heartbeatIntervalMs}ms, Refresh: ${heartbeatRefreshFileList}, CheckServer: ${heartbeatCheckServer}`, 'EVENT');
        heartbeatTimer = setInterval(() => {
            if (heartbeatRefreshFileList) {
                logContextSettings('Heartbeat: Refreshing file list', 'EVENT');
                dispatch({ type: ActionTypes.FILE_LIST_REFRESH });
            }
            if (heartbeatCheckServer) {
                logContextSettings('Heartbeat: Checking for server messages (stub)', 'EVENT');
                // Stub: Replace with real server check later
                checkServerMessagesStub();
            }
        }, heartbeatIntervalMs);
        render();
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        if (heartbeatRunning) {
            logContextSettings('Heartbeat stopped.', 'EVENT');
        }
        heartbeatRunning = false;
        render();
    }

    function checkServerMessagesStub() {
        // Stub for future server message check
        logContextSettings('Stub: Would check server messages here.', 'DEBUG');
    }

    // --- Heartbeat form handlers ---
    function handleHeartbeatIntervalChange(event) {
        const value = parseInt(event.target.value, 10);
        if (!isNaN(value) && value > 0) {
            heartbeatIntervalMs = value;
        }
    }
    function handleHeartbeatRefreshChange(event) {
        heartbeatRefreshFileList = event.target.checked;
    }
    function handleHeartbeatCheckServerChange(event) {
        heartbeatCheckServer = event.target.checked;
    }
    function handleHeartbeatStartStop(event) {
        if (heartbeatRunning) {
            stopHeartbeat();
        } else {
            startHeartbeat();
        }
    }

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

        // Heartbeat section HTML
        const heartbeatSectionHTML = `
            <section class="settings-section heartbeat-section">
                <h3>Heartbeat</h3>
                <form id="heartbeat-form" onsubmit="return false;">
                    <label>
                        Interval (ms):
                        <input type="number" id="heartbeat-interval" min="100" step="100" value="${heartbeatIntervalMs}" ${heartbeatRunning ? 'disabled' : ''} />
                    </label>
                    <label>
                        <input type="checkbox" id="heartbeat-refresh" ${heartbeatRefreshFileList ? 'checked' : ''} ${heartbeatRunning ? 'disabled' : ''} />
                        Refresh file list
                    </label>
                    <label>
                        <input type="checkbox" id="heartbeat-check-server" ${heartbeatCheckServer ? 'checked' : ''} ${heartbeatRunning ? 'disabled' : ''} />
                        Check for pjaSdk.server messages
                    </label>
                    <button type="button" id="heartbeat-toggle-btn">
                        ${heartbeatRunning ? 'Stop Heartbeat' : 'Start Heartbeat'}
                    </button>
                    <span class="settings-hint">${heartbeatRunning ? 'Heartbeat is running.' : 'Heartbeat is stopped.'}</span>
                </form>
            </section>
        `;

        popupElement.innerHTML = `
            <div class="context-settings-popup-content">
                <div class="context-settings-popup-header" draggable="true">
                    <h2>Context Manager Settings</h2>
                    <div class="header-controls">
                        <button class="collapse-btn" title="${currentState.collapsed ? 'Expand' : 'Collapse'}">${currentState.collapsed ? '□' : '─'}</button>
                        <button class="close-btn" title="Close Settings">&times;</button>
                    </div>
                </div>
                <div class="context-settings-popup-body" ${currentState.collapsed ? 'style="display: none;"' : ''}>
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

                    ${heartbeatSectionHTML}
                </div>
                <div class="resize-handle"></div>
            </div>
        `;

        // Apply position and size
        applyPositionAndSize();

        // Attach event listeners
        attachEventListeners();

        logContextSettings('Render END for popup', 'VISIBILITY_DETAIL');
    };

    const attachEventListeners = () => {
        // ... existing event listeners ...
        
        // Drag functionality
        const header = popupElement.querySelector('.context-settings-popup-header');
        header.addEventListener('mousedown', startDrag);
        
        // Collapse functionality
        const collapseBtn = popupElement.querySelector('.collapse-btn');
        collapseBtn.addEventListener('click', toggleCollapsed);
        
        // Resize functionality
        const resizeHandle = popupElement.querySelector('.resize-handle');
        resizeHandle.addEventListener('mousedown', startResize);
        
        // Global mouse events
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const startDrag = (event) => {
        isDragging = true;
        const rect = popupElement.getBoundingClientRect();
        dragOffset.x = event.clientX - rect.left;
        dragOffset.y = event.clientY - rect.top;
        event.preventDefault();
    };

    const startResize = (event) => {
        if (currentState.collapsed) return;
        isResizing = true;
        event.preventDefault();
    };

    const handleMouseMove = (event) => {
        if (isDragging) {
            const newX = event.clientX - dragOffset.x;
            const newY = event.clientY - dragOffset.y;
            
            // Constrain to viewport
            const maxX = window.innerWidth - popupElement.offsetWidth;
            const maxY = window.innerHeight - popupElement.offsetHeight;
            
            currentState.position.x = Math.max(0, Math.min(newX, maxX));
            currentState.position.y = Math.max(0, Math.min(newY, maxY));
            
            applyPositionAndSize();
        } else if (isResizing) {
            const rect = popupElement.getBoundingClientRect();
            const newWidth = event.clientX - rect.left;
            const newHeight = event.clientY - rect.top;
            
            currentState.size.width = Math.max(300, Math.min(newWidth, window.innerWidth - currentState.position.x));
            currentState.size.height = Math.max(200, Math.min(newHeight, window.innerHeight - currentState.position.y));
            
            applyPositionAndSize();
        }
    };

    const handleMouseUp = () => {
        if (isDragging || isResizing) {
            // Save state when drag/resize ends
            settingsStateManager.saveState(currentState);
        }
        isDragging = false;
        isResizing = false;
    };

    const toggleCollapsed = () => {
        currentState = settingsStateManager.toggleCollapsed();
        applyPositionAndSize();
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
        
        // Load latest state
        currentState = settingsStateManager.loadState();
        
        // Update props from app state
        const currentStateFromApp = appStore.getState();
        currentSelectedOrg = currentStateFromApp.settings?.selectedOrg || 'pixeljam-arcade';
        currentDisplayPathname = props.displayPathname || currentStateFromApp.file?.currentPathname || '';

        logContextSettings(`Show popup with org: ${currentSelectedOrg}`, 'VISIBILITY');
        
        render();
        popupElement.style.display = 'block';
        isVisible = true;
        
        // Update visibility in state
        settingsStateManager.updateState({ visible: true });
    };

    const hide = () => {
        if (!popupElement) return;
        logContextSettings('Hiding popup', 'VISIBILITY');
        popupElement.style.display = 'none';
        isVisible = false;
        
        // Update visibility in state
        settingsStateManager.updateState({ visible: false });
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
