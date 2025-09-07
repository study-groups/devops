/**
 * Integration layer to replace existing publish functionality with the modal
 */

import { openPublishModal } from './publish/PublishModal.js';
import eventBus from '../eventBus.js';

const log = window.APP.services.log.createLogger('UI', 'PublishIntegration');

// Replace the existing publish functionality
export function initializePublishModalIntegration() {
  // Replace the triggerActions.publishToSpaces function
  if (window.triggerActions) {
    const originalPublishToSpaces = window.triggerActions.publishToSpaces;
    
    window.triggerActions.publishToSpaces = function() {
      log.info('REPLACE_ACTION', 'Publishing via modal interface');
      openPublishModal();
    };
    
    log.debug('REPLACE', 'Replaced publishToSpaces with modal interface');
  }

  // Handle publish button clicks
  document.addEventListener('click', (event) => {
    const target = event.target;
    
    // Handle floating publish button
    if (target.id === 'publish-btn' || target.closest('#publish-btn')) {
      event.preventDefault();
      event.stopPropagation();
      openPublishModal();
      return;
    }
    
    // Handle other publish buttons by class or data attributes
    if (target.classList.contains('publish-button') || 
        target.dataset.action === 'publish' ||
        target.textContent?.toLowerCase().includes('publish')) {
      
      // Only intercept if it looks like a publish action
      if (target.tagName === 'BUTTON' && 
          (target.textContent?.toLowerCase().includes('publish') ||
           target.title?.toLowerCase().includes('publish'))) {
        event.preventDefault();
        event.stopPropagation();
        openPublishModal();
      }
    }
  });

  // Listen for publish requests from event bus
  eventBus.on('publish:request', (data) => {
    log.debug('EVENT_REQUEST', 'Received publish request via event bus');
    openPublishModal(data?.pathname);
  });

  // Keyboard shortcuts are handled by KeyboardShortcutManager

  log.info('INIT', 'Publish modal integration initialized');
} 