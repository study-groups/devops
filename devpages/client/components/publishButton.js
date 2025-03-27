/**
 * Simple Publish/Unpublish Button Component
 * Creates a link to a preview page for sharing markdown content
 */

import { logMessage } from '../log/index.js';

// Add this function at the top of your file
function publishButtonExists() {
  return document.getElementById('publish-btn') !== null;
}

// Create and render the publish button
export function createPublishButton(container) {
  // Check if button already exists
  if (document.getElementById('publish-btn')) {
    logMessage('[PUBLISH] Publish button already exists, not creating another one');
    return null;
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'publish-button-container';
  
  const button = document.createElement('button');
  button.id = 'publish-btn';
  button.className = 'btn btn-secondary';
  button.innerHTML = '🌐 Publish';
  button.title = 'Create shareable preview link';
  
  buttonContainer.appendChild(button);
  
  // Add a URL display area that appears when published
  const linkDisplay = document.createElement('div');
  linkDisplay.className = 'publish-link-display';
  linkDisplay.style.display = 'none';
  buttonContainer.appendChild(linkDisplay);
  
  // Find a suitable container
  const targetContainer = document.querySelector(container) || 
                         document.querySelector('#toolbar-container') ||
                         document.querySelector('.md-toolbar') ||
                         document.querySelector('#md-editor');
  
  if (targetContainer) {
    targetContainer.appendChild(buttonContainer);
  } else {
    document.body.appendChild(buttonContainer);
  }
  
  // Attach event handler
  button.addEventListener('click', handlePublishClick);
  
  // Check initial state
  checkPublishStatus();
  
  return buttonContainer;
}

// Handle publish/unpublish button clicks
async function handlePublishClick() {
  const button = document.getElementById('publish-btn');
  const linkDisplay = document.querySelector('.publish-link-display');
  
  if (!button || !linkDisplay) return;
  
  // Get current file info
  const currentDir = localStorage.getItem('currentDir');
  const currentFile = localStorage.getItem('currentFile');
  
  if (!currentDir || !currentFile) {
    alert('Please open a file before publishing');
    return;
  }
  
  // Get editor content
  const editor = document.querySelector('#md-editor textarea');
  if (!editor) {
    logMessage('[PUBLISH] Editor not found');
    return;
  }
  
  const content = editor.value || '';
  
  try {
    // NEW: CLIENT-SIDE PUBLISHING SYSTEM
    // We'll implement publish/unpublish completely on the client side
    // using localStorage and URL parameters
    
    // Check local published data
    const localPublishData = localStorage.getItem('publishedFiles');
    const publishedFiles = localPublishData ? JSON.parse(localPublishData) : {};
    
    const fileKey = `${currentDir}/${currentFile}`;
    const isPublished = publishedFiles[fileKey] ? true : false;
    
    if (isPublished) {
      // Unpublish
      delete publishedFiles[fileKey];
      localStorage.setItem('publishedFiles', JSON.stringify(publishedFiles));
      
      button.innerHTML = '🌐 Publish';
      button.classList.remove('published');
      linkDisplay.style.display = 'none';
      logMessage(`[PUBLISH] File unpublished: ${fileKey}`);
    } else {
      // Publish - generate a unique ID
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const publishId = `${timestamp}-${randomStr}`;
      
      // Clean the filename for use in URLs
      const cleanFileName = currentFile
        .replace(/\.md$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase();
      
      // Create URL-friendly slug
      const urlSlug = `${cleanFileName}-${publishId}`;
      
      // Store in localStorage
      // Save the actual content
      localStorage.setItem(`publish_content_${publishId}`, content);
      
      // Save metadata
      publishedFiles[fileKey] = {
        id: publishId,
        slug: urlSlug,
        fileName: currentFile,
        publishedAt: new Date().toISOString()
      };
      
      localStorage.setItem('publishedFiles', JSON.stringify(publishedFiles));
      
      // Create the URL - use a special route that doesn't need server changes
      const baseUrl = window.location.origin;
      const viewUrl = `${baseUrl}/index.html?view=${urlSlug}`;
      
      button.innerHTML = '🚫 Unpublish';
      button.classList.add('published');
      
      // Display the link
      linkDisplay.innerHTML = `
        <input type="text" readonly value="${viewUrl}" class="publish-link-input" />
        <button class="copy-link-btn">
          <i class="fas fa-copy"></i> Copy
        </button>
      `;
      linkDisplay.style.display = 'flex';
      
      // Add copy button functionality
      const copyBtn = linkDisplay.querySelector('.copy-link-btn');
      const linkInput = linkDisplay.querySelector('.publish-link-input');
      
      copyBtn.addEventListener('click', () => {
        linkInput.select();
        document.execCommand('copy');
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        }, 2000);
      });
      
      logMessage(`[PUBLISH] File published: ${fileKey} at ${viewUrl}`);
    }
  } catch (error) {
    logMessage(`[PUBLISH ERROR] ${error.message}`);
    alert(`Publishing failed: ${error.message}`);
  }
}

// Check if the current file is published
export async function checkPublishStatus() {
  const currentDir = localStorage.getItem('currentDir');
  const currentFile = localStorage.getItem('currentFile');
  
  if (!currentDir || !currentFile) return;
  
  const button = document.getElementById('publish-btn');
  const linkDisplay = document.querySelector('.publish-link-display');
  
  if (!button || !linkDisplay) return;
  
  try {
    // Check local published data
    const localPublishData = localStorage.getItem('publishedFiles');
    const publishedFiles = localPublishData ? JSON.parse(localPublishData) : {};
    
    const fileKey = `${currentDir}/${currentFile}`;
    const isPublished = publishedFiles[fileKey] ? true : false;
    
    if (isPublished) {
      // Create the URL
      const baseUrl = window.location.origin;
      const urlSlug = publishedFiles[fileKey].slug;
      const viewUrl = `${baseUrl}/index.html?view=${urlSlug}`;
      
      button.innerHTML = '🚫 Unpublish';
      button.classList.add('published');
      
      // Show the link
      linkDisplay.innerHTML = `
        <input type="text" readonly value="${viewUrl}" class="publish-link-input" />
        <button class="copy-link-btn">
          <i class="fas fa-copy"></i> Copy
        </button>
      `;
      linkDisplay.style.display = 'flex';
      
      // Add copy button functionality
      const copyBtn = linkDisplay.querySelector('.copy-link-btn');
      const linkInput = linkDisplay.querySelector('.publish-link-input');
      
      copyBtn.addEventListener('click', () => {
        linkInput.select();
        document.execCommand('copy');
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        }, 2000);
      });
    } else {
      button.innerHTML = '🌐 Publish';
      button.classList.remove('published');
      linkDisplay.style.display = 'none';
    }
  } catch (error) {
    logMessage(`[PUBLISH ERROR] Failed to check publish status: ${error.message}`);
  }
}

export { handlePublishClick }; 