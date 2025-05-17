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
    
    const perfDescription = document.createElement('p');
    perfDescription.classList.add('settings-description');
    perfDescription.textContent = 'Bootstrap load times are logged to the console when console logging is enabled.';
    
    perfSection.appendChild(perfHeader);
    perfSection.appendChild(perfDescription);
    
    // Add all sections to content div
    contentDiv.appendChild(loggingSection);
    contentDiv.appendChild(perfSection);
    
    // Append content to container
    this.container.appendChild(contentDiv);
  }

  destroy() {
    // Clean up any event listeners if needed
    logDevPanel('Developer Panel destroyed.');
  }
} 