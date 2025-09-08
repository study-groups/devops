// client/log/logEntryDOM.js
// Manages the creation of log entry DOM structures and toolbars.

import { storageService } from '../services/storageService.js';
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
 * Creates the main DOM structure for the LogDisplay.
 * @param {object} logDisplayInstance - The instance of the LogDisplay.
 * @param {string} appVersion - The application version.
 */
export function createLogPanelDOM(logDisplayInstance, appVersion) {
    const container = logDisplayInstance.container;
    if (!container) {
        console.error('[LogDisplay] No container available for createLogPanelDOM');
        return;
    }
    container.innerHTML = ''; // Clear existing content

    // Create Toolbar with all controls
    logDisplayInstance.toolbarElement = document.createElement('div');
    logDisplayInstance.toolbarElement.id = 'log-toolbar';
    container.appendChild(logDisplayInstance.toolbarElement);
    const toolbarEl = logDisplayInstance.toolbarElement; // convenience

    // Menu button on the far left
    const menuButton = createToolbarButton(toolbarEl, '', '☰', 'toggleLogMenu', 'Toggle Log Menu');
    if (menuButton) menuButton.className = 'log-header-button log-menu-grip';

    // CLI input field
    logDisplayInstance.cliInputElement = document.createElement('input');
    logDisplayInstance.cliInputElement.type = 'text';
    logDisplayInstance.cliInputElement.id = 'cli-input';
    logDisplayInstance.cliInputElement.placeholder = 'Enter command...';
    toolbarEl.appendChild(logDisplayInstance.cliInputElement);

    // Send button
    const sendButton = document.createElement('button');
    sendButton.id = 'cli-send-button';
    sendButton.textContent = 'Send';
    toolbarEl.appendChild(sendButton);

    // Right side wrapper for status
    const rightWrapper = document.createElement('div');
    rightWrapper.style.marginLeft = 'auto';
    rightWrapper.style.display = 'flex';
    rightWrapper.style.alignItems = 'center';
    rightWrapper.style.gap = '0.5rem';
    toolbarEl.appendChild(rightWrapper);

    logDisplayInstance.statusElement = document.createElement('span');
    logDisplayInstance.statusElement.id = 'log-status';
    logDisplayInstance.statusElement.textContent = '0 entries';
    rightWrapper.appendChild(logDisplayInstance.statusElement);
    
    const headerContainer = document.createElement('div');
    headerContainer.id = 'log-header-container';
    container.appendChild(headerContainer);

    logDisplayInstance.tagsBarElement = document.createElement('div');
    logDisplayInstance.tagsBarElement.id = 'log-tags-bar';
    headerContainer.appendChild(logDisplayInstance.tagsBarElement);
 
    const columnHeader = document.createElement('div');
    columnHeader.id = 'log-column-header';
    columnHeader.className = 'log-column-header';
    columnHeader.innerHTML = `
        <span class="log-header-timestamp">Timestamp</span>
        <div class="resizer" data-column="timestamp"></div>
        <span class="log-header-level">Level</span>
        <div class="resizer" data-column="level"></div>
        <span class="log-header-context">Context</span>
        <div class="resizer" data-column="context"></div>
        <span class="log-header-message">Message</span>
        <div class="resizer" data-column="message"></div>
        <span class="log-header-melvin">Melvin</span>
    `;
    headerContainer.appendChild(columnHeader);

    logDisplayInstance.logElement = document.createElement('div');
    logDisplayInstance.logElement.id = 'log';
    container.appendChild(logDisplayInstance.logElement);

    logDisplayInstance.resizeHandle = document.createElement('div');
    logDisplayInstance.resizeHandle.id = 'log-resize-handle';
    logDisplayInstance.resizeHandle.title = 'Resize Log';
    container.appendChild(logDisplayInstance.resizeHandle);
    
    const menuContainer = document.createElement('div');
    menuContainer.id = 'log-menu-container';
    
    const menuActions = document.createElement('div');
    menuActions.className = 'log-menu-actions';
    
    const copyButton = createToolbarButton(menuActions, '', 'Copy All', 'copy-log', 'Copy All Visible Log Entries');
    if (copyButton) copyButton.className = 'log-menu-badge-button';
    
    const clearButton = createToolbarButton(menuActions, '', 'Clear', 'clear-log', 'Clear All Log Entries');
    if (clearButton) clearButton.className = 'log-menu-badge-button';

    menuContainer.appendChild(menuActions);

    const menuItems = [
        { text: 'Recent First', action: 'setLogOrderRecent' },
        { text: 'Past First', action: 'setLogOrderPast' },
        { text: 'Debug UI', action: 'runDebugUI' },
        { text: 'Sys Info', action: 'showSystemInfo' }
    ];
    
    const separator = document.createElement('div');
    separator.className = 'log-menu-separator';
    menuContainer.appendChild(separator);

    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'log-menu-item';
        menuItem.textContent = item.text;
        menuItem.dataset.action = item.action;
        
        // Add visual indicator for current log order
        if (item.action === 'setLogOrderRecent' || item.action === 'setLogOrderPast') {
            const currentOrder = storageService.getItem('logOrder') || 'recent';
            const isActive = (item.action === 'setLogOrderRecent' && currentOrder === 'recent') ||
                           (item.action === 'setLogOrderPast' && currentOrder === 'past');
            if (isActive) {
                menuItem.textContent = `✓ ${item.text}`;
                menuItem.style.fontWeight = 'bold';
            }
        }
        
        menuContainer.appendChild(menuItem);
    });

    const versionInfo = document.createElement('div');
    versionInfo.className = 'log-menu-version';
    versionInfo.textContent = appVersion;
    versionInfo.title = `App Version: ${appVersion}`;
    menuContainer.appendChild(versionInfo);
    
    container.insertBefore(menuContainer, logDisplayInstance.logElement);
}

/**
 * Creates the toolbar for an expanded log entry.
 * This is used to switch between different rendering modes (raw, markdown, html).
 * @param {object} logDisplay- The LogDisplay instance for accessing render modes.
 */
export function createExpandedEntryToolbarDOM(logEntry, logDisplay) {
    const expandedToolbar = logEntry.querySelector('.log-entry-expanded-toolbar');
    if (!expandedToolbar || expandedToolbar.dataset.toolbarBuilt) {
        // If no toolbar div or already built, something is wrong or it's a redundant call
        if(!expandedToolbar) logPanelInternalDebug('Expanded toolbar div not found in createExpandedEntryToolbarDOM', 'warn');
        return expandedToolbar;
    }

    expandedToolbar.innerHTML = ''; // Clear previous content
    const { logIndex, logTimestamp, logType, logSubtype, rawOriginalMessage } = logEntry;

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
    expandedButtonWrapper.dataset.visible = 'true';
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
    toolbarCopyButton.innerHTML = `<img src="/client/styles/icons/copy.svg" alt="Copy" width="14" height="14">`;
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
    markdownToggleButton.addEventListener('click', async (mdEvent) => {
        mdEvent.stopPropagation();
        const currentMode = logEntry.dataset.renderMode;
        const newMode = currentMode === logDisplay.RENDER_MODE_MARKDOWN ? logDisplay.RENDER_MODE_RAW : logDisplay.RENDER_MODE_MARKDOWN;
        const { updateLogEntryDisplay } = await import('./logEntryRenderer.js');
        updateLogEntryDisplay(logEntry, newMode, false, logDisplay);
    });

    htmlToggleButton.addEventListener('click', async (htmlEvent) => {
        htmlEvent.stopPropagation();
        const currentMode = logEntry.dataset.renderMode;
        const newMode = currentMode === logDisplay.RENDER_MODE_HTML ? logDisplay.RENDER_MODE_RAW : logDisplay.RENDER_MODE_HTML;
        const { updateLogEntryDisplay } = await import('./logEntryRenderer.js');
        updateLogEntryDisplay(logEntry, newMode, false, logDisplay);
    });
    
    return expandedToolbar;
}

// Need to ensure logPanelInternalDebug is available if used here, or pass it, or remove for production.
// For simplicity, I've removed its direct use from this DOM module, assuming errors are caught elsewhere
// or higher-level functions using this will log.
// If not, define a local simple console.warn for this module.
function logPanelInternalDebug(message, level = 'debug') {
    const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
    logFunc(`[logEntryDOM] ${message}`);
}