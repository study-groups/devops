/**
 * core/editor.js
 * Single source of truth for editor functionality
 */
import { logMessage } from '../log/index.js';
import { setView } from './views.js';
import { eventBus } from '../eventBus.js';
import { uploadImage } from '/client/imageManager.js';

// Import required file management functionality
import { 
  getCurrentDirectory, 
  getCurrentFile 
} from '../core/fileSystemState.js';

// Track initialization state
let editorInitialized = false;

// Core editor object with essential methods
const editorCore = {
  /**
   * Initialize the editor
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  initializeEditor: async function() {
    if (editorInitialized) {
      logMessage('[EDITOR] Already initialized, skipping');
      return true;
    }

    logMessage('[EDITOR] Starting initialization');
    
    try {
      // Initialize basic functionality
      setupEditorTextarea();
      setupKeyboardShortcuts();
      
      // Set default view from localStorage if available
      const savedView = localStorage.getItem('viewMode') || 'split';
      setView(savedView);
      
      // Set up event listeners
      setupEventListeners();
      
      // Set up image paste handler
      setupImagePasteHandler();
      
      // Emit initialization event
      eventBus.emit('editor:initialized');
      
      editorInitialized = true;
      logMessage('[EDITOR] Initialization complete');
      return true;
    } catch (error) {
      console.error('[EDITOR ERROR]', error);
      logMessage(`[EDITOR ERROR] Initialization failed: ${error.message}`);
      return false;
    }
  },
  
  /**
   * Set editor content
   * @param {string} content - Content to set
   * @returns {boolean} Whether content was set successfully
   */
  setContent: function(content) {
    const textarea = document.querySelector('#md-editor textarea');
    if (textarea) {
      textarea.value = content || '';
      // Trigger input event to update preview
      textarea.dispatchEvent(new Event('input'));
      return true;
    }
    return false;
  },
  
  /**
   * Get editor content
   * @returns {string} Current editor content
   */
  getContent: function() {
    const textarea = document.querySelector('#md-editor textarea');
    return textarea ? textarea.value : '';
  },
  
  /**
   * Insert text at cursor position
   * @param {string} text - Text to insert
   * @returns {boolean} Whether text was inserted successfully
   */
  insertTextAtCursor: function(text) {
    if (!text) return false;
    
    const textarea = document.querySelector('#md-editor textarea');
    if (!textarea) return false;
    
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    
    textarea.value = `${textBefore}${text}${textAfter}`;
    
    // Update cursor position
    const newCursorPos = cursorPos + text.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Trigger input event to update preview
    textarea.dispatchEvent(new Event('input'));
    return true;
  },
  
  /**
   * Insert Markdown image syntax at cursor
   * @param {string} imageUrl - URL of the image
   * @returns {boolean} Whether image was inserted successfully
   */
  insertMarkdownImage: function(imageUrl) {
    if (!imageUrl) return false;
    return this.insertTextAtCursor(`\n![](${imageUrl})\n`);
  },
  
  /**
   * Upload pasted image
   * @param {Blob} blob - Image blob to upload
   * @returns {Promise<boolean>} Whether upload was successful
   */
  uploadPastedImage: async function(blob) {
    if (!blob) return false;
    
    const textarea = document.querySelector('#md-editor textarea');
    if (!textarea) return false;
    
    // Create a loading indicator
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    const loadingText = '![Uploading image...](uploading)';
    textarea.value = `${textBefore}${loadingText}${textAfter}`;
    
    // Update cursor position
    const newCursorPos = cursorPos + loadingText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    try {
      // Upload the image
      logMessage('[EDITOR] Uploading pasted image');
      const imageUrl = await uploadImage(blob);
      
      // Replace loading text with actual image markdown
      if (imageUrl) {
        logMessage(`[EDITOR] Image upload successful: ${imageUrl}`);
        
        // Replace the loading text with the actual image markdown
        const currentText = textarea.value;
        const updatedText = currentText.replace(loadingText, `![](${imageUrl})`);
        textarea.value = updatedText;
        
        // Update the preview
        if (typeof window.updateMarkdownPreview === 'function') {
          window.updateMarkdownPreview();
        }
        
        // Trigger input event for consistency
        textarea.dispatchEvent(new Event('input'));
        return true;
      } else {
        logMessage('[EDITOR ERROR] Image upload failed - no URL returned');
        // Replace the loading text with an error message
        const currentText = textarea.value;
        const updatedText = currentText.replace(loadingText, '![Upload failed](error)');
        textarea.value = updatedText;
        textarea.dispatchEvent(new Event('input'));
        return false;
      }
    } catch (error) {
      logMessage(`[EDITOR ERROR] Image upload failed: ${error.message}`);
      console.error('[EDITOR ERROR]', error);
      
      // Replace the loading text with an error message
      const currentText = textarea.value;
      const updatedText = currentText.replace(loadingText, '![Upload failed](error)');
      textarea.value = updatedText;
      textarea.dispatchEvent(new Event('input'));
      return false;
    }
  },
  
  /**
   * Get current selection in editor
   * @returns {Object} Selection object with start, end, and text properties
   */
  getSelection: function() {
    const textarea = document.querySelector('#md-editor textarea');
    if (!textarea) return { start: 0, end: 0, text: '' };
    
    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    };
  },
  
  /**
   * Get current file information
   * @returns {Object} File information object
   */
  getCurrentFileInfo: function() {
    return {
      directory: getCurrentDirectory(),
      filename: getCurrentFile()
    };
  }
};

/**
 * Set up the editor textarea
 */
function setupEditorTextarea() {
  const editorContainer = document.getElementById('md-editor');
  if (!editorContainer) {
    logMessage('[EDITOR] Editor container not found, creating one');
    
    // Create editor container if it doesn't exist
    const newEditor = document.createElement('div');
    newEditor.id = 'md-editor';
    newEditor.className = 'editor-container';
    
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Type Markdown here...';
    newEditor.appendChild(textarea);
    
    // Find content container
    const contentContainer = document.getElementById('content') || 
                            document.getElementById('app') || 
                            document.body;
    
    contentContainer.appendChild(newEditor);
    logMessage('[EDITOR] Created editor container');
  } else {
    logMessage('[EDITOR] Found existing editor container');
    
    // Ensure textarea exists
    let textarea = editorContainer.querySelector('textarea');
    if (!textarea) {
      textarea = document.createElement('textarea');
      textarea.placeholder = 'Type Markdown here...';
      editorContainer.appendChild(textarea);
      logMessage('[EDITOR] Added missing textarea to editor container');
    }
  }
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Only handle if not in an input field (except textarea)
    if (e.target.tagName === 'INPUT' && e.target.type !== 'textarea') return;
    
    // Ctrl+S / Cmd+S - Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      logMessage('[EDITOR] Save shortcut triggered');
      eventBus.emit('editor:save');
    }
    
    // Ctrl+O / Cmd+O - Open
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      logMessage('[EDITOR] Open shortcut triggered');
      eventBus.emit('editor:open');
    }
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  const textarea = document.querySelector('#md-editor textarea');
  if (!textarea) return;
  
  // Input event for preview updates
  textarea.addEventListener('input', () => {
    eventBus.emit('editor:contentChanged', { content: textarea.value });
  });
  
  // Focus/blur events
  textarea.addEventListener('focus', () => {
    eventBus.emit('editor:focus');
  });
  
  textarea.addEventListener('blur', () => {
    eventBus.emit('editor:blur');
  });
}

/**
 * Set up image paste handler
 */
function setupImagePasteHandler() {
  logMessage('[EDITOR] Setting up image paste handler');
  
  const textarea = document.querySelector('#md-editor textarea');
  if (!textarea) {
    logMessage('[EDITOR ERROR] Textarea not found for image paste handler');
    return false;
  }
  
  // Setup paste event handler
  textarea.addEventListener('paste', async function(e) {
    logMessage('[EDITOR] Paste event detected');
    
    // Check if there are items in the clipboard
    if (!e.clipboardData || !e.clipboardData.items) {
      logMessage('[EDITOR] No clipboard data available');
      return;
    }
    
    const items = e.clipboardData.items;
    let imageItem = null;
    
    // Find the first image item
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageItem = items[i];
        break;
      }
    }
    
    // If we found an image, handle it
    if (imageItem) {
      logMessage('[EDITOR] Found image in clipboard data');
      
      // Prevent default paste behavior for images
      e.preventDefault();
      
      // Get the image blob
      const blob = imageItem.getAsFile();
      if (!blob) {
        logMessage('[EDITOR ERROR] Could not get image file from clipboard');
        return;
      }
      
      // Upload the pasted image
      editorCore.uploadPastedImage(blob);
    }
  });
  
  logMessage('[EDITOR] Image paste handler initialized');
  return true;
}

// Make sure the editor object is available globally (for backward compatibility)
/*
function ensureGlobalEditor() {
  if (!window.editor) {
    window.editor = editorCore;
    logMessage('[EDITOR] Created global editor object');
  } else {
    // Merge existing editor object with our core
    Object.assign(window.editor, editorCore);
    logMessage('[EDITOR] Updated global editor object');
  }
}
  */

// Call immediately to ensure the editor object exists
//ensureGlobalEditor();

// Export for module use
export default editorCore;
export const editor = editorCore;
export const initializeEditor = editorCore.initializeEditor.bind(editorCore);
export const setContent = editorCore.setContent.bind(editorCore);
export const getContent = editorCore.getContent.bind(editorCore);
export const insertMarkdownImage = editorCore.insertMarkdownImage.bind(editorCore);
export const uploadPastedImage = editorCore.uploadPastedImage.bind(editorCore); 