/**
 * client/settings/ConsoleLogPanel.js
 * Settings panel for console logging, performance metrics, and keyword filtering.
 * Designed to be in feature parity with ConsoleLogManager.js
 */

function logConsolePanel(message, level = 'info') {
  const type = 'CONSOLE_LOG_PANEL';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

export class ConsoleLogPanel {
  constructor(container) {
    this.container = container;
    this.initialize();
  }

  initialize() {
    this.createUI();
    logConsolePanel('Console Log Panel initialized.');
  }

  createUI() {
    const panelContent = document.createElement('div');
    // panelContent.classList.add('settings-panel-content'); // Optional: if SettingsPanel.js needs it

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
        toggle.checked = typeof isCheckedFn === 'function' ? isCheckedFn() : false;
      } catch (e) { logConsolePanel(`Error getting initial state for ${id}: ${e.message}`, 'warn'); toggle.checked = false; }
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

    // --- 1. Console Logging Section ---
    const loggingGroup = createSettingsGroup('Console Logging');
    loggingGroup.appendChild(
      createToggleControl(
        'console-logging-toggle',
        'Enable Console Logging',
        'Toggle console message processing by the manager.',
        window.isConsoleLoggingEnabled,
        (checked, persist) => {
          if (checked) window.enableConsoleLogging(persist);
          else window.disableConsoleLogging(persist);
        }
      )
    );
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
    
    // --- 3. Performance Timing History Report Section ---
    const timingReportGroup = createSettingsGroup('Performance Timing History', 'View or clear recorded performance timing history.');
    let reportOutputArea = null;
    const timingButtonsDiv = createInputGroupDiv(); // Use for button alignment
    
    const timingReportButton = document.createElement('button');
    timingReportButton.classList.add('settings-button');
    timingReportButton.textContent = 'Generate Timing Report';
    timingReportButton.addEventListener('click', () => {
      if (typeof window.getTimingReport === 'function') {
        const report = window.getTimingReport();
        if (!reportOutputArea) {
          reportOutputArea = document.createElement('textarea');
          reportOutputArea.id = 'timing-report-output';
          reportOutputArea.classList.add('settings-textarea');
          reportOutputArea.readOnly = true; reportOutputArea.rows = 6;
          reportOutputArea.style.cssText = 'width: 100%; margin-top: 10px; font-family: monospace; font-size: 12px;';
          timingReportGroup.appendChild(reportOutputArea); // Append it to the group
        }
        reportOutputArea.value = report || 'No timing data recorded or report is empty.';
      } else if (reportOutputArea) { reportOutputArea.value = 'Timing report function not available.'; }
    });
    timingButtonsDiv.appendChild(timingReportButton);

    const clearReportButton = document.createElement('button');
    clearReportButton.classList.add('settings-button');
    clearReportButton.textContent = 'Clear Timing History';
    clearReportButton.style.marginLeft = '10px';
    clearReportButton.addEventListener('click', () => {
      if (typeof window.clearTimingHistory === 'function') {
        window.clearTimingHistory();
        if (reportOutputArea) reportOutputArea.value = 'Timing history cleared.';
        else logConsolePanel('Timing history cleared (no report area visible).');
      }
    });
    timingButtonsDiv.appendChild(clearReportButton);
    timingReportGroup.appendChild(timingButtonsDiv);
    panelContent.appendChild(timingReportGroup);

    // --- 4. Simple Keyword Log Filter Section ---
    const simpleFilterGroup = createSettingsGroup(
        'Simple Keyword Log Filter',
        'Filters apply as you type. Include: ALL keywords must appear. Exclude: ANY keyword will hide. Exclude takes precedence.'
    );

    const includeInputDiv = createInputGroupDiv();
    const includeLabel = document.createElement('label');
    includeLabel.htmlFor = 'include-keywords-input'; includeLabel.textContent = 'Include Keywords:'; includeLabel.style.marginRight="5px";
    const includeInput = document.createElement('input');
    includeInput.id = 'include-keywords-input'; includeInput.type = 'text'; includeInput.classList.add('settings-input'); 
    includeInput.placeholder = 'e.g., user auth payment';
    try { includeInput.value = typeof window.getIncludeKeywords === 'function' ? window.getIncludeKeywords() : ''; } 
    catch(e) { logConsolePanel('Error getting include keywords', 'warn'); }
    includeInput.addEventListener('input', () => { if(typeof window.setIncludeKeywords === 'function') window.setIncludeKeywords(includeInput.value, true); });
    includeInputDiv.appendChild(includeLabel); includeInputDiv.appendChild(includeInput);
    simpleFilterGroup.appendChild(includeInputDiv);

    const excludeInputDiv = createInputGroupDiv();
    const excludeLabel = document.createElement('label');
    excludeLabel.htmlFor = 'exclude-keywords-input'; excludeLabel.textContent = 'Exclude Keywords:'; excludeLabel.style.marginRight="5px";
    const excludeInput = document.createElement('input');
    excludeInput.id = 'exclude-keywords-input'; excludeInput.type = 'text'; excludeInput.classList.add('settings-input');
    excludeInput.placeholder = 'e.g., verbose noise temp';
    try { excludeInput.value = typeof window.getExcludeKeywords === 'function' ? window.getExcludeKeywords() : ''; }
    catch(e) { logConsolePanel('Error getting exclude keywords', 'warn');}
    excludeInput.addEventListener('input', () => { if(typeof window.setExcludeKeywords === 'function') window.setExcludeKeywords(excludeInput.value, true); });
    excludeInputDiv.appendChild(excludeLabel); excludeInputDiv.appendChild(excludeInput);
    simpleFilterGroup.appendChild(excludeInputDiv);
    
    const clearFiltersButton = document.createElement('button');
    clearFiltersButton.classList.add('settings-button'); clearFiltersButton.textContent = 'Clear All Keyword Filters';
    clearFiltersButton.style.marginTop = '5px';
    clearFiltersButton.addEventListener('click', () => {
        includeInput.value = ''; excludeInput.value = '';
        if (typeof window.clearLogFilter === 'function') window.clearLogFilter(true);
        logConsolePanel('Cleared simple keyword filters via panel.');
    });
    simpleFilterGroup.appendChild(clearFiltersButton);
    panelContent.appendChild(simpleFilterGroup);

    // --- 5. Log Keyword Histogram Section ---
    const histoGroup = createSettingsGroup(
        'Log Keyword Histogram',
        'Most frequent words in captured logs (min 3 chars). Requires performance logging to capture history.'
    );
    let histogramOutputDiv = null;
    const generateHistoButton = document.createElement('button');
    generateHistoButton.classList.add('settings-button'); generateHistoButton.textContent = 'Generate Histogram';
    generateHistoButton.addEventListener('click', async () => {
      if (typeof window.generateLogKeywordHistogram === 'function') {
        const histogram = await window.generateLogKeywordHistogram();
        if (!histogramOutputDiv) {
            histogramOutputDiv = document.createElement('div'); // Changed to div for pre-wrap
            histogramOutputDiv.id = 'keyword-histogram-output';
            histogramOutputDiv.classList.add('settings-textarea'); // Keep class for styling if needed
            histogramOutputDiv.style.cssText = 'margin-top: 10px; font-family: monospace; font-size: 12px; white-space: pre-wrap; max-height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 5px;';
            histoGroup.appendChild(histogramOutputDiv);
        }
        let output = '';
        if (!histogram || Object.keys(histogram).length === 0) {
          output = 'No keywords found or log history is empty/unavailable. (Ensure performance logging is on).';
        } else {
          const sortedKeywords = Object.entries(histogram).sort(([,a],[,b]) => b-a).slice(0,50);
          output += 'Top Keywords (Count):\n';
          sortedKeywords.forEach(([k, v]) => { output += `${k}: ${v}\n`; });
        }
        histogramOutputDiv.textContent = output;
      } else if(histogramOutputDiv) { histogramOutputDiv.textContent = 'Histogram function not available.'; }
    });
    histoGroup.appendChild(generateHistoButton);
    panelContent.appendChild(histoGroup);

    this.container.appendChild(panelContent);
  }

  destroy() {
    // If this panel adds any global listeners or holds complex objects, clean them up here.
    // For now, it mostly just creates DOM, which will be removed when the parent (SettingsPanel)
    // removes this.container or is destroyed itself.
    logConsolePanel('Console Log Panel destroyed (or parent is handling cleanup).');
  }
} 