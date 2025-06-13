/**
 * Integration layer to replace existing publish functionality with the modal
 */

import { openPublishModal } from './publish/PublishModal.js';
import { logMessage } from '../log/index.js';
import eventBus from '../eventBus.js';

// Replace the existing publish functionality
export function initializePublishModalIntegration() {
  // Replace the triggerActions.publishToSpaces function
  if (window.triggerActions) {
    const originalPublishToSpaces = window.triggerActions.publishToSpaces;
    
    window.triggerActions.publishToSpaces = function() {
      logMessage('Publishing via modal interface', 'info', 'PUBLISH_INTEGRATION');
      openPublishModal();
    };
    
    logMessage('Replaced publishToSpaces with modal interface', 'debug', 'PUBLISH_INTEGRATION');
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
    logMessage('Received publish request via event bus', 'debug', 'PUBLISH_INTEGRATION');
    openPublishModal(data?.pathname);
  });

  // Add keyboard shortcut (Ctrl+Shift+P)
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'P') {
      event.preventDefault();
      openPublishModal();
    }
  });

  logMessage('Publish modal integration initialized', 'info', 'PUBLISH_INTEGRATION');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePublishModalIntegration);
} else {
  initializePublishModalIntegration();
} 