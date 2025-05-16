// client/log/logPanelDOM.js
// Manages the creation of the LogPanel's DOM structure.

/**
 * Creates a toolbar button.
 * @param {HTMLElement} toolbarEl - The toolbar element to append to (if !noAppend).
 * @param {string} id - Button ID.
 * @param {string} text - Button text/content.
 * @param {string} action - Data-action attribute value.
 * @param {string|null} title - Button title (tooltip).
 * @param {boolean} noAppend - If true, button is not appended to toolbarEl.
 * @returns {HTMLButtonElement|null} The created button or null.
 */
function createToolbarButton(toolbarEl, id, text, action, title = null, noAppend = false) {
    if (!toolbarEl && !noAppend) return null; // Need toolbar if appending
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    if (action) {
        button.dataset.action = action;
    }
    if (title) {
        button.title = title;
    }
    if (!noAppend && toolbarEl) {
        toolbarEl.appendChild(button);
    }
    return button;
}

/**
 * Creates the main DOM structure for the LogPanel.
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 * @param {string} appVersion - The application version string.
 */
export function createLogPanelDOM(logPanelInstance, appVersion) {
    const container = logPanelInstance.container;
    container.innerHTML = ''; // Clear existing content

    // Create Toolbar
    logPanelInstance.toolbarElement = document.createElement('div');
    logPanelInstance.toolbarElement.id = 'log-toolbar';
    container.appendChild(logPanelInstance.toolbarElement);
    const toolbarEl = logPanelInstance.toolbarElement; // convenience

    createToolbarButton(toolbarEl, 'log-help-toggle-btn', '☰', 'toggleLogMenu', 'Toggle Log Menu');
    
    logPanelInstance.cliInputElement = document.createElement('input');
    logPanelInstance.cliInputElement.type = 'text';
    logPanelInstance.cliInputElement.id = 'cli-input';
    logPanelInstance.cliInputElement.placeholder = 'Enter command...';
    toolbarEl.appendChild(logPanelInstance.cliInputElement);

    const sendButton = document.createElement('button');
    sendButton.id = 'cli-send-button';
    sendButton.textContent = 'Send';
    toolbarEl.appendChild(sendButton);

    createToolbarButton(toolbarEl, 'log-state-a-btn', 'A', 'setSelectionStateA', 'Store Editor Selection A');
    createToolbarButton(toolbarEl, 'log-state-b-btn', 'B', 'setSelectionStateB', 'Store Editor Selection B');

    logPanelInstance.appInfoElement = document.createElement('span');
    logPanelInstance.appInfoElement.id = 'app-info';
    logPanelInstance.appInfoElement.className = 'app-info';
    logPanelInstance.appInfoElement.dataset.action = 'showAppInfo';
    toolbarEl.appendChild(logPanelInstance.appInfoElement);

    const rightWrapper = document.createElement('div');
    rightWrapper.style.marginLeft = 'auto';
    rightWrapper.style.display = 'flex';
    rightWrapper.style.alignItems = 'center';
    rightWrapper.style.gap = '0.5rem';
    toolbarEl.appendChild(rightWrapper);

    logPanelInstance.appVersionElement = document.createElement('span');
    logPanelInstance.appVersionElement.id = 'log-app-version';
    logPanelInstance.appVersionElement.className = 'app-version log-version';
    logPanelInstance.appVersionElement.textContent = `v${appVersion}`;
    logPanelInstance.appVersionElement.title = `App Version: ${appVersion}`;
    // Appended via _createToolbarButton or directly to wrapper later if needed

    logPanelInstance.statusElement = document.createElement('span');
    logPanelInstance.statusElement.id = 'log-status';
    logPanelInstance.statusElement.textContent = '0 entries';
    rightWrapper.appendChild(logPanelInstance.statusElement);

    logPanelInstance.minimizeButton = createToolbarButton(null, 'minimize-log-btn', '✕', 'minimizeLog', 'Minimize Log', true);
    if (logPanelInstance.minimizeButton) rightWrapper.appendChild(logPanelInstance.minimizeButton);
 
    logPanelInstance.tagsBarElement = document.createElement('div');
    logPanelInstance.tagsBarElement.id = 'log-tags-bar';
    container.appendChild(logPanelInstance.tagsBarElement);
 
    logPanelInstance.logElement = document.createElement('div');
    logPanelInstance.logElement.id = 'log';
    container.appendChild(logPanelInstance.logElement);

    logPanelInstance.resizeHandle = document.createElement('div');
    logPanelInstance.resizeHandle.id = 'log-resize-handle';
    logPanelInstance.resizeHandle.title = 'Resize Log';
    container.appendChild(logPanelInstance.resizeHandle);
    
    const menuContainer = document.createElement('div');
    menuContainer.id = 'log-menu-container';
    
    const menuItems = [
        { text: 'Pause/Resume', action: 'toggleLogPause' },
        { text: 'Copy Log', action: 'copyLog' },
        { text: 'Clear Log', action: 'clearLog' },
        { text: 'Debug UI', action: 'runDebugUI' },
        { text: 'Sys Info', action: 'showSystemInfo' }, 
        { text: 'Static HTML', action: 'downloadStaticHTML' },
    ];
    
    const separator = document.createElement('div');
    separator.className = 'log-menu-separator';
    menuContainer.appendChild(separator);

    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'log-menu-item';
        menuItem.textContent = item.text;
        menuItem.dataset.action = item.action;
        menuContainer.appendChild(menuItem);
    });

    const versionInfo = document.createElement('div');
    versionInfo.className = 'log-menu-version';
    versionInfo.textContent = `v${appVersion}`;
    versionInfo.title = `App Version: ${appVersion}`;
    menuContainer.appendChild(versionInfo);
    
    container.insertBefore(menuContainer, logPanelInstance.logElement);
}

/**
 * Creates the toolbar for an expanded log entry.
 * @param {HTMLElement} logEntryDiv - The log entry's main div.
 * @param {object} entryData - Dataset from the log entry (logIndex, logTimestamp, etc.).
 * @param {LogPanel} logPanelInstance - The LogPanel instance for accessing render modes.
 * @returns {HTMLElement} The created toolbar element.
 */
export function createExpandedEntryToolbarDOM(logEntryDiv, entryData, logPanelInstance) {
    const expandedToolbar = logEntryDiv.querySelector('.log-entry-expanded-toolbar');
    if (!expandedToolbar || expandedToolbar.dataset.toolbarBuilt) {
        // If no toolbar div or already built, something is wrong or it's a redundant call
        if(!expandedToolbar) logPanelInternalDebug('Expanded toolbar div not found in createExpandedEntryToolbarDOM', 'warn');
        return expandedToolbar;
    }

    expandedToolbar.innerHTML = ''; // Clear previous content
    const { logIndex, logTimestamp, logType, logSubtype, rawOriginalMessage } = entryData;

    const createToken = (text, className) => {
        const token = document.createElement('span');
        token.className = `log-token ${className}`;
        token.textContent = text;
        return token;
    };

    if (logIndex !== undefined) expandedToolbar.appendChild(createToken(`[${logIndex}]`, 'log-token-index'));
    if (logTimestamp) expandedToolbar.appendChild(createToken(logTimestamp, 'log-token-time'));
    if (logType) expandedToolbar.appendChild(createToken(logType, `log-token-type log-type-${logType.toLowerCase()}` ));
    if (logSubtype) expandedToolbar.appendChild(createToken(`[${logSubtype}]`, `log-token-subtype log-subtype-${logSubtype.toLowerCase().replace(/[^a-z0-9\-]/g, '-')}`));

    const expandedButtonWrapper = document.createElement('div');
    expandedButtonWrapper.style.marginLeft = 'auto';
    expandedButtonWrapper.style.display = 'flex';
    expandedButtonWrapper.style.alignItems = 'center';
    expandedButtonWrapper.style.gap = '0.25rem';
    expandedToolbar.appendChild(expandedButtonWrapper);

    const markdownToggleButton = document.createElement('button');
    markdownToggleButton.textContent = 'MD';
    markdownToggleButton.className = 'log-entry-button markdown-toggle-button';
    markdownToggleButton.title = 'Toggle Markdown Rendering';
    expandedButtonWrapper.appendChild(markdownToggleButton);

    const htmlToggleButton = document.createElement('button');
    htmlToggleButton.textContent = 'HTML';
    htmlToggleButton.className = 'log-entry-button html-toggle-button';
    htmlToggleButton.title = 'Toggle HTML Page Rendering (iframe)';
    expandedButtonWrapper.appendChild(htmlToggleButton);

    const toolbarCopyButton = document.createElement('button');
    toolbarCopyButton.innerHTML = '&#128203;';
    toolbarCopyButton.className = 'log-entry-button toolbar-button';
    toolbarCopyButton.title = 'Copy log entry text (Shift+Click to Paste)';
    toolbarCopyButton.dataset.logText = rawOriginalMessage || '';
    expandedButtonWrapper.appendChild(toolbarCopyButton);

    const collapsePinButton = document.createElement('button');
    collapsePinButton.innerHTML = '&#128204;'; // Pushpin icon
    collapsePinButton.className = 'log-entry-button collapse-pin-button';
    collapsePinButton.title = 'Collapse Log Entry';
    collapsePinButton.dataset.action = 'collapseLogEntry';
    expandedButtonWrapper.appendChild(collapsePinButton);

    expandedToolbar.dataset.toolbarBuilt = 'true';

    // Attach internal listeners for MD/HTML toggles (specific to this toolbar)
    markdownToggleButton.addEventListener('click', (mdEvent) => {
        mdEvent.stopPropagation();
        const currentMode = logEntryDiv.dataset.renderMode;
        const newMode = currentMode === logPanelInstance.RENDER_MODE_MARKDOWN ? logPanelInstance.RENDER_MODE_RAW : logPanelInstance.RENDER_MODE_MARKDOWN;
        logPanelInstance._updateLogEntryDisplay(logEntryDiv, newMode); // Assumes _updateLogEntryDisplay is method on instance
    });

    htmlToggleButton.addEventListener('click', (htmlEvent) => {
        htmlEvent.stopPropagation();
        const currentMode = logEntryDiv.dataset.renderMode;
        const newMode = currentMode === logPanelInstance.RENDER_MODE_HTML ? logPanelInstance.RENDER_MODE_RAW : logPanelInstance.RENDER_MODE_HTML;
        logPanelInstance._updateLogEntryDisplay(logEntryDiv, newMode); // Assumes _updateLogEntryDisplay is method on instance
    });
    
    return expandedToolbar;
}

// Need to ensure logPanelInternalDebug is available if used here, or pass it, or remove for production.
// For simplicity, I've removed its direct use from this DOM module, assuming errors are caught elsewhere
// or higher-level functions using this will log.
// If not, define a local simple console.warn for this module.
function logPanelInternalDebug(message, level = 'debug') {
    const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
    logFunc(`[logPanelDOM] ${message}`);
} 