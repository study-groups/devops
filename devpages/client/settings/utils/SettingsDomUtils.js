// Utility functions for settings panel DOM

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

  // Collapse/expand logic
  header.addEventListener('click', () => onToggle(id));
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(id);
    }
  });

  container.appendChild(header);
  if (isCollapsed) {
    container.classList.add('collapsed');
  }
  return container;
} 