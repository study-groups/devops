/**
 * editor.js
 * Handles Markdown editor functionality
 */
import { setView } from '/client/views.js';
import { eventBus } from '/client/eventBus.js';
import { uploadImage } from '/client/imageManager.js';
import { logMessage } from '/client/log/index.js';
import { globalFetch } from '/client/globalFetch.js';

// Import required file management functionality safely (dynamic)
async function getFileSystemState() {
    try {
        const fsModule = await import('/client/fileSystemState.js');
        return {
            getCurrentDirectory: fsModule.getCurrentDirectory || (() => ''),
            getCurrentFile: fsModule.getCurrentFile || (() => '')
        };
    } catch (e) {
        logEditor('[EDITOR ERROR] Failed to load fileSystemState module dynamically', 'error');
        return { getCurrentDirectory: () => '', getCurrentFile: () => '' };
    }
}

// Track initialization state
let editorInitialized = false;

// Core editor object with essential methods
const editorCore = {
  /**
   * Initialize the editor
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  initializeEditor: async function(options = {}) {
    if (editorInitialized) {
      logEditor('[EDITOR] Already initialized, skipping');
      return true;
    }

    logEditor('[EDITOR] Starting initialization');
    
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
      
      // Attach drag and drop listeners
      const editorElement = document.getElementById(options.containerId || 'md-editor');
      if (editorElement) {
        editorElement.addEventListener('dragover', (event) => {
          event.preventDefault();
          event.stopPropagation();
          editorElement.classList.add('dragover');
        });

        editorElement.addEventListener('dragleave', (event) => {
          event.preventDefault();
          event.stopPropagation();
          editorElement.classList.remove('dragover');
        });

        editorElement.addEventListener('drop', handleFileDrop);
        logEditor('Drag and drop listeners attached to editor.');
      } else {
        logEditor('Editor element not found for attaching drag/drop listeners.', 'warning');
      }
      
      // Emit initialization event
      eventBus.emit('editor:initialized');
      
      editorInitialized = true;
      logEditor('[EDITOR] Initialization complete');
      return true;
    } catch (error) {
      console.error('[EDITOR ERROR]', error);
      logEditor(`[EDITOR ERROR] Initialization failed: ${error.message}`);
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
      logEditor(`Content set (length: ${content.length})`);
      return true;
    }
    logEditor('Cannot set content, editor element not found.', 'warning');
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
      logEditor('[EDITOR] Uploading pasted image');
      const imageUrl = await uploadImage(blob);
      
      // Replace loading text with actual image markdown
      if (imageUrl) {
        logEditor(`[EDITOR] Image upload successful: ${imageUrl}`);
        
        // Replace the loading text with the actual image markdown
        const currentText = textarea.value;
        const updatedText = currentText.replace(loadingText, `![](${imageUrl})`);
        textarea.value = updatedText;
        
        // Emit event for preview update (instead of direct call)
        eventBus.emit('editor:contentChanged', { content: updatedText });
        
        return true;
      } else {
        logEditor('[EDITOR ERROR] Image upload failed - no URL returned');
        // Replace the loading text with an error message
        const currentText = textarea.value;
        const updatedText = currentText.replace(loadingText, '![Upload failed](error)');
        textarea.value = updatedText;
        textarea.dispatchEvent(new Event('input'));
        return false;
      }
    } catch (error) {
      logEditor(`[EDITOR ERROR] Image upload failed: ${error.message}`);
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
   * @returns {Promise<Object>} File information object
   */
  getCurrentFileInfo: async function() {
    const fsState = await getFileSystemState();
    return {
      directory: fsState.getCurrentDirectory(),
      filename: fsState.getCurrentFile()
    };
  }
};

/**
 * Set up the editor textarea
 */
function setupEditorTextarea() {
  const editorContainer = document.getElementById('md-editor');
  if (!editorContainer) {
    logEditor('[EDITOR] Editor container not found, creating one');
    
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
    logEditor('[EDITOR] Created editor container');
  } else {
    logEditor('[EDITOR] Found existing editor container');
    
    // Ensure textarea exists
    let textarea = editorContainer.querySelector('textarea');
    if (!textarea) {
      textarea = document.createElement('textarea');
      textarea.placeholder = 'Type Markdown here...';
      editorContainer.appendChild(textarea);
      logEditor('[EDITOR] Added missing textarea to editor container');
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
      logEditor('[EDITOR] Save shortcut triggered');
      eventBus.emit('editor:save');
    }
    
    // Ctrl+O / Cmd+O - Open (Example - might need implementation)
    // if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    //   e.preventDefault();
    //   logEditor('[EDITOR] Open shortcut triggered');
    //   eventBus.emit('editor:open');
    // }
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  const textarea = document.querySelector('#md-editor textarea');
  if (!textarea) return;
  
  // Debounced input event for preview updates
  let debounceTimer;
  textarea.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
          eventBus.emit('editor:contentChanged', { content: textarea.value });
      }, 250); // Debounce time (ms)
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
  logEditor('[EDITOR] Setting up image paste handler');
  
  const textarea = document.querySelector('#md-editor textarea');
  if (!textarea) {
    logEditor('[EDITOR ERROR] Textarea not found for image paste handler');
    return false;
  }
  
  // Setup paste event handler
  textarea.addEventListener('paste', async function(e) {
    logEditor('[EDITOR] Paste event detected');
    
    // Check if there are items in the clipboard
    if (!e.clipboardData || !e.clipboardData.items) {
      logEditor('[EDITOR] No clipboard data available');
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
      logEditor('[EDITOR] Found image in clipboard data');
      
      // Prevent default paste behavior for images
      e.preventDefault();
      
      // Get the image blob
      const blob = imageItem.getAsFile();
      if (!blob) {
        logEditor('[EDITOR ERROR] Could not get image file from clipboard');
        return;
      }
      
      // Upload the pasted image
      editorCore.uploadPastedImage(blob);
    }
  });
  
  logEditor('[EDITOR] Image paste handler initialized');
  return true;
}

// Helper function to log editor messages
function logEditor(message, level = 'text') {
    logMessage(`[EDITOR] ${message}`, level);
}

// <<< MODIFY: Drag and Drop Upload Logic >>>
function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const editorElement = document.getElementById('md-editor'); // Or the drop target
    if (editorElement) editorElement.classList.remove('dragover');
    logEditor('File drop detected.');

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) {
        logEditor('No files found in drop event.', 'warning');
        return;
    }

    // Process each dropped file
    for (const file of files) {
        logEditor(`Processing dropped file: ${file.name} (${file.type})`);

        const isImage = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');
        const isVideo = file.type.startsWith('video/');

        if (isImage) {
            logEditor(`Uploading image: ${file.name}`);
            // Use the existing image upload logic from imageManager
            // We assume uploadImage handles insertion or emits an event
            uploadImage(file).catch(err => {
                logEditor(`Image upload failed for ${file.name}: ${err.message}`, 'error');
                alert(`Image upload failed: ${err.message}`);
            });
        } else if (isAudio || isVideo) {
            logEditor(`Uploading media (audio/video): ${file.name}`);
            // Use the new function to upload audio/video to Spaces
            uploadMediaToSpaces(file);
        } else {
            logEditor(`Skipping unsupported file type: ${file.name} (${file.type})`, 'warning');
            // Optionally inform the user about unsupported types
            // alert(`File type not supported: ${file.type}`);
        }
    }
}

// <<< ADD: New function to upload audio/video to Spaces >>>
async function uploadMediaToSpaces(file) {
    const formData = new FormData();
    formData.append('mediaFile', file); // Must match the key expected by the server route ('mediaFile')

    logEditor(`Uploading ${file.type} to Spaces: ${file.name}...`);
    // Optionally show a loading indicator specific to this upload

    try {
        // Use the new endpoint /api/media/upload
        const response = await globalFetch('/api/media/upload', {
            method: 'POST',
            body: formData, // Browser sets Content-Type for FormData automatically
        });

        // Check if response is OK and content type is JSON before parsing
        if (!response.ok) {
            let errorMsg = `Server error: ${response.status} ${response.statusText}`;
            try {
                // Attempt to get more specific error from JSON body if possible
                const errorResult = await response.json();
                errorMsg = errorResult.error || errorMsg;
            } catch (e) {
                // If response is not JSON, use the status text
                logEditor('Response was not JSON, using status text for error.', 'warning');
            }
            throw new Error(errorMsg);
        }
        
        // Check content type before parsing JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Unexpected response type: ${contentType}. Expected JSON.`);
        }

        const result = await response.json();

        if (!result.url || !result.filePath) {
             throw new Error('Server response missing required filePath or url field.');
        }

        logEditor(`Media upload successful: ${result.filename}, Path: ${result.filePath}, URL: ${result.url}`);

        // Insert markdown using the absolute URL from the response
        insertMediaMarkdown(file.type, result.url, file.name);

        // Optionally hide loading indicator and show success message

    } catch (error) {
        logEditor(`Media upload failed: ${error.message}`, 'error');
        console.error('[MEDIA UPLOAD ERROR]', error);
        // Optionally hide loading indicator and show error message to user
        alert(`Media upload failed: ${error.message}`);
    }
}

// <<< KEEP: Existing function to insert Markdown >>>
function insertMediaMarkdown(fileType, filePath, originalName) {
    const editorTextarea = document.querySelector('#md-editor textarea');
    if (!editorTextarea) {
        logEditor('Editor textarea not found for inserting markdown.', 'error');
        return;
    }

    const typeTag = fileType.startsWith('audio/') ? '!audio' : '!video';
    // Use originalName as alt text, remove extension if desired
    const altText = originalName.split('.').slice(0, -1).join('.') || originalName;
    const markdownToInsert = `\n${typeTag}[${altText}](${filePath})\n`; // Add newlines

    // Insert at cursor position or append
    const start = editorTextarea.selectionStart;
    const end = editorTextarea.selectionEnd;
    const text = editorTextarea.value;
    
    editorTextarea.value = text.substring(0, start) + markdownToInsert + text.substring(end);
    
    // Move cursor after inserted text
    editorTextarea.selectionStart = editorTextarea.selectionEnd = start + markdownToInsert.length;

    // Trigger change event for preview update
    editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));

    logEditor(`Inserted markdown: ${markdownToInsert.trim()}`);
}

// Export for module use
export default editorCore;
export const editor = editorCore;
export const initializeEditor = editorCore.initializeEditor.bind(editorCore);
export const setContent = editorCore.setContent.bind(editorCore);
export const getContent = editorCore.getContent.bind(editorCore);
export const insertMarkdownImage = editorCore.insertMarkdownImage.bind(editorCore);
export const uploadPastedImage = editorCore.uploadPastedImage.bind(editorCore); 