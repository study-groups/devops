/**
 * @file client/settings/panels/console/ConsoleLogPanel.js
 * @description Settings panel for console logging, performance metrics, and type filtering.
 * Designed to be in feature parity with ConsoleLogManager.js (no subtypes)
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import FilterManager from '/client/settings/utils/FilterManager.js';
import { LogManager } from '/client/log/LogManager.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';
import { ConsoleLogManager } from '/client/log/ConsoleLogManager.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('ConsoleLogPanel');

// Attempt to get the most original console methods
const panelOriginalConsole = (() => {
  const getOriginal = (method) => {
    if (window.originalConsoleForDebug && typeof window.originalConsoleForDebug[method] === 'function') {
      return window.originalConsoleForDebug[method].bind(window.originalConsoleForDebug);
    }
    // Fallback: what console.log is when THIS script loads.
    // This is risky if other scripts (earlyInit, ConsoleLogManager) have already patched it.
    // However, originalConsoleForDebug is set by ConsoleLogManager, so it should be preferred.
    return console[method] ? console[method].bind(console) : function() {};
  };

  return {
    log: getOriginal('log'),
    info: getOriginal('info'),
    debug: getOriginal('debug'),
    warn: getOriginal('warn'),
    error: getOriginal('error')
  };
})();

export class ConsoleLogPanel extends BasePanel {
  constructor(options) {
    super(options);
    
    this._boundUpdateBufferedView = this._updateBufferedViewAndStatus.bind(this); // Bound once
    
    // Get console log manager instance - prefer injected, fallback to window, create new if needed
    this.consoleLogManager = (typeof window !== 'undefined' && window.consoleLogManager) || 
                            new ConsoleLogManager();
    
    // Also get the app log manager for hybrid system
    this.appLogManager = (typeof window !== 'undefined' && window.logManager) || 
                        new LogManager();
    
    // Initialize container references
    this.typesContainer = null;
    this.levelFilterContainer = null;
    this.bufferStatusText = null; // For _updateBufferedViewAndStatus
    this.bufferViewArea = null; // For _updateBufferedViewAndStatus
  }

  render() {
    if (!this.element) {
      this.element = document.createElement('div');
      this.element.className = 'console-log-panel';
    }
    this.createUI();
    return this.element;
  }

  onMount(container) {
    if (typeof window.registerOnBufferUpdate === 'function') {
      window.registerOnBufferUpdate(this._boundUpdateBufferedView);
    }
    
    this.log('PANEL_INIT', 'INITIALIZED', 'Console Log Panel initialized. UI created. Buffer update listener registered.');
    
    // Expose a way for ConsoleLogManager to directly trigger a UI update
    window.APP = window.APP || {};
    if (typeof window.APP.devPages === 'undefined') {
        window.APP.devPages = {};
    }
    if (typeof window.APP.devPages.ui === 'undefined') window.APP.devPages.ui = {};
    window.APP.devPages.ui.updateConsoleLogPanelStatus = this.updateStatusDisplay.bind(this);
    this.log('PANEL_INIT', 'STATUS_UPDATER_REGISTERED', 'Registered window.devPages.ui.updateConsoleLogPanelStatus');

    if (this.updateStatusDisplay) {
        setTimeout(() => this.updateStatusDisplay(), 0); 
    }

    const allFilters = FilterManager.loadAllFilters();
    window.config = allFilters;

    this.storageListener = (event) => {
      // If any filter key changes, reload filters and update UI
      if (FilterManager.STORAGE_KEYS && Object.values(FilterManager.STORAGE_KEYS).includes(event.key)) {
        const allFilters = FilterManager.loadAllFilters();
        window.config.typeFilters = allFilters.typeFilters;
        window.config.levelFilters = allFilters.levelFilters;
        window.config.keywordFilters = allFilters.keywordFilters;
        this.refreshTypeFilterDisplay();
        this.refreshLevelFilterDisplay();
        // If you have keyword filter UI, refresh that too
      }
    };
    window.addEventListener('storage', this.storageListener);
  }

  onUnmount() {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
    }
    if (typeof window.registerOnBufferUpdate === 'function' && this._boundUpdateBufferedView) {
      // Note: There's no unregister function, but we store the reference for potential cleanup
    }
  }

  _updateBufferedViewAndStatus(newLogEntry = null) {
    // Update status text (always)
    if (typeof window.getLogBufferSize === 'function') {
        const size = window.getLogBufferSize();
        if (this.bufferStatusText) { // Ensure bufferStatusText has been created by createUI
            this.bufferStatusText.textContent = `Buffered messages: ${size}`;
        }
    }

    // Update view area (only if it exists and is visible)
    if (this.bufferViewArea && this.bufferViewArea.parentElement) { // Check if it's in the DOM
        if (newLogEntry) {
            // Append new entry efficiently if view is already populated
            const newEntryString = JSON.stringify(newLogEntry, null, 2);
            if (this.bufferViewArea.value === 'Log buffer is empty.') {
                 this.bufferViewArea.value = newEntryString;
            } else {
                 this.bufferViewArea.value += '\n--------------------\n' + newEntryString;
            }
            this.bufferViewArea.scrollTop = this.bufferViewArea.scrollHeight; // Auto-scroll to bottom
        } else {
            // Full refresh if no specific new entry (e.g., initial load or manual view click)
            if (typeof window.APP.services.getLogBuffer === 'function') {
                const logs = window.APP.services.getLogBuffer();
                if (logs.length === 0) {
                    this.bufferViewArea.value = 'Log buffer is empty.';
                } else {
                    this.bufferViewArea.value = logs.map(log => JSON.stringify(log, null, 2)).join('\n--------------------\n');
                    this.bufferViewArea.scrollTop = this.bufferViewArea.scrollHeight; // Auto-scroll to bottom
                }
            }
        }
    }
  }

  createUI() {
    // Clear any existing content
    if (this.element) {
      this.element.innerHTML = '';
    }
    
    const panelContent = document.createElement('div');
    panelContent.classList.add('settings-panel-content');

    // Helper to create a standard settings group like in CssSettingsPanel
    const createSettingsGroup = (titleText, descriptionText = '') => {
      const group = document.createElement('div');
      group.classList.add('settings-section'); // Consistent with CssSettingsPanel
      group.style.marginBottom = '20px';

      const title = document.createElement('h3'); // Using h3 like CssSettingsPanel
      title.classList.add('settings-section-title');
      title.textContent = titleText;
      title.style.marginBottom = descriptionText ? '5px' : '10px';
      group.appendChild(title);

      if (descriptionText) {
        const description = document.createElement('p');
        description.classList.add('settings-description');
        description.textContent = descriptionText;
        description.style.marginBottom = '10px';
        group.appendChild(description);
      }
      return group;
    };
    
    // Helper for creating input groups (label + input + (optional) button)
    const createInputGroupDiv = () => {
        const div = document.createElement('div');
        div.classList.add('settings-input-group'); // Consistent with CssSettingsPanel
        div.style.marginBottom = '10px';
        return div;
    };


    // Helper for Toggles
    const createToggleControl = (id, labelText, descriptionText, isCheckedFn, changeFn) => {
      const controlDiv = document.createElement('div');
      controlDiv.style.marginBottom = '10px'; // Spacing for each toggle

      const label = document.createElement('label');
      label.classList.add('settings-label');
      label.htmlFor = id;
      label.textContent = labelText;
      label.style.display = 'flex'; // Align checkbox and text
      label.style.alignItems = 'center';
      label.style.marginBottom = '3px';

      const toggle = document.createElement('input');
      toggle.id = id;
      toggle.type = 'checkbox';
      toggle.classList.add('settings-checkbox');
      toggle.style.marginRight = '8px';
      try {
        const initialChecked = typeof isCheckedFn === 'function' ? isCheckedFn() : false;
        // Safely log initial state
        if (window.originalConsoleForDebug && typeof window.originalConsoleForDebug.debug === 'function') {
          const funcString = typeof isCheckedFn === 'function' ? isCheckedFn.toString().substring(0,150) : 'N/A (not a function)';
          log.debug('UI', 'INITIAL_CHECKED', `Initial checked for ${id}: ${initialChecked} via function: ${funcString}`);
        } else {
          // Fallback if originalConsoleForDebug is not ready (should ideally not happen if init order is correct)
          log.debug('UI', 'INITIAL_CHECKED_FALLBACK', `Initial checked for ${id}: ${initialChecked}. isCheckedFn type: ${typeof isCheckedFn}`);
        }
        toggle.checked = initialChecked;
      } catch (e) {
        // This catch is now for errors from isCheckedFn() itself or other unexpected issues
        log.warn('UI', 'INITIAL_STATE_ERROR', `Error setting initial state for toggle ${id}: ${e.message}`, e);
        console.error(`[ConsoleLogPanel_ERROR] Error setting initial state for ${id}:`, e);
        toggle.checked = false; // Fallback if any error occurs
      }
      toggle.addEventListener('change', (e) => {
        if (typeof changeFn === 'function') changeFn(e.target.checked, true);
      });
      
      label.prepend(toggle); // Checkbox before text
      controlDiv.appendChild(label);

      if (descriptionText) {
        const description = document.createElement('p');
        description.classList.add('settings-description');
        description.textContent = descriptionText;
        description.style.marginLeft = '28px'; // Indent description under checkbox
        description.style.fontSize = '0.9em';
        controlDiv.appendChild(description);
      }
      return controlDiv;
    };

    // --- Helper for Text Inputs specifically for keywords ---
    const createKeywordTextInput = (id, labelText, placeholderText, getValueFn, setGlobalKeywordFn) => {
        const settingDiv = document.createElement('div');
        settingDiv.style.marginBottom = '15px';

        const label = document.createElement('label');
        label.classList.add('settings-label');
        label.htmlFor = id;
        label.textContent = labelText;
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        settingDiv.appendChild(label);

        const input = document.createElement('input');
        input.id = id;
        input.type = 'text';
        input.classList.add('settings-text-input'); // Consistent styling
        input.placeholder = placeholderText;
        input.style.width = 'calc(100% - 16px)'; // Account for padding/border

        try {
            input.value = typeof getValueFn === 'function' ? getValueFn() : '';
            log.debug('UI', 'INITIAL_VALUE', `Initial value for ${id}: "${input.value}"`);
        } catch(e) {
            log.warn('UI', 'GET_INITIAL_VALUE_ERROR', `Error getting initial value for ${id}: ${e.message}`, e);
            input.value = '';
        }

        input.addEventListener('input', (event) => {
            const keywordValue = event.target.value;
            log.debug('UI', 'KEYWORD_INPUT', `Input event for ${id}. Value: "${keywordValue}". Calling setGlobalKeywordFn.`);
            if (typeof setGlobalKeywordFn === 'function') {
                setGlobalKeywordFn(keywordValue, true); // Pass value and persist = true
            } else {
                log.error('UI', 'SET_GLOBAL_KEYWORD_FN_ERROR', `Error: setGlobalKeywordFn for ${id} is not a function.`);
            }
        });
        settingDiv.appendChild(input);
        return settingDiv;
    };

    // --- 1. Console Logging Section ---
    const loggingGroup = createSettingsGroup('Console Logging');
    
    // Add the console logging toggle
    loggingGroup.appendChild(
      createToggleControl(
        'console-logging-toggle',
        'Enable Console Logging (checked = on)',
        '',
        () => {
          // Read state ONLY from ConsoleLogManager
          if (typeof window.APP.services.isConsoleLoggingEnabled === 'function') {
            return window.APP.services.isConsoleLoggingEnabled();
          }
          // Return false if the function doesn't exist yet, to prevent errors.
          // The UI will be updated shortly after initialization anyway.
          return false;
        },
        (checked) => { // Persist is always true, so we don't need the argument
          panelOriginalConsole.log(`[ConsoleLogPanel] Toggle changed to: ${checked ? 'ENABLED' : 'DISABLED'}`);
          
          if (checked) {
            if (typeof window.APP.services.enableConsoleLogging === 'function') {
              window.enableConsoleLogging(true); // true for persist
            } else {
              panelOriginalConsole.error("[ConsoleLogPanel_ERROR] window.enableConsoleLogging function not found!");
            }
          } else {
            if (typeof window.APP.services.disableConsoleLogging === 'function') {
              window.disableConsoleLogging(true); // true for persist
            } else {
              panelOriginalConsole.error("[ConsoleLogPanel_ERROR] window.disableConsoleLogging function not found!");
            }
          }
          
          // After changing the state, immediately update the UI to reflect it.
          if (this.updateStatusDisplay) {
            this.updateStatusDisplay();
          }
        }
      )
    );
    
    // Add a status message below the toggle
    const statusMessage = document.createElement('div');
    statusMessage.id = 'console-logging-status';
    statusMessage.style.marginTop = '5px';
    statusMessage.style.padding = '5px';
    statusMessage.style.borderRadius = '3px';
    statusMessage.style.fontWeight = 'bold';
    loggingGroup.appendChild(statusMessage);
    
    // Store updateStatusDisplay on the instance so it can be called from changeFn
    this.updateStatusDisplay = () => {
       let isEnabled = false;
       if (typeof window.APP.services.isConsoleLoggingEnabled === 'function') {
         isEnabled = window.APP.services.isConsoleLoggingEnabled();
       }
       // No fallback to localStorage. If function doesn't exist, isEnabled remains false.

       if (statusMessage) { // Ensure statusMessage element exists
            statusMessage.style.backgroundColor = isEnabled ? '#d4edda' : '#f8d7da';
            statusMessage.style.border = '1px solid ' + (isEnabled ? '#c3e6cb' : '#f5c6cb');
            statusMessage.textContent = isEnabled ? 
              'STATUS: Console logging is ENABLED' : 
              'STATUS: Console logging is DISABLED';
       }
       
       const toggle = document.getElementById('console-logging-toggle');
       if (toggle) {
         toggle.checked = isEnabled;
       }
       
       // Apply console logging state to the log container instead of body
       const logContainer = document.getElementById('log-container');
       if (logContainer) {
           if (isEnabled) {
               logContainer.classList.remove('console-logging-disabled');
               logContainer.classList.add('console-logging-enabled');
           } else {
               logContainer.classList.remove('console-logging-enabled');
               logContainer.classList.add('console-logging-disabled');
           }
       }

       // Now also refresh filter options as window.config should be ready
       this.refreshTypeFilterDisplay();
       this.refreshLevelFilterDisplay();
     };
    
    // Initial call to set status display correctly
    this.updateStatusDisplay();

    // Update status whenever localStorage changes (e.g. by ConsoleLogManager)
    window.addEventListener('storage', (event) => {
      if (event.key === 'consoleLoggingEnabled') {
        this.updateStatusDisplay();
      }
    });
    
    // Add a "Refresh Status" button to the status message
    const updateButton = document.createElement('button');
    updateButton.textContent = 'Refresh Status';
    updateButton.className = 'settings-button';
    updateButton.style.marginLeft = '10px';
    updateButton.style.padding = '3px 8px';
    updateButton.addEventListener('click', this.updateStatusDisplay);
    statusMessage.appendChild(updateButton);

    // Create and Add "Log Filters" button (re-adding previous functionality)
    const logFiltersButton = document.createElement('button');
    logFiltersButton.textContent = 'Log Filters';
    logFiltersButton.className = 'settings-button'; 
    logFiltersButton.style.padding = '3px 8px';    
    logFiltersButton.style.backgroundColor = '#cce5ff'; 
    logFiltersButton.style.border = '1px solid #b8daff';   
    logFiltersButton.style.borderRadius = '3px';          
    logFiltersButton.style.cursor = 'pointer';
    logFiltersButton.style.marginLeft = '10px'; 
    
    logFiltersButton.addEventListener('click', () => {
      panelOriginalConsole.log("===== CURRENT LOG FILTER SETTINGS =====");
      panelOriginalConsole.log("window.config:", JSON.parse(JSON.stringify(window.config || {}))); // Deep copy for safety
      
      if (window.config?.typeFilters) {
        panelOriginalConsole.log("Type Filters - Include:", window.config.typeFilters.include);
        panelOriginalConsole.log("Type Filters - Exclude:", window.config.typeFilters.exclude);
      }

      if (window.config?.levelFilters) {
        panelOriginalConsole.log("Level Filters - Include:", window.config.levelFilters.include);
        panelOriginalConsole.log("Level Filters - Exclude:", window.config.levelFilters.exclude);
      }
      if (window.config?.keywordFilters) {
        panelOriginalConsole.log("Keyword Filters - Include:", window.config.keywordFilters.include);
        panelOriginalConsole.log("Keyword Filters - Exclude:", window.config.keywordFilters.exclude);
      }
      
      panelOriginalConsole.log("Global Filter Functions Available:");
      panelOriginalConsole.log("window.setIncludeTypes:", typeof window.setIncludeTypes === 'function');
      panelOriginalConsole.log("window.setExcludeTypes:", typeof window.setExcludeTypes === 'function');
      panelOriginalConsole.log("window.setIncludeLevels:", typeof window.setIncludeLevels === 'function');
      panelOriginalConsole.log("window.setExcludeLevels:", typeof window.setExcludeLevels === 'function');
      panelOriginalConsole.log("window.setIncludeKeywords:", typeof window.setIncludeKeywords === 'function');
      panelOriginalConsole.log("window.setExcludeKeywords:", typeof window.setExcludeKeywords === 'function');
      panelOriginalConsole.log("window.clearAllFilters:", typeof window.clearAllFilters === 'function');
      panelOriginalConsole.log("===== END LOG FILTER SETTINGS =====");
      
      alert("Current filter settings logged to console. Check the browser console for details.");
    });
    statusMessage.appendChild(logFiltersButton);
    
    panelContent.appendChild(loggingGroup);

    // --- 2. Performance Monitoring Section ---
    const perfGroup = createSettingsGroup('Performance Metrics');
    perfGroup.appendChild(
      createToggleControl(
        'perf-logging-toggle',
        'Enable Performance Logging',
        'Master switch for collecting performance timing data.',
        window.isPerformanceLoggingEnabled,
        (checked, persist) => {
          if (checked) window.enablePerformanceLogging(persist);
          else window.disablePerformanceLogging(persist);
        }
      )
    );
    perfGroup.appendChild(
      createToggleControl(
        'detailed-perf-toggle',
        'Show Detailed Performance Metrics',
        'If performance logging is enabled, shows more verbose timing data.',
        window.isDetailedTimingEnabled,
        (checked, persist) => {
          if (checked) window.enableDetailedTiming(persist);
          else window.disableDetailedTiming(persist);
        }
      )
    );
    panelContent.appendChild(perfGroup);
    
    // --- 3. Filtering Section ---
    const keywordGroup = createSettingsGroup('Keyword Filtering', 'Filter log messages by content');
    
    // Add input fields for keyword filtering
    keywordGroup.appendChild(
      createKeywordTextInput(
        'include-keywords',
        'Include Keywords (space-separated)',
        'e.g.: api error server',
        () => FilterManager.getIncludeKeywords().join(' '),
        (val) => FilterManager.setIncludeKeywords(val.split(/\s+/).filter(Boolean))
      )
    );
    keywordGroup.appendChild(
      createKeywordTextInput(
        'exclude-keywords',
        'Exclude Keywords (space-separated)',
        'e.g.: verbose debug minor',
        () => FilterManager.getExcludeKeywords().join(' '),
        (val) => FilterManager.setExcludeKeywords(val.split(/\s+/).filter(Boolean))
      )
    );

    // Button to clear keyword filters
    const clearFiltersBtn = document.createElement('button');
    clearFiltersBtn.classList.add('settings-button');
    clearFiltersBtn.textContent = 'Clear All Filters';
    clearFiltersBtn.style.marginTop = '10px';
    clearFiltersBtn.addEventListener('click', () => {
      FilterManager.clearAllFilters();
      this.refreshTypeFilterDisplay();
      this.refreshLevelFilterDisplay();
      // ...refresh keyword UI if present
    });
    keywordGroup.appendChild(clearFiltersBtn);
    
    panelContent.appendChild(keywordGroup);
    
    // --- Type Filtering Section ---
    const typeFilterGroup = createSettingsGroup('Type Filtering', 
      'Filter logs by their Type tags (e.g., [USER], [API], etc.)');
    
    const typesTitle = document.createElement('h4');
    typesTitle.textContent = 'Log Types';
    typesTitle.style.marginBottom = '5px';
    // Create and assign the container for types
    this.typesContainer = document.createElement('div');
    this.typesContainer.classList.add('filter-types-container');
    this.typesContainer.style.marginBottom = '15px';
    this.typesContainer.style.maxHeight = '200px';
    this.typesContainer.style.overflowY = 'auto';
    this.typesContainer.style.border = '1px solid #ccc';
    this.typesContainer.style.padding = '10px';
    
    typeFilterGroup.appendChild(typesTitle);
    typeFilterGroup.appendChild(this.typesContainer); // Use instance property
    
    const refreshTypesBtn = document.createElement('button');
    refreshTypesBtn.classList.add('settings-button');
    refreshTypesBtn.textContent = 'Refresh Filters'; // Changed label
    refreshTypesBtn.style.marginTop = '10px';
    refreshTypesBtn.addEventListener('click', () => { // Make this refresh both
        this.refreshTypeFilterDisplay();
        this.refreshLevelFilterDisplay();
    });
    typeFilterGroup.appendChild(refreshTypesBtn);
    panelContent.appendChild(typeFilterGroup);
    
    // --- Log Level Filtering Section ---
    const levelFilterGroup = createSettingsGroup('Log Level Filtering',
      'Control which log levels are displayed in the console');
    
    // Create and assign the container for level filters
    this.levelFilterContainer = document.createElement('div');
    this.levelFilterContainer.classList.add('filter-levels-container');
    // No specific styling needed here as items have margins
    levelFilterGroup.appendChild(this.levelFilterContainer); // Add container to the group
    
    panelContent.appendChild(levelFilterGroup);
    
    // --- 4. Log Buffer & Export Section ---
    const bufferGroup = createSettingsGroup(
        'Log Buffer Management',
        'Manage the in-memory log buffer. Buffered when "Enable Console Logging" is on.'
    );

    // Create and append buffer status text first
    this.bufferStatusText = document.createElement('p');
    this.bufferStatusText.classList.add('settings-description');
    this.bufferStatusText.style.marginTop = '5px';
    this.bufferStatusText.style.marginBottom = '10px'; // Add some space before buttons
    bufferGroup.appendChild(this.bufferStatusText);

    // Add buffer action buttons
    const bufferActionsDiv = document.createElement('div');
    bufferActionsDiv.style.display = 'flex';
    bufferActionsDiv.style.gap = '10px';

    const viewBufferBtn = document.createElement('button');
    viewBufferBtn.classList.add('settings-button');
    viewBufferBtn.textContent = 'View Buffer';
    viewBufferBtn.addEventListener('click', () => {
      if (!this.bufferViewArea) {
        // Create textarea for buffer viewing if it doesn't exist yet
        this.bufferViewArea = document.createElement('textarea');
        this.bufferViewArea.classList.add('settings-textarea');
        this.bufferViewArea.setAttribute('readonly', true);
        this.bufferViewArea.style.width = '100%';
        this.bufferViewArea.style.height = '200px';
        this.bufferViewArea.style.marginTop = '10px';
        this.bufferViewArea.style.fontFamily = 'monospace';
        this.bufferViewArea.style.fontSize = '12px';
        bufferGroup.appendChild(this.bufferViewArea);
      }
      // Show it if already exists but might be hidden
      this.bufferViewArea.style.display = 'block';
      this._updateBufferedViewAndStatus(); // Update content
    });
    bufferActionsDiv.appendChild(viewBufferBtn);

    const clearBufferBtn = document.createElement('button');
    clearBufferBtn.classList.add('settings-button');
    clearBufferBtn.textContent = 'Clear Buffer';
    clearBufferBtn.addEventListener('click', () => {
      if (typeof window.APP.services.clearLogBuffer === 'function') {
        window.APP.services.clearLogBuffer();
        this._updateBufferedViewAndStatus(); // Update displayed buffer content if visible
      }
    });
    bufferActionsDiv.appendChild(clearBufferBtn);

    const downloadBufferBtn = document.createElement('button');
    downloadBufferBtn.classList.add('settings-button');
    downloadBufferBtn.textContent = 'Download Buffer';
    downloadBufferBtn.addEventListener('click', () => {
      if (typeof window.APP.services.getLogBuffer === 'function') {
        const logs = window.APP.services.getLogBuffer();
        if (logs.length === 0) {
          log.warn('BUFFER', 'DOWNLOAD_EMPTY', 'No logs to download');
          return;
        }
        
        const jsonStr = JSON.stringify(logs, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `console_log_buffer_${new Date().toISOString().replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
    bufferActionsDiv.appendChild(downloadBufferBtn);

    bufferGroup.appendChild(bufferActionsDiv);
    panelContent.appendChild(bufferGroup);
    
    // Finally append all content to element
    if (this.element) {
      this.element.appendChild(panelContent);
    }
    
    // Initial population of UI elements that depend on ConsoleLogManager
    this.updateStatusDisplay(); // This will now call refreshType/LevelFilterDisplay
    this._updateBufferedViewAndStatus(); // For buffer count

    log.info('UI', 'CREATE_UI_SUCCESS', "ConsoleLogPanel UI created and initial refresh triggered.");
  }

  destroy() {
    if (typeof window.unregisterOnBufferUpdate === 'function') {
      window.unregisterOnBufferUpdate(this._boundUpdateBufferedView);
    }
    // Clean up the global reference
    if (window.devPages && window.devPages.ui && window.devPages.ui.updateConsoleLogPanelStatus === this.updateStatusDisplay) {
        delete window.devPages.ui.updateConsoleLogPanelStatus;
        log.info('PANEL_DESTROY', 'STATUS_UPDATER_DEREGISTERED', 'Deregistered window.devPages.ui.updateConsoleLogPanelStatus');
    }

    if (this.container) {
      this.container.innerHTML = '';
    }
    log.info('PANEL_DESTROY', 'DESTROYED', 'Console Log Panel destroyed.');
  }

  // Convert refreshTypeFilterDisplay to a class method
  refreshTypeFilterDisplay() {
    if (!this.ensureContainersReady()) return;
    
    // Add detailed error checking
    if (!window.config) {
      console.error('window.config is not available');
      this.typesContainer.textContent = 'Error: window.config not found';
      return;
    }
    
        // Try to get discovered types from either logging system
    let discoveredTypes = [];
    
    // Try console log manager first
    if (this.consoleLogManager && 
        this.consoleLogManager.buffer && 
        typeof this.consoleLogManager.buffer.getDiscoveredTypes === 'function') {
      discoveredTypes = this.consoleLogManager.buffer.getDiscoveredTypes();
      panelOriginalConsole.debug('[ConsoleLogPanel] Using ConsoleLogManager for discovered types');
    }
    // Fallback to app log manager
    else if (this.appLogManager && 
             this.appLogManager.buffer && 
             typeof this.appLogManager.buffer.getDiscoveredTypes === 'function') {
      discoveredTypes = this.appLogManager.buffer.getDiscoveredTypes();
      panelOriginalConsole.debug('[ConsoleLogPanel] Using AppLogManager for discovered types');
    }
    // Fallback to window.discoveredTypes Set
    else if (typeof window !== 'undefined' && window.discoveredTypes) {
      discoveredTypes = Array.from(window.discoveredTypes);
      panelOriginalConsole.debug('[ConsoleLogPanel] Using window.discoveredTypes Set');
    }
    // Last resort - return some default types
    else {
      discoveredTypes = ['GENERAL', 'USER', 'API', 'SYSTEM', 'ERROR'];
      panelOriginalConsole.debug('[ConsoleLogPanel] Using default types - no logging system available');
    }

    panelOriginalConsole.debug('[ConsoleLogPanel] Refreshing type filter display');
    
    this.typesContainer.innerHTML = ''; // Clear existing content
    
    const includeTypes = new Set(FilterManager.getIncludeTypes());
    const excludeTypes = new Set(FilterManager.getExcludeTypes());
    
    // Removed spammy debug logging for type filter refresh
    
    if (discoveredTypes.length === 0) {
      this.typesContainer.textContent = 'No log types discovered yet. Generate some logs first.';
    } else {
      discoveredTypes.sort().forEach(type => {
        let initialState = 'normal';
        if (includeTypes.has(type)) initialState = 'solo';
        else if (excludeTypes.has(type)) initialState = 'mute';
        const typeDiv = this.createFilterCheckbox(type, initialState, 'type');
        this.typesContainer.appendChild(typeDiv);
      });
    }
  }

  // Ensure refreshLevelFilterDisplay is a class method and uses this.levelFilterContainer
  refreshLevelFilterDisplay() {
    if (!this.ensureContainersReady()) return;
    
    panelOriginalConsole.debug('[ConsoleLogPanel] Refreshing level filter display');

    if (!this.levelFilterContainer) {
      panelOriginalConsole.debug('[ConsoleLogPanel] Level filter container not ready for refresh.');
      return;
    }
    this.levelFilterContainer.innerHTML = ''; // Clear existing

    if (!window.config || !window.config.levelFilters) {
      const msg = "Log options (levels) not available yet. ConsoleLogManager might still be loading or window.config.levelFilters is not set.";
      panelOriginalConsole.debug(`[ConsoleLogPanel] ${msg}`); // Changed to debug level
      this.levelFilterContainer.textContent = msg;
      return;
    }

    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'TIMING'];
    const includeLevels = new Set(FilterManager.getIncludeLevels());
    const excludeLevels = new Set(FilterManager.getExcludeLevels());

    levels.forEach(level => {
      let initialState = 'normal';
      if (includeLevels.has(level)) initialState = 'solo';
      else if (excludeLevels.has(level)) initialState = 'mute';
      
      const levelDiv = this.createFilterCheckbox(level, initialState, 'level');
      this.levelFilterContainer.appendChild(levelDiv);
    });
  }

  // Convert createFilterCheckbox to a class method
  createFilterCheckbox(name, initialState, filterType) {
    const itemDiv = document.createElement('div');
    itemDiv.style.marginBottom = '5px';
    itemDiv.style.display = 'flex';
    itemDiv.style.alignItems = 'center';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.flexGrow = '1';
    nameSpan.style.fontWeight = '500';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '4px';
    
    const soloButton = document.createElement('button');
    soloButton.textContent = 'Solo';
    soloButton.className = 'filter-button solo-button';
    soloButton.style.padding = '2px 6px';
    soloButton.style.fontSize = '12px';
    soloButton.style.borderRadius = '3px';
    soloButton.style.border = '1px solid #ccc';
    soloButton.style.background = initialState === 'solo' ? '#ffcc00' : '#f0f0f0';
    soloButton.style.cursor = 'pointer';
    
    const muteButton = document.createElement('button');
    muteButton.textContent = 'Mute';
    muteButton.className = 'filter-button mute-button';
    muteButton.style.padding = '2px 6px';
    muteButton.style.fontSize = '12px';
    muteButton.style.borderRadius = '3px';
    muteButton.style.border = '1px solid #ccc';
    muteButton.style.background = initialState === 'mute' ? '#ff6666' : '#f0f0f0';
    muteButton.style.cursor = 'pointer';
    
    let currentItemState = initialState; // Use a local variable for the item's current state

    const updateButtonVisuals = (state) => {
      soloButton.style.background = state === 'solo' ? '#ffcc00' : '#f0f0f0';
      muteButton.style.background = state === 'mute' ? '#ff6666' : '#f0f0f0';
    };
    
    soloButton.addEventListener('click', () => {
      if (currentItemState === 'solo') {
        currentItemState = 'normal';
      } else {
        currentItemState = 'solo';
      }
      updateButtonVisuals(currentItemState);
      this.updateFilter(name, currentItemState, filterType);
      log.debug('FILTER', 'SOLO_BUTTON_CLICK', `Set ${filterType} "${name}" to ${currentItemState} mode via solo button`);
    });
    
    muteButton.addEventListener('click', () => {
      if (currentItemState === 'mute') {
        currentItemState = 'normal';
      } else {
        currentItemState = 'mute';
      }
      updateButtonVisuals(currentItemState);
      this.updateFilter(name, currentItemState, filterType);
      log.debug('FILTER', 'MUTE_BUTTON_CLICK', `Set ${filterType} "${name}" to ${currentItemState} mode via mute button`);
    });
    
    buttonContainer.appendChild(soloButton);
    buttonContainer.appendChild(muteButton);
    
    itemDiv.appendChild(nameSpan);
    itemDiv.appendChild(buttonContainer);
    
    return itemDiv;
  }

  // Convert updateFilter to a class method
  updateFilter(filterValue, filterAction, filterType) {
    let include = [], exclude = [];
    if (filterType === 'type') {
      include = FilterManager.getIncludeTypes().filter(f => f !== filterValue);
      exclude = FilterManager.getExcludeTypes().filter(f => f !== filterValue);
      if (filterAction === 'solo') include.push(filterValue);
      if (filterAction === 'mute') exclude.push(filterValue);
      FilterManager.setIncludeTypes(include);
      FilterManager.setExcludeTypes(exclude);
      // Live update LogManager
      if (typeof window.setIncludeTypes === 'function') window.setIncludeTypes(include);
      if (typeof window.setExcludeTypes === 'function') window.setExcludeTypes(exclude);
    } else if (filterType === 'level') {
      include = FilterManager.getIncludeLevels().filter(f => f !== filterValue);
      exclude = FilterManager.getExcludeLevels().filter(f => f !== filterValue);
      if (filterAction === 'solo') include.push(filterValue);
      if (filterAction === 'mute') exclude.push(filterValue);
      FilterManager.setIncludeLevels(include);
      FilterManager.setExcludeLevels(exclude);
      // Live update LogManager
      if (typeof window.setIncludeLevels === 'function') window.setIncludeLevels(include);
      if (typeof window.setExcludeLevels === 'function') window.setExcludeLevels(exclude);
    }
    // After updating, reload window.config for legacy code
    const allFilters = FilterManager.loadAllFilters();
    window.config.typeFilters = allFilters.typeFilters;
    window.config.levelFilters = allFilters.levelFilters;
    window.config.keywordFilters = allFilters.keywordFilters;
    this.refreshTypeFilterDisplay();
    this.refreshLevelFilterDisplay();
  }

  ensureContainersReady() {
    if (!this.typesContainer || !this.levelFilterContainer) {
        this.typesContainer = document.getElementById('console-log-types-container');
        this.levelFilterContainer = document.getElementById('console-log-levels-container');
        
        if (!this.typesContainer || !this.levelFilterContainer) {
            if (!this._waitingForContainers) {
                this._waitingForContainers = true;
                setTimeout(() => {
                    this._waitingForContainers = false;
                    this.ensureContainersReady();
                    this.refreshTypeFilterDisplay();
                    this.refreshLevelFilterDisplay(); 
                }, 150);
            }
            return false;
        }
    }
    return true;
  }
}

panelRegistry.register({
  id: 'console-log-panel',
  title: 'Console Log Options',
  component: ConsoleLogPanel,
  defaultCollapsed: true
});