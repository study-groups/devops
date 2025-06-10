/**
 * editor.js
 * Handles Markdown editor functionality
 */
import { eventBus } from '/client/eventBus.js';
import { uploadImage } from '/client/image/imageManager.js';
import { globalFetch } from '/client/globalFetch.js';
import { logMessage } from '/client/log/index.js';
import { appStore } from '/client/appState.js';

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

// Store the last selection to persist across blur/focus
let lastSelectionStart = 0;
let lastSelectionEnd = 0;
let selectionActive = false;

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
    
    const editorContainer = document.getElementById('editor-container');
    const editorTextarea = editorContainer?.querySelector('textarea');

    if (!editorContainer || !editorTextarea) {
        logEditor('[EDITOR ERROR] Initialization failed: #editor-container or its textarea not found.', 'error');
        return false;
    }
    
    try {
      // Initialize basic functionality
      setupKeyboardShortcuts();
      
      // Set default view from localStorage if available
      const savedView = localStorage.getItem('viewMode') || 'split';
      // setView(savedView);
      
      // Set up event listeners
      setupEventListeners();
      
      // Set up image paste handler
      setupImagePasteHandler();
      
      // Attach drag and drop listeners
      // const editorElement = document.getElementById(options.containerId || 'md-editor'); // OLD
      const editorElement = document.getElementById('editor-container'); // Use new ID
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
      
      // Add in a style for maintaining selection when blurred
      const style = document.createElement('style');
      style.textContent = `
        #editor-container textarea.keep-selection::selection {
          background-color: rgba(30, 144, 255, 0.5) !important; /* dodgerblue with transparency */
          color: inherit !important;
        }
        #editor-container textarea.keep-selection {
          user-select: text !important;
          -webkit-user-select: text !important;
        }
      `;
      document.head.appendChild(style);
      
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
    // const textarea = document.querySelector('#md-editor textarea'); // OLD
    const textarea = document.querySelector('#editor-container textarea'); // Use new selector
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
    const textarea = document.querySelector('#editor-container textarea');
    return textarea ? textarea.value : '';
  },
  
  /**
   * Insert text at cursor position
   * @param {string} text - Text to insert
   * @returns {boolean} Whether text was inserted successfully
   */
  insertTextAtCursor: function(text) {
    if (!text) return false;
    
    const textarea = document.querySelector('#editor-container textarea');
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
    
    const textarea = document.querySelector('#editor-container textarea');
    if (!textarea) {
        logEditor('[EDITOR ERROR] Textarea not found in #editor-container for uploadPastedImage');
        return false;
    }
    
    // Store original cursor position and text state
    const originalCursorPos = textarea.selectionStart;
    const originalText = textarea.value;
    
    // Show a temporary visual indicator (optional, e.g., change border style)
    textarea.style.cursor = 'wait'; 
    const originalBorder = textarea.style.border;
    textarea.style.border = '2px dashed orange';
    
    try {
      // Upload the image (this just returns the URL)
      logEditor('[EDITOR] Uploading pasted image (no placeholder)');
      const imageUrl = await uploadImage(blob);
      
      // Remove temporary indicator
      textarea.style.cursor = 'text';
      textarea.style.border = originalBorder;
      
      if (imageUrl) {
        logEditor(`[EDITOR] Image upload successful: ${imageUrl}. Inserting...`);
        
        // Insert the final markdown directly at the original cursor position
        const textBefore = originalText.substring(0, originalCursorPos);
        const textAfter = originalText.substring(originalCursorPos);
        const markdownToInsert = `\n![](${imageUrl})\n`;
        const updatedText = `${textBefore}${markdownToInsert}${textAfter}`;
        textarea.value = updatedText;
        
        // Move cursor after inserted text
        const newCursorPos = originalCursorPos + markdownToInsert.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Emit event for preview update
        eventBus.emit('editor:contentChanged', { content: updatedText });
        
        return true;
      } else {
        logEditor('[EDITOR ERROR] Image upload failed - no URL returned');
        // Restore original text if upload failed (optional)
        // textarea.value = originalText;
        // textarea.setSelectionRange(originalCursorPos, originalCursorPos);
        alert('Image upload failed.'); // Simple feedback
        return false;
      }
    } catch (error) {
      logEditor(`[EDITOR ERROR] Image upload failed: ${error.message}`);
      console.error('[EDITOR ERROR]', error);
      
      // Remove temporary indicator on error
      textarea.style.cursor = 'text';
      textarea.style.border = originalBorder;

      // Restore original text (optional)
      // textarea.value = originalText;
      // textarea.setSelectionRange(originalCursorPos, originalCursorPos);
      alert(`Image upload failed: ${error.message}`); // Simple feedback
      return false;
    }
  },
  
  /**
   * Get current selection in editor
   * @returns {Object} Selection object with start, end, and text properties
   */
  getSelection: function() {
    const textarea = document.querySelector('#editor-container textarea');
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
  },

  /**
   * Replace current selection or insert text at cursor.
   * @param {string} newText - Text to insert/replace with.
   * @returns {boolean} Whether the operation was successful.
   */
  replaceSelection: function(newText) {
    const textarea = document.querySelector('#editor-container textarea');
    if (!textarea) {
        logEditor('Cannot replace selection, editor textarea not found.', 'error');
        return false;
    }
    
    const currentDocument = textarea.ownerDocument;
    const activeElement = currentDocument.activeElement;

    // Ensure textarea is focused
    if (activeElement !== textarea) {
        textarea.focus();
    }
    
    // Use execCommand for undo support
    try {
        // Use the insertText command which can be undone
        const success = document.execCommand('insertText', false, newText);
        
        if (!success) {
            // Fall back to the old method if execCommand fails
            logEditor('execCommand failed, falling back to direct value change', 'warning');
            
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const originalValue = textarea.value;
            
            // Construct the new value
            textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
            
            // Set cursor position after the newly inserted text
            const newCursorPos = start + newText.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
        
        // Trigger an 'input' event to ensure that any listeners are notified
        textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        logEditor(`Editor selection replaced/text inserted (length: ${newText.length})`);
        return true;
    } catch (err) {
        logEditor(`Error replacing selection: ${err.message}`, 'error');
        return false;
    }
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
  const textarea = document.querySelector('#editor-container textarea');
  if (!textarea) return;
  
  // Debounced input event for preview updates
  let debounceTimer;
  textarea.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
          eventBus.emit('editor:contentChanged', { content: textarea.value });
      }, 250); // Debounce time (ms)
  });
  
  // Focus/blur events with selection persistence
  textarea.addEventListener('focus', () => {
    eventBus.emit('editor:focus');
    
    // Restore selection if we had an active selection before
    if (selectionActive && lastSelectionStart !== lastSelectionEnd) {
      textarea.setSelectionRange(lastSelectionStart, lastSelectionEnd);
    }
  });
  
  // Store selection on blur but don't clear it visually
  textarea.addEventListener('blur', (e) => {
    // Store the current selection before blur
    lastSelectionStart = textarea.selectionStart;
    lastSelectionEnd = textarea.selectionEnd;
    selectionActive = lastSelectionStart !== lastSelectionEnd;
    
    // If we have an active selection, prevent default blur behavior
    if (selectionActive) {
      // Apply a CSS class to maintain selection appearance
      textarea.classList.add('keep-selection');
      
      // We'll create this style in the initialization function
    }
    
    eventBus.emit('editor:blur');
  });
  
  // Track selection changes
  textarea.addEventListener('select', () => {
    lastSelectionStart = textarea.selectionStart;
    lastSelectionEnd = textarea.selectionEnd;
    selectionActive = lastSelectionStart !== lastSelectionEnd;
  });
}

/**
 * Set up image paste handler
 */
function setupImagePasteHandler() {
  logEditor('[EDITOR] Setting up image paste handler');
  
  const textarea = document.querySelector('#editor-container textarea');
  if (!textarea) {
    logEditor('[EDITOR ERROR] Textarea not found in #editor-container for image paste handler');
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

// Centralized logger function for this module
function logEditor(message, level = 'info') {
    const type = 'EDITOR';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`); // Fallback
    }
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
    const editorTextarea = document.querySelector('#editor-container textarea');
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

// Modify the setupContextMenu function to connect with log state buffers
/**
 * Set up custom context menu for the editor
 */
function setupContextMenu() {
  const textarea = document.querySelector('#editor-container textarea');
  if (!textarea) {
    logEditor('[EDITOR ERROR] Textarea not found for context menu setup');
    return false;
  }
  
  // Create context menu elements
  const contextMenu = document.createElement('div');
  contextMenu.className = 'editor-context-menu';
  contextMenu.style.cssText = 'position:absolute; background:#f8f8f8; border:1px solid #ccc; ' +
                             'border-radius:4px; padding:5px; z-index:1000; display:none; box-shadow:2px 2px 5px rgba(0,0,0,0.2);';
  
  // Create menu items
  const menuItemA = document.createElement('div');
  menuItemA.textContent = 'Set as State Buffer A';
  menuItemA.style.cssText = 'padding:5px 10px; cursor:pointer; user-select:none;';
  menuItemA.onmouseover = () => { menuItemA.style.backgroundColor = '#e8e8e8'; };
  menuItemA.onmouseout = () => { menuItemA.style.backgroundColor = 'transparent'; };
  
  const menuItemB = document.createElement('div');
  menuItemB.textContent = 'Set as State Buffer B';
  menuItemB.style.cssText = 'padding:5px 10px; cursor:pointer; user-select:none;';
  menuItemB.onmouseover = () => { menuItemB.style.backgroundColor = '#e8e8e8'; };
  menuItemB.onmouseout = () => { menuItemB.style.backgroundColor = 'transparent'; };
  
  // Add click handlers integrated with log state system
  menuItemA.addEventListener('click', () => {
    const selection = editorCore.getSelection();
    if (selection.text) {
      // Store selected text in state buffer A and notify system
      lastSelectionStart = selection.start;
      lastSelectionEnd = selection.end;
      selectionActive = true;
      
      // Get file info for context
      editorCore.getCurrentFileInfo().then(fileInfo => {
        // Emit event to update state buffer A
        eventBus.emit('editor:setSelectionStateA', {
          text: selection.text,
          start: selection.start,
          end: selection.end,
          filePath: fileInfo.filename
        });
        
        logEditor(`Set selection to state buffer A: "${selection.text.substring(0, 20)}${selection.text.length > 20 ? '...' : ''}" from ${fileInfo.filename}`);
        highlightNamedSelection('A', selection.start, selection.end);
      });
    }
    hideContextMenu();
  });
  
  menuItemB.addEventListener('click', () => {
    const selection = editorCore.getSelection();
    if (selection.text) {
      // Store selected text in state buffer B and notify system
      lastSelectionStart = selection.start;
      lastSelectionEnd = selection.end;
      selectionActive = true;
      
      // Get file info for context
      editorCore.getCurrentFileInfo().then(fileInfo => {
        // Emit event to update state buffer B
        eventBus.emit('editor:setSelectionStateB', {
          text: selection.text,
          start: selection.start,
          end: selection.end,
          filePath: fileInfo.filename
        });
        
        logEditor(`Set selection to state buffer B: "${selection.text.substring(0, 20)}${selection.text.length > 20 ? '...' : ''}" from ${fileInfo.filename}`);
        highlightNamedSelection('B', selection.start, selection.end);
      });
    }
    hideContextMenu();
  });
  
  // Build menu (simpler version focused on buffer integration)
  contextMenu.appendChild(menuItemA);
  contextMenu.appendChild(menuItemB);
  
  // Add to document
  document.body.appendChild(contextMenu);
  
  // Show/hide handlers
  function showContextMenu(x, y) {
    // Position the menu
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = 'block';
  }
  
  function hideContextMenu() {
    contextMenu.style.display = 'none';
  }
  
  // Add context menu event to textarea
  textarea.addEventListener('contextmenu', (e) => {
    // Only show our custom menu if there's a selection
    if (textarea.selectionStart !== textarea.selectionEnd) {
      e.preventDefault();
      showContextMenu(e.pageX, e.pageY);
    }
  });
  
  // Hide menu on document click
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });
  
  // Also hide on scroll and window resize
  document.addEventListener('scroll', hideContextMenu);
  window.addEventListener('resize', hideContextMenu);
  
  return true;
}

/**
 * Highlight a named selection (A or B) temporarily
 * @param {string} label - 'A' or 'B'
 * @param {number} start - start position
 * @param {number} end - end position
 */
function highlightNamedSelection(label, start, end) {
  const textarea = document.querySelector('#editor-container textarea');
  if (!textarea) return;
  
  // Store current selection
  const currentStart = textarea.selectionStart;
  const currentEnd = textarea.selectionEnd;
  
  // Flash the named selection
  textarea.setSelectionRange(start, end);
  
  // Add a temporary highlight class
  textarea.classList.add(`selection-${label.toLowerCase()}`);
  
  // Create highlight styles if they don't exist
  if (!document.getElementById('selection-highlight-styles')) {
    const style = document.createElement('style');
    style.id = 'selection-highlight-styles';
    style.textContent = `
      #editor-container textarea.selection-a::selection {
        background-color: rgba(255, 100, 100, 0.5) !important; /* red with transparency */
      }
      #editor-container textarea.selection-b::selection {
        background-color: rgba(100, 100, 255, 0.5) !important; /* blue with transparency */
      }
    `;
    document.head.appendChild(style);
  }
  
  // Show a temporary toast notification
  showToast(`Selection ${label} set`);
  
  // Remove highlight class and restore original selection after a brief time
  setTimeout(() => {
    textarea.classList.remove(`selection-${label.toLowerCase()}`);
    // Restore original selection
    textarea.setSelectionRange(currentStart, currentEnd);
  }, 1000);
}

/**
 * Show a toast notification
 * @param {string} message - message to show
 */
function showToast(message) {
  // Create toast element if it doesn't exist
  let toast = document.getElementById('editor-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'editor-toast';
    toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:rgba(50,50,50,0.8); ' +
                         'color:white; padding:8px 16px; border-radius:4px; z-index:1001; ' +
                         'opacity:0; transition:opacity 0.3s ease;';
    document.body.appendChild(toast);
  }
  
  // Set message and show
  toast.textContent = message;
  toast.style.opacity = '1';
  
  // Hide after timeout
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);
}

// Export for module use
export default editorCore;
export const editor = editorCore;
export const initializeEditor = editorCore.initializeEditor.bind(editorCore);
export const setContent = editorCore.setContent.bind(editorCore);
export const getContent = editorCore.getContent.bind(editorCore);
export const insertMarkdownImage = editorCore.insertMarkdownImage.bind(editorCore);
export const uploadPastedImage = editorCore.uploadPastedImage.bind(editorCore); 