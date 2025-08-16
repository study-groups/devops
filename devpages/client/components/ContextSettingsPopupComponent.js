import { appStore } from '/client/appState.js';
import { pathThunks } from '/client/store/slices/pathSlice.js';
import { settingsThunks } from '/client/store/slices/settingsSlice.js';
import * as contextSettingsActions from '/client/store/slices/contextSettingsSlice.js';
import { shallowEqual, connect } from '/client/store/connect.js';

const log = window.APP.services.log.createLogger('ContextSettingsPopup');

function ContextSettingsPopupComponent(popupId = 'context-settings-popup') {
    let element = null;
    let props = {};
    let heartbeatTimer = null;

    const applyPositionAndSize = () => {
        if (!element || !props.contextSettings) return;

        const { position, size, collapsed } = props.contextSettings;

        element.style.left = `${position.x}px`;
        element.style.top = `${position.y}px`;
        element.style.width = `${size.width}px`;

        if (collapsed) {
            element.style.height = '40px';
            element.classList.add('collapsed');
        } else {
            element.style.height = `${size.height}px`;
            element.classList.remove('collapsed');
        }
    };

    const startHeartbeat = () => {
        stopHeartbeat();
        const { heartbeatIntervalMs, heartbeatRefreshFileList, heartbeatCheckServer } = props.contextSettings;
        log.info('HEARTBEAT', 'START', `Heartbeat started. Interval: ${heartbeatIntervalMs}ms, Refresh: ${heartbeatRefreshFileList}, CheckServer: ${heartbeatCheckServer}`);
        
        heartbeatTimer = setInterval(() => {
            if (props.contextSettings.heartbeatRefreshFileList) {
                const { currentPathname, isDirectorySelected } = appStore.getState().path;
                props.fetchListingByPath({ pathname: currentPathname, isDirectory: isDirectorySelected });
            }
            if (props.contextSettings.heartbeatCheckServer) {
                log.debug('HEARTBEAT', 'STUB', 'Stub: Would check server messages here.');
            }
        }, heartbeatIntervalMs);
        render();
    };

    const stopHeartbeat = () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
            log.info('HEARTBEAT', 'STOP', 'Heartbeat stopped.');
        }
        render();
    };
    
    const handleHeartbeatStartStop = () => {
        if (props.contextSettings.heartbeatRunning) {
            props.stopHeartbeat();
        } else {
            props.startHeartbeat();
        }
    };

    const render = () => {
        if (!element || !props.contextSettings) return;

        const { contextSettings, settings, file, path } = props;
        const currentSelectedOrg = settings.selectedOrg || 'pixeljam-arcade';
        const currentDisplayPathname = file.currentPathname || path.currentPathname || '';
        
        const orgOptionsHTML = `
            <option value="pixeljam-arcade" ${currentSelectedOrg === 'pixeljam-arcade' ? 'selected' : ''}>pixeljam-arcade</option>
            <option value="nodeholder" ${currentSelectedOrg === 'nodeholder' ? 'selected' : ''}>nodeholder</option>
        `;

        const heartbeatSectionHTML = `
            <section class="settings-section heartbeat-section">
                <h3>Heartbeat</h3>
                <form id="heartbeat-form" onsubmit="return false;">
                    <label>
                        Interval (ms):
                        <input type="number" id="heartbeat-interval" min="100" step="100" value="${contextSettings.heartbeatIntervalMs}" ${contextSettings.heartbeatRunning ? 'disabled' : ''} />
                    </label>
                    <label>
                        <input type="checkbox" id="heartbeat-refresh" ${contextSettings.heartbeatRefreshFileList ? 'checked' : ''} ${contextSettings.heartbeatRunning ? 'disabled' : ''} />
                        Refresh file list
                    </label>
                    <label>
                        <input type="checkbox" id="heartbeat-check-server" ${contextSettings.heartbeatCheckServer ? 'checked' : ''} ${contextSettings.heartbeatRunning ? 'disabled' : ''} />
                        Check for pjaSdk.server messages
                    </label>
                    <button type="button" id="heartbeat-toggle-btn">
                        ${contextSettings.heartbeatRunning ? 'Stop Heartbeat' : 'Start Heartbeat'}
                    </button>
                    <span class="settings-hint">${contextSettings.heartbeatRunning ? 'Heartbeat is running.' : 'Heartbeat is stopped.'}</span>
                </form>
            </section>
        `;

        element.innerHTML = `
            <div class="context-settings-popup-content">
                <div class="context-settings-popup-header" draggable="true">
                    <h2>Context Manager Settings</h2>
                    <div class="header-controls">
                        <button class="collapse-btn" title="${contextSettings.collapsed ? 'Expand' : 'Collapse'}">${contextSettings.collapsed ? '□' : '─'}</button>
                        <button class="close-btn" title="Close Settings">&times;</button>
                    </div>
                </div>
                <div class="context-settings-popup-body" ${contextSettings.collapsed ? 'style="display: none;"' : ''}>
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
                    </section>
                    ${heartbeatSectionHTML}
                </div>
                <div class="resize-handle"></div>
            </div>
        `;
        applyPositionAndSize();
        attachEventListeners();
    };

    const attachEventListeners = () => {
        element.querySelector('.close-btn')?.addEventListener('click', props.hide);
        element.querySelector('#org-select')?.addEventListener('change', (e) => props.setSelectedOrg(e.target.value));
        element.querySelector('#heartbeat-interval')?.addEventListener('change', (e) => props.updateHeartbeatInterval(parseInt(e.target.value, 10)));
        element.querySelector('#heartbeat-refresh')?.addEventListener('change', props.toggleHeartbeatRefresh);
        element.querySelector('#heartbeat-check-server')?.addEventListener('change', props.toggleHeartbeatCheckServer);
        element.querySelector('#heartbeat-toggle-btn')?.addEventListener('click', handleHeartbeatStartStop);
        element.querySelector('.context-settings-popup-header')?.addEventListener('mousedown', startDrag);
        element.querySelector('.collapse-btn')?.addEventListener('click', props.toggleCollapsed);
        element.querySelector('.resize-handle')?.addEventListener('mousedown', startResize);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keydown', handleEscKey);
    };
    
    const removeEventListeners = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleEscKey);
    };

    const startDrag = (event) => {
        const rect = element.getBoundingClientRect();
        const dragOffset = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
        props.startDrag(dragOffset);
        event.preventDefault();
    };

    const startResize = (event) => {
        if (props.contextSettings.collapsed) return;
        props.startResize();
        event.preventDefault();
    };

    const handleMouseMove = (event) => {
        if (props.contextSettings.isDragging) {
            const newX = event.clientX - props.contextSettings.dragOffset.x;
            const newY = event.clientY - props.contextSettings.dragOffset.y;
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            props.updatePosition({
                x: Math.max(0, Math.min(newX, maxX)),
                y: Math.max(0, Math.min(newY, maxY)),
            });
        } else if (props.contextSettings.isResizing) {
            const rect = element.getBoundingClientRect();
            const newWidth = event.clientX - rect.left;
            const newHeight = event.clientY - rect.top;
            props.updateSize({
                width: Math.max(300, Math.min(newWidth, window.innerWidth - props.contextSettings.position.x)),
                height: Math.max(200, Math.min(newHeight, window.innerHeight - props.contextSettings.position.y)),
            });
        }
    };

    const handleMouseUp = () => {
        if (props.contextSettings.isDragging) props.stopDrag();
        if (props.contextSettings.isResizing) props.stopResize();
    };

    const handleEscKey = (event) => {
        if (event.key === 'Escape' && props.contextSettings.isVisible) {
            props.hide();
        }
    };

    const mount = (targetBody = document.body) => {
        if (document.getElementById(popupId)) {
            element = document.getElementById(popupId);
        } else {
            element = document.createElement('div');
            element.id = popupId;
            element.className = 'context-settings-popup-overlay';
            targetBody.appendChild(element);
        }
        update(props); // Initial render
    };

    const destroy = () => {
        stopHeartbeat();
        removeEventListeners();
        element?.parentNode?.removeChild(element);
        element = null;
    };

    const update = (newProps) => {
        const oldProps = props;
        props = { ...props, ...newProps };
        
        if (!element || !props.contextSettings) return;

        element.style.display = props.contextSettings.isVisible ? 'block' : 'none';

        if (props.contextSettings.heartbeatRunning && (!oldProps.contextSettings || !oldProps.contextSettings.heartbeatRunning)) {
            startHeartbeat();
        } else if (!props.contextSettings.heartbeatRunning && oldProps.contextSettings && oldProps.contextSettings.heartbeatRunning) {
            stopHeartbeat();
        }
        
        render();
    };

    return { mount, destroy, update };
}

const mapStateToProps = state => ({
    contextSettings: state.contextSettings,
    settings: state.settings,
    file: state.file,
    path: state.path,
});

const mapDispatchToProps = dispatch => ({
    show: () => dispatch(contextSettingsActions.show()),
    hide: () => dispatch(contextSettingsActions.hide()),
    toggleCollapsed: () => dispatch(contextSettingsActions.toggleCollapsed()),
    updatePosition: (position) => dispatch(contextSettingsActions.updatePosition(position)),
    updateSize: (size) => dispatch(contextSettingsActions.updateSize(size)),
    startDrag: (offset) => dispatch(contextSettingsActions.startDrag(offset)),
    stopDrag: () => dispatch(contextSettingsActions.stopDrag()),
    startResize: () => dispatch(contextSettingsActions.startResize()),
    stopResize: () => dispatch(contextSettingsActions.stopResize()),
    updateHeartbeatInterval: (interval) => dispatch(contextSettingsActions.updateHeartbeatInterval(interval)),
    toggleHeartbeatRefresh: () => dispatch(contextSettingsActions.toggleHeartbeatRefresh()),
    toggleHeartbeatCheckServer: () => dispatch(contextSettingsActions.toggleHeartbeatCheckServer()),
    startHeartbeat: () => dispatch(contextSettingsActions.startHeartbeat()),
    stopHeartbeat: () => dispatch(contextSettingsActions.stopHeartbeat()),
    fetchListingByPath: (args) => dispatch(pathThunks.fetchListingByPath(args)),
    setSelectedOrg: (org) => dispatch(settingsThunks.setSelectedOrg(org)),
});

const ConnectedPopup = connect(mapStateToProps, mapDispatchToProps)(ContextSettingsPopupComponent);

let popupInstance = null;

export function initializeContextSettingsPopup() {
    if (!popupInstance) {
        popupInstance = ConnectedPopup('context-settings-popup');
        popupInstance.mount();
    }
    return {
        show: () => appStore.dispatch(contextSettingsActions.show()),
        hide: () => appStore.dispatch(contextSettingsActions.hide()),
        getInstance: () => popupInstance,
    };
}
