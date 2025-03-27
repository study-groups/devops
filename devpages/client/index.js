// Import the publish button
import { createPublishButton, checkPublishStatus } from './components/publishButton.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Dynamically add CSS
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = '/client/css/publish-button.css';
  document.head.appendChild(cssLink);

  // Create the publish button
  createPublishButton('#toolbar-container');
  
  // Update publish button state when file changes
  document.addEventListener('file:loaded', () => {
    checkPublishStatus();
  });
}); 