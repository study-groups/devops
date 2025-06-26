// Utility functions for settings panel DOM

import { panelIntrospector } from './PanelIntrospector.js';

/**
 * Creates a section container with a header for the settings panel.
 * @param {string} id - The section's unique ID.
 * @param {string} title - The section's display title.
 * @param {function} onToggle - Callback for collapse/expand toggle.
 * @param {boolean} isCollapsed - Whether the section is initially collapsed.
 * @returns {HTMLDivElement} The section container element.
 */
export function createSectionContainer(id, title, onToggle, isCollapsed) {
  const container = document.createElement('div');
  container.id = id;
  container.classList.add('settings-section-container');

  const header = document.createElement('h4');
  header.classList.add('settings-section-header');
  header.tabIndex = 0; // Make focusable
  header.setAttribute('role', 'button'); // Indicate interactive
  header.setAttribute('aria-expanded', !isCollapsed);
  header.setAttribute('data-panel-id', id); // Store panel ID for introspection

  // Title Text
  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;

  // Collapse Indicator
  const indicator = document.createElement('span');
  indicator.classList.add('collapse-indicator');
  indicator.innerHTML = isCollapsed ? '&#9654;' : '&#9660;';
  indicator.setAttribute('aria-hidden', 'true');

  header.appendChild(indicator);
  header.appendChild(titleSpan);

  // Long-click detection variables
  let longClickTimer = null;
  let isLongClick = false;
  let clickStartTime = 0;

  // Mouse/touch event handlers for long-click detection
  const startLongClickDetection = (e) => {
    clickStartTime = Date.now();
    isLongClick = false;
    
    longClickTimer = setTimeout(() => {
      isLongClick = true;
      // Trigger introspection
      showPanelIntrospection(id);
      // Add visual feedback
      header.classList.add('long-click-active');
    }, 800); // 800ms for long click
  };

  const cancelLongClickDetection = () => {
    if (longClickTimer) {
      clearTimeout(longClickTimer);
      longClickTimer = null;
    }
    header.classList.remove('long-click-active');
  };

  const handleClickEnd = (e) => {
    const clickDuration = Date.now() - clickStartTime;
    cancelLongClickDetection();
    
    // Only trigger normal click if it wasn't a long click
    if (!isLongClick && clickDuration < 800) {
      onToggle(id);
    }
    
    // Reset for next interaction
    setTimeout(() => {
      isLongClick = false;
    }, 50);
  };

  // Collapse/expand logic with long-click detection
  header.addEventListener('mousedown', startLongClickDetection);
  header.addEventListener('mouseup', handleClickEnd);
  header.addEventListener('mouseleave', cancelLongClickDetection);
  
  // Touch events for mobile
  header.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    startLongClickDetection(e);
  });
  
  header.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleClickEnd(e);
  });
  
  header.addEventListener('touchcancel', cancelLongClickDetection);

  // Keyboard support (existing functionality)
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(id);
    }
    // Long-click equivalent for keyboard (hold key for 1 second)
    else if (e.key === 'i' && e.ctrlKey) {
      e.preventDefault();
      showPanelIntrospection(id);
    }
  });

  container.appendChild(header);
  if (isCollapsed) {
    container.classList.add('collapsed');
  }
  
  return container;
}

/**
 * Show panel introspection popup
 * @param {string} panelId - The panel ID to inspect
 */
function showPanelIntrospection(panelId) {
  // Get panel instance from the global sectionInstances if available
  let panelInstance = null;
  if (window.devPages && window.devPages.settingsPanel && window.devPages.settingsPanel.sectionInstances) {
    panelInstance = window.devPages.settingsPanel.sectionInstances[panelId];
  }
  
  // Show introspection popup
  panelIntrospector.showIntrospection(panelId, panelInstance);
  
  console.log(`[PanelIntrospection] Showing introspection for panel: ${panelId}`);
}

// Add CSS for long-click visual feedback
const longClickStyles = document.createElement('style');
longClickStyles.textContent = `
  .settings-section-header {
    position: relative;
    transition: background-color 0.2s ease;
    cursor: pointer;
  }
  
  .settings-section-header:hover {
    background-color: var(--color-background-secondary, #f8fafc);
  }
  
  .settings-section-header.long-click-active {
    background-color: var(--color-primary, #2563eb);
    color: white;
  }
  
  .settings-section-header.long-click-active .collapse-indicator {
    color: white;
  }
  
  .settings-section-header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background-color: var(--color-primary, #2563eb);
    width: 0;
    transition: width 0.8s ease-out;
  }
  
  .settings-section-header:active::after {
    width: 100%;
  }
  
  /* Tooltip for long-click hint */
  .settings-section-header:hover::before {
    content: 'Long-click for panel introspection (Ctrl+I)';
    position: absolute;
    top: -35px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-foreground, #0f172a);
    color: var(--color-background, #ffffff);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
    z-index: 1000;
    opacity: 0;
    animation: tooltipFadeIn 0.3s ease-out 1s forwards;
  }
  
  @keyframes tooltipFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  /* Hide tooltip on active state */
  .settings-section-header:active::before,
  .settings-section-header.long-click-active::before {
    display: none;
  }
`;

document.head.appendChild(longClickStyles); 