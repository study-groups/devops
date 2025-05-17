/**
 * client/settings/DeveloperPanel.js
 * Settings panel for developer options such as console logging and performance metrics
 */

// Helper for logging specific to this panel
function logDevPanel(message, level = 'info') {
  const type = 'DEV_SETTINGS_PANEL';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

export class DeveloperPanel {
  constructor(container) {
    this.container = container;
    this.initialize();
  }

  initialize() {
    this.createUI();
    logDevPanel('Developer Panel initialized.');
  }

  createUI() {
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('settings-panel-content');
    
    // Console Logging Toggle Section
    const loggingSection = document.createElement('div');
    loggingSection.classList.add('settings-option-group');
    
    // Create console logging toggle
    const loggingLabel = document.createElement('label');
    loggingLabel.classList.add('settings-label');
    loggingLabel.htmlFor = 'console-logging-toggle';
    loggingLabel.textContent = 'Enable Console Logging';
    
    const loggingToggle = document.createElement('input');
    loggingToggle.id = 'console-logging-toggle';
    loggingToggle.type = 'checkbox';
    loggingToggle.classList.add('settings-checkbox');
    
    // Check current state (using the function from window)
    loggingToggle.checked = typeof window.isConsoleLoggingEnabled === 'function' 
      ? window.isConsoleLoggingEnabled() 
      : localStorage.getItem('consoleLoggingEnabled') === 'true';
    
    loggingToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (typeof window.enableConsoleLogging === 'function') {
          window.enableConsoleLogging(true);
        }
        logDevPanel('Console logging enabled');
      } else {
        if (typeof window.disableConsoleLogging === 'function') {
          window.disableConsoleLogging(true);
        }
        logDevPanel('Console logging disabled');
      }
    });
    
    // Description text
    const loggingDescription = document.createElement('p');
    loggingDescription.classList.add('settings-description');
    loggingDescription.textContent = 'When enabled, debug messages will appear in the browser console. Disabling can improve performance.';
    
    loggingSection.appendChild(loggingLabel);
    loggingSection.appendChild(loggingToggle);
    loggingSection.appendChild(loggingDescription);
    
    // Performance Monitoring Section
    const perfSection = document.createElement('div');
    perfSection.classList.add('settings-option-group');
    
    const perfHeader = document.createElement('h5');
    perfHeader.textContent = 'Performance Metrics';
    
    // Performance logging toggle
    const perfLabel = document.createElement('label');
    perfLabel.classList.add('settings-label');
    perfLabel.htmlFor = 'perf-logging-toggle';
    perfLabel.textContent = 'Enable Performance Logging';
    
    const perfToggle = document.createElement('input');
    perfToggle.id = 'perf-logging-toggle';
    perfToggle.type = 'checkbox';
    perfToggle.classList.add('settings-checkbox');
    
    // Check current state
    perfToggle.checked = typeof window.isPerformanceLoggingEnabled === 'function' 
      ? window.isPerformanceLoggingEnabled() 
      : localStorage.getItem('performanceLoggingEnabled') === 'true';
    
    perfToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (typeof window.enablePerformanceLogging === 'function') {
          window.enablePerformanceLogging(detailedPerfToggle.checked, true);
        } else {
          localStorage.setItem('performanceLoggingEnabled', 'true');
        }
        logDevPanel('Performance logging enabled');
      } else {
        if (typeof window.disablePerformanceLogging === 'function') {
          window.disablePerformanceLogging(true);
        } else {
          localStorage.setItem('performanceLoggingEnabled', 'false');
        }
        logDevPanel('Performance logging disabled');
      }
    });
    
    // Detailed performance logging toggle
    const detailedPerfLabel = document.createElement('label');
    detailedPerfLabel.classList.add('settings-label');
    detailedPerfLabel.htmlFor = 'detailed-perf-toggle';
    detailedPerfLabel.textContent = 'Show Detailed Performance Metrics';
    
    const detailedPerfToggle = document.createElement('input');
    detailedPerfToggle.id = 'detailed-perf-toggle';
    detailedPerfToggle.type = 'checkbox';
    detailedPerfToggle.classList.add('settings-checkbox');
    
    // Check current state
    detailedPerfToggle.checked = typeof window.isDetailedPerformanceLogEnabled === 'function' 
      ? window.isDetailedPerformanceLogEnabled() 
      : localStorage.getItem('detailedPerformanceLog') === 'true';
    
    detailedPerfToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (perfToggle.checked && typeof window.enablePerformanceLogging === 'function') {
          window.enablePerformanceLogging(true, true);
        }
        localStorage.setItem('detailedPerformanceLog', 'true');
        logDevPanel('Detailed performance logging enabled');
      } else {
        localStorage.setItem('detailedPerformanceLog', 'false');
        logDevPanel('Detailed performance logging disabled');
      }
    });
    
    const perfDescription = document.createElement('p');
    perfDescription.classList.add('settings-description');
    perfDescription.textContent = 'Adds timing information to all logs. Delta timing shows milliseconds since last log and since app start.';
    
    perfSection.appendChild(perfHeader);
    perfSection.appendChild(perfLabel);
    perfSection.appendChild(perfToggle);
    perfSection.appendChild(detailedPerfLabel);
    perfSection.appendChild(detailedPerfToggle);
    perfSection.appendChild(perfDescription);
    
    // Timing Report Section
    const timingReportSection = document.createElement('div');
    timingReportSection.classList.add('settings-option-group');
    
    const timingReportHeader = document.createElement('h5');
    timingReportHeader.textContent = 'Performance Timing History';
    
    const timingReportDescription = document.createElement('p');
    timingReportDescription.classList.add('settings-description');
    timingReportDescription.textContent = 'View timing history for operations performed during this session.';
    
    const timingReportButton = document.createElement('button');
    timingReportButton.classList.add('settings-button');
    timingReportButton.textContent = 'Generate Timing Report';
    timingReportButton.addEventListener('click', () => {
      if (typeof window.getTimingReport === 'function') {
        const report = window.getTimingReport();
        
        // Create or get report textarea
        let reportOutput = document.getElementById('timing-report-output');
        if (!reportOutput) {
          reportOutput = document.createElement('textarea');
          reportOutput.id = 'timing-report-output';
          reportOutput.classList.add('settings-textarea');
          reportOutput.readOnly = true;
          reportOutput.rows = 10;
          reportOutput.style.width = '100%';
          reportOutput.style.marginTop = '10px';
          reportOutput.style.fontFamily = 'monospace';
          reportOutput.style.fontSize = '12px';
          timingReportSection.appendChild(reportOutput);
        }
        
        // Display the report
        reportOutput.value = report;
        
        logDevPanel('Generated timing report');
      } else {
        logDevPanel('Timing history feature is not available', 'warn');
      }
    });
    
    const clearReportButton = document.createElement('button');
    clearReportButton.classList.add('settings-button');
    clearReportButton.textContent = 'Clear Timing History';
    clearReportButton.style.marginLeft = '10px';
    clearReportButton.addEventListener('click', () => {
      if (typeof window.clearTimingHistory === 'function') {
        window.clearTimingHistory();
        
        // Clear the report display if it exists
        const reportOutput = document.getElementById('timing-report-output');
        if (reportOutput) {
          reportOutput.value = 'Timing history cleared.';
        }
        
        logDevPanel('Cleared timing history');
      } else {
        logDevPanel('Timing history feature is not available', 'warn');
      }
    });
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.appendChild(timingReportButton);
    buttonContainer.appendChild(clearReportButton);
    
    timingReportSection.appendChild(timingReportHeader);
    timingReportSection.appendChild(timingReportDescription);
    timingReportSection.appendChild(buttonContainer);
    
    // Add all sections to content div
    contentDiv.appendChild(loggingSection);
    contentDiv.appendChild(perfSection);
    contentDiv.appendChild(timingReportSection);
    
    // Append content to container
    this.container.appendChild(contentDiv);
  }

  destroy() {
    // Clean up any event listeners if needed
    logDevPanel('Developer Panel destroyed.');
  }
} 