import { settingsRegistry } from './settingsRegistry.js';
import { createSectionContainer } from '../utils/SettingsDomUtils.js';

/**
 * Renders all settings sections into the given container.
 * @param {HTMLElement} container - The parent element to render sections into.
 * @param {Object} sectionInstances - Object to store section component instances.
 * @param {Function} onToggle - Callback for collapse/expand toggle.
 */
export function renderSettingsSections(container, sectionInstances, onToggle) {
  // Clear container
  container.innerHTML = '';

  console.log('[SettingsSectionRenderer] Starting renderSettingsSections...');
  console.log('[SettingsSectionRenderer] Registry object:', settingsRegistry);
  console.log('[SettingsSectionRenderer] Registry count:', settingsRegistry.count());
  
  // Check if we can access the registry through the devpages namespace
  if (window.devpages && window.devpages.settings && window.devpages.settings.registry) {
    console.log('[SettingsSectionRenderer] Found registry in devpages.settings.registry');
    console.log('[SettingsSectionRenderer] devpages.settings.registry count:', window.devpages.settings.registry.count());
  } else {
    console.warn('[SettingsSectionRenderer] Registry not found in devpages.settings.registry');
  }

  const sectionsToRender = settingsRegistry.getPanelsWithState();
  console.log('[SettingsSectionRenderer] Rendering sections:', sectionsToRender.map(s => s.id));

  if (sectionsToRender.length === 0) {
    console.warn('[SettingsSectionRenderer] No sections to render! This might indicate a problem with the registry.');
    
    // Try to debug by checking raw panels array
    console.log('[SettingsSectionRenderer] Calling debug() on registry:');
    settingsRegistry.debug();
    
    // Add a placeholder message in the UI
    const placeholderMsg = document.createElement('div');
    placeholderMsg.className = 'settings-empty-message';
    placeholderMsg.innerHTML = `
      <h3>No Settings Panels Found</h3>
      <p>This could be due to a loading issue or a problem with the registry.</p>
      <p>Check the console for more information.</p>
    `;
    container.appendChild(placeholderMsg);
    return;
  }

  sectionsToRender.forEach(sectionData => {
    try {
      const sectionContainer = createSectionContainer(
        sectionData.id,
        sectionData.title,
        onToggle,
        sectionData.isCollapsed
      );

      const contentWrapper = document.createElement('div');
      contentWrapper.classList.add('settings-section-content');
      sectionContainer.appendChild(contentWrapper);

      console.log(`[SettingsSectionRenderer] Creating instance for ${sectionData.id}, component:`, sectionData.component);
      
      const SectionComponent = sectionData.component;
      // This is the line that can throw an error if the panel's constructor fails
      sectionInstances[sectionData.id] = new SectionComponent(contentWrapper);
      
      // Only append the container to the DOM if the component was created successfully
      container.appendChild(sectionContainer);
      console.log(`[SettingsSectionRenderer] Successfully rendered section: ${sectionData.id}`);

    } catch (error) {
      console.error(`[SettingsSectionRenderer] Failed to render section '${sectionData.id}':`, error);

      // If an error occurred, create and append a clean error message container instead.
      const errorContainer = createSectionContainer(
        sectionData.id,
        `${sectionData.title} (Error)`,
        onToggle,
        false // Default to expanded on error
      );
      const errorContent = document.createElement('div');
      errorContent.classList.add('settings-section-content');
      errorContent.innerHTML = `<p class="settings-error-message">Error loading this section.</p>`;
      errorContainer.appendChild(errorContent);
      container.appendChild(errorContainer);
    }
  });
  
  console.log(`[SettingsSectionRenderer] Finished rendering ${sectionsToRender.length} sections`);
} 