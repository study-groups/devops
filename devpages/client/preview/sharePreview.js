/**
 * Shared Preview Page Handler
 * Renders published markdown content for sharing
 */

import { renderMarkdown } from './renderer.js';
import { logMessage } from '../log/index.js';

// Get the preview ID from the URL
function getPreviewId() {
  const path = window.location.pathname;
  const parts = path.split('/');
  return parts[parts.length - 1];
}

// Load preview content
async function loadPreviewContent() {
  const previewId = getPreviewId();
  if (!previewId) {
    showError('Invalid preview link');
    return;
  }
  
  try {
    // In a real implementation, this would be a server API call
    // For this example, we'll use localStorage
    const previewDataJson = localStorage.getItem(`preview_${previewId}`);
    
    if (!previewDataJson) {
      showError('Preview not found or has expired');
      return;
    }
    
    const previewData = JSON.parse(previewDataJson);
    
    // Update page title
    const titleElement = document.getElementById('preview-title');
    if (titleElement && previewData.fileName) {
      titleElement.textContent = previewData.fileName;
      document.title = `Preview: ${previewData.fileName}`;
    }
    
    // Render the markdown
    const previewElement = document.getElementById('share-preview');
    if (!previewElement) {
      logMessage('[PREVIEW] Preview container not found');
      return;
    }
    
    // Render markdown
    const html = await renderMarkdown(previewData.content);
    previewElement.innerHTML = html;
    
    // Process any post-render plugins if available
    if (typeof window.getEnabledPlugins === 'function') {
      const enabledPlugins = window.getEnabledPlugins();
      for (const plugin of enabledPlugins) {
        if (plugin.postProcess) {
          await plugin.postProcess(previewElement, previewData.content);
        }
      }
    }
    
    logMessage('[PREVIEW] Shared preview rendered successfully');
  } catch (error) {
    logMessage(`[PREVIEW ERROR] Failed to load preview: ${error.message}`);
    showError('Failed to load preview');
  }
}

// Show error message
function showError(message) {
  const previewElement = document.getElementById('share-preview');
  if (previewElement) {
    previewElement.innerHTML = `
      <div class="preview-error">
        <h2>Error</h2>
        <p>${message}</p>
      </div>
    `;
  }
  
  logMessage(`[PREVIEW ERROR] ${message}`);
}

// Initialize the preview page
function initSharePreview() {
  logMessage('[PREVIEW] Initializing shared preview page');
  loadPreviewContent();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', initSharePreview); 