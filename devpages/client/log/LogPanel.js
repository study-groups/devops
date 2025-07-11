/**
 * LogPanel.js
 * 
 * Manages the LogPanel UI component. This file has been reverted to a stable version
 * to fix regressions related to entry format, expansion, rendering controls, and CLI functionality.
 */
import { appStore } from '/client/appState.js';
import { triggerActions } from '/client/actions.js';
import { appVer } from '/config.js';
import { setLogPanelInstance, logInfo, logError, logDebug, logWarn } from './LogCore.js';
import { createLogPanelDOM, createExpandedEntryToolbarDOM } from './logPanelDOM.js';
import { attachLogPanelEventListeners, removeLogPanelEventListeners } from './logPanelEvents.js';
import { loadLogPanelPreferences, saveLogPanelPreferences as saveLogPanelPreferencesState, subscribeToAppStoreChanges, updateSelectionButtonUI } from './logPanelState.js';
import { updateLogEntryDisplay, enhanceCodeBlocksAndMermaid } from './logPanelEntryDisplay.js';
import { updateTagsBar, applyFiltersToLogEntries, initializeLogFilterBar } from './LogFilterBar.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

const LOG_VISIBLE_KEY = 'logVisible';
const LOG_HEIGHT_KEY = 'logHeight';
const DEFAULT_LOG_HEIGHT = 150;
const MIN_LOG_HEIGHT = 80;

/**
 * LogPanel class.
 * Orchestrates the LogPanel component, delegating tasks to specialized modules.
 */
export class LogPanel {
    constructor(containerElementId = 'log-container') {
        this.container = document.getElementById(containerElementId);
        if (!this.container) {
            logError(`Container element with ID '${containerElementId}' not found. LogPanel will not function.`, 'LOG_PANEL_SETUP');
            return;
        }

        this.toolbarElement = null;
        this.tagsBarElement = null;
        this.logElement = null;
        this.statusElement = null;
        this.resizeHandle = null;
        this.minimizeButton = null;
        this.copyButton = null;
        this.clearButton = null;
        this.cliInputElement = null;
        this.appInfoElement = null;
        this.appVersionElement = null;

        this._lastCommandSelection = null;
        this._selectionStateA = null;
        this._selectionStateB = null;
        this._codeFenceBufferA = null;
        this._codeFenceBufferB = null;
        this._updateTagsBarTimeout = null;

        this.RENDER_MODE_RAW = 'raw';
        this.RENDER_MODE_MARKDOWN = 'markdown';
        this.RENDER_MODE_HTML = 'html';

        this.state = {
            entryCount: 0,
            logIndex: 0,
            logOrder: localStorage.getItem('logOrder') || 'recent'
        };

        this._isResizing = false;
        this._startY = 0;
        this._startHeight = 0;

        this.addEntry = this.addEntry.bind(this);
        this.copyLog = this.copyLog.bind(this);
        this.clearLog = this.clearLog.bind(this);
        this._updateLogEntryDisplay = this._updateLogEntryDisplay.bind(this);
        this._enhanceCodeBlocksAndMermaid = this._enhanceCodeBlocksAndMermaid.bind(this);

        this._appStateUnsubscribe = null;
        this._logFilteringUnsubscribe = null;

        logInfo('LogPanel instance created.', 'LOG_PANEL_LIFECYCLE');
        setLogPanelInstance(this);
    }

    initialize() {
        if (!this.container) return;

        createLogPanelDOM(this, appVer);
        
        requestAnimationFrame(() => {
            loadLogPanelPreferences(this, DEFAULT_LOG_HEIGHT, MIN_LOG_HEIGHT);
            subscribeToAppStoreChanges(this);
            attachLogPanelEventListeners(this);
            this._updateTagsBar();
            this.updateUI();
            this.updateEntryCount();
            if (typeof window !== 'undefined') window.logPanel = this;
            logInfo('LogPanel UI initialized successfully.', 'LOG_PANEL_LIFECYCLE');
        });
    }

    addEntry(entryData, legacyTypeArgument = 'text') {
        if (!this.logElement) return;

        let messageForDisplay;
        let originalMessageForCopy;
        let type;

        if (entryData && typeof entryData === 'object' && entryData.message !== undefined) {
            // Handle new structured log object
            type = entryData.type || 'GENERAL';
            const message = entryData.message;

            if (typeof message === 'string') {
                messageForDisplay = message;
                originalMessageForCopy = message;
            } else {
                // Pretty print for display, full JSON for copy
                messageForDisplay = JSON.stringify(message, null, 2);
                originalMessageForCopy = JSON.stringify(message);
            }
        } else {
            // Handle legacy string entry
            type = legacyTypeArgument.toUpperCase();
            messageForDisplay = String(entryData); // Ensure it's a string
            originalMessageForCopy = String(entryData);
        }

        const logType = typeof type === 'string' ? type.toUpperCase() : 'TEXT';

        const logEntryDiv = document.createElement('div');
        logEntryDiv.className = 'log-entry';

        // TIME
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'log-entry-timestamp';
        timestampSpan.textContent = new Date().toLocaleTimeString();

        // LEVEL (info, debug, error, etc.)
        const levelSpan = document.createElement('span');
        levelSpan.className = 'log-entry-level';
        levelSpan.textContent = 'INFO'; // Default, could be extracted from type

        // TYPE
        const typeSpan = document.createElement('span');
        typeSpan.className = 'log-entry-type';
        typeSpan.textContent = logType;

        // ORIGIN (source/component)
        const originSpan = document.createElement('span');
        originSpan.className = 'log-entry-origin';
        originSpan.textContent = 'SYSTEM'; // Default, could be extracted

        // MSG
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-entry-message';
        messageSpan.textContent = messageForDisplay;

        // COPY button
        const copyButton = document.createElement('button');
        copyButton.className = 'original-button';
        copyButton.innerHTML = `<img src="/client/styles/icons/copy.svg" alt="Copy" width="14" height="14">`;
        copyButton.title = 'Copy Original Message';
        copyButton.dataset.logText = originalMessageForCopy;

        logEntryDiv.appendChild(timestampSpan);
        logEntryDiv.appendChild(levelSpan);
        logEntryDiv.appendChild(typeSpan);
        logEntryDiv.appendChild(originSpan);
        logEntryDiv.appendChild(messageSpan);
        logEntryDiv.appendChild(copyButton);

        logEntryDiv.dataset.logType = logType;
        logEntryDiv.dataset.renderMode = this.RENDER_MODE_RAW;
        logEntryDiv.dataset.logIndex = this.state.logIndex;
        logEntryDiv.dataset.logTimestamp = new Date().toLocaleTimeString();

        if (this.state.logOrder === 'recent') {
            this.logElement.insertBefore(logEntryDiv, this.logElement.firstChild);
        } else {
            this.logElement.appendChild(logEntryDiv);
        }

        this.state.entryCount++;
        this.state.logIndex++;
        this.updateEntryCount();
        this._updateDiscoveredTypes(logType);
        applyFiltersToLogEntries(this.logElement, appStore.getState().logFiltering.activeFilters);
    }

    clearLog() {
        if (!this.logElement) return;
        this.logElement.innerHTML = '';
        this.state.entryCount = 0;
        this.state.logIndex = 0;
        this.updateEntryCount();
        dispatch({ type: ActionTypes.LOG_CLEAR });
        logInfo('Log cleared and filters reset.', 'LOG_PANEL_STATE');
    }

    setLogOrder(order) {
        if (!this.logElement) return;
        const entries = Array.from(this.logElement.children);
        if (entries.length === 0) return;

        entries.sort((a, b) => {
            const indexA = parseInt(a.dataset.logIndex || '0', 10);
            const indexB = parseInt(b.dataset.logIndex || '0', 10);
            return order === 'recent' ? indexB - indexA : indexA - indexB;
        });

        this.logElement.innerHTML = '';
        entries.forEach(entry => this.logElement.appendChild(entry));
        
        this.state.logOrder = order;
        localStorage.setItem('logOrder', order);
        logInfo(`Log order set to: ${order}`, 'LOG_PANEL_STATE');
    }

    copyLog() {
        if (!this.logElement) return;
        const logText = Array.from(this.logElement.children)
            .filter(entry => !entry.classList.contains('log-entry-hidden-by-filter'))
            .map(entry => {
                const index = entry.dataset.logIndex;
                const timestamp = entry.dataset.logTimestamp;
                const rawMessage = entry.querySelector('.log-entry-original-message').textContent;
                return `[${index}] ${timestamp} ${rawMessage}`;
            })
            .join('\n');

        navigator.clipboard.writeText(logText)
            .then(() => logInfo('Visible log entries copied to clipboard.', 'LOG_PANEL_COPY'))
            .catch(err => logError(`Failed to copy log: ${err.message}`, 'LOG_PANEL_ERROR', err));
    }

    showAllEntries() {
        if (!this.logElement) return;
        this.logElement.querySelectorAll('.log-entry:not(.expanded)').forEach(this._expandLogEntry.bind(this));
    }

    hideAllEntries() {
        if (!this.logElement) return;
        this.logElement.querySelectorAll('.log-entry.expanded').forEach(this._collapseLogEntry.bind(this));
    }

    updateUI() {
        const { logVisible, logHeight, logMenuVisible } = appStore.getState().ui;
        if (this.container) {
            this.container.classList.toggle('log-visible', logVisible);
            this.container.classList.toggle('log-hidden', !logVisible);
            this.container.style.height = logVisible ? `${logHeight}px` : '0px';
            document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
            document.documentElement.setAttribute('data-log-visible', String(logVisible));
        }
        const menuContainer = document.getElementById('log-menu-container');
        if (menuContainer) {
            menuContainer.classList.toggle('visible', logMenuVisible);
        }
    }

    updateEntryCount() {
        if (this.statusElement) {
            this.statusElement.textContent = `${this.state.entryCount} entries`;
        }
    }

    scrollToBottom() {
        if (this.logElement) this.logElement.scrollTop = this.logElement.scrollHeight;
    }

    _updateLogEntryDisplay(logEntryDiv, requestedMode) {
        updateLogEntryDisplay(logEntryDiv, requestedMode, false, this);
    }

    _enhanceCodeBlocksAndMermaid(parentElement, logEntryIndex) {
        enhanceCodeBlocksAndMermaid(parentElement, logEntryIndex, this);
    }

    _updateTagsBar() {
        if (this._updateTagsBarTimeout) clearTimeout(this._updateTagsBarTimeout);
        this._updateTagsBarTimeout = setTimeout(() => {
            if (this.tagsBarElement && this.tagsBarElement.isConnected) {
                initializeLogFilterBar(this.tagsBarElement);
            }
            this._updateTagsBarTimeout = null;
        }, 50);
    }

    _applyFiltersToLogEntries() {
        if (!this.logElement) return;
        applyFiltersToLogEntries(this.logElement, appStore.getState().logFiltering.activeFilters);
    }

    updateSelectionButtonUI(bufferType, hasData, stateData = null) {
        updateSelectionButtonUI(this, bufferType, hasData, stateData);
    }

    _expandLogEntry(logEntryDiv) {
        if (logEntryDiv.classList.contains('expanded')) return;
        logEntryDiv.classList.add('expanded');

        let expandedContent = logEntryDiv.querySelector('.log-entry-expanded-content');
        if (!expandedContent) {
            expandedContent = document.createElement('div');
            expandedContent.className = 'log-entry-expanded-content';
            const expandedToolbar = document.createElement('div');
            expandedToolbar.className = 'log-entry-expanded-toolbar';
            const messageContainer = document.createElement('div');
            messageContainer.className = 'log-entry-expanded-text-wrapper';

            expandedContent.appendChild(expandedToolbar);
            expandedContent.appendChild(messageContainer);
            logEntryDiv.appendChild(expandedContent);
        }
        
        createExpandedEntryToolbarDOM(logEntryDiv, logEntryDiv.dataset, this);
        this._updateLogEntryDisplay(logEntryDiv, this.RENDER_MODE_RAW);
    }

    _collapseLogEntry(logEntryDiv) {
        if (!logEntryDiv.classList.contains('expanded')) return;
        logEntryDiv.classList.remove('expanded');
    }

    _updateDiscoveredTypes(logType) {
        const { discoveredTypes } = appStore.getState().logFiltering;
        if (!discoveredTypes.includes(logType)) {
            dispatch({ type: ActionTypes.LOG_INIT_TYPES, payload: [...discoveredTypes, logType] });
        }
    }

    destroy() {
        if (this._updateTagsBarTimeout) clearTimeout(this._updateTagsBArTimeout);
        if (this._appStateUnsubscribe) this._appStateUnsubscribe();
        if (this._logFilteringUnsubscribe) this._logFilteringUnsubscribe();
        removeLogPanelEventListeners(this);
        if (this.container) this.container.innerHTML = '';
        logInfo('LogPanel instance destroyed.', 'LOG_PANEL_LIFECYCLE');
        setLogPanelInstance(null);
    }
} 