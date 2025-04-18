/**
 * Preview Manager
 * Direct implementation of markdown preview functionality
 */

import { initPreview, updatePreview } from './preview/index.js';

// Initialize the preview system
export async function initializePreview() {
  console.log('[PREVIEW] Initializing preview system');
  
  try {
    // Initialize with all plugins
    const result = await initPreview({
      container: '#preview-container',
      plugins: ['highlight', 'mermaid', 'katex', 'audio-md', 'github-md'],
      theme: 'light',
      autoInit: true
    });
    
    if (result) {
      console.log('[PREVIEW] Preview system initialized successfully');
      
      // Set up editor input handler
      const editor = document.querySelector('#editor-container textarea');
      if (editor) {
        editor.addEventListener('input', debouncePreviewUpdate);
        console.log('[PREVIEW] Editor input handler connected');
      }
      
      // Set up refresh button handler
      const refreshBtn = document.getElementById('preview-reload-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshPreview);
        console.log('[PREVIEW] Refresh button connected');
      }
      
      // Handle view changes
      document.addEventListener('view:changed', handleViewChange);
      
      // Make function available globally
      window.updateMarkdownPreview = refreshPreview;
      
      // Initial render
      refreshPreview();
      
      return true;
    } else {
      console.error('[PREVIEW] Failed to initialize preview system');
      return false;
    }
  } catch (error) {
    console.error('[PREVIEW] Error initializing preview:', error);
    return false;
  }
}

// Refresh the preview with current editor content
export async function refreshPreview() {
  const editor = document.querySelector('#editor-container textarea');
  if (!editor) {
    console.error('[PREVIEW] Editor element not found');
    return;
  }
  
  const content = editor.value || '';
  
  try {
    await updatePreview(content);
    console.log('[PREVIEW] Preview updated successfully');
  } catch (error) {
    console.error('[PREVIEW] Error updating preview:', error);
  }
}

// Debounced version of preview update
let updateTimer;
function debouncePreviewUpdate() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(refreshPreview, 750);
}

// Handle view changes
function handleViewChange(e) {
  const mode = e.detail?.mode;
  
  if (mode === 'preview' || mode === 'split') {
    console.log(`[PREVIEW] View changed to ${mode}, refreshing preview`);
    setTimeout(refreshPreview, 100);
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializePreview); 