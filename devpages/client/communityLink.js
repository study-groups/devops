/**
 * Community Link Management
 * Handles functionality for the community link button
 */

import { appStore } from '/client/appState.js';

// Centralized logger function for this module
function logCommunity(message, level = 'info') {
  const type = 'COMMUNITY';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`); // Fallback
  }
}

// Track initialization state
let initialized = false;

/**
 * Initialize the community link button
 */
export function initCommunityLink() {
  if (initialized) {
    logCommunity('[COMMUNITY] Community link already initialized');
    return;
  }
  
  const communityLinkBtn = document.getElementById('community-link-btn');
  if (!communityLinkBtn) {
    logCommunity('[COMMUNITY] Community link button not found');
    return;
  }
  
  // Add click handler
  communityLinkBtn.addEventListener('click', handleCommunityLink);
  
  // Mark as initialized
  initialized = true;
  logCommunity('[COMMUNITY] Community link initialized');
}

/**
 * Handle community link button click
 */
function handleCommunityLink() {
  try {
    // Get auth state from appStore
    const authState = appStore.getState().auth;
    if (!authState || !authState.isAuthenticated) {
      alert('Please log in to share with the community');
      return;
    }
    
    // Get current file and directory
    const fileSelect = document.getElementById('file-select');
    const dirSelect = document.getElementById('dir-select');
    
    if (!fileSelect || !fileSelect.value) {
      alert('Please select a file to share with the community');
      return;
    }
    
    const currentFile = fileSelect.value;
    const currentDir = dirSelect?.value || '';
    
    // Get editor content
    const editor = document.querySelector('#md-editor textarea');
    if (!editor) {
      alert('Editor not found');
      return;
    }
    
    const content = editor.value;
    
    // Confirm with user
    if (confirm(`Share "${currentFile}" with the community?`)) {
          // Create authentication headers (using session cookies)
    const headers = {
      'Content-Type': 'application/json'
    };
      
      // Save to Community Files
      fetch('/api/files/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: currentFile,
          dir: 'Community_Files',
          content: content
        })
      })
      .then(response => {
        if (response.ok) {
          alert(`Successfully shared ${currentFile} with the community!`);
        } else {
          response.text().then(text => {
            alert(`Error sharing file: ${response.status} - ${text}`);
          });
        }
      })
      .catch(error => {
        alert(`Error sharing file: ${error.message}`);
      });
    }
  } catch (error) {
    console.error('[COMMUNITY] Error:', error);
    alert(`Error: ${error.message}`);
  }
} 