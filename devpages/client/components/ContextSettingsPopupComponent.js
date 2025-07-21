import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
// Using the reducer system instead of SettingsStateManager

const log = window.APP.services.log.createLogger('ContextSettingsPopup');

export function createContextSettingsPopupComponent(popupId = 'context-settings-popup') {
    let popupElement = null;
    let isVisible = false;
    let isDragging = false;
    let isResizing = false;
    let dragOffset = { x: 0, y: 0 };

    // Load initial state from the store
    let currentState = {
        visible: false,
        collapsed: false,
        position: { x: 50, y: 50 },
        size: { width: 400, height: 300 }
    };

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
        log.info('HEARTBEAT', 'START', `Heartbeat started. Interval: ${heartbeatIntervalMs}ms, Refresh: ${heartbeatRefreshFileList}, CheckServer: ${heartbeatCheckServer}`);
        heartbeatTimer = setInterval(() => {
            if (heartbeatRefreshFileList) {
                log.info('HEARTBEAT', 'REFRESH_FILE_LIST', 'Heartbeat: Refreshing file list');
                dispatch({ type: ActionTypes.FILE_LIST_REFRESH });
            }
            if (heartbeatCheckServer) {
                log.info('HEARTBEAT', 'CHECK_SERVER', 'Heartbeat: Checking for server messages (stub)');
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
            log.info('HEARTBEAT', 'STOP', 'Heartbeat stopped.');
        }
        heartbeatRunning = false;
        render();
    }

    function checkServerMessagesStub() {
        // Stub for future server message check
        log.debug('HEARTBEAT', 'STUB', 'Stub: Would check server messages here.');
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
            log.warn('RENDER', 'POPUP_ELEMENT_NULL', 'Render skipped: popupElement is null');
            return;
        }
        
        log.debug('RENDER', 'START', 'Render START for popup');

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

        log.debug('RENDER', 'END', 'Render END for popup');
    };

    const attachEventListeners = () => {
        // Close button functionality
        const closeBtn = popupElement.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', hide);
        }
        
        // Organization select functionality
        const orgSelect = popupElement.querySelector('#org-select');
        if (orgSelect) {
            orgSelect.addEventListener('change', handleOrgChange);
        }
        
        // Heartbeat form functionality
        const heartbeatInterval = popupElement.querySelector('#heartbeat-interval');
        if (heartbeatInterval) {
            heartbeatInterval.addEventListener('change', handleHeartbeatIntervalChange);
        }
        
        const heartbeatRefresh = popupElement.querySelector('#heartbeat-refresh');
        if (heartbeatRefresh) {
            heartbeatRefresh.addEventListener('change', handleHeartbeatRefreshChange);
        }
        
        const heartbeatCheckServer = popupElement.querySelector('#heartbeat-check-server');
        if (heartbeatCheckServer) {
            heartbeatCheckServer.addEventListener('change', handleHeartbeatCheckServerChange);
        }
        
        const heartbeatToggleBtn = popupElement.querySelector('#heartbeat-toggle-btn');
        if (heartbeatToggleBtn) {
            heartbeatToggleBtn.addEventListener('click', handleHeartbeatStartStop);
        }
        
        // Drag functionality
        const header = popupElement.querySelector('.context-settings-popup-header');
        if (header) {
            header.addEventListener('mousedown', startDrag);
        }
        
        // Collapse functionality
        const collapseBtn = popupElement.querySelector('.collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', toggleCollapsed);
        }
        
        // Resize functionality
        const resizeHandle = popupElement.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', startResize);
        }
        
        // Global mouse events
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // ESC key to close
        const handleEscKey = (event) => {
            if (event.key === 'Escape' && isVisible) {
                hide();
            }
        };
        document.addEventListener('keydown', handleEscKey);
        
        // Click outside to close
        const handleClickOutside = (event) => {
            if (isVisible && popupElement && !popupElement.querySelector('.context-settings-popup-content').contains(event.target)) {
                hide();
            }
        };
        popupElement.addEventListener('click', handleClickOutside);
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
            // State is managed by the reducer system
        }
        isDragging = false;
        isResizing = false;
    };

    const toggleCollapsed = () => {
        currentState.collapsed = !currentState.collapsed;
        applyPositionAndSize();
    };

    const handleOrgChange = (event) => {
        const newSelectedOrg = event.target.value;
        log.info('ORG', 'CHANGE', `Org selection changed to: ${newSelectedOrg}`);
        
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
            log.error('POPUP', 'SHOW_ERROR', 'Cannot show popup: popupElement is null');
            return;
        }
        
        // Load latest state
        // State is already loaded
        
        // Update props from app state
        const currentStateFromApp = appStore.getState();
        currentSelectedOrg = currentStateFromApp.settings?.selectedOrg || 'pixeljam-arcade';
        currentDisplayPathname = props.displayPathname || currentStateFromApp.file?.currentPathname || '';

        log.info('POPUP', 'SHOW', `Show popup with org: ${currentSelectedOrg}`);
        
        render();
        popupElement.style.display = 'block';
        isVisible = true;
        
        // Update visibility in state
        currentState.visible = true;
    };

    const hide = () => {
        if (!popupElement) return;
        log.info('POPUP', 'HIDE', 'Hiding popup');
        popupElement.style.display = 'none';
        isVisible = false;
        
        // Update visibility in state
        currentState.visible = false;
    };

    const mount = (targetBody = document.body) => {
        log.info('POPUP', 'MOUNT_START', `Mount_Popup: Initializing. popupId: ${popupId}. Target DOM body: ${targetBody ? 'Exists' : 'NULL'}`);

        if (document.getElementById(popupId)) {
            popupElement = document.getElementById(popupId);
            log.info('POPUP', 'MOUNT_REUSE', `Mount_Popup: Element with ID ${popupId} ALREADY EXISTS in DOM. Re-using.`);
        } else {
            log.info('POPUP', 'MOUNT_CREATE', `Mount_Popup: Element with ID ${popupId} NOT found. Creating new div.`);
            popupElement = document.createElement('div');
            popupElement.id = popupId;
            popupElement.className = 'context-settings-popup-overlay'; 
            popupElement.style.display = 'none'; 
            
            if (targetBody && typeof targetBody.appendChild === 'function') {
                targetBody.appendChild(popupElement);
                log.info('POPUP', 'MOUNT_APPEND', `Mount_Popup: New div for ${popupId} APPENDED to targetBody.`);
            } else {
                log.error('POPUP', 'MOUNT_FAILURE', `Mount_Popup CRITICAL FAILURE: targetBody is invalid or has no appendChild method. Cannot append ${popupId}.`);
                popupElement = null; // Don't use an unappended element
                return { show: ()=>{}, hide: ()=>{}, isVisible: ()=>false }; // Return dummy object
            }
        }
        // Ensure render is called if popupElement is valid
        if (popupElement) {
            log.info('POPUP', 'MOUNT_RENDER', `Mount_Popup: Calling initial render for ${popupId}.`);
            render();
        } else {
            log.warn('POPUP', 'MOUNT_RENDER_SKIP', `Mount_Popup: popupElement is null for ${popupId} after creation/check, skipping initial render.`);
        }
        return { show, hide, isVisible: () => isVisible };
    };

    const destroy = () => {
        if (popupElement && popupElement.parentNode) {
            popupElement.parentNode.removeChild(popupElement);
            log.info('POPUP', 'DESTROY', `Popup element #${popupId} removed.`);
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
