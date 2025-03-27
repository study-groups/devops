/**
 * Floating Publish Button
 * Creates a fixed position publish button that appears in the corner of the screen
 */

import { logMessage } from '../log/index.js';
import { handlePublishClick, checkPublishStatus } from './publishButton.js';

export function createFloatingPublishButton() {
  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'floating-publish-wrapper';
  wrapper.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  `;
  
  // Create button
  const button = document.createElement('button');
  button.id = 'publish-btn';
  button.className = 'floating-publish-btn';
  
  // Check if FontAwesome is available
  const fontAwesomeAvailable = document.querySelector('link[href*="font-awesome"]') || 
                             document.querySelector('script[src*="fontawesome"]');
  
  // Use Unicode fallbacks for icons if FontAwesome isn't available
  button.innerHTML = fontAwesomeAvailable ? 
    '<i class="fas fa-globe"></i> Publish' : 
    '🌐 Publish';
  
  button.title = 'Create shareable preview link';
  button.style.cssText = `
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 50px;
    padding: 10px 15px;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    gap: 5px;
  `;
  
  // Create link display
  const linkDisplay = document.createElement('div');
  linkDisplay.className = 'publish-link-display';
  linkDisplay.style.cssText = `
    display: none;
    background: white;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    margin-bottom: 10px;
    width: 300px;
    max-width: 90vw;
  `;
  
  wrapper.appendChild(linkDisplay);
  wrapper.appendChild(button);
  document.body.appendChild(wrapper);
  
  // Attach event handlers
  button.addEventListener('click', handlePublishClick);
  
  logMessage('[PUBLISH] Floating publish button created');
  
  return wrapper;
} 