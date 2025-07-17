import { panelRegistry } from '/client/panels/panelRegistry.js';
import { createSectionContainer } from '../utils/SettingsDomUtils.js';
import { appStore } from '/client/appState.js';

/**
 * Renders all settings sections into the given container.
 * @param {HTMLElement} container - The parent element to render sections into.
 * @param {Object} sectionInstances - Object to store section component instances.
 * @param {Function} onToggle - Callback for collapse/expand toggle.
 */
export function renderSettingsSections(container, sectionInstances, onToggle) {
  // Clear container
  container.innerHTML = '';

  const { panels: panelsState } = appStore.getState();
  const collapsedSections = panelsState.collapsedSections || {};

  const sectionsToRender = panelRegistry.getAllPanels().map(panel => ({
      ...panel,
      isCollapsed: collapsedSections[panel.id] ?? panel.defaultCollapsed
  }));
  
  console.log('[SettingsSectionRenderer] Rendering sections:', sectionsToRender.map(s => s.id));

  if (sectionsToRender.length === 0) {
    console.log('[SettingsSectionRenderer] No sections to render - registry is likely still loading panels.');
    
    // Don't show error message during normal loading process
    // The panels will be rendered once they're loaded via loadPanels()
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