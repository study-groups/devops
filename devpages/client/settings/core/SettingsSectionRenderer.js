import { settingsSectionRegistry } from './settingsSectionRegistry.js';
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

  const sectionsToRender = settingsSectionRegistry.getSectionsWithState();

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

      const SectionComponent = sectionData.component;
      // This is the line that can throw an error if the panel's constructor fails
      sectionInstances[sectionData.id] = new SectionComponent(contentWrapper);
      
      // Only append the container to the DOM if the component was created successfully
      container.appendChild(sectionContainer);

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
} 